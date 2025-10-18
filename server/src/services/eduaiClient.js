const DEFAULT_BASE_URL = 'http://localhost:5174/api';

function normalizeBaseUrl(rawUrl) {
  if (!rawUrl) return DEFAULT_BASE_URL;
  return rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
}

export function getEduAiBaseUrl() {
  return normalizeBaseUrl(process.env.EDUAI_BASE_URL || DEFAULT_BASE_URL);
}

export function getEduAiChatUrl() {
  return `${getEduAiBaseUrl()}/chat`;
}

async function requestEduAi(path, options = {}) {
  const apiKey = process.env.EDUAI_API_KEY;
  if (!apiKey) {
    throw new Error('EDUAI_API_KEY is not configured');
  }

  const url = `${getEduAiBaseUrl()}${path}`;
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...(options.headers ?? {}),
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

export async function listEduAiCourses() {
  const data = await requestEduAi('/courses');
  if (!data || typeof data !== 'object' || !Array.isArray(data.courses)) {
    throw new Error('Unexpected response when fetching EduAI courses');
  }
  return data.courses;
}

export async function findEduAiCourseById(courseId) {
  if (!courseId) return null;
  const courses = await listEduAiCourses();
  return courses.find((course) => course.id === courseId) ?? null;
}
