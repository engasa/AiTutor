import type { AiModel, EduAiApiKeyStatus, EduAiCourse, SuggestedPrompt, User } from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function http(path: string, init?: RequestInit) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...headers,
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      // Only redirect if we are NOT already at the root
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
      throw new Error("Authentication required");
    }
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  me: () => http("/api/me") as Promise<{ user: User | null }>,
  login: async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || "Invalid credentials");
    }
    // After sign-in, load the current user via our stable endpoint
    return http("/api/me");
  },
  listCourses: () => http("/api/courses"),
  listEduAiCourses: () => http("/api/eduai/courses") as Promise<EduAiCourse[]>,
  courseById: (courseId: number) => http(`/api/courses/${courseId}`),
  createCourse: (payload: {
    title: string;
    description?: string;
    sourceCourseId?: number;
    startDate?: string;
    endDate?: string;
  }) =>
    http("/api/courses", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCourse: (
    courseId: number,
    payload: {
      title?: string;
      description?: string | null;
      startDate?: string | null;
      endDate?: string | null;
    },
  ) =>
    http(`/api/courses/${courseId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  publishCourse: (courseId: number) =>
    http(`/api/courses/${courseId}/publish`, {
      method: "PATCH",
    }),
  unpublishCourse: (courseId: number) =>
    http(`/api/courses/${courseId}/unpublish`, {
      method: "PATCH",
    }),
  importIntoCourse: (
    courseId: number,
    payload: {
      sourceCourseId?: number;
      moduleIds?: number[];
      lessonIds?: number[];
      targetModuleId?: number;
    },
  ) =>
    http(`/api/courses/${courseId}/import`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  importEduAiCourse: (payload: { externalCourseId: string }) =>
    http("/api/courses/import-external", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  modulesForCourse: (courseId: number) =>
    http(`/api/courses/${courseId}/modules`),
  moduleById: (moduleId: number) => http(`/api/modules/${moduleId}`),
  createModule: (
    courseId: number,
    payload: { title: string; description?: string; position?: number },
  ) =>
    http(`/api/courses/${courseId}/modules`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  publishModule: (moduleId: number) =>
    http(`/api/modules/${moduleId}/publish`, {
      method: "PATCH",
    }),
  unpublishModule: (moduleId: number) =>
    http(`/api/modules/${moduleId}/unpublish`, {
      method: "PATCH",
    }),
  lessonsForModule: (moduleId: number) =>
    http(`/api/modules/${moduleId}/lessons`),
  createLesson: (
    moduleId: number,
    payload: { title: string; contentMd?: string; position?: number },
  ) =>
    http(`/api/modules/${moduleId}/lessons`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  publishLesson: (lessonId: number) =>
    http(`/api/lessons/${lessonId}/publish`, {
      method: "PATCH",
    }),
  unpublishLesson: (lessonId: number) =>
    http(`/api/lessons/${lessonId}/unpublish`, {
      method: "PATCH",
    }),
  lessonById: (lessonId: number) => http(`/api/lessons/${lessonId}`),
  activitiesForLesson: (lessonId: number) =>
    http(`/api/lessons/${lessonId}/activities`),
  createActivity: (
    lessonId: number,
    payload: {
      title?: string;
      question: string;
      type?: "MCQ" | "SHORT_TEXT";
      options?: { choices?: string[] } | null;
      answer?: any;
      hints?: string[];
      instructionsMd?: string;
      promptTemplateId?: number | null;
      customPrompt?: string | null;
      customPromptTitle?: string | null;
      mainTopicId: number;
      secondaryTopicIds?: number[];
      enableTeachMode?: boolean;
      enableGuideMode?: boolean;
      enableCustomMode?: boolean;
    },
  ) =>
    http(`/api/lessons/${lessonId}/activities`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateActivity: (
    activityId: number,
    payload: {
      title?: string | null;
      instructionsMd?: string;
      question?: string;
      type?: "MCQ" | "SHORT_TEXT";
      options?: { choices?: string[] } | string[] | null;
      answer?: any;
      hints?: string[];
      promptTemplateId?: number | null;
      customPrompt?: string | null;
      customPromptTitle?: string | null;
      mainTopicId?: number;
      secondaryTopicIds?: number[];
      enableTeachMode?: boolean;
      enableGuideMode?: boolean;
      enableCustomMode?: boolean;
    },
  ) => {
    const body: Record<string, unknown> = { ...payload };
    if (Object.prototype.hasOwnProperty.call(payload, "options")) {
      const value = payload.options;
      if (value === null) {
        body.options = null;
      } else if (Array.isArray(value)) {
        body.options = value;
      } else if (value && Array.isArray(value.choices)) {
        body.options = value.choices;
      }
    }
    return http(`/api/activities/${activityId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  deleteActivity: (activityId: number) =>
    http(`/api/activities/${activityId}`, {
      method: "DELETE",
    }),
  topicsForCourse: (courseId: number) =>
    http(`/api/courses/${courseId}/topics`),
  createTopic: (courseId: number, payload: { name: string }) =>
    http(`/api/courses/${courseId}/topics`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  syncCourseTopics: (courseId: number) =>
    http(`/api/courses/${courseId}/topics/sync`, {
      method: "POST",
    }),
  remapCourseTopics: (
    courseId: number,
    mappings: { fromTopicId: number; toTopicId: number }[],
  ) =>
    http(`/api/courses/${courseId}/topics/remap`, {
      method: "POST",
      body: JSON.stringify({ mappings }),
    }),
  submitAnswer: (activityId: number, payload: any) =>
    http(`/api/questions/${activityId}/answer`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  sendTeachMessage: (
    activityId: number,
    params: {
      knowledgeLevel: string;
      topicId?: number;
      message: string;
      modelId: string;
      apiKey: string;
      chatId?: string | null;
      messageId?: string;
    },
  ) =>
    http(`/api/activities/${activityId}/teach`, {
      method: "POST",
      body: JSON.stringify(params),
    }),
  sendGuideMessage: (
    activityId: number,
    params: {
      knowledgeLevel: string;
      message: string;
      studentAnswer?: string | number | null;
      modelId: string;
      apiKey: string;
      chatId?: string | null;
      messageId?: string;
    },
  ) =>
    http(`/api/activities/${activityId}/guide`, {
      method: "POST",
      body: JSON.stringify(params),
    }),
  sendCustomMessage: (
    activityId: number,
    params: {
      knowledgeLevel: string;
      topicId?: number;
      message: string;
      studentAnswer?: string | number | null;
      modelId: string;
      apiKey: string;
      chatId?: string | null;
      messageId?: string;
    },
  ) =>
    http(`/api/activities/${activityId}/custom`, {
      method: "POST",
      body: JSON.stringify(params),
    }),
  listAiModels: () => http("/api/ai-models") as Promise<AiModel[]>,
  validateApiKey: (provider: string, apiKey: string) =>
    http("/api/ai-models/validate-key", {
      method: "POST",
      body: JSON.stringify({ provider, apiKey }),
    }) as Promise<{ valid: boolean; error?: string }>,
  getEduAiApiKeyStatus: () =>
    http("/api/admin/settings/eduai-api-key") as Promise<EduAiApiKeyStatus>,
  setEduAiApiKey: (apiKey: string) =>
    http("/api/admin/settings/eduai-api-key", {
      method: "PUT",
      body: JSON.stringify({ apiKey }),
    }) as Promise<EduAiApiKeyStatus>,
  clearEduAiApiKey: () =>
    http("/api/admin/settings/eduai-api-key", {
      method: "DELETE",
    }) as Promise<EduAiApiKeyStatus>,
  listPrompts: () => http("/api/prompts"),
  listSuggestedPrompts: () => http("/api/suggested-prompts") as Promise<SuggestedPrompt[]>,
  createPrompt: (payload: {
    name: string;
    systemPrompt: string;
    temperature?: number | null;
    topP?: number | null;
  }) =>
    http("/api/prompts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logout: async () => {
    // Call Better Auth sign-out endpoint directly without redirect-on-401 behavior
    await fetch(`${API_BASE}/api/auth/sign-out`, {
      method: "POST",
      credentials: "include",
    });
    return { ok: true } as const;
  },
};

export default api;
