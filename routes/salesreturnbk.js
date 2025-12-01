// salesreturnbk.js - نظام مرتجع المبيعات المعدل لـ a_master
import express from 'express';
import db from '../db.js';

const router = express.Router();

// 🔍 جلب تفاصيل فاتورة المبيعات للمرتجع
router.get("/invoice/:invoice_id", async (req, res) => {
  const { invoice_id } = req.params;
  const { tran_date } = req.query;

  try {
    const invoiceIdInt = parseInt(invoice_id);
    if (isNaN(invoiceIdInt)) {
      return res.status(400).json({ 
        success: false, 
        message: 'رقم الفاتورة غير صحيح' 
      });
    }

    console.log('🔍 جلب تفاصيل الفاتورة للمرتجع:', { invoice_id: invoiceIdInt, tran_date });

    let query = `
      SELECT 
        s.tran_date,
        s.store_id,
        s.invoice_id,
        s.item_id,
        s.item_qty,
        s.sale_price,
        s.total_price,
        s.discount,
        s.sale_type,
        s.price_type,
        s.unit_type,
        s.batch_no,
        s.expiry_date,
        s.units_per_package,
        s.base_qty,
        s.conversion_factor,
        s.remarks,
        i.item_nm,
        st.store_name,
        st.store_id
      FROM public.sales s 
      JOIN public.items i ON s.item_id = i.item_id 
      LEFT JOIN public.stores st ON s.store_id = st.store_id
      WHERE s.invoice_id = $1
    `;

    let params = [invoiceIdInt];

    if (tran_date) {
      query += ` AND DATE(s.tran_date) = DATE($2)`;
      params.push(tran_date);
    }

    query += ` ORDER BY s.ser_no`;

    const result = await db.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'لم يتم العثور على الفاتورة' 
      });
    }

    res.json({
      success: true,
      invoice_id: invoiceIdInt,
      store_id: result.rows[0].store_id,
      store_name: result.rows[0].store_name,
      tran_date: result.rows[0].tran_date,
      items: result.rows,
      total_items: result.rows.length
    });

  } catch (err) {
    console.error("❌ خطأ في جلب تفاصيل الفاتورة للمرتجع:", err);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في الخادم أثناء جلب تفاصيل الفاتورة',
      error: err.message 
    });
  }
});

// 🔍 البحث عن أصناف المخزن للمرتجع بدون فاتورة
router.get("/store-items/:storeId", async (req, res) => {
  try {
    const { storeId } = req.params;
    const { q } = req.query;

    console.log('🔍 بحث عن أصناف المخزن للمرتجع:', { storeId, q });

    let query = `
      SELECT 
        item_id,
        item_qty,
        store_id,
        item_nm,
        sale_price1,
        sale_price2,
        sale_price3,
        unit_type,
        batch_no,
        expiry_date
      FROM a_master 
      WHERE store_id = $1 
      AND item_qty > 0
    `;
    
    let params = [storeId];

    if (q) {
      query += ` AND (item_id::TEXT LIKE $2 OR item_nm ILIKE $2)`;
      params.push(`%${q}%`);
    }

    query += ` ORDER BY item_nm LIMIT 20`;

    const result = await db.query(query, params);
    
    res.json({ 
      success: true, 
      items: result.rows 
    });

  } catch (error) {
    console.error('❌ خطأ في البحث عن الأصناف للمرتجع:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في البحث عن الأصناف',
      error: error.message 
    });
  }
});

// 💰 جلب آخر سعر بيع للصنف
router.get("/last-price/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;

    const result = await db.query(`
      SELECT sale_price 
      FROM sales 
      WHERE item_id = $1 
      ORDER BY tran_date DESC, ser_no DESC 
      LIMIT 1
    `, [itemId]);

    res.json({
      success: true,
      last_price: result.rows[0]?.sale_price || 0
    });
  } catch (error) {
    console.error('❌ خطأ في جلب آخر سعر:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في جلب آخر سعر',
      error: error.message 
    });
  }
});

// ✅ معالجة مرتجع المبيعات - الإصدار المعدل
router.post("/process-return", async (req, res) => {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      return_date,
      store_id,
      original_invoice,
      return_mode,
      return_lines,
      user_id,
      total_amount
    } = req.body;

    console.log('🔄 معالجة مرتجع:', { 
      store_id, 
      original_invoice, 
      return_mode,
      items_count: return_lines.length 
    });

    // التحقق من وجود الأصناف في a_master
    for (const line of return_lines) {
      const itemCheck = await client.query(
        `SELECT item_id FROM a_master WHERE store_id = $1 AND item_id = $2`,
        [store_id, line.item_id]
      );

      if (itemCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({
          success: false,
          message: `الصنف ${line.item_id} غير موجود في المخزن ${store_id}`
        });
      }
    }

    // إنشاء رقم مرتجع جديد
    const returnIdResult = await client.query(`
      SELECT COALESCE(MAX(invoice_id), 0) + 1 as next_return_id 
      FROM sales_return 
      WHERE store_id = $1
    `, [store_id]);

    const return_id = returnIdResult.rows[0].next_return_id;

    // إدخال الأصناف المرتجعة في sales_return
    for (const line of return_lines) {
      await client.query(`
        INSERT INTO sales_return (
          tran_date, store_id, invoice_id, item_id, item_qty,
          sale_price, total_price, user_id, discount, sale_type,
          price_type, unit_type, batch_no, expiry_date, units_per_package,
          return_reason, remarks, original_invoice
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `, [
        return_date, store_id, return_id, line.item_id, line.return_qty,
        line.return_price, line.return_total, user_id || 1, 0, 'مرتجع',
        'سعر1', line.unit_type || 'قطعة', line.batch_no, line.expiry_date, 1,
        line.return_reason, line.remarks || '', original_invoice
      ]);

      // تحديث رصيد المخزن في a_master
      const updateResult = await client.query(`
        UPDATE a_master 
        SET item_qty = item_qty + $1,
            tran_date = $2,
            user_id = $3
        WHERE store_id = $4 AND item_id = $5
      `, [line.return_qty, return_date, user_id || 1, store_id, line.item_id]);

      if (updateResult.rowCount === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({
          success: false,
          message: `فشل في تحديث مخزون الصنف ${line.item_id}`
        });
      }

      console.log(`✅ تم تحديث رصيد المخزن للصنف ${line.item_id}: +${line.return_qty}`);
    }

    await client.query('COMMIT');
    client.release();

    console.log('✅ تم معالجة المرتجع بنجاح:', return_id);

    res.json({
      success: true,
      return_id: return_id,
      message: 'تم معالجة المرتجع بنجاح',
      total_refund: total_amount,
      store_id: store_id
    });

  } catch (error) {
    console.error('❌ خطأ في معالجة المرتجع:', error);
    
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في معالجة المرتجع',
      error: error.message
    });
  }
});

// 📊 جلب تقارير المرتجعات
router.get("/reports", async (req, res) => {
  try {
    const { start_date, end_date, store_id } = req.query;

    let query = `
      SELECT 
        sr.*, 
        i.item_nm, 
        s.store_name,
        u.username
      FROM sales_return sr 
      JOIN items i ON sr.item_id = i.item_id 
      JOIN stores s ON sr.store_id = s.store_id
      LEFT JOIN users u ON sr.user_id = u.user_id
      WHERE DATE(sr.tran_date) BETWEEN $1 AND $2
    `;
    
    let params = [start_date, end_date];

    if (store_id) {
      query += ` AND sr.store_id = $3`;
      params.push(store_id);
    }

    query += ` ORDER BY sr.tran_date DESC, sr.invoice_id DESC`;

    const result = await db.query(query, params);
    
    res.json({
      success: true,
      returns: result.rows,
      total_count: result.rows.length
    });

  } catch (error) {
    console.error('❌ خطأ في جلب تقرير المرتجعات:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في جلب تقرير المرتجعات',
      error: error.message 
    });
  }
});

// 🔍 جلب المخازن
router.get("/stores", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT store_id, store_name 
      FROM stores 
      ORDER BY store_name
    `);
    
    res.json({
      success: true,
      stores: result.rows
    });
  } catch (error) {
    console.error('❌ خطأ في جلب المخازن:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في جلب المخازن',
      error: error.message 
    });
  }
});

export default router;