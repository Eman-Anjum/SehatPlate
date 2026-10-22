# SehatPlate

AI food guide for Pakistani dishes. Users upload a photo or type a dish name, choose a condition, answer follow-up questions, and receive a verdict (Safe / Moderation / Avoid) with swaps and a medical disclaimer.

## Stack

- Frontend: React + Vite.
- Backend: Node.js + Express, Zod, JWT + bcryptjs, TOTP recovery codes.
- Database: PostgreSQL via platform migrations.
- AI: Groq API called only from `server/ai.js`.

## Done

- Module 1: backend skeleton, health check, database pool, `users`/`scans` models via migration.
- Module 5a: Groq AI layer (`identifyDish`, defensive parsing, retries) with Vitest tests; no routes.
- Module 5b: POST /dish/identify (image via Groq or typed name via dish_rules.json, 10 req/min per user); npm test not run here (no shell), please run it.
- POST /dish/questions: returns condition-aware follow-up questions (known dish filtered by condition + common_questions, or AI-generated for unknown dish with in-memory cache).
- GET /history: authenticated user's scans from the database, newest first, max 50 rows.
- Vitest tests for /dish/questions and /history endpoints: known dish, alias matching, condition filtering, unknown dish with generateQuestions, AI failure fallback, bad condition returns 400.
- Modules 2-4a: register, login, /me, 2FA endpoints and src/pages/AuthPage.jsx exist.
## Not built yet

- verdict logic, full frontend scan flow integration.

## Gotchas

- `package.json` must keep `"type": "module"`.
- Vite proxy must list every route prefix (e.g. `/auth`, `/me`, `/dish`).
- Preview proxy strips headers, so send `access_token` as query param and `temp_token` inside the JSON body.
