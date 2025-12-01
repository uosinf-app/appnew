// routes/userbk.js
import express from "express";
import pool from "../db.js";

const router = express.Router();

// عرض جميع المستخدمين مع اسم الفرع
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.*, s.store_name 
      FROM public.users u
      LEFT JOIN public.stores s ON s.store_id = u.store_id
      ORDER BY u.user_id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("حدث خطأ أثناء جلب المستخدمين.");
  }
});

// جلب مستخدم محدد
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM public.users WHERE user_id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("خطأ أثناء جلب المستخدم.");
  }
});

// إضافة مستخدم
router.post("/", async (req, res) => {
  const { username, password, full_name, role, store_id, active } = req.body;
  try {
    await pool.query(
      `INSERT INTO public.users (username, password, full_name, role, store_id, active)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [username, password, full_name, role, store_id, active]
    );
    res.send("✅ تم إضافة المستخدم بنجاح.");
  } catch (err) {
    console.error(err);
    res.status(500).send("خطأ أثناء الإضافة.");
  }
});

// تعديل مستخدم
router.put("/:id", async (req, res) => {
  const { username, password, full_name, role, store_id, active } = req.body;
  try {
    await pool.query(
      `UPDATE public.users
       SET username=$1, password=$2, full_name=$3, role=$4, store_id=$5, active=$6
       WHERE user_id=$7`,
      [username, password, full_name, role, store_id, active, req.params.id]
    );
    res.send("✏️ تم تعديل المستخدم بنجاح.");
  } catch (err) {
    console.error(err);
    res.status(500).send("خطأ أثناء التعديل.");
  }
});

// حذف مستخدم
router.delete("/:id", async (req, res) => {
  try {
    await pool.query(`DELETE FROM public.users WHERE user_id=$1`, [req.params.id]);
    res.send("🗑️ تم حذف المستخدم.");
  } catch (err) {
    console.error(err);
    res.status(500).send("خطأ أثناء الحذف.");
  }
});

export default router;
