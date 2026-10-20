import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pkg from 'pg';
const { Pool } = pkg;

// Validate DATABASE_URL scheme before anything else
if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL is not set. Add it in the Secrets panel.');
  process.exit(1);
}

const urlScheme = process.env.DATABASE_URL.split(':')[0];
if (urlScheme !== 'postgresql' && urlScheme !== 'postgres') {
  console.error(`Unsupported database scheme: ${urlScheme}. Expected postgres:// or postgresql://.`);
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

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

// JSON error handler
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 400;
  res.status(status).json({ detail: err.message || 'Unknown error' });
});

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
