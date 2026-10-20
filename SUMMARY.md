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

## Next modules
- Module 2: Auth (register, login, JWT, bcryptjs)
- Module 3: 2FA (TOTP + recovery codes)
- Module 4: Dish identify endpoint (Groq vision)
- Module 5: Follow-up questions + verdict logic
- Module 6: History page

## File map
| Path | Purpose |
|------|---------|
| `server/index.js` | Express entry, health endpoint |
| `src/App.jsx` | React root page |
| `src/api.js` | Client fetch helpers |
| `src/main.jsx` | React DOM entry |
| `index.html` | Vite HTML shell |
| `vite.config.js` | Vite + React plugin + proxy |
| `package.json` | Scripts and deps |
| `db/migrations/001_init.sql` | Schema reference |
| `.env.example` | Secret names (no values) |
| `SUMMARY.md` | This file |

## Gotchas
- Express on port 3001 (`API_PORT`); Vite on 5173. Vite proxy bridges them in dev.
- `FRONTEND_ORIGIN` must be set for CORS to allow browser requests in production.
- `DATABASE_URL` scheme is validated at startup; non-postgres → process exits.
- package.json needs "type": "module".
- Express API runs on port 3001; Vite on 5173 proxies /health, /api, /auth, /me to it.
- Do NOT set the VITE_API_URL secret. The client uses relative URLs. The platform's
  "needs VITE_API_URL" banner can be ignored.
- Preview needs vite --host (already set in vite.config.js).

## Known bugs
- None
