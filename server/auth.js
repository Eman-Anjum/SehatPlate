import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from './db.js';

const router = Router();

const JWT_SECRET = process.env.SESSION_SECRET;
const JWT_EXPIRE_MINUTES = Number(process.env.JWT_EXPIRE_MINUTES) || 60;

const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

function issueToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: `${JWT_EXPIRE_MINUTES}m`,
  });
}

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join(', ');
    return res.status(400).json({ detail: message });
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [normalizedEmail, passwordHash]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ detail: 'Email already registered' });
    }
    console.error('Register error:', err.message);
    return res.status(500).json({ detail: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => e.message).join(', ');
    return res.status(400).json({ detail: message });
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [normalizedEmail]
    );

    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ detail: 'Invalid email or password' });
    }

    const accessToken = issueToken(user.id);
    return res.status(200).json({ access_token: accessToken });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ detail: 'Login failed' });
  }
});

export function requireAuth(req, res, next) {
  let token = null;
  if (typeof req.query.access_token === 'string') token = req.query.access_token;
  if (!token) {
    const parts = (req.headers.authorization || '').split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') token = parts[1];
  }
  if (!token) {
    return res.status(401).json({ detail: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.userId = decoded.sub;
    return next();
  } catch (_) {
    return res.status(401).json({ detail: 'Invalid or expired token' });
  }
}
export default router;
