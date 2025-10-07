const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function http(path: string, init?: RequestInit) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...headers,
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      if (typeof window !== 'undefined') {
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
  courseById: (courseId: number) => http(`/api/courses/${courseId}`),
  createCourse: (payload: {
    title: string;
    description?: string;
    sourceCourseId?: number;
    startDate?: string;
    endDate?: string;
  }) =>
    http('/api/courses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateCourse: (
    courseId: number,
    payload: {
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
  publishCourse: (courseId: number) =>
    http(`/api/courses/${courseId}/publish`, {
      method: 'PATCH',
    }),
  unpublishCourse: (courseId: number) =>
    http(`/api/courses/${courseId}/unpublish`, {
      method: 'PATCH',
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
  publishModule: (moduleId: number) =>
    http(`/api/modules/${moduleId}/publish`, {
      method: 'PATCH',
    }),
  unpublishModule: (moduleId: number) =>
    http(`/api/modules/${moduleId}/unpublish`, {
      method: 'PATCH',
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
  publishLesson: (lessonId: number) =>
    http(`/api/lessons/${lessonId}/publish`, {
      method: 'PATCH',
    }),
  unpublishLesson: (lessonId: number) =>
    http(`/api/lessons/${lessonId}/unpublish`, {
      method: 'PATCH',
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
      mainTopicId: number;
      secondaryTopicIds?: number[];
    }
  ) =>
    http(`/api/lessons/${lessonId}/activities`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateActivity: (
    activityId: number,
    payload: {
      promptTemplateId?: number | null;
      mainTopicId?: number;
      secondaryTopicIds?: number[];
    }
  ) =>
    http(`/api/activities/${activityId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  topicsForCourse: (courseId: number) => http(`/api/courses/${courseId}/topics`),
  createTopic: (courseId: number, payload: { name: string }) =>
    http(`/api/courses/${courseId}/topics`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  submitAnswer: (activityId: number, payload: any) =>
    http(`/api/questions/${activityId}/answer`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getActivityGuidance: (activityId: number, studentAnswer?: string | number) =>
    http(`/api/activities/${activityId}/guidance`, {
      method: 'POST',
      body: JSON.stringify({ studentAnswer }),
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
  logout: () =>
    http('/api/logout', {
      method: 'POST',
    }),
};

export default api;
