// acceptTransferbk.js - Backend API for Accepting Inventory Transfers
import express from 'express';
import db from '../db.js';

const router = express.Router();

// 📊 جلب التحويلات الواردة لمخزن معين
router.get("/incoming-transfers/:storeId", async (req, res) => {
  try {
    const { storeId } = req.params;
    const { status = 'pending' } = req.query;

    console.log('📥 جلب التحويلات الواردة للمخزن:', { storeId, status });

    const result = await db.query(`
      SELECT 
        ts.ser_no as transfer_no,
        ts.tran_date as transfer_date,
        ts.from_store,
        s1.store_name as from_store_name,
        ts.to_store,
        s2.store_name as to_store_name,
        COUNT(ts.item_id) as total_items,
        SUM(ts.qty) as total_qty,
        ts.status,
        ts.remarks,
        u.username as created_by,
        ts.tran_date as created_date,
        ts.expires_at
      FROM transfer_stores ts
      LEFT JOIN stores s1 ON ts.from_store = s1.store_id
      LEFT JOIN stores s2 ON ts.to_store = s2.store_id
      LEFT JOIN users u ON ts.user_id = u.user_id
      WHERE ts.to_store = $1 AND ts.status = $2
      GROUP BY ts.ser_no, ts.tran_date, ts.from_store, s1.store_name, 
               ts.to_store, s2.store_name, ts.status, ts.remarks, 
               u.username, ts.expires_at
      ORDER BY ts.tran_date DESC
    `, [storeId, status]);
    
    res.json({
      success: true,
      transfers: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('❌ خطأ في جلب التحويلات الواردة:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في جلب التحويلات الواردة',
      error: error.message 
    });
  }
});

// 📋 جلب تفاصيل تحويل معين
router.get("/transfer-details/:transferNo", async (req, res) => {
  try {
    const { transferNo } = req.params;

    console.log('📋 جلب تفاصيل التحويل:', transferNo);

    // جلب بيانات الرأس
    const headerResult = await db.query(`
      SELECT 
        ts.ser_no as transfer_no,
        ts.tran_date as transfer_date,
        ts.from_store,
        s1.store_name as from_store_name,
        ts.to_store,
        s2.store_name as to_store_name,
        ts.status,
        ts.remarks,
        u.username as created_by,
        ts.expires_at,
        COUNT(ts.item_id) as total_items,
        SUM(ts.qty) as total_qty
      FROM transfer_stores ts
      LEFT JOIN stores s1 ON ts.from_store = s1.store_id
      LEFT JOIN stores s2 ON ts.to_store = s2.store_id
      LEFT JOIN users u ON ts.user_id = u.user_id
      WHERE ts.ser_no = $1
      GROUP BY ts.ser_no, ts.tran_date, ts.from_store, s1.store_name, 
               ts.to_store, s2.store_name, ts.status, ts.remarks, 
               u.username, ts.expires_at
    `, [transferNo]);

    if (headerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'التحويل غير موجود'
      });
    }

    const header = headerResult.rows[0];

    // جلب بيانات التفاصيل
    const detailsResult = await db.query(`
      SELECT 
        ts.item_id,
        ts.qty as transfer_qty,
        ts.batch_no,
        ts.expiry_date,
        ts.unit_type,
        ts.buy_price as item_price,
        ts.sale_price1,
        ts.sale_price2,
        ts.sale_price3,
        ts.rate,
        i.item_nm,
        COALESCE(am.item_qty, 0) as current_stock,
        ROW_NUMBER() OVER (ORDER BY ts.item_id) as line_no
      FROM transfer_stores ts
      LEFT JOIN items i ON ts.item_id = i.item_id
      LEFT JOIN a_master am ON ts.item_id = am.item_id AND am.store_id = $1
      WHERE ts.ser_no = $2
      ORDER BY ts.item_id
    `, [header.to_store, transferNo]);

    res.json({
      success: true,
      header: header,
      details: detailsResult.rows
    });

  } catch (error) {
    console.error('❌ خطأ في جلب تفاصيل التحويل:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في جلب تفاصيل التحويل',
      error: error.message 
    });
  }
});

// ✅ قبول تحويل كامل
router.post("/accept-transfer/:transferNo", async (req, res) => {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    const { transferNo } = req.params;
    const { remarks = '' } = req.body;
    const userId = req.user?.user_id || 1;

    console.log('✅ قبول التحويل:', { transferNo, userId });

    // التحقق من وجود التحويل وحالته
    const transferResult = await client.query(`
      SELECT * FROM transfer_stores 
      WHERE ser_no = $1 AND status = 'pending'
    `, [transferNo]);

    if (transferResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({
        success: false,
        message: 'التحويل غير موجود أو تم معالجته مسبقاً'
      });
    }

    const transferData = transferResult.rows[0];
    const transferItems = transferResult.rows;

    console.log('📦 عدد الأصناف في التحويل:', transferItems.length);

    // التحقق من توفر الكميات في المخزن المصدر
    const availabilityIssues = [];
    
    for (const item of transferItems) {
      const sourceCheck = await client.query(`
        SELECT item_qty, item_nm FROM a_master 
        WHERE store_id = $1 AND item_id = $2
      `, [transferData.from_store, item.item_id]);

      if (sourceCheck.rows.length === 0) {
        availabilityIssues.push({
          item_id: item.item_id,
          issue: 'لم يعد الصنف موجوداً في المخزن المصدر',
          available: 0,
          required: item.qty
        });
        continue;
      }

      const currentQty = parseFloat(sourceCheck.rows[0].item_qty);
      if (currentQty < item.qty) {
        availabilityIssues.push({
          item_id: item.item_id,
          item_nm: sourceCheck.rows[0].item_nm,
          issue: 'الكمية غير كافية',
          available: currentQty,
          required: item.qty,
          shortage: item.qty - currentQty
        });
      }
    }

    // إذا كانت هناك مشاكل في التوفر
    if (availabilityIssues.length > 0) {
      await client.query('ROLLBACK');
      client.release();
      
      return res.status(400).json({
        success: false,
        message: 'لا يمكن قبول التحويل بسبب عدم توفر الكميات في المخزن المصدر',
        issues: availabilityIssues
      });
    }

    // معالجة كل صنف في التحويل
    for (const item of transferItems) {
      console.log('🔄 معالجة الصنف:', item.item_id, 'الكمية:', item.qty);

      // التحقق من وجود الصنف في المخزن الهدف
      const targetCheck = await client.query(`
        SELECT item_id, item_qty, buy_price, total_price, total_net_buy_price 
        FROM a_master WHERE store_id = $1 AND item_id = $2
      `, [transferData.to_store, item.item_id]);

      if (targetCheck.rows.length > 0) {
        // تحديث الصنف الموجود
        const existingItem = targetCheck.rows[0];
        const newQty = parseFloat(existingItem.item_qty) + parseFloat(item.qty);
        const newTotalPrice = parseFloat(existingItem.total_price) + (item.qty * (item.sale_price1 || 0));
        const newTotalNetBuyPrice = parseFloat(existingItem.total_net_buy_price) + (item.qty * (item.buy_price || 0));
        
        const newBuyPrice = newTotalNetBuyPrice / newQty;

        await client.query(`
          UPDATE a_master 
          SET 
            item_qty = $1,
            last_in_date = NOW(),
            buy_price = $2,
            sale_price1 = $3,
            sale_price2 = $4,
            sale_price3 = $5,
            total_price = $6,
            total_net_buy_price = $7,
            rate = $8
          WHERE store_id = $9 AND item_id = $10
        `, [
          newQty, 
          newBuyPrice, 
          item.sale_price1 || 0, 
          item.sale_price2 || 0, 
          item.sale_price3 || 0,
          newTotalPrice,
          newTotalNetBuyPrice,
          newBuyPrice,
          transferData.to_store, 
          item.item_id
        ]);

        console.log('✅ تم تحديث الصنف:', item.item_id);

      } else {
        // إضافة صنف جديد - نسخة مبسطة بدون الحقول الاختيارية
        const totalPrice = item.qty * (item.sale_price1 || 0);
        const totalNetBuyPrice = item.qty * (item.buy_price || 0);

        await client.query(`
          INSERT INTO a_master (
            tran_date, store_id, item_id, item_nm, item_qty,
            buy_price, sale_price1, sale_price2, sale_price3,
            total_price, total_net_buy_price, net_buy_price,
            unit_type, batch_no, expiry_date, user_id, rate, last_in_date
          ) VALUES (NOW(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
        `, [
          transferData.to_store, 
          item.item_id, 
          item.item_nm || `Item ${item.item_id}`, 
          item.qty,
          item.buy_price || 0, 
          item.sale_price1 || 0, 
          item.sale_price2 || 0, 
          item.sale_price3 || 0,
          totalPrice,
          totalNetBuyPrice,
          item.buy_price || 0,
          item.unit_type || 'UNIT', 
          item.batch_no || null,
          item.expiry_date || null,
          userId, 
          item.buy_price || 0
        ]);

        console.log('✅ تم إضافة صنف جديد:', item.item_id);
      }
    }

    // ✅ التصحيح: استعلام تحديث حالة التحويل
    const updatedRemarks = remarks ? ` - ${remarks}` : '';
    await client.query(`
      UPDATE transfer_stores 
      SET 
        status = 'completed',
        approved_by = $1,
        approved_date = NOW(),
        remarks = COALESCE(remarks, '') || $2
      WHERE ser_no = $3
    `, [userId, updatedRemarks, transferNo]);

    await client.query('COMMIT');
    client.release();

    console.log('✅ تم قبول التحويل بنجاح:', transferNo);

    res.json({
      success: true,
      transfer_no: transferNo,
      message: 'تم قبول التحويل بنجاح',
      accepted_items: transferItems.length,
      accepted_qty: transferItems.reduce((sum, item) => sum + parseFloat(item.qty), 0)
    });

  } catch (error) {
    console.error('❌ خطأ في قبول التحويل:', error);
    console.error('❌ تفاصيل الخطأ:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail
    });
    
    if (client) {
        await client.query('ROLLBACK');
        client.release();
    }
    
    res.status(500).json({ 
        success: false, 
        message: 'خطأ في قبول التحويل',
        error: error.message,
        details: error.detail
    });
  }
});

// ❌ رفض تحويل
router.post("/reject-transfer/:transferNo", async (req, res) => {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    const { transferNo } = req.params;
    const { rejection_reason } = req.body;
    const userId = req.user?.user_id || 1;

    console.log('❌ رفض التحويل:', { transferNo, userId });

    // التحقق من وجود التحويل وحالته
    const transferResult = await client.query(`
      SELECT * FROM transfer_stores 
      WHERE ser_no = $1 AND status = 'pending'
    `, [transferNo]);

    if (transferResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({
        success: false,
        message: 'التحويل غير موجود أو تم معالجته مسبقاً'
      });
    }

    const transferData = transferResult.rows[0];
    const transferItems = transferResult.rows;

    // إعادة الكميات إلى المخزن المصدر
    for (const item of transferItems) {
      const sourceCheck = await client.query(`
        SELECT item_id FROM a_master WHERE store_id = $1 AND item_id = $2
      `, [transferData.from_store, item.item_id]);

      if (sourceCheck.rows.length > 0) {
        await client.query(`
          UPDATE a_master 
          SET item_qty = item_qty + $1,
              total_price = (item_qty + $1) * sale_price1,
              total_net_buy_price = (item_qty + $1) * buy_price
          WHERE store_id = $2 AND item_id = $3
        `, [item.qty, transferData.from_store, item.item_id]);
      }
    }

    // ✅ التصحيح: استعلام تحديث حالة التحويل للرفض
    const rejectionText = rejection_reason ? ` - سبب الرفض: ${rejection_reason}` : ' - تم الرفض';
    await client.query(`
      UPDATE transfer_stores 
      SET 
        status = 'rejected',
        approved_by = $1,
        approved_date = NOW(),
        remarks = COALESCE(remarks, '') || $2
      WHERE ser_no = $3
    `, [userId, rejectionText, transferNo]);

    await client.query('COMMIT');
    client.release();

    console.log('✅ تم رفض التحويل:', transferNo);

    res.json({
      success: true,
      transfer_no: transferNo,
      message: 'تم رفض التحويل بنجاح'
    });

  } catch (error) {
    console.error('❌ خطأ في رفض التحويل:', error);
    console.error('❌ تفاصيل الخطأ:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail
    });
    
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في رفض التحويل',
      error: error.message,
      details: error.detail
    });
  }
});

// ⚠️ قبول جزئي للتحويل
router.post("/partial-accept/:transferNo", async (req, res) => {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    const { transferNo } = req.params;
    const { accepted_items, remarks = '' } = req.body;
    const userId = req.user?.user_id || 1;

    console.log('⚠️ قبول جزئي للتحويل:', { transferNo, accepted_items: accepted_items.length });

    if (!accepted_items || !Array.isArray(accepted_items) || accepted_items.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: 'يجب تحديد الأصناف المقبولة'
      });
    }

    // التحقق من وجود التحويل
    const transferResult = await client.query(`
      SELECT * FROM transfer_stores 
      WHERE ser_no = $1 AND status = 'pending'
    `, [transferNo]);

    if (transferResult.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({
        success: false,
        message: 'التحويل غير موجود أو تم معالجته مسبقاً'
      });
    }

    const transferData = transferResult.rows[0];
    let totalAcceptedQty = 0;
    let acceptedCount = 0;

    // معالجة الأصناف المقبولة
    for (const acceptedItem of accepted_items) {
      const { item_id, accepted_qty } = acceptedItem;

      const originalItem = transferResult.rows.find(item => item.item_id === item_id);
      if (!originalItem) continue;

      if (accepted_qty > originalItem.qty) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({
          success: false,
          message: `الكمية المقبولة للصنف ${item_id} أكبر من الكمية المرسلة`
        });
      }

      // التحقق من وجود الصنف في المخزن الهدف
      const targetCheck = await client.query(`
        SELECT item_id FROM a_master WHERE store_id = $1 AND item_id = $2
      `, [transferData.to_store, item_id]);

      if (targetCheck.rows.length > 0) {
        // تحديث الصنف الموجود
        await client.query(`
          UPDATE a_master 
          SET item_qty = item_qty + $1
          WHERE store_id = $2 AND item_id = $3
        `, [accepted_qty, transferData.to_store, item_id]);
      } else {
        // إضافة صنف جديد
        await client.query(`
          INSERT INTO a_master (
            tran_date, store_id, item_id, item_nm, item_qty,
            buy_price, sale_price1, sale_price2, sale_price3,
            unit_type, batch_no, expiry_date, user_id, rate, last_in_date
          ) VALUES (NOW(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        `, [
          transferData.to_store, 
          item_id, 
          originalItem.item_nm || `Item ${item_id}`, 
          accepted_qty,
          originalItem.buy_price || 0, 
          originalItem.sale_price1 || 0, 
          originalItem.sale_price2 || 0, 
          originalItem.sale_price3 || 0,
          originalItem.unit_type || 'UNIT', 
          originalItem.batch_no || null,
          originalItem.expiry_date || null,
          userId, 
          originalItem.rate || 0
        ]);
      }

      // تحديث الكمية في جدول التحويل
      if (accepted_qty < originalItem.qty) {
        await client.query(`
          UPDATE transfer_stores 
          SET qty = $1
          WHERE ser_no = $2 AND item_id = $3
        `, [accepted_qty, transferNo, item_id]);
      }

      totalAcceptedQty += accepted_qty;
      acceptedCount++;
    }

    // ✅ التصحيح: استعلام تحديث حالة التحويل للقبول الجزئي
    const updatedRemarks = remarks ? ` - ${remarks}` : '';
    await client.query(`
      UPDATE transfer_stores 
      SET 
        status = 'partially_accepted',
        approved_by = $1,
        approved_date = NOW(),
        remarks = COALESCE(remarks, '') || $2
      WHERE ser_no = $3
    `, [userId, updatedRemarks, transferNo]);

    await client.query('COMMIT');
    client.release();

    console.log('✅ تم القبول الجزئي للتحويل:', transferNo);

    res.json({
      success: true,
      transfer_no: transferNo,
      message: 'تم القبول الجزئي للتحويل بنجاح',
      accepted_items: acceptedCount,
      accepted_qty: totalAcceptedQty
    });

  } catch (error) {
    console.error('❌ خطأ في القبول الجزئي:', error);
    console.error('❌ تفاصيل الخطأ:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail
    });
    
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في القبول الجزئي للتحويل',
      error: error.message,
      details: error.detail
    });
  }
});
// 🔍 البحث عن الأصناف بالدفعة
router.get("/batch-items/:storeId", async (req, res) => {
  try {
    const { storeId } = req.params;
    const { batchNo, search } = req.query;

    console.log('🔍 البحث عن الأصناف بالدفعة:', { storeId, batchNo, search });

    let query = `
      SELECT 
        item_id,
        item_nm,
        item_qty,
        batch_no,
        expiry_date,
        unit_type,
        buy_price,
        sale_price1,
        sale_price2,
        sale_price3,
        rate
      FROM a_master 
      WHERE store_id = $1 AND item_qty > 0
    `;

    const params = [storeId];

    if (batchNo && batchNo.trim() !== '') {
      query += ` AND (batch_no = $2 OR batch_no ILIKE $3)`;
      params.push(batchNo, `%${batchNo}%`);
    }

    if (search && search.trim() !== '') {
      const searchParam = params.length + 1;
      query += ` AND (item_id::text LIKE $${searchParam} OR item_nm ILIKE $${searchParam})`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY item_nm LIMIT 50`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      items: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('❌ خطأ في البحث عن الأصناف:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في البحث عن الأصناف',
      error: error.message 
    });
  }
});

export default router;