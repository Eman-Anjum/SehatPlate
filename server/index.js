import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pkg from 'pg';
const { Pool } = pkg;
import process from 'process';

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

// Check database URL scheme
if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL is not set');
  process.exit(1);
}

const urlScheme = process.env.DATABASE_URL.split(':')[0];
if (urlScheme !== 'postgresql' && urlScheme !== 'postgres') {
  console.error(`Unsupported database scheme: ${urlScheme}`);
  process.exit(1);
}

// Middleware
app.use(helmet());
app.use(express.json());

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '';
app.use(cors({ origin: FRONTEND_ORIGIN }));

// Routes
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: true });
  } catch (err) {
    res.json({ status: 'ok', db: false });
  }
});

// JSON error handler
app.use((err, req, res, next) => {
  if (err) {
    res.status(400).json({ detail: err.message });
  } else {
    next();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
