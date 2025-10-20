import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
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
  const { user } = useLocalUser();
  const { course, module, lesson, activities } = loaderData;
  const [orderedActivities, setOrderedActivities] = useState<Activity[]>(activities ?? []);
  const [idx, setIdx] = useState(0);
  const [mcq, setMcq] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [wasCorrect, setWasCorrect] = useState(false);

  // Pre-chat context for AI guidance
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [tempKnowledgeLevel, setTempKnowledgeLevel] = useState('');
  const [knowledgeLevels, setKnowledgeLevels] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<ChatTab>('teach');
  const [topicSelection, setTopicSelection] = useState<Record<number, number>>({});
  const [chatState, setChatState] = useState<ChatState>({
    teach: { messages: [], input: '', loading: false },
    guide: { messages: [], input: '', loading: false },
  });

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

  const currentKnowledgeLevel = activity ? knowledgeLevels[activity.id] ?? null : null;
  const currentTopicId = activity
    ? topicSelection[activity.id] ?? activity.mainTopic?.id ?? null
    : null;

  useEffect(() => {
    if (!activity) {
      return;
    }

    setChatState({
      teach: { messages: [], input: '', loading: false },
      guide: { messages: [], input: '', loading: false },
    });
    setActiveTab('teach');
    setWasCorrect(false);
    setResult(null);
    setTempKnowledgeLevel('');
    setShowKnowledgeModal(false);

    setMcq(null);
    setText('');

    if (activity.mainTopic?.id && !(activity.id in topicSelection)) {
      setTopicSelection((prev) => ({ ...prev, [activity.id]: activity.mainTopic!.id }));
    }
  }, [activity?.id]);

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
        setChatState((prev) => ({
          ...prev,
          guide: {
            ...prev.guide,
            messages: [
              {
                id: generateMessageId(),
                role: 'assistant',
                content: res.message || 'Great job! Proceed when you are ready for the next question.',
              },
            ],
          },
        }));
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

  const resetForNavigation = useCallback(() => {
    setMcq(null);
    setText('');
    setChatState({
      teach: { messages: [], input: '', loading: false },
      guide: { messages: [], input: '', loading: false },
    });
    setResult(null);
    setWasCorrect(false);
    setTempKnowledgeLevel('');
  }, []);

  const ensureKnowledgeLevel = useCallback(() => {
    if (!activity?.id) return false;
    if (knowledgeLevels[activity.id]) {
      return true;
    }
    setTempKnowledgeLevel('');
    setShowKnowledgeModal(true);
    return false;
  }, [activity?.id, knowledgeLevels]);

  const appendMessage = useCallback(
    (tab: ChatTab, role: ChatMessage['role'], content: string) => {
      setChatState((prev) => ({
        ...prev,
        [tab]: {
          ...prev[tab],
          messages: [...prev[tab].messages, { id: generateMessageId(), role, content }],
        },
      }));
    },
    [],
  );

  const sendChat = useCallback(
    async (tab: ChatTab, overrideMessage?: string) => {
      if (!activity || !user) return;

      const message = (overrideMessage ?? chatState[tab].input).trim();
      if (!message) return;

      if (!ensureKnowledgeLevel()) {
        return;
      }

      const knowledgeLevel = knowledgeLevels[activity.id]!;
      const studentAnswer = activity.type === 'MCQ' ? mcq : text;

      setChatState((prev) => ({
        ...prev,
        [tab]: {
          ...prev[tab],
          input: overrideMessage ? prev[tab].input : '',
          loading: true,
        },
      }));

      appendMessage(tab, 'user', message);

      try {
        let response;
        if (tab === 'teach') {
          response = await api.sendTeachMessage(activity.id, {
            knowledgeLevel,
            topicId: currentTopicId ?? undefined,
            message,
          });
        } else {
          response = await api.sendGuideMessage(activity.id, {
            knowledgeLevel,
            message,
            studentAnswer: studentAnswer ?? undefined,
          });
        }
        appendMessage(tab, 'assistant', response.message);
      } catch (error) {
        console.error('AI chat failed:', error);
        appendMessage(tab, 'assistant', 'AI study buddy not available right now. Please try again later.');
      } finally {
        setChatState((prev) => ({
          ...prev,
          [tab]: { ...prev[tab], loading: false },
        }));
      }
    },
    [activity, user, chatState, ensureKnowledgeLevel, knowledgeLevels, appendMessage, mcq, text, currentTopicId],
  );

  const handleGuideMe = useCallback(() => {
    if (!activity || wasCorrect) return;
    const defaultMessage = chatState.guide.input.trim() || 'I would like guidance on this question.';
    setActiveTab('guide');
    void sendChat('guide', defaultMessage);
  }, [activity, wasCorrect, chatState.guide.input, sendChat]);

  const handleConfirmKnowledge = () => {
    if (!activity || !tempKnowledgeLevel) {
      return;
    }
    setKnowledgeLevels((prev) => ({ ...prev, [activity.id]: tempKnowledgeLevel }));
    setShowKnowledgeModal(false);
  };

  const handleCancelKnowledge = () => {
    setShowKnowledgeModal(false);
  };

  const renderMessages = (tab: ChatTab) => (
    <div className="space-y-2">
      {chatState[tab].messages.map((msg) => (
        <div
          key={msg.id}
          className={`w-fit max-w-full rounded-2xl px-4 py-2 text-sm ${
            msg.role === 'user'
              ? 'ml-auto bg-amber-500 text-white shadow'
              : 'bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800'
          }`}
        >
          {msg.content}
        </div>
      ))}
    </div>
  );

  const topicOptions = activity
    ? [
        ...(activity.mainTopic ? [{ label: activity.mainTopic.name, value: activity.mainTopic.id }] : []),
        ...activity.secondaryTopics.map((topic) => ({ label: topic.name, value: topic.id })),
      ]
    : [];

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

        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-4">
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
                Array.isArray(activity?.options?.choices) ? (
                  <div className="grid grid-cols-1 gap-2">
                  {activity.options.choices.map((choice, i) => (
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
                  <div className="text-sm text-rose-600">This question's options are misconfigured.</div>
                )
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
                  onClick={handleGuideMe}
                  disabled={wasCorrect || !currentKnowledgeLevel}
                  className="px-4 py-2 rounded-xl font-semibold bg-gray-100 dark:bg-gray-800 disabled:opacity-50"
                >
                  Guide me
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    disabled={!canPrev}
                    onClick={() => {
                      setIdx((i) => Math.max(0, i - 1));
                      resetForNavigation();
                    }}
                    className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    disabled={!canNext}
                    onClick={() => {
                      setIdx((i) => Math.min(orderedActivities.length - 1, i + 1));
                      resetForNavigation();
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

          <aside className="flex flex-col rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
            <div className="flex items-center gap-3 p-5 border-b border-gray-200 dark:border-gray-800">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 via-pink-500 to-rose-500" />
              <div>
                <div className="font-bold">AI Study Buddy</div>
                <div className="text-xs text-gray-500">Hints, not answers</div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-5 pt-4">
              <div className="flex rounded-full bg-gray-100 dark:bg-gray-900 p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                      activeTab === tab.value
                        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow'
                        : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">
                {currentKnowledgeLevel ? `Level: ${titleCase(currentKnowledgeLevel)}` : 'Set your level'}
              </div>
            </div>

            {activeTab === 'teach' && (
              <div className="px-5 pt-3">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  Focus topic
                </label>
                <select
                  value={currentTopicId ?? ''}
                  onChange={(e) => {
                    if (!activity) return;
                    const value = Number(e.target.value);
                    if (Number.isFinite(value)) {
                      setTopicSelection((prev) => ({ ...prev, [activity.id]: value }));
                    }
                  }}
                  disabled={topicOptions.length <= 1}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm disabled:opacity-50"
                >
                  {topicOptions.map((topic) => (
                    <option key={topic.value} value={topic.value}>
                      {topic.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex-1 overflow-hidden px-5 py-4">
              <div className="h-full overflow-y-auto pr-2">
                {renderMessages(activeTab)}
                {chatState[activeTab].loading && (
                  <div className="mt-2 text-xs text-gray-400">Thinking…</div>
                )}
                {!activity && (
                  <div className="text-sm text-gray-500">Select an activity to begin.</div>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 p-5 space-y-2">
              <textarea
                value={chatState[activeTab].input}
                onChange={(e) =>
                  setChatState((prev) => ({
                    ...prev,
                    [activeTab]: { ...prev[activeTab], input: e.target.value },
                  }))
                }
                placeholder={
                  activeTab === 'teach'
                    ? 'Ask about the topic…'
                    : 'Describe where you need guidance…'
                }
                rows={3}
                disabled={!currentKnowledgeLevel}
                className="w-full resize-none rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
              />
              {!currentKnowledgeLevel && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Set your knowledge level to start chatting with your study buddy.
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void sendChat(activeTab)}
                  disabled={
                    chatState[activeTab].loading ||
                    !currentKnowledgeLevel ||
                    !chatState[activeTab].input.trim()
                  }
                  className="px-4 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-600 to-orange-600 disabled:opacity-50 shadow"
                >
                  Send
                </button>
                <button
                  onClick={() => {
                    if (!activity) return;
                    setTempKnowledgeLevel(currentKnowledgeLevel ?? '');
                    setShowKnowledgeModal(true);
                  }}
                  className="ml-auto text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {currentKnowledgeLevel ? 'Adjust level' : 'Set level'}
                </button>
              </div>
            </div>
          </aside>
        </div>

        {/* Pre-Chat Modal */}
        {showKnowledgeModal && (
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

              {/* Knowledge Level */}
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

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCancelKnowledge}
                  className="flex-1 px-4 py-2 rounded-xl font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmKnowledge}
                  disabled={!tempKnowledgeLevel}
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

type ChatTab = 'teach' | 'guide';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type ChatState = Record<ChatTab, { messages: ChatMessage[]; input: string; loading: boolean }>;

const tabs: { value: ChatTab; label: string }[] = [
  { value: 'teach', label: 'Teach me' },
  { value: 'guide', label: 'Guide me' },
];

function generateMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
