// Seed data — used as fallback when the backend has not yet been wired into a
// redesigned surface. Sourced verbatim from the design handoff at
// aitutor/project/assets/data.jsx.

export type CourseColor = 'ember' | 'lapis' | 'moss' | 'sunset';

export type Lesson = {
  id: string;
  n: number;
  title: string;
  progress: number;
  published: boolean;
  activities: number;
  current?: boolean;
};

export type Module = {
  id: string;
  n: number;
  title: string;
  description: string;
  progress: number;
  published: boolean;
  lessons: Lesson[];
};

export type Course = {
  id: string;
  title: string;
  code: string;
  description: string;
  instructor: string;
  term: string;
  enrolled: number;
  progress: number;
  color: CourseColor;
  modules: Module[];
};

export const COURSES: Course[] = [
  {
    id: 'c1',
    title: 'Introduction to Algorithms',
    code: 'CPSC 320',
    description:
      'Foundations of algorithm design and analysis — sorting, graphs, dynamic programming, and complexity.',
    instructor: 'Prof. M. Ahmadi',
    term: 'Spring 2026',
    enrolled: 142,
    progress: 0.42,
    color: 'ember',
    modules: [
      {
        id: 'm1',
        n: 1,
        title: 'Analysis Foundations',
        description: 'Asymptotic growth, recurrences, loop invariants.',
        progress: 1.0,
        published: true,
        lessons: [
          { id: 'l1', n: 1, title: 'Big-O and Friends', progress: 1.0, published: true, activities: 6 },
          { id: 'l2', n: 2, title: 'Master Theorem', progress: 1.0, published: true, activities: 5 },
          {
            id: 'l3',
            n: 3,
            title: 'Loop Invariants in Practice',
            progress: 1.0,
            published: true,
            activities: 4,
          },
        ],
      },
      {
        id: 'm2',
        n: 2,
        title: 'Sorting Algorithms',
        description: 'Comparison sorts, linear-time sorts, stability.',
        progress: 0.65,
        published: true,
        lessons: [
          { id: 'l4', n: 1, title: 'Mergesort', progress: 1.0, published: true, activities: 5 },
          {
            id: 'l5',
            n: 2,
            title: 'Quicksort',
            progress: 0.6,
            published: true,
            activities: 5,
            current: true,
          },
          { id: 'l6', n: 3, title: 'Heapsort', progress: 0.0, published: true, activities: 6 },
          { id: 'l7', n: 4, title: 'Counting & Radix', progress: 0.0, published: false, activities: 4 },
        ],
      },
      {
        id: 'm3',
        n: 3,
        title: 'Graph Basics',
        description: 'Representation, traversal, shortest paths.',
        progress: 0.1,
        published: true,
        lessons: [
          { id: 'l8', n: 1, title: 'BFS & DFS', progress: 0.2, published: true, activities: 6 },
          {
            id: 'l9',
            n: 2,
            title: "Dijkstra's Algorithm",
            progress: 0.0,
            published: false,
            activities: 5,
          },
        ],
      },
      {
        id: 'm4',
        n: 4,
        title: 'Dynamic Programming',
        description: 'Memoization, tabulation, and problem patterns.',
        progress: 0,
        published: false,
        lessons: [],
      },
    ],
  },
  {
    id: 'c2',
    title: 'Linear Algebra for Engineers',
    code: 'MATH 221',
    description:
      'Vectors, matrices, eigenstructure, and applications across engineering.',
    instructor: 'Prof. L. Okafor',
    term: 'Spring 2026',
    enrolled: 210,
    progress: 0.78,
    color: 'lapis',
    modules: [],
  },
  {
    id: 'c3',
    title: 'Organic Chemistry I',
    code: 'CHEM 233',
    description: 'Bonding, stereochemistry, reactions, and mechanism fundamentals.',
    instructor: 'Prof. R. Tanaka',
    term: 'Spring 2026',
    enrolled: 98,
    progress: 0.21,
    color: 'moss',
    modules: [],
  },
  {
    id: 'c4',
    title: 'Creative Writing Workshop',
    code: 'ENGL 210',
    description: 'Voice, form, and the craft of the short piece.',
    instructor: 'Prof. E. Whitman',
    term: 'Spring 2026',
    enrolled: 34,
    progress: 0.55,
    color: 'sunset',
    modules: [],
  },
];

export type ActivityType = 'mc' | 'sa';
export type Activity = {
  id: string;
  n: number;
  type: ActivityType;
  topic: string;
  secondaryTopics?: string[];
  question: string;
  options?: string[];
  correct?: number;
  hints: string[];
  completed?: boolean;
  answered?: number | string;
  current?: boolean;
};

export const LESSON: {
  id: string;
  title: string;
  module: string;
  course: string;
  activities: Activity[];
  aiModes: { teach: boolean; guide: boolean; custom: boolean };
  customPrompt: { title: string; body: string };
} = {
  id: 'l5',
  title: 'Quicksort',
  module: 'Sorting Algorithms',
  course: 'Introduction to Algorithms',
  activities: [
    {
      id: 'a1',
      n: 1,
      type: 'mc',
      topic: 'Partitioning',
      secondaryTopics: ['Invariants'],
      question:
        'In Lomuto partitioning of an array `A[p..r]` using pivot `A[r]`, what does the loop invariant maintain about the index `i`?',
      options: [
        'A[p..i] are all less than or equal to the pivot',
        'A[p..i] are strictly greater than the pivot',
        'A[i..r-1] are sorted',
        'A[i] is always the pivot element',
      ],
      correct: 0,
      hints: [
        'Think about what region the algorithm is building up on each iteration.',
        '`i` marks the right boundary of the ≤-pivot region as we scan with `j`.',
      ],
      completed: true,
      answered: 0,
    },
    {
      id: 'a2',
      n: 2,
      type: 'mc',
      topic: 'Running Time',
      secondaryTopics: ['Recurrences', 'Analysis'],
      question:
        'What is the worst-case running time of classic Quicksort on an array of size n, and when does it occur?',
      options: [
        'Θ(n log n) — always, regardless of input',
        'Θ(n²) — when partitions are maximally unbalanced',
        'Θ(n) — when the array is already sorted',
        'Θ(n log² n) — in the randomized variant',
      ],
      correct: 1,
      hints: [
        'Consider an input that forces one side of every partition to be empty.',
        'The recurrence becomes T(n) = T(n-1) + Θ(n).',
      ],
      completed: true,
      answered: 1,
    },
    {
      id: 'a3',
      n: 3,
      type: 'sa',
      topic: 'Recurrences',
      secondaryTopics: ['Master Theorem'],
      question:
        'Solve the recurrence T(n) = 2·T(n/2) + Θ(n) using the Master Theorem. State the case and the final asymptotic bound.',
      hints: [
        'Identify a, b, and f(n). Compare f(n) to n^{log_b a}.',
        'This is the canonical balanced divide-and-conquer recurrence.',
      ],
      completed: true,
      answered: 'Case 2 — f(n) = Θ(n) matches n^{log₂2} = n, so T(n) = Θ(n log n).',
    },
    {
      id: 'a4',
      n: 4,
      type: 'mc',
      topic: 'Pivot Selection',
      secondaryTopics: ['Randomization'],
      question:
        'Why does randomized pivot selection give Quicksort an expected Θ(n log n) running time?',
      options: [
        'It eliminates the worst case entirely.',
        'It makes the algorithm O(log n) in the best case.',
        'It makes the expected depth of recursion O(log n) by balancing partitions in expectation.',
        'It changes Quicksort into Mergesort under the hood.',
      ],
      correct: 2,
      hints: [
        'The worst case still *exists* but becomes exponentially unlikely on any given input.',
        'Think about E[partition sizes] when the pivot is uniformly random.',
      ],
      current: true,
    },
    {
      id: 'a5',
      n: 5,
      type: 'sa',
      topic: 'Implementation',
      secondaryTopics: ['Stability', 'Space'],
      question: 'Is Quicksort a stable sort? Briefly justify.',
      hints: [
        'Stability = equal elements preserve their relative order.',
        'Consider what happens during partitioning when two equal keys straddle the pivot.',
      ],
    },
  ],
  aiModes: { teach: true, guide: true, custom: true },
  customPrompt: {
    title: 'Algorithmic reasoning coach',
    body: 'Nudge the student toward invariants and recurrences. Never state the closed-form running time directly.',
  },
};

export const TOPICS = [
  'Partitioning',
  'Running Time',
  'Recurrences',
  'Pivot Selection',
  'Implementation',
  'Invariants',
  'Randomization',
  'Master Theorem',
  'Analysis',
  'Stability',
  'Space',
];

export const INSTRUCTOR_ACTIVITIES = LESSON.activities.map((a) => ({
  ...a,
  aiModes: { teach: true, guide: true, custom: a.n % 2 === 0 },
  customPrompt:
    a.n === 2
      ? {
          title: 'Recurrence guide',
          body: 'Lead with questions about the recursion tree; never state the solution.',
        }
      : null,
}));

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'PROFESSOR' | 'ADMIN' | 'TA';
  status: 'active' | 'pending';
  lastSeen: string;
};

export const USERS: AdminUser[] = [
  { id: 'u1', name: 'Ava Chen', email: 'ava.chen@ubc.ca', role: 'STUDENT', status: 'active', lastSeen: '2m ago' },
  { id: 'u2', name: 'Marcus Ahmadi', email: 'm.ahmadi@ubc.ca', role: 'PROFESSOR', status: 'active', lastSeen: '1h ago' },
  { id: 'u3', name: 'Layla Okafor', email: 'l.okafor@ubc.ca', role: 'PROFESSOR', status: 'active', lastSeen: '3h ago' },
  { id: 'u4', name: 'Ravi Patel', email: 'r.patel@ubc.ca', role: 'STUDENT', status: 'active', lastSeen: '15m ago' },
  { id: 'u5', name: 'Sofia Reyes', email: 's.reyes@ubc.ca', role: 'STUDENT', status: 'active', lastSeen: 'yesterday' },
  { id: 'u6', name: 'Admin Root', email: 'admin@ubc.ca', role: 'ADMIN', status: 'active', lastSeen: 'now' },
  { id: 'u7', name: 'Jin Park', email: 'j.park@ubc.ca', role: 'TA', status: 'pending', lastSeen: 'never' },
  { id: 'u8', name: 'Noa Weiss', email: 'n.weiss@ubc.ca', role: 'STUDENT', status: 'active', lastSeen: '4d ago' },
  { id: 'u9', name: 'Emmett Whitman', email: 'e.whitman@ubc.ca', role: 'PROFESSOR', status: 'active', lastSeen: '2d ago' },
];

export type AiModelRow = {
  id: string;
  vendor: string;
  label: string;
  tier: 'fast' | 'balanced' | 'premium';
  cost: '$' | '$$' | '$$$';
  allowed: boolean;
  default: boolean;
};

export const AI_MODELS: AiModelRow[] = [
  { id: 'gemini-2.5-flash', vendor: 'Google', label: 'Gemini 2.5 Flash', tier: 'fast', cost: '$', allowed: true, default: true },
  { id: 'gemini-2.5-pro', vendor: 'Google', label: 'Gemini 2.5 Pro', tier: 'balanced', cost: '$$', allowed: true, default: false },
  { id: 'gpt-4o', vendor: 'OpenAI', label: 'GPT-4o', tier: 'balanced', cost: '$$', allowed: true, default: false },
  { id: 'gpt-4o-mini', vendor: 'OpenAI', label: 'GPT-4o mini', tier: 'fast', cost: '$', allowed: true, default: false },
  { id: 'claude-haiku-4-5', vendor: 'Anthropic', label: 'Claude Haiku 4.5', tier: 'fast', cost: '$', allowed: true, default: false },
  { id: 'claude-sonnet-4-5', vendor: 'Anthropic', label: 'Claude Sonnet 4.5', tier: 'premium', cost: '$$$', allowed: false, default: false },
];

export type BugRow = {
  id: string;
  title: string;
  status: 'open' | 'investigating' | 'resolved';
  reporter: string;
  where: string;
  submitted: string;
  severity: 'low' | 'medium' | 'high';
};

export const BUG_REPORTS: BugRow[] = [
  { id: 'b1', title: 'Chat scrollbar jumps when streaming long answer', status: 'open', reporter: 'Ava Chen', where: 'Lesson Player · Quicksort', submitted: '2h ago', severity: 'low' },
  { id: 'b2', title: 'Submit button stays disabled after editing short-answer', status: 'investigating', reporter: 'anonymous', where: 'Lesson Player · Mergesort', submitted: 'yesterday', severity: 'medium' },
  { id: 'b3', title: "Publish cascade doesn't update lesson card state", status: 'resolved', reporter: 'Prof. Ahmadi', where: 'Course Builder · CPSC 320', submitted: '3d ago', severity: 'medium' },
  { id: 'b4', title: 'EduAI sync spinner never stops on empty topic list', status: 'open', reporter: 'Prof. Whitman', where: 'Topic Panel · ENGL 210', submitted: '5d ago', severity: 'low' },
];
