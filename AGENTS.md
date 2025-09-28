# Repository Guidelines

## Project Structure & Module Organization
- `app/` hosts the React Router v7 client. `app/routes.ts` maps file-based routes under `app/routes/`, powering `home.tsx` for login, `student.*.tsx` dashboards, and `instructor.*.tsx` authoring screens. JWT handling lives in `app/hooks/useLocalUser.ts`, shared UI in `app/components/`, helpers in `app/lib/`, and Tailwind v4 utilities in `app/app.css`; `app/root.tsx` renders the HTML shell.
- `server/` is the Express 5 API (`src/index.js`) with auth middleware in `src/middleware/`, route handlers in `src/routes/`, cloning helpers in `src/services/`, and response mappers in `src/utils/mappers.js`. Prisma schema and seeds live under `prisma/`.
- `public/` holds static assets; builds land in `build/client` (static) and `build/server` (SSR entry). Configs (`vite.config.ts`, `react-router.config.ts`, `tsconfig.json`) coordinate Tailwind, SSR, and the `~/` alias.

## Build, Test, and Development Commands
- `npm run dev` — Vite dev server at `http://localhost:5173` with hot reload.
- `cd server && npm run dev` — Express API with nodemon on port 4000.
- `cd server && npx prisma migrate deploy` — apply migrations.
- `cd server && npm run seed` — reset and seed demo data after schema updates.
- `npm run build` — emit SSR bundles for client/server.
- `npm run typecheck` — regenerate React Router types and run `tsc`.

## Coding Style & Naming Conventions
- TypeScript strict mode, 2-space indentation, and Tailwind-first styling. Components PascalCase, hooks camelCase, route modules lowercase with dots (`instructor.list.tsx`), Prisma models PascalCase.
- Keep `app/lib/api.ts` aligned with backend mappers; document non-trivial flows such as cloning or AI prompts with concise comments only when necessary.

## Testing Guidelines
- Frontend: Vitest + React Testing Library in `app/__tests__/`, naming tests after the unit (`Nav.test.tsx`).
- Backend: Vitest/Jest + Supertest in `server/test/`, covering RBAC paths, cloning helpers, and activity evaluation.
- Run `npm run typecheck` before PRs and add regression tests whenever auth, role gating, or cloning logic changes.

## Commit & Pull Request Guidelines
- Prefer Conventional Commits (`feat:`, `fix:`, `refactor:`) seen in history (`refactor: Remove activityTypeId ...`). Keep subjects imperative and under 72 chars.
- PRs should outline scope, affected routes or endpoints, manual verification, and linked issues. Attach screenshots or GIFs for UI work and flag migrations or seed updates.

## Environment & Configuration Tips
- Client reads `VITE_API_URL`; server needs `DATABASE_URL` and `JWT_SECRET` in `server/.env`. Ensure Postgres is running before migrations or seeds.
- After modifying Tailwind, routing, or the Prisma schema, rerun `npm run typecheck` and refresh seeds to keep generated artifacts aligned.
