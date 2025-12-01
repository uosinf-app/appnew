// routes/purchases_Retbk.js
import express from 'express';
import pool from '../db.js';

const router = express.Router();

// وظيفة للتحقق من وجود الحقول الجديدة في جدول purchases_return
async function checkAndUpdateReturnTable() {
    try {
        console.log('🔧 جاري التحقق من جدول مرتجع المشتريات...');
        
        // التحقق من وجود الجدول
        const tableExists = await pool.query(`
            SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'purchases_return')
        `);
        
        if (!tableExists.rows[0].exists) {
            console.log('❌ جدول purchases_return غير موجود');
            return;
        }
        
        // إضافة الحقول المفقودة إذا لزم الأمر
        const addColumnsQuery = `
            DO $$ 
            BEGIN
                -- إضافة الحقول الجديدة إذا لم تكن موجودة
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases_return' AND column_name='batch_no') THEN
                    ALTER TABLE purchases_return ADD COLUMN batch_no character varying(50);
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases_return' AND column_name='expiry_date') THEN
                    ALTER TABLE purchases_return ADD COLUMN expiry_date date;
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases_return' AND column_name='unit_type') THEN
                    ALTER TABLE purchases_return ADD COLUMN unit_type character varying(20) DEFAULT 'piece';
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases_return' AND column_name='units_per_package') THEN
                    ALTER TABLE purchases_return ADD COLUMN units_per_package numeric(10,2) DEFAULT 1;
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases_return' AND column_name='sale_unit') THEN
                    ALTER TABLE purchases_return ADD COLUMN sale_unit character varying(20) DEFAULT 'piece';
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases_return' AND column_name='conversion_factor') THEN
                    ALTER TABLE purchases_return ADD COLUMN conversion_factor numeric(10,2) DEFAULT 1;
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases_return' AND column_name='converted_qty') THEN
                    ALTER TABLE purchases_return ADD COLUMN converted_qty numeric(20,2) DEFAULT 0;
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='purchases_return' AND column_name='payment_method') THEN
                    ALTER TABLE purchases_return ADD COLUMN payment_method character varying(20) DEFAULT 'cash';
                END IF;
            END $$;
        `;
        
        await pool.query(addColumnsQuery);
        console.log('✅ تم التحقق من جدول مرتجع المشتريات والحقول المطلوبة');
        
    } catch (error) {
        console.error('❌ خطأ في التحقق من جدول المرتجع:', error.message);
    }
}

// استدعاء الوظيفة عند بدء التشغيل
checkAndUpdateReturnTable();

// === الوظائف الحالية تبقى كما هي ===

// الحصول على جميع مرتجعات المشتريات
router.get('/', async (req, res) => {
    try {
        console.log('📋 جاري جلب مرتجعات المشتريات...');
        
        const result = await pool.query(`
            SELECT DISTINCT 
                invoice_id,
                tran_date,
                store_id,
                supplierid,
                original_invoice_id,
                return_reason,
                return_notes,
                user_id
            FROM purchases_return 
            ORDER BY tran_date DESC
            LIMIT 100
        `);
        
        console.log('تم العثور على مرتجعات:', result.rows.length);
        
        if (result.rows.length === 0) {
            return res.json([]);
        }
        
        // الحصول على تفاصيل الأصناف لكل مرتجع
        const returnsWithItems = await Promise.all(
            result.rows.map(async (returnItem) => {
                try {
                    const itemsResult = await pool.query(`
                        SELECT item_id, item_nm, item_qty, buy_price, total_price, 
                               return_reason, batch_no, expiry_date, unit_type,
                               converted_qty, sale_unit
                        FROM purchases_return 
                        WHERE invoice_id = $1
                    `, [returnItem.invoice_id]);
                    
                    const totalAmount = itemsResult.rows.reduce((sum, item) => 
                        sum + (parseFloat(item.total_price) || 0), 0
                    );
                    
                    return {
                        invoice_id: returnItem.invoice_id,
                        tran_date: returnItem.tran_date,
                        store_id: returnItem.store_id,
                        supplierid: returnItem.supplierid,
                        original_invoice_id: returnItem.original_invoice_id,
                        return_reason: returnItem.return_reason,
                        return_notes: returnItem.return_notes,
                        user_id: returnItem.user_id,
                        items: itemsResult.rows,
                        items_count: itemsResult.rows.length,
                        total_amount: totalAmount
                    };
                } catch (error) {
                    console.error(`Error fetching items for return ${returnItem.invoice_id}:`, error);
                    return {
                        ...returnItem,
                        items: [],
                        items_count: 0,
                        total_amount: 0
                    };
                }
            })
        );
        
        res.json(returnsWithItems);
        
    } catch (error) {
        console.error('Error fetching purchase returns:', error);
        
        if (error.message.includes('relation "purchases_return" does not exist')) {
            console.log('Purchases return table does not exist yet, returning empty array');
            return res.json([]);
        }
        
        res.status(500).json({ error: error.message });
    }
});

// الحصول على مرتجع محدد
router.get('/:invoice_id', async (req, res) => {
    try {
        const { invoice_id } = req.params;
        console.log('جاري جلب تفاصيل المرتجع:', invoice_id);
        
        const returnResult = await pool.query(`
            SELECT DISTINCT 
                invoice_id, tran_date, store_id, supplierid, 
                original_invoice_id, return_reason, return_notes, user_id
            FROM purchases_return 
            WHERE invoice_id = $1
        `, [invoice_id]);
        
        if (returnResult.rows.length === 0) {
            return res.status(404).json({ error: 'المرتجع غير موجود' });
        }
        
        const itemsResult = await pool.query(`
            SELECT item_id, item_nm, item_qty, buy_price, total_price, 
                   net_buy_price, total_net_buy_price, rate, unit,
                   discount_type, discount_value, sale_price1,
                   batch_no, expiry_date, unit_type, units_per_package,
                   sale_unit, conversion_factor, converted_qty,
                   return_reason
            FROM purchases_return 
            WHERE invoice_id = $1
        `, [invoice_id]);
        
        const returnData = {
            ...returnResult.rows[0],
            items: itemsResult.rows
        };
        
        res.json(returnData);
    } catch (error) {
        console.error('Error fetching return details:', error);
        res.status(500).json({ error: error.message });
    }
});

// البحث عن فاتورة شراء أصلية
router.get('/original/:invoice_id', async (req, res) => {
    try {
        const { invoice_id } = req.params;
        console.log('البحث عن الفاتورة الأصلية:', invoice_id);
        
        const purchaseResult = await pool.query(`
            SELECT DISTINCT 
                invoice_id, tran_date, store_id, supplierid, mndop, user_id
            FROM purchases 
            WHERE invoice_id = $1
        `, [invoice_id]);
        
        if (purchaseResult.rows.length === 0) {
            return res.status(404).json({ error: 'الفاتورة الأصلية غير موجودة' });
        }
        
        const itemsResult = await pool.query(`
            SELECT item_id, item_nm, item_qty, buy_price, total_price,
                   net_buy_price, total_net_buy_price, rate, unit,
                   discount_type, discount_value, sale_price1,
                   batch_no, expiry_date, unit_type, units_per_package,
                   sale_unit, conversion_factor
            FROM purchases 
            WHERE invoice_id = $1
        `, [invoice_id]);
        
        // حساب الكمية المرتجعة لكل صنف من هذه الفاتورة الأصلية
        const itemsWithReturnedQty = await Promise.all(
            itemsResult.rows.map(async (item) => {
                try {
                    // حساب إجمالي الكمية المرتجعة لهذا الصنف من هذه الفاتورة الأصلية
                    const returnedResult = await pool.query(`
                        SELECT COALESCE(SUM(item_qty), 0) as total_returned_qty
                        FROM purchases_return 
                        WHERE original_invoice_id = $1 AND item_id = $2
                    `, [invoice_id, item.item_id]);
                    
                    const totalReturnedQty = parseFloat(returnedResult.rows[0].total_returned_qty) || 0;
                    const originalQty = parseFloat(item.item_qty) || 0;
                    
                    // المخزون الحالي = الكمية المشتراة - الكمية المرتجعة
                    const currentStock = Math.max(0, originalQty - totalReturnedQty);
                    
                    return {
                        ...item,
                        current_stock: currentStock,
                        total_returned_qty: totalReturnedQty,
                        available_for_return: currentStock // نفس قيمة المخزون الحالي
                    };
                } catch (error) {
                    console.error(`Error calculating returned quantity for item ${item.item_id}:`, error);
                    return {
                        ...item,
                        current_stock: parseFloat(item.item_qty) || 0,
                        total_returned_qty: 0,
                        available_for_return: parseFloat(item.item_qty) || 0
                    };
                }
            })
        );
        
        const purchaseData = {
            ...purchaseResult.rows[0],
            items: itemsWithReturnedQty
        };
        
        res.json(purchaseData);
    } catch (error) {
        console.error('Error fetching original purchase:', error);
        res.status(500).json({ error: error.message });
    }
});
// التحقق من المخزون
router.get('/stock/:store_id/:item_id', async (req, res) => {
    try {
        const { store_id, item_id } = req.params;
        
        const result = await pool.query(`
            SELECT item_id, item_qty, total_price, total_net_buy_price
            FROM a_master 
            WHERE store_id = $1 AND item_id = $2
        `, [store_id, item_id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'الصنف غير موجود في المخزون' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error checking stock:', error);
        res.status(500).json({ error: error.message });
    }
});

// الحصول على إجمالي المرتجعات لصنف معين من فاتورة أصلية
router.get('/returns-summary/:original_invoice_id/:item_id', async (req, res) => {
    try {
        const { original_invoice_id, item_id } = req.params;
        
        const result = await pool.query(`
            SELECT 
                COALESCE(SUM(item_qty), 0) as total_returned_qty,
                COUNT(*) as return_count
            FROM purchases_return 
            WHERE original_invoice_id = $1 AND item_id = $2
        `, [original_invoice_id, item_id]);
        
        res.json({
            original_invoice_id: parseInt(original_invoice_id),
            item_id: item_id,
            total_returned_qty: parseFloat(result.rows[0].total_returned_qty) || 0,
            return_count: parseInt(result.rows[0].return_count) || 0
        });
        
    } catch (error) {
        console.error('Error fetching returns summary:', error);
        res.status(500).json({ error: error.message });
    }
});

// حفظ مرتجع المشتريات
router.post('/', async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const {
            tran_date,
            store_id,
            supplierid,
            invoice_id,
            original_invoice_id,
            return_reason,
            return_notes,
            user_id,
            items
        } = req.body;

        console.log('📨 استلام بيانات مرتجع المشتريات:', {
            invoice_id,
            original_invoice_id,
            return_reason,
            items_count: items.length
        });

        // التحقق من عدم تكرار رقم فاتورة المرتجع
        const checkReturnQuery = `SELECT * FROM purchases_return WHERE invoice_id = $1`;
        const returnResult = await client.query(checkReturnQuery, [invoice_id]);
        
        if (returnResult.rows.length > 0) {
            throw new Error(`رقم فاتورة المرتجع ${invoice_id} موجود مسبقاً`);
        }

        // التحقق من وجود الفاتورة الأصلية
        const checkOriginalQuery = `SELECT * FROM purchases WHERE invoice_id = $1`;
        const originalResult = await client.query(checkOriginalQuery, [original_invoice_id]);
        
        if (originalResult.rows.length === 0) {
            throw new Error(`الفاتورة الأصلية ${original_invoice_id} غير موجودة`);
        }

        for (const item of items) {
            console.log('معالجة صنف المرتجع:', item.item_id, item.item_nm);
            
            // الحصول على بيانات الصنف من الفاتورة الأصلية
            const originalItemResult = await client.query(`
                SELECT * FROM purchases 
                WHERE invoice_id = $1 AND item_id = $2
            `, [original_invoice_id, item.item_id]);
            
            if (originalItemResult.rows.length === 0) {
                throw new Error(`الصنف ${item.item_id} غير موجود في الفاتورة الأصلية`);
            }
            
            const originalItem = originalItemResult.rows[0];
            
            // التحقق من أن الكمية المرتجعة لا تتجاوز الكمية المشتراة
            const originalQty = parseFloat(originalItem.item_qty) || 0;
            const returnQty = parseFloat(item.item_qty) || 0;
            
            if (returnQty > originalQty) {
                throw new Error(`الكمية المرتجعة للصنف ${item.item_id} تتجاوز الكمية المشتراة`);
            }

            // التحقق من المخزون المتاح
            const stockResult = await client.query(`
                SELECT item_qty FROM a_master 
                WHERE store_id = $1 AND item_id = $2
            `, [store_id, item.item_id]);
            
            if (stockResult.rows.length > 0) {
                const currentStock = parseFloat(stockResult.rows[0].item_qty) || 0;
                if (returnQty > currentStock) {
                    throw new Error(`الكمية المرتجعة للصنف ${item.item_id} تتجاوز المخزون المتاح (${currentStock})`);
                }
            }

            // 1. إدخال في جدول مرتجع المشتريات
            const returnQuery = `
                INSERT INTO purchases_return (
                    tran_date, store_id, supplierid, invoice_id, item_id, item_nm,
                    item_qty, buy_price, total_price, user_id,
                    original_invoice_id, return_reason, return_notes,
                    net_buy_price, total_net_buy_price, rate, unit,
                    discount_type, discount_value, mndop, sale_price1,
                    batch_no, expiry_date, unit_type, units_per_package,
                    sale_unit, conversion_factor, converted_qty
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
            `;
            
            await client.query(returnQuery, [
                tran_date, store_id, supplierid, invoice_id, item.item_id, item.item_nm,
                item.item_qty, item.buy_price, item.total_price, user_id,
                original_invoice_id, return_reason, return_notes,
                item.net_buy_price, item.total_net_buy_price, item.rate, item.unit,
                item.discount_type || 'none', item.discount_value || 0, item.mndop || '', item.sale_price1 || 0,
                item.batch_no || null, item.expiry_date || null, item.unit_type || 'piece',
                item.units_per_package || 1, item.sale_unit || 'piece', item.conversion_factor || 1,
                item.converted_qty || item.item_qty
            ]);

            // 2. تحديث المخزون (طرح الكمية المرتجعة)
            const currentStockResult = await client.query(`
                SELECT item_qty, total_price, total_net_buy_price 
                FROM a_master 
                WHERE store_id = $1 AND item_id = $2
            `, [store_id, item.item_id]);
            
            if (currentStockResult.rows.length > 0) {
                const currentStock = currentStockResult.rows[0];
                const currentQty = parseFloat(currentStock.item_qty) || 0;
                const currentTotalPrice = parseFloat(currentStock.total_price) || 0;
                const currentTotalNetPrice = parseFloat(currentStock.total_net_buy_price) || 0;
                
                const returnQty = item.converted_qty || item.item_qty;
                const newQty = currentQty - returnQty;
                
                if (newQty < 0) {
                    throw new Error(`الكمية المرتجعة تتجاوز المخزون المتاح للصنف ${item.item_id}`);
                }
                
                const updateStockQuery = `
                    UPDATE a_master 
                    SET item_qty = $1,
                        total_price = $2,
                        total_net_buy_price = $3,
                        user_stamp = CURRENT_TIMESTAMP
                    WHERE store_id = $4 AND item_id = $5
                `;
                
                await client.query(updateStockQuery, [
                    newQty,
                    currentTotalPrice - (item.total_price || 0),
                    currentTotalNetPrice - (item.total_net_buy_price || 0),
                    store_id,
                    item.item_id
                ]);
                
                console.log(`✅ تم تحديث المخزون للصنف ${item.item_id}: ${currentQty} - ${returnQty} = ${newQty}`);
            } else {
                console.log(`⚠️ لا يوجد سجل في المخزون للصنف ${item.item_id}`);
            }
        }
        
        await client.query('COMMIT');
        res.json({ success: true, message: 'تم حفظ مرتجع المشتريات وتحديث المخزون بنجاح' });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving purchase return:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

// === الوظائف الجديدة ===

// البحث عن مرتجعات برقم الفاتورة الأصلية
router.get('/search/original/:original_invoice_id', async (req, res) => {
    try {
        const { original_invoice_id } = req.params;
        console.log('البحث عن مرتجعات الفاتورة الأصلية:', original_invoice_id);
        
        const result = await pool.query(`
            SELECT DISTINCT 
                invoice_id,
                tran_date,
                store_id,
                supplierid,
                original_invoice_id,
                return_reason,
                return_notes,
                user_id
            FROM purchases_return 
            WHERE original_invoice_id = $1
            ORDER BY tran_date DESC
        `, [original_invoice_id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'لا توجد مرتجعات لهذه الفاتورة' });
        }
        
        // الحصول على تفاصيل الأصناف لكل مرتجع
        const returnsWithItems = await Promise.all(
            result.rows.map(async (returnItem) => {
                try {
                    const itemsResult = await pool.query(`
                        SELECT item_id, item_nm, item_qty, buy_price, total_price
                        FROM purchases_return 
                        WHERE invoice_id = $1
                    `, [returnItem.invoice_id]);
                    
                    const totalAmount = itemsResult.rows.reduce((sum, item) => 
                        sum + (parseFloat(item.total_price) || 0), 0
                    );
                    
                    return {
                        invoice_id: returnItem.invoice_id,
                        tran_date: returnItem.tran_date,
                        store_id: returnItem.store_id,
                        supplierid: returnItem.supplierid,
                        original_invoice_id: returnItem.original_invoice_id,
                        return_reason: returnItem.return_reason,
                        return_notes: returnItem.return_notes,
                        user_id: returnItem.user_id,
                        items: itemsResult.rows,
                        items_count: itemsResult.rows.length,
                        total_amount: totalAmount
                    };
                } catch (error) {
                    console.error(`Error fetching items for return ${returnItem.invoice_id}:`, error);
                    return {
                        ...returnItem,
                        items: [],
                        items_count: 0,
                        total_amount: 0
                    };
                }
            })
        );
        
        res.json(returnsWithItems);
        
    } catch (error) {
        console.error('Error searching returns by original invoice:', error);
        res.status(500).json({ error: error.message });
    }
});

// حذف مرتجع المشتريات
router.delete('/:invoice_id', async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const { invoice_id } = req.params;
        console.log('حذف مرتجع المشتريات:', invoice_id);
        
        // الحصول على بيانات المرتجع المراد حذفه
        const returnToDelete = await client.query(`
            SELECT store_id, item_id, item_qty, total_price, total_net_buy_price,
                   converted_qty
            FROM purchases_return 
            WHERE invoice_id = $1
        `, [invoice_id]);
        
        if (returnToDelete.rows.length === 0) {
            throw new Error('المرتجع غير موجود');
        }
        
        // حذف المرتجع
        await client.query('DELETE FROM purchases_return WHERE invoice_id = $1', [invoice_id]);
        
        // استعادة المخزون (إضافة الكمية المرتجعة مرة أخرى)
        for (const item of returnToDelete.rows) {
            const { store_id, item_id, item_qty, total_price, total_net_buy_price, converted_qty } = item;
            
            const updateStockQuery = `
                UPDATE a_master 
                SET item_qty = item_qty + $1,
                    total_price = total_price + $2,
                    total_net_buy_price = total_net_buy_price + $3,
                    user_stamp = CURRENT_TIMESTAMP
                WHERE store_id = $4 AND item_id = $5
            `;
            
            await client.query(updateStockQuery, [
                converted_qty || item_qty,
                total_price,
                total_net_buy_price,
                store_id,
                item_id
            ]);
            
            console.log(`✅ تم استعادة المخزون للصنف ${item_id}`);
        }
        
        await client.query('COMMIT');
        res.json({ success: true, message: 'تم حذف المرتجع واستعادة المخزون بنجاح' });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting purchase return:', error);
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
});

export default router;