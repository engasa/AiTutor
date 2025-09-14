const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function http(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    http('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  coursesForUser: (userId: number) => http(`/api/courses?userId=${userId}`),
  topicsForCourse: (courseId: number) => http(`/api/courses/${courseId}/topics`),
  listsForTopic: (topicId: number) => http(`/api/topics/${topicId}/lists`),
  listById: (listId: number) => http(`/api/lists/${listId}`),
  questionsForList: (listId: number) => http(`/api/lists/${listId}/questions`),
  submitAnswer: (questionId: number, payload: any) =>
    http(`/api/questions/${questionId}/answer`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createList: (title: string, topicId: number) =>
    http(`/api/lists`, { method: 'POST', body: JSON.stringify({ title, topicId }) }),
  createQuestion: (
    listId: number,
    data: { prompt: string; type: 'MCQ' | 'SHORT_TEXT'; options?: any; answer?: any; hints?: string[] }
  ) => http(`/api/lists/${listId}/questions`, { method: 'POST', body: JSON.stringify(data) }),
};

export default api;

