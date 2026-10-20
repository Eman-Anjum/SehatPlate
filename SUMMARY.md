# SehatPlate Project Summary

## Project
AI food guide for Pakistani dishes with React+Vite frontend, Express backend, PostgreSQL DB.

## Stack
- Frontend: React with Vite
- Backend: Express Node.js
- Database: PostgreSQL

## Done in Module 1
- Created PostgreSQL migration for users and scans tables with JSONB columns.
- Implemented Express server with GET /health endpoint, helmet, CORS limited to FRONTEND_ORIGIN, JSON error handler.
- Created React single page app showing "SehatPlate" and /health API result using VITE_API_URL.
- Root package.json with dev script running server and client concurrently.
- .env.example listing secrets except DATABASE_URL and SESSION_SECRET.

## Next modules
- Implement user auth and session management.
- Implement AI dish recognition and follow-up question flow.

## File map
- db/migrations/001_init.sql - DB schema for users and scans
- server/index.js - Express server with health endpoint
- src/api.js - client API calls
- src/App.jsx - React page
- src/main.jsx - React entry
- index.html - Vite HTML
- package.json - dependencies and scripts
- .env.example - environment variables

## Gotchas
- Database URL scheme checked for postgres, otherwise server exits.

## Known bugs
- None
