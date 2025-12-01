import express from "express";
import pool from "../db.js";

const router = express.Router();

// 📋 تقرير جرد المخزون الحالي
router.get("/inventory/inventory", async (req, res) => {
    try {
        const {
            store,
            fromItem,
            toItem,
            unitType,
            stockStatus,
            sortBy = 'item_qty',
            pageSize = '50'
        } = req.query;

        console.log('🔍 معالجة طلب جرد المخزون:', req.query);

        // بناء الاستعلام الديناميكي
        let query = `
            SELECT 
                m.store_id,
                m.item_id,
                COALESCE(i.item_nm, m.item_nm, 'غير معروف') as item_nm,
                m.item_qty,
                m.unit_type,
                m.buy_price,
                m.total_price,
                m.sale_price1,
                m.sale_price2,
                m.sale_price3,
                m.min_qty,
                m.batch_no,
                m.expiry_date,
                m.remarks,
                s.store_name,
                (SELECT MAX(tran_date) FROM a_master WHERE store_id = m.store_id AND item_id = m.item_id) as last_transaction
            FROM a_master m
            LEFT JOIN items i ON m.item_id = i.item_id
            LEFT JOIN stores s ON m.store_id = s.store_id
            WHERE m.item_qty IS NOT NULL
        `;

        const params = [];
        let paramCount = 0;

        // فلترة حسب المخزن
        if (store) {
            paramCount++;
            query += ` AND m.store_id = $${paramCount}`;
            params.push(store);
        }

        // فلترة حسب نطاق الأصناف
        if (fromItem) {
            paramCount++;
            query += ` AND m.item_id >= $${paramCount}`;
            params.push(fromItem);
        }

        if (toItem) {
            paramCount++;
            query += ` AND m.item_id <= $${paramCount}`;
            params.push(toItem);
        }

        // فلترة حسب نوع الوحدة
        if (unitType) {
            paramCount++;
            query += ` AND m.unit_type = $${paramCount}`;
            params.push(unitType);
        }

        // فلترة حسب حالة المخزون
        if (stockStatus) {
            switch (stockStatus) {
                case 'good':
                    query += ` AND m.item_qty > m.min_qty * 2`;
                    break;
                case 'low':
                    query += ` AND m.item_qty <= m.min_qty AND m.item_qty > 0`;
                    break;
                case 'zero':
                    query += ` AND m.item_qty = 0`;
                    break;
            }
        }

        // الترتيب
        const sortMapping = {
            'item_qty': 'm.item_qty ASC',
            'item_qty_desc': 'm.item_qty DESC',
            'item_id': 'm.item_id ASC',
            'item_nm': 'm.item_nm ASC',
            'total_price': 'm.total_price DESC',
            'store_id': 'm.store_id ASC'
        };

        query += ` ORDER BY ${sortMapping[sortBy] || 'm.item_qty ASC'}`;

        // تحديد عدد السجلات
        if (pageSize && pageSize !== 'all') {
            const limit = parseInt(pageSize);
            query += ` LIMIT ${limit}`;
        }

        console.log('🔍 تنفيذ استعلام الجرد:', query);
        console.log('📊 معاملات الاستعلام:', params);

        const result = await pool.query(query, params);
        
        console.log(`✅ تم جلب ${result.rows.length} سجل لتقرير الجرد`);

        res.json(result.rows);

    } catch (err) {
        console.error('❌ خطأ في تقرير الجرد:', err);
        res.status(500).json({ 
            error: "⚠️ حدث خطأ أثناء إنشاء تقرير الجرد",
            details: err.message 
        });
    }
});

// 📢 تقرير المخزون المنخفض
router.get("/inventory/low-stock", async (req, res) => {
    try {
        const {
            store,
            fromItem,
            toItem,
            sortBy = 'item_qty'
        } = req.query;

        let query = `
            SELECT 
                m.store_id,
                m.item_id,
                COALESCE(i.item_nm, m.item_nm, 'غير معروف') as item_nm,
                m.item_qty,
                m.unit_type,
                m.buy_price,
                m.total_price,
                m.sale_price1,
                m.sale_price2,
                m.sale_price3,
                m.min_qty,
                m.batch_no,
                m.expiry_date,
                m.remarks,
                s.store_name,
                (m.min_qty - m.item_qty) as required_qty,
                (SELECT MAX(tran_date) FROM a_master WHERE store_id = m.store_id AND item_id = m.item_id) as last_transaction
            FROM a_master m
            LEFT JOIN items i ON m.item_id = i.item_id
            LEFT JOIN stores s ON m.store_id = s.store_id
            WHERE m.item_qty <= m.min_qty 
            AND m.item_qty > 0
            AND m.min_qty > 0
        `;

        const params = [];
        let paramCount = 0;

        if (store) {
            paramCount++;
            query += ` AND m.store_id = $${paramCount}`;
            params.push(store);
        }

        if (fromItem) {
            paramCount++;
            query += ` AND m.item_id >= $${paramCount}`;
            params.push(fromItem);
        }

        if (toItem) {
            paramCount++;
            query += ` AND m.item_id <= $${paramCount}`;
            params.push(toItem);
        }

        // الترتيب حسب الأولوية (الأكثر انخفاضاً أولاً)
        query += ` ORDER BY (m.min_qty - m.item_qty) DESC, m.store_id, m.item_id`;

        const result = await pool.query(query, params);
        
        console.log(`✅ تم جلب ${result.rows.length} صنف منخفض المخزون`);
        res.json(result.rows);

    } catch (err) {
        console.error('❌ خطأ في تقرير المخزون المنخفض:', err);
        res.status(500).json({ error: "⚠️ حدث خطأ أثناء جلب المخزون المنخفض" });
    }
});

// ⭕ تقرير المخزون الصفري
router.get("/inventory/zero-stock", async (req, res) => {
    try {
        const {
            store,
            fromItem,
            toItem
        } = req.query;

        let query = `
            SELECT 
                m.store_id,
                m.item_id,
                COALESCE(i.item_nm, m.item_nm, 'غير معروف') as item_nm,
                m.item_qty,
                m.unit_type,
                m.buy_price,
                m.total_price,
                m.sale_price1,
                m.sale_price2,
                m.sale_price3,
                m.min_qty,
                m.batch_no,
                m.expiry_date,
                m.remarks,
                s.store_name,
                (SELECT MAX(tran_date) FROM a_master WHERE store_id = m.store_id AND item_id = m.item_id) as last_transaction
            FROM a_master m
            LEFT JOIN items i ON m.item_id = i.item_id
            LEFT JOIN stores s ON m.store_id = s.store_id
            WHERE m.item_qty = 0
        `;

        const params = [];
        let paramCount = 0;

        if (store) {
            paramCount++;
            query += ` AND m.store_id = $${paramCount}`;
            params.push(store);
        }

        if (fromItem) {
            paramCount++;
            query += ` AND m.item_id >= $${paramCount}`;
            params.push(fromItem);
        }

        if (toItem) {
            paramCount++;
            query += ` AND m.item_id <= $${paramCount}`;
            params.push(toItem);
        }

        query += ` ORDER BY m.store_id, m.item_id`;

        const result = await pool.query(query, params);
        
        console.log(`✅ تم جلب ${result.rows.length} صنف مخزون صفري`);
        res.json(result.rows);

    } catch (err) {
        console.error('❌ خطأ في تقرير المخزون الصفري:', err);
        res.status(500).json({ error: "⚠️ حدث خطأ أثناء جلب المخزون الصفري" });
    }
});

// 📅 تقرير الأصناف المنتهية الصلاحية
router.get("/inventory/expired", async (req, res) => {
    try {
        const {
            store,
            fromItem,
            toItem
        } = req.query;

        let query = `
            SELECT 
                m.store_id,
                m.item_id,
                COALESCE(i.item_nm, m.item_nm, 'غير معروف') as item_nm,
                m.item_qty,
                m.unit_type,
                m.buy_price,
                m.total_price,
                m.sale_price1,
                m.sale_price2,
                m.sale_price3,
                m.min_qty,
                m.batch_no,
                m.expiry_date,
                m.remarks,
                s.store_name,
                (SELECT MAX(tran_date) FROM a_master WHERE store_id = m.store_id AND item_id = m.item_id) as last_transaction,
                (m.expiry_date - CURRENT_DATE) as days_until_expiry
            FROM a_master m
            LEFT JOIN items i ON m.item_id = i.item_id
            LEFT JOIN stores s ON m.store_id = s.store_id
            WHERE m.expiry_date IS NOT NULL 
            AND m.expiry_date < CURRENT_DATE
        `;

        const params = [];
        let paramCount = 0;

        if (store) {
            paramCount++;
            query += ` AND m.store_id = $${paramCount}`;
            params.push(store);
        }

        if (fromItem) {
            paramCount++;
            query += ` AND m.item_id >= $${paramCount}`;
            params.push(fromItem);
        }

        if (toItem) {
            paramCount++;
            query += ` AND m.item_id <= $${paramCount}`;
            params.push(toItem);
        }

        query += ` ORDER BY m.expiry_date ASC, m.store_id, m.item_id`;

        const result = await pool.query(query, params);
        
        console.log(`✅ تم جلب ${result.rows.length} صنف منتهي الصلاحية`);
        res.json(result.rows);

    } catch (err) {
        console.error('❌ خطأ في تقرير المنتهية الصلاحية:', err);
        res.status(500).json({ error: "⚠️ حدث خطأ أثناء جلب الأصناف المنتهية" });
    }
});

// 📊 إحصائيات المخزون
router.get("/inventory/summary", async (req, res) => {
    try {
        const { store } = req.query;

        let query = `
            SELECT 
                COUNT(*) as total_items,
                SUM(item_qty) as total_quantities,
                SUM(total_price) as total_value,
                COUNT(CASE WHEN item_qty = 0 THEN 1 END) as zero_stock_items,
                COUNT(CASE WHEN item_qty <= min_qty AND item_qty > 0 AND min_qty > 0 THEN 1 END) as low_stock_items,
                COUNT(CASE WHEN expiry_date < CURRENT_DATE THEN 1 END) as expired_items,
                AVG(buy_price) as avg_buy_price
            FROM a_master
            WHERE item_qty IS NOT NULL
        `;

        const params = [];
        
        if (store) {
            query += ` AND store_id = $1`;
            params.push(store);
        }

        const result = await pool.query(query, params);
        
        res.json(result.rows[0] || {});

    } catch (err) {
        console.error('❌ خطأ في إحصائيات المخزون:', err);
        res.status(500).json({ error: "⚠️ حدث خطأ أثناء جلب الإحصائيات" });
    }
});

export default router;