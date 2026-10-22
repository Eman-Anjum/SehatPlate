import { Router } from 'express';
import { requireAuth } from './auth.js';
import { pool } from './db.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    // Use the same column names as the insert in verdictRoute and the same user id
    const result = await pool.query(
      'SELECT id, user_id, dish, condition, verdict, reason, swaps, created_at FROM scans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.userId]
    );
    return res.json({ scans: result.rows });
  } catch (err) {
    console.error('/history error:', err);
    return res.status(500).json({ detail: 'Failed to fetch history' });
  }
});

export default router;
