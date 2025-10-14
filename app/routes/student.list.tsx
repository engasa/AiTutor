import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import Nav from '../components/Nav';
import { ProgressBar } from '../components/ProgressBar';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/breadcrumb';
import api from '../lib/api';
import type { Activity, Course, Lesson, ModuleDetail } from '../lib/types';
import type { Route } from './+types/student.list';
import { fetchJson, requireUserFromRequest } from '~/lib/server-api';
import { useLocalUser } from '~/hooks/useLocalUser';

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserFromRequest(request, 'STUDENT');
  const lessonId = Number(params.lessonId);
  if (!Number.isFinite(lessonId)) {
    throw new Response('Invalid lesson id', { status: 400 });
  }

  const [lesson, activities] = await Promise.all([
    fetchJson<Lesson>(request, `/api/lessons/${lessonId}`),
    fetchJson<Activity[]>(request, `/api/lessons/${lessonId}/activities`),
  ]);

  let module: ModuleDetail | null = null;
  let course: Course | null = null;
  if (lesson.moduleId) {
    module = await fetchJson<ModuleDetail>(request, `/api/modules/${lesson.moduleId}`);
    if (module?.courseOfferingId) {
      course = await fetchJson<Course>(request, `/api/courses/${module.courseOfferingId}`);
    }
  }

  return { course, module, lesson, activities };
}

export default function StudentLessonPlayer({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const { user } = useLocalUser();
  const { course, module, lesson, activities } = loaderData;
  const [orderedActivities, setOrderedActivities] = useState<Activity[]>(activities ?? []);
  const [idx, setIdx] = useState(0);
  const [mcq, setMcq] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [assistant, setAssistant] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingGuidance, setLoadingGuidance] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [wasCorrect, setWasCorrect] = useState(false);

  // Pre-chat context for AI guidance
  const [showPreChatModal, setShowPreChatModal] = useState(false);
  const [chatContext, setChatContext] = useState<{
    knowledgeLevel: string;
    codeSnippet: string;
  } | null>(null);
  const [tempKnowledgeLevel, setTempKnowledgeLevel] = useState('');
  const [tempCodeSnippet, setTempCodeSnippet] = useState('');

  // Adjust state during render when loader data changes
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

  const submit = async () => {
    if (!activity || !user) return;
    setSubmitting(true);
    try {
      const payload: any = { userId: user.id };
      if (activity.type === 'MCQ') payload.answerOption = mcq;
      else payload.answerText = text;
      const res = await api.submitAnswer(activity.id, payload);
      setResult(res.isCorrect ? 'Correct! 🎉' : 'Not quite. Keep going!');

      // Update the activity's completion status based on latest answer
      setOrderedActivities((prev) =>
        prev.map((a, i) =>
          i === idx ? { ...a, completionStatus: res.isCorrect ? ('correct' as const) : undefined } : a
        )
      );

      if (res.isCorrect) {
        setWasCorrect(true);
        setAssistant([res.message || 'Great job! Proceed when you are ready for the next question.']);
      } else {
        setWasCorrect(false);
      }
    } catch (e) {
      setResult('There was a problem submitting.');
      setWasCorrect(false);
    } finally {
      setSubmitting(false);
    }
  };

  const nudge = async () => {
    if (!activity || wasCorrect || loadingGuidance) return;

    // Check if we need to collect chat context first
    if (!chatContext) {
      setShowPreChatModal(true);
      return;
    }

    setLoadingGuidance(true);
    try {
      // Determine student's current answer (convert null to undefined for API)
      const studentAnswer = activity.type === 'MCQ' ? mcq : text;

      // Call AI guidance API with knowledge level and code snippet
      const response = await api.getActivityGuidance(activity.id, {
        studentAnswer: studentAnswer ?? undefined,
        knowledgeLevel: chatContext.knowledgeLevel,
        codeSnippet: chatContext.codeSnippet || undefined,
      });

      // Append AI response to assistant conversation
      setAssistant((prev) => [...prev, response.message]);
    } catch (error) {
      console.error('AI guidance failed:', error);
      setAssistant((prev) => [
        ...prev,
        'AI study buddy not available right now. Please try again later.',
      ]);
    } finally {
      setLoadingGuidance(false);
    }
  };

  const handleStartGuidance = () => {
    if (!tempKnowledgeLevel) {
      return; // Validation - knowledge level is required
    }

    // Check if code snippet is required for Exercise Prompt
    const needsCodeSnippet = activity?.promptTemplate?.name === 'Exercise Prompt';
    if (needsCodeSnippet && !tempCodeSnippet.trim()) {
      return; // Validation - code snippet required for Exercise Prompt
    }

    // Save context and close modal
    setChatContext({
      knowledgeLevel: tempKnowledgeLevel,
      codeSnippet: tempCodeSnippet,
    });
    setShowPreChatModal(false);

    // Automatically trigger guidance after context is saved
    setTimeout(() => {
      nudge();
    }, 0);
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <Nav />
      <div className="container mx-auto px-4 py-6">
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/student">My Courses</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              {course && module ? (
                <BreadcrumbLink asChild>
                  <Link to={`/student/courses/${module.courseOfferingId}`}>{course.title}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>Course</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              {module && lesson ? (
                <BreadcrumbLink asChild>
                  <Link to={`/student/module/${lesson.moduleId}`}>{module.title}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>Module</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>{lesson?.title || 'Lesson'}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Lesson Progress */}
        {orderedActivities.length > 0 && (
          <div className="mb-6">
            <ProgressBar
              completed={orderedActivities.filter((a) => a.completionStatus === 'correct').length}
              total={orderedActivities.length}
              size="md"
            />
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 space-y-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Question
                </div>
                <div className="mt-2 space-y-2">
                  {questionChunks.map((line, index) => (
                    <p key={index} className="text-gray-700 dark:text-gray-200">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
              {activity?.mainTopic && (
                <div className="text-xs text-indigo-600 dark:text-indigo-300">
                  <span className="font-semibold">Main topic:</span> {activity.mainTopic.name}
                  {activity.secondaryTopics.length > 0 && (
                    <>
                      <span className="mx-2 text-indigo-400">•</span>
                      <span>
                        Secondary: {activity.secondaryTopics.map((topic) => topic.name).join(', ')}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 space-y-3">
              {activity?.type === 'MCQ' ? (
                <div className="grid grid-cols-1 gap-2">
                  {activity.options?.choices?.map((choice, i) => (
                    <label
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                        mcq === i
                          ? 'border-transparent ring-2 ring-offset-2 ring-amber-500 dark:ring-offset-gray-950 bg-amber-50 dark:bg-amber-950/40'
                          : 'border-gray-200 dark:border-gray-800 hover:border-amber-300'
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name="mcq"
                        checked={mcq === i}
                        onChange={() => setMcq(i)}
                      />
                      <span className="font-medium">{String.fromCharCode(65 + i)}.</span> {choice}
                    </label>
                  ))}
                </div>
              ) : (
                <div>
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type your short answer…"
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={submit}
                  disabled={
                    submitting ||
                    (activity?.type === 'MCQ' ? mcq === null : text.trim() === '')
                  }
                  className="px-4 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-600 to-orange-600 disabled:opacity-50 shadow"
                >
                  {submitting ? 'Submitting…' : 'Submit'}
                </button>
                <button
                  onClick={nudge}
                  disabled={wasCorrect || loadingGuidance}
                  className="px-4 py-2 rounded-xl font-semibold bg-gray-100 dark:bg-gray-800 disabled:opacity-50"
                >
                  {loadingGuidance ? 'Thinking...' : 'Guide me'}
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    disabled={!canPrev}
                    onClick={() => {
                      setIdx((i) => Math.max(0, i - 1));
                      // Reset form state when navigating
                      setMcq(null);
                      setText('');
                      setAssistant([]);
                      setResult(null);
                      setWasCorrect(false);
                      setLoadingGuidance(false);
                      setChatContext(null); // Reset chat context for new activity
                      setTempKnowledgeLevel('');
                      setTempCodeSnippet('');
                    }}
                    className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    disabled={!canNext}
                    onClick={() => {
                      setIdx((i) => Math.min(orderedActivities.length - 1, i + 1));
                      // Reset form state when navigating
                      setMcq(null);
                      setText('');
                      setAssistant([]);
                      setResult(null);
                      setWasCorrect(false);
                      setLoadingGuidance(false);
                      setChatContext(null); // Reset chat context for new activity
                      setTempKnowledgeLevel('');
                      setTempCodeSnippet('');
                    }}
                    className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>

              {result && <div className="text-sm text-gray-700 dark:text-gray-300">{result}</div>}
            </div>
          </div>

          <aside className="lg:col-span-1">
            <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 via-pink-500 to-rose-500" />
                <div>
                  <div className="font-bold">AI Study Buddy</div>
                  <div className="text-xs text-gray-500">Hints, not answers</div>
                </div>
              </div>
              {assistant.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Ask for guidance to get a gentle nudge. Try thinking aloud: What is being asked? What is given? What do you need to find?
                </p>
              ) : (
                <ul className="space-y-2">
                  {assistant.map((hint, i) => (
                    <li key={i} className="text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                      {hint}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>

        {/* Pre-Chat Modal */}
        {showPreChatModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-w-lg w-full bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Before we start...
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Help me personalize your learning experience!
                </p>
              </div>

              {/* Knowledge Level (Always Required) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  What's your knowledge level on this topic? *
                </label>
                <select
                  value={tempKnowledgeLevel}
                  onChange={(e) => setTempKnowledgeLevel(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select your level</option>
                  <option value="beginner">Beginner - I'm new to this</option>
                  <option value="intermediate">Intermediate - I have some experience</option>
                  <option value="advanced">Advanced - I'm quite experienced</option>
                </select>
              </div>

              {/* Code Snippet (Only for Exercise Prompt) */}
              {activity?.promptTemplate?.name === 'Exercise Prompt' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Paste your code snippet here *
                  </label>
                  <textarea
                    value={tempCodeSnippet}
                    onChange={(e) => setTempCodeSnippet(e.target.value)}
                    placeholder="Paste the code you'd like help with..."
                    rows={8}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowPreChatModal(false)}
                  className="flex-1 px-4 py-2 rounded-xl font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartGuidance}
                  disabled={
                    !tempKnowledgeLevel ||
                    (activity?.promptTemplate?.name === 'Exercise Prompt' && !tempCodeSnippet.trim())
                  }
                  className="flex-1 px-4 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed shadow"
                >
                  Start Guidance
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
