/**
 * @file Thin HTTP client wrapping the upstream EduAI service.
 *
 * Responsibility: Centralize the EduAI base URL (env-driven), provide typed
 *   wrappers for the endpoints AiTutor consumes (`/courses`,
 *   `/courses/:id/topics`, `/courses/:id/enrollments`, `/ai-models`,
 *   `/chat`), and validate every response with Zod schemas so downstream
 *   code can rely on shapes.
 * Callers: `aiGuidance.js` (chat URL), `aiModelPolicy.js` (model catalog),
 *   `enrollmentSync.js` (course enrollments), course import/sync routes.
 * Gotchas:
 *   - Base URL comes from `EDUAI_BASE_URL` env (default
 *     `http://localhost:5174/api`); a trailing slash is stripped.
 *   - Auth model: most endpoints require the user's EduAI OAuth access
 *     token (`requireAuth: true`); `/ai-models` is unauthenticated.
 *   - Zod validation failures map to `error.status = 502` so the API can
 *     return "upstream contract broken" rather than a 500 — caller checks
 *     `error.status`.
 *   - `getEduAiChatUrl()` is consumed by `aiGuidance.js`, which is the only
 *     caller that POSTs there directly (this client doesn't wrap /chat).
 * Related: `../schemas/eduai.js`, `aiGuidance.js`, `aiModelPolicy.js`,
 *   `enrollmentSync.js`.
 */

import {
  EduAiCourseListSchema,
  EduAiTopicListSchema,
  EduAiEnrollmentListSchema,
} from '../schemas/eduai.js';
const DEFAULT_BASE_URL = 'http://localhost:5174/api';

function normalizeBaseUrl(rawUrl) {
  if (!rawUrl) return DEFAULT_BASE_URL;
  return rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
}

export function getEduAiBaseUrl() {
  return normalizeBaseUrl(process.env.EDUAI_BASE_URL || DEFAULT_BASE_URL);
}

/**
 * AI completion endpoint. Used by `aiGuidance.js` rather than the
 * `requestEduAi` helper because chat needs custom headers (per-user
 * Authorization) and a non-trivial body shape.
 */
export function getEduAiChatUrl() {
  return `${getEduAiBaseUrl()}/chat`;
}

/**
 * Shared fetch helper. Surfaces upstream HTTP failures as Errors with
 * `status` set so route handlers can pass them through unchanged. Returns
 * `null` on 204 No Content; otherwise parses JSON.
 */
async function requestEduAi(path, options = {}) {
  const accessToken = typeof options.accessToken === 'string' ? options.accessToken.trim() : null;
  const requireAuth = options.requireAuth === true;

  if (requireAuth && !accessToken) {
    const err = new Error('EduAI access token is required');
    err.status = 401;
    throw err;
  }

  const url = `${getEduAiBaseUrl()}${path}`;
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const message = errorText || `EduAI request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function listEduAiCourses(accessToken) {
  const data = await requestEduAi('/courses', {
    accessToken,
    requireAuth: true,
  });
  try {
    const parsed = EduAiCourseListSchema.parse(data);
    return parsed.courses;
  } catch (e) {
    const err = new Error('Invalid response when fetching EduAI courses');
    err.cause = e;
    err.status = 502;
    throw err;
  }
}

export async function findEduAiCourseById(courseId, accessToken) {
  if (!courseId) return null;
  const courses = await listEduAiCourses(accessToken);
  return courses.find((course) => course.id === courseId) ?? null;
}

// Fetch topics for a specific EduAI course by external id
export async function listEduAiCourseTopics(externalCourseId, accessToken) {
  if (!externalCourseId) return [];
  const data = await requestEduAi(`/courses/${externalCourseId}/topics`, {
    accessToken,
    requireAuth: true,
  });
  try {
    const parsed = EduAiTopicListSchema.parse(data);
    return parsed.topics;
  } catch (e) {
    const err = new Error('Invalid response when fetching EduAI course topics');
    err.cause = e;
    err.status = 502;
    throw err;
  }
}

// Fetch enrollments for a specific EduAI course by external id
export async function listEduAiCourseEnrollments(externalCourseId, accessToken) {
  if (!externalCourseId) return [];
  const data = await requestEduAi(`/courses/${externalCourseId}/enrollments`, {
    accessToken,
    requireAuth: true,
  });
  try {
    const parsed = EduAiEnrollmentListSchema.parse(data);
    return parsed.enrollments;
  } catch (e) {
    const err = new Error('Invalid response when fetching EduAI course enrollments');
    err.cause = e;
    err.status = 502;
    throw err;
  }
}

/**
 * Fetch the EduAI model catalog. Unlike the other endpoints this one is
 * unauthenticated (no `requireAuth`) — it powers admin model-selection UIs
 * before any user has linked an OAuth account.
 */
export async function listEduAiModels() {
  const data = await requestEduAi('/ai-models');
  if (!Array.isArray(data)) {
    throw new Error('Invalid response from EduAI models endpoint');
  }
  return data;
}
