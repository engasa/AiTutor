export type Role = 'STUDENT' | 'INSTRUCTOR';

export type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
};

export type Progress = {
  completed: number;
  total: number;
  percentage: number;
};

export type CompletionStatus = 'correct' | 'incorrect' | 'not_attempted';

export type Course = {
  id: number;
  title: string;
  description?: string | null;
  isPublished: boolean;
  startDate?: string | null;
  endDate?: string | null;
  progress?: Progress;
};

export type Module = {
  id: number;
  title: string;
  description?: string | null;
  position: number;
  isPublished: boolean;
  progress?: Progress;
};

export type ModuleDetail = Module & {
  courseOfferingId: number;
};

export type Lesson = {
  id: number;
  title: string;
  contentMd?: string | null;
  position: number;
  isPublished: boolean;
  courseOfferingId?: number;
  moduleId?: number;
  progress?: Progress;
};

export type Activity = {
  id: number;
  title?: string | null;
  instructionsMd: string;
  position: number;
  question: string;
  type: 'MCQ' | 'SHORT_TEXT';
  options: { choices?: string[] } | null;
  answer?: any;
  hints: string[];
  promptTemplateId?: number | null;
  promptTemplate?: { id: number; name: string } | null;
  mainTopic: Topic | null;
  secondaryTopics: Topic[];
  completionStatus?: CompletionStatus;
};


export type PromptTemplate = {
  id: number;
  name: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number | null;
  topP?: number | null;
};

export type Topic = {
  id: number;
  name: string;
};
