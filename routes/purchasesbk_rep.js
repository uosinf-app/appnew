// routes/purchasesbk_rep.js
import express from 'express';
import pool from '../db.js';

const router = express.Router();

// -----------------
// تقرير المشتريات
// -----------------
router.get('/', async (req, res) => {
    try {
        console.log('🔍 Fetching purchases report...');

        const purchasesQuery = `
            SELECT 
                p.invoice_id,
                p.tran_date,
                p.store_id,
                p.supplierid,
                p.payment_method,
                p.user_id,
                p.due_date,
                p.credit_period,
                p.payment_terms,
                p.check_number,
                p.bank_name,
                p.check_date,
                p.check_holder,
                p.check_branch,
                p.item_id,
                p.item_qty,
                p.buy_price,
                p.total_price,
                p.discount,
                p.total_net_buy_price,
                p.unit,
                p.sale_price1,
                s.store_name,
                sup.supplier_name,
                u.username as user_name
            FROM purchases p
            LEFT JOIN stores s ON p.store_id = s.store_id
            LEFT JOIN suppliers sup ON p.supplierid = sup.supplierid
            LEFT JOIN users u ON p.user_id = u.user_id
            ORDER BY p.tran_date DESC
            LIMIT 100
        `;

        const purchasesResult = await pool.query(purchasesQuery);
        console.log(`📊 Found ${purchasesResult.rows.length} purchases`);

        const purchasesWithItems = await Promise.all(
            purchasesResult.rows.map(async (purchase) => {
                let itemName = 'غير معروف';
                if (purchase.item_id) {
                    try {
                        const nameResult = await pool.query(
                            'SELECT item_nm FROM items WHERE item_id = $1',
                            [purchase.item_id]
                        );
                        if (nameResult.rows[0]) itemName = nameResult.rows[0].item_nm;
                    } catch (err) {
                        console.error(`Error fetching name for item_id ${purchase.item_id}:`, err);
                    }
                }

                const item = {
                    item_id: purchase.item_id,
                    item_nm: itemName,
                    item_qty: Number(purchase.item_qty) || 0,
                    buy_price: Number(purchase.buy_price) || 0,
                    total_price: Number(purchase.total_price) || 0,
                    discount: Number(purchase.discount) || 0,
                    total_net_buy_price: Number(purchase.total_net_buy_price) || 0,
                    unit: purchase.unit,
                    sale_price1: Number(purchase.sale_price1) || 0
                };

                return {
                    ...purchase,
                    items: [item]
                };
            })
        );

        console.log('✅ Successfully fetched purchases with items');
        res.json(purchasesWithItems);

    } catch (error) {
        console.error('❌ Error in purchases report:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

// -----------------
// قائمة المخازن
// -----------------
router.get('/stores', async (req, res) => {
    try {
        const storesResult = await pool.query("SELECT store_id, store_name FROM stores ORDER BY store_name");
        res.json(storesResult.rows);
    } catch (err) {
        console.error('❌ Error loading stores:', err);
        res.status(500).json({ error: err.message });
    }
});

// -----------------
// قائمة الموردين
// -----------------
router.get('/suppliers', async (req, res) => {
    try {
        const suppliersResult = await pool.query("SELECT supplierid, supplier_name FROM suppliers ORDER BY supplier_name");
        res.json(suppliersResult.rows);
    } catch (err) {
        console.error('❌ Error loading suppliers:', err);
        res.status(500).json({ error: err.message });
    }
});

// -----------------
// قائمة الأصناف
// -----------------
router.get('/items', async (req, res) => {
    try {
        const itemsResult = await pool.query("SELECT item_id, item_nm FROM items ORDER BY item_nm");
        res.json(itemsResult.rows);
    } catch (err) {
        console.error('❌ Error loading items:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
