// searchbk.js - Backend for Inventory Search
import express from 'express';
import db from '../db.js';

const router = express.Router();

// 🔍 البحث في المخزون
router.get("/inventory", async (req, res) => {
  try {
    const { q, store_id, supplierid } = req.query;

    console.log('🔍 بحث في المخزون:', { q, store_id, supplierid });

    let query = `
      SELECT 
        am.tran_date,
        am.store_id,
        am.supplierid,
        am.item_id,
        i.item_nm as item_nm,  -- استخدام اسم الصنف من جدول items
        am.item_qty,
        am.unit_type,
        am.units_per_package,
        am.last_in_date,
        am.discount_type,
        am.discount_value,
        am.expiry_date,
        s.store_name,          -- اسم المخزن من جدول stores
        i.item_nm as item_name,
        sup.supplier_name      -- اسم المورد من جدول suppliers
      FROM a_master am
      LEFT JOIN stores s ON am.store_id = s.store_id
      LEFT JOIN items i ON am.item_id = i.item_id
      LEFT JOIN suppliers sup ON am.supplierid = sup.supplierid
      WHERE am.item_qty > 0
    `;

    let params = [];
    let paramCount = 0;

    // إضافة شروط البحث
    if (q) {
      paramCount++;
      query += ` AND (am.item_id::text LIKE $${paramCount} OR i.item_nm ILIKE $${paramCount})`;
      params.push(`%${q}%`);
    }

    if (store_id) {
      paramCount++;
      query += ` AND am.store_id = $${paramCount}`;
      params.push(store_id);
    }

    if (supplierid) {
      paramCount++;
      query += ` AND am.supplierid = $${paramCount}`;
      params.push(supplierid);
    }

    // الترتيب حسب كود المخزن ثم كود الصنف
    query += ` ORDER BY am.store_id, am.item_id`;

    console.log('📊 استعلام البحث:', query);
    console.log('🔢 معاملات البحث:', params);

    const result = await db.query(query, params);
    
    console.log(`✅ تم العثور على ${result.rows.length} نتيجة`);

    res.json({
      success: true,
      items: result.rows,
      total_count: result.rows.length,
      search_criteria: {
        query: q,
        store_id: store_id,
        supplierid: supplierid
      }
    });

  } catch (error) {
    console.error('❌ خطأ في البحث في المخزون:', error);
    console.error('تفاصيل الخطأ:', error.message);
    console.error('كود الخطأ:', error.code);
    
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في البحث في المخزون',
      error: error.message,
      code: error.code
    });
  }
});

// 🔍 جلب الموردين
router.get("/suppliers", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT supplierid, supplier_name 
      FROM suppliers 
      ORDER BY supplier_name
    `);
    
    res.json({
      success: true,
      suppliers: result.rows
    });
  } catch (error) {
    console.error('❌ خطأ في جلب الموردين:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في جلب الموردين',
      error: error.message 
    });
  }
});

// 🧪 نقطة نهاية للتجربة
router.get("/test", async (req, res) => {
  try {
    // اختبار الاتصال بالجداول المرتبطة
    const storesCount = await db.query('SELECT COUNT(*) FROM stores');
    const itemsCount = await db.query('SELECT COUNT(*) FROM items');
    const suppliersCount = await db.query('SELECT COUNT(*) FROM suppliers');
    
    res.json({
      success: true,
      message: '✅ نظام البحث في المخزون يعمل بنجاح!',
      database: 'متصل',
      tables: {
        stores: parseInt(storesCount.rows[0].count),
        items: parseInt(itemsCount.rows[0].count),
        suppliers: parseInt(suppliersCount.rows[0].count)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '❌ خطأ في الاتصال بقاعدة البيانات',
      error: error.message
    });
  }
});

export default router;