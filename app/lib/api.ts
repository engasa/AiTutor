import { getAuthToken } from '../hooks/useLocalUser';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function http(path: string, init?: RequestInit) {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log(`Making request to: ${API_BASE}${path}`);
  console.log('Headers:', headers);

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers || {}),
    },
  });

  console.log('Response status:', res.status);
  console.log('Response ok:', res.ok);

  if (!res.ok) {
    const errorText = await res.text();
    console.log('Error response body:', errorText);

    if (res.status === 401 || res.status === 403) {
      // Token expired or invalid, trigger logout
      if (typeof window !== 'undefined') {
        localStorage.removeItem('aitutor_auth_token');
        window.location.href = '/';
      }
      throw new Error('Authentication required');
    }
    throw new Error(`Request failed: ${res.status} - ${errorText}`);
  }
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

