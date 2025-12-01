// routes/offershowbk.js
import express from "express";
import pool from "../db.js";

const router = express.Router();

// ======================== 🔧 دوال مساعدة ========================
// دالة لجلب اسم الصنف
async function getItemName(itemId) {
    try {
        const result = await pool.query(
            'SELECT item_nm FROM public.items WHERE item_id = $1',
            [itemId]
        );
        return result.rows.length > 0 ? result.rows[0].item_nm : 'غير معروف';
    } catch (error) {
        console.error(`❌ خطأ في جلب اسم الصنف ${itemId}:`, error);
        return 'غير معروف';
    }
}

// دالة لجلب اسم المخزن
async function getStoreName(storeId) {
    try {
        const result = await pool.query(
            'SELECT store_name, name FROM public.stores WHERE store_id = $1',
            [storeId]
        );
        if (result.rows.length > 0) {
            return result.rows[0].store_name || result.rows[0].name || `المخزن ${storeId}`;
        }
        return `المخزن ${storeId}`;
    } catch (error) {
        console.error(`❌ خطأ في جلب اسم المخزن ${storeId}:`, error);
        return `المخزن ${storeId}`;
    }
}

// دالة لتحويل القيم الرقمية
function parseNumeric(value) {
    if (value === null || value === undefined) return null;
    // إذا كانت القيمة كائن numeric من PostgreSQL
    if (typeof value === 'object' && value !== null) {
        return parseFloat(value);
    }
    return parseFloat(value);
}

// ======================== 📋 جلب جميع العروض مع معلومات إضافية ========================
router.get("/", async (req, res) => {
    try {
        console.log('🔍 محاولة جلب جميع العروض...');
        
        // استعلام أبسط أولاً للتحقق من الأساسيات
        const simpleQuery = `
            SELECT 
                o.offer_id,
                o.item_id,
                o.store_id,
                o.offer_price1,
                o.offer_price2,
                o.offer_price3,
                o.start_date,
                o.end_date,
                o.is_active,
                o.created_by,
                o.created_at
            FROM public.item_price_offers o
            ORDER BY o.is_active DESC, o.start_date DESC, o.created_at DESC
        `;

        console.log('📊 تنفيذ استعلام العروض...');
        const result = await pool.query(simpleQuery);
        
        console.log(`✅ تم جلب ${result.rows.length} عرض من جدول العروض`);

        // الآن جلب معلومات إضافية لكل عرض
        const offersWithDetails = await Promise.all(
            result.rows.map(async (offer) => {
                try {
                    const itemName = await getItemName(offer.item_id);
                    const storeName = await getStoreName(offer.store_id);

                    // تحويل القيم الرقمية
                    return {
                        ...offer,
                        item_nm: itemName,
                        store_name: storeName,
                        offer_price1: parseNumeric(offer.offer_price1),
                        offer_price2: parseNumeric(offer.offer_price2),
                        offer_price3: parseNumeric(offer.offer_price3)
                    };
                } catch (error) {
                    console.error(`❌ خطأ في معالجة العرض ${offer.offer_id}:`, error);
                    return {
                        ...offer,
                        item_nm: 'خطأ في التحميل',
                        store_name: `المخزن ${offer.store_id}`,
                        offer_price1: parseNumeric(offer.offer_price1),
                        offer_price2: parseNumeric(offer.offer_price2),
                        offer_price3: parseNumeric(offer.offer_price3)
                    };
                }
            })
        );

        res.json({
            success: true,
            count: offersWithDetails.length,
            offers: offersWithDetails
        });

    } catch (err) {
        console.error("❌ خطأ في جلب العروض:", err);
        console.error("تفاصيل الخطأ:", err.stack);
        
        res.status(500).json({
            success: false,
            message: "حدث خطأ أثناء جلب العروض",
            error: err.message,
            query: err.query || 'غير معروف'
        });
    }
});

// ======================== 🔍 جلب العروض النشطة فقط ========================
router.get("/active", async (req, res) => {
    try {
        const query = `
            SELECT 
                o.offer_id,
                o.item_id,
                o.store_id,
                o.offer_price1,
                o.offer_price2,
                o.offer_price3,
                o.start_date,
                o.end_date,
                o.is_active,
                o.created_by,
                o.created_at
            FROM public.item_price_offers o
            WHERE o.is_active = true 
            AND CURRENT_DATE BETWEEN o.start_date AND COALESCE(o.end_date, CURRENT_DATE)
            ORDER BY o.start_date DESC
        `;

        const result = await pool.query(query);
        
        // إضافة الأسماء وتحويل القيم الرقمية
        const offersWithDetails = await Promise.all(
            result.rows.map(async (offer) => {
                const itemName = await getItemName(offer.item_id);
                const storeName = await getStoreName(offer.store_id);
                
                return {
                    ...offer,
                    item_nm: itemName,
                    store_name: storeName,
                    offer_price1: parseNumeric(offer.offer_price1),
                    offer_price2: parseNumeric(offer.offer_price2),
                    offer_price3: parseNumeric(offer.offer_price3)
                };
            })
        );
        
        res.json({
            success: true,
            count: offersWithDetails.length,
            offers: offersWithDetails
        });

    } catch (err) {
        console.error("❌ خطأ في جلب العروض النشطة:", err);
        res.status(500).json({
            success: false,
            message: "حدث خطأ أثناء جلب العروض النشطة",
            error: err.message
        });
    }
});

// ======================== 🏪 جلب عروض مخزن معين ========================
router.get("/store/:store_id", async (req, res) => {
    const { store_id } = req.params;

    try {
        const storeIdNum = parseInt(store_id);
        if (isNaN(storeIdNum)) {
            return res.status(400).json({
                success: false,
                message: "معرف المخزن يجب أن يكون رقماً"
            });
        }

        const query = `
            SELECT 
                o.offer_id,
                o.item_id,
                o.store_id,
                o.offer_price1,
                o.offer_price2,
                o.offer_price3,
                o.start_date,
                o.end_date,
                o.is_active,
                o.created_by,
                o.created_at
            FROM public.item_price_offers o
            WHERE o.store_id = $1
            ORDER BY o.is_active DESC, o.start_date DESC
        `;

        const result = await pool.query(query, [storeIdNum]);
        
        // إضافة الأسماء وتحويل القيم الرقمية
        const offersWithDetails = await Promise.all(
            result.rows.map(async (offer) => {
                const itemName = await getItemName(offer.item_id);
                const storeName = await getStoreName(offer.store_id);
                
                return {
                    ...offer,
                    item_nm: itemName,
                    store_name: storeName,
                    offer_price1: parseNumeric(offer.offer_price1),
                    offer_price2: parseNumeric(offer.offer_price2),
                    offer_price3: parseNumeric(offer.offer_price3)
                };
            })
        );
        
        res.json({
            success: true,
            store_id: storeIdNum,
            count: offersWithDetails.length,
            offers: offersWithDetails
        });

    } catch (err) {
        console.error(`❌ خطأ في جلب عروض المخزن ${store_id}:`, err);
        res.status(500).json({
            success: false,
            message: "حدث خطأ أثناء جلب عروض المخزن",
            error: err.message
        });
    }
});

// ======================== 📊 إحصائيات العروض ========================
router.get("/stats", async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                COUNT(*) as total_offers,
                COUNT(CASE WHEN is_active = true AND CURRENT_DATE BETWEEN start_date AND COALESCE(end_date, CURRENT_DATE) THEN 1 END) as active_offers,
                COUNT(DISTINCT store_id) as stores_count,
                COUNT(DISTINCT item_id) as items_count
            FROM public.item_price_offers
        `;

        const result = await pool.query(statsQuery);
        
        res.json({
            success: true,
            stats: result.rows[0]
        });

    } catch (err) {
        console.error("❌ خطأ في جلب الإحصائيات:", err);
        res.status(500).json({
            success: false,
            message: "حدث خطأ أثناء جلب الإحصائيات",
            error: err.message
        });
    }
});

export default router;