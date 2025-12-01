import express from 'express';
const router = express.Router();
import pool from '../db.js';

// تقرير المبيعات
router.get('/sales', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const result = await pool.query(`
      SELECT * FROM sales 
      WHERE tran_date BETWEEN $1 AND $2 
      ORDER BY tran_date DESC
    `, [start_date, end_date]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// تقرير المخزون
router.get('/inventory', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT store_name, item_name, item_qty 
      FROM a_master 
      LEFT JOIN stores ON a_master.store_id = stores.store_id
      LEFT JOIN items ON a_master.item_id = items.item_id
      ORDER BY item_qty ASC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;