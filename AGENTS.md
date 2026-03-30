# Repository Guidelines

## Project Structure & Module Organization
- `app/` hosts the React Router v7 client. `app/routes.ts` maps file-based routes under `app/routes/`, powering `home.tsx` for login, `student.*.tsx` dashboards, and `instructor.*.tsx` authoring screens. Better Auth session state is managed in `app/hooks/useLocalUser.tsx`, shared UI in `app/components/` (e.g. `ActivityDetailsCard.tsx`), helpers in `app/lib/`, and Tailwind v4 utilities in `app/app.css`; `app/root.tsx` renders the HTML shell.
- `server/` is the Express 5 API (`src/index.js`) with Better Auth config in `src/auth.js`, session middleware in `src/middleware/`, route handlers in `src/routes/`, cloning helpers in `src/services/`, and response mappers in `src/utils/mappers.js`. Prisma schema and seeds live under `prisma/`.
- `public/` holds static assets; builds land in `build/client` only (SPA mode with `ssr: false`). Configs (`vite.config.ts`, `react-router.config.ts`, `tsconfig.json`) coordinate Tailwind, SPA builds, and the `~/` alias.

## Build, Test, and Development Commands
- Use Bun for all scripts locally (`bun install`, `bun run`, and `bunx`).
- `bun run dev` — Vite dev server at `http://localhost:5173` with hot reload.
- `cd server && bun run dev` — Express API with nodemon on port 4000.
- `cd server && bunx prisma migrate deploy` — apply migrations.
- `cd server && bun run seed` — reset and seed demo data after schema updates.
- `bun run build` — build SPA assets into `build/client`.
- `bun run start` — preview the built SPA with `vite preview --outDir build/client`.
- `bun run typecheck` — regenerate React Router types and run `tsc`.

## Coding Style & Naming Conventions
- TypeScript strict mode, 2-space indentation, and Tailwind-first styling. Components PascalCase, hooks camelCase, route modules lowercase with dots (`instructor.list.tsx`), Prisma models PascalCase.
- Keep `app/lib/api.ts` aligned with backend mappers; document non-trivial flows such as cloning or AI prompts with concise comments only when necessary.

## Testing Guidelines
- Root has `bun run test` (Bun test runner) for frontend/unit tests.
- `cd server && bun run test` is currently a placeholder script that exits with an error.
- Current baseline verification commands: `bun run typecheck` and `bun run test`.
- There are no first-class `lint`/`format` scripts in root or `server/package.json`; treat lint/format tooling as not yet standardized in-package.
- Add regression tests whenever auth, role gating, or cloning logic changes.

## Commit & Pull Request Guidelines
- Prefer Conventional Commits (`feat:`, `fix:`, `refactor:`) seen in history (`refactor: Remove activityTypeId ...`). Keep subjects imperative and under 72 chars.
- PRs should outline scope, affected routes or endpoints, manual verification, and linked issues. Attach screenshots or GIFs for UI work and flag migrations or seed updates.

## Environment & Configuration Tips
- Client reads `VITE_API_URL`; server uses `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `COOKIE_DOMAIN`, `EDUAI_API_KEY`, `EDUAI_BASE_URL`, `EDUAI_MODEL`, and `AI_SUPERVISOR_ENABLED` in `server/.env`.
- `BETTER_AUTH_URL` defaults to `http://localhost:4000/api/auth` and `EDUAI_BASE_URL` defaults to `http://localhost:5174/api` when unset.
- Ensure Postgres is running before migrations or seeds.
- After modifying Tailwind, routing, or the Prisma schema, rerun `bun run typecheck` and refresh seeds to keep generated artifacts aligned.
