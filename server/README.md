# AiTutor Backend (`server/`)

Express 5 API for AiTutor. This service handles authentication/session hydration, RBAC, course/content CRUD, AI tutoring flows, admin operations, and Prisma-backed persistence.

## Purpose And Architecture

Backend modules are organized by responsibility:

- `src/index.js`: app bootstrap, middleware chain, Better Auth mount, and route module mounting.
- `src/auth.js`: Better Auth configuration (Prisma adapter, cookie behavior, user role defaults).
- `src/middleware/`: auth/session middleware (`attachSession`, `requireAuth`, `requireRole`, `requireRoles`).
- `src/routes/`: HTTP API modules by domain (courses, modules, lessons, activities, admin, etc.).
- `src/services/`: business logic integrations (EduAI client, cloning, AI guidance, analytics, model policy, settings).
- `src/utils/`: response mapping helpers.
- `prisma/`: schema, migrations, and seeding.

Request flow in `src/index.js`:

1. CORS enabled with credentials.
2. Better Auth handler mounted at `/api/auth/{*any}`.
3. JSON body parsing for non-auth routes.
4. `GET /api/health` database check.
5. `attachSession` runs on `/api` to populate `req.user`.
6. `requireAuth` enforced for `/api/*` except `/api/health` and `/api/auth/*`.
7. Admin isolation middleware (see RBAC section).
8. Route modules mounted under `/api`.

## Authentication And RBAC

### Session/Auth model

- Better Auth is the auth provider and owns `/api/auth/*`.
- Session is resolved from Better Auth cookies via `auth.api.getSession(...)` and hydrated into `req.user` from Prisma.
- `GET /api/me` returns the current authenticated user (`401` if unauthenticated).

### Roles

User roles are persisted on `User.role` in Prisma:

- `STUDENT`
- `INSTRUCTOR`
- `ADMIN`

Role checks are middleware-based:

- `requireAuth`: authenticated user required.
- `requireRole(role)`: exact role required.
- `requireRoles([...])`: any-of role check.

### Admin route isolation behavior

After auth, there is an explicit isolation rule:

- If `req.user.role === 'ADMIN'`, allowed paths are only:
  - `/api/me`
  - `/api/admin/*`
- Any other `/api/*` endpoint returns `403` with:
  - `Admins can only access admin endpoints`

This means admins are intentionally blocked from instructor/student route modules unless those routes are under `/api/admin/*` (or `/api/me`).

## API Surface Summary (By Route Module)

All routes are mounted under `/api`.

### System

- `GET /health`: DB liveness probe (`SELECT 1`).

### `routes/authentication.js`

- `GET /me`: current authenticated user.

### `routes/courses.js`

- `GET /eduai/courses` (`INSTRUCTOR`): list importable EduAI courses not yet imported by the instructor.
- `GET /courses`: list courses for current user (role-sensitive: instructor vs enrolled student).
- `POST /courses/import-external` (`INSTRUCTOR`): import EduAI course into local `CourseOffering`.
- `GET /courses/:courseId`: get single course if user is instructor or enrolled student.
- `POST /courses` (`INSTRUCTOR`): create course (optionally clone from source course).
- `PATCH /courses/:courseId` (`INSTRUCTOR`): update metadata.
- `POST /courses/:courseId/import` (`INSTRUCTOR`): import modules/lessons from other offerings.
- `PATCH /courses/:courseId/publish` (`INSTRUCTOR`): publish course.
- `PATCH /courses/:courseId/unpublish` (`INSTRUCTOR`): unpublish course and cascade to modules/lessons.

### `routes/modules.js`

- `GET /courses/:courseId/modules`: list modules (students get published-only + progress).
- `POST /courses/:courseId/modules` (`INSTRUCTOR`): create module.
- `GET /modules/:moduleId`: fetch module.
- `PATCH /modules/:moduleId/publish` (`INSTRUCTOR`): publish module (requires parent course published).
- `PATCH /modules/:moduleId/unpublish` (`INSTRUCTOR`): unpublish module and cascade to lessons.

### `routes/lessons.js`

- `GET /modules/:moduleId/lessons`: list lessons (students get published-only + progress).
- `POST /modules/:moduleId/lessons` (`INSTRUCTOR`): create lesson.
- `GET /lessons/:lessonId`: fetch lesson.
- `PATCH /lessons/:lessonId/publish` (`INSTRUCTOR`): publish lesson (requires published parent module/course).
- `PATCH /lessons/:lessonId/unpublish` (`INSTRUCTOR`): unpublish lesson.

### `routes/activities.js`

- `GET /lessons/:lessonId/activities`: list activities (students get completion status).
- `POST /lessons/:lessonId/activities` (`INSTRUCTOR`): create activity (validates topics + AI mode flags).
- `PATCH /activities/:activityId` (`INSTRUCTOR`): update activity content/config/topics/modes.
- `DELETE /activities/:activityId` (`INSTRUCTOR`): delete activity.
- `POST /questions/:id/answer`: submit answer attempt and correctness feedback.
- `POST /activities/:activityId/teach`: AI teach-mode response.
- `POST /activities/:activityId/guide`: AI guide-mode response.
- `POST /activities/:activityId/custom`: AI custom-mode response (requires custom mode enabled + prompt set).
- `POST /activities/:activityId/feedback`: student activity feedback submission.

### `routes/topics.js`

- `GET /courses/:courseId/topics`: list topics if user is enrolled student or instructor for course.
- `POST /courses/:courseId/topics` (`INSTRUCTOR`): create topic (blocked for imported EduAI courses).
- `POST /courses/:courseId/topics/sync` (`INSTRUCTOR`): sync imported-course topics from EduAI.
- `POST /courses/:courseId/topics/remap` (`INSTRUCTOR`): remap activity topic references.

### `routes/prompts.js`

- `GET /prompts` (`INSTRUCTOR`): list prompt templates.
- `POST /prompts` (`INSTRUCTOR`): create prompt template.

### `routes/suggested-prompts.js`

- `GET /suggested-prompts`: list active suggested prompts (teach/guide).

### `routes/ai-models.js`

- `GET /ai-models`: list available models, filtered for student-visible allowed tutor models.
- `POST /ai-models/validate-key`: validate provider API key against lightweight provider endpoints.

### `routes/admin.js` (`ADMIN`)

- `GET /admin/users`: list users.
- `PATCH /admin/users/:userId/role`: promote user (`INSTRUCTOR` or `ADMIN`) with guardrails.
- `GET /admin/courses`: list all offerings.
- `GET /admin/courses/:courseId/enrollments`: list enrolled + available students.
- `POST /admin/courses/:courseId/enrollments`: enroll student.
- `DELETE /admin/courses/:courseId/enrollments/:userId`: remove enrollment.
- `GET /admin/settings/eduai-api-key`: key status (`source`, `configured`, etc.).
- `PUT /admin/settings/eduai-api-key`: set DB override key.
- `DELETE /admin/settings/eduai-api-key`: clear DB override key.
- `GET /admin/settings/ai-model-policy`: read AI model policy state.
- `PUT /admin/settings/ai-model-policy`: update AI model policy.

## Environment Variables

Source of truth for local setup: `server/.env.example`.

| Variable | Required | Default / Example | Used by | Behavior notes |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Yes | `postgresql://postgres:postgres@localhost:54321/aitutor?schema=public` | Prisma datasource | Required for all DB reads/writes. |
| `PORT` | No | `4000` | `src/index.js` | Express listen port fallback. |
| `BETTER_AUTH_SECRET` | Yes (Better Auth) | `replace-with-a-random-strong-secret` | Better Auth runtime | Needed by Better Auth session/security internals. |
| `BETTER_AUTH_URL` | No | `http://localhost:4000/api/auth` | `src/auth.js` | Base URL used by Better Auth handler. |
| `COOKIE_DOMAIN` | No | `localhost` | `src/auth.js` | Session cookie domain; `secure` flag follows `NODE_ENV === "production"`. |
| `EDUAI_API_KEY` | Usually yes for AI features | `your-eduai-api-key-here` | `src/services/systemSettings.js`, `src/services/eduaiClient.js`, `src/services/aiGuidance.js` | Used as fallback key for EduAI calls when no admin override exists. |
| `EDUAI_BASE_URL` | No | `http://localhost:5174/api` | `src/services/eduaiClient.js` | Base URL for EduAI API (`/courses`, `/chat`, `/ai-models`). |
| `EDUAI_MODEL` | No | `google:gemini-2.5-flash` | `src/services/aiGuidance.js` | Default tutor model if no policy/request override chooses another. |
| `AI_SUPERVISOR_ENABLED` | Present in example only | `true` | Not currently read by runtime code | Current supervisor behavior is controlled by persisted AI model policy (`dualLoopEnabled`) rather than this env var. |

### EDUAI API key precedence

Effective key resolution is:

1. Admin override in `SystemSetting` (`EDUAI_API_KEY`) if set via `/api/admin/settings/eduai-api-key`.
2. Fallback to env `EDUAI_API_KEY`.
3. If neither exists, EduAI-dependent endpoints fail with configuration errors.

## Database Lifecycle

From `server/`:

- Apply migrations:
  - `bunx prisma migrate deploy`
- Seed data:
  - `bun run seed`

Important: `bun run seed` is destructive in this repository. `prisma/seed.ts` calls `clearDatabase()` and deletes existing rows from core tables before re-inserting sample data.

## Run And Development Commands

From repo root:

- Install dependencies:
  - `bun install`

From `server/`:

- Dev server (nodemon):
  - `bun run dev`
- Start server:
  - `bun run start`
- Seed DB:
  - `bun run seed`

Optional full-stack workflow:

- Frontend dev (repo root): `bun run dev`
- Backend dev (`server/`): `bun run dev`

## Testing, Linting, Formatting, Hooks (Current Status)

Current repo state:

- Backend `test` script is still a placeholder in `server/package.json`:
  - `echo "Error: no test specified" && exit 1`
- Root has `bun run test` (Bun test runner) and currently includes frontend/unit coverage such as `app/lib/tours/tour-engine.test.ts`.
- No dedicated lint script found in root or `server/package.json`.
- No dedicated format script found in root or `server/package.json`.
- Repository tracks `.githooks/` scripts for `commit-msg`, `prepare-commit-msg`, `post-commit`, and `pre-push` (Entire CLI integration). No tracked `pre-commit` hook script is present.

For client TypeScript checks, the root has `bun run typecheck` (not a backend-specific test suite).
