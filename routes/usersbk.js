// 📁 routes/usersbk.js
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

// 🧩 دالة تنظيف القيم الفارغة
const clean = (v) => (v === "" || v === undefined ? null : v);

// 🧍‍♂️ إضافة أو تحديث مستخدم
router.post("/", async (req, res) => {
  try {
    const { user_id, username, password, full_name, role, active } = req.body;

    const result = await pool.query(
      `INSERT INTO users (user_id, username, password, full_name, role, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id)
       DO UPDATE SET username=$2, password=$3, full_name=$4, role=$5, active=$6
       RETURNING *`,
      [
        user_id ? parseInt(user_id) : null,
        clean(username),
        clean(password),
        clean(full_name),
        clean(role),
        active === "false" || active === false ? false : true
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في حفظ المستخدم:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء حفظ المستخدم" });
  }
});

// 📋 جلب جميع المستخدمين
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users ORDER BY user_id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ خطأ في جلب المستخدمين:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ في جلب المستخدمين" });
  }
});

// 🔍 جلب مستخدم واحد
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const result = await pool.query("SELECT * FROM users WHERE user_id = $1", [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "❌ المستخدم غير موجود" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في جلب المستخدم:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء الجلب" });
  }
});

// ✅ التحقق من بيانات الدخول (user_id + password)
router.post("/check_db", async (req, res) => {
  try {
    const { user_id, password } = req.body;
    const result = await pool.query(
      "SELECT * FROM public.users WHERE user_id = $1 AND password = $2 AND active = true",
      [user_id, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).send("❌ اسم المستخدم أو كلمة المرور غير صحيحة.");
    }

    res.send("تم التحقق من المستخدم بنجاح.");
  } catch (err) {
    console.error("❌ Error in /check_db:", err);
    res.status(500).send("حدث خطأ في الخادم.");
  }
});


// ✏️ تعديل مستخدم
router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { username, password, full_name, role, active } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users
       SET username=$1, password=$2, full_name=$3, role=$4, active=$5
       WHERE user_id=$6
       RETURNING *`,
      [
        clean(username),
        clean(password),
        clean(full_name),
        clean(role),
        active === "false" || active === false ? false : true,
        id
      ]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "❌ المستخدم غير موجود للتعديل" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ خطأ في تعديل المستخدم:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء التعديل" });
  }
});

// 🗑️ حذف مستخدم
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const del = await pool.query("DELETE FROM users WHERE user_id = $1 RETURNING *", [id]);
    if (del.rows.length === 0)
      return res.status(404).json({ error: "⚠️ المستخدم غير موجود" });

    res.json({ message: "✅ تم حذف المستخدم بنجاح" });
  } catch (err) {
    console.error("❌ خطأ أثناء الحذف:", err.message);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء الحذف" });
  }
});

// 📥 استيراد من CSV أو Excel
router.post("/import", upload.single("file"), async (req, res) => {
  const filePath = req.file.path;
  const ext = req.file.originalname.split(".").pop().toLowerCase();
  const users = [];

  try {
    if (ext === "csv") {
      await new Promise((resolve, reject) => {
        const chunks = [];
        fs.createReadStream(filePath)
          .on("data", (chunk) => chunks.push(chunk))
          .on("end", () => {
            const buffer = Buffer.concat(chunks);
            let content = iconv.decode(buffer, "utf8");
            if (!content.includes("username")) {
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
                users.push(cleanRow);
              })
              .on("end", resolve)
              .on("error", reject);
          });
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const workbook = XLSX.readFile(filePath);
      const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      users.push(...sheet);
    } else {
      return res.status(400).json({ error: "⚠️ نوع الملف غير مدعوم" });
    }

    // ✅ استيراد المستخدمين الجدد فقط
    let inserted = 0;
    for (const u of users) {
      const username = u.username?.trim();
      const password = u.password?.trim();
      if (!username || !password) continue;

      const exists = await pool.query("SELECT 1 FROM users WHERE username=$1", [username]);
      if (exists.rows.length > 0) continue;

      await pool.query(
        `INSERT INTO users (username, password, full_name, role, active)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          username,
          password,
          clean(u.full_name),
          clean(u.role),
          u.active === "false" || u.active === false ? false : true
        ]
      );
      inserted++;
    }

    res.json({ message: `✅ تم استيراد ${inserted} مستخدم جديد بنجاح` });
  } catch (err) {
    console.error("❌ خطأ أثناء الاستيراد:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء استيراد البيانات" });
  }
});

// 📤 تصدير المستخدمين إلى CSV
router.get("/export", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users ORDER BY user_id ASC");

    const json2csv = new Parser({
      fields: ["user_id", "username", "full_name", "role", "active", "created_at"]
    });
    const csv = "\uFEFF" + json2csv.parse(result.rows);

    res.header("Content-Type", "text/csv; charset=utf-8");
    res.attachment("users_export.csv");
    res.send(csv);
  } catch (err) {
    console.error("❌ خطأ أثناء التصدير:", err);
    res.status(500).json({ error: "⚠️ حدث خطأ أثناء تصدير البيانات" });
  }
});

// ✅ جلب معلومات المستخدم حسب اسمه أو رقمه
router.post("/get_user_info", async (req, res) => {
  try {
    const { user_id } = req.body;
    const result = await pool.query(
      `SELECT u.user_id, u.username, u.full_name, s.store_name
       FROM users u
       LEFT JOIN stores s ON u.store_id = s.store_id
       WHERE u.user_id = $1`,
      [user_id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: "لم يتم العثور على المستخدم" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error fetching user info:", err);
    res.status(500).json({ message: "خطأ في الخادم" });
  }
});


// ✅ تصدير الراوتر
export default router;
