import express from "express";
import pool from "../db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🟢 عرض جميع الصلاحيات
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, u.username 
      FROM public.privileges p
      LEFT JOIN public.users u ON u.user_id = p.user_id
      ORDER BY p.priv_id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ خطأ في جلب الصلاحيات.");
  }
});

// 🟢 جلب صلاحية واحدة
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM public.privileges WHERE priv_id=$1`, [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).send("❌ خطأ في جلب الصلاحية.");
  }
});

// 🟢 إضافة
router.post("/", async (req, res) => {
  const { user_id, priv_name, description, can_view, can_add, can_edit, can_delete } = req.body;
  try {
    await pool.query(
      `INSERT INTO public.privileges (user_id, priv_name, description, can_view, can_add, can_edit, can_delete)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [user_id, priv_name, description, can_view, can_add, can_edit, can_delete]
    );
    res.send("✅ تم حفظ الصلاحية بنجاح.");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ خطأ أثناء الإضافة.");
  }
});

// 🟢 تعديل
router.put("/:id", async (req, res) => {
  const { priv_name, description, can_view, can_add, can_edit, can_delete } = req.body;
  try {
    await pool.query(
      `UPDATE public.privileges
       SET priv_name=$1, description=$2, can_view=$3, can_add=$4, can_edit=$5, can_delete=$6
       WHERE priv_id=$7`,
      [priv_name, description, can_view, can_add, can_edit, can_delete, req.params.id]
    );
    res.send("✏️ تم تعديل الصلاحية بنجاح.");
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ خطأ أثناء التعديل.");
  }
});

// 🟢 حذف
router.delete("/:id", async (req, res) => {
  try {
    await pool.query(`DELETE FROM public.privileges WHERE priv_id=$1`, [req.params.id]);
    res.send("🗑️ تم حذف الصلاحية.");
  } catch (err) {
    res.status(500).send("❌ خطأ أثناء الحذف.");
  }
});

// 🧩 مزامنة كاملة مع main.html
router.post("/sync", async (req, res) => {
  try {
    const mainPath = path.join(__dirname, "../public/main.html");
    const html = fs.readFileSync(mainPath, "utf-8");

    const names = [...html.matchAll(/<a[^>]*>(.*?)<\/a>/g)]
      .map(m => m[1].trim())
      .filter(n => n && !n.startsWith("<"));

    const existingRows = await pool.query("SELECT priv_name FROM public.privileges");
    const existing = existingRows.rows.map(r => r.priv_name);

    const newOnes = names.filter(n => !existing.includes(n));
    const toDelete = existing.filter(n => !names.includes(n));

    // إدخال الجديدة
    for (const name of newOnes) {
      await pool.query(
        `INSERT INTO public.privileges (priv_name, description, can_view, can_add, can_edit, can_delete)
         VALUES ($1,$2,false,false,false,false)`,
        [name, "أضيفت تلقائيًا من main.html"]
      );
    }

    // حذف القديمة
    for (const name of toDelete) {
      await pool.query("DELETE FROM public.privileges WHERE priv_name=$1", [name]);
    }

    res.send(`✅ تمت المزامنة: ${newOnes.length} إضافة، ${toDelete.length} حذف.`);
  } catch (err) {
    console.error("❌ خطأ أثناء المزامنة:", err);
    res.status(500).send("❌ فشل أثناء المزامنة.");
  }
});

// ✅ جلب صلاحيات مستخدم لشاشة معينة
router.get("/user/:user_id/:screen_name", async (req, res) => {
  try {
    const { user_id, screen_name } = req.params;
    const result = await pool.query(
      `SELECT can_view, can_add, can_edit, can_delete
       FROM public.privileges
       WHERE user_id = $1 AND priv_name = $2`,
      [user_id, screen_name]
    );
    if (result.rows.length === 0) {
      return res.json({ can_view: false, can_add: false, can_edit: false, can_delete: false });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error fetching user privileges:", err);
    res.status(500).send("Server error");
  }
});


export default router;
