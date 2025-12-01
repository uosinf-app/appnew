// 📁 routes/a_masterbk.js
import express from "express";
import pool from "../db.js";
import multer from "multer";
import csvParser from "csv-parser";
import fs from "fs";
import XLSX from "xlsx";
import iconv from "iconv-lite";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// 🔧 دوال مساعدة
async function checkColumn(column) {
  const result = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name='a_master' AND column_name=$1
  `, [column]);
  return result.rows.length > 0;
}

async function checkExists(table, id, idColumn) {
  if (!id || id === '') return null;
  const result = await pool.query(`SELECT * FROM ${table} WHERE ${idColumn}=$1`, [id]);
  return result.rows[0] || null;
}

// 🆕 دالة للتحقق من وجود المورد
async function checkSupplierExists(supplierid) {
  if (!supplierid || supplierid === '') {
    console.log("⚠️ supplierid فارغ - سيتم استخدام NULL");
    return null;
  }
  
  try {
    console.log(`🔍 التحقق من وجود المورد: ${supplierid}`);
    const result = await pool.query("SELECT supplierid FROM suppliers WHERE supplierid=$1", [supplierid]);
    const exists = result.rows.length > 0;
    
    if (exists) {
      console.log(`✅ المورد ${supplierid} موجود`);
    } else {
      console.log(`❌ المورد ${supplierid} غير موجود - سيتم استخدام NULL`);
    }
    
    return exists ? supplierid : null;
  } catch (err) {
    console.error(`❌ خطأ في التحقق من المورد ${supplierid}:`, err.message);
    return null;
  }
}
// 🆕 دالة محسنة للتحقق من وجود الصنف
async function checkItemExists(item_id) {
  try {
    console.log(`🔍 التحقق من وجود الصنف: ${item_id}`);
    const result = await pool.query("SELECT item_id, item_nm FROM items WHERE item_id=$1", [item_id]);
    const exists = result.rows.length > 0;
    
    if (exists) {
      console.log(`✅ الصنف ${item_id} موجود في جدول الأصناف - الاسم: ${result.rows[0].item_nm}`);
    } else {
      console.log(`❌ الصنف ${item_id} غير موجود في جدول الأصناف`);
    }
    
    return exists;
  } catch (err) {
    console.error(`❌ خطأ في التحقق من الصنف ${item_id}:`, err.message);
    return false;
  }
}

// 🆕 دالة للتحقق من وجود السجل في a_master
async function checkMasterRecordExists(store_id, item_id) {
  try {
    console.log(`🔍 التحقق من وجود السجل في a_master: ${store_id}_${item_id}`);
    const result = await pool.query(
      "SELECT * FROM a_master WHERE store_id=$1 AND item_id=$2", 
      [store_id, item_id]
    );
    const exists = result.rows.length > 0;
    
    if (exists) {
      console.log(`✅ السجل موجود في a_master: ${store_id}_${item_id}`);
    } else {
      console.log(`📝 السجل غير موجود في a_master: ${store_id}_${item_id} - سيتم إضافته`);
    }
    
    return exists;
  } catch (err) {
    console.error(`❌ خطأ في التحقق من السجل:`, err.message);
    return false;
  }
}

// 🆕 دالة محسنة لإعداد البيانات مع التأكد من الترتيب الصحيح
async function prepareInsertData(data, hasRate = true) {
  console.log("📥 البيانات الواردة لـ prepareInsertData:", data);
  
  // 🆕 تحويل جميع القيم الرقمية بشكل آمن
  const item_qty = safeParseNumber(data.item_qty);
  const buy_price = safeParseNumber(data.buy_price);
  const total_price = safeParseNumber(data.total_price) || (item_qty * buy_price);
  const rate = safeParseNumber(data.rate);
  
  // 🆕 حساب سعر البيع إذا لم يكن محدداً
  let sale_price1 = safeParseNumber(data.sale_price1);
  if (sale_price1 === 0 && buy_price > 0 && rate > 0) {
    sale_price1 = buy_price + (buy_price * rate / 100);
  }
  
  // تحويل تنسيق التاريخ إلى yyyy/mm/dd
  let tranDate = data.tran_date || new Date();
  tranDate = formatDateToYYYYMMDD(tranDate) || new Date();
  let expiryDate = formatDateToYYYYMMDD(data.expiry_date) || null;

  // 🆕 التحقق من وجود المورد واستبدال القيم الفارغة بـ NULL
  const validSupplierid = await checkSupplierExists(data.supplierid);
  
  // 🆕 إعداد القيم بنفس ترتيب الحقول في جدول a_master
  const values = [
    data.store_id,               // $1 - store_id (نص/رقم)
    data.item_id,                // $2 - item_id (نص/رقم)
    item_qty,                    // $3 - item_qty (رقم)
    buy_price,                   // $4 - buy_price (رقم)
    total_price,                 // $5 - total_price (رقم)
    sale_price1,                 // $6 - sale_price1 (رقم)
    safeParseNumber(data.sale_price2),  // $7 - sale_price2 (رقم)
    safeParseNumber(data.sale_price3),  // $8 - sale_price3 (رقم)
    safeParseNumber(data.net_buy_price) || buy_price,  // $9 - net_buy_price (رقم)
    safeParseNumber(data.total_net_buy_price) || total_price,  // $10 - total_net_buy_price (رقم)
    tranDate,                    // $11 - tran_date (نص)
    validSupplierid,             // $12 - supplierid (نص) - NULL إذا لم يكن موجوداً
    data.mndop || "",            // $13 - mndop (نص)
    data.tran_type || "شراء",    // $14 - tran_type (نص)
    data.batch_no || "",         // $15 - batch_no (نص)
    expiryDate,                  // $16 - expiry_date (نص)
    safeParseNumber(data.min_qty),      // $17 - min_qty (رقم)
    data.remarks || "",          // $18 - remarks (نص)
    data.unit_type || 'piece',   // $19 - unit_type (نص)
    safeParseNumber(data.units_per_package, 1),  // $20 - units_per_package (رقم)
    data.sale_unit || 'piece',   // $21 - sale_unit (نص)
    safeParseNumber(data.conversion_factor, 1)   // $22 - conversion_factor (رقم)
  ];
  
  if (hasRate) {
    values.push(rate);       // $23 - rate (رقم)
  }
  
  console.log("📤 القيم المعدة للإدخال:", values);
  console.log("🔢 عدد المعاملات:", values.length);
  return values;
}

// 🆕 دالة محسنة لإعداد بيانات التحديث
async function prepareUpdateData(data, hasRate = true) {
  console.log("📥 البيانات الواردة لـ prepareUpdateData:", data);
  
  // 🆕 تحويل جميع القيم الرقمية بشكل آمن
  const item_qty = safeParseNumber(data.item_qty);
  const buy_price = safeParseNumber(data.buy_price);
  const total_price = safeParseNumber(data.total_price) || (item_qty * buy_price);
  const rate = safeParseNumber(data.rate);
  
  // 🆕 حساب سعر البيع إذا لم يكن محدداً
  let sale_price1 = safeParseNumber(data.sale_price1);
  if (sale_price1 === 0 && buy_price > 0 && rate > 0) {
    sale_price1 = buy_price + (buy_price * rate / 100);
  }
  
  // تحويل تنسيق التاريخ إلى yyyy/mm/dd
  let tranDate = data.tran_date || new Date();
  tranDate = formatDateToYYYYMMDD(tranDate) || new Date();
  let expiryDate = formatDateToYYYYMMDD(data.expiry_date) || null;

  // 🆕 التحقق من وجود المورد واستبدال القيم الفارغة بـ NULL
  const validSupplierid = await checkSupplierExists(data.supplierid);
  
  // 🆕 إعداد القيم بنفس ترتيب الحقول في استعلام UPDATE
  const values = [
    item_qty,                    // $1 - item_qty (رقم)
    buy_price,                   // $2 - buy_price (رقم)
    total_price,                 // $3 - total_price (رقم)
    sale_price1,                 // $4 - sale_price1 (رقم)
    safeParseNumber(data.sale_price2),  // $5 - sale_price2 (رقم)
    safeParseNumber(data.sale_price3),  // $6 - sale_price3 (رقم)
    safeParseNumber(data.net_buy_price) || buy_price,  // $7 - net_buy_price (رقم)
    safeParseNumber(data.total_net_buy_price) || total_price,  // $8 - total_net_buy_price (رقم)
    tranDate,                    // $9 - tran_date (نص)
    validSupplierid,             // $10 - supplierid (نص) - NULL إذا لم يكن موجوداً
    data.mndop || "",            // $11 - mndop (نص)
    data.tran_type || "شراء",    // $12 - tran_type (نص)
    data.batch_no || "",         // $13 - batch_no (نص)
    expiryDate,                  // $14 - expiry_date (نص)
    safeParseNumber(data.min_qty),      // $15 - min_qty (رقم)
    data.remarks || "",          // $16 - remarks (نص)
    data.unit_type || 'piece',   // $17 - unit_type (نص)
    safeParseNumber(data.units_per_package, 1),  // $18 - units_per_package (رقم)
    data.sale_unit || 'piece',   // $19 - sale_unit (نص)
    safeParseNumber(data.conversion_factor, 1)   // $20 - conversion_factor (رقم)
  ];
  
  if (hasRate) {
    values.push(rate);       // $21 - rate (رقم)
  }
  
  console.log("📤 القيم المعدة للتحديث:", values);
  console.log("🔢 عدد المعاملات:", values.length);
  return values;
}

// دالة لتحويل التاريخ إلى صيغة yyyy/mm/dd
function formatDateToYYYYMMDD(dateString) {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}/${month}/${day}`;
  } catch (err) {
    console.error("❌ خطأ في تحويل التاريخ:", err);
    return null;
  }
}

// 🆕 دالة مساعدة لتحويل القيم النصية إلى رقمية - الإصدار المحسن
function safeParseNumber(value, defaultValue = 0) {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  
  if (typeof value === 'string') {
    const nonNumericValues = ['piece', 'package', 'meter', 'box', 'علبة', 'قطعة', 'متر', 'كرتون'];
    if (nonNumericValues.includes(value.toLowerCase())) {
      return defaultValue;
    }
    
    const numericString = value.toString().replace(/[^\d.-]/g, '');
    if (numericString === '' || numericString === '-') {
      return defaultValue;
    }
    
    const parsed = parseFloat(numericString);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

// 📦 إضافة أو تحديث حركة - الإصدار المحسن
router.post("/", async (req, res) => {
  try {
    const data = req.body;
    
    console.log("📥 بيانات الواردة للإضافة/التحديث:", data);
    
    // التحقق من البيانات المطلوبة
    if (!data.store_id || data.store_id === '') {
      return res.status(400).json({ error: "❌ بيانات ناقصة: المخزن مطلوب" });
    }
    if (!data.item_id || data.item_id === '') {
      return res.status(400).json({ error: "❌ بيانات ناقصة: كود الصنف مطلوب" });
    }

    // 🆕 التحقق من وجود الصنف في جدول items أولاً
    const itemExists = await checkItemExists(data.item_id);
    if (!itemExists) {
      console.log(`❌ الصنف ${data.item_id} غير موجود في جدول الأصناف`);
      return res.status(404).json({ 
        error: `❌ الصنف ${data.item_id} غير موجود في جدول الأصناف. يجب إضافته أولاً من شاشة الأصناف` 
      });
    }

    console.log(`✅ الصنف ${data.item_id} موجود في جدول الأصناف - متابعة المعالجة`);

    // 🆕 التحقق من وجود السجل في a_master
    const recordExists = await checkMasterRecordExists(data.store_id, data.item_id);
    
    const hasRate = await checkColumn('rate');
    let result;

    if (recordExists) {
      // 🆕 تحديث السجل الموجود
      console.log(`🔄 تحديث السجل الموجود: ${data.store_id}_${data.item_id}`);
      
      const values = await prepareUpdateData(data, hasRate);
      
      let query;
      if (hasRate) {
        query = `UPDATE a_master SET 
                  item_qty=$1, buy_price=$2, total_price=$3,
                  sale_price1=$4, sale_price2=$5, sale_price3=$6, net_buy_price=$7, total_net_buy_price=$8,
                  tran_date=$9, supplierid=$10, mndop=$11, tran_type=$12, batch_no=$13, expiry_date=$14, 
                  min_qty=$15, remarks=$16, rate=$21,
                  unit_type=$17, units_per_package=$18, sale_unit=$19, conversion_factor=$20
                 WHERE store_id=$22 AND item_id=$23 
                 RETURNING *`;
        values.push(data.store_id, data.item_id);
      } else {
        query = `UPDATE a_master SET 
                  item_qty=$1, buy_price=$2, total_price=$3,
                  sale_price1=$4, sale_price2=$5, sale_price3=$6, net_buy_price=$7, total_net_buy_price=$8,
                  tran_date=$9, supplierid=$10, mndop=$11, tran_type=$12, batch_no=$13, expiry_date=$14, 
                  min_qty=$15, remarks=$16,
                  unit_type=$17, units_per_package=$18, sale_unit=$19, conversion_factor=$20
                 WHERE store_id=$21 AND item_id=$22 
                 RETURNING *`;
        values.push(data.store_id, data.item_id);
      }
      
      console.log("🔍 تنفيذ تحديث السجل:", query);
      result = await pool.query(query, values);
      console.log("✅ تم تحديث السجل بنجاح");
      
    } else {
      // 🆕 إضافة سجل جديد
      console.log(`🆕 إضافة سجل جديد: ${data.store_id}_${data.item_id}`);
      
      const values = await prepareInsertData(data, hasRate);
      
      let query;
      if (hasRate) {
        query = `INSERT INTO a_master (
                  store_id, item_id, item_qty, buy_price, total_price, 
                  sale_price1, sale_price2, sale_price3, net_buy_price, total_net_buy_price,
                  tran_date, supplierid, mndop, tran_type, batch_no, expiry_date, min_qty, remarks, 
                  unit_type, units_per_package, sale_unit, conversion_factor, rate
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`;
      } else {
        query = `INSERT INTO a_master (
                  store_id, item_id, item_qty, buy_price, total_price, 
                  sale_price1, sale_price2, sale_price3, net_buy_price, total_net_buy_price,
                  tran_date, supplierid, mndop, tran_type, batch_no, expiry_date, min_qty, remarks, 
                  unit_type, units_per_package, sale_unit, conversion_factor
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`;
      }

      console.log("🔍 تنفيذ إضافة سجل جديد:", query);
      result = await pool.query(query, values);
      console.log("✅ تم إضافة السجل بنجاح");
    }
    
    // معالجة التاريخ في الاستجابة
    const responseData = result.rows[0];
    if (responseData.tran_date) {
      responseData.tran_date = formatDateToYYYYMMDD(responseData.tran_date);
    }
    if (responseData.expiry_date) {
      responseData.expiry_date = formatDateToYYYYMMDD(responseData.expiry_date);
    }
    
    res.json({
      message: recordExists ? "✅ تم تحديث السجل بنجاح" : "✅ تم إضافة السجل بنجاح",
      action: recordExists ? "updated" : "inserted",
      data: responseData
    });
    
  } catch (err) {
    console.error("❌ خطأ في معالجة الحركة:", err.message);
    
    // 🆕 معالجة الأخطاء المختلفة
    if (err.message.includes('foreign key constraint')) {
      if (err.message.includes('supplierid')) {
        return res.status(400).json({ 
          error: "❌ المورد غير موجود. يرجى التحقق من كود المورد أو تركه فارغاً" 
        });
      }
    }
    
    if (err.message.includes('invalid input syntax for type numeric')) {
      return res.status(400).json({ 
        error: `❌ خطأ في أنواع البيانات: ${err.message}` 
      });
    }
    
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء معالجة الحركة" });
  }
});

// 📄 جلب حركة واحدة - الإصدار المصحح
router.get("/:key", async (req, res) => {
  try {
    const key = req.params.key;
    console.log(`🔍 جلب حركة بالمفتاح: ${key}`);
    
    if (!key || !key.includes('_')) {
      return res.status(400).json({ error: "❌ تنسيق المفتاح غير صحيح" });
    }
    
    const [store_id, item_id] = key.split("_");
    
    if (!store_id || !item_id) {
      return res.status(400).json({ error: "❌ بيانات ناقصة في المفتاح" });
    }

    console.log(`🔍 البحث عن الحركة: store_id=${store_id}, item_id=${item_id}`);
    
    const hasRate = await checkColumn('rate');
    const query = hasRate ? 
      "SELECT * FROM a_master WHERE store_id=$1 AND item_id=$2" : 
      "SELECT *, 0 as rate FROM a_master WHERE store_id=$1 AND item_id=$2";
    
    const result = await pool.query(query, [store_id, item_id]);
    
    if (!result.rows.length) {
      console.log(`❌ الحركة غير موجودة: ${store_id}_${item_id}`);
      return res.status(404).json({ error: "❌ الحركة غير موجودة" });
    }
    
    console.log(`✅ تم العثور على الحركة: ${store_id}_${item_id}`);
    
    // معالجة تنسيق التاريخ قبل الإرجاع
    const row = result.rows[0];
    if (row.tran_date) {
      row.tran_date = formatDateToYYYYMMDD(row.tran_date);
    }
    if (row.expiry_date) {
      row.expiry_date = formatDateToYYYYMMDD(row.expiry_date);
    }
    
    res.json(row);
  } catch (err) {
    console.error("❌ خطأ في جلب الحركة:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء جلب الحركة" });
  }
});

// 📋 جلب جميع الحركات
router.get("/", async (req, res) => {
  try {
    const hasRate = await checkColumn('rate');
    const query = hasRate ? 
      "SELECT * FROM a_master ORDER BY tran_date DESC" : 
      "SELECT *, 0 as rate FROM a_master ORDER BY tran_date DESC";
    const result = await pool.query(query);
    
    // معالجة التواريخ في النتائج
    const processedRows = result.rows.map(row => {
      if (row.tran_date) {
        row.tran_date = formatDateToYYYYMMDD(row.tran_date);
      }
      if (row.expiry_date) {
        row.expiry_date = formatDateToYYYYMMDD(row.expiry_date);
      }
      return row;
    });
    
    res.json(processedRows);
  } catch (err) {
    console.error("❌ خطأ في جلب الحركات:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء جلب الحركات" });
  }
});

// 🗑️ حذف حركة
router.delete("/:key", async (req, res) => {
  try {
    const key = req.params.key;
    console.log(`🗑️ حذف حركة بالمفتاح: ${key}`);
    
    if (!key || !key.includes('_')) {
      return res.status(400).json({ error: "❌ تنسيق المفتاح غير صحيح" });
    }
    
    const [store_id, item_id] = key.split("_");
    
    if (!store_id || !item_id) {
      return res.status(400).json({ error: "❌ بيانات ناقصة في المفتاح" });
    }

    console.log(`🗑️ حذف الحركة: store_id=${store_id}, item_id=${item_id}`);
    
    const result = await pool.query(
      "DELETE FROM a_master WHERE store_id=$1 AND item_id=$2 RETURNING *",
      [store_id, item_id]
    );
    
    if (!result.rows.length) {
      console.log(`❌ الحركة غير موجودة للحذف: ${store_id}_${item_id}`);
      return res.status(404).json({ error: "❌ الحركة غير موجودة" });
    }
    
    console.log(`✅ تم حذف الحركة: ${store_id}_${item_id}`);
    res.json({ 
      message: "✅ تم حذف السجل بنجاح",
      deleted: result.rows[0]
    });
  } catch (err) {
    console.error("❌ خطأ في حذف الحركة:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء حذف الحركة" });
  }
});

// 📥 استيراد دفعة من البيانات
router.post("/batch", async (req, res) => {
  try {
    const { rows } = req.body;
    console.log(`📥 استيراد دفعة من البيانات: ${rows.length} سجل`);
    
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: "❌ بيانات غير صالحة" });
    }
    
    const results = [];
    const errors = [];
    
    for (const row of rows) {
      try {
        // التحقق من وجود الصنف أولاً
        const itemExists = await checkItemExists(row.item_id);
        if (!itemExists) {
          errors.push(`❌ الصنف ${row.item_id} غير موجود في جدول الأصناف`);
          continue;
        }
        
        const recordExists = await checkMasterRecordExists(row.store_id, row.item_id);
        const hasRate = await checkColumn('rate');
        
        if (recordExists) {
          // تحديث السجل الموجود
          const values = await prepareUpdateData(row, hasRate);
          let query;
          
          if (hasRate) {
            query = `UPDATE a_master SET 
                      item_qty=$1, buy_price=$2, total_price=$3,
                      sale_price1=$4, sale_price2=$5, sale_price3=$6, net_buy_price=$7, total_net_buy_price=$8,
                      tran_date=$9, supplierid=$10, mndop=$11, tran_type=$12, batch_no=$13, expiry_date=$14, 
                      min_qty=$15, remarks=$16, rate=$21,
                      unit_type=$17, units_per_package=$18, sale_unit=$19, conversion_factor=$20
                     WHERE store_id=$22 AND item_id=$23 
                     RETURNING *`;
            values.push(row.store_id, row.item_id);
          } else {
            query = `UPDATE a_master SET 
                      item_qty=$1, buy_price=$2, total_price=$3,
                      sale_price1=$4, sale_price2=$5, sale_price3=$6, net_buy_price=$7, total_net_buy_price=$8,
                      tran_date=$9, supplierid=$10, mndop=$11, tran_type=$12, batch_no=$13, expiry_date=$14, 
                      min_qty=$15, remarks=$16,
                      unit_type=$17, units_per_package=$18, sale_unit=$19, conversion_factor=$20
                     WHERE store_id=$21 AND item_id=$22 
                     RETURNING *`;
            values.push(row.store_id, row.item_id);
          }
          
          const result = await pool.query(query, values);
          results.push({
            action: "updated",
            data: result.rows[0]
          });
        } else {
          // إضافة سجل جديد
          const values = await prepareInsertData(row, hasRate);
          let query;
          
          if (hasRate) {
            query = `INSERT INTO a_master (
                      store_id, item_id, item_qty, buy_price, total_price, 
                      sale_price1, sale_price2, sale_price3, net_buy_price, total_net_buy_price,
                      tran_date, supplierid, mndop, tran_type, batch_no, expiry_date, min_qty, remarks, 
                      unit_type, units_per_package, sale_unit, conversion_factor, rate
                     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`;
          } else {
            query = `INSERT INTO a_master (
                      store_id, item_id, item_qty, buy_price, total_price, 
                      sale_price1, sale_price2, sale_price3, net_buy_price, total_net_buy_price,
                      tran_date, supplierid, mndop, tran_type, batch_no, expiry_date, min_qty, remarks, 
                      unit_type, units_per_package, sale_unit, conversion_factor
                     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`;
          }
          
          const result = await pool.query(query, values);
          results.push({
            action: "inserted",
            data: result.rows[0]
          });
        }
      } catch (err) {
        errors.push(`❌ خطأ في معالجة السجل ${row.store_id}_${row.item_id}: ${err.message}`);
      }
    }
    
    console.log(`✅ تم معالجة ${results.length} سجل بنجاح، ${errors.length} أخطاء`);
    res.json({
      message: `تم استيراد ${results.length} سجل بنجاح`,
      processed: results.length,
      errors: errors.length,
      details: {
        successful: results,
        errors: errors
      }
    });
    
  } catch (err) {
    console.error("❌ خطأ في استيراد الدفعة:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء استيراد البيانات" });
  }
});

// 🆕 جلب بيانات صنف محدد من جدول items
router.get("/items/:item_id", async (req, res) => {
  try {
    const item_id = req.params.item_id;
    console.log(`🔍 جلب بيانات الصنف من جدول items: ${item_id}`);
    
    const result = await pool.query("SELECT item_id, item_nm FROM items WHERE item_id=$1", [item_id]);
    
    if (!result.rows.length) {
      console.log(`❌ الصنف غير موجود في جدول items: ${item_id}`);
      return res.status(404).json({ error: "❌ الصنف غير موجود" });
    }
    
    console.log(`✅ تم العثور على الصنف في جدول items: ${item_id} - الاسم: ${result.rows[0].item_nm}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في جلب بيانات الصنف:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء جلب بيانات الصنف" });
  }
});

// 🆕 جلب بيانات الوحدات للصنف
router.get("/units/:item_id", async (req, res) => {
  try {
    const item_id = req.params.item_id;
    console.log(`🔍 جلب بيانات الوحدات للصنف: ${item_id}`);
    
    const result = await pool.query(`
      SELECT unit_type, units_per_package, sale_unit, conversion_factor 
      FROM a_master 
      WHERE item_id=$1 
      LIMIT 1
    `, [item_id]);
    
    if (!result.rows.length) {
      // إرجاع قيم افتراضية إذا لم يكن الصنف موجوداً في المخزون
      console.log(`📝 استخدام القيم الافتراضية للوحدات: ${item_id}`);
      return res.json({
        unit_type: 'piece',
        units_per_package: 1,
        sale_unit: 'piece',
        conversion_factor: 1
      });
    }
    
    console.log(`✅ تم العثور على بيانات الوحدات: ${item_id}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في جلب بيانات الوحدات:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء جلب بيانات الوحدات" });
  }
});

// 🆕 جلب تنبيهات المخزون المنخفض - الإصدار المحسن
router.get("/alerts/low-stock", async (req, res) => {
  try {
    console.log(`🔍 جلب تنبيهات المخزون المنخفض`);
    
    const result = await pool.query(`
      SELECT m.store_id, m.item_id, m.item_qty, m.min_qty, 
             COALESCE(i.item_nm, 'غير معروف') as item_nm
      FROM a_master m
      LEFT JOIN items i ON m.item_id = i.item_id
      WHERE m.item_qty <= m.min_qty AND m.min_qty > 0
      ORDER BY m.item_qty ASC
    `);
    
    console.log(`✅ تم العثور على ${result.rows.length} تنبيه`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ خطأ في جلب التنبيهات:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء جلب التنبيهات" });
  }
});

// 🆕 البحث في الأصناف - الإصدار المحسن
router.get("/search/:query", async (req, res) => {
  try {
    const query = req.params.query;
    console.log(`🔍 البحث عن: ${query}`);
    
    const result = await pool.query(`
      SELECT m.*, COALESCE(i.item_nm, 'غير معروف') as item_nm 
      FROM a_master m
      LEFT JOIN items i ON m.item_id = i.item_id
      WHERE m.item_id ILIKE $1 OR i.item_nm ILIKE $1 OR i.item_nm IS NULL
      ORDER BY m.tran_date DESC
      LIMIT 50
    `, [`%${query}%`]);
    
    console.log(`✅ تم العثور على ${result.rows.length} نتيجة`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ خطأ في البحث:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء البحث" });
  }
});

// 🆕 تحويل الوحدات
router.post("/convert-units", async (req, res) => {
  try {
    const { item_id, quantity, from_unit, to_unit } = req.body;
    console.log(`🔄 تحويل الوحدات: ${quantity} ${from_unit} إلى ${to_unit} للصنف ${item_id}`);
    
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: "❌ الكمية غير صالحة" });
    }
    
    // الحصول على معامل التحويل من قاعدة البيانات
    const result = await pool.query(`
      SELECT units_per_package, conversion_factor 
      FROM a_master 
      WHERE item_id=$1 
      LIMIT 1
    `, [item_id]);
    
    const unitsPerPackage = result.rows.length > 0 ? parseFloat(result.rows[0].units_per_package) : 1;
    const conversionFactor = result.rows.length > 0 ? parseFloat(result.rows[0].conversion_factor) : 1;
    
    let converted_quantity = parseFloat(quantity);
    
    if (from_unit === 'piece' && to_unit === 'package') {
      converted_quantity = quantity / unitsPerPackage;
    } else if (from_unit === 'package' && to_unit === 'piece') {
      converted_quantity = quantity * unitsPerPackage;
    }
    
    // تقريب النتيجة إلى منزلتين عشريتين
    converted_quantity = Math.round(converted_quantity * 100) / 100;
    
    console.log(`✅ نتيجة التحويل: ${converted_quantity}`);
    res.json({ 
      converted_quantity,
      original_quantity: quantity,
      from_unit,
      to_unit,
      units_per_package: unitsPerPackage
    });
  } catch (err) {
    console.error("❌ خطأ في تحويل الوحدات:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء تحويل الوحدات" });
  }
});


export default router;