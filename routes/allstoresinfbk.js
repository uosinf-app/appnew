// ======================== 🧩 allstoresinfbk.js ========================
import express from "express";
import pool from "../db.js"; // تأكد من المسار الصحيح

const router = express.Router();

// ======================================
// GET التقرير التحليلي لكل المتاجر
// ======================================
router.get("/", async (req, res) => {
  const { from, to } = req.query; // استعلام اختياري للفترة: ?from=yyyy-mm-dd&to=yyyy-mm-dd

  try {
    // بناء شرط التاريخ
    let dateFilter = "";
    const params = [];
    if (from && to) {
      dateFilter = "WHERE tran_date >= $1 AND tran_date <= $2";
      params.push(from, to);
    }

    // جلب البيانات التحليلية
    const query = `
      SELECT 
        s.store_id,
        s.store_name,
        COALESCE(p.total_purchases, 0) AS total_purchases,
        COALESCE(sa.total_sales, 0) AS total_sales,
        COALESCE(e.total_expenses, 0) AS total_expenses
      FROM stores s
      LEFT JOIN (
        SELECT store_id, SUM(total_amount) AS total_purchases
        FROM purchases
        ${dateFilter}
        GROUP BY store_id
      ) p ON s.store_id = p.store_id
      LEFT JOIN (
        SELECT store_id, SUM(total_amount) AS total_sales
        FROM sales
        ${dateFilter}
        GROUP BY store_id
      ) sa ON s.store_id = sa.store_id
      LEFT JOIN (
        SELECT store_id, SUM(total_amount) AS total_expenses
        FROM expenses
        ${dateFilter}
        GROUP BY store_id
      ) e ON s.store_id = e.store_id
      ORDER BY s.store_id ASC
    `;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (err) {
    console.error("❌ خطأ عند جلب التقرير التحليلي:", err);
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء جلب التقرير التحليلي",
      error: err.message
    });
  }
});

export default router;
