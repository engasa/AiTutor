import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  AppBackdrop,
  AppContainer,
  DashboardCard,
  DashboardHero,
  SectionEyebrow,
  StatPill,
} from '~/components/AppShell';
import Nav from '../components/Nav';
import { ProgressBar } from '../components/ProgressBar';
import StudentActivityFeedbackCard from '../components/StudentActivityFeedbackCard';
import StudentAiChat, { type StudentAiChatHandle } from '../components/StudentAiChat';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/breadcrumb';
import api from '../lib/api';
import type { Activity, Course, Lesson, ModuleDetail } from '../lib/types';
import type { Route } from './+types/student.list';
import { requireClientUser } from '~/lib/client-auth';
import { useLocalUser } from '~/hooks/useLocalUser';
import { useBugReport } from '~/components/bug-report/useBugReport';

type StudentFeedbackState = {
  rating: number | null;
  note: string;
  promptShown: boolean;
  promptVisible: boolean;
  submitted: boolean;
  dismissed: boolean;
  saving: boolean;
  error: string | null;
};

type FeedbackApi = typeof api & {
  submitActivityFeedback?: (
    activityId: number,
    payload: { rating: number; note?: string },
  ) => Promise<{ ok?: boolean }>;
};

function createFeedbackState(): StudentFeedbackState {
  return {
    rating: null,
    note: '',
    promptShown: false,
    promptVisible: false,
    submitted: false,
    dismissed: false,
    saving: false,
    error: null,
  };
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  await requireClientUser('STUDENT');
  const lessonId = Number(params.lessonId);
  if (!Number.isFinite(lessonId)) {
    throw new Response('Invalid lesson id', { status: 400 });
  }

  const [lesson, activities] = await Promise.all([
    api.lessonById(lessonId) as Promise<Lesson>,
    api.activitiesForLesson(lessonId) as Promise<Activity[]>,
  ]);

  let module: ModuleDetail | null = null;
  let course: Course | null = null;
  if (lesson.moduleId) {
    module = (await api.moduleById(lesson.moduleId)) as ModuleDetail;
    if (module?.courseOfferingId) {
      course = (await api.courseById(module.courseOfferingId)) as Course;
    }
  }

  return { course, module, lesson, activities };
}

export default function StudentLessonPlayer({ loaderData }: Route.ComponentProps) {
  const { user } = useLocalUser();
  const { setContext: setBugReportContext, clearContext: clearBugReportContext } = useBugReport();
  const { course, module, lesson, activities } = loaderData;
  const [orderedActivities, setOrderedActivities] = useState<Activity[]>(activities ?? []);
  const [idx, setIdx] = useState(0);
  const [mcq, setMcq] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [prevActivityId, setPrevActivityId] = useState<number | null>(null);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [tempKnowledgeLevel, setTempKnowledgeLevel] = useState('');
  const [knowledgeLevels, setKnowledgeLevels] = useState<Record<number, string>>({});
  const [topicSelection, setTopicSelection] = useState<Record<number, number>>({});
  const [feedbackByActivity, setFeedbackByActivity] = useState<
    Record<number, StudentFeedbackState>
  >({});
  const chatRef = useRef<StudentAiChatHandle>(null);

  const [prevActivities, setPrevActivities] = useState(activities);
  if (activities !== prevActivities) {
    setPrevActivities(activities);
    setOrderedActivities(activities ?? []);
  }

  const activity = orderedActivities[idx];
  const canNext = idx < orderedActivities.length - 1;
  const canPrev = idx > 0;
  const questionChunks = useMemo(
    () => (activity?.question || '').split(/\n/),
    [activity?.question],
  );
  const currentKnowledgeLevel = activity ? (knowledgeLevels[activity.id] ?? null) : null;
  const currentTopicId = activity
    ? (topicSelection[activity.id] ?? activity.mainTopic?.id ?? null)
    : null;
  const currentFeedback = activity
    ? (feedbackByActivity[activity.id] ?? createFeedbackState())
    : createFeedbackState();
  const studentAnswer = activity ? (activity.type === 'MCQ' ? mcq : text) : null;
  const isUserReady = Boolean(user);

  const currentActivityId = activity?.id ?? null;
  if (currentActivityId !== prevActivityId) {
    setPrevActivityId(currentActivityId);
    setWasCorrect(false);
    setResult(null);
    setTempKnowledgeLevel('');
    setShowKnowledgeModal(false);
    setMcq(null);
    setText('');
  }

  const submit = async () => {
    if (!activity || !user) return;
    setSubmitting(true);
    try {
      const payload: any = { userId: user.id };
      if (activity.type === 'MCQ') payload.answerOption = mcq;
      else payload.answerText = text;
      const res = await api.submitAnswer(activity.id, payload);
      setResult(
        res.isCorrect
          ? 'Correct. Keep the momentum.'
          : 'Not quite yet. Use the guidance rail and try again.',
      );

      setOrderedActivities((prev) =>
        prev.map((a, i) =>
          i === idx
            ? { ...a, completionStatus: res.isCorrect ? ('correct' as const) : undefined }
            : a,
        ),
      );

      if (res.isCorrect) {
        setWasCorrect(true);
        chatRef.current?.pushGuideMessage(
          res.message || 'Great job. You can move ahead, or use the chat to deepen the concept.',
        );
      } else {
        setWasCorrect(false);
      }

      setFeedbackByActivity((prev) => {
        const current = prev[activity.id] ?? createFeedbackState();
        if (
          current.promptShown ||
          current.submitted ||
          current.dismissed ||
          res.feedbackRequired === false ||
          res.feedbackAlreadySubmitted
        ) {
          return prev;
        }
        return {
          ...prev,
          [activity.id]: { ...current, promptShown: true, promptVisible: true, error: null },
        };
      });
    } catch {
      setResult('There was a problem submitting.');
      setWasCorrect(false);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForNavigation = useCallback(() => {
    setMcq(null);
    setText('');
    setResult(null);
    setWasCorrect(false);
    setTempKnowledgeLevel('');
  }, []);

  const handleRequestKnowledgeLevel = useCallback(() => {
    setTempKnowledgeLevel('');
    setShowKnowledgeModal(true);
  }, []);

  const handleAdjustKnowledgeLevel = useCallback(() => {
    setTempKnowledgeLevel(currentKnowledgeLevel ?? '');
    setShowKnowledgeModal(true);
  }, [currentKnowledgeLevel]);

  const handleTopicSelect = useCallback(
    (topicId: number) => {
      if (!activity) return;
      setTopicSelection((prev) => ({ ...prev, [activity.id]: topicId }));
    },
    [activity],
  );

  const handleGuideMe = useCallback(() => {
    if (!activity || wasCorrect) return;
    chatRef.current?.sendGuidePrompt();
  }, [activity, wasCorrect]);

  const updateFeedbackState = useCallback(
    (updater: (current: StudentFeedbackState) => StudentFeedbackState) => {
      if (!activity) return;
      setFeedbackByActivity((prev) => ({
        ...prev,
        [activity.id]: updater(prev[activity.id] ?? createFeedbackState()),
      }));
    },
    [activity],
  );

  const handleFeedbackRating = useCallback(
    (rating: number) => {
      updateFeedbackState((current) => ({ ...current, rating, error: null }));
    },
    [updateFeedbackState],
  );

  const handleFeedbackNote = useCallback(
    (note: string) => {
      updateFeedbackState((current) => ({ ...current, note }));
    },
    [updateFeedbackState],
  );

  const handleDismissFeedback = useCallback(() => {
    updateFeedbackState((current) => ({
      ...current,
      promptVisible: false,
      dismissed: true,
      error: null,
    }));
  }, [updateFeedbackState]);

  const handleSubmitFeedback = useCallback(async () => {
    if (!activity || !currentFeedback.rating) return;
    updateFeedbackState((current) => ({ ...current, saving: true, error: null }));
    try {
      const feedbackApi = api as FeedbackApi;
      if (typeof feedbackApi.submitActivityFeedback !== 'function') {
        throw new Error('Feedback service not available');
      }
      await feedbackApi.submitActivityFeedback(activity.id, {
        rating: currentFeedback.rating,
        note: currentFeedback.note.trim() || undefined,
      });
      updateFeedbackState((current) => ({
        ...current,
        saving: false,
        submitted: true,
        promptVisible: false,
        dismissed: false,
        error: null,
      }));
    } catch {
      updateFeedbackState((current) => ({
        ...current,
        saving: false,
        error: 'Could not save feedback right now. Please try again.',
      }));
    }
  }, [activity, currentFeedback.note, currentFeedback.rating, updateFeedbackState]);

  const handleConfirmKnowledge = () => {
    if (!activity || !tempKnowledgeLevel) return;
    setKnowledgeLevels((prev) => ({ ...prev, [activity.id]: tempKnowledgeLevel }));
    setShowKnowledgeModal(false);
  };

  const handleCancelKnowledge = () => {
    setShowKnowledgeModal(false);
  };

  useEffect(() => {
    setBugReportContext({
      courseOfferingId: course?.id ?? module?.courseOfferingId ?? null,
      moduleId: module?.id ?? null,
      lessonId: lesson?.id ?? null,
      activityId: activity?.id ?? null,
    });
  }, [
    activity?.id,
    course?.id,
    lesson?.id,
    module?.courseOfferingId,
    module?.id,
    setBugReportContext,
  ]);

  useEffect(() => {
    return () => {
      clearBugReportContext();
    };
  }, [clearBugReportContext]);

  const topicOptions = activity
    ? [
        ...(activity.mainTopic
          ? [{ label: activity.mainTopic.name, value: activity.mainTopic.id }]
          : []),
        ...activity.secondaryTopics.map((topic) => ({ label: topic.name, value: topic.id })),
      ]
    : [];

  const completedCount = orderedActivities.filter((a) => a.completionStatus === 'correct').length;

  return (
    <main className="app-shell">
      <AppBackdrop pattern="grid" />
      <Nav />

      <AppContainer className="space-y-8 pb-12 pt-8">
        <Breadcrumb className="px-1 text-white/54" data-tour="student-lesson-breadcrumb">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/student" className="hover:text-white">
                  My Courses
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-white/24">/</BreadcrumbSeparator>
            <BreadcrumbItem>
              {course && module ? (
                <BreadcrumbLink asChild>
                  <Link
                    to={`/student/courses/${module.courseOfferingId}`}
                    className="hover:text-white"
                  >
                    {course.title}
                  </Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="text-white">Course</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-white/24">/</BreadcrumbSeparator>
            <BreadcrumbItem>
              {module && lesson ? (
                <BreadcrumbLink asChild>
                  <Link to={`/student/module/${lesson.moduleId}`} className="hover:text-white">
                    {module.title}
                  </Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="text-white">Module</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-white/24">/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage className="text-white">{lesson?.title || 'Lesson'}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <DashboardHero
          eyebrow={<SectionEyebrow tone="cool">Lesson player</SectionEyebrow>}
          title={lesson?.title || 'Lesson'}
          description="A focused activity rail on the left. AI guidance on the right. Progress, answer state, and feedback now live in one intentional flow."
          aside={
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <StatPill label="Question" value={`${idx + 1}/${orderedActivities.length || 1}`} />
              <StatPill label="Completed" value={completedCount} />
              <StatPill label="Mode" value={activity?.type || 'Lesson'} />
            </div>
          }
        />

        {orderedActivities.length > 0 ? (
          <DashboardCard className="p-5" data-tour="student-lesson-progress">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-white/40">
                  Lesson progress
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  Question {idx + 1} of {orderedActivities.length}
                </div>
              </div>
              <div className="tag tag-primary">{completedCount} solved</div>
            </div>
            <ProgressBar
              completed={completedCount}
              total={orderedActivities.length}
              size="lg"
              showLabel={false}
              className="mt-4"
            />
          </DashboardCard>
        ) : null}

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(25rem,0.85fr)]">
          <div className="space-y-6">
            <DashboardCard className="p-6" data-tour="student-question-card">
              <div className="flex flex-wrap items-center gap-2">
                <div className="tag tag-primary">Question</div>
                {activity?.mainTopic ? (
                  <div className="tag tag-accent">{activity.mainTopic.name}</div>
                ) : null}
              </div>
              <div className="mt-6 space-y-4">
                {questionChunks.map((line, index) => (
                  <p key={index} className="text-lg leading-8 text-white">
                    {line}
                  </p>
                ))}
              </div>
              {activity?.secondaryTopics.length ? (
                <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5">
                  {activity.secondaryTopics.map((topic) => (
                    <span
                      key={topic.id}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60"
                    >
                      {topic.name}
                    </span>
                  ))}
                </div>
              ) : null}
            </DashboardCard>

            <DashboardCard className="p-6" data-tour="student-answer-card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-white/40">
                    Response
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                    Work the problem
                  </h2>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/42">
                  {activity?.type === 'MCQ' ? 'Select one' : 'Write it out'}
                </div>
              </div>

              {activity?.type === 'MCQ' ? (
                Array.isArray(activity?.options?.choices) ? (
                  <div className="mt-6 space-y-3">
                    {activity.options.choices.map((choice, i) => (
                      <label
                        key={i}
                        className={`flex cursor-pointer items-start gap-4 rounded-[1.2rem] border px-4 py-4 transition ${
                          mcq === i
                            ? 'border-amber-300/20 bg-amber-300/10'
                            : 'border-white/10 bg-white/4 hover:bg-white/8'
                        }`}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          name="mcq"
                          checked={mcq === i}
                          onChange={() => setMcq(i)}
                        />
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-[0.9rem] text-sm font-semibold ${mcq === i ? 'bg-amber-300 text-slate-950' : 'bg-white/10 text-white/64'}`}
                        >
                          {String.fromCharCode(65 + i)}
                        </div>
                        <span className="pt-1 text-white/90">{choice}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 rounded-[1rem] border border-rose-300/18 bg-rose-300/10 p-4 text-sm text-rose-100">
                    This question's options are misconfigured.
                  </div>
                )
              ) : (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type your answer..."
                  className="input-field mt-6 min-h-32 text-base"
                />
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={submit}
                  disabled={
                    submitting || (activity?.type === 'MCQ' ? mcq === null : text.trim() === '')
                  }
                  className="btn-primary"
                >
                  {submitting ? 'Submitting...' : 'Submit answer'}
                </button>

                <button
                  type="button"
                  onClick={handleGuideMe}
                  disabled={wasCorrect || !currentKnowledgeLevel || !isUserReady}
                  className="btn-secondary"
                  data-tour="student-guide-button"
                >
                  <Sparkles className="h-4 w-4" />
                  Guide me
                </button>

                <div className="flex-1" />

                <button
                  type="button"
                  disabled={!canPrev}
                  onClick={() => {
                    setIdx((i) => Math.max(0, i - 1));
                    resetForNavigation();
                  }}
                  className="btn-secondary"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={!canNext}
                  onClick={() => {
                    setIdx((i) => Math.min(orderedActivities.length - 1, i + 1));
                    resetForNavigation();
                  }}
                  className="btn-secondary"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              {result ? (
                <div
                  className={`mt-6 rounded-[1.2rem] border px-4 py-4 ${wasCorrect ? 'border-emerald-300/18 bg-emerald-300/10 text-emerald-100' : 'border-white/10 bg-white/6 text-white/82'}`}
                >
                  <div className="flex items-center gap-3">
                    {wasCorrect ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <BrainCircuit className="h-5 w-5" />
                    )}
                    <span className="font-medium">{result}</span>
                  </div>
                </div>
              ) : null}

              {activity &&
              currentFeedback.promptShown &&
              !currentFeedback.dismissed &&
              (currentFeedback.promptVisible || currentFeedback.submitted) ? (
                <div className="mt-6">
                  <StudentActivityFeedbackCard
                    rating={currentFeedback.rating}
                    note={currentFeedback.note}
                    saving={currentFeedback.saving}
                    submitted={currentFeedback.submitted}
                    error={currentFeedback.error}
                    onSelectRating={handleFeedbackRating}
                    onNoteChange={handleFeedbackNote}
                    onSubmit={handleSubmitFeedback}
                    onDismiss={handleDismissFeedback}
                  />
                </div>
              ) : null}
            </DashboardCard>
          </div>

          <div>
            <StudentAiChat
              key={activity?.id ?? 'none'}
              ref={chatRef}
              activity={activity}
              isUserReady={isUserReady}
              knowledgeLevel={currentKnowledgeLevel}
              onRequestKnowledgeLevel={handleRequestKnowledgeLevel}
              onAdjustKnowledgeLevel={handleAdjustKnowledgeLevel}
              topicOptions={topicOptions}
              currentTopicId={currentTopicId}
              onSelectTopic={handleTopicSelect}
              studentAnswer={studentAnswer}
            />
          </div>
        </div>

        {showKnowledgeModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md">
            <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-[#0e1528]/95 p-8 shadow-[0_30px_90px_rgba(3,7,18,0.45)]">
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-white/40">
                Personalize guidance
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
                Set your comfort level before the AI steps in.
              </h2>
              <p className="mt-3 text-white/60">
                This helps the study buddy decide whether to explain fundamentals, coach your next
                move, or push you harder.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { value: 'beginner', label: 'Beginner', desc: "I'm new to this" },
                  { value: 'intermediate', label: 'Intermediate', desc: 'I know some of it' },
                  { value: 'advanced', label: 'Advanced', desc: 'Push me with tighter hints' },
                ].map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setTempKnowledgeLevel(level.value)}
                    className={`rounded-[1.4rem] border p-4 text-left ${
                      tempKnowledgeLevel === level.value
                        ? 'border-amber-300/20 bg-amber-300/10'
                        : 'border-white/10 bg-white/4'
                    }`}
                  >
                    <div className="text-lg font-semibold text-white">{level.label}</div>
                    <div className="mt-2 text-sm text-white/54">{level.desc}</div>
                  </button>
                ))}
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={handleCancelKnowledge}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmKnowledge}
                  disabled={!tempKnowledgeLevel}
                  className="btn-primary flex-1"
                >
                  Start guidance
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </AppContainer>
    </main>
  );
}
