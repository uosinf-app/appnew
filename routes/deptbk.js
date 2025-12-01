// deptbk.js
import express from "express";
import pool from "../db.js";

const router = express.Router();

// ======================== 📋 جلب جميع الإدارات ========================
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, CONCAT(e.first_name, ' ', e.last_name) AS manager_name
      FROM departments d
      LEFT JOIN employees e ON d.manager_id = e.emp_id
      ORDER BY d.department_id;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching departments:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ======================== ➕ إضافة إدارة جديدة ========================
router.post("/", async (req, res) => {
  const { department_name, manager_id, location } = req.body;
  try {
    await pool.query(
      `INSERT INTO departments (department_name, manager_id, location)
       VALUES ($1, $2, $3)`,
      [department_name, manager_id || null, location || null]
    );
    res.json({ message: "✅ تم حفظ الإدارة بنجاح" });
  } catch (err) {
    console.error("❌ Error inserting department:", err);
    res.status(500).json({ error: "Database insert error" });
  }
});

// ======================== 🗑️ حذف إدارة ========================
router.delete("/:id", async (req, res) => {
  try {
    await pool.query(`DELETE FROM departments WHERE department_id = $1`, [req.params.id]);
    res.json({ message: "🗑️ تم حذف الإدارة" });
  } catch (err) {
    console.error("❌ Error deleting department:", err);
    res.status(500).json({ error: "Database delete error" });
  }
});

// ======================== 👨‍💼 جلب الموظفين للمدير ========================
router.get("/employees", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT emp_id, first_name, last_name
      FROM employees
      ORDER BY first_name;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching employees:", err);
    res.status(500).json({ error: "Database error" });
  }
});

export default router;
