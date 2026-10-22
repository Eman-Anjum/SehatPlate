import { Router } from 'express';
import { requireAuth } from './auth.js';
import { pool } from './db.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, user_id, dish, condition, verdict, created_at FROM scans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.userId]
    );
    return res.json({ scans: result.rows });
  } catch (err) {
    console.error('/history error:', err && err.message);
    return res.status(500).json({ detail: 'Failed to fetch history' });
  }
});

export default router;
