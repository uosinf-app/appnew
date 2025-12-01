// 📁 routes/storesbk.js
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

// 🧩 دالة مساعدة لتنظيف القيم الفارغة
const clean = (v) => (v === "" || v === undefined ? null : v);

// 📦 إضافة مخزن جديد
router.post("/", async (req, res) => {
  try {
    const { store_id, store_name, address, phone, user_id } = req.body;

    const result = await pool.query(
      `INSERT INTO stores (store_id, store_name, address, phone, user_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (store_id) DO UPDATE
       SET store_name = $2, address = $3, phone = $4, user_id = $5
       RETURNING *`,
      [
        store_id && !isNaN(store_id) ? parseInt(store_id) : null,
        clean(store_name),
        clean(address),
        clean(phone),
        user_id && !isNaN(user_id) ? parseInt(user_id) : null,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في حفظ المخزن:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء حفظ المخزن" });
  }
});

// 📋 جلب جميع المخازن
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM stores ORDER BY store_id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ خطأ في جلب المخازن:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ في جلب المخازن" });
  }
});

// 📄 جلب مخزن واحد حسب الكود
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const result = await pool.query("SELECT * FROM stores WHERE store_id = $1", [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "❌ المخزن غير موجود" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في جلب بيانات المخزن:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ في جلب بيانات المخزن" });
  }
});

// ✏️ تعديل مخزن
router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { store_name, address, phone, user_id } = req.body;

  try {
    const result = await pool.query(
      `UPDATE stores
       SET store_name = $1,
           address = $2,
           phone = $3,
           user_id = $4
       WHERE store_id = $5
       RETURNING *`,
      [
        clean(store_name),
        clean(address),
        clean(phone),
        user_id && !isNaN(user_id) ? parseInt(user_id) : null,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "❌ لم يتم العثور على المخزن المطلوب للتعديل" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في تعديل المخزن:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء التعديل" });
  }
});

// 🗑️ حذف مخزن (بعد التأكد من عدم وجود أصناف أو حركات مرتبطة)
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const check = await pool.query("SELECT COUNT(*) FROM a_master WHERE store_id = $1", [id]);
    if (parseInt(check.rows[0].count) > 0)
      return res.status(400).json({ error: "❌ لا يمكن حذف المخزن لوجود حركة عليه" });

    const del = await pool.query("DELETE FROM stores WHERE store_id = $1 RETURNING *", [id]);
    if (del.rows.length === 0)
      return res.status(404).json({ error: "⚠️ لم يتم العثور على المخزن المطلوب للحذف" });

    res.json({ message: "✅ تم حذف المخزن بنجاح" });
  } catch (err) {
    console.error("❌ خطأ أثناء الحذف:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء الحذف" });
  }
});

// 📥 استيراد المخازن من CSV أو Excel
router.post("/import", upload.single("file"), async (req, res) => {
  const filePath = req.file.path;
  const ext = req.file.originalname.split(".").pop().toLowerCase();
  const stores = [];

  try {
    if (ext === "csv") {
      await new Promise((resolve, reject) => {
        const chunks = [];
        fs.createReadStream(filePath)
          .on("data", (chunk) => chunks.push(chunk))
          .on("end", () => {
            const buffer = Buffer.concat(chunks);
            let content = iconv.decode(buffer, "utf8");
            if (!content.includes("store_id") && !content.includes("store_name")) {
              content = iconv.decode(buffer, "windows-1256");
            }

            fs.writeFileSync(filePath + "_utf8.csv", content, "utf8");
            fs.createReadStream(filePath + "_utf8.csv")
              .pipe(csvParser())
              .on("data", (row) => {
                const cleanRow = {};
                for (const key in row) {
                  const cleanKey = key.replace(/\uFEFF/g, "").trim();
                  cleanRow[cleanKey] = row[key];
                }
                stores.push(cleanRow);
              })
              .on("end", resolve)
              .on("error", reject);
          });
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      stores.push(...sheet);
    } else {
      return res.status(400).json({ error: "⚠️ نوع الملف غير مدعوم" });
    }

    // ✅ إدخال فقط المخازن الجديدة
    let inserted = 0;
    for (const store of stores) {
      const id = store.store_id?.toString().trim();
      const name = store.store_name?.trim();
      if (!id || !name) continue;

      const exists = await pool.query("SELECT 1 FROM stores WHERE store_id = $1", [id]);
      if (exists.rows.length > 0) continue;

      await pool.query(
        `INSERT INTO stores (store_id, store_name, address, phone, user_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          parseInt(id),
          name,
          clean(store.address),
          clean(store.phone),
          store.user_id && !isNaN(store.user_id) ? parseInt(store.user_id) : null,
        ]
      );
      inserted++;
    }

    res.json({ message: `✅ تم استيراد ${inserted} مخزن جديد بنجاح` });
  } catch (err) {
    console.error("❌ خطأ أثناء استيراد البيانات:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء استيراد البيانات" });
  } finally {
    // حذف الملفات المؤقتة
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(filePath + "_utf8.csv")) fs.unlinkSync(filePath + "_utf8.csv");
  }
});

// 📤 تصدير إلى CSV
router.get("/export", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM stores ORDER BY store_id ASC");

    const json2csv = new Parser({
      fields: ["store_id", "store_name", "address", "phone", "user_id", "user_stamp"],
    });
    const csv = "\uFEFF" + json2csv.parse(result.rows);

    res.header("Content-Type", "text/csv; charset=utf-8");
    res.attachment("stores_export.csv");
    res.send(csv);
  } catch (err) {
    console.error("❌ خطأ أثناء تصدير البيانات:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء تصدير البيانات" });
  }
});

// ✅ تصدير الراوتر
export default router;
