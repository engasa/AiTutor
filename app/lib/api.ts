import { getAuthToken } from '../hooks/useLocalUser';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function http(path: string, init?: RequestInit) {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('aitutor_auth_token');
        window.location.href = '/';
      }
      throw new Error('Authentication required');
    }
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    http('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  listCourses: () => http('/api/courses'),
  createCourse: (payload: {
    title: string;
    description?: string;
    sourceCourseId?: number;
    startDate?: string;
    endDate?: string;
    status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  }) =>
    http('/api/courses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCourse: (
    courseId: number,
    payload: {
      status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
      title?: string;
      description?: string | null;
      startDate?: string | null;
      endDate?: string | null;
    }
  ) =>
    http(`/api/courses/${courseId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  importIntoCourse: (
    courseId: number,
    payload: {
      sourceCourseId?: number;
      moduleIds?: number[];
      lessonIds?: number[];
      targetModuleId?: number;
    }
  ) =>
    http(`/api/courses/${courseId}/import`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  modulesForCourse: (courseId: number) => http(`/api/courses/${courseId}/modules`),
  moduleById: (moduleId: number) => http(`/api/modules/${moduleId}`),
  createModule: (
    courseId: number,
    payload: { title: string; description?: string; position?: number }
  ) =>
    http(`/api/courses/${courseId}/modules`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  lessonsForModule: (moduleId: number) => http(`/api/modules/${moduleId}/lessons`),
  createLesson: (
    moduleId: number,
    payload: { title: string; contentMd?: string; position?: number }
  ) =>
    http(`/api/modules/${moduleId}/lessons`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  lessonById: (lessonId: number) => http(`/api/lessons/${lessonId}`),
  activitiesForLesson: (lessonId: number) => http(`/api/lessons/${lessonId}/activities`),
  createActivity: (
    lessonId: number,
    payload: {
      title?: string;
      question: string;
      type?: 'MCQ' | 'SHORT_TEXT';
      options?: { choices?: string[] } | null;
      answer?: any;
      hints?: string[];
      instructionsMd?: string;
      promptTemplateId?: number | null;
    }
  ) =>
    http(`/api/lessons/${lessonId}/activities`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateActivity: (
    activityId: number,
    payload: {
      promptTemplateId: number | null;
    }
  ) =>
    http(`/api/activities/${activityId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  submitAnswer: (activityId: number, payload: any) =>
    http(`/api/questions/${activityId}/answer`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listPrompts: () => http('/api/prompts'),
  createPrompt: (payload: {
    name: string;
    systemPrompt: string;
    userPrompt: string;
    temperature?: number | null;
    topP?: number | null;
  }) =>
    http('/api/prompts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export default api;
