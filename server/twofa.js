import { Router } from 'express';
import { authenticator } from 'otplib';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from './db.js';
import { requireAuth, issueToken } from './auth.js';

const router = Router();

const JWT_SECRET = process.env.SESSION_SECRET;

const verifySchema = z.object({
  code: z.string().min(1, 'Code is required'),
});

const twoFaLoginSchema = z
  .object({
    temp_token: z.string().min(1, 'Temp token is required'),
    code: z.string().optional(),
    recovery_code: z.string().optional(),
  })
  .refine((data) => !!(data.code || data.recovery_code), {
    message: 'Either code or recovery_code is required',
  });

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map();

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error('2FA error:', err.message);
      return res.status(500).json({ detail: '2FA operation failed' });
    });
  };
}

function generateRecoveryCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    codes.push(crypto.randomBytes(5).toString('hex').toUpperCase());
  }
  return codes;
}

async function getUserById(userId) {
  const result = await pool.query(
    'SELECT id, email, totp_secret, totp_enabled, recovery_codes FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

function trackFailedAttempt(userId) {
  const now = Date.now();
  const record = attempts.get(userId);
  if (!record || now > record.resetAt) {
    attempts.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  record.count += 1;
  return record.count > MAX_ATTEMPTS;
}

function clearAttempts(userId) {
  attempts.delete(userId);
}

router.post(
  '/2fa/setup',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }
    if (user.totp_enabled) {
      return res.status(409).json({ detail: '2FA is already enabled' });
    }

    const secret = authenticator.generateSecret();
    const recoveryCodes = generateRecoveryCodes(8);
    const hashedCodes = await Promise.all(
      recoveryCodes.map((code) => bcrypt.hash(code, 10))
    );

    await pool.query(
      'UPDATE users SET totp_secret = $1, totp_enabled = false, recovery_codes = $2 WHERE id = $3',
      [secret, JSON.stringify(hashedCodes), req.userId]
    );

    const otpauthUri = authenticator.keyuri(user.email, 'SehatPlate', secret);

    return res.status(200).json({
      secret,
      otpauth_uri: otpauthUri,
      recovery_codes: recoveryCodes,
    });
  })
);

router.post(
  '/2fa/verify',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      return res.status(400).json({ detail: message });
    }

    const user = await getUserById(req.userId);
    if (!user || !user.totp_secret) {
      return res.status(400).json({ detail: '2FA setup not found' });
    }
    if (user.totp_enabled) {
      return res.status(409).json({ detail: '2FA is already enabled' });
    }

    const valid = authenticator.verify({
      token: parsed.data.code,
      secret: user.totp_secret,
      window: 1,
    });

    if (!valid) {
      return res.status(400).json({ detail: 'Invalid verification code' });
    }

    await pool.query('UPDATE users SET totp_enabled = true WHERE id = $1', [
      req.userId,
    ]);

    return res.status(200).json({ enabled: true });
  })
);

router.post(
  '/2fa/login',
  asyncHandler(async (req, res) => {
    const parsed = twoFaLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join(', ');
      return res.status(400).json({ detail: message });
    }

    const { temp_token: tempToken, code, recovery_code: recoveryCode } =
      parsed.data;

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET, { algorithms: ['HS256'] });
    } catch (_) {
      return res.status(401).json({ detail: 'Invalid or expired temp token' });
    }

    if (decoded.typ !== '2fa') {
      return res.status(401).json({ detail: 'Invalid or expired temp token' });
    }

    const userId = decoded.sub;
    const user = await getUserById(userId);
    if (!user) {
      return res.status(401).json({ detail: 'Invalid or expired temp token' });
    }

    const blocked = trackFailedAttempt(userId);
    if (blocked) {
      return res
        .status(429)
        .json({ detail: 'Too many failed attempts. Try again later.' });
    }

    let success = false;

    if (code) {
      success = authenticator.verify({
        token: code,
        secret: user.totp_secret,
        window: 1,
      });
    } else if (recoveryCode && Array.isArray(user.recovery_codes)) {
      const hashes = user.recovery_codes;
      for (let i = 0; i < hashes.length; i += 1) {
        if (await bcrypt.compare(recoveryCode, hashes[i])) {
          const remaining = hashes.filter((_, idx) => idx !== i);
          await pool.query(
            'UPDATE users SET recovery_codes = $1 WHERE id = $2',
            [remaining.length ? JSON.stringify(remaining) : null, userId]
          );
          success = true;
          break;
        }
      }
    }

    if (!success) {
      return res
        .status(401)
        .json({ detail: 'Invalid code or recovery code' });
    }

    clearAttempts(userId);
    const accessToken = issueToken(userId);
    return res.status(200).json({ access_token: accessToken });
  })
);

export default router;
