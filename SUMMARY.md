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

## Done — Module 1
- `db/migrations/001_init.sql` — users + scans tables with JSONB columns matching agent.md
- Applied migration via `apply_migration` (tables exist in DB)
- `server/index.js` — Express, helmet, CORS (FRONTEND_ORIGIN), GET /health, JSON error handler
- `vite.config.js` — @vitejs/plugin-react, proxy `/health` + `/api` → localhost:3001
- `src/api.js` — getHealth() using relative URL (works via proxy) or VITE_API_URL
- `src/App.jsx` — shows "SehatPlate" + /health JSON response
- `package.json` — dev script runs server (node --watch) + vite concurrently
- `.env.example` — all secrets from agent.md except DATABASE_URL and SESSION_SECRET

## Done — Module 2
- `server/register.js` — POST /auth/register (Zod validation, bcryptjs password hash, lowercased/unique email)

## Done — Module 3 (Phase 3)
- `server/auth.js` — POST /auth/login: Zod validation, email normalization, bcryptjs credential check, JWT HS256 issuance (sub=user.id, exp=JWT_EXPIRE_MINUTES default 60); 200 {access_token} on success, 401 {detail:"Invalid email or password"} on bad credentials, 500 on DB error
- `server/index.js` — removed duplicate registerRouter mount; authRouter now handles both /auth/register and /auth/login
- `requireAuth` exported from auth.js for use in later phases (Bearer token, HS256 verify)
