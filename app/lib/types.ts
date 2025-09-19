export type Role = 'STUDENT' | 'INSTRUCTOR';

export type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
};

export type CourseStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type Course = {
  id: number;
  title: string;
  description?: string | null;
  status: CourseStatus;
  startDate?: string | null;
  endDate?: string | null;
  templateId?: number | null;
};

export type Module = {
  id: number;
  title: string;
  description?: string | null;
  position: number;
  templateId?: number | null;
};

export type ModuleDetail = Module & {
  courseOfferingId: number;
};

export type Lesson = {
  id: number;
  title: string;
  contentMd?: string | null;
  position: number;
  templateId?: number | null;
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
  activityTypeId: number;
  promptTemplateId?: number | null;
  templateId?: number | null;
};
