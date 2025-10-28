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

export type ExternalCourseMetadata = {
  id: string;
  code?: string | null;
  name?: string | null;
  description?: string | null;
  term?: string | null;
  year?: number | null;
  isActive?: boolean | null;
  aiInstructions?: string | null;
  [key: string]: unknown;
};

export type EduAiCourse = ExternalCourseMetadata;

export type Course = {
  id: number;
  title: string;
  description?: string | null;
  isPublished: boolean;
  startDate?: string | null;
  endDate?: string | null;
  progress?: Progress;
  externalId?: string | null;
  externalSource?: string | null;
  externalMetadata?: ExternalCourseMetadata | null;
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
  enableTeachMode: boolean;
  enableGuideMode: boolean;
  completionStatus?: CompletionStatus;
};


export type PromptTemplate = {
  id: number;
  name: string;
  systemPrompt: string;
  temperature?: number | null;
  topP?: number | null;
};

export type Topic = {
  id: number;
  name: string;
};

export type AiModel = {
  id: string;
  modelId: string;
  modelName: string;
};
