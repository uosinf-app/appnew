// routes/offersbk.js
import express from "express";
import pool from "../db.js"; // تأكد من مسار db.js الصحيح

const router = express.Router();

// ======================== 🟢 جلب كل العروض ========================
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM item_price_offers ORDER BY start_date DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching offers:", err);
        res.status(500).json({ error: "حدث خطأ أثناء جلب العروض" });
    }
});

// ======================== 🟢 إضافة عرض جديد ========================
router.post("/", async (req, res) => {
    try {
        const {
            store_id,
            item_id,
            offer_price1,
            offer_price2,
            offer_price3,
            start_date,
            end_date,
            is_active = true,
            created_by
        } = req.body;

        if (!store_id || !item_id || !start_date) {
            return res.status(400).json({ error: "المخزن، الصنف وتاريخ البداية إلزامية" });
        }

        await pool.query(
            `INSERT INTO item_price_offers
            (store_id, item_id, offer_price1, offer_price2, offer_price3, start_date, end_date, is_active, created_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
                store_id,
                item_id,
                offer_price1 || null,
                offer_price2 || null,
                offer_price3 || null,
                start_date,
                end_date || null,
                is_active,
                created_by || "Admin"
            ]
        );

        res.json({ message: "تم إضافة العرض بنجاح" });
    } catch (err) {
        console.error("Error adding offer:", err);
        res.status(500).json({ error: "حدث خطأ أثناء إضافة العرض" });
    }
});

// ======================== 🟢 تحديث حالة العرض (تفعيل/إيقاف) ========================
router.patch("/:id", async (req, res) => {
    try {
        const offerId = req.params.id;
        const { is_active } = req.body;

        await pool.query(
            `UPDATE item_price_offers SET is_active=$1 WHERE offer_id=$2`,
            [is_active, offerId]
        );

        res.json({ message: "تم تحديث حالة العرض بنجاح" });
    } catch (err) {
        console.error("Error updating offer:", err);
        res.status(500).json({ error: "حدث خطأ أثناء تحديث حالة العرض" });
    }
});

export default router;
