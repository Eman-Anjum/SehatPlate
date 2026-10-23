# SehatPlate

AI food guide for Pakistani dishes. The user picks a condition (diabetes, kidney disease, high blood pressure), uploads a photo or types a dish, answers follow-up questions, and gets a verdict (Safe / Moderation / Avoid) with reason, swaps and a medical disclaimer.

## Stack

- Frontend: React + Vite. Backend: Node.js + Express (`server/`), Zod, JWT + bcryptjs, TOTP 2FA, multer.
- Database: PostgreSQL via platform migrations (`db/migrations/`).
- AI: Groq, called only from `server/ai.js`. Secrets: `GROQ_API_KEY`, `GROQ_TEXT_MODEL`, `GROQ_VISION_MODEL` (`qwen/qwen3.8-27b`).
- Rules: `server/dish_rules.json` (10 dishes, 3 conditions, common questions and escalations).
- Tests: Vitest + supertest, Groq mocked.

## Done (everything below is tested and working in the preview)

- Auth: register, login, `/me`, 2FA (TOTP + recovery codes), `src/pages/AuthPage.jsx`, `src/hooks/useAuth.js`, `src/api.js`.
- `POST /dish/identify` (photo via Groq, typed name matched locally) and `POST /dish/questions` (saved or AI-generated questions), 10 req/min per user.
- `POST /verdict`: Zod validation, 10 req/min per user, one Groq proposal, then the safety override in `server/verdict.js` (rules floor, escalations, confidence below 0.6 or unanswered question gives at least Moderation, the strictest result wins, so Groq can never go softer than the rules). Saves each scan with its answers. If Groq fails, it falls back to the rules.
- `GET /history`: the user's scans, newest first, max 50.
- Frontend: `src/pages/ScanPage.jsx` (condition, identify, confirm, questions, verdict badge, disclaimer, History tab) embedded in `AuthPage`, with 2FA setup kept.
- Safe is possible only where the rules floor is `null` (9 of 30 dish and condition pairs) and needs all questions answered, no escalating answer, confidence 0.6 or more, and a Groq proposal of Safe.

## Next steps

1. Rate limit `/auth/2fa/login`, `/auth/2fa/verify`, `/auth/2fa/setup` (the limiter in `server/index.js` covers only login and register).
2. Upgrade `multer` 1.x to 2.x, then retest photo scans.
3. Medical review of `dish_rules.json`; then add more dishes, one small insert at a time.
4. Password reset flow; privacy and terms text.
5. Publish with the platform's publish option and test with the real secrets.

## Gotchas

- `package.json` must keep `"type": "module"`. Never set `VITE_API_URL`.
- The Vite proxy must list every route prefix: /api, /health, /auth, /me, /dish, /history, /verdict.
- The preview proxy strips headers: send `access_token` as a query parameter and `temp_token` in the JSON body.
- `SESSION_SECRET` and `DATABASE_URL` are platform secrets; do not change them.
- Never rewrite `server/dish_rules.json`; make one small edit at a time.
- Do not edit or delete files in `db/migrations`. Migrations are applied only by a build.
- Groq retires models: a deprecated model id in a secret makes every Groq call fail and verdicts fall back to Moderation. Qwen 3.x models think first, so send `reasoning_effort: "none"` for `qwen/` models only.
- Keep the 2FA setup screen when editing `AuthPage.jsx`.
- `backend/` is an unused leftover; the live backend is `server/`.
