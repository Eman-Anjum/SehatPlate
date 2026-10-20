import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pool } from './db.js';
import authRouter, { requireAuth } from './auth.js';

if (!process.env.SESSION_SECRET) {
  console.error('Error: SESSION_SECRET is not set. Add it in the Secrets panel.');
  process.exit(1);
}

const app = express();

app.use(helmet());
app.use(express.json());

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '';
app.use(cors({ origin: FRONTEND_ORIGIN || false }));

// Health check
app.get('/health', async (req, res) => {
  let dbOk = false;
  try {
    await pool.query('SELECT 1');
    dbOk = true;
  } catch (_) {
    // db unreachable
  }
  res.json({ status: 'ok', db: dbOk });
});

// Auth routes — register + login both live in authRouter
app.use('/auth', authRouter);
app.get('/me', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT id, email, totp_enabled FROM users WHERE id = $1',
    [req.userId]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ detail: 'User not found' });
  }
  return res.json(result.rows[0]);
});

// JSON error handler
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ detail: err.message || 'Unknown error' });
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
