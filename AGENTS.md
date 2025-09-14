# Repository Guidelines

## Project Structure & Module Organization
- `app/`: React Router front end (routes, components, hooks, lib, `root.tsx`, `app.css`). Route modules use dot-delimited names (e.g., `app/routes/instructor.list.tsx`).
- `server/`: Node/Express API with Prisma (`src/`, `prisma/`, `.env`).
- `public/`: Static assets. `build/`: output after `npm run build` (`client/` and `server/`).
- Top-level config: `react-router.config.ts`, `vite.config.ts`, `tsconfig.json`, Docker files.

## Build, Test, and Development Commands
- Install deps: `npm install` (root) and optionally `cd server && npm install`.
- Start DB: `docker compose up -d db` (Postgres on `localhost:54321`).
- Migrate/seed: `cd server && npx prisma migrate deploy && npm run seed`.
- API dev: `cd server && npm run dev` (http://localhost:4000).
- Web dev: `npm run dev` (http://localhost:5173). Override API with `VITE_API_URL`.
- Type check: `npm run typecheck`.
- Build: `npm run build`. Serve built app: `npm start` (uses `./build/server/index.js`).

## Coding Style & Naming Conventions
- TypeScript + ESM; 2-space indentation; trailing commas where sensible.
- Components: PascalCase (e.g., `Nav.tsx`). Variables/functions: camelCase. Routes: lowercase dot-delimited files in `app/routes/`.
- Styling via Tailwind CSS classes. Keep UI logic in components; data calls in `app/lib/`.

## Testing Guidelines
- No test runner is configured yet. If adding tests:
  - Front end: prefer Vitest + React Testing Library under `app/__tests__/`.
  - API: use Vitest/Jest + Supertest under `server/test/`.
  - Aim for coverage on routes, data loaders, and API handlers. Ensure `npm run typecheck` passes.

## Commit & Pull Request Guidelines
- Commits: short, imperative subject (e.g., "Add instructor list view"), optional scope. Group related changes.
- PRs: clear description, rationale, and screenshots or curl examples for API changes. Link issues. Note any schema or env var changes.
- CI not configured; before merging, verify dev servers run, build succeeds, and seed works against local Postgres.

## Security & Configuration Tips
- Server reads `DATABASE_URL` (example: `postgresql://postgres:postgres@localhost:54321/aitutor`). Keep secrets in `server/.env` (not committed).
- Front end can target the API with `VITE_API_URL`.
