// ======================== 🧩 routes/salesbk.js ========================
import express from "express";
import pool from "../db.js";

const router = express.Router();

// 🔹 Helper
function makeKey(store, invoice, item, ser) {
  return `${store}_${invoice}_${item}_${ser}`;
}

// ======================== 🔍 التحقق من وجود الفاتورة (مع التاريخ والمخزن) ========================
router.get("/check-invoice/:invoice_id", async (req, res) => {
  const { invoice_id } = req.params;
  const { tran_date, store_id } = req.query;

  try {
    const invoiceIdInt = parseInt(invoice_id);
    if (isNaN(invoiceIdInt)) {
      return res.json({ 
        success: true, 
        exists: false 
      });
    }

    let q;
    let params;

    if (tran_date && store_id) {
      // التحقق مع التاريخ والمخزن المحددين
      q = `
        SELECT COUNT(*) as count 
        FROM public.sales 
        WHERE invoice_id = $1 
          AND store_id = $2 
          AND DATE(tran_date) = DATE($3)
      `;
      params = [invoiceIdInt, store_id, tran_date];
    } else {
      // التحقق بدون تاريخ ومخزن (جميع الفواتير)
      q = `
        SELECT COUNT(*) as count 
        FROM public.sales 
        WHERE invoice_id = $1
      `;
      params = [invoiceIdInt];
    }
    
    const result = await pool.query(q, params);
    const exists = parseInt(result.rows[0].count) > 0;

    res.json({ 
      success: true, 
      exists,
      invoice_id: invoiceIdInt
    });

  } catch (err) {
    console.error("❌ خطأ في التحقق من الفاتورة:", err);
    res.json({ 
      success: true, 
      exists: false
    });
  }
});

// ======================== 🔢 جلب رقم الفاتورة التالي ========================
router.get("/next-invoice", async (req, res) => {
  const { tran_date, store_id, user_id } = req.query;

  console.log(`🔢 طلب رقم فاتورة جديد:`, { tran_date, store_id, user_id });

  if (!tran_date || !store_id) {
    return res.status(400).json({ 
      success: false, 
      message: "التاريخ والمخزن مطلوبان" 
    });
  }

  try {
    // البحث عن أعلى رقم فاتورة للتاريخ والمخزن المحددين فقط
    const q = `
      SELECT MAX(invoice_id) as max_invoice
      FROM public.sales
      WHERE DATE(tran_date) = DATE($1)
        AND store_id = $2
    `;
    
    console.log(`🔍 البحث عن أعلى فاتورة للتاريخ: ${tran_date}, المخزن: ${store_id}`);
    
    const result = await pool.query(q, [tran_date, store_id]);
    
    let nextInvoice = 1; // القيمة الافتراضية إذا لم توجد فواتير
    
    if (result.rows[0].max_invoice !== null) {
      // إذا وجدت فواتير لهذا التاريخ، نأخذ أعلى رقم ونضيف 1
      nextInvoice = parseInt(result.rows[0].max_invoice) + 1;
      console.log(`📊 وجدت فواتير سابقة. أعلى رقم: ${result.rows[0].max_invoice}, التالي: ${nextInvoice}`);
    } else {
      console.log(`📊 لا توجد فواتير للتاريخ ${tran_date}. البدء برقم 1`);
    }

    console.log(`✅ رقم الفاتورة التالي: ${nextInvoice}`);

    res.json({ 
      success: true, 
      next_invoice: nextInvoice,
      max_invoice: result.rows[0].max_invoice,
      message: result.rows[0].max_invoice ? 
        `تم العثور على فاتورة سابقة: ${result.rows[0].max_invoice}` : 
        'لا توجد فواتير سابقة لهذا التاريخ'
    });

  } catch (err) {
    console.error("❌ خطأ في next-invoice:", err);
    
    // في حالة الخطأ، نعيد رقم فاتورة افتراضي
    res.status(500).json({ 
      success: false,
      message: "خطأ في السيرفر",
      error: err.message,
      next_invoice: 1
    });
  }
});
// ======================== 📦 جلب الوحدات ========================
// في server.js - بعد const app = express();
router.get('/units', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT unit_name 
       FROM units 
       WHERE is_active = true 
       ORDER BY unit_id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ خطأ في جلب الوحدات:", err);
    res.json([]);
  }
});

// ======================== 📋 جلب آخر المبيعات ========================
router.get("/", async (req, res) => {
  const limit = parseInt(req.query.limit || "30", 10);
  try {
    const q = `
      SELECT tran_date, store_id, customer_id, invoice_id, item_id, item_qty, sale_price, total_price,
             discount, sale_type, price_type, user_id, ser_no, unit_type, batch_no, expiry_date, units_per_package
      FROM public.sales
      ORDER BY tran_date DESC
      LIMIT $1
    `;
    const result = await pool.query(q, [limit]);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /sales error", err);
    res.status(500).json({ error: "حدث خطأ في السيرفر أثناء جلب البيانات" });
  }
});

// ======================== 🔍 البحث عن الأصناف في مخزن معين ========================
router.get("/store-items/:store_id", async (req, res) => {
  const { store_id } = req.params;
  const { q } = req.query;

  console.log(`🔍 البحث عن الأصناف في المخزن ${store_id} بالكلمة: ${q}`);

  if (!store_id) {
    return res.status(400).json({ success: false, message: "معرف المخزن مطلوب" });
  }

  // تحويل store_id إلى رقم
  const storeIdNum = parseInt(store_id);
  if (isNaN(storeIdNum)) {
    return res.status(400).json({ success: false, message: "معرف المخزن يجب أن يكون رقماً" });
  }

  try {
    // استعلام مبسط أولاً بدون العروض
    let query = `
      SELECT 
        m.item_id,
        COALESCE(i.item_nm, 'غير معروف') AS item_nm,
        m.item_qty,
        m.unit_type,
        m.batch_no,
        m.expiry_date,
        m.sale_price1,
        m.sale_price2,
        m.sale_price3,
        m.buy_price,
        m.units_per_package,
        m.conversion_factor
      FROM public.a_master m
      LEFT JOIN public.items i ON m.item_id = i.item_id
      WHERE m.store_id = $1 
        AND m.item_qty > 0
    `;

    const params = [storeIdNum];

    if (q && q.trim() !== "") {
      query += ` AND (m.item_id::text ILIKE $2 OR i.item_nm ILIKE $2)`;
      params.push(`%${q}%`);
    }

    query += ` ORDER BY i.item_nm LIMIT 20`;

    const result = await pool.query(query, params);

    // الآن إضافة بيانات العروض لكل صنف
    const itemsWithOffers = await Promise.all(
      result.rows.map(async (item) => {
        try {
          const offerQuery = `
            SELECT offer_price1, offer_price2, offer_price3
            FROM public.item_price_offers 
            WHERE item_id = $1 
              AND store_id = $2 
              AND is_active = true
              AND CURRENT_DATE BETWEEN start_date AND COALESCE(end_date, CURRENT_DATE)`;
          
          const offerResult = await pool.query(offerQuery, [item.item_id, storeIdNum]);
          
          if (offerResult.rows.length > 0) {
            const offer = offerResult.rows[0];
            return {
              ...item,
              has_active_offer: true,
              final_price1: offer.offer_price1 || item.sale_price1,
              final_price2: offer.offer_price2 || item.sale_price2,
              final_price3: offer.offer_price3 || item.sale_price3
            };
          } else {
            return {
              ...item,
              has_active_offer: false,
              final_price1: item.sale_price1,
              final_price2: item.sale_price2,
              final_price3: item.sale_price3
            };
          }
        } catch (error) {
          console.log(`⚠️ خطأ في جلب عروض الصنف ${item.item_id}:`, error.message);
          return {
            ...item,
            has_active_offer: false,
            final_price1: item.sale_price1,
            final_price2: item.sale_price2,
            final_price3: item.sale_price3
          };
        }
      })
    );

    res.json({
      success: true,
      store_id: storeIdNum,
      search_query: q || '',
      items: itemsWithOffers
    });

  } catch (err) {
    console.error("❌ خطأ في استعلام البحث:", err);
    res.status(500).json({
      success: false,
      message: "خطأ في السيرفر أثناء البحث في المخزون",
      error: err.message
    });
  }
});

// ======================== 📊 جلب بيانات المخزون ========================
router.get("/:store_id/:item_id", async (req, res) => {
  const { store_id, item_id } = req.params;
  
  console.log(`🔍 محاولة جلب بيانات المخزون: المخزن ${store_id}, الصنف ${item_id}`);
  
  try {
    // التحقق من صحة المدخلات وتحويلها إلى أرقام
    if (!store_id || !item_id) {
      return res.status(400).json({ 
        success: false,
        message: "معرف المخزن والصنف مطلوبان",
        store_id,
        item_id
      });
    }

    // تحويل إلى أرقام - هذا هو الحل الرئيسي
    const storeIdNum = parseInt(store_id);
    const itemIdNum = parseInt(item_id);
    
    if (isNaN(storeIdNum) || isNaN(itemIdNum)) {
      return res.status(400).json({ 
        success: false,
        message: "معرف المخزن والصنف يجب أن يكونا رقماً",
        store_id,
        item_id
      });
    }

    console.log(`📊 تنفيذ استعلام المخزون للمخزن ${storeIdNum} والصنف ${itemIdNum}`);

    // استخدام استعلام أبسط أولاً للتحقق من الأساسيات
    const simpleQuery = `
      SELECT 
        m.item_id,
        m.store_id,
        m.item_qty,
        m.batch_no,
        m.expiry_date,
        m.unit_type,
        m.min_qty,
        m.sale_price1,
        m.sale_price2,
        m.sale_price3,
        m.buy_price,
        m.conversion_factor,
        m.units_per_package,
        COALESCE(i.item_nm, 'غير معروف') as item_nm
      FROM public.a_master m
      LEFT JOIN public.items i ON m.item_id = i.item_id
      WHERE m.store_id = $1 AND m.item_id = $2`;

    console.log('🔍 تنفيذ استعلام مبسط أولاً...');
    const simpleResult = await pool.query(simpleQuery, [storeIdNum, itemIdNum]);

    console.log(`📊 نتيجة الاستعلام المبسط: ${simpleResult.rows.length} صفوف`);

    if (simpleResult.rows.length === 0) {
      console.log(`❌ الصنف ${itemIdNum} غير موجود في المخزن ${storeIdNum}`);
      return res.status(404).json({ 
        success: false,
        message: "⚠️ الصنف غير موجود في المخزن المحدد",
        store_id: storeIdNum,
        item_id: itemIdNum
      });
    }

    const row = simpleResult.rows[0];
    
    // الآن جلب بيانات العروض بشكل منفصل
    let offerData = null;
    let hasActiveOffer = false;
    
    try {
      const offerQuery = `
        SELECT 
          offer_price1,
          offer_price2,
          offer_price3,
          start_date,
          end_date,
          is_active
        FROM public.item_price_offers 
        WHERE item_id = $1 
          AND store_id = $2 
          AND is_active = true
          AND CURRENT_DATE BETWEEN start_date AND COALESCE(end_date, CURRENT_DATE)`;
      
      const offerResult = await pool.query(offerQuery, [itemIdNum, storeIdNum]);
      
      if (offerResult.rows.length > 0) {
        offerData = offerResult.rows[0];
        hasActiveOffer = true;
        console.log(`🎯 وجد عرض نشط للصنف ${itemIdNum}`);
      }
    } catch (offerError) {
      console.log('⚠️ لا توجد عروض أو جدول العروض غير متاح:', offerError.message);
    }

    // حساب الأسعار النهائية
    const final_price1 = hasActiveOffer ? (offerData.offer_price1 || row.sale_price1) : row.sale_price1;
    const final_price2 = hasActiveOffer ? (offerData.offer_price2 || row.sale_price2) : row.sale_price2;
    const final_price3 = hasActiveOffer ? (offerData.offer_price3 || row.sale_price3) : row.sale_price3;

    const responseData = {
      success: true,
      item_id: row.item_id,
      store_id: row.store_id,
      item_qty: row.item_qty,
      batch_no: row.batch_no,
      expiry_date: row.expiry_date,
      unit_type: row.unit_type,
      min_qty: row.min_qty,
      sale_price1: row.sale_price1,
      sale_price2: row.sale_price2,
      sale_price3: row.sale_price3,
      buy_price: row.buy_price,
      conversion_factor: row.conversion_factor,
      units_per_package: row.units_per_package,
      item_nm: row.item_nm,
      // إضافة بيانات العروض
      offer_price1: offerData?.offer_price1 || null,
      offer_price2: offerData?.offer_price2 || null,
      offer_price3: offerData?.offer_price3 || null,
      has_active_offer: hasActiveOffer,
      // الأسعار النهائية بعد تطبيق العروض
      final_price1: final_price1,
      final_price2: final_price2,
      final_price3: final_price3
    };

    console.log(`✅ بيانات المخزون المحملة:`, {
      صنف: responseData.item_id,
      مخزن: responseData.store_id,
      كمية: responseData.item_qty,
      سعر1: responseData.final_price1,
      سعر2: responseData.final_price2,
      سعر3: responseData.final_price3,
      'عرض نشط': responseData.has_active_offer
    });

    res.json(responseData);
    
  } catch (err) {
    console.error("❌ خطأ في استعلام قاعدة البيانات:", err);
    console.error("تفاصيل الخطأ:", err.message);
    
    res.status(500).json({ 
      success: false,
      message: "خطأ في السيرفر أثناء قراءة المخزون",
      error: err.message,
      query: err.query || 'غير معروف'
    });
  }
});

// ======================== 💰 حفظ عملية بيع ========================
router.post("/", async (req, res) => {
  console.log('💰 بدء حفظ عملية بيع - الجسم:', JSON.stringify(req.body, null, 2));
  
  const { 
    tran_date, 
    store_id, 
    customer_id, 
    invoice_id,
    sale_type, 
    price_type, 
    discount, 
    paid_amount, 
    remarks, 
    items 
  } = req.body;

  // تحقق من البيانات الأساسية
  if (!store_id || !invoice_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ 
      success: false,
      error: "المخزن ورقم الفاتورة والأصناف مطلوبة" 
    });
  }

  // تحويل invoice_id إلى integer
  const invoiceIdInt = parseInt(invoice_id);
  if (isNaN(invoiceIdInt)) {
    return res.status(400).json({ 
      success: false,
      error: "رقم الفاتورة غير صحيح" 
    });
  }

  const client = await pool.connect();
  try {
    console.log('🔒 بدء المعاملة...');
    await client.query("BEGIN");

    // 🔧 التصحيح المهم: التحقق من تكرار الفاتورة في نفس اليوم والمخزن فقط
    const checkInvoiceQ = `
      SELECT COUNT(*) as count 
      FROM public.sales 
      WHERE invoice_id = $1 
        AND store_id = $2 
        AND DATE(tran_date) = DATE($3)
    `;
    
    console.log(`🔍 التحقق من تكرار الفاتورة: ${invoiceIdInt}, المخزن: ${store_id}, التاريخ: ${tran_date}`);
    
    const checkResult = await client.query(checkInvoiceQ, [invoiceIdInt, store_id, tran_date]);
    const invoiceCount = parseInt(checkResult.rows[0].count);

    console.log(`📊 عدد الفواتير المكررة: ${invoiceCount}`);

    if (invoiceCount > 0) {
      await client.query("ROLLBACK");
      
      // إذا كانت الفاتورة مكررة، نحصل على الرقم التالي تلقائياً
      const nextInvoiceQ = `
        SELECT COALESCE(MAX(invoice_id), 0) + 1 as next_invoice
        FROM public.sales
        WHERE DATE(tran_date) = DATE($1) AND store_id = $2
      `;
      const nextResult = await client.query(nextInvoiceQ, [tran_date, store_id]);
      const nextInvoice = nextResult.rows[0].next_invoice;
      
      console.log(`🔄 الفاتورة مكررة، الرقم التالي المقترح: ${nextInvoice}`);
      
      return res.status(400).json({ 
        success: false,
        error: `الفاتورة ${invoiceIdInt} مسجلة مسبقاً في تاريخ اليوم`,
        suggested_next_invoice: nextInvoice
      });
    }

    // ... باقي كود حفظ الفاتورة
    let totalInvoice = 0;
    let totalDiscount = 0;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      console.log(`📦 معالجة الصنف ${i + 1}:`, it.item_id, 'الكمية:', it.qty);

      // الحصول على الرقم التسلسلي
      const ser_no_query = await client.query("SELECT nextval('sales_ser_no_seq') AS ser_no");
      const ser_no = ser_no_query.rows[0].ser_no;

      // حساب الإجمالي
      const lineTotal = (it.qty * (it.sale_price || 0)) - (it.discount || 0);
      totalInvoice += lineTotal;
      totalDiscount += (it.discount || 0);

      // إدخال سطر البيع
      const insertQ = `
        INSERT INTO public.sales (
          tran_date, store_id, customer_id, invoice_id, item_id, item_qty, 
          sale_price, total_price, discount, sale_type, price_type, ser_no, 
          unit_type, batch_no, expiry_date, units_per_package
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `;
      
      const values = [
        tran_date || new Date(), 
        store_id, 
        customer_id || null, 
        invoiceIdInt,
        it.item_id,
        it.qty, 
        it.sale_price || 0, 
        lineTotal,
        it.discount || 0, 
        sale_type || "بيع", 
        price_type || "سعر1", 
        ser_no, 
        it.unit || "قطعة", 
        it.batch_no || null, 
        it.expiry_date || null, 
        it.units_per_package || 1
      ];

      await client.query(insertQ, values);
      console.log(`✅ تم إدخال سطر البيع للصنف ${it.item_id}`);

      // تحديث المخزون
      const masterQ = `
        SELECT item_qty, conversion_factor, units_per_package
        FROM public.a_master 
        WHERE store_id = $1 AND item_id = $2 
        FOR UPDATE
      `;
      
      const masterRes = await client.query(masterQ, [store_id, it.item_id]);
      
      if (masterRes.rows.length === 0) {
        throw new Error(`الصنف ${it.item_id} غير موجود في مخزون المخزن ${store_id}`);
      }

      const master = masterRes.rows[0];
      const conv = it.conv || master.conversion_factor || master.units_per_package || 1;
      const actualDeduct = it.base_qty || (it.qty * conv);

      // التحقق من الكمية
      const availableQty = parseFloat(master.item_qty || 0);
      if (availableQty < actualDeduct) {
        throw new Error(`الكمية غير كافية للصنف ${it.item_id}. المتاح: ${availableQty}, المطلوب: ${actualDeduct}`);
      }

      // تحديث المخزون
      const updateQ = `
        UPDATE public.a_master 
        SET item_qty = item_qty - $1, 
            last_out_date = NOW() 
        WHERE store_id = $2 AND item_id = $3
      `;
      
      await client.query(updateQ, [actualDeduct, store_id, it.item_id]);
      console.log(`✅ تم تحديث المخزون للصنف ${it.item_id}`);
    }

    // معالجة الخصم الإجمالي
    const finalDiscount = parseFloat(discount || 0);
    if (finalDiscount > 0) {
      console.log(`💸 إضافة خصم إجمالي: ${finalDiscount}`);
      const discountSerNo = await client.query("SELECT nextval('sales_ser_no_seq') AS ser_no");
      const discountInsertQ = `
        INSERT INTO public.sales (
          tran_date, store_id, customer_id, invoice_id, item_id, item_qty, 
          sale_price, total_price, discount, sale_type, price_type, ser_no, 
          unit_type, remarks
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `;
      
      await client.query(discountInsertQ, [
        tran_date || new Date(), 
        store_id, 
        customer_id || null, 
        invoiceIdInt, 
        'DISCOUNT', 
        1, 
        0, 
        -finalDiscount, 
        finalDiscount, 
        sale_type || "بيع", 
        price_type || "سعر1", 
        discountSerNo.rows[0].ser_no, 
        'خصم', 
        'خصم إجمالي على الفاتورة'
      ]);
      
      totalInvoice -= finalDiscount;
      console.log(`✅ تم إضافة الخصم الإجمالي`);
    }

    await client.query("COMMIT");
    console.log(`✅ تم حفظ الفاتورة ${invoiceIdInt} بنجاح`);
    
    res.json({ 
      success: true,
      message: "✅ تم حفظ الفاتورة وتحديث المخزون بنجاح",
      invoice_id: invoiceIdInt,
      total: totalInvoice,
      discount: totalDiscount + finalDiscount,
      items_count: items.length
    });
    
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ خطأ في حفظ البيع:", err);
    res.status(500).json({ 
      success: false,
      error: err.message || "حدث خطأ في السيرفر أثناء حفظ الفاتورة"
    });
  } finally {
    client.release();
    console.log('🔓 تم تحرير اتصال قاعدة البيانات');
  }
});
// ======================== 🧾 إدخال دفعة مبيعات ========================
router.post("/batch", async (req, res) => {
  const { rows, updateStock = true } = req.body;
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ 
      success: false,
      error: "⚠️ لا توجد بيانات للإدخال" 
    });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const it of rows) {
      const ser_no_query = await client.query("SELECT nextval('sales_ser_no_seq') AS ser_no");
      const ser_no = ser_no_query.rows[0].ser_no;

      const insertQ = `
        INSERT INTO public.sales (
          tran_date, store_id, customer_id, invoice_id, item_id, item_qty, sale_price, total_price,
          discount, sale_type, price_type, ser_no, unit_type, batch_no, expiry_date, units_per_package
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      `;
      const values = [
        it.tran_date || new Date(), it.store_id, it.customer_id || null, it.invoice_id || 0, it.item_id,
        it.item_qty || 0, it.sale_price || 0, it.total_price || 0, it.discount || 0,
        it.sale_type || "بيع", it.price_type || "سعر1", ser_no,
        it.unit_type || "قطعة", it.batch_no || null, it.expiry_date || null, it.units_per_package || 1
      ];
      await client.query(insertQ, values);

      if (updateStock) {
        const masterRes = await client.query(
          "SELECT item_qty, conversion_factor, units_per_package FROM public.a_master WHERE store_id=$1 AND item_id=$2 FOR UPDATE",
          [it.store_id, it.item_id]
        );
        if (masterRes.rows.length) {
          const master = masterRes.rows[0];
          const conv = master.conversion_factor || master.units_per_package || 1;
          const actualDeduct = (it.item_qty || 0) * conv;
          await client.query(
            "UPDATE public.a_master SET item_qty = COALESCE(item_qty,0) - $1 WHERE store_id=$2 AND item_id=$3",
            [actualDeduct, it.store_id, it.item_id]
          );
        }
      }
    }
    await client.query("COMMIT");
    res.json({ 
      success: true,
      message: "✅ تم إدخال الدفعة بنجاح",
      count: rows.length 
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ POST /batch error", err);
    res.status(500).json({ 
      success: false,
      error: err.message || "حدث خطأ في السيرفر أثناء الإدخال" 
    });
  } finally {
    client.release();
  }
});

// ======================== 🗑️ حذف سطر بيع ========================
router.delete("/:key", async (req, res) => {
  const key = req.params.key;
  const parts = key.split("_");
  if (parts.length < 4) return res.status(400).json({ 
    success: false,
    error: "Invalid key" 
  });
  const [store, invoice, item, ser] = parts;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sel = await client.query(
      "SELECT item_qty, unit_type FROM public.sales WHERE store_id=$1 AND invoice_id=$2 AND item_id=$3 AND ser_no=$4 FOR UPDATE",
      [store, invoice, item, ser]
    );
    if (sel.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ 
        success: false,
        error: "لم يتم العثور على السطر" 
      });
    }

    const saleRow = sel.rows[0];
    const masterRes = await client.query(
      "SELECT conversion_factor, units_per_package FROM public.a_master WHERE store_id=$1 AND item_id=$2 FOR UPDATE",
      [store, item]
    );
    const conv = (masterRes.rows[0] && (masterRes.rows[0].conversion_factor || masterRes.rows[0].units_per_package)) || 1;
    const restoreQty = (saleRow.item_qty || 0) * conv;

    await client.query(
      "UPDATE public.a_master SET item_qty = COALESCE(item_qty,0) + $1 WHERE store_id=$2 AND item_id=$3",
      [restoreQty, store, item]
    );
    await client.query(
      "DELETE FROM public.sales WHERE store_id=$1 AND invoice_id=$2 AND item_id=$3 AND ser_no=$4",
      [store, invoice, item, ser]
    );

    await client.query("COMMIT");
    res.json({ 
      success: true,
      message: "🗑️ تم حذف السطر واسترجاع المخزون" 
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ DELETE /:key error", err);
    res.status(500).json({ 
      success: false,
      error: err.message || "حدث خطأ أثناء الحذف" 
    });
  } finally {
    client.release();
  }
});

// ======================== 📊 تقرير المبيعات ========================
router.get("/report", async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      fromStore,
      toStore,
      fromCustomer,
      toCustomer,
      fromItem,
      toItem
    } = req.query;

    let query = `
      SELECT 
        s.tran_date,
        s.invoice_id,
        s.store_id,
        st.store_name,
        s.customer_id,
        c.customer_name,
        s.item_id,
        i.item_nm,
        s.item_qty AS qty,
        s.sale_price,
        s.discount,
        s.total_price AS total
      FROM public.sales s
      LEFT JOIN public.stores st ON s.store_id = st.store_id
      LEFT JOIN public.customers c ON s.customer_id = c.customer_id
      LEFT JOIN public.items i ON s.item_id = i.item_id
      WHERE 1=1
    `;

    const params = [];
    let idx = 1;

    if (fromDate) {
      query += ` AND s.tran_date >= $${idx++}`;
      params.push(fromDate);
    }
    if (toDate) {
      query += ` AND s.tran_date <= $${idx++}`;
      params.push(toDate + " 23:59:59");
    }

    if (fromStore) {
      query += ` AND s.store_id >= $${idx++}`;
      params.push(fromStore);
    }
    if (toStore) {
      query += ` AND s.store_id <= $${idx++}`;
      params.push(toStore);
    }

    if (fromCustomer) {
      query += ` AND s.customer_id >= $${idx++}`;
      params.push(fromCustomer);
    }
    if (toCustomer) {
      query += ` AND s.customer_id <= $${idx++}`;
      params.push(toCustomer);
    }

    if (fromItem) {
      query += ` AND s.item_id >= $${idx++}`;
      params.push(fromItem);
    }
    if (toItem) {
      query += ` AND s.item_id <= $${idx++}`;
      params.push(toItem);
    }

    query += `
      ORDER BY s.tran_date ASC, s.store_id, s.customer_id, s.item_id
    `;

    console.log("📊 تنفيذ استعلام تقرير المبيعات:", query, params);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ خطأ في تقرير المبيعات:", err);
    res.status(500).json({
      success: false,
      error: "حدث خطأ أثناء جلب تقرير المبيعات",
      details: err.message
    });
  }
});

// ======================== 🔧 نقطة تشخيصية للتحقق من الاتصال ========================
router.get("/debug/:store_id/:item_id", async (req, res) => {
  const { store_id, item_id } = req.params;
  
  console.log('🔧 تشغيل وضع التشخيص...');
  
  try {
    // التحقق من اتصال قاعدة البيانات
    const dbCheck = await pool.query('SELECT NOW() as current_time');
    console.log('✅ اتصال قاعدة البيانات نشط:', dbCheck.rows[0]);

    // التحقق من وجود الجداول
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('a_master', 'items', 'item_price_offers')
    `);
    console.log('✅ الجداول المتاحة:', tablesCheck.rows.map(r => r.table_name));

    // التحقق من وجود الصنف في a_master
    const masterCheck = await pool.query(
      'SELECT * FROM a_master WHERE store_id = $1 AND item_id = $2',
      [store_id, item_id]
    );
    console.log('✅ نتيجة البحث في a_master:', masterCheck.rows.length ? 'موجود' : 'غير موجود');

    // التحقق من وجود الصنف في items
    const itemsCheck = await pool.query(
      'SELECT * FROM items WHERE item_id = $1',
      [item_id]
    );
    console.log('✅ نتيجة البحث في items:', itemsCheck.rows.length ? 'موجود' : 'غير موجود');

    // التحقق من العروض
    const offersCheck = await pool.query(
      `SELECT * FROM item_price_offers 
       WHERE item_id = $1 AND store_id = $2 AND is_active = true
       AND CURRENT_DATE BETWEEN start_date AND COALESCE(end_date, CURRENT_DATE)`,
      [item_id, store_id]
    );
    console.log('✅ العروض النشطة:', offersCheck.rows.length);

    res.json({
      success: true,
      diagnostics: {
        database_connection: 'ok',
        tables: tablesCheck.rows.map(r => r.table_name),
        in_master: masterCheck.rows.length > 0,
        in_items: itemsCheck.rows.length > 0,
        active_offers: offersCheck.rows.length,
        master_data: masterCheck.rows[0] || null,
        item_data: itemsCheck.rows[0] || null,
        offer_data: offersCheck.rows[0] || null
      }
    });

  } catch (err) {
    console.error('❌ خطأ في التشخيص:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack
    });
  }
});

export default router;