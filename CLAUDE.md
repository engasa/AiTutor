# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AiTutor is a full-stack educational platform built with React Router v7, TypeScript, Express.js, and PostgreSQL. The app simulates a tutoring system where instructors create question lists and students answer questions, with role-based access and course management.

## Architecture

**Frontend (React Router v7):**
- `app/` - React Router frontend with file-based routing using dot-delimited names
- `app/routes/` - Route modules (e.g., `instructor.list.tsx`, `student.course.tsx`)
- `app/lib/` - Shared utilities (`api.ts` for HTTP client, `types.ts` for TypeScript definitions)
- `app/components/` - Reusable UI components
- `app/hooks/` - Custom React hooks (e.g., `useLocalUser.ts` for local auth simulation)

**Backend (Express + Prisma):**
- `server/src/` - Express.js API server
- `server/prisma/` - Database schema, migrations, and seed data
- Database models: User, Course, Topic, QuestionList, Question, StudentAnswer, Enrollment, TeachingAssignment

**Key Patterns:**
- Role-based access (STUDENT/INSTRUCTOR) with different UI flows
- Nested data hierarchy: Course → Topic → QuestionList → Question
- Local authentication simulation (no real auth, just role selection)
- API client with centralized error handling in `app/lib/api.ts`

## Development Commands

**Setup:**
```bash
npm install                                    # Install frontend dependencies
cd server && npm install                      # Install backend dependencies
docker compose up -d db                       # Start PostgreSQL (port 54321)
cd server && npx prisma migrate deploy        # Run database migrations
cd server && npm run seed                     # Seed database with test data
```

**Development:**
```bash
npm run dev                                    # Start frontend dev server (http://localhost:5173)
cd server && npm run dev                      # Start API server (http://localhost:4000)
npm run typecheck                             # Type check both frontend and backend
```

**Production:**
```bash
npm run build                                  # Build for production
npm start                                     # Serve built application
```

## Database Schema

The Prisma schema defines a complete educational platform:
- **Users** with roles (STUDENT/INSTRUCTOR)
- **Courses** containing multiple topics
- **Topics** containing question lists
- **Questions** with types (MCQ/SHORT_TEXT), hints, and answer validation
- **Enrollments** and **TeachingAssignments** for role-based access
- **StudentAnswers** for tracking student responses

## Frontend Architecture

**Route Structure:**
- Role-based layouts: `instructor.tsx` and `student.tsx` provide different navigation
- Nested routes follow data hierarchy: `instructor.course.tsx` → `instructor.topic.tsx` → `instructor.list.tsx`
- Data loading happens in route loaders with React Router's data APIs

**State Management:**
- Local user simulation via `useLocalUser` hook
- API state managed through React Router's data loading
- No global state management - relies on URL state and server data

**Styling:**
- TailwindCSS v4 for styling
- Responsive design patterns
- Component-based CSS organization

## API Design

RESTful API with endpoints organized by resource:
- `/api/login` - Simulated authentication
- `/api/courses` - Course management and user-specific course lists
- `/api/courses/:id/topics` - Topic management within courses
- `/api/topics/:id/lists` - Question list management
- `/api/lists/:id` and `/api/lists/:id/questions` - Question management
- `/api/questions/:id/answer` - Answer submission

## Environment Configuration

**Frontend:**
- `VITE_API_URL` - API server URL (defaults to http://localhost:4000)

**Backend:**
- `DATABASE_URL` - PostgreSQL connection string (example: postgresql://postgres:postgres@localhost:54321/aitutor)
- Environment variables loaded from `server/.env`

## Testing Strategy

No test framework is currently configured. When adding tests:
- Frontend: Use Vitest + React Testing Library under `app/__tests__/`
- Backend: Use Vitest/Jest + Supertest under `server/test/`
- Focus testing on route loaders, API endpoints, and critical user flows