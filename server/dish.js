import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { requireAuth } from './auth.js';
import { identifyDish, AIError } from './ai.js';

const router = Router();

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Load the dish rules once at startup (typed names are matched against them).
const rules = JSON.parse(
  readFileSync(new URL('./dish_rules.json', import.meta.url), 'utf8')
);
const knownNames = new Map(); // lowercase name/alias -> canonical dish name
for (const dish of rules.dishes || []) {
  knownNames.set(String(dish.name).toLowerCase(), dish.name);
  for (const alias of dish.aliases || []) {
    knownNames.set(String(alias).toLowerCase(), dish.name);
  }
}

const nameSchema = z.string().trim().min(1, 'Dish name is required').max(100, 'Dish name is too long');

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.userId),
  handler: (req, res) =>
    res.status(429).json({ detail: 'Too many requests. Please wait a minute and try again.' }),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.has(file.mimetype)) return cb(null, true);
    const err = new Error('Only JPEG, PNG or WebP images are allowed.');
    err.code = 'BAD_FILE_TYPE';
    return cb(err);
  },
}).single('image');

function handleUpload(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ detail: 'Image is too large. Maximum size is 5 MB.' });
    }
    if (err.code === 'BAD_FILE_TYPE') {
      return res.status(400).json({ detail: err.message });
    }
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ detail: 'Invalid upload. Send one image in the "image" field.' });
    }
    return res.status(400).json({ detail: 'Could not read the upload.' });
  });
}

function identifyByName(name) {
  const canonical = knownNames.get(name.toLowerCase());
  return canonical
    ? { dish_guess: canonical, confidence: 0.9 }
    : { dish_guess: name, confidence: 0.5 };
}

router.post('/identify', requireAuth, limiter, handleUpload, async (req, res) => {
  try {
    if (req.file) {
      const result = await identifyDish({
        imageBuffer: req.file.buffer,
        mimeType: req.file.mimetype,
      });
      return res.json(result);
    }

    const rawName = req.body && req.body.name;
    if (rawName === undefined || rawName === null) {
      return res.status(400).json({ detail: 'Please provide a photo or a dish name.' });
    }
    const parsed = nameSchema.safeParse(rawName);
    if (!parsed.success) {
      return res.status(400).json({ detail: parsed.error.errors.map((e) => e.message).join(', ') });
    }
    return res.json(identifyByName(parsed.data));
  } catch (err) {
    if (err instanceof AIError) {
      return res.status(err.status).json({ detail: err.message });
    }
    console.error('/dish/identify error:', err && err.message);
    return res.status(500).json({ detail: 'Something went wrong. Please try again.' });
  }
});

export default router;
