// 📁 routes/salesreturn_repbk.js
import express from "express";
import pool from "../db.js";
import { Parser } from "json2csv";

const router = express.Router();

// 📊 تقرير مرتجع المبيعات
router.get("/", async (req, res) => {
    try {
        const {
            fromDate,
            toDate,
            storeFrom,
            storeTo,
            customer,
            item
        } = req.query;

        let query = `
            SELECT 
                sr.tran_date,
                sr.store_id,
                s.store_name,
                sr.customer_id,
                c.customer_name,
                sr.invoice_id,
                sr.item_id,
                i.item_nm as item_name,
                sr.item_qty,
                sr.sale_price,
                sr.discount,
                sr.total_price,
                sr.return_reason,
                sr.user_id,
                u.username as user_name,
                sr.batch_no,
                sr.expiry_date,
                sr.original_invoice,
                sr.remarks
            FROM sales_return sr
            LEFT JOIN stores s ON sr.store_id = s.store_id
            LEFT JOIN customers c ON sr.customer_id = c.customer_id
            LEFT JOIN items i ON sr.item_id = i.item_id
            LEFT JOIN users u ON sr.user_id = u.user_id
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 0;

        // فلترة حسب التاريخ
        if (fromDate) {
            paramCount++;
            query += ` AND sr.tran_date >= $${paramCount}`;
            params.push(fromDate);
        }

        if (toDate) {
            paramCount++;
            query += ` AND sr.tran_date <= $${paramCount}`;
            params.push(toDate + ' 23:59:59');
        }

        // فلترة حسب المخزن
        if (storeFrom) {
            paramCount++;
            query += ` AND sr.store_id >= $${paramCount}`;
            params.push(parseInt(storeFrom));
        }

        if (storeTo) {
            paramCount++;
            query += ` AND sr.store_id <= $${paramCount}`;
            params.push(parseInt(storeTo));
        }

        // فلترة حسب العميل
        if (customer) {
            paramCount++;
            query += ` AND sr.customer_id = $${paramCount}`;
            params.push(parseInt(customer));
        }

        // فلترة حسب الصنف
        if (item) {
            paramCount++;
            query += ` AND sr.item_id = $${paramCount}`;
            params.push(item);
        }

        query += " ORDER BY sr.tran_date DESC, sr.store_id, sr.invoice_id";

        const result = await pool.query(query, params);
        res.json(result.rows);

    } catch (err) {
        console.error("❌ خطأ في جلب تقرير مرتجع المبيعات:", err.message);
        res.status(500).json({ error: "⚠️ حدث خطأ في جلب التقرير" });
    }
});

// 📤 تصدير التقرير
router.get("/export", async (req, res) => {
    try {
        const {
            fromDate,
            toDate,
            storeFrom,
            storeTo,
            customer,
            item
        } = req.query;

        let query = `
            SELECT 
                sr.tran_date,
                s.store_name,
                c.customer_name,
                sr.invoice_id,
                sr.item_id,
                i.item_nm as item_name,
                sr.item_qty,
                sr.sale_price,
                sr.discount,
                sr.total_price,
                sr.return_reason,
                u.username as user_name,
                sr.batch_no,
                sr.expiry_date
            FROM sales_return sr
            LEFT JOIN stores s ON sr.store_id = s.store_id
            LEFT JOIN customers c ON sr.customer_id = c.customer_id
            LEFT JOIN items i ON sr.item_id = i.item_id
            LEFT JOIN users u ON sr.user_id = u.user_id
            WHERE 1=1
        `;

        const params = [];
        let paramCount = 0;

        if (fromDate) {
            paramCount++;
            query += ` AND sr.tran_date >= $${paramCount}`;
            params.push(fromDate);
        }

        if (toDate) {
            paramCount++;
            query += ` AND sr.tran_date <= $${paramCount}`;
            params.push(toDate + ' 23:59:59');
        }

        if (storeFrom) {
            paramCount++;
            query += ` AND sr.store_id >= $${paramCount}`;
            params.push(parseInt(storeFrom));
        }

        if (storeTo) {
            paramCount++;
            query += ` AND sr.store_id <= $${paramCount}`;
            params.push(parseInt(storeTo));
        }

        if (customer) {
            paramCount++;
            query += ` AND sr.customer_id = $${paramCount}`;
            params.push(parseInt(customer));
        }

        if (item) {
            paramCount++;
            query += ` AND sr.item_id = $${paramCount}`;
            params.push(item);
        }

        query += " ORDER BY sr.tran_date DESC";

        const result = await pool.query(query, params);

        const fields = [
            { label: 'التاريخ', value: 'tran_date' },
            { label: 'المخزن', value: 'store_name' },
            { label: 'العميل', value: 'customer_name' },
            { label: 'رقم الفاتورة', value: 'invoice_id' },
            { label: 'كود الصنف', value: 'item_id' },
            { label: 'اسم الصنف', value: 'item_name' },
            { label: 'الكمية', value: 'item_qty' },
            { label: 'سعر البيع', value: 'sale_price' },
            { label: 'الخصم', value: 'discount' },
            { label: 'الإجمالي', value: 'total_price' },
            { label: 'سبب الإرجاع', value: 'return_reason' },
            { label: 'المستخدم', value: 'user_name' },
            { label: 'الدفعة', value: 'batch_no' },
            { label: 'تاريخ الصلاحية', value: 'expiry_date' }
        ];

        const json2csv = new Parser({ fields, withBOM: true });
        const csv = json2csv.parse(result.rows);

        res.header("Content-Type", "text/csv; charset=utf-8");
        res.attachment("sales_return_report.csv");
        res.send(csv);

    } catch (err) {
        console.error("❌ خطأ في تصدير التقرير:", err.message);
        res.status(500).json({ error: "⚠️ حدث خطأ في تصدير التقرير" });
    }
});

export default router;