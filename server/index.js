import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pool } from './db.js';
import authRouter, { requireAuth } from './auth.js';
import twofaRouter from './twofa.js';
import dishRouter from './dish.js';
import historyRouter from './history.js';
import verdictRouter from './verdictRoute.js';

if (!process.env.SESSION_SECRET) {
  console.error('Error: SESSION_SECRET is not set. Add it in the Secrets panel.');
  process.exit(1);
}

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json());

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '';
app.use(cors({ origin: FRONTEND_ORIGIN || false }));

// Rate limiter: 20 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many requests, please try again later.',
  standardHeaders: false,
  skip: (req) => {
    // Skip non-auth endpoints
    return !req.path.startsWith('/auth');
  },
});

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

// Auth routes
app.use('/auth', limiter, authRouter);
app.use('/auth', twofaRouter);
app.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, totp_enabled FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ detail: 'User not found' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('/me error:', err.message);
    return res.status(500).json({ detail: 'Failed to fetch user' });
  }
});

app.use('/dish', dishRouter);
app.use('/history', historyRouter);
app.use('/verdict', verdictRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ detail: 'Not found' });
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