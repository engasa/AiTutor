# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AiTutor is a full-stack educational platform built with React Router v7, TypeScript, Express.js, and PostgreSQL. The app provides a sophisticated tutoring system with hierarchical course structure (CourseOffering → Module → Lesson → Activity), advanced topic classification, JWT-based authentication, role-based access control, and comprehensive course management with content cloning capabilities.

## Architecture

**Frontend (React Router v7):**
- `app/` - React Router frontend with file-based routing using dot-delimited names
- `app/routes/` - Route modules (e.g., `instructor.list.tsx`, `student.course.tsx`)
- `app/lib/` - Shared utilities (`api.ts` for HTTP client, `types.ts` for TypeScript definitions)
- `app/components/` - Reusable UI components
- `app/hooks/` - Custom React hooks (e.g., `useLocalUser.ts` for JWT token management and authentication state)

**Backend (Express + Prisma):**
- `server/src/` - Modular Express.js API server with clean architecture
- `server/src/config/` - Centralized configuration (database connection)
- `server/src/middleware/` - Authentication middleware with JWT verification and role-based access control
- `server/src/routes/` - Domain-specific route modules (authentication, courses, modules, lessons, activities, prompts)
- `server/src/services/` - Business logic layer (course cloning, activity evaluation)
- `server/src/utils/` - Shared utilities (data mappers, transformations)
- `server/prisma/` - Database schema, migrations, and seed data with bcrypt-hashed passwords
- Database models: User, CourseOffering, Module, Lesson, Activity, Topic, PromptTemplate, Submission, Enrollments, TeachingAssignments

**Key Patterns:**
- JWT-based authentication with bcrypt password hashing and 24-hour token expiration
- Role-based access control (STUDENT/INSTRUCTOR) enforced on both frontend and backend
- Protected routes with automatic token validation and logout on expiration
- **Hierarchical Course Structure**: CourseOffering → Module → Lesson → Activity
- **Advanced Topic Classification**: Activities have required mainTopic and optional secondaryTopics with many-to-many relationships
- **Course-Scoped Topics**: Topics are unique within CourseOfferings, preventing cross-course pollution
- **Sophisticated Content Cloning**: Cross-course lesson/activity import with automatic topic mapping
- **Breadcrumb Navigation**: shadcn/ui breadcrumbs with "/" separator, hierarchical navigation across all nested routes
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

**Testing:**
```bash
cd server && npm test                         # Run all tests (unit + integration)
cd server && npm run test:unit                # Run unit tests only (no DB needed)
cd server && npm run test:integration         # Run integration tests only (requires PostgreSQL)
cd server && npm run test:watch               # Watch mode for development
```

**Production:**
```bash
npm run build                                  # Build for production
npm start                                     # Serve built application
```

## Breadcrumb Navigation System

**Implementation:**
All nested instructor and student routes use shadcn/ui breadcrumb primitives for hierarchical navigation. Breadcrumbs replace traditional back buttons with semantic, SEO-friendly navigation that shows the full path context.

**Pattern:**
- Compose `<Breadcrumb>`, `<BreadcrumbList>`, `<BreadcrumbItem>`, `<BreadcrumbLink>`, `<BreadcrumbPage>`, `<BreadcrumbSeparator>` directly in route files
- Use React Router's `<Link>` component via `asChild` prop for navigation
- Custom "/" separator (not chevrons) for clean visual hierarchy
- Routes fetch hierarchical data (course → module → lesson) to build navigation paths
- Conditional rendering: links become clickable once data loads, placeholders shown during loading

**Routes with Breadcrumbs:**
- `instructor.course.tsx`: Teaching / [Course Name]
- `instructor.topic.tsx`: Teaching / [Course] / [Module]
- `instructor.list.tsx`: Teaching / [Course] / [Module] / [Lesson]
- `student.course.tsx`: My Courses / [Course Name]
- `student.topic.tsx`: My Courses / [Course] / [Module]
- `student.list.tsx`: My Courses / [Course] / [Module] / [Lesson]

**Backend Support:**
- `GET /api/courses/:id` returns course details for breadcrumb labels
- Lesson type includes `moduleId` field (added to `mapLesson` utility)
- Module type includes `courseOfferingId` field
- Hierarchical data fetched efficiently using `Promise.all()` in route loaders

## Topic Classification System

**Architecture Overview:**
The platform implements a sophisticated topic classification system that enables precise content categorization and cross-referencing within educational courses. This system was completely redesigned from the original flat topic structure to support advanced pedagogical workflows.

**Core Principles:**
- **Course-Scoped Topics**: Topics belong to specific CourseOfferings, preventing naming conflicts and ensuring pedagogical coherence
- **Hierarchical Classification**: Activities must have one mainTopic and can have multiple secondaryTopics
- **Many-to-Many Relationships**: Flexible topic assignment through junction tables
- **Cross-Referencing**: Activities can be discovered through multiple topic pathways
- **Semantic Organization**: Topics enable content discovery, prerequisite tracking, and learning path optimization

**Database Implementation:**
```sql
-- Topics scoped to courses with unique naming
model Topic {
  id               Int              @id @default(autoincrement())
  name             String
  courseOffering   CourseOffering   @relation(fields: [courseOfferingId], references: [id], onDelete: Cascade)
  courseOfferingId Int
  
  -- Bidirectional relationships with activities
  mainActivities      Activity[]               @relation("ActivityMainTopic")
  secondaryActivities ActivitySecondaryTopic[]
  
  @@unique([courseOfferingId, name])  -- Prevents duplicate topics per course
}

-- Activities require main topic, support multiple secondary topics
model Activity {
  mainTopic       Topic                  @relation("ActivityMainTopic", fields: [mainTopicId], references: [id])
  mainTopicId     Int                    -- Required field
  secondaryTopics ActivitySecondaryTopic[]
  -- ... other fields
}

-- Junction table for many-to-many secondary topic relationships
model ActivitySecondaryTopic {
  activity   Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  activityId Int
  topic      Topic    @relation(fields: [topicId], references: [id], onDelete: Cascade)
  topicId    Int
  
  @@id([activityId, topicId])
}
```

**Frontend Implementation:**
- **Real-time Topic Management**: Create topics on-demand during activity creation
- **Visual Topic Assignment**: Intuitive main/secondary topic selection interface
- **Optimistic UI Updates**: Immediate feedback with proper error rollback
- **Topic Validation**: Prevents conflicts between main and secondary topic assignments
- **Bulk Topic Operations**: Efficient updates across multiple activities

**API Design:**
- `GET /api/courses/:id/topics` - Retrieve course-scoped topics
- `POST /api/courses/:id/topics` - Create new topics (instructor-only)
- `PATCH /api/activities/:id` - Update activity topic assignments
- **Authorization**: Course-scoped access control with instructor/student permissions
- **Error Handling**: Conflict resolution for duplicate topic names

## Database Schema

The Prisma schema defines a complete educational platform with advanced topic classification:
- **Users** with roles (STUDENT/INSTRUCTOR)
- **CourseOfferings** containing modules and course-scoped topics
- **Modules** containing lessons within courses (hierarchical organization)
- **Lessons** containing activities within modules
- **Activities** with types (MCQ/SHORT_TEXT), hints, answer validation, and **required topic classification**
- **Topics** for semantic content categorization, scoped to CourseOfferings with unique naming constraints
- **ActivitySecondaryTopic** junction table for many-to-many secondary topic relationships
- **PromptTemplates** for AI-powered educational assistance
- **Submissions** for tracking student responses and AI feedback
- **Enrollments** and **TeachingAssignments** for role-based access

## Frontend Architecture

**Route Structure:**
- Role-based layouts: `instructor.tsx` and `student.tsx` provide different navigation
- Nested routes follow data hierarchy: `instructor.course.tsx` → `instructor.module.tsx` → `instructor.lesson.tsx` → `instructor.activity.tsx`
- **Topic Management Integration**: `instructor.list.tsx` (842 lines) provides comprehensive topic assignment UI
- Data loading happens in route loaders with React Router's data APIs
- **Real-time Topic UI**: Optimistic updates with proper error rollback for topic operations

**State Management:**
- JWT token management via `useLocalUser` hook with automatic expiration handling
- Authentication state synchronized between localStorage and React state
- API state managed through React Router's data loading with protected route guards
- No global state management - relies on URL state, server data, and JWT tokens

**Navigation:**
- **Breadcrumbs**: shadcn/ui primitives composed directly in routes (no wrapper component)
- Custom "/" separator for clean visual hierarchy
- Hierarchical paths: `Teaching / Course / Module / Lesson` (instructor) and `My Courses / Course / Module / Lesson` (student)
- Conditional clickable links that activate once data loads
- Graceful loading states with placeholder text

**Styling:**
- TailwindCSS v4 for styling
- shadcn/ui component primitives (breadcrumbs, buttons, forms)
- Responsive design patterns
- Component-based CSS organization

## API Design

RESTful API with JWT-based authentication and role-based protection:

**Public Endpoints:**
- `/api/health` - Health check endpoint
- `/api/login` - JWT authentication (returns token + user data)

**Protected Endpoints (Require JWT token):**
- `/api/courses` - Course management and user-specific course lists
- `/api/courses/:id` - Get single course details (for breadcrumb navigation)
- `/api/courses/:id/modules` - Module management within courses
- `/api/courses/:id/topics` - **Topic management within courses (course-scoped)**
- `/api/modules/:id` - Get module details with courseOfferingId
- `/api/modules/:id/lessons` - Lesson management within modules
- `/api/lessons/:id` - Get lesson details with moduleId
- `/api/lessons/:id/activities` - Activity management within lessons
- `/api/activities/:id` - **Activity updates and topic assignments (main + secondary topics)**
- `/api/prompts` - Prompt template management
- `/api/questions/:id/answer` - Answer submission

**Topic-Specific Endpoints:**
- `GET /api/courses/:id/topics` - Retrieve all topics for a course (authorized users)
- `POST /api/courses/:id/topics` - Create new topic within course scope (instructor-only)
- `PATCH /api/activities/:id` - Update activity topic assignments:
  - `mainTopicId: number` - Required main topic assignment
  - `secondaryTopicIds: number[]` - Optional secondary topic assignments
  - Validates topics belong to same course as activity
  - Prevents main topic from appearing in secondary topics

**Instructor-Only Endpoints:**
- `/api/courses` (POST, PATCH) - Create/update courses (instructor role required)
- `/api/courses/:id/import` - **Import content between courses with automatic topic mapping**
- `/api/courses/:id/topics` (POST) - **Create course-scoped topics with unique naming constraints**
- `/api/modules/:id/lessons` (POST) - Create lessons (instructor role required)
- `/api/lessons/:id/activities` (POST) - **Create activities with required main topic assignment**
- `/api/activities/:id` (PATCH) - **Update activities including topic assignments (main + secondary)**
- `/api/prompts` (POST) - Create prompt templates (instructor role required)

**Topic Management Security:**
- Topics are course-scoped with automatic authorization validation
- Duplicate topic names within courses return HTTP 409 Conflict
- Cross-course topic references are prevented at database level
- Topic assignments validate course membership before updates

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

## Testing

**Framework:** Vitest + Supertest (173 tests across 12 files)

**Test Structure:**
```
server/test/
  setup.js                        # Loads .env.test, enforces connection_limit=1
  globalSetup.js                  # Creates test DB + runs migrations (once)
  helpers.js                      # Factories (makeProfessor/Student/Admin), truncateAll, seedMinimalCourse
  unit/
    mappers.test.js               # 47 tests — all 7 mapper functions
    activityEvaluation.test.js    # 12 tests — MCQ + SHORT_TEXT evaluation
    activityAnalytics.test.js     # 8 tests  — difficulty scoring formula
    aiModelPolicy.test.js         # 31 tests — policy normalization + resolution
  integration/
    smoke.test.js                 # 1 test   — health check
    topics.test.js                # 12 tests — CRUD + remap + authorization
    activities.test.js            # 20 tests — CRUD + answers + feedback + AI modes
    courses.test.js               # 12 tests — CRUD + publish/unpublish cascade
    modules.test.js               # 8 tests  — CRUD + publish gating + cascade
    lessons.test.js               # 8 tests  — CRUD + 2-level publish gating
    admin.test.js                 # 10 tests — users/courses/enrollment/settings
    auth.test.js                  # 4 tests  — /me + admin isolation
```

**Architecture:**
- `server/src/app.js` exports `createApp({ mockUser })` — tests inject a mock user to bypass Better Auth entirely
- Unit tests import pure functions directly — no DB, no mocking
- Integration tests use Supertest against the Express app with real PostgreSQL
- `truncateAll()` cleans the DB between tests using Prisma's `deleteMany` in FK-safe order
- `seedMinimalCourse(professorId)` creates a minimal course hierarchy (user + course + instructor + module + lesson + topic)
- `.env.test` points to `aitutor_test` database; `setup.js` enforces `connection_limit=1` to prevent Prisma pool races

**Writing New Tests:**
- Unit tests: import the function, test it. No setup needed.
- Integration tests: use `beforeEach(async () => { await truncateAll(); ... })` to reset state
- Use `makeProfessor()` / `makeStudent()` / `makeAdmin()` for mock user objects
- Create the app with `await createApp({ mockUser: prof })` — this injects `req.user` on every request
- For student access, create the user in DB AND enroll them via `prisma.courseEnrollment.create()`

**Prerequisites:**
- Docker PostgreSQL running on port 54321 (`docker compose up -d db`)
- The test DB is created automatically by `globalSetup.js` on first run

## Authentication System

**Demo Credentials:**
- **Student**: `student@example.com` / `student123`
- **Instructor**: `instructor@example.com` / `instructor123`

**Key Components:**
- `server/src/middleware/auth.js` - JWT verification and role-based access control
- `server/src/routes/authentication.js` - Login and user management endpoints
- `server/src/routes/topics.js` - **Course-scoped topic management with authorization**
- `server/src/config/database.js` - Centralized Prisma client configuration
- `server/src/services/courseCloning.js` - **Complex course cloning with automatic topic mapping**
- `server/src/services/activityEvaluation.js` - Activity evaluation logic
- `server/src/utils/mappers.js` - Data transformation and sanitization utilities
- `app/hooks/useLocalUser.ts` - JWT token management and authentication state
- `app/components/ProtectedRoute.tsx` - Route-level authentication guards
- `app/lib/api.ts` - **Enhanced API client with topic management endpoints**
- `app/routes/instructor.list.tsx` - **Comprehensive topic assignment UI (842 lines)**

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

## Backend Architecture Details

**Modular Structure (Refactored from 890-line monolith):**
```
server/src/
├── index.js                    # Main entry point (45 lines)
├── config/
│   └── database.js            # Prisma client setup
├── middleware/
│   └── auth.js                # Authentication middleware
├── routes/
│   ├── authentication.js     # Login and user endpoints
│   ├── courses.js            # Course CRUD and cloning
│   ├── modules.js            # Module management
│   ├── lessons.js            # Lesson management
│   ├── activities.js         # Activity CRUD with topic assignment
│   └── prompts.js            # Prompt template management
├── services/
│   ├── courseCloning.js      # Complex course cloning business logic
│   └── activityEvaluation.js # Question evaluation and feedback
└── utils/
    └── mappers.js            # Data transformation utilities
```

**Architectural Benefits:**
- **Separation of Concerns**: Routes handle HTTP, services handle business logic
- **Testability**: Each module can be tested independently
- **Maintainability**: Changes isolated to specific domains
- **Scalability**: Easy to add new features without affecting existing code
- **Team Development**: Multiple developers can work on different modules

**Topic Classification Architecture:**
- **Required Main Topic**: Every activity must have exactly one `mainTopic` for primary classification
- **Optional Secondary Topics**: Activities support multiple `secondaryTopics` for cross-referencing and discoverability
- **Course-Scoped Organization**: Topics belong to specific CourseOfferings with unique naming constraints
- **Many-to-Many Secondary Relationships**: `ActivitySecondaryTopic` junction table manages flexible secondary topic assignments
- **Relational Integrity**: Cascade deletions ensure data consistency when courses or topics are removed
- **Cross-Course Isolation**: Topic assignments validated at application level to prevent cross-course references

**Topic Management Workflow:**
1. **Topic Creation**: Instructors create course-scoped topics with automatic uniqueness validation
2. **Activity Classification**: Required main topic selection during activity creation
3. **Secondary Assignment**: Optional secondary topic selection with visual feedback
4. **Real-time Updates**: Optimistic UI updates with proper error rollback
5. **Content Import**: Automatic topic mapping when importing activities between courses
6. **Validation**: Prevents main topic from appearing in secondary topic list

**Migration from Legacy System:**
The platform underwent a complete architectural transformation from the original flat structure:

**Before (Legacy):**
```
Course → Topic → QuestionList → Question
- Flat topic structure with global scope
- ActivityType enumeration for question categorization  
- Simple one-to-many relationships
- Limited cross-referencing capabilities
```

**After (Current):**
```
CourseOffering → Module → Lesson → Activity
- Hierarchical course organization
- Course-scoped topics with semantic relationships
- Required main topic + optional secondary topics
- Advanced content cloning with topic mapping
- Removed ActivityType dependency completely
```

**Key Migration Changes:**
- **Schema Evolution**: 3 database migrations to remove ActivityType and implement topic relationships
- **Data Model**: Complete refactor from flat to hierarchical with proper foreign key relationships
- **UI Transformation**: 842-line `instructor.list.tsx` with sophisticated topic management interface
- **API Redesign**: New RESTful endpoints for course-scoped topic operations
- **Seed Script**: Updated to use Prisma relation syntax instead of direct foreign key assignments
- **Frontend Types**: Added `Topic` type with comprehensive TypeScript integration
- **Real-time UI**: Optimistic updates with proper error rollback for all topic operations

**Data Flow:**
1. Routes validate input and handle HTTP concerns
2. Services contain complex business logic (cloning, evaluation)
3. Utils provide data transformation and sanitization
4. Config provides centralized database access
5. Middleware handles cross-cutting concerns (auth, CORS)

**Development Workflow with Topics:**
- **Activity Creation**: Always requires main topic selection before saving
- **Topic Management**: Instructors create topics on-demand during content creation
- **Content Import**: Automatic topic mapping when copying activities between courses
- **Database Seeding**: Use Prisma relation syntax (`{ connect: { id: ... } }`) not direct field assignments
- **Error Handling**: Topic conflicts return 409 status with helpful error messages
- **UI State Management**: Complex state for topic loading, selection, and validation in instructor interface
- **Performance**: Efficient queries with proper includes for topic relationships