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

// 🧩 دالة تنظيف
const clean = (v) => (v === "" || v === undefined ? null : v);

// 🧱 إضافة / تحديث عميل
router.post("/", async (req, res) => {
  try {
    const { customer_id, customer_name, phone, address, email, user_id } = req.body;
    const result = await pool.query(
      `INSERT INTO customers (customer_id, customer_name, phone, address, email, user_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (customer_id) DO UPDATE
       SET customer_name=$2, phone=$3, address=$4, email=$5, user_id=$6
       RETURNING *`,
      [
        customer_id ? parseInt(customer_id) : null,
        clean(customer_name),
        clean(phone),
        clean(address),
        clean(email),
        user_id ? parseInt(user_id) : null
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في حفظ العميل:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء حفظ العميل" });
  }
});

// 📋 عرض كل العملاء
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM customers ORDER BY customer_id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ خطأ في جلب العملاء:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ في جلب العملاء" });
  }
});

// 📄 جلب عميل واحد
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "❌ رقم العميل غير صالح" });
  try {
    const result = await pool.query("SELECT * FROM customers WHERE customer_id=$1", [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "❌ العميل غير موجود" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في جلب بيانات العميل:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء جلب العميل" });
  }
});

// ✏️ تعديل عميل
router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { customer_name, phone, address, email, user_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE customers
       SET customer_name=$1, phone=$2, address=$3, email=$4, user_id=$5
       WHERE customer_id=$6 RETURNING *`,
      [clean(customer_name), clean(phone), clean(address), clean(email), user_id ? parseInt(user_id) : null, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "❌ لم يتم العثور على العميل المطلوب" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في تعديل العميل:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء التعديل" });
  }
});

// 🗑️ حذف عميل
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const result = await pool.query("DELETE FROM customers WHERE customer_id=$1 RETURNING *", [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "⚠️ العميل غير موجود للحذف" });
    res.json({ message: "✅ تم حذف العميل بنجاح" });
  } catch (err) {
    console.error("❌ خطأ أثناء الحذف:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء الحذف" });
  }
});

// 📥 استيراد من ملف
router.post("/import", upload.single("file"), async (req, res) => {
  const filePath = req.file.path;
  const ext = req.file.originalname.split(".").pop().toLowerCase();
  const customers = [];
  try {
    if (ext === "csv") {
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csvParser())
          .on("data", (row) => customers.push(row))
          .on("end", resolve)
          .on("error", reject);
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      customers.push(...rows);
    }

    let inserted = 0;
    for (const c of customers) {
      const id = parseInt(c.customer_id);
      if (!id || !c.customer_name) continue;
      const exists = await pool.query("SELECT 1 FROM customers WHERE customer_id=$1", [id]);
      if (exists.rows.length > 0) continue;

      await pool.query(
        `INSERT INTO customers (customer_id, customer_name, phone, address, email, user_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, c.customer_name, c.phone, c.address, c.email, c.user_id ? parseInt(c.user_id) : null]
      );
      inserted++;
    }
    res.json({ message: `✅ تم استيراد ${inserted} عميل جديد بنجاح` });
  } catch (err) {
    console.error("❌ خطأ أثناء الاستيراد:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء استيراد العملاء" });
  }
});

// 📤 تصدير إلى CSV
router.get("/export", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM customers ORDER BY customer_id ASC");
    const json2csv = new Parser({
      fields: ["customer_id", "customer_name", "phone", "address", "email", "user_id", "user_stamp"],
    });
    const csv = "\uFEFF" + json2csv.parse(result.rows);
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.attachment("customers_export.csv");
    res.send(csv);
  } catch (err) {
    console.error("❌ خطأ أثناء تصدير العملاء:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء تصدير العملاء" });
  }
});

export default router;
