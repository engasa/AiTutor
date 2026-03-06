import { auth } from '../auth.js';
import { fromNodeHeaders } from 'better-auth/node';
import { prisma } from '../config/database.js';
import { isBootstrapAdminEmail } from '../config/bootstrapAdmins.js';

// Attach session user from Better Auth to req.user for downstream handlers
export async function attachSession(req, res, next) {
  try {
    const headers = fromNodeHeaders(req.headers);
    const data = await auth.api.getSession({ headers });
    if (data && data.user) {
      const id = typeof data.user.id === 'string' ? parseInt(data.user.id, 10) : data.user.id;
      // Hydrate full user (including role) from our DB for RBAC
      const dbUser = await prisma.user.findUnique({
        where: { id },
      });
      if (dbUser && dbUser.role !== 'ADMIN' && isBootstrapAdminEmail(dbUser.email)) {
        req.user = await prisma.user.update({
          where: { id: dbUser.id },
          data: { role: 'ADMIN' },
        });
      } else {
        req.user = dbUser ?? null;
      }
    } else {
      req.user = null;
    }
  } catch {
    req.user = null;
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ error: `${role} role required` });
    }

    next();
  };
}

export function requireRoles(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `One of the following roles required: ${roles.join(', ')}` });
    }

    next();
  };
}
