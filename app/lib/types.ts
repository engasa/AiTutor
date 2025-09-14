export type Role = 'STUDENT' | 'INSTRUCTOR';

export type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
};

export type Course = {
  id: number;
  title: string;
  description: string;
  color?: string | null;
};

export type Topic = {
  id: number;
  name: string;
  description?: string | null;
  courseId: number;
};

export type QuestionList = {
  id: number;
  title: string;
  topicId: number;
};

export type Question = {
  id: number;
  prompt: string;
  type: 'MCQ' | 'SHORT_TEXT';
  options: { choices?: string[] } | null;
  hints: string[];
};

