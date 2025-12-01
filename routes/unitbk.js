import express from "express";
import pool from "../db.js";

const router = express.Router();

// ================= CRUD Units =================

// GET /api/units - الحصول على جميع الوحدات
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM units ORDER BY unit_id");
    res.json({
      success: true,
      data: result.rows,
      message: "تم جلب جميع الوحدات بنجاح",
      total: result.rowCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "خطأ في جلب البيانات" });
  }
});

// GET /api/units/search - البحث في الوحدات
router.get("/search", async (req, res) => {
  try {
    const { search, type, status } = req.query;

    let query = "SELECT * FROM units WHERE 1=1";
    const values = [];

    if (search) {
      values.push(`%${search}%`);
      query += ` AND (unit_name ILIKE $${values.length} OR unit_type ILIKE $${values.length})`;
    }

    if (type) {
      values.push(type);
      query += ` AND unit_type = $${values.length}`;
    }

    if (status !== undefined) {
      const isActive = status === "true";
      values.push(isActive);
      query += ` AND is_active = $${values.length}`;
    }

    query += " ORDER BY unit_id";

    const result = await pool.query(query, values);
    res.json({
      success: true,
      data: result.rows,
      message: "تم البحث بنجاح",
      total: result.rowCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "خطأ في البحث" });
  }
});

// GET /api/units/:id - الحصول على وحدة بواسطة المعرف
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM units WHERE unit_id = $1", [id]);

    if (!result.rowCount)
      return res.status(404).json({ success: false, message: "الوحدة غير موجودة" });

    res.json({ success: true, data: result.rows[0], message: "تم جلب الوحدة بنجاح" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "خطأ في جلب الوحدة" });
  }
});

// POST /api/units - إضافة وحدة جديدة
router.post("/", async (req, res) => {
  try {
    const { unit_name, unit_type, conversion_factor, base_unit, is_active } = req.body;

    if (!unit_name || !unit_type) {
      return res.status(400).json({ success: false, message: "اسم الوحدة ونوع الوحدة مطلوبان" });
    }

    const insertQuery = `
      INSERT INTO units (unit_name, unit_type, conversion_factor, base_unit, is_active)
      VALUES ($1, $2, $3, $4, $5) RETURNING *`;

    const values = [
      unit_name,
      unit_type,
      conversion_factor || 1,
      base_unit || null,
      is_active !== undefined ? is_active : true,
    ];

    const result = await pool.query(insertQuery, values);
    res.status(201).json({ success: true, data: result.rows[0], message: "تم إضافة الوحدة بنجاح" });
  } catch (err) {
    console.error(err);
    if (err.code === "23505") {
      return res.status(400).json({ success: false, message: "اسم الوحدة موجود مسبقاً" });
    }
    res.status(500).json({ success: false, message: "خطأ في إضافة الوحدة" });
  }
});

// PUT /api/units/:id - تحديث وحدة
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { unit_name, unit_type, conversion_factor, base_unit, is_active } = req.body;

    const result = await pool.query("SELECT * FROM units WHERE unit_id = $1", [id]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: "الوحدة غير موجودة" });

    const updateQuery = `
      UPDATE units
      SET unit_name=$1, unit_type=$2, conversion_factor=$3, base_unit=$4, is_active=$5
      WHERE unit_id=$6 RETURNING *`;

    const values = [
      unit_name,
      unit_type,
      conversion_factor || result.rows[0].conversion_factor,
      base_unit !== undefined ? base_unit : result.rows[0].base_unit,
      is_active !== undefined ? is_active : result.rows[0].is_active,
      id,
    ];

    const updated = await pool.query(updateQuery, values);
    res.json({ success: true, data: updated.rows[0], message: "تم تحديث الوحدة بنجاح" });
  } catch (err) {
    console.error(err);
    if (err.code === "23505") {
      return res.status(400).json({ success: false, message: "اسم الوحدة موجود مسبقاً" });
    }
    res.status(500).json({ success: false, message: "خطأ في تحديث الوحدة" });
  }
});

// DELETE /api/units/:id - حذف وحدة
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM units WHERE unit_id=$1 RETURNING *", [id]);

    if (!result.rowCount) return res.status(404).json({ success: false, message: "الوحدة غير موجودة" });

    res.json({ success: true, message: "تم حذف الوحدة بنجاح" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "خطأ في حذف الوحدة" });
  }
});

// PATCH /api/units/:id/toggle - تبديل حالة الوحدة
router.patch("/:id/toggle", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM units WHERE unit_id=$1", [id]);

    if (!result.rowCount) return res.status(404).json({ success: false, message: "الوحدة غير موجودة" });

    const newStatus = !result.rows[0].is_active;
    const updated = await pool.query("UPDATE units SET is_active=$1 WHERE unit_id=$2 RETURNING *", [
      newStatus,
      id,
    ]);

    res.json({
      success: true,
      data: updated.rows[0],
      message: `تم ${newStatus ? "تفعيل" : "تعطيل"} الوحدة بنجاح`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "خطأ في تبديل حالة الوحدة" });
  }
});

export default router;
