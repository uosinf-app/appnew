// payrollbk.js
import express from "express";
import pool from "../db.js";

const router = express.Router();

// ======================== 💵 عرض جميع الرواتب ========================
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, CONCAT(e.first_name, ' ', e.last_name) AS emp_name
      FROM payroll p
      JOIN employees e ON p.emp_id = e.emp_id
      ORDER BY p.pay_month DESC, p.payroll_id;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching payrolls:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ======================== ➕ إضافة راتب ========================
router.post("/", async (req, res) => {
  const { emp_id, pay_month, base_salary, allowance, deductions, payment_method } = req.body;

  try {
    await pool.query(`
      INSERT INTO payroll (emp_id, pay_month, base_salary, allowance, deductions, payment_method)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [emp_id, pay_month, base_salary, allowance, deductions, payment_method]);

    res.json({ message: "✅ تم حفظ بيانات الراتب بنجاح" });
  } catch (err) {
    console.error("❌ Error inserting payroll:", err);
    res.status(500).json({ error: "Database insert error" });
  }
});

// ======================== 🗑️ حذف سجل راتب ========================
router.delete("/:id", async (req, res) => {
  try {
    await pool.query(`DELETE FROM payroll WHERE payroll_id = $1`, [req.params.id]);
    res.json({ message: "🗑️ تم حذف سجل الراتب" });
  } catch (err) {
    console.error("❌ Error deleting payroll:", err);
    res.status(500).json({ error: "Database delete error" });
  }
});

// ======================== 👨‍💼 جلب الموظفين ========================
router.get("/employees", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT emp_id, first_name, last_name FROM employees ORDER BY first_name;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching employees:", err);
    res.status(500).json({ error: "Database error" });
  }
});

export default router;
