# Repository Guide

## Monorepo Layout
- `app/`: React Router v7 frontend (file-based routing defined in `app/routes.ts`). Holds route modules under `app/routes/`, reusable UI in `app/components/`, hooks in `app/hooks/`, shared helpers in `app/lib/`, and the HTML shell in `app/root.tsx`. Styling is managed through Tailwind CSS v4 via `app/app.css`.
- `server/`: Express 5 + Prisma API (`src/index.js`) with JWT auth middleware in `src/middleware/auth.js` and schema/seeds under `prisma/`. Runs independently from the client but shares TypeScript types conceptually through REST responses.
- `public/`: Static assets bundled with the client. The Vite/React Router build drops output into `build/client` (static) and `build/server` (SSR entry).
- Top-level configs: `react-router.config.ts` (SSR on), `vite.config.ts` (Tailwind + React Router plugins), `tsconfig.json` (strict TS with path alias `~/`), Docker manifests, and this guide.

## Frontend (app/)
- **Routing & Screens**: `app/routes.ts` maps URL paths to route modules. Key flows:
  - Public `home.tsx` handles login and demo credentials.
  - Student area: `/student` dashboard plus course (`student.course.tsx`), module (`student.topic.tsx`), and lesson player (`student.list.tsx`) views.
  - Instructor area mirrors the hierarchy: `/instructor` dashboard, course management (`instructor.course.tsx`), module lessons (`instructor.topic.tsx`), and lesson builder (`instructor.list.tsx`).
- **Auth & Session Handling**: `app/hooks/useLocalUser.ts` stores JWTs in `localStorage`, parses expiry, and exposes `saveAuth`, `logout`, and `requireUser`. `ProtectedRoute.tsx` guards role-specific sections and redirects to `/` when the token is missing or invalid.
- **API Client**: `app/lib/api.ts` wraps `fetch`, injects the `Authorization` header, performs JSON parsing, and forces logout on 401/403. It exposes high-level helpers for courses, modules, lessons, activities, prompts, and submissions that mirror backend endpoints.
- **UI Components**: `Nav.tsx` renders top navigation with role-aware links and logout. Route screens lean on Tailwind utility classes (see `app/app.css`) for gradient backgrounds and cards.
- **Lesson Authoring UX**: Instructor lesson builder supports MCQ and short-text activities, optional AI prompt assignment per activity, prompt creation with temperature/topP controls, and inline imports from existing courses (modules or lessons).

## Backend (server/)
- **Express Pipeline**: `src/index.js` configures CORS, JSON parsing, health check, login, and secured routes. `authenticateToken` validates JWTs via Prisma lookup; `requireRole`/`requireRoles` enforce RBAC.
- **Business Logic Helpers**:
  - `cloneCourseContent` and `cloneLessonsFromOffering` duplicate modules/lessons from one live course to another while preserving ordering.
  - `mapCourseOffering`, `mapModule`, `mapLesson`, and `mapActivity` shape database rows for client consumption. Activities expose `config.question`, `questionType`, answer metadata, hints, and attached prompt templates.
  - `evaluateQuestion` handles basic MCQ/short-text grading and returns AI assistant cues.
- **Endpoint Highlights**:
  - Auth: `POST /api/login`, `GET /api/me`.
  - Courses: `GET /api/courses` (role-aware), `POST /api/courses` (optionally clone from an existing course), `PATCH /api/courses/:id`.
  - Modules & Lessons: `GET/POST /api/courses/:id/modules`, `GET /api/modules/:id`, `GET/POST /api/modules/:id/lessons`, `GET /api/lessons/:id`.
-  - Activities & Prompts: `GET/POST /api/lessons/:id/activities`, `PATCH /api/activities/:id`, `GET/POST /api/prompts`, `GET /api/activity-types`.
-  - Submissions: `POST /api/questions/:id/answer` persists attempts and leverages `evaluateQuestion` for correctness and hinting.
- **Prisma Schema**: Defines users (with `Role` enum), course offerings, modules, lessons, activities, prompt templates, activity types, enrollments, instructor assignments, and submissions. Activity `config` JSON stores question text, options, answers, and hints, enabling flexible activity types.

## Seed Data (`server/prisma/seed.js`)
- Completely resets the schema, then provisions four users (two students, two instructors).
- Seeds two activity types (`knowledge-check`, `code-debugging`) plus default prompt templates.
- Creates rich course offerings (Algorithms, Linear Algebra, Physics) with nested modules/lessons/activities directly in the live tables.
- Demonstrates cloning by copying modules/lessons between real courses, assigns instructors/enrollments, and populates sample submissions for analytics demos.
- Running `cd server && npm run seed` requires migrations applied via `npx prisma migrate deploy` and an active Postgres instance from `docker compose up -d db`.

## Build, Test, and Development Commands
- `npm install` (root) and `cd server && npm install`: install frontend and API dependencies.
- `docker compose up -d db`: launch Postgres at `localhost:54321`.
- `cd server && npx prisma migrate deploy`: apply migrations before seeding.
- `cd server && npm run seed`: load demo data (refresh to reset credentials or content).
- `npm run dev`: start the React Router dev server at `http://localhost:5173` (expects API on `4000`).
- `cd server && npm run dev`: start Express API with nodemon at `http://localhost:4000`.
- `npm run typecheck`: generates React Router route types and runs `tsc` (Node 20+).
- `npm run build`: outputs SSR-ready assets in `build/client` and `build/server`.

## Environment & Deployment Notes
- Frontend reads `VITE_API_URL` for the API base (defaults to `http://localhost:4000`).
- Backend requires `DATABASE_URL` and `JWT_SECRET` in `server/.env`; `PORT` defaults to `4000`.
- Dockerfile stages: install deps, build client (`npm run build`), then run via `npm run start` with prebuilt assets.
- Compose file exposes Postgres volume `db_data`; prune it when a clean seed is required.

## Working Guidelines
- Follow TypeScript strict mode and 2-space indentation. Components PascalCase, hooks camelCase, route files lowercase dot-delimited (e.g., `instructor.list.tsx`).
- When adding routes, update `app/routes.ts` so React Router can generate loader/action types (`.react-router/types` output).
- Mirror API additions in `app/lib/api.ts` and keep server responses shaped for existing UI expectations (`map*` helpers are the contract).
- Prefer Tailwind utilities over custom CSS; extend themes in `app/app.css` only when necessary.
- Tests are not yet present; add Vitest + React Testing Library in `app/__tests__/` and Vitest/Jest + Supertest in `server/test/` as coverage grows. Ensure `npm run typecheck` passes before raising PRs.

## Extension Tips
- **New activity flows**: define additional `ActivityType`/`PromptTemplate` via Prisma migrations and adjust `defaultActivityTypeId` if defaults change.
- **Cloning logic**: reuse `cloneCourseContent` (for modules) and `cloneLessonsFromOffering` (for individual lessons) when building import features; each preserves nested activities and prompt assignments.
- **AI prompts**: instructor UI expects prompt collections from `/api/prompts`; ensure backend responses include `activityType` details for selection context.
- **Role enforcement**: server checks instructors via `courseInstructor` relations when mutating course assets; keep that pattern for new privileged endpoints.
