# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project Overview

> For a comprehensive, non-technical description of AI Tutor (features, user roles, workflows, future roadmap), see **[SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md)**.

Stack:
- React Router v7 frontend (`app/`) — SPA mode (`ssr: false`)
- Express 5 + Prisma backend (`server/`)
- Better Auth session cookies (no JWT)
- PostgreSQL (via Prisma)

## Current Architecture

### Frontend (`app/`)
- Route config: `app/routes.ts`
- Route modules:
  - `home.tsx`
  - `student.tsx`, `student.course.tsx`, `student.topic.tsx`, `student.list.tsx`
  - `instructor.tsx`, `instructor.course.tsx`, `instructor.topic.tsx`, `instructor.list.tsx`
  - `admin.tsx`
- Auth state/context: `app/hooks/useLocalUser.tsx`
  - Despite the name, this is not JWT/localStorage auth.
  - It stores user state in React context and calls API endpoints.
- Route guards: `app/lib/client-auth.ts` (`requireClientUser` calls `/api/me`)
- API client: `app/lib/api.ts` (all requests include `credentials: "include"`)

### Backend (`server/src/`)
- Entry: `server/src/index.js`
- Better Auth config: `server/src/auth.js`
- Session middleware and RBAC helpers: `server/src/middleware/auth.js`
- Current user endpoint: `server/src/routes/authentication.js` (`GET /api/me`)
- Domain routes:
  - `courses.js`, `modules.js`, `lessons.js`, `activities.js`, `topics.js`
  - `prompts.js`, `suggested-prompts.js`, `ai-models.js`, `admin.js`

## Authentication And Session Model (Current)

This repo uses Better Auth session cookies, not JWT bearer headers.

How auth works now:
1. Better Auth endpoints are mounted at `'/api/auth/{*any}'`.
2. Client sign-in/sign-up uses Better Auth endpoints such as:
   - `POST /api/auth/sign-in/email`
   - `POST /api/auth/sign-up/email`
   - `POST /api/auth/sign-out`
3. Session is stored in cookies and sent automatically with `credentials: "include"`.
4. Backend resolves session via `auth.api.getSession(...)` in `attachSession`.
5. App code reads authenticated user through `GET /api/me`.
6. Protected API routes require `req.user` via `requireAuth`/`requireRole`.

Important:
- No `Authorization: Bearer ...` flow.
- No JWT token storage/refresh logic in `localStorage`.
- `/api/me` is the stable app-level identity endpoint used by route guards/loaders.

### Role Behavior
- Roles: `STUDENT`, `INSTRUCTOR`, `ADMIN` (see [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md) for full permissions).
- Most API routes require auth; admin users are restricted to `/api/me` and `/api/admin/*` by middleware.

## API Surface (Practical Summary)

Public-ish endpoints:
- `GET /api/health`
- Better Auth endpoints under `/api/auth/*`

Session-backed app endpoint:
- `GET /api/me`

Main resource groups (all auth-protected unless explicitly bypassed):
- `/api/courses` (+ import/publish/unpublish/external import helpers)
- `/api/modules`
- `/api/lessons`
- `/api/activities`
- `/api/questions/:id/answer`
- `/api/courses/:courseId/topics` (+ sync/remap)
- `/api/prompts`
- `/api/suggested-prompts`
- `/api/ai-models`
- `/api/admin/*`

## Frontend Routing (Actual Paths)

Defined in `app/routes.ts`:
- `/`
- `/admin`
- `/student`
- `/student/courses/:courseId`
- `/student/module/:moduleId`
- `/student/lesson/:lessonId`
- `/instructor`
- `/instructor/courses/:courseId`
- `/instructor/module/:moduleId`
- `/instructor/lesson/:lessonId`

Do not reference stale names like `instructor.module.tsx` or `student.module.tsx`; they are not route files in this repo.

## Bun-First Commands

### Setup
```bash
bun install
cd server && bun install

docker compose up -d db
cd server && bunx prisma migrate deploy
cd server && bun run seed
```

### Development
```bash
# frontend (React Router dev server)
bun run dev

# backend API server (nodemon)
cd server && bun run dev

# type generation + TS check
bun run typecheck
```

### Build And Start
```bash
# frontend build
bun run build

# preview built frontend assets
bun run start

# start backend API
cd server && bun run start
```

Notes:
- Root `start` script runs `vite preview --outDir build/client` (frontend preview only).
- API is a separate process (`server/src/index.js`).

## SPA Build/Deployment Reality

- `react-router.config.ts` sets `ssr: false`.
- `bun run build` generates SPA output in `build/client`.
- Deployment should treat frontend as static assets plus a separate Express API service.

Current `Dockerfile` is npm-based and runs root `start`; it serves the frontend preview bundle, not the Express API process.

## Environment Variables In Use

Frontend:
- `VITE_API_URL` (defaults to `http://localhost:4000` in client code)

Backend:
- `DATABASE_URL`
- `PORT` (default `4000`)
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` (default `http://localhost:4000/api/auth`)
- `COOKIE_DOMAIN` (default `localhost`)
- `EDUAI_BASE_URL` (default `http://localhost:5174/api`)
- `EDUAI_API_KEY`
- `EDUAI_MODEL`
- `AI_SUPERVISOR_ENABLED` (present in env example; runtime behavior currently driven by AI model policy)

No `JWT_SECRET` is used by the current auth flow.

## Testing/Lint/Format/Hooks Status (Current Repo)

Current tracked scripts/config indicate:
- Root `package.json` has `bun run test` and `bun run typecheck`.
- `server/package.json` has a placeholder `test` script that exits with error.
- No tracked first-class config/scripts for `oxlint` or `oxfmt`.
- Repository includes `.githooks/` scripts for `commit-msg`, `prepare-commit-msg`, `post-commit`, and `pre-push` (Entire CLI integration); no tracked `pre-commit` hook script.
- Current first-party test coverage in this repo is limited (for example, `app/lib/tours/tour-engine.test.ts`).

Practical baseline check before shipping:
- `bun run typecheck`
- `bun run test`
- manual frontend/backend smoke testing

## Practical Editing Notes

- Keep `app/lib/api.ts` request/response shapes aligned with server route handlers and `server/src/utils/mappers.js`.
- Preserve cookie-session semantics (`credentials: include`) when touching auth-related client code.
- For route protection, prefer existing `requireClientUser(...)` pattern over introducing legacy token guards.
