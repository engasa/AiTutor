# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AiTutor is a full-stack educational platform built with React Router v7, TypeScript, Express.js, and PostgreSQL. The app provides a secure tutoring system where instructors create question lists and students answer questions, with JWT-based authentication, role-based access control, and comprehensive course management.

## Architecture

**Frontend (React Router v7):**
- `app/` - React Router frontend with file-based routing using dot-delimited names
- `app/routes/` - Route modules (e.g., `instructor.list.tsx`, `student.course.tsx`)
- `app/lib/` - Shared utilities (`api.ts` for HTTP client, `types.ts` for TypeScript definitions)
- `app/components/` - Reusable UI components
- `app/hooks/` - Custom React hooks (e.g., `useLocalUser.ts` for JWT token management and authentication state)

**Backend (Express + Prisma):**
- `server/src/` - Express.js API server with JWT authentication middleware
- `server/src/middleware/` - Authentication middleware with JWT verification and role-based access control
- `server/prisma/` - Database schema, migrations, and seed data with bcrypt-hashed passwords
- Database models: User, Course, Topic, QuestionList, Question, StudentAnswer, Enrollment, TeachingAssignment

**Key Patterns:**
- JWT-based authentication with bcrypt password hashing and 24-hour token expiration
- Role-based access control (STUDENT/INSTRUCTOR) enforced on both frontend and backend
- Protected routes with automatic token validation and logout on expiration
- Nested data hierarchy: Course → Topic → QuestionList → Question
- API client with Authorization headers and centralized error handling in `app/lib/api.ts`
- SSR-compatible authentication that works with React Router v7 server-side rendering

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
- JWT token management via `useLocalUser` hook with automatic expiration handling
- Authentication state synchronized between localStorage and React state
- API state managed through React Router's data loading with protected route guards
- No global state management - relies on URL state, server data, and JWT tokens

**Styling:**
- TailwindCSS v4 for styling
- Responsive design patterns
- Component-based CSS organization

## API Design

RESTful API with JWT-based authentication and role-based protection:

**Public Endpoints:**
- `/api/health` - Health check endpoint
- `/api/login` - JWT authentication (returns token + user data)

**Protected Endpoints (Require JWT token):**
- `/api/courses` - Course management and user-specific course lists
- `/api/courses/:id/topics` - Topic management within courses
- `/api/topics/:id/lists` - Question list management
- `/api/lists/:id` and `/api/lists/:id/questions` - Question management
- `/api/questions/:id/answer` - Answer submission

**Instructor-Only Endpoints:**
- `/api/users` - User management (instructor role required)
- `/api/lists` (POST) - Create question lists (instructor role required)
- `/api/lists/:id/questions` (POST) - Create questions (instructor role required)

**Authentication Flow:**
1. Send POST to `/api/login` with email/password
2. Receive JWT token + user data
3. Include `Authorization: Bearer <token>` header in all subsequent requests
4. Token expires after 24 hours, triggering automatic logout

## Environment Configuration

**Frontend:**
- `VITE_API_URL` - API server URL (defaults to http://localhost:4000)

**Backend:**
- `DATABASE_URL` - PostgreSQL connection string (example: postgresql://postgres:postgres@localhost:54321/aitutor)
- `JWT_SECRET` - Secret key for JWT token signing and verification (REQUIRED for security)
- `PORT` - Server port (defaults to 4000)
- Environment variables loaded from `server/.env`

**Security Notes:**
- `JWT_SECRET` must be a strong, unique secret in production
- Never commit `.env` files to version control
- Passwords are hashed with bcrypt (salt rounds: 10)
- JWT tokens expire after 24 hours
- All API endpoints except `/api/health` and `/api/login` require authentication

## Testing Strategy

No test framework is currently configured. When adding tests:
- Frontend: Use Vitest + React Testing Library under `app/__tests__/`
- Backend: Use Vitest/Jest + Supertest under `server/test/`
- Focus testing on route loaders, API endpoints, and critical user flows

**Authentication Testing Priorities:**
- JWT token generation and validation
- Password hashing and verification with bcrypt
- Protected route access control (401/403 responses)
- Role-based authorization (STUDENT vs INSTRUCTOR)
- Token expiration and automatic logout
- SSR compatibility for authentication hooks

## Authentication System

**Demo Credentials:**
- **Student**: `student@example.com` / `student123`
- **Instructor**: `instructor@example.com` / `instructor123`

**Key Components:**
- `server/src/middleware/auth.js` - JWT verification and role-based access control
- `app/hooks/useLocalUser.ts` - JWT token management and authentication state
- `app/components/ProtectedRoute.tsx` - Route-level authentication guards
- `app/lib/api.ts` - Automatic Authorization header injection

**Security Features:**
- Bcrypt password hashing with salt rounds
- JWT tokens with 24-hour expiration
- Automatic token validation on every API request
- Role-based endpoint protection
- SSR-compatible token management
- Automatic logout on token expiration
- CORS configuration for cross-origin requests

**Authentication Flow:**
1. User submits email/password through login form
2. Backend verifies password with bcrypt.compare()
3. Backend generates JWT token with user ID and role
4. Frontend stores token in localStorage
5. All subsequent API requests include Authorization header
6. Backend middleware validates token on every protected request
7. Frontend automatically redirects to login if token expires

## Development Workflow & Troubleshooting

**Database Reset (if auth issues occur):**
```bash
cd server
npm run seed  # Re-runs seed with fresh bcrypt-hashed passwords
```

**Common Authentication Issues:**
1. **"Invalid email or password"** - Check if database was seeded properly with hashed passwords
2. **"Access token required"** - Ensure JWT_SECRET is set in `server/.env`
3. **SSR errors with localStorage** - Authentication hooks have SSR compatibility checks
4. **CORS issues** - Backend is configured with `cors({ origin: true, credentials: true })`
5. **Token expiration** - Tokens expire after 24 hours, requiring re-login

**Development Tips:**
- Use browser DevTools → Application → Local Storage to inspect stored JWT tokens
- Check Network tab for Authorization headers in API requests
- Backend logs show JWT verification errors if tokens are invalid
- Use demo credentials for quick testing (see Authentication System section)
- All routes except login/health require valid authentication

**Production Deployment Notes:**
- Generate strong JWT_SECRET for production environment
- Use HTTPS in production for secure token transmission
- Consider shorter token expiration for higher security environments
- Set up proper CORS configuration for production domains