# AiTutor

An AI-powered tutoring extension for the EDU AI ecosystem, built as an Honours Capstone Project at UBC. Deployed at [aitutor.ok.ubc.ca](https://aitutor.ok.ubc.ca).

> For a comprehensive overview of features, user roles, workflows, and future roadmap, see **[SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md)**.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + React Router v7 (SPA mode) |
| Backend | Express 5 API |
| Auth | Better Auth with EduAI OAuth (OIDC + PKCE) |
| Database | PostgreSQL via Prisma ORM |
| AI | Dual-loop tutor-supervisor via EduAI platform |
| Styling | Tailwind CSS v4 + shadcn/ui (Radix) |
| Runtime | Bun |

## Architecture

```
browser (SPA)                          server (Express 5)
  app/                                   server/src/
  routes/    ── clientLoader ──>         routes/       ── services/ ──> EduAI API
  components/                            middleware/                    (OAuth + /chat)
  hooks/                                 prisma/                       PostgreSQL
  lib/api.ts ── credentials:include ──>
```

### Directory Layout

```
AiTutor/
  app/                    # React Router v7 client (routes, components, hooks, lib)
  server/                 # Express 5 API (routes, services, middleware, prisma)
  shared/schemas/         # Zod schemas shared between frontend and backend
  docs/                   # Design documents
  scripts/                # E2E and automation scripts
  .githooks/              # Pre-commit (lint, format, typecheck, tests), Entire CLI hooks
  public/                 # Static assets
```

### Authentication

Cookie-based sessions via Better Auth. No JWT or bearer tokens.

1. User clicks "Sign in with EduAI" on the home page.
2. OAuth 2.0 flow (OIDC + PKCE) redirects to EduAI, then back with a session cookie.
3. Backend resolves sessions via `auth.api.getSession()` and hydrates `req.user` from the database.
4. Frontend calls `GET /api/me` to check identity; all API requests use `credentials: "include"`.

### Roles

Four roles: **STUDENT**, **PROFESSOR**, **ADMIN**, **TA** (not yet supported). Admins are isolated from student/instructor APIs by middleware. See [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md) for full permissions.

### AI Tutoring System

Uses a dual-loop tutor-supervisor pattern to prevent answer leakage. See [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md) for a detailed explanation and [docs/two-agent-supervisor-system.md](docs/two-agent-supervisor-system.md) for the technical design.

## Local Setup

### Prerequisites

- [Bun](https://bun.sh/) (runtime and package manager)
- [Docker](https://www.docker.com/) (for PostgreSQL)

### Steps

```bash
# 1. Install dependencies
bun install
cd server && bun install && cd ..

# 2. Create server env file
cp server/.env.example server/.env
# Edit server/.env with your BETTER_AUTH_SECRET and EduAI credentials

# 3. Start PostgreSQL
docker compose up -d db

# 4. Apply migrations
cd server && bunx prisma migrate deploy && cd ..

# 5. (Optional) Seed demo data
cd server && bun run seed && cd ..
```

> **Warning:** `bun run seed` is destructive. It clears all existing data and recreates demo content (4 users, 3 courses with full module/lesson/activity trees).

### Running the App

Two terminals:

```bash
# Terminal 1: Backend API (port 4000)
cd server && bun run dev

# Terminal 2: Frontend dev server (port 5173)
bun run dev
```

## Commands

### Root (`package.json`)

| Command | Purpose |
|---------|---------|
| `bun run dev` | Vite dev server with HMR |
| `bun run build` | Build SPA to `build/client/` |
| `bun run start` | Preview built SPA via `vite preview` |
| `bun run typecheck` | React Router typegen + `tsc` |
| `bun run typecheck:fast` | React Router typegen + `tsgo` (~10x faster) |
| `bun run test` | Run frontend tests (Vitest) |
| `bun run test:watch` | Watch mode |
| `bun run lint` | Lint with oxlint |
| `bun run lint:fix` | Auto-fix lint issues |
| `bun run format` | Format with oxfmt |
| `bun run format:check` | Check formatting |
| `bun run knip` | Dead code detection |
| `bun run e2e:oauth-matrix` | E2E OAuth + role regression tests |

### Server (`server/package.json`)

| Command | Purpose |
|---------|---------|
| `bun run dev` | Express API with nodemon |
| `bun run start` | Prisma generate + start server |
| `bun run seed` | Reset and seed demo data |
| `bun run test` | Run backend tests (Vitest) |
| `bun run test:unit` | Unit tests only |
| `bun run test:integration` | Integration tests only |

### Verification Baseline

```bash
bun run typecheck
bun run test
cd server && bun run test
```

### Pre-Commit Hook

The `.githooks/pre-commit` hook automatically runs on staged files:

- **Format check** (oxfmt) on staged source files
- **Lint** (oxlint) on staged source files
- **Typecheck** (tsgo) if `.ts`/`.tsx` files are staged
- **Backend tests** (vitest) if `server/` files changed
- **Frontend tests** (vitest) if `app/`/`shared/` files changed

## Environment Variables

### Frontend

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `http://localhost:4000` | Backend API base URL |

### Backend

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `PORT` | No | `4000` | Express listen port |
| `BETTER_AUTH_SECRET` | Yes | - | Session signing secret |
| `BETTER_AUTH_URL` | No | `http://localhost:4000/api/auth` | Better Auth base URL |
| `COOKIE_DOMAIN` | No | `localhost` | Session cookie domain |
| `EDUAI_DISCOVERY_URL` | Yes | - | EduAI OIDC discovery endpoint |
| `EDUAI_CLIENT_ID` | Yes | - | OAuth client ID |
| `EDUAI_CLIENT_SECRET` | Yes | - | OAuth client secret |
| `EDUAI_USERINFO_URL` | Yes | - | EduAI user info endpoint |
| `EDUAI_BASE_URL` | No | `http://localhost:5174/api` | EduAI API base URL |
| `EDUAI_API_KEY` | Recommended | - | Default EduAI API key (overridable via admin) |
| `EDUAI_MODEL` | No | `google:gemini-2.5-flash` | Default AI tutor model |

See `server/.env.example` for the full template.

## Additional Docs

- [System Overview](SYSTEM_OVERVIEW.md) — features, roles, workflows, future work
- [Frontend Architecture](app/README.md)
- [Backend API and Operations](server/README.md)
- [API Reference](docs/api-reference.md)
- [Two-Agent Supervisor System](docs/two-agent-supervisor-system.md)
- [Contributing Guide](CONTRIBUTING.md)
