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

- Module 7 Phases 2-5: Groq proposal, validation, rate limit, response shaping, persistence for /verdict. `proposeVerdict`/`parseVerdictProposal` added to `server/ai.js` (reuse `callGroq` + defensive JSON parsing; one text-model call, temp 0.2, ~300 tokens, no medication/dosage/diagnosis advice, no citations). POST /verdict Zod-validates the body (400 `{detail}`), rate-limits 10 req/min per user (429 `{detail}`), applies the unchanged stricter-wins override from `server/verdict.js`, and responds `{scan_id, dish, dish_id, condition, verdict, reason, swaps, disclaimer, confidence, adjusted_for_safety}` — `adjusted_for_safety` is true only when a proposal existed and the final verdict is stricter. Any Groq failure/invalid output falls back to rules (never an error). Scan rows (with `answers` JSONB) are inserted best-effort; insert failure still returns the verdict with `scan_id: null`. Vitest route tests with the Groq call mocked: `server/verdictRoute.test.js` (npm test not run here — no shell; please run it).

## Not built yet

- Full frontend scan flow integration.

## Gotchas

- `package.json` must keep `"type": "module"`.
- Vite proxy must list every route prefix (e.g. `/auth`, `/me`, `/dish`).
- Preview proxy strips headers, so send `access_token` as query param and `temp_token` inside the JSON body.
