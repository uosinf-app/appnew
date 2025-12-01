// 📁 routes/suppliersbk.js
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

// 🔧 تنظيف القيم
const clean = (v) => (v === "" || v === undefined ? null : v);

// 🟢 إضافة أو تحديث مورد
router.post("/", async (req, res) => {
  try {
    const { supplierid, supplier_name, phone, address, email, user_id } = req.body;

    if (!supplier_name) return res.status(400).json({ error: "⚠️ اسم المورد مطلوب" });

    const id = supplierid?.trim();
    if (!id) return res.status(400).json({ error: "⚠️ كود المورد مطلوب" });

    const result = await pool.query(
      `INSERT INTO suppliers (supplierid, supplier_name, phone, address, email, user_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (supplierid) DO UPDATE
       SET supplier_name=$2, phone=$3, address=$4, email=$5, user_id=$6
       RETURNING *`,
      [id, supplier_name.trim(), clean(phone), clean(address), clean(email), user_id ? parseInt(user_id) : null]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في حفظ المورد:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء حفظ المورد" });
  }
});

// 🟢 جلب الكل
router.get("/", async (_, res) => {
  try {
    const result = await pool.query("SELECT * FROM suppliers ORDER BY supplierid ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ خطأ في جلب الموردين:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ في جلب الموردين" });
  }
});

// 📤 تصدير - ضع هذا قبل router.get("/:id")
router.get("/export", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM suppliers ORDER BY supplierid ASC");
    const json2csv = new Parser({
      fields: ["supplierid", "supplier_name", "phone", "address", "email", "user_id"], // فقط الحقول الموجودة
    });
    const csv = "\uFEFF" + json2csv.parse(result.rows);
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.attachment("suppliers_export.csv");
    res.send(csv);
  } catch (err) {
    console.error("❌ خطأ أثناء التصدير:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء التصدير" });
  }
});


// 🟢 جلب مورد واحد
router.get("/:id", async (req, res) => {
  const id = req.params.id.trim();
  try {
    const result = await pool.query("SELECT * FROM suppliers WHERE supplierid=$1", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "❌ المورد غير موجود" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في جلب المورد:", err.message);
    res.status(500).json({ error: "⚠️ خطأ في الجلب" });
  }
});


// 🟢 تعديل
router.put("/:id", async (req, res) => {
  const id = req.params.id.trim();
  const { supplier_name, phone, address, email, user_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE suppliers SET supplier_name=$1, phone=$2, address=$3, email=$4, user_id=$5 WHERE supplierid=$6 RETURNING *`,
      [clean(supplier_name), clean(phone), clean(address), clean(email), user_id ? parseInt(user_id) : null, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "❌ المورد غير موجود للتعديل" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في تعديل المورد:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء التعديل" });
  }
});

// 🗑️ حذف
router.delete("/:id", async (req, res) => {
  const id = req.params.id.trim();
  try {
    const del = await pool.query("DELETE FROM suppliers WHERE supplierid=$1 RETURNING *", [id]);
    if (del.rows.length === 0)
      return res.status(404).json({ error: "⚠️ المورد غير موجود للحذف" });
    res.json({ message: "✅ تم حذف المورد بنجاح" });
  } catch (err) {
    console.error("❌ خطأ أثناء الحذف:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء الحذف" });
  }
});

// 📥 استيراد
router.post("/import", upload.single("file"), async (req, res) => {
  const filePath = req.file.path;
  const ext = req.file.originalname.split(".").pop().toLowerCase();
  const suppliers = [];

  try {
    if (ext === "csv") {
      await new Promise((resolve, reject) => {
        const chunks = [];
        fs.createReadStream(filePath)
          .on("data", (chunk) => chunks.push(chunk))
          .on("end", () => {
            const buffer = Buffer.concat(chunks);
            let content = iconv.decode(buffer, "utf8");
            if (!content.includes("supplierid")) content = iconv.decode(buffer, "windows-1256");
            fs.writeFileSync(filePath + "_utf8.csv", content, "utf8");
            fs.createReadStream(filePath + "_utf8.csv")
              .pipe(csvParser())
              .on("data", (row) => suppliers.push(row))
              .on("end", resolve)
              .on("error", reject);
          });
      });
    } else if (ext === "xls" || ext === "xlsx") {
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      suppliers.push(...XLSX.utils.sheet_to_json(sheet));
    } else return res.status(400).json({ error: "⚠️ نوع الملف غير مدعوم" });

    let inserted = 0;
    for (const s of suppliers) {
      const id = s.supplierid?.trim();
      const name = s.supplier_name?.trim();
      if (!id || !name) continue;
      const exists = await pool.query("SELECT 1 FROM suppliers WHERE supplierid=$1", [id]);
      if (exists.rows.length > 0) continue;
      await pool.query(
        `INSERT INTO suppliers (supplierid, supplier_name, phone, address, email, user_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, name, clean(s.phone), clean(s.address), clean(s.email), s.user_id ? parseInt(s.user_id) : null]
      );
      inserted++;
    }
    res.json({ message: `✅ تم استيراد ${inserted} مورد جديد بنجاح` });
  } catch (err) {
    console.error("❌ خطأ أثناء الاستيراد:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء الاستيراد" });
  } finally {
    fs.unlinkSync(filePath);
  }
});


export default router;
