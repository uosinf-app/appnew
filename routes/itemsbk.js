// 📁 routes/itemsbk.js
import express from "express";
import pool from "../db.js";
import multer from "multer";
import csvParser from "csv-parser";
import fs from "fs";
import XLSX from "xlsx";
import iconv from "iconv-lite";
import { Parser } from "json2csv";

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // ✅ تعريف صحيح

// 📦 حفظ الأصناف الجديدة أو تعديلها
router.post("/", async (req, res) => {
  try {
    const { item_id, item_nm, item_nm_eng, item_factory, item_unit, sale_price1 } = req.body;
    const query = `
      INSERT INTO items (item_id, item_nm, item_nm_eng, item_factory, item_unit, sale_price1)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (item_id) DO UPDATE
      SET item_nm=$2, item_nm_eng=$3, item_factory=$4, item_unit=$5, sale_price1=$6
      RETURNING *;
    `;
    const result = await pool.query(query, [item_id, item_nm, item_nm_eng, item_factory, item_unit, sale_price1]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في حفظ الصنف:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء حفظ الصنف" });
  }
});

// 📋 جلب جميع الأصناف
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM items ORDER BY item_id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ خطأ في جلب الأصناف:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ في جلب الأصناف" });
  }
});

// 📄 جلب صنف واحد حسب الكود
router.get("/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const result = await pool.query("SELECT * FROM items WHERE item_id = $1", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "❌ الصنف غير موجود" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في جلب بيانات الصنف:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ في جلب بيانات الصنف" });
  }
});

// ✏️ تعديل صنف
router.put("/:id", async (req, res) => {
  const id = req.params.id;
  const { item_nm, item_nm_eng, item_factory, item_unit, sale_price1 } = req.body;
  try {
    const result = await pool.query(
      "UPDATE items SET item_nm=$1, item_nm_eng=$2, item_factory=$3, item_unit=$4, sale_price1=$5 WHERE item_id=$6 RETURNING *",
      [item_nm, item_nm_eng, item_factory, item_unit, sale_price1, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "❌ لم يتم العثور على الصنف المطلوب للتعديل" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في تعديل الصنف:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء التعديل" });
  }
});

// 🗑️ حذف صنف (بعد التأكد من عدم وجود حركة في a_master)
router.delete("/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const check = await pool.query("SELECT COUNT(*) FROM a_master WHERE item_id = $1", [id]);
    if (parseInt(check.rows[0].count) > 0)
      return res.status(400).json({ error: "❌ لا يمكن حذف الصنف لوجود حركة عليه" });

    const del = await pool.query("DELETE FROM items WHERE item_id=$1 RETURNING *", [id]);
    if (del.rows.length === 0)
      return res.status(404).json({ error: "⚠️ لم يتم العثور على الصنف المطلوب للحذف" });

    res.json({ message: "✅ تم حذف الصنف بنجاح" });
  } catch (err) {
    console.error("❌ خطأ أثناء الحذف:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء الحذف" });
  }
});


// 📤 استيراد الأصناف من CSV أو Excel مع دعم اللغة العربية
router.post("/import", upload.single("file"), async (req, res) => {
  const filePath = req.file.path;
  const ext = req.file.originalname.split(".").pop().toLowerCase();
  const items = [];

  try {
    if (ext === "csv") {
      await new Promise((resolve, reject) => {
        const chunks = [];
        fs.createReadStream(filePath)
          .on("data", (chunk) => chunks.push(chunk))
          .on("end", () => {
            const buffer = Buffer.concat(chunks);
            // ✅ نحاول أولًا UTF-8 ثم Windows-1256
            let content = iconv.decode(buffer, "utf8");
            if (!content.includes("item_id") && !content.includes("item_nm")) {
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
                items.push(cleanRow);
              })
              .on("end", resolve)
              .on("error", reject);
          });
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      items.push(...sheet);
    } else {
      return res.status(400).json({ error: "⚠️ نوع الملف غير مدعوم" });
    }

    // ✅ إدخال فقط الأصناف الجديدة
    let inserted = 0;

    for (const item of items) {
      // 🧩 خريطة الأسماء بالعربية والإنجليزية
      const id =
        item.item_id?.toString().trim() ||
        item["رقم الصنف"]?.toString().trim() ||
        item["كود الصنف"]?.toString().trim();

      const name =
        item.item_nm?.trim() ||
        item["اسم الصنف"]?.trim() ||
        item["الاسم"]?.trim();

      const nameEng =
        item.item_nm_eng?.trim() ||
        item["الاسم بالإنجليزية"]?.trim() ||
        item["Item Name"]?.trim() ||
        null;

      const factory =
        item.item_factory?.trim() ||
        item["المصنع"]?.trim() ||
        item["المنتج"]?.trim() ||
        null;

      const unit =
        item.item_unit?.trim() ||
        item["الوحدة"]?.trim() ||
        item["Unit"]?.trim() ||
        null;

      const price =
        item.sale_price1 ||
        item["السعر"] ||
        item["سعر البيع"] ||
        item["Price"] ||
        null;

      if (!id || !name) continue;

      // تحقق من الوجود
      const exists = await pool.query("SELECT 1 FROM items WHERE item_id = $1", [id]);
      if (exists.rows.length > 0) continue;

      // إدخال جديد
      await pool.query(
        `INSERT INTO items (item_id, item_nm, item_nm_eng, item_factory, item_unit, sale_price1)
        VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, name, nameEng, factory, unit, price ? parseFloat(price) : null]
      );

      inserted++;
    }


    res.json({ message: `✅ تم استيراد ${inserted} صنف جديد بنجاح` });
  } catch (err) {
    console.error("❌ خطأ أثناء استيراد البيانات:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء استيراد البيانات" });
  }
});


// 📤 تصدير إلى CSV بصيغة UTF-8
router.get("/export", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM items ORDER BY item_id ASC");
    const json2csv = new Parser({
      fields: ["item_id", "item_nm", "item_nm_eng", "item_factory", "item_unit", "sale_price1"],
    });
    const csv = "\uFEFF" + json2csv.parse(result.rows); // BOM لدعم العربية

    res.header("Content-Type", "text/csv; charset=utf-8");
    res.attachment("items_export.csv");
    res.send(csv);
  } catch (err) {
    console.error("❌ خطأ أثناء تصدير البيانات:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء تصدير البيانات" });
  }
});

// ✅ تصدير الـ Router
export default router;
