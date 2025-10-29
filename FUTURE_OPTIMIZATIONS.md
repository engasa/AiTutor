# Additional Performance Optimization Opportunities

This document outlines additional performance improvements that were identified but not implemented in the current PR. These can be considered for future optimization work.

## 1. Topic Fetching in Course Cloning

**File**: `server/src/services/courseCloning.js`

**Current Issue**: The cloning service fetches topics multiple times in a loop:
```javascript
for (const courseId of sourceCourseIds) {
  const topics = await prisma.topic.findMany({ where: { courseOfferingId: courseId } });
  for (const topic of topics) {
    sourceTopicById.set(topic.id, topic);
  }
}
```

**Optimization**: Fetch all topics in a single query:
```javascript
const topics = await prisma.topic.findMany({ 
  where: { courseOfferingId: { in: Array.from(sourceCourseIds) } }
});
```

**Impact**: Reduces database queries from O(n) to O(1) where n = number of source courses.

## 2. Caching Layer for Progress Calculations

**Implementation**: Add Redis caching

**Benefits**:
- Progress calculations are relatively expensive even with optimizations
- Student progress doesn't change frequently (only when they submit answers)
- Cache TTL of 5-15 minutes would be reasonable

**Example Implementation**:
```javascript
async function calculateCourseProgressWithCache(courseId, userId) {
  const cacheKey = `progress:course:${courseId}:user:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  const progress = await calculateCourseProgress(courseId, userId);
  await redis.setex(cacheKey, 300, JSON.stringify(progress)); // 5 min TTL
  return progress;
}
```

**Cache Invalidation**: Invalidate when student submits an answer:
```javascript
await redis.del(`progress:course:${courseId}:user:${userId}`);
```

## 3. Pagination for List Endpoints

**Endpoints to Paginate**:
- `GET /api/courses`
- `GET /api/courses/:courseId/modules`
- `GET /api/modules/:moduleId/lessons`
- `GET /api/lessons/:lessonId/activities`

**Benefits**:
- Reduces payload size
- Improves initial page load time
- Better user experience with lazy loading

**Implementation**:
```javascript
router.get('/courses', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  
  const [courses, total] = await Promise.all([
    prisma.courseOffering.findMany({
      where: { /* ... */ },
      skip,
      take: limit,
    }),
    prisma.courseOffering.count({ where: { /* ... */ } })
  ]);
  
  res.json({ courses, total, page, pages: Math.ceil(total / limit) });
});
```

## 4. Database Connection Pooling Optimization

**Configuration to Review**:
```javascript
// In database.js or .env
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=10"
```

**Recommendations**:
- Set appropriate connection pool size based on expected concurrent users
- Monitor connection pool usage
- Consider using PgBouncer for connection pooling at database level

## 5. Eager Loading for Related Data

**Current Pattern** (Multiple Queries):
```javascript
const activity = await prisma.activity.findUnique({ where: { id } });
const lesson = await prisma.lesson.findUnique({ where: { id: activity.lessonId } });
const module = await prisma.module.findUnique({ where: { id: lesson.moduleId } });
```

**Optimized Pattern** (Single Query):
```javascript
const activity = await prisma.activity.findUnique({
  where: { id },
  include: {
    lesson: {
      include: {
        module: {
          include: { courseOffering: true }
        }
      }
    }
  }
});
```

## 6. Materialized Views for Complex Aggregations

**Use Case**: Student dashboard showing overall progress across all courses

**PostgreSQL Materialized View**:
```sql
CREATE MATERIALIZED VIEW student_progress_summary AS
SELECT 
  u.id as user_id,
  co.id as course_id,
  COUNT(DISTINCT a.id) as total_activities,
  COUNT(DISTINCT CASE WHEN s.is_correct THEN a.id END) as completed_activities
FROM "User" u
CROSS JOIN "CourseOffering" co
LEFT JOIN "Module" m ON m.course_offering_id = co.id AND m.is_published = true
LEFT JOIN "Lesson" l ON l.module_id = m.id AND l.is_published = true
LEFT JOIN "Activity" a ON a.lesson_id = l.id
LEFT JOIN LATERAL (
  SELECT is_correct
  FROM "Submission" s2
  WHERE s2.user_id = u.id AND s2.activity_id = a.id
  ORDER BY attempt_number DESC
  LIMIT 1
) s ON true
GROUP BY u.id, co.id;

CREATE INDEX ON student_progress_summary(user_id);
```

**Refresh Strategy**: Refresh every 15 minutes or on-demand after submissions.

## 7. Query Result Caching with Prisma

**Enable Prisma Accelerate** or implement application-level caching:

```javascript
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

const prisma = new PrismaClient().$extends(withAccelerate());

// Use caching for queries
const courses = await prisma.courseOffering.findMany({
  cacheStrategy: { ttl: 60, swr: 30 }
});
```

## 8. Optimize JSON Column Access

**Current Pattern**:
```javascript
const config = activity.config;
const question = config?.question;
```

**Issue**: Fetching entire JSON column even when only specific fields are needed.

**Optimization**: Use JSON path queries when possible:
```sql
SELECT 
  id,
  config->>'question' as question,
  config->>'questionType' as question_type
FROM "Activity"
WHERE id = $1;
```

## 9. Batch Write Operations

**Current Pattern** (Multiple Inserts):
```javascript
for (const topic of topics) {
  await prisma.activitySecondaryTopic.create({ data: { ... } });
}
```

**Optimized Pattern** (Single Batch Insert):
```javascript
await prisma.activitySecondaryTopic.createMany({
  data: topics.map(topic => ({ ... })),
  skipDuplicates: true
});
```

## 10. Database Query Monitoring

**Tools to Implement**:
- pg_stat_statements extension for PostgreSQL
- Prisma query logging in development
- APM tools (New Relic, Datadog, etc.)

**Example Configuration**:
```javascript
const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
  ],
});

prisma.$on('query', (e) => {
  if (e.duration > 100) { // Log slow queries
    console.warn('Slow query detected:', {
      query: e.query,
      duration: e.duration,
      params: e.params
    });
  }
});
```

## Priority Recommendations

Based on potential impact and implementation effort:

### High Priority
1. **Caching Layer** - High impact, medium effort
2. **Pagination** - High impact, low effort
3. **Topic Fetching Optimization** - Medium impact, low effort

### Medium Priority
4. **Connection Pooling** - Medium impact, low effort
5. **Eager Loading** - Medium impact, medium effort
6. **Batch Write Operations** - Medium impact, low effort

### Low Priority (Consider for Large Scale)
7. **Materialized Views** - High impact, high effort
8. **Query Result Caching** - Medium impact, medium effort
9. **JSON Column Optimization** - Low impact, medium effort
10. **Query Monitoring** - Low impact (preventive), low effort

## Measurement Before Implementation

Before implementing any of these optimizations, measure:
1. Current query execution times
2. Database CPU and memory usage
3. API endpoint response times
4. Number of queries per request

After implementation, compare metrics to validate improvements.
