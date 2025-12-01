// routes/purchasesbk.js
import express from 'express';
import pool from '../db.js';

const router = express.Router();

// وظيفة لملء جدول item_last_values بالبيانات الحالية
async function initializeLastValuesTable() {
    try {
        console.log('🔧 جاري تهيئة جدول القيم الأخيرة...');
        
        const checkTableQuery = `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'item_last_values')`;
        const tableExists = await pool.query(checkTableQuery);
        
        if (!tableExists.rows[0].exists) {
            console.log('❌ جدول item_last_values غير موجود');
            return;
        }
        
        // ملء الجدول بالبيانات من a_master مع الحقول الجديدة
        const fillQuery = `
            INSERT INTO item_last_values 
            (store_id, item_id, buy_price, supplierid, net_buy_price, 
             discount_type, discount_value, sale_price1, rate, unit,
             batch_no, expiry_date, unit_type, units_per_package, 
             sale_unit, conversion_factor)
            SELECT 
                store_id, item_id, buy_price, supplierid, net_buy_price,
                COALESCE(discount_type, 'none') as discount_type,
                COALESCE(discount_value, 0) as discount_value,
                COALESCE(sale_price1, 0) as sale_price1,
                COALESCE(rate, 0) as rate,
                COALESCE(unit, 1) as unit,
                COALESCE(batch_no, '') as batch_no,
                expiry_date,
                COALESCE(unit_type, 'piece') as unit_type,
                COALESCE(units_per_package, 1) as units_per_package,
                COALESCE(sale_unit, 'piece') as sale_unit,
                COALESCE(conversion_factor, 1) as conversion_factor
            FROM a_master
            WHERE item_id IS NOT NULL AND store_id IS NOT NULL
            ON CONFLICT (store_id, item_id) 
            DO UPDATE SET
                buy_price = EXCLUDED.buy_price,
                supplierid = EXCLUDED.supplierid,
                net_buy_price = EXCLUDED.net_buy_price,
                discount_type = EXCLUDED.discount_type,
                discount_value = EXCLUDED.discount_value,
                sale_price1 = EXCLUDED.sale_price1,
                rate = EXCLUDED.rate,
                unit = EXCLUDED.unit,
                batch_no = EXCLUDED.batch_no,
                expiry_date = EXCLUDED.expiry_date,
                unit_type = EXCLUDED.unit_type,
                units_per_package = EXCLUDED.units_per_package,
                sale_unit = EXCLUDED.sale_unit,
                conversion_factor = EXCLUDED.conversion_factor,
                last_updated = CURRENT_TIMESTAMP
        `;
        
        const result = await pool.query(fillQuery);
        console.log(`✅ تم ملء جدول القيم الأخيرة بـ ${result.rowCount} سجل`);
        
    } catch (error) {
        console.error('❌ خطأ في تهيئة جدول القيم الأخيرة:', error.message);
    }
}

// استدعاء الوظيفة عند بدء التشغيل
initializeLastValuesTable();

// API لملء جدول item_last_values يدوياً
router.post('/initialize-last-values', async (req, res) => {
    try {
        await initializeLastValuesTable();
        res.json({ success: true, message: 'تم تهيئة جدول القيم الأخيرة بنجاح' });
    } catch (error) {
        console.error('Error initializing last values:', error);
        res.status(500).json({ error: error.message });
    }
});

// APIs لتحميل البيانات
router.get('/stores', async (req, res) => {
    try {
        console.log('Fetching stores...');
        const result = await pool.query('SELECT store_id, store_name FROM stores ORDER BY store_name');
        console.log('Stores found:', result.rows.length);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching stores:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/suppliers', async (req, res) => {
    try {
        console.log('Fetching suppliers...');
        const result = await pool.query('SELECT supplierid, supplier_name FROM suppliers ORDER BY supplier_name');
        console.log('Suppliers found:', result.rows.length);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching suppliers:', error);
        res.status(500).json({ error: error.message });
    }
});

// إضافة مورد جديد
router.post('/suppliers', async (req, res) => {
  try {
    const { supplier_name } = req.body;
    const result = await pool.query(
      'INSERT INTO suppliers (supplier_name) VALUES ($1) RETURNING *',
      [supplier_name]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/users', async (req, res) => {
    try {
        console.log('Fetching users...');
        const result = await pool.query('SELECT user_id, username FROM users ORDER BY username');
        console.log('Users found:', result.rows.length);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/items', async (req, res) => {
    try {
        console.log('Fetching items...');
        const result = await pool.query('SELECT item_id, item_nm, buy_price FROM items ORDER BY item_nm');
        console.log('Items found:', result.rows.length);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({ error: error.message });
    }
});

// حفظ المشتريات وتحديث a_master و item_last_values - النسخة المحدثة
router.post('/', async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const {
            tran_date,
            store_id,
            supplierid,
            invoice_id,
            mndop,
            user_id,
            payment_method,
            due_date,
            credit_period,
            payment_terms,
            check_number,
            bank_name,
            check_date,
            check_holder,
            check_branch,
            items
        } = req.body;

        console.log('Received purchase data:', {
            tran_date, store_id, supplierid, invoice_id, mndop, user_id,
            payment_method, due_date, credit_period, check_number, bank_name,
            items_count: items.length
        });

       // ✅ السماح بتكرار رقم الفاتورة إذا كان التاريخ مختلف
        const checkInvoiceQuery = `
            SELECT *
            FROM purchases
            WHERE invoice_id = $1
            AND DATE(tran_date) = DATE($2)
            `;
        const invoiceResult = await client.query(checkInvoiceQuery, [invoice_id, tran_date]);

        if (invoiceResult.rows.length > 0) {
            throw new Error(`⚠️ رقم الفاتورة ${invoice_id} مسجل بالفعل في نفس التاريخ`);
        }


        for (const item of items) {
            console.log('Processing item:', item.item_id, item.item_nm);
            
            // حساب total_price إذا لم يكن موجوداً
            let total_price = item.total_price;
            if (!total_price || total_price === 0) {
                total_price = (item.item_qty || 0) * (item.buy_price || 0);
                console.log(`Calculated total_price for item ${item.item_id}: ${total_price}`);
            }
            
            // ✅ الخطوة الجديدة: الحصول على القيم القديمة قبل التحديث
            let oldValues = null;
            try {
                const oldValuesResult = await client.query(
                    `SELECT 
                        buy_price, supplierid, net_buy_price, discount_type,
                        discount_value, sale_price1, rate, unit,
                        batch_no, expiry_date, unit_type, units_per_package,
                        sale_unit, conversion_factor
                     FROM a_master 
                     WHERE store_id = $1 AND item_id = $2`,
                    [store_id, item.item_id]
                );
                
                if (oldValuesResult.rows.length > 0) {
                    oldValues = oldValuesResult.rows[0];
                    console.log(`📋 القيم القديمة للصنف ${item.item_id}:`, oldValues);
                }
            } catch (error) {
                console.log(`⚠️ لا توجد قيم قديمة للصنف ${item.item_id}`);
            }
            
            // 1. إدخال في جدول المشتريات مع الحقول الجديدة
            const purchaseQuery = `
                INSERT INTO purchases (
                    tran_date, store_id, supplierid, invoice_id, item_id, item_nm,
                    item_qty, buy_price, total_price, discount,
                    net_buy_price, total_net_buy_price, user_id, mndop,
                    rate, unit, discount_type, discount_value, sale_price1,
                    payment_method, due_date, credit_period, payment_terms,
                    check_number, bank_name, check_date, check_holder, check_branch,
                    batch_no, expiry_date, unit_type, units_per_package, 
                    sale_unit, conversion_factor
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)
            `;
            
            await client.query(purchaseQuery, [
                tran_date, store_id, supplierid, invoice_id, item.item_id, item.item_nm,
                item.item_qty, item.buy_price, total_price, item.discount,
                item.net_buy_price, item.total_net_buy_price, user_id, mndop,
                item.rate || 0, item.unit || 1, item.discount_type || 'none', 
                item.discount_value || 0, item.sale_price1 || 0,
                // الحقول الجديدة للدفع
                payment_method || 'cash',
                due_date || null,
                credit_period || 30,
                payment_terms || null,
                check_number || null,
                bank_name || null,
                check_date || null,
                check_holder || null,
                check_branch || null,
                // الحقول الجديدة للمخزون
                item.batch_no || null,
                item.expiry_date || null,
                item.unit_type || 'piece',
                item.units_per_package || 1,
                item.sale_unit || 'piece',
                item.conversion_factor || 1
            ]);

            // 2. تحديث a_master مع جميع الحقول المطلوبة
            const checkMasterQuery = `SELECT * FROM a_master WHERE store_id = $1 AND item_id = $2`;
            const masterResult = await client.query(checkMasterQuery, [store_id, item.item_id]);
            
            // في purchasesbk.js - تصحيح استعلام تحديث a_master مع التراكم الصحيح
if (masterResult.rows.length > 0) {
    // ✅ الحصول على القيم الحالية من المخزون
    const currentStock = masterResult.rows[0];
    const currentQty = parseFloat(currentStock.item_qty) || 0;
    const currentTotalPrice = parseFloat(currentStock.total_price) || 0;
    const currentTotalNetPrice = parseFloat(currentStock.total_net_buy_price) || 0;
    
    // ✅ حساب القيم الجديدة مع التراكم
    const inventoryQty = item.converted_qty || item.item_qty;
    const newQty = currentQty + inventoryQty;
    const newTotalPrice = currentTotalPrice + (item.total_price || 0);
    const newTotalNetPrice = currentTotalNetPrice + (item.total_net_buy_price || 0);
    
    console.log(`📊 تراكم المخزون للصنف ${item.item_id}:`);
    console.log(`- الكمية الحالية: ${currentQty} + الكمية الجديدة: ${inventoryQty} = ${newQty}`);
    console.log(`- الإجمالي الحالي: ${currentTotalPrice} + الإجمالي الجديد: ${item.total_price} = ${newTotalPrice}`);

    const updateMasterQuery = `
        UPDATE a_master 
        SET 
            tran_date = $1, 
            supplierid = $2, 
            mndop = $3,
            item_qty = $4,
            buy_price = $5,
            total_price = $6,
            net_buy_price = $7,
            total_net_buy_price = $8,
            last_in_date = $9,
            user_id = $10,
            user_stamp = CURRENT_TIMESTAMP,
            discount_type = $11,
            discount_value = $12,
            sale_price1 = $13,
            rate = $14,
            unit = $15,

            batch_no = COALESCE($16, batch_no),

            -- ✅ منطق الصلاحية (C)
            expiry_date = CASE
                WHEN a_master.expiry_date IS NULL THEN $17
                WHEN a_master.expiry_date < CURRENT_DATE THEN $17
                ELSE a_master.expiry_date
            END,

            unit_type = COALESCE($18, unit_type),
            units_per_package = COALESCE($19, units_per_package),
            sale_unit = COALESCE($20, sale_unit),
            conversion_factor = COALESCE($21, conversion_factor)

        WHERE store_id = $22 AND item_id = $23
    `;

    await client.query(updateMasterQuery, [
        tran_date, 
        supplierid, 
        mndop, 
        newQty,  // ✅ الكمية بعد التراكم
        item.buy_price,
        newTotalPrice, // ✅ الإجمالي بعد التراكم
        item.net_buy_price, 
        newTotalNetPrice, // ✅ الصافي بعد التراكم
        tran_date, 
        user_id, 
        item.discount_type || 'none', 
        item.discount_value || 0, 
        item.sale_price1 || 0,
        item.rate || 0,
        item.unit || 1,
        item.batch_no || null,
        item.expiry_date || null,
        item.unit_type || 'piece',
        item.units_per_package || 1,
        item.sale_unit || 'piece',
        item.conversion_factor || 1,
        store_id, 
        item.item_id
    ]);
    
    console.log(`✅ تم تراكم المخزون: ${currentQty} + ${inventoryQty} = ${newQty}`);
    
            } else {
                // ✅ للعناصر الجديدة، استخدام الكمية المحولة مباشرة
                const inventoryQty = item.converted_qty || item.item_qty;
                
                console.log(`🆕 إضافة صنف جديد للمخزون: ${item.item_id}, الكمية: ${inventoryQty}`);

                const insertMasterQuery = `
                    INSERT INTO a_master (
                        tran_date, store_id, supplierid, mndop, item_id, item_nm,
                        item_qty, buy_price, total_price, net_buy_price, 
                        total_net_buy_price, last_in_date, user_id, 
                        discount_type, discount_value, sale_price1,
                        rate, unit, batch_no, expiry_date, unit_type,
                        units_per_package, sale_unit, conversion_factor
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
                `;
                
                await client.query(insertMasterQuery, [
                    tran_date, store_id, supplierid, mndop, item.item_id, item.item_nm,
                    inventoryQty, // ✅ الكمية المحولة
                    item.buy_price, item.total_price, item.net_buy_price,
                    item.total_net_buy_price, tran_date, user_id,
                    item.discount_type || 'none', item.discount_value || 0, item.sale_price1 || 0,
                    item.rate || 0, item.unit || 1,
                    item.batch_no || null,
                    item.expiry_date || null,
                    item.unit_type || 'piece',
                    item.units_per_package || 1,
                    item.sale_unit || 'piece',
                    item.conversion_factor || 1
                ]);
                
                console.log(`✅ تم إضافة الصنف الجديد للمخزون`);
            }

            // 3. ✅ تحديث جدول القيم الأخيرة بالقيم القديمة (وليس الجديدة)
            const updateLastValuesQuery = `
                INSERT INTO item_last_values 
                (store_id, item_id, buy_price, supplierid, net_buy_price, 
                 discount_type, discount_value, sale_price1, rate, unit,
                 batch_no, expiry_date, unit_type, units_per_package, 
                 sale_unit, conversion_factor, last_updated)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
                ON CONFLICT (store_id, item_id) 
                DO UPDATE SET
                    buy_price = EXCLUDED.buy_price,
                    supplierid = EXCLUDED.supplierid,
                    net_buy_price = EXCLUDED.net_buy_price,
                    discount_type = EXCLUDED.discount_type,
                    discount_value = EXCLUDED.discount_value,
                    sale_price1 = EXCLUDED.sale_price1,
                    rate = EXCLUDED.rate,
                    unit = EXCLUDED.unit,
                    batch_no = EXCLUDED.batch_no,
                    expiry_date = EXCLUDED.expiry_date,
                    unit_type = EXCLUDED.unit_type,
                    units_per_package = EXCLUDED.units_per_package,
                    sale_unit = EXCLUDED.sale_unit,
                    conversion_factor = EXCLUDED.conversion_factor,
                    last_updated = CURRENT_TIMESTAMP
            `;
            
            // ✅ استخدام القيم القديمة إذا وجدت، وإلا استخدام القيم الجديدة
            const valuesToSave = oldValues ? {
                buy_price: oldValues.buy_price,
                supplierid: oldValues.supplierid,
                net_buy_price: oldValues.net_buy_price,
                discount_type: oldValues.discount_type,
                discount_value: oldValues.discount_value,
                sale_price1: oldValues.sale_price1,
                rate: oldValues.rate,
                unit: oldValues.unit,
                batch_no: oldValues.batch_no,
                expiry_date: oldValues.expiry_date,
                unit_type: oldValues.unit_type,
                units_per_package: oldValues.units_per_package,
                sale_unit: oldValues.sale_unit,
                conversion_factor: oldValues.conversion_factor
            } : {
                buy_price: item.buy_price,
                supplierid: supplierid,
                net_buy_price: item.net_buy_price,
                discount_type: item.discount_type || 'none',
                discount_value: item.discount_value || 0,
                sale_price1: item.sale_price1 || 0,
                rate: item.rate || 0,
                unit: item.unit || 1,
                batch_no: item.batch_no || null,
                expiry_date: item.expiry_date || null,
                unit_type: item.unit_type || 'piece',
                units_per_package: item.units_per_package || 1,
                sale_unit: item.sale_unit || 'piece',
                conversion_factor: item.conversion_factor || 1
            };
            
            await client.query(updateLastValuesQuery, [
                store_id, 
                item.item_id, 
                valuesToSave.buy_price, 
                valuesToSave.supplierid, 
                valuesToSave.net_buy_price, 
                valuesToSave.discount_type, 
                valuesToSave.discount_value, 
                valuesToSave.sale_price1,
                valuesToSave.rate, 
                valuesToSave.unit,
                valuesToSave.batch_no,
                valuesToSave.expiry_date,
                valuesToSave.unit_type,
                valuesToSave.units_per_package,
                valuesToSave.sale_unit,
                valuesToSave.conversion_factor
            ]);
            
            console.log(`✅ حفظ القيم ${oldValues ? 'القديمة' : 'الجديدة'} للصنف ${item.item_id} في last_values`);
        }
        
        await client.query('COMMIT');
        res.json({ success: true, message: 'تم حفظ المشتريات وتحديث المخزون بنجاح' });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving purchase:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// جلب جميع المشتريات مع تجميع البيانات - نسخة محدثة
router.get('/', async (req, res) => {
    try {
        console.log('Fetching purchases...');
        
        // استعلام محدث ليشمل الحقول الجديدة
        const result = await pool.query(`
            SELECT DISTINCT 
                invoice_id,
                tran_date,
                store_id,
                supplierid,
                mndop,
                user_id,
                payment_method,
                due_date,
                credit_period,
                payment_terms,
                check_number,
                bank_name,
                check_date,
                check_holder,
                check_branch,
                batch_no,
                expiry_date,
                unit_type,
                units_per_package,
                sale_unit,
                conversion_factor
            FROM purchases 
            ORDER BY tran_date DESC
            LIMIT 100
        `);
        
        console.log('Purchases found:', result.rows.length);
        
        // إذا كان الجدول فارغاً، نرجع مصفوفة فارغة
        if (result.rows.length === 0) {
            return res.json([]);
        }
        
        // الحصول على تفاصيل الأصناف لكل فاتورة
        const purchasesWithItems = await Promise.all(
            result.rows.map(async (purchase) => {
                try {
                    const itemsResult = await pool.query(
                        `SELECT item_id, item_nm, item_qty, buy_price, total_price, 
                                batch_no, expiry_date, unit_type, units_per_package,
                                sale_unit, conversion_factor
                         FROM purchases WHERE invoice_id = $1`,
                        [purchase.invoice_id]
                    );
                    
                    const totalAmount = itemsResult.rows.reduce((sum, item) => 
                        sum + (parseFloat(item.total_price) || 0), 0
                    );
                    
                    return {
                        invoice_id: purchase.invoice_id,
                        tran_date: purchase.tran_date,
                        store_id: purchase.store_id,
                        supplierid: purchase.supplierid,
                        mndop: purchase.mndop,
                        user_id: purchase.user_id,
                        payment_method: purchase.payment_method,
                        due_date: purchase.due_date,
                        credit_period: purchase.credit_period,
                        payment_terms: purchase.payment_terms,
                        check_number: purchase.check_number,
                        bank_name: purchase.bank_name,
                        check_date: purchase.check_date,
                        check_holder: purchase.check_holder,
                        check_branch: purchase.check_branch,
                        batch_no: purchase.batch_no,
                        expiry_date: purchase.expiry_date,
                        unit_type: purchase.unit_type,
                        units_per_package: purchase.units_per_package,
                        sale_unit: purchase.sale_unit,
                        conversion_factor: purchase.conversion_factor,
                        items: itemsResult.rows,
                        items_count: itemsResult.rows.length,
                        total_amount: totalAmount
                    };
                } catch (error) {
                    console.error(`Error fetching items for invoice ${purchase.invoice_id}:`, error);
                    return {
                        ...purchase,
                        items: [],
                        items_count: 0,
                        total_amount: 0
                    };
                }
            })
        );
        
        res.json(purchasesWithItems);
        
    } catch (error) {
        console.error('Error fetching purchases:', error);
        
        // إذا كان الخطأ بسبب عدم وجود الجدول، نرجع مصفوفة فارغة
        if (error.message.includes('relation "purchases" does not exist')) {
            console.log('Purchases table does not exist yet, returning empty array');
            return res.json([]);
        }
        
        res.status(500).json({ error: error.message });
    }
});

// جلب تفاصيل فاتورة محددة - نسخة محدثة
router.get('/:invoice_id', async (req, res) => {
    try {
        const { invoice_id } = req.params;
        console.log('Fetching purchase details for invoice:', invoice_id);
        
        const purchaseResult = await pool.query(`
            SELECT DISTINCT 
                invoice_id, tran_date, store_id, supplierid, mndop, user_id,
                payment_method, due_date, credit_period, payment_terms,
                check_number, bank_name, check_date, check_holder, check_branch,
                batch_no, expiry_date, unit_type, units_per_package, 
                sale_unit, conversion_factor
            FROM purchases 
            WHERE invoice_id = $1
        `, [invoice_id]);
        
        if (purchaseResult.rows.length === 0) {
            return res.status(404).json({ error: 'الفاتورة غير موجودة' });
        }
        
        const itemsResult = await pool.query(`
            SELECT item_id, item_nm, item_qty, buy_price, total_price, discount, 
                   net_buy_price, total_net_buy_price, rate, unit, discount_type, 
                   discount_value, sale_price1, batch_no, expiry_date, unit_type,
                   units_per_package, sale_unit, conversion_factor
            FROM purchases 
            WHERE invoice_id = $1
        `, [invoice_id]);
        
        const purchase = {
            ...purchaseResult.rows[0],
            items: itemsResult.rows
        };
        
        res.json(purchase);
    } catch (error) {
        console.error('Error fetching purchase details:', error);
        res.status(500).json({ error: error.message });
    }
});

// حذف فاتورة شراء مع استعادة القيم من item_last_values - نسخة محدثة
router.delete('/:invoice_id', async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const { invoice_id } = req.params;
        console.log('Deleting purchase invoice:', invoice_id);
        
        // 1. الحصول على بيانات الفاتورة المراد حذفها (بما في ذلك الحقول الجديدة)
        const purchaseToDelete = await client.query(
            `SELECT 
                store_id, item_id, item_qty, total_price, total_net_buy_price,
                payment_method, due_date, credit_period, payment_terms,
                check_number, bank_name, check_date, check_holder, check_branch,
                batch_no, expiry_date, unit_type, units_per_package, 
                sale_unit, conversion_factor
             FROM purchases WHERE invoice_id = $1`,
            [invoice_id]
        );
        
        // 2. حذف الفاتورة من جدول المشتريات
        await client.query('DELETE FROM purchases WHERE invoice_id = $1', [invoice_id]);
        
        // 3. تحديث a_master باستخدام القيم من item_last_values
        for (const item of purchaseToDelete.rows) {
            const { store_id, item_id, item_qty, total_price, total_net_buy_price } = item;
            
            // الحصول على القيم القديمة من item_last_values
            const lastValues = await client.query(
                `SELECT 
                    buy_price, supplierid, net_buy_price, discount_type,
                    discount_value, sale_price1, rate, unit,
                    batch_no, expiry_date, unit_type, units_per_package,
                    sale_unit, conversion_factor
                 FROM item_last_values 
                 WHERE store_id = $1 AND item_id = $2`,
                [store_id, item_id]
            );
            
            console.log(`القيم القديمة للصنف ${item_id}:`, lastValues.rows[0]);
            
            // الحصول على القيم الحالية من a_master
            const currentMaster = await client.query(
                `SELECT 
                    item_qty, total_price, total_net_buy_price
                 FROM a_master WHERE store_id = $1 AND item_id = $2`,
                [store_id, item_id]
            );
            
            if (currentMaster.rows.length > 0) {
                const newQty = currentMaster.rows[0].item_qty - item_qty;
                
                if (newQty > 0) {
                    // استخدام القيم من item_last_values إذا وجدت
                    if (lastValues.rows.length > 0) {
                        const lastValuesData = lastValues.rows[0];
                        
                        const updateQuery = `
                            UPDATE a_master 
                            SET item_qty = $1,
                                total_price = total_price - $2,
                                total_net_buy_price = total_net_buy_price - $3,
                                buy_price = $4,
                                supplierid = $5,
                                net_buy_price = $6,
                                discount_type = $7,
                                discount_value = $8,
                                sale_price1 = $9,
                                rate = $10,
                                unit = $11,
                                batch_no = $12,
                                expiry_date = $13,
                                unit_type = $14,
                                units_per_package = $15,
                                sale_unit = $16,
                                conversion_factor = $17,
                                user_stamp = CURRENT_TIMESTAMP
                            WHERE store_id = $18 AND item_id = $19
                        `;
                        
                        await client.query(updateQuery, [
                            newQty,
                            total_price,
                            total_net_buy_price,
                            lastValuesData.buy_price,
                            lastValuesData.supplierid,
                            lastValuesData.net_buy_price,
                            lastValuesData.discount_type,
                            lastValuesData.discount_value,
                            lastValuesData.sale_price1,
                            lastValuesData.rate,
                            lastValuesData.unit,
                            lastValuesData.batch_no,
                            lastValuesData.expiry_date,
                            lastValuesData.unit_type,
                            lastValuesData.units_per_package,
                            lastValuesData.sale_unit,
                            lastValuesData.conversion_factor,
                            store_id,
                            item_id
                        ]);
                        
                        console.log(`✅ استعادة القيم القديمة للصنف ${item_id}`);
                    } else {
                        // إذا لم توجد قيم قديمة، نستخدم القيم الحالية (بدون تغيير)
                        const updateQuery = `
                            UPDATE a_master 
                            SET item_qty = $1,
                                total_price = total_price - $2,
                                total_net_buy_price = total_net_buy_price - $3,
                                user_stamp = CURRENT_TIMESTAMP
                            WHERE store_id = $4 AND item_id = $5
                        `;
                        
                        await client.query(updateQuery, [
                            newQty,
                            total_price,
                            total_net_buy_price,
                            store_id,
                            item_id
                        ]);
                        
                        console.log(`⚠️ لا توجد قيم قديمة للصنف ${item_id}, استخدام القيم الحالية`);
                    }
                    
                } else {
                    // إذا كانت الكمية صفر أو أقل، نحذف السجل
                    await client.query(
                        'DELETE FROM a_master WHERE store_id = $1 AND item_id = $2',
                        [store_id, item_id]
                    );
                    console.log(`🗑️ حذف سجل الصنف ${item_id} بسبب كمية صفرية`);
                }
            } else {
                console.log(`⚠️ لا يوجد سجل في a_master للصنف ${item_id}`);
            }
        }
        
        await client.query('COMMIT');
        res.json({ success: true, message: 'تم حذف الفاتورة واستعادة القيم القديمة بنجاح' });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting purchase:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

// ✅ تحديث تواريخ الصلاحية ونقل المنتهية لجدول expired_items
router.post('/update-expiry', async (req, res) => {
  try {
    // نقل المنتهية إلى جدول expired_items
   await pool.query(`
  INSERT INTO expired_items (item_id, item_nm, store_id, expiry_date, qty, moved_at)
    SELECT 
        item_id, 
        COALESCE(item_nm, 'اسم غير محدد') AS item_nm, 
        store_id, 
        expiry_date, 
        item_qty, 
        NOW()
        FROM a_master
        WHERE expiry_date < CURRENT_DATE;
    `);


    // حذف المنتهية من المخزون
    await pool.query(`
      DELETE FROM a_master
      WHERE expiry_date < CURRENT_DATE;
    `);

    // تحديث المخزون لأحدث تاريخ صالح لكل صنف
    await pool.query(`
      UPDATE a_master m
      SET expiry_date = s.max_exp
      FROM (SELECT item_id, MAX(expiry_date) AS max_exp FROM a_master GROUP BY item_id) s
      WHERE m.item_id = s.item_id;
    `);

    res.json({ status: "ok", message: "تم التحديث بنجاح ✅" });

  } catch(err){
    console.error(err);
    res.status(500).json({ error: err.message || "خطأ أثناء تحديث الصلاحيات" });
  }
});


export default router;