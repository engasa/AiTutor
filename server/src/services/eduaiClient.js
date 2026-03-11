import { EduAiCourseListSchema, EduAiTopicListSchema } from '../schemas/eduai.js';
import { getEffectiveEduAiApiKey } from './systemSettings.js';
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
  const useApiKey = options.useApiKey !== false;
  const apiKey = useApiKey ? await getEffectiveEduAiApiKey() : null;
  if (useApiKey && !apiKey) {
    throw new Error('EDUAI_API_KEY is not configured');
  }

  const url = `${getEduAiBaseUrl()}${path}`;
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
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

export async function findEduAiCourseById(courseId) {
  if (!courseId) return null;
  const courses = await listEduAiCourses();
  return courses.find((course) => course.id === courseId) ?? null;
}

// Fetch topics for a specific EduAI course by external id
export async function listEduAiCourseTopics(externalCourseId) {
  if (!externalCourseId) return [];
  const data = await requestEduAi(`/courses/${externalCourseId}/topics`);
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

export async function listEduAiModels() {
  const data = await requestEduAi('/ai-models', { useApiKey: false });
  if (!Array.isArray(data)) {
    throw new Error('Invalid response from EduAI models endpoint');
  }
  return data;
}
