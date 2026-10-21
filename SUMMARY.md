# SehatPlate — Project Summary

## Project
AI food guide for Pakistani dishes. User uploads a photo or types a dish name,
picks a condition, confirms AI's guess, answers follow-up questions, and gets a
verdict (Safe / Moderation / Avoid) with reason, swaps, and disclaimer.

## Stack
- Frontend: React 18 + Vite 4, served on port 5173 (dev) via Vite proxy
- Backend: Express on port 3001 (`API_PORT`), proxied by Vite for `/health` and `/api`
- Database: PostgreSQL via `DATABASE_URL` (pg ^8.11.3, shared pool max 5)
- AI: Groq (server-side only, server/ai.js — future module)

## Done
- Module 1: scaffold, /health, users + scans tables.
- Module 2: register, login, requireAuth, GET /me, login page (verified).
- Vite proxy configuration: /auth and /me proxied to Express alongside /api and /health.
- Module 3a (2FA backend) done: POST /auth/2fa/setup, /auth/2fa/verify, /auth/2fa/login; TOTP + 8 hashed recovery codes; temp_token flow.
- Module 3b (2FA frontend) done.
- Module 4 done: server/dish_rules.json (10 dishes, schema in file).
- Phase 6 (Client Auth Page & API Helpers) done: Register/Login toggle form, token storage, authenticated requests, 2FA login step, Enable-2FA setup flow (QR + recovery codes + verify), Logout, loading spinners, error/success feedback; `src/hooks/useAuth.js` added; `src/api.js` JSDoc-annotated and `loginUser` returns data unchanged on `requires_2fa`.

## NOT built yet
- Groq dish identify, verdict, scan UI, history.

## Gotchas
- package.json needs "type": "module". Never set the VITE_API_URL secret.
- Express on 3001; Vite proxy must list every route prefix (/auth, /me, /api, /health, /dish).
- The preview proxy strips Authorization, cookies and custom headers. Only the
  body, query string and Content-Type arrive. The client sends the token as
  ?access_token=... and requireAuth reads it first. temp_tokens go in the JSON body.