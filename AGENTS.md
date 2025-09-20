# Repository Guidelines

## Project Structure & Module Organization
- `app/`: React Router v7 front end (routes, components, hooks, lib, `root.tsx`, styling via `app.css`). Route files use dot-delimited lowercase names (e.g., `app/routes/instructor.list.tsx`).
- `server/`: Express + Prisma API (`src/` handlers, `middleware/`, `prisma/` schema, seeds). Runs independently from the web client.
- `public/`: Static assets shipped with the client bundle. `build/` is generated output after `npm run build` with `client/` and `server/` subdirectories.
- Top-level config: `react-router.config.ts`, `vite.config.ts`, `tsconfig.json`, Docker manifests, and docs such as this guide.

## Build, Test, and Development Commands
- `npm install` (root) and `cd server && npm install`: install client and API dependencies.
- `docker compose up -d db`: start the Postgres container on `localhost:54321`.
- `cd server && npx prisma migrate deploy && npm run seed`: apply migrations and seed demo data.
- `npm run dev`: start the React Router dev server at `http://localhost:5173`.
- `cd server && npm run dev`: run the Express API on `http://localhost:4000`.
- `npm run build`: produce SSR-ready output in `./build`.
- `npm run typecheck`: generate route types and run the TypeScript compiler (Node 20+ required).

## Coding Style & Naming Conventions
- Language: TypeScript (ESM) on both client and server. Use 2-space indentation and trailing commas where natural.
- Components: PascalCase (`Nav.tsx`), hooks/utilities: camelCase, routes: lowercase dot-delimited filenames.
- Styling handled with Tailwind CSS classes; prefer utility composition over bespoke CSS.

## Testing Guidelines
- No automated tests exist yet. When adding coverage, prefer Vitest + React Testing Library under `app/__tests__/` and Vitest/Jest + Supertest under `server/test/`.
- Mirror the route or handler path in the test filename (e.g., `app/__tests__/instructor.list.test.tsx`). Ensure `npm run typecheck` passes before opening a PR.

## Commit & Pull Request Guidelines
- Commits: concise, imperative subjects (e.g., "Add instructor prompt picker"). Group related changes and avoid mixing refactors with features.
- Pull requests: describe motivation, summarize changes, and flag schema or env tweaks. Attach screenshots or curl examples for UI/API impact and link relevant issues.

## Security & Configuration Tips
- `.env` files live in `server/.env` and must define `DATABASE_URL` and `JWT_SECRET`; never commit secrets.
- The frontend can target alternate APIs via `VITE_API_URL`.
- JWT tokens expire after 24h; re-run `npm run seed` to refresh demo credentials when needed.
