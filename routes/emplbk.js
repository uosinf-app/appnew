// emplbk.js
import express from "express";
import pool from "../db.js";

const router = express.Router();

// ======================== 🧩 عرض كل الموظفين ========================
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, d.department_name 
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.department_id
      ORDER BY e.emp_id;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching employees:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ======================== ➕ إضافة موظف ========================
router.post("/", async (req, res) => {
  const { first_name, last_name, job_title, department_id, salary, hire_date } = req.body;
  try {
    await pool.query(
      `INSERT INTO employees (first_name, last_name, job_title, department_id, salary, hire_date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [first_name, last_name, job_title, department_id || null, salary || 0, hire_date]
    );
    res.json({ message: "✅ تم حفظ الموظف بنجاح" });
  } catch (err) {
    console.error("❌ Error inserting employee:", err);
    res.status(500).json({ error: "Database insert error" });
  }
});

// ======================== 🗑️ حذف موظف ========================
router.delete("/:id", async (req, res) => {
  try {
    await pool.query(`DELETE FROM employees WHERE emp_id = $1`, [req.params.id]);
    res.json({ message: "🗑️ تم حذف الموظف" });
  } catch (err) {
    console.error("❌ Error deleting employee:", err);
    res.status(500).json({ error: "Database delete error" });
  }
});

// ======================== 🏢 جلب الإدارات ========================
router.get("/departments", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM departments ORDER BY department_name`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching departments:", err);
    res.status(500).json({ error: "Database error" });
  }
});

export default router;
