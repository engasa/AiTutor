# AiTutor

AiTutor is a full-stack learning platform with student, instructor, and admin experiences.

## Stack

- Frontend: React 19 + React Router v7 in SPA mode (`ssr: false`)
- Backend: Express 5 API (`server/`)
- Auth: Better Auth email/password with cookie-based sessions
- Data: Prisma ORM + PostgreSQL

## Architecture At A Glance

- `app/`: client routes/UI and API client (`VITE_API_URL`, default `http://localhost:4000`)
- `server/`: Express routes, Better Auth endpoints (`/api/auth/*`), Prisma-backed services
- `server/prisma/`: schema, migrations, and seed script
- `docs/two-agent-supervisor-system.md`: two-agent AI tutoring design

## Local Setup (Bun + Docker)

1. Install root dependencies:
```bash
bun install
```
2. Install server dependencies:
```bash
cd server
bun install
cd ..
```
3. Create server env file:
```bash
cp server/.env.example server/.env
```
4. Start PostgreSQL:
```bash
docker compose up -d db
```
5. Apply migrations:
```bash
cd server
bunx prisma migrate deploy
```
6. (Optional) Seed demo data:
```bash
bun run seed
```
Warning: `bun run seed` is destructive in this repository (it clears and recreates demo data).

## Run The App (Two Terminals)

1. Backend:
```bash
cd server
bun run dev
```
Backend runs at `http://localhost:4000`.

2. Frontend:
```bash
cd /path/to/AiTutor   # repo root
bun run dev
```
Frontend runs at `http://localhost:5173`.

Authentication is real (not simulated): users sign in/sign up through Better Auth and API calls use cookie sessions (`credentials: include`).

## Current Commands And Verification

Root (`package.json`):
- `bun run dev`
- `bun run build`
- `bun run start`
- `bun run typecheck`
- `bun run test`
- `bun run e2e:oauth-matrix`

Server (`server/package.json`):
- `bun run dev`
- `bun run start`
- `bun run seed`
- `bun run test` (currently placeholder that exits with error)

Current verification baseline:
```bash
bun run typecheck
bun run test
```

Notes on lint/format/hooks:
- No first-class `lint`/`format` scripts are currently defined in root or `server/package.json`.
- No tracked `oxlint`/`oxfmt` project config files are present.
- Repository includes `.githooks/` scripts for `commit-msg`, `prepare-commit-msg`, `post-commit`, and `pre-push` (Entire CLI integration).
- There is no tracked `pre-commit` hook script in `.githooks`.

## Additional Docs

- [Server API and operations guide](server/README.md)
- [Two-agent supervisor system](docs/two-agent-supervisor-system.md)
