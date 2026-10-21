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

## Not built yet

- Module 4b (auth hardening), Module 5 (Groq AI layer and POST /dish/identify), follow-up questions, verdict logic, history endpoint, and full frontend scan flow.

## Gotchas

- `package.json` must keep `"type": "module"`.
- Vite proxy must list every route prefix (e.g. `/auth`, `/me`, `/dish`).
- Preview proxy strips headers, so send `access_token` as query param and `temp_token` inside the JSON body.
