import express from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

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
    // Unique violation: duplicate email
    if (err.code === '23505') {
      return res.status(409).json({ detail: 'Email already registered' });
    }
    return res.status(500).json({ detail: 'Registration failed' });
  }
});

export default router;
