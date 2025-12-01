// accountbk.js - Backend for Accounts Management
import express from "express";
import pool from "../db.js";

const router = express.Router();

// ======================== 🔍 الحصول على جميع الحسابات ========================
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.*,
        at.account_type_name,
        parent.account_name as parent_account_name
      FROM accounts a
      LEFT JOIN account_types at ON a.account_type_id = at.account_type_id
      LEFT JOIN accounts parent ON a.parent_account_id = parent.account_id
      ORDER BY a.account_code
    `);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب الحسابات"
    });
  }
});

// ======================== 🔍 بحث في الموردين والعملاء ========================
router.get("/suppliers-customers", async (req, res) => {
  try {
    const { search } = req.query;
    
    // استعلام الموردين
    let suppliersQuery = `
      SELECT 
        supplierid as id,
        supplierid::text as code,
        supplier_name as name,
        'supplier' as type
      FROM suppliers 
      WHERE 1=1
    `;
    
    // استعلام العملاء
    let customersQuery = `
      SELECT 
        customer_id as id,
        customer_id::text as code,
        customer_name as name,
        'customer' as type
      FROM customers 
      WHERE 1=1
    `;
    
    let suppliersParams = [];
    let customersParams = [];
    
    // إذا كان هناك بحث، أضف شرط WHERE
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      suppliersQuery += ` AND (supplierid::text ILIKE $1 OR supplier_name ILIKE $2)`;
      customersQuery += ` AND (customer_id::text ILIKE $1 OR customer_name ILIKE $2)`;
      suppliersParams = [searchTerm, searchTerm];
      customersParams = [searchTerm, searchTerm];
    }
    
    console.log('Suppliers Query:', suppliersQuery);
    console.log('Customers Query:', customersQuery);
    console.log('Suppliers Params:', suppliersParams);
    console.log('Customers Params:', customersParams);
    
    // تنفيذ الاستعلامات بالتوازي
    const [suppliers, customers] = await Promise.all([
      new Promise((resolve, reject) => {
        pool.query(suppliersQuery, suppliersParams, (err, results) => {
          if (err) {
            console.error('Error in suppliers query:', err);
            reject(err);
          } else {
            console.log('Suppliers results:', results.rows);
            resolve(results.rows);
          }
        });
      }),
      new Promise((resolve, reject) => {
        pool.query(customersQuery, customersParams, (err, results) => {
          if (err) {
            console.error('Error in customers query:', err);
            reject(err);
          } else {
            console.log('Customers results:', results.rows);
            resolve(results.rows);
          }
        });
      })
    ]);
    
    // دمج النتائج وترتيبها
    const combinedResults = [...suppliers, ...customers]
      .sort((a, b) => {
        const codeA = a.code.toString();
        const codeB = b.code.toString();
        return codeA.localeCompare(codeB);
      });
    
    res.json({
      success: true,
      data: combinedResults
    });
    
  } catch (error) {
    console.error('Error fetching suppliers and customers:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب البيانات'
    });
  }
});

// ======================== 🔍 الحصول على الحسابات الرئيسية ========================
router.get("/parents/main", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT account_id, account_code, account_name 
      FROM accounts 
      WHERE parent_account_id IS NULL 
      ORDER BY account_code
    `);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Error fetching parent accounts:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب الحسابات الرئيسية"
    });
  }
});

// ======================== 🔍 الحصول على الحسابات الفرعية ========================
router.get("/parents/children/:parentId", async (req, res) => {
  try {
    const { parentId } = req.params;
    
    if (isNaN(parentId) || !Number.isInteger(parseFloat(parentId))) {
      return res.status(400).json({
        success: false,
        message: "معرف الحساب الرئيسي غير صحيح"
      });
    }

    const result = await pool.query(`
      SELECT account_id, account_code, account_name 
      FROM accounts 
      WHERE parent_account_id = $1 
      ORDER BY account_code
    `, [parentId]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Error fetching child accounts:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب الحسابات الفرعية"
    });
  }
});

// ======================== 🔍 الحصول على حساب بواسطة ID ========================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (isNaN(id) || !Number.isInteger(parseFloat(id))) {
      return res.status(400).json({
        success: false,
        message: "معرف الحساب غير صحيح"
      });
    }

    const result = await pool.query(`
      SELECT 
        a.*,
        at.account_type_name,
        parent.account_name as parent_account_name
      FROM accounts a
      LEFT JOIN account_types at ON a.account_type_id = at.account_type_id
      LEFT JOIN accounts parent ON a.parent_account_id = parent.account_id
      WHERE a.account_id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "الحساب غير موجود"
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error fetching account:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في جلب الحساب"
    });
  }
});

// ======================== ➕ إضافة حساب جديد ========================
router.post("/", async (req, res) => {
  try {
    const { 
      account_code, 
      account_name, 
      account_type_id, 
      parent_account_id,
      balance,
      is_active 
    } = req.body;

    if (!account_code || !account_name || !account_type_id) {
      return res.status(400).json({
        success: false,
        message: "الكود واسم الحساب ونوع الحساب مطلوبة"
      });
    }

    const checkCode = await pool.query(
      "SELECT account_id FROM accounts WHERE account_code = $1",
      [account_code]
    );

    if (checkCode.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "كود الحساب موجود مسبقاً"
      });
    }

    const result = await pool.query(
      `INSERT INTO accounts 
       (account_code, account_name, account_type_id, parent_account_id, balance, is_active) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [
        account_code, 
        account_name, 
        account_type_id, 
        parent_account_id, 
        balance || 0, 
        is_active !== false
      ]
    );

    res.json({
      success: true,
      message: "تم إضافة الحساب بنجاح",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error adding account:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في إضافة الحساب"
    });
  }
});

// ======================== ✏️ تعديل حساب ========================
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (isNaN(id) || !Number.isInteger(parseFloat(id))) {
      return res.status(400).json({
        success: false,
        message: "معرف الحساب غير صحيح"
      });
    }

    const { 
      account_code, 
      account_name, 
      account_type_id, 
      parent_account_id,
      balance,
      is_active 
    } = req.body;

    if (!account_code || !account_name || !account_type_id) {
      return res.status(400).json({
        success: false,
        message: "الكود واسم الحساب ونوع الحساب مطلوبة"
      });
    }

    const checkCode = await pool.query(
      "SELECT account_id FROM accounts WHERE account_code = $1 AND account_id != $2",
      [account_code, id]
    );

    if (checkCode.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "كود الحساب موجود مسبقاً"
      });
    }

    const result = await pool.query(
      `UPDATE accounts 
       SET account_code = $1, account_name = $2, account_type_id = $3, 
           parent_account_id = $4, balance = $5, is_active = $6
       WHERE account_id = $7 
       RETURNING *`,
      [
        account_code, 
        account_name, 
        account_type_id, 
        parent_account_id, 
        balance || 0, 
        is_active !== false, 
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "الحساب غير موجود"
      });
    }

    res.json({
      success: true,
      message: "تم تعديل الحساب بنجاح",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error updating account:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في تعديل الحساب"
    });
  }
});

// ======================== 🗑️ حذف حساب ========================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (isNaN(id) || !Number.isInteger(parseFloat(id))) {
      return res.status(400).json({
        success: false,
        message: "معرف الحساب غير صحيح"
      });
    }

    const checkChildren = await pool.query(
      "SELECT COUNT(*) FROM accounts WHERE parent_account_id = $1",
      [id]
    );

    const childrenCount = parseInt(checkChildren.rows[0].count);
    if (childrenCount > 0) {
      return res.status(400).json({
        success: false,
        message: "لا يمكن حذف الحساب لأنه يحتوي على حسابات فرعية"
      });
    }

    const checkTransactions = await pool.query(
      "SELECT COUNT(*) FROM account_transactions WHERE account_id = $1",
      [id]
    );

    const transactionsCount = parseInt(checkTransactions.rows[0].count);
    if (transactionsCount > 0) {
      return res.status(400).json({
        success: false,
        message: "لا يمكن حذف الحساب لأنه مرتبط بحركات مالية"
      });
    }

    const result = await pool.query(
      "DELETE FROM accounts WHERE account_id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "الحساب غير موجود"
      });
    }

    res.json({
      success: true,
      message: "تم حذف الحساب بنجاح"
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({
      success: false,
      message: "خطأ في حذف الحساب"
    });
  }
});

export default router;