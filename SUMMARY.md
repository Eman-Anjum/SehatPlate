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
- Module 7 Phase 1: `server/verdict.js` — pure-logic verdict engine (no Groq, no DB). Reads `dish_rules.json` for `min_verdict`, dish escalations (string + array answer matching), `common_escalations`, and applies a hard stricter-wins override chain. Confidence < 0.6 or any unanswered applicable question forces ≥ Moderation. Groq failure/invalid output falls back to rules reason + swaps (or generic cautious text for unlisted dishes). Forbidden medical language is stripped from AI-generated reason text. `server/verdictRoute.js` mounts a Phase 1 skeleton at POST /verdict (no Groq yet). Full Vitest coverage in `server/verdict.test.js`.

## Not built yet

- Groq proposal integration for /verdict (Phase 2).
- Zod validation + per-user rate limiter on /verdict (Phase 3).
- Verdict response shaping and safety disclaimers (Phase 4).
- Scan result persistence (Phase 5).
- Full frontend scan flow integration.

## Gotchas

- `package.json` must keep `"type": "module"`.
- Vite proxy must list every route prefix (e.g. `/auth`, `/me`, `/dish`).
- Preview proxy strips headers, so send `access_token` as query param and `temp_token` inside the JSON body.
