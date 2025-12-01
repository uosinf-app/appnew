import express from "express";
import pool from "../db.js";

const router = express.Router();

// 📊 تقرير حركة المخزون مع الفلاتر
router.get("/report", async (req, res) => {
    try {
        const {
            fromDate,
            toDate,
            fromStore,
            toStore,
            fromSupplier,
            toSupplier,
            fromItem,
            toItem,
            tranType,
            sortBy = 'tran_date'
        } = req.query;

        console.log('🔍 معالجة طلب تقرير الفروع:', req.query);

        // بناء الاستعلام الديناميكي
        let query = `
            SELECT 
                m.tran_date,
                m.store_id,
                m.supplierid,
                m.item_id,
                COALESCE(i.item_nm, m.item_nm, 'غير معروف') as item_nm,
                m.item_qty,
                m.unit_type,
                m.buy_price,
                m.total_price,
                m.sale_price1,
                m.sale_price2,
                m.sale_price3,
                m.tran_type,
                m.batch_no,
                m.expiry_date,
                m.min_qty,
                m.remarks,
                s.store_name,
                sup.supplier_name
            FROM a_master m
            LEFT JOIN items i ON m.item_id = i.item_id
            LEFT JOIN stores s ON m.store_id = s.store_id
            LEFT JOIN suppliers sup ON m.supplierid = sup.supplierid
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 0;

        // فلترة حسب التاريخ
        if (fromDate) {
            paramCount++;
            query += ` AND DATE(m.tran_date) >= $${paramCount}`;
            params.push(fromDate);
        }

        if (toDate) {
            paramCount++;
            query += ` AND DATE(m.tran_date) <= $${paramCount}`;
            params.push(toDate);
        }

        // فلترة حسب المخزن
        if (fromStore) {
            paramCount++;
            query += ` AND m.store_id = $${paramCount}`;
            params.push(fromStore);
        }

        if (toStore && toStore !== fromStore) {
            paramCount++;
            query += ` AND m.store_id = $${paramCount}`;
            params.push(toStore);
        }

        // فلترة حسب المورد
        if (fromSupplier) {
            paramCount++;
            query += ` AND m.supplierid = $${paramCount}`;
            params.push(fromSupplier);
        }

        if (toSupplier && toSupplier !== fromSupplier) {
            paramCount++;
            query += ` AND m.supplierid = $${paramCount}`;
            params.push(toSupplier);
        }

        // فلترة حسب الصنف
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

        // فلترة حسب نوع الحركة
        if (tranType) {
            paramCount++;
            query += ` AND m.tran_type = $${paramCount}`;
            params.push(tranType);
        }

        // الترتيب
        const validSortFields = ['tran_date', 'store_id', 'item_id', 'item_qty', 'buy_price', 'total_price'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'tran_date';
        
        query += ` ORDER BY m.${sortField} DESC, m.store_id, m.item_id`;

        console.log('🔍 تنفيذ استعلام التقرير:', query);
        console.log('📊 معاملات الاستعلام:', params);

        const result = await pool.query(query, params);
        
        console.log(`✅ تم جلب ${result.rows.length} سجل للتقرير`);

        // معالجة التواريخ قبل الإرجاع
        const processedData = result.rows.map(row => {
            if (row.tran_date) {
                row.tran_date = formatDateForDisplay(row.tran_date);
            }
            if (row.expiry_date) {
                row.expiry_date = formatDateForDisplay(row.expiry_date);
            }
            return row;
        });

        res.json(processedData);

    } catch (err) {
        console.error('❌ خطأ في تقرير الفروع:', err);
        res.status(500).json({ 
            error: "⚠️ حدث خطأ أثناء إنشاء التقرير",
            details: err.message 
        });
    }
});

// 📈 إحصائيات الفروع
router.get("/summary", async (req, res) => {
    try {
        const { store_id, fromDate, toDate } = req.query;

        let query = `
            SELECT 
                COUNT(*) as total_transactions,
                SUM(item_qty) as total_quantities,
                SUM(total_price) as total_value,
                COUNT(DISTINCT item_id) as unique_items,
                AVG(buy_price) as avg_buy_price,
                AVG(sale_price1) as avg_sale_price
            FROM a_master
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 0;

        if (store_id) {
            paramCount++;
            query += ` AND store_id = $${paramCount}`;
            params.push(store_id);
        }

        if (fromDate) {
            paramCount++;
            query += ` AND tran_date >= $${paramCount}`;
            params.push(fromDate);
        }

        if (toDate) {
            paramCount++;
            query += ` AND tran_date <= $${paramCount}`;
            params.push(toDate);
        }

        const result = await pool.query(query, params);
        
        res.json(result.rows[0] || {});

    } catch (err) {
        console.error('❌ خطأ في إحصائيات الفروع:', err);
        res.status(500).json({ error: "⚠️ حدث خطأ أثناء جلب الإحصائيات" });
    }
});

// دالة مساعدة لتحويل تنسيق التاريخ
function formatDateForDisplay(dateString) {
    if (!dateString) return '';
    
    try {
        // إذا كان التاريخ بالفعل بصيغة yyyy-mm-dd
        if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return dateString;
        }
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    } catch (err) {
        console.error("❌ خطأ في تحويل التاريخ:", err);
        return dateString;
    }
}

export default router;