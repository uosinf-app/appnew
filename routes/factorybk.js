// 📁 routes/factorybk.js
import express from "express";
import pool from "../db.js";
import multer from "multer";
import csvParser from "csv-parser";
import fs from "fs";
import XLSX from "xlsx";
import iconv from "iconv-lite";
import { Parser } from "json2csv";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// 🧩 دوال مساعدة
const clean = (v) => (v === "" || v === undefined ? null : v);
const toIntSafe = (v) => {
  const n = parseInt(v);
  return isNaN(n) ? null : n;
};

// 📦 إضافة أو تحديث مصنع
router.post("/", async (req, res) => {
  try {
    const { factory_id, factory_name, address, phone, user_id } = req.body;
    const result = await pool.query(
      `INSERT INTO factories (factory_id, factory_name, address, phone, user_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (factory_id)
       DO UPDATE SET factory_name = EXCLUDED.factory_name,
                     address = EXCLUDED.address,
                     phone = EXCLUDED.phone,
                     user_id = EXCLUDED.user_id
       RETURNING *`,
      [toIntSafe(factory_id), clean(factory_name), clean(address), clean(phone), toIntSafe(user_id)]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في حفظ المصنع:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء حفظ المصنع" });
  }
});

// 📋 جلب جميع المصانع
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM factories ORDER BY factory_id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ خطأ في جلب المصانع:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ في جلب المصانع" });
  }
});

// 📄 جلب مصنع واحد
router.get("/:id", async (req, res) => {
  const id = toIntSafe(req.params.id);
  if (id === null) return res.status(400).json({ error: "❌ رقم المصنع غير صالح" });

  try {
    const result = await pool.query("SELECT * FROM factories WHERE factory_id = $1", [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "❌ المصنع غير موجود" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في جلب بيانات المصنع:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ في جلب بيانات المصنع" });
  }
});

// ✏️ تعديل مصنع
router.put("/:id", async (req, res) => {
  const id = toIntSafe(req.params.id);
  if (id === null) return res.status(400).json({ error: "❌ رقم المصنع غير صالح" });

  const { factory_name, address, phone, user_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE factories
       SET factory_name = $1, address = $2, phone = $3, user_id = $4
       WHERE factory_id = $5
       RETURNING *`,
      [clean(factory_name), clean(address), clean(phone), toIntSafe(user_id), id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "❌ لم يتم العثور على المصنع" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في تعديل المصنع:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء التعديل" });
  }
});

// 🗑️ حذف مصنع
router.delete("/:id", async (req, res) => {
  const id = toIntSafe(req.params.id);
  if (id === null) return res.status(400).json({ error: "❌ رقم المصنع غير صالح" });

  try {
    const check = await pool.query("SELECT COUNT(*) FROM items WHERE item_factory = $1", [id]);
    if (parseInt(check.rows[0].count) > 0)
      return res.status(400).json({ error: "❌ لا يمكن حذف المصنع لوجود أصناف مرتبطة به" });

    const del = await pool.query("DELETE FROM factories WHERE factory_id = $1 RETURNING *", [id]);
    if (del.rows.length === 0)
      return res.status(404).json({ error: "⚠️ المصنع غير موجود" });

    res.json({ message: "✅ تم حذف المصنع بنجاح" });
  } catch (err) {
    console.error("❌ خطأ أثناء الحذف:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء الحذف" });
  }
});

// 📤 تصدير إلى CSV
router.get("/export", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM factories ORDER BY factory_id ASC");
    const json2csv = new Parser({
      fields: ["factory_id", "factory_name", "address", "phone", "user_id", "user_stamp"],
    });
    const csv = "\uFEFF" + json2csv.parse(result.rows);
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.attachment("factories_export.csv");
    res.send(csv);
  } catch (err) {
    console.error("❌ خطأ أثناء تصدير البيانات:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ في جلب بيانات المصنع" });
  }
});

export default router;
