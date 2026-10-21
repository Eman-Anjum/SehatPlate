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
- Module 1: scaffold, /health, users + scans tables (verified).
- Module 2: login (auth.js), requireAuth, GET /me, login page. Register route
  state UNVERIFIED; register bug open ("Authentication required").
## NOT built yet
- Module 3 (2FA). The earlier "Phase 3" was only login. No twofa.js, no otplib.