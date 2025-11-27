# Prisma v6 to v7 Migration

This document outlines the changes made to upgrade from Prisma ORM v6.16.1 to v7.0.1.

## Summary

Prisma v7 introduces breaking changes to how the client connects to databases. The key change is that **database URLs can no longer be specified in `schema.prisma`** — they must be provided via a new `prisma.config.ts` file for CLI operations and via a **driver adapter** at runtime.

## Changes Made

### 1. Dependencies Updated

**File:** `server/package.json`

```diff
  "dependencies": {
-   "@prisma/client": "^6.16.1",
+   "@prisma/client": "^7.0.1",
+   "@prisma/adapter-pg": "^7.0.1",
+   "tsx": "^4.20.6",
    ...
  },
  "devDependencies": {
-   "prisma": "^6.16.1"
+   "prisma": "^7.0.1",
+   "esbuild": "^0.27.0"
  }
```

**Why:**
- `@prisma/adapter-pg` — Required adapter for PostgreSQL Direct TCP connections in v7
- `tsx` — TypeScript executor needed to run the new TypeScript seed file
- `esbuild` — Dependency required by `tsx`

---

### 2. Schema Changes

**File:** `server/prisma/schema.prisma`

```diff
  generator client {
    provider = "prisma-client-js"
  }

  datasource db {
    provider = "postgresql"
-   url      = env("DATABASE_URL")
  }
```

**Why:**
- Prisma v7 **disallows** `url` in the datasource block
- Connection URL is now provided via `prisma.config.ts` (for CLI) and the adapter (at runtime)
- We kept `prisma-client-js` generator (not the new `prisma-client`) because the server uses plain JavaScript, and `prisma-client` outputs TypeScript-only files

---

### 3. New Prisma Config File

**File:** `server/prisma.config.ts` (new)

```ts
import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
})
```

**Why:**
- Prisma CLI commands (`migrate`, `db push`, etc.) need to know the database URL
- This file centralizes CLI configuration
- The `seed` command is now defined here instead of `package.json`

---

### 4. Database Client Initialization

**File:** `server/src/config/database.js`

```diff
  import { PrismaClient } from '@prisma/client';
+ import { PrismaPg } from '@prisma/adapter-pg';

+ const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
- export const prisma = new PrismaClient();
+ export const prisma = new PrismaClient({ adapter });
```

**Why:**
- Prisma v7 requires an explicit adapter for database connections
- `PrismaPg` provides Direct TCP connection to PostgreSQL
- The adapter reads the connection string from environment variables at runtime

---

### 5. Seed Script Converted to TypeScript

**File:** `server/prisma/seed.js` → `server/prisma/seed.ts`

```diff
+ import 'dotenv/config';
- import { PrismaClient } from '@prisma/client';
+ import { PrismaClient } from '@prisma/client';
+ import { PrismaPg } from '@prisma/adapter-pg';
  import { hashPassword } from 'better-auth/crypto';

- const prisma = new PrismaClient();
+ const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
+ const prisma = new PrismaClient({ adapter });
```

**Why:**
- Seed script needs the same adapter pattern as the runtime
- TypeScript provides better type safety for the seed data
- `prisma.config.ts` references `tsx prisma/seed.ts`

---

### 6. Package Scripts Updated

**File:** `server/package.json`

```diff
  "scripts": {
-   "seed": "prisma generate && node prisma/seed.js"
+   "generate": "prisma generate",
+   "migrate": "prisma migrate dev",
+   "seed": "tsx prisma/seed.ts"
  }
```

**Why:**
- Seed command now uses `tsx` to run TypeScript
- Added explicit `generate` and `migrate` scripts for convenience
- Seed no longer needs to run `prisma generate` first (do it separately)

---

## Architecture: Before vs After

### Before (Prisma v6)

```
schema.prisma (url = env("DATABASE_URL"))
       │
       ▼
PrismaClient() ──── reads URL from schema ──── PostgreSQL
```

### After (Prisma v7)

```
prisma.config.ts ──── provides URL to CLI ──── prisma migrate/generate
       
schema.prisma (no url)
       │
       ▼
PrismaPg adapter ──── connectionString from env ──── PostgreSQL
       │
       ▼
PrismaClient({ adapter })
```

---

## Commands Reference

```bash
# Generate Prisma client (run after schema changes)
cd server && bun run generate

# Run migrations
cd server && bun run migrate

# Seed the database
cd server && bun run seed

# Start dev server
cd server && bun run dev
```

---

## Troubleshooting

### Error: `url` property no longer supported

If you see:
```
The datasource property `url` is no longer supported in schema files.
```

**Fix:** Remove `url = env("DATABASE_URL")` from `datasource db` block in `schema.prisma`.

### Error: Named export 'PrismaClient' not found

If you see:
```
SyntaxError: Named export 'PrismaClient' not found
```

**Fix:** Ensure you're using `prisma-client-js` generator (not `prisma-client`) for JavaScript projects, and run `bunx prisma generate`.

### Error: Cannot find module adapter

If you see module resolution errors for `@prisma/adapter-pg`:

**Fix:** Run `bun add @prisma/adapter-pg`

---

## References

- [Prisma v7 Upgrade Guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)
- [Prisma Config Reference](https://pris.ly/d/config-datasource)
- [Driver Adapters Documentation](https://www.prisma.io/docs/orm/overview/databases/database-drivers)
