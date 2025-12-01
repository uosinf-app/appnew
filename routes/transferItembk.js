// transferItembk.js - مع الحلول الأمنية
import express from 'express';
import db from '../db.js';

const router = express.Router();

// 🔍 البحث عن أصناف المخزن للتحويل
router.get("/store-items/:storeId", async (req, res) => {
  try {
    const { storeId } = req.params;
    const { q } = req.query;

    console.log('🔍 بحث عن أصناف المخزن للتحويل:', { storeId, q });

    let query = `
      SELECT 
        item_id,
        item_nm,
        item_qty,
        batch_no,
        expiry_date,
        unit_type,
        units_per_package,
        buy_price,
        sale_price1,
        sale_price2,
        sale_price3,
        rate
      FROM a_master 
      WHERE store_id = $1 
      AND item_qty > 0
    `;
    
    let params = [storeId];

    if (q) {
      query += ` AND (item_id::text LIKE $2 OR item_nm ILIKE $2)`;
      params.push(`%${q}%`);
    }

    query += ` ORDER BY item_nm LIMIT 20`;

    const result = await db.query(query, params);
    
    res.json({ 
      success: true, 
      items: result.rows 
    });

  } catch (error) {
    console.error('❌ خطأ في البحث عن الأصناف للتحويل:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في البحث عن الأصناف',
      error: error.message 
    });
  }
});

// 🔍 التحقق من وجود المخزن الهدف في a_master
router.get("/check-target-store/:storeId", async (req, res) => {
  try {
    const { storeId } = req.params;

    console.log('🔍 التحقق من وجود المخزن الهدف:', storeId);

    const result = await db.query(`
      SELECT EXISTS(
        SELECT 1 FROM a_master WHERE store_id = $1 LIMIT 1
      ) as store_exists
    `, [storeId]);

    const storeExists = result.rows[0].store_exists;

    res.json({ 
      success: true, 
      store_exists: storeExists,
      message: storeExists ? 'المخزن الهدف موجود' : 'المخزن الهدف غير موجود في النظام'
    });

  } catch (error) {
    console.error('❌ خطأ في التحقق من المخزن:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في التحقق من المخزن',
      error: error.message 
    });
  }
});

// ✅ معالجة تحويل المخزون مع التحذير
router.post("/process-transfer", async (req, res) => {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      transfer_date,
      from_store,
      to_store,
      transfer_lines,
      user_id,
      remarks
    } = req.body;

    console.log('🔄 معالجة تحويل المخزون:', { 
      from_store, 
      to_store,
      items_count: transfer_lines.length 
    });

    // التحقق من وجود المخزن الهدف في a_master
    const storeCheck = await client.query(`
      SELECT EXISTS(SELECT 1 FROM a_master WHERE store_id = $1 LIMIT 1) as store_exists
    `, [to_store]);

    if (!storeCheck.rows[0].store_exists) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        message: 'المخزن الهدف غير موجود في النظام'
      });
    }

    // التحقق من وجود الأصناف في المخزن المصدر
    for (const line of transfer_lines) {
      const itemCheck = await client.query(
        `SELECT item_qty, buy_price, sale_price1, sale_price2, sale_price3, rate, item_nm, unit_type, units_per_package
         FROM a_master WHERE store_id = $1 AND item_id = $2`,
        [from_store, line.item_id]
      );

      if (itemCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({
          success: false,
          message: `الصنف ${line.item_id} غير موجود في المخزن المصدر`
        });
      }

      const availableQty = parseFloat(itemCheck.rows[0].item_qty);
      if (availableQty < line.transfer_qty) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({
          success: false,
          message: `الكمية غير كافية للصنف ${line.item_id} - المتاح: ${availableQty}`
        });
      }

      // تخزين أسعار الصنف من المخزن المصدر
      const sourceItem = itemCheck.rows[0];
      line.buy_price = sourceItem.buy_price;
      line.sale_price1 = sourceItem.sale_price1;
      line.sale_price2 = sourceItem.sale_price2;
      line.sale_price3 = sourceItem.sale_price3;
      line.rate = sourceItem.rate;
      line.item_nm = sourceItem.item_nm;
      line.unit_type = sourceItem.unit_type;
      line.units_per_package = sourceItem.units_per_package;
    }

    // إنشاء رقم تحويل جديد
    const transferNoResult = await client.query(`
      SELECT COALESCE(MAX(ser_no), 0) + 1 as next_transfer_no 
      FROM transfer_stores
    `);
    const transfer_no = transferNoResult.rows[0].next_transfer_no;

    // إدخال سجلات التحويل مع تاريخ الانتهاء (3 أيام)
    for (const line of transfer_lines) {
      await client.query(`
        INSERT INTO transfer_stores (
          tran_date, from_store, to_store, item_id, qty,
          batch_no, expiry_date, unit_type, units_per_package,
          buy_price, sale_price1, sale_price2, sale_price3, rate,
          user_id, remarks, ser_no, status, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW() + INTERVAL '3 days')
      `, [
        transfer_date, from_store, to_store, line.item_id, line.transfer_qty,
        line.batch_no || null, line.expiry_date || null, line.unit_type || 'piece', 
        line.units_per_package || 1,
        line.buy_price, line.sale_price1, line.sale_price2, line.sale_price3, line.rate,
        user_id, remarks, transfer_no, 'pending'
      ]);

      // ✅ الخصم الفوري من المخزن المصدر
      await client.query(`
        UPDATE a_master 
        SET item_qty = item_qty - $1,
            last_out_date = $2
        WHERE store_id = $3 AND item_id = $4
      `, [line.transfer_qty, transfer_date, from_store, line.item_id]);

      // تحديث القيم المالية
      await client.query(`
        UPDATE a_master 
        SET total_price = item_qty * COALESCE(sale_price1, 0),
            total_net_buy_price = item_qty * COALESCE(buy_price, 0)
        WHERE store_id = $1 AND item_id = $2
      `, [from_store, line.item_id]);
    }

    await client.query('COMMIT');
    client.release();

    console.log('✅ تم إنشاء التحويل بنجاح (معلق 3 أيام):', transfer_no);

    res.json({
      success: true,
      transfer_no: transfer_no,
      message: 'تم معالجة التحويل بنجاح - الكميات مجمدة لمدة 3 أيام بانتظار القبول',
      status: 'pending',
      from_store: from_store,
      to_store: to_store,
      items_count: transfer_lines.length,
      expires_in: '3 أيام'
    });

  } catch (error) {
    console.error('❌ خطأ في معالجة التحويل:', error);
    
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في معالجة التحويل',
      error: error.message
    });
  }
});

// ✅ قبول التحويل مع التحقق من توفر الكميات
router.post("/approve-transfer/:transferNo", async (req, res) => {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    const { transferNo } = req.params;
    const { approved_by } = req.body;

    console.log('✅ محاولة قبول التحويل:', { transferNo, approved_by });

    // جلب بيانات التحويل
    const transferData = await client.query(`
      SELECT * FROM transfer_stores 
      WHERE ser_no = $1 AND status = 'pending'
    `, [transferNo]);

    if (transferData.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على التحويل أو تمت معالجته مسبقاً'
      });
    }

    // 🔍 التحقق الحاسم: هل الكميات لا تزال متاحة في المخزن المصدر؟
    const availabilityIssues = [];
    
    for (const transfer of transferData.rows) {
      const sourceCheck = await client.query(`
        SELECT item_qty, item_nm FROM a_master 
        WHERE store_id = $1 AND item_id = $2
      `, [transfer.from_store, transfer.item_id]);

      if (sourceCheck.rows.length === 0) {
        availabilityIssues.push({
          item_id: transfer.item_id,
          issue: 'لم يعد الصنف موجوداً في المخزن المصدر',
          available: 0,
          required: transfer.qty
        });
        continue;
      }

      const currentQty = parseFloat(sourceCheck.rows[0].item_qty);
      const item_nm = sourceCheck.rows[0].item_nm;
      
      // ⚠️ التحقق من أن الكمية لا تزال كافية
      if (currentQty < transfer.qty) {
        const shortage = transfer.qty - currentQty;
        availabilityIssues.push({
          item_id: transfer.item_id,
          item_nm: item_nm,
          issue: 'الكمية غير كافية',
          available: currentQty,
          required: transfer.qty,
          shortage: shortage
        });
      }
    }

    // إذا كانت هناك مشاكل في التوفر
    if (availabilityIssues.length > 0) {
      await client.query('ROLLBACK');
      client.release();
      
      const issuesText = availabilityIssues.map(issue => 
        `- ${issue.item_id} (${issue.item_nm}): ${issue.issue} - المتاح: ${issue.available} - المطلوب: ${issue.required}`
      ).join('\n');
      
      return res.status(400).json({
        success: false,
        message: 'لا يمكن قبول التحويل بسبب عدم توفر الكميات في المخزن المصدر',
        issues: availabilityIssues,
        issues_text: issuesText
      });
    }

    // ✅ كل شيء جيد - المتابعة في القبول
    // تحديث حالة التحويل
    await client.query(`
      UPDATE transfer_stores 
      SET status = 'completed', approved_by = $1, approved_date = NOW()
      WHERE ser_no = $2
    `, [approved_by, transferNo]);

    // معالجة كل صنف في التحويل
    for (const transfer of transferData.rows) {
      // التحقق من وجود الصنف في المخزن الهدف
      const targetCheck = await client.query(`
        SELECT item_id, item_qty, buy_price, total_price, total_net_buy_price 
        FROM a_master WHERE store_id = $1 AND item_id = $2
      `, [transfer.to_store, transfer.item_id]);

      if (targetCheck.rows.length > 0) {
        // تحديث الصنف الموجود مع الحقول المالية
        const existingItem = targetCheck.rows[0];
        const newQty = parseFloat(existingItem.item_qty) + parseFloat(transfer.qty);
        const newTotalPrice = parseFloat(existingItem.total_price) + (transfer.qty * transfer.sale_price1);
        const newTotalNetBuyPrice = parseFloat(existingItem.total_net_buy_price) + (transfer.qty * transfer.buy_price);
        
        // حساب متوسط سعر الشراء الجديد
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
          transfer.sale_price1, 
          transfer.sale_price2, 
          transfer.sale_price3,
          newTotalPrice,
          newTotalNetBuyPrice,
          newBuyPrice,
          transfer.to_store, 
          transfer.item_id
        ]);
      } else {
        // إضافة صنف جديد مع جميع الحقول المالية
        const totalPrice = transfer.qty * transfer.sale_price1;
        const totalNetBuyPrice = transfer.qty * transfer.buy_price;

        await client.query(`
          INSERT INTO a_master (
            tran_date, store_id, item_id, item_nm, item_qty,
            buy_price, sale_price1, sale_price2, sale_price3,
            total_price, total_net_buy_price, net_buy_price,
            unit_type, units_per_package, batch_no, expiry_date,
            user_id, rate, last_in_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
        `, [
          new Date(), 
          transfer.to_store, 
          transfer.item_id, 
          transfer.item_nm, 
          transfer.qty,
          transfer.buy_price, 
          transfer.sale_price1, 
          transfer.sale_price2, 
          transfer.sale_price3,
          totalPrice,
          totalNetBuyPrice,
          transfer.buy_price,
          transfer.unit_type, 
          transfer.units_per_package,
          transfer.batch_no, 
          transfer.expiry_date,
          approved_by, 
          transfer.buy_price
        ]);
      }

      console.log(`✅ تم قبول تحويل الصنف ${transfer.item_id} إلى المخزن ${transfer.to_store}`);
    }

    await client.query('COMMIT');
    client.release();

    console.log('✅ تم قبول التحويل بنجاح:', transferNo);

    res.json({
      success: true,
      transfer_no: transferNo,
      message: 'تم قبول التحويل وتحديث المخزون بنجاح',
      status: 'completed',
      items_count: transferData.rows.length
    });

  } catch (error) {
    console.error('❌ خطأ في قبول التحويل:', error);
    
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في قبول التحويل',
      error: error.message
    });
  }
});

// ❌ رفض التحويل وإعادة الكميات للمخزن المصدر
router.post("/reject-transfer/:transferNo", async (req, res) => {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    const { transferNo } = req.params;
    const { rejected_by, reason } = req.body;

    console.log('❌ رفض التحويل:', { transferNo, rejected_by, reason });

    // جلب بيانات التحويل
    const transferData = await client.query(`
      SELECT * FROM transfer_stores 
      WHERE ser_no = $1 AND status = 'pending'
    `, [transferNo]);

    if (transferData.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على التحويل أو تمت معالجته مسبقاً'
      });
    }

    // تحديث حالة التحويل
    await client.query(`
      UPDATE transfer_stores 
      SET status = 'rejected', approved_by = $1, remarks = CONCAT(COALESCE(remarks, ''), ' - سبب الرفض: ', $2)
      WHERE ser_no = $3
    `, [rejected_by, reason, transferNo]);

    // إعادة الكميات إلى المخزن المصدر (فقط إذا كان الصنف لا يزال موجوداً)
    for (const transfer of transferData.rows) {
      const sourceCheck = await client.query(`
        SELECT item_id FROM a_master WHERE store_id = $1 AND item_id = $2
      `, [transfer.from_store, transfer.item_id]);

      if (sourceCheck.rows.length > 0) {
        await client.query(`
          UPDATE a_master 
          SET item_qty = item_qty + $1,
              total_price = (item_qty + $1) * sale_price1,
              total_net_buy_price = (item_qty + $1) * buy_price
          WHERE store_id = $2 AND item_id = $3
        `, [transfer.qty, transfer.from_store, transfer.item_id]);

        console.log(`✅ تم إعادة الصنف ${transfer.item_id} إلى المخزن المصدر`);
      } else {
        console.log(`⚠️ لم يتم إعادة الصنف ${transfer.item_id} - لم يعد موجوداً في المخزن المصدر`);
      }
    }

    await client.query('COMMIT');
    client.release();

    console.log('✅ تم رفض التحويل:', transferNo);

    res.json({
      success: true,
      transfer_no: transferNo,
      message: 'تم رفض التحويل بنجاح',
      status: 'rejected',
      items_count: transferData.rows.length
    });

  } catch (error) {
    console.error('❌ خطأ في رفض التحويل:', error);
    
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في رفض التحويل',
      error: error.message
    });
  }
});

// 🔄 API للإرجاع التلقائي للتحويلات المنتهية
router.post("/auto-return-expired", async (req, res) => {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');

    console.log('🔄 فحص التحويلات المعلقة المنتهية (3 أيام)...');

    // التحويلات المعلقة لأكثر من 3 أيام
    const expiredTransfers = await client.query(`
      SELECT DISTINCT ser_no 
      FROM transfer_stores 
      WHERE status = 'pending' 
      AND expires_at < NOW()
    `);

    let returnedCount = 0;
    let skippedCount = 0;

    for (const row of expiredTransfers.rows) {
      const transferNo = row.ser_no;
      
      // جلب بيانات التحويل
      const transferData = await client.query(`
        SELECT * FROM transfer_stores 
        WHERE ser_no = $1 AND status = 'pending'
      `, [transferNo]);

      let itemsReturned = 0;
      let itemsSkipped = 0;

      // إعادة الكميات إلى المخزن المصدر
      for (const transfer of transferData.rows) {
        const sourceCheck = await client.query(`
          SELECT item_id FROM a_master WHERE store_id = $1 AND item_id = $2
        `, [transfer.from_store, transfer.item_id]);

        if (sourceCheck.rows.length > 0) {
          // الصنف لا يزال موجوداً - إعادة الكمية
          await client.query(`
            UPDATE a_master 
            SET item_qty = item_qty + $1,
                total_price = (item_qty + $1) * sale_price1,
                total_net_buy_price = (item_qty + $1) * buy_price
            WHERE store_id = $2 AND item_id = $3
          `, [transfer.qty, transfer.from_store, transfer.item_id]);
          itemsReturned++;
          console.log(`✅ تم إعادة الصنف ${transfer.item_id} تلقائياً`);
        } else {
          // الصنف لم يعد موجوداً (تم بيعه) - تخطي
          itemsSkipped++;
          console.log(`⚠️ لم يتم إعادة الصنف ${transfer.item_id} - تم بيعه`);
        }
      }

      // تحديث حالة التحويل
      await client.query(`
        UPDATE transfer_stores 
        SET status = 'auto_returned', 
            remarks = CONCAT(COALESCE(remarks, ''), ' - تم الإرجاع تلقائياً بعد 3 أيام - تم إعادة: ', $2, ' - تم تخطي: ', $3)
        WHERE ser_no = $1
      `, [transferNo, itemsReturned, itemsSkipped]);

      returnedCount++;
      console.log(`✅ تم إرجاع التحويل ${transferNo} تلقائياً`);
    }

    await client.query('COMMIT');
    client.release();

    console.log('✅ تم الانتهاء من الفحص التلقائي');

    res.json({
      success: true,
      message: `تم فحص التحويلات المنتهية - ${returnedCount} تحويل تم معالجته`,
      returned_transfers: returnedCount
    });

  } catch (error) {
    console.error('❌ خطأ في الإرجاع التلقائي:', error);
    
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في الإرجاع التلقائي',
      error: error.message
    });
  }
});

// 📊 جلب التحويلات الواردة لمخزن معين
router.get("/incoming-transfers/:storeId", async (req, res) => {
  try {
    const { storeId } = req.params;
    const { status = 'pending' } = req.query;

    const result = await db.query(`
      SELECT 
        ts.ser_no as transfer_no,
        ts.tran_date,
        ts.from_store,
        ts.to_store,
        ts.item_id,
        ts.qty,
        ts.batch_no,
        ts.expiry_date,
        ts.buy_price,
        ts.sale_price1,
        ts.sale_price2,
        ts.sale_price3,
        ts.rate,
        ts.status,
        ts.remarks,
        ts.expires_at,
        s1.store_name as from_store_name,
        s2.store_name as to_store_name,
        i.item_nm,
        u.username
      FROM transfer_stores ts
      JOIN stores s1 ON ts.from_store = s1.store_id
      JOIN stores s2 ON ts.to_store = s2.store_id
      JOIN items i ON ts.item_id = i.item_id
      LEFT JOIN users u ON ts.user_id = u.user_id
      WHERE ts.to_store = $1 AND ts.status = $2
      ORDER BY ts.tran_date DESC, ts.ser_no DESC
    `, [storeId, status]);
    
    res.json({
      success: true,
      transfers: result.rows,
      total_count: result.rows.length
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
// 📦 جلب كل المخازن
router.get('/stores', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM stores ORDER BY store_name');
    res.json(result.rows);
  } catch (error) {
    console.error('❌ خطأ في جلب المخازن:', error);
    res.status(500).json({ error: 'خطأ في جلب المخازن' });
  }
});

// GET /api/transfer-report?from=YYYY-MM-DD&to=YYYY-MM-DD&from_store=ID&to_store=ID&status=all&q=...
router.get("/transfer-report", async (req, res) => {
  try {
    const { from, to, from_store = 0, to_store = 0, status = 'all', q = '' } = req.query;

    // فحص التواريخ
    if (!from || !to) {
      return res.status(400).json({ success: false, message: 'يرجى تحديد من وتاريخ إلى' });
    }

    // بناء WHERE بشكل آمن مع باراميترات
    const params = [from + ' 00:00:00', to + ' 23:59:59'];
    let idx = 3;
    let where = `WHERE ts.tran_date BETWEEN $1::timestamp AND $2::timestamp`;

    if (from_store && Number(from_store) !== 0) {
      where += ` AND ts.from_store = $${idx++}`;
      params.push(Number(from_store));
    }
    if (to_store && Number(to_store) !== 0) {
      where += ` AND ts.to_store = $${idx++}`;
      params.push(Number(to_store));
    }
    if (status && status !== 'all') {
      where += ` AND ts.status = $${idx++}`;
      params.push(status);
    }
    if (q && q.trim() !== '') {
      where += ` AND (CAST(ts.ser_no AS text) ILIKE $${idx} OR ts.item_id::text ILIKE $${idx} OR ts.remarks ILIKE $${idx} OR i.item_nm ILIKE $${idx})`;
      params.push(`%${q}%`);
      idx++;
    }
    
    const sql = `
      SELECT 
        ts.ser_no,
        ts.tran_date,
        ts.from_store,
        s1.store_name as from_store_name,
        ts.to_store,
        s2.store_name as to_store_name,
        ts.item_id,
        COALESCE(i.item_nm, '') as item_nm,
        ts.qty,
        ts.batch_no,
        ts.expiry_date,
        ts.status,
        ts.remarks
      FROM transfer_stores ts
      LEFT JOIN stores s1 ON ts.from_store = s1.store_id
      LEFT JOIN stores s2 ON ts.to_store = s2.store_id
      LEFT JOIN items i ON ts.item_id = i.item_id
      ${where}
      ORDER BY ts.tran_date DESC, ts.ser_no DESC
      LIMIT 1000
    `;

    const result = await db.query(sql, params);
    return res.json({ success: true, transfers: result.rows, total_count: result.rowCount });
  } catch (error) {
    console.error('Error in /transfer-report', error);
    return res.status(500).json({ success: false, message: 'خطأ داخلي في الخادم', error: error.message });
  }
});


export { router };
export default router;