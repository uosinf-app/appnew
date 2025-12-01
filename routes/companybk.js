// 📁 routes/companybk.js
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

const clean = v => (v === "" || v === undefined ? null : v);

// POST -> إضافة (إذا company_id موجود نحاول إدخال بالرقم أو التحديث)،
// إذا company_id غير موجود -> INSERT بدون company_id (sequence يعمل)
router.post("/", async (req, res) => {
  try {
    const body = req.body;

    // تحويل user_id إذا وُجد
    const user_id = body.user_id ? parseInt(body.user_id) : null;
    const company_id_raw = body.company_id !== undefined ? String(body.company_id).trim() : "";

    if (company_id_raw) {
      // حاول تحويل company_id إلى عدد
      const cid = parseInt(company_id_raw);
      if (isNaN(cid)) return res.status(400).json({ error: "❌ كود الشركة غير صالح" });

      // نفذ INSERT مع company_id مع ON CONFLICT DO UPDATE
      const result = await pool.query(
        `INSERT INTO company_info (
           company_id, company_name, company_name_eng, address, city, country,
           phone, phone2, fax, email, tax_file, tax_number, commercial_reg,
           website, logo_url, notes, user_id
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
         )
         ON CONFLICT (company_id) DO UPDATE SET
           company_name=EXCLUDED.company_name,
           company_name_eng=EXCLUDED.company_name_eng,
           address=EXCLUDED.address,
           city=EXCLUDED.city,
           country=EXCLUDED.country,
           phone=EXCLUDED.phone,
           phone2=EXCLUDED.phone2,
           fax=EXCLUDED.fax,
           email=EXCLUDED.email,
           tax_file=EXCLUDED.tax_file,
           tax_number=EXCLUDED.tax_number,
           commercial_reg=EXCLUDED.commercial_reg,
           website=EXCLUDED.website,
           logo_url=EXCLUDED.logo_url,
           notes=EXCLUDED.notes,
           user_id=EXCLUDED.user_id
         RETURNING *;`,
        [
          cid,
          clean(body.company_name),
          clean(body.company_name_eng),
          clean(body.address),
          clean(body.city),
          clean(body.country),
          clean(body.phone),
          clean(body.phone2),
          clean(body.fax),
          clean(body.email),
          clean(body.tax_file),
          clean(body.tax_number),
          clean(body.commercial_reg),
          clean(body.website),
          clean(body.logo_url),
          clean(body.notes),
          user_id
        ]
      );
      return res.json(result.rows[0]);
    } else {
      // INSERT بدون company_id (sequence)
      const result = await pool.query(
        `INSERT INTO company_info (
           company_name, company_name_eng, address, city, country,
           phone, phone2, fax, email, tax_file, tax_number, commercial_reg,
           website, logo_url, notes, user_id
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
         )
         RETURNING *;`,
        [
          clean(body.company_name),
          clean(body.company_name_eng),
          clean(body.address),
          clean(body.city),
          clean(body.country),
          clean(body.phone),
          clean(body.phone2),
          clean(body.fax),
          clean(body.email),
          clean(body.tax_file),
          clean(body.tax_number),
          clean(body.commercial_reg),
          clean(body.website),
          clean(body.logo_url),
          clean(body.notes),
          user_id
        ]
      );
      return res.json(result.rows[0]);
    }
  } catch (err) {
    console.error("❌ خطأ في حفظ الشركة:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء حفظ بيانات الشركة" });
  }
});

// GET all
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM company_info ORDER BY company_id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ خطأ في جلب الشركات:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ في جلب الشركات" });
  }
});

// GET by id
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "❌ رقم الشركة غير صالح" });
  try {
    const result = await pool.query("SELECT * FROM company_info WHERE company_id = $1", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "❌ الشركة غير موجودة" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في جلب بيانات الشركة:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ في جلب بيانات الشركة" });
  }
});

// PUT update
router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "❌ رقم الشركة غير صالح" });

  try {
    const user_id = req.body.user_id ? parseInt(req.body.user_id) : null;
    const result = await pool.query(
      `UPDATE company_info SET
         company_name=$1, company_name_eng=$2, address=$3, city=$4, country=$5,
         phone=$6, phone2=$7, fax=$8, email=$9, tax_file=$10, tax_number=$11,
         commercial_reg=$12, website=$13, logo_url=$14, notes=$15, user_id=$16
       WHERE company_id=$17
       RETURNING *`,
      [
        clean(req.body.company_name),
        clean(req.body.company_name_eng),
        clean(req.body.address),
        clean(req.body.city),
        clean(req.body.country),
        clean(req.body.phone),
        clean(req.body.phone2),
        clean(req.body.fax),
        clean(req.body.email),
        clean(req.body.tax_file),
        clean(req.body.tax_number),
        clean(req.body.commercial_reg),
        clean(req.body.website),
        clean(req.body.logo_url),
        clean(req.body.notes),
        user_id,
        id
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "❌ لم يتم العثور على الشركة" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في تعديل الشركة:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء التعديل" });
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const del = await pool.query("DELETE FROM company_info WHERE company_id=$1 RETURNING *", [id]);
    if (del.rows.length === 0) return res.status(404).json({ error: "❌ الشركة غير موجودة" });
    res.json({ message: "✅ تم حذف الشركة بنجاح" });
  } catch (err) {
    console.error("❌ خطأ أثناء الحذف:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء الحذف" });
  }
});

// IMPORT (CSV / XLSX)
router.post("/import", upload.single("file"), async (req, res) => {
  const filePath = req.file.path;
  const originalName = req.file.originalname || "";
  const ext = originalName.split(".").pop().toLowerCase();

  try {
    const rows = [];

    if (ext === "csv") {
      await new Promise((resolve, reject) => {
        const chunks = [];
        fs.createReadStream(filePath)
          .on("data", chunk => chunks.push(chunk))
          .on("end", () => {
            const buffer = Buffer.concat(chunks);
            // try utf8 then windows-1256
            let content = iconv.decode(buffer, "utf8");
            if (!content.includes("company_name") && !content.includes("company_id")) {
              content = iconv.decode(buffer, "windows-1256");
            }
            const tmpPath = filePath + "_utf8.csv";
            fs.writeFileSync(tmpPath, content, "utf8");
            fs.createReadStream(tmpPath)
              .pipe(csvParser())
              .on("data", (r) => rows.push(r))
              .on("end", () => resolve())
              .on("error", (e) => reject(e));
          })
          .on("error", reject);
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      rows.push(...sheet);
    } else {
      return res.status(400).json({ error: "⚠️ نوع الملف غير مدعوم" });
    }

    // إدخال فقط غير الموجود
    let inserted = 0;
    for (const r of rows) {
      const id = r.company_id !== undefined && r.company_id !== null ? String(r.company_id).trim() : "";
      const name = r.company_name ? String(r.company_name).trim() : "";
      if (!name) continue;

      if (id) {
        const cid = parseInt(id);
        if (isNaN(cid)) continue;
        const exists = await pool.query("SELECT 1 FROM company_info WHERE company_id=$1", [cid]);
        if (exists.rows.length > 0) continue;
        await pool.query(
          `INSERT INTO company_info (company_id, company_name, company_name_eng, address, city, country, phone, email, user_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            cid,
            name,
            r.company_name_eng ? String(r.company_name_eng).trim() : null,
            r.address ? String(r.address).trim() : null,
            r.city ? String(r.city).trim() : null,
            r.country ? String(r.country).trim() : null,
            r.phone ? String(r.phone).trim() : null,
            r.email ? String(r.email).trim() : null,
            r.user_id ? parseInt(r.user_id) : null
          ]
        );
      } else {
        // insert letting sequence generate id
        await pool.query(
          `INSERT INTO company_info (company_name, company_name_eng, address, city, country, phone, email, user_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            name,
            r.company_name_eng ? String(r.company_name_eng).trim() : null,
            r.address ? String(r.address).trim() : null,
            r.city ? String(r.city).trim() : null,
            r.country ? String(r.country).trim() : null,
            r.phone ? String(r.phone).trim() : null,
            r.email ? String(r.email).trim() : null,
            r.user_id ? parseInt(r.user_id) : null
          ]
        );
      }
      inserted++;
    }

    // لا نحذف الملف كما طلبت سابقاً
    res.json({ message: `✅ تم استيراد ${inserted} شركة جديدة بنجاح` });
  } catch (err) {
    console.error("❌ خطأ أثناء الاستيراد:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء استيراد البيانات" });
  }
});

// EXPORT (CSV UTF-8)
router.get("/export", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM company_info ORDER BY company_id ASC");
    const rows = result.rows || [];
    const fields = rows.length ? Object.keys(rows[0]) : [
      "company_id","company_name","company_name_eng","address","city","country",
      "phone","phone2","fax","email","tax_file","tax_number","commercial_reg",
      "website","logo_url","notes","user_id","user_stamp"
    ];
    const json2csv = new Parser({ fields });
    const csv = "\uFEFF" + json2csv.parse(rows);
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.attachment("companies_export.csv");
    res.send(csv);
  } catch (err) {
    console.error("❌ خطأ أثناء التصدير:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء تصدير الشركات" });
  }
});

export default router;
