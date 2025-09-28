import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import Nav from '../components/Nav';
import ProtectedRoute from '../components/ProtectedRoute';
import api from '../lib/api';
import type { Activity, Lesson, PromptTemplate, Topic } from '../lib/types';
import { requireUser } from '../hooks/useLocalUser';

export default function InstructorLessonBuilder() {
  const navigate = useNavigate();
  const { lessonId } = useParams();
  const user = requireUser('INSTRUCTOR');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [selectedMainTopicId, setSelectedMainTopicId] = useState<number | ''>('');
  const [selectedSecondaryTopicIds, setSelectedSecondaryTopicIds] = useState<number[]>([]);
  const [topicSelectionError, setTopicSelectionError] = useState<string | null>(null);
  const [newTopicName, setNewTopicName] = useState('');
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [topicCreateError, setTopicCreateError] = useState<string | null>(null);
  const [updatingTopicsFor, setUpdatingTopicsFor] = useState<number | null>(null);

  const [type, setType] = useState<'MCQ' | 'SHORT_TEXT'>('MCQ');
  const [question, setQuestion] = useState('');
  const [choices, setChoices] = useState<string[]>(['', '', '', '']);
  const [correct, setCorrect] = useState<number>(0);
  const [textAnswer, setTextAnswer] = useState('');
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(true);
  const [selectedPromptId, setSelectedPromptId] = useState<number | ''>('');
  const [showPromptForm, setShowPromptForm] = useState(false);
  const [promptForm, setPromptForm] = useState({
    name: '',
    systemPrompt: '',
    userPrompt: '',
    temperature: '',
    topP: '',
  });
  const [creatingPrompt, setCreatingPrompt] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [updatingPromptFor, setUpdatingPromptFor] = useState<number | null>(null);

  const refresh = () => {
    if (!lessonId) return;
    setLoading(true);
    Promise.all([api.lessonById(Number(lessonId)), api.activitiesForLesson(Number(lessonId))])
      .then(([lessonData, activityData]) => {
        setLesson(lessonData);
        setActivities(activityData);
      })
      .finally(() => setLoading(false));
  };

  const loadPrompts = () => {
    setLoadingPrompts(true);
    api
      .listPrompts()
      .then((data) => setPrompts(data))
      .catch((error) => console.error('Failed to load prompts', error))
      .finally(() => setLoadingPrompts(false));
  };

  const loadTopics = (courseId: number) => {
    setLoadingTopics(true);
    setTopicsError(null);
    api
      .topicsForCourse(courseId)
      .then((data: Topic[]) => {
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));
        setTopics(sorted);
        setSelectedMainTopicId((current) => {
          if (current !== '' && sorted.some((topic) => topic.id === current)) {
            return current;
          }
          return sorted.length > 0 ? sorted[0].id : '';
        });
      })
      .catch((error) => {
        console.error('Failed to load topics', error);
        setTopicsError('Could not load topics for this course.');
        setTopics([]);
        setSelectedMainTopicId('');
      })
      .finally(() => setLoadingTopics(false));
  };

  useEffect(() => {
    if (!user || !lessonId) return;
    refresh();
  }, [lessonId, user?.id]);

  useEffect(() => {
    if (!user) return;
    loadPrompts();
  }, [user?.id]);

  useEffect(() => {
    if (!lesson?.courseOfferingId) return;
    loadTopics(lesson.courseOfferingId);
  }, [lesson?.courseOfferingId]);

  useEffect(() => {
    setSelectedSecondaryTopicIds((prev) =>
      prev.filter((id) => topics.some((topic) => topic.id === id)),
    );
  }, [topics]);

  useEffect(() => {
    if (typeof selectedMainTopicId !== 'number') return;
    setSelectedSecondaryTopicIds((prev) => prev.filter((id) => id !== selectedMainTopicId));
  }, [selectedMainTopicId]);

  const resetPromptForm = () => {
    setPromptForm({
      name: '',
      systemPrompt: '',
      userPrompt: '',
      temperature: '',
      topP: '',
    });
  };

  const togglePromptForm = () => {
    setPromptError(null);
    setShowPromptForm((open) => {
      const next = !open;
      if (!next) {
        resetPromptForm();
      }
      return next;
    });
  };

  const handleCreatePrompt = async () => {
    if (creatingPrompt) return;
    const name = promptForm.name.trim();
    const systemPrompt = promptForm.systemPrompt.trim();
    const userPrompt = promptForm.userPrompt.trim();
    if (!name || !systemPrompt || !userPrompt) {
      setPromptError('Please provide a name, system prompt, and user prompt.');
      return;
    }

    const payload: Parameters<typeof api.createPrompt>[0] = {
      name,
      systemPrompt,
      userPrompt,
    };

    if (promptForm.temperature.trim()) {
      const value = Number(promptForm.temperature);
      if (!Number.isFinite(value)) {
        setPromptError('Temperature must be a number.');
        return;
      }
      payload.temperature = value;
    }

    if (promptForm.topP.trim()) {
      const value = Number(promptForm.topP);
      if (!Number.isFinite(value)) {
        setPromptError('Top P must be a number.');
        return;
      }
      payload.topP = value;
    }

    setCreatingPrompt(true);
    setPromptError(null);
    try {
      const created = await api.createPrompt(payload);
      setPrompts((prev) => [created, ...prev.filter((prompt) => prompt.id !== created.id)]);
      setSelectedPromptId(created.id);
      setShowPromptForm(false);
      resetPromptForm();
    } catch (error) {
      console.error('Failed to create prompt', error);
      setPromptError('Could not create prompt. Please try again.');
    } finally {
      setCreatingPrompt(false);
    }
  };

  const handleActivityPromptChange = async (activityId: number, value: string) => {
    const promptId = value ? Number(value) : null;
    const nextPrompt = promptId ? prompts.find((prompt) => prompt.id === promptId) : null;
    const previous = activities.find((activity) => activity.id === activityId);
    const previousPromptId = previous?.promptTemplateId ?? null;
    const previousPrompt = previous?.promptTemplate ?? null;

    setActivities((prev) =>
      prev.map((activity) =>
        activity.id === activityId
          ? {
              ...activity,
              promptTemplateId: promptId,
              promptTemplate: nextPrompt ? { id: nextPrompt.id, name: nextPrompt.name } : null,
            }
          : activity,
      ),
    );

    setUpdatingPromptFor(activityId);
    try {
      const updated = await api.updateActivity(activityId, {
        promptTemplateId: promptId,
      });
      setActivities((prev) =>
        prev.map((activity) =>
          activity.id === activityId
            ? {
                ...activity,
                promptTemplateId: updated.promptTemplateId ?? null,
                promptTemplate: updated.promptTemplate ?? null,
                mainTopic: updated.mainTopic,
                secondaryTopics: updated.secondaryTopics,
              }
            : activity,
        ),
      );
    } catch (error) {
      console.error('Failed to update activity prompt', error);
      setActivities((prev) =>
        prev.map((activity) =>
          activity.id === activityId
            ? {
                ...activity,
                promptTemplateId: previousPromptId,
                promptTemplate: previousPrompt,
              }
            : activity,
        ),
      );
    } finally {
      setUpdatingPromptFor((current) => (current === activityId ? null : current));
    }
  };

  const handleActivityMainTopicChange = async (activityId: number, value: string) => {
    if (!value) return;
    const newTopicId = Number(value);
    if (!Number.isFinite(newTopicId)) return;

    const topic = topics.find((entry) => entry.id === newTopicId);
    if (!topic) return;

    const targetActivity = activities.find((activity) => activity.id === activityId);
    if (!targetActivity) return;
    const previousMain = targetActivity.mainTopic;
    const previousSecondary = targetActivity.secondaryTopics;

    setActivities((prev) =>
      prev.map((activity) =>
        activity.id === activityId
          ? {
              ...activity,
              mainTopic: topic,
              secondaryTopics: activity.secondaryTopics.filter((item) => item.id !== newTopicId),
            }
          : activity,
      ),
    );

    setUpdatingTopicsFor(activityId);
    try {
      const updated = await api.updateActivity(activityId, { mainTopicId: newTopicId });
      setActivities((prev) =>
        prev.map((activity) =>
          activity.id === activityId
            ? {
                ...activity,
                mainTopic: updated.mainTopic,
                secondaryTopics: updated.secondaryTopics,
              }
            : activity,
        ),
      );
    } catch (error) {
      console.error('Failed to update main topic', error);
      setActivities((prev) =>
        prev.map((activity) =>
          activity.id === activityId
            ? {
                ...activity,
                mainTopic: previousMain,
                secondaryTopics: previousSecondary,
              }
            : activity,
        ),
      );
    } finally {
      setUpdatingTopicsFor((current) => (current === activityId ? null : current));
    }
  };

  const handleActivitySecondaryToggle = async (
    activityId: number,
    topicId: number,
    checked: boolean,
  ) => {
    const topic = topics.find((entry) => entry.id === topicId);
    if (!topic) return;

    const targetActivity = activities.find((activity) => activity.id === activityId);
    if (!targetActivity) return;
    const previousSecondary = targetActivity.secondaryTopics;

    const nextSecondary = checked
      ? [...previousSecondary.filter((item) => item.id !== topicId), topic]
      : previousSecondary.filter((item) => item.id !== topicId);

    setActivities((prev) =>
      prev.map((activity) =>
        activity.id === activityId
          ? {
              ...activity,
              secondaryTopics: nextSecondary.sort((a, b) => a.name.localeCompare(b.name)),
            }
          : activity,
      ),
    );

    setUpdatingTopicsFor(activityId);
    try {
      const updated = await api.updateActivity(activityId, {
        secondaryTopicIds: nextSecondary.map((item) => item.id),
      });
      setActivities((prev) =>
        prev.map((activity) =>
          activity.id === activityId
            ? {
                ...activity,
                secondaryTopics: updated.secondaryTopics,
                mainTopic: updated.mainTopic,
              }
            : activity,
        ),
      );
    } catch (error) {
      console.error('Failed to update secondary topics', error);
      setActivities((prev) =>
        prev.map((activity) =>
          activity.id === activityId
            ? {
                ...activity,
                secondaryTopics: previousSecondary,
              }
            : activity,
        ),
      );
    } finally {
      setUpdatingTopicsFor((current) => (current === activityId ? null : current));
    }
  };

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!lessonId || !question.trim()) return;
    if (selectedMainTopicId === '') {
      setTopicSelectionError('Select a main topic to continue.');
      return;
    }

    setBusy(true);
    setTopicSelectionError(null);
    const promptTemplateId = selectedPromptId === '' ? null : selectedPromptId;
    const mainTopicId = Number(selectedMainTopicId);
    const secondaryIds = selectedSecondaryTopicIds.filter((id) => id !== mainTopicId);

    try {
      if (type === 'MCQ') {
        await api.createActivity(Number(lessonId), {
          question: question.trim(),
          type,
          options: { choices },
          answer: { correctIndex: correct },
          hints: hint.trim() ? [hint.trim()] : [],
          promptTemplateId,
          mainTopicId,
          secondaryTopicIds: secondaryIds,
        });
      } else {
        await api.createActivity(Number(lessonId), {
          question: question.trim(),
          type,
          answer: { text: textAnswer.trim() },
          hints: hint.trim() ? [hint.trim()] : [],
          promptTemplateId,
          mainTopicId,
          secondaryTopicIds: secondaryIds,
        });
      }
      setQuestion('');
      setChoices(['', '', '', '']);
      setCorrect(0);
      setTextAnswer('');
      setHint('');
      refresh();
    } catch (error) {
      console.error('Failed to add activity', error);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateTopic = async (event: FormEvent) => {
    event.preventDefault();
    if (!lesson?.courseOfferingId) return;
    const name = newTopicName.trim();
    if (!name) {
      setTopicCreateError('Topic name is required.');
      return;
    }

    setCreatingTopic(true);
    setTopicCreateError(null);
    try {
      const created = await api.createTopic(lesson.courseOfferingId, { name });
      setTopics((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTopicName('');
      setSelectedMainTopicId((current) => (current === '' ? created.id : current));
      setTopicSelectionError(null);
    } catch (error) {
      console.error('Failed to create topic', error);
      setTopicCreateError('Could not create topic. Try a different name.');
    } finally {
      setCreatingTopic(false);
    }
  };

  const toggleSecondaryForNew = (topicId: number) => {
    setSelectedSecondaryTopicIds((prev) => {
      if (prev.includes(topicId)) {
        return prev.filter((id) => id !== topicId);
      }
      return [...prev, topicId];
    });
  };

  const availableSecondaryTopics = topics.filter(
    (topic) => topic.id !== (typeof selectedMainTopicId === 'number' ? selectedMainTopicId : -1),
  );

  return (
    <ProtectedRoute role="INSTRUCTOR">
      <div className="min-h-dvh bg-gradient-to-br from-sky-50 via-indigo-50 to-fuchsia-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
        <Nav />
        <div className="container mx-auto px-4 py-8">
          <button onClick={() => navigate(-1)} className="text-sm text-gray-600 hover:underline">
            ← Back
          </button>
          <h2 className="text-2xl font-bold mb-4">{lesson?.title || 'Lesson'}</h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-4">
              <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
                <div className="font-semibold mb-2">Activities</div>
                {loading ? (
                  <div className="text-gray-500">Loading…</div>
                ) : activities.length === 0 ? (
                  <div className="text-gray-500">No activities yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {activities.map((activity, i) => {
                      const isUpdatingPrompt = updatingPromptFor === activity.id;
                      const isUpdatingTopics = updatingTopicsFor === activity.id;
                      const mainTopicId = activity.mainTopic?.id ?? '';
                      const secondaryIds = new Set(activity.secondaryTopics.map((item) => item.id));
                      return (
                        <li
                          key={activity.id}
                          className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3"
                        >
                          <div>
                            <div className="text-xs text-gray-500">#{i + 1} • {activity.type}</div>
                            <div className="font-medium whitespace-pre-wrap">{activity.question}</div>
                          </div>

                          <div className="rounded-xl border border-dashed border-indigo-200/70 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 space-y-3">
                            <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                              Topics
                            </div>
                            {topics.length === 0 ? (
                              <p className="text-xs text-gray-500">
                                Define course topics to tag this activity.
                              </p>
                            ) : (
                              <div className="space-y-3">
                                <div>
                                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                                    Main topic
                                  </label>
                                  <select
                                    value={mainTopicId}
                                    onChange={(event) =>
                                      handleActivityMainTopicChange(activity.id, event.target.value)
                                    }
                                    disabled={loadingTopics || isUpdatingTopics}
                                    className="w-full px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-950 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60"
                                  >
                                    <option value="">Select topic…</option>
                                    {topics.map((topic) => (
                                      <option key={topic.id} value={topic.id}>
                                        {topic.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <span className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                                    Secondary topics (optional)
                                  </span>
                                  <div className="flex flex-wrap gap-2">
                                    {topics
                                      .filter((topic) => topic.id !== mainTopicId)
                                      .map((topic) => {
                                        const checked = secondaryIds.has(topic.id);
                                        return (
                                          <label
                                            key={topic.id}
                                            className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs cursor-pointer transition ${
                                              checked
                                                ? 'border-transparent bg-indigo-500 text-white shadow'
                                                : 'border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/20'
                                            } ${isUpdatingTopics ? 'opacity-60' : ''}`}
                                          >
                                            <input
                                              type="checkbox"
                                              className="sr-only"
                                              checked={checked}
                                              disabled={isUpdatingTopics}
                                              onChange={(event) =>
                                                handleActivitySecondaryToggle(
                                                  activity.id,
                                                  topic.id,
                                                  event.target.checked,
                                                )
                                              }
                                            />
                                            {topic.name}
                                          </label>
                                        );
                                      })}
                                  </div>
                                </div>
                              </div>
                            )}
                            {isUpdatingTopics && (
                              <span className="text-[0.7rem] text-indigo-500">Saving…</span>
                            )}
                          </div>

                          <div className="rounded-xl border border-dashed border-purple-200/70 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 p-3">
                            <div className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                              Prompt
                            </div>
                            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                              <select
                                value={activity.promptTemplateId ?? ''}
                                onChange={(event) => handleActivityPromptChange(activity.id, event.target.value)}
                                disabled={loadingPrompts || isUpdatingPrompt}
                                className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-900 bg-white dark:bg-gray-950 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent disabled:opacity-60"
                              >
                                <option value="">No prompt</option>
                                {prompts.map((prompt) => (
                                  <option key={prompt.id} value={prompt.id}>
                                    {prompt.name}
                                  </option>
                                ))}
                              </select>
                              {isUpdatingPrompt && (
                                <span className="text-xs text-purple-600 dark:text-purple-200">Saving…</span>
                              )}
                            </div>
                            {loadingPrompts && (
                              <p className="mt-2 text-[0.7rem] text-purple-500">Loading prompts…</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <aside className="space-y-4">
              <form onSubmit={onAdd} className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 space-y-3">
                <div className="font-semibold">Add Activity</div>
                <div className="flex gap-2 text-sm">
                  <label className={`px-3 py-1 rounded-full cursor-pointer ${type === 'MCQ' ? 'bg-sky-100 dark:bg-sky-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    <input type="radio" name="type" className="sr-only" checked={type === 'MCQ'} onChange={() => setType('MCQ')} />
                    MCQ
                  </label>
                  <label className={`px-3 py-1 rounded-full cursor-pointer ${type === 'SHORT_TEXT' ? 'bg-sky-100 dark:bg-sky-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    <input type="radio" name="type" className="sr-only" checked={type === 'SHORT_TEXT'} onChange={() => setType('SHORT_TEXT')} />
                    Short Text
                  </label>
                </div>
                <div>
                  <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Question…" className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent" />
                </div>
                {type === 'MCQ' ? (
                  <div className="space-y-2">
                    {choices.map((choice, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          value={choice}
                          onChange={(e) => setChoices((arr) => arr.map((value, idx) => (idx === i ? e.target.value : value)))}
                          placeholder={`Choice ${i + 1}`}
                          className="flex-1 px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent"
                        />
                        <label className="text-xs flex items-center gap-1">
                          <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} />
                          Correct
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <input value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} placeholder="Expected answer…" className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent" />
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                    Main topic
                  </label>
                  <select
                    value={selectedMainTopicId}
                    onChange={(event) => {
                      const value = event.target.value ? Number(event.target.value) : '';
                      setSelectedMainTopicId(value);
                      setTopicSelectionError(null);
                    }}
                    disabled={loadingTopics || topics.length === 0}
                    className="w-full px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-950 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:opacity-60"
                  >
                    <option value="">Select topic…</option>
                    {topics.map((topic) => (
                      <option key={topic.id} value={topic.id}>
                        {topic.name}
                      </option>
                    ))}
                  </select>
                  {topicSelectionError && (
                    <p className="text-xs text-rose-500">{topicSelectionError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 block">
                    Secondary topics (optional)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {availableSecondaryTopics.length === 0 ? (
                      <span className="text-xs text-gray-500">No other topics available.</span>
                    ) : (
                      availableSecondaryTopics.map((topic) => {
                        const checked = selectedSecondaryTopicIds.includes(topic.id);
                        return (
                          <label
                            key={topic.id}
                            className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs cursor-pointer transition ${
                              checked
                                ? 'border-transparent bg-indigo-500 text-white shadow'
                                : 'border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/20'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={checked}
                              onChange={() => toggleSecondaryForNew(topic.id)}
                            />
                            {topic.name}
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>Prompt</span>
                    <button
                      type="button"
                      onClick={togglePromptForm}
                      className="text-xs font-medium text-purple-600 hover:text-purple-500 dark:text-purple-300"
                    >
                      {showPromptForm ? 'Cancel' : 'New prompt'}
                    </button>
                  </div>
                  <select
                    value={selectedPromptId === '' ? '' : selectedPromptId}
                    onChange={(event) => setSelectedPromptId(event.target.value ? Number(event.target.value) : '')}
                    disabled={loadingPrompts || creatingPrompt}
                    className="w-full px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-900 bg-white dark:bg-gray-950 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent disabled:opacity-60"
                  >
                    <option value="">No prompt</option>
                    {prompts.map((prompt) => (
                      <option key={prompt.id} value={prompt.id}>
                        {prompt.name}
                      </option>
                    ))}
                  </select>
                  {!loadingPrompts && prompts.length === 0 && (
                    <p className="text-xs text-gray-500">Create a reusable prompt to guide AI feedback for this activity.</p>
                  )}
                  {showPromptForm && (
                    <div className="rounded-xl border border-purple-200/70 dark:border-purple-900/60 bg-purple-50/60 dark:bg-purple-950/30 p-4 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-purple-700 dark:text-purple-200 mb-1">
                          Name
                        </label>
                        <input
                          value={promptForm.name}
                          onChange={(event) => setPromptForm((prev) => ({ ...prev, name: event.target.value }))}
                          placeholder="Friendly reminder prompt"
                          className="w-full px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-900 bg-white dark:bg-gray-950 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-purple-700 dark:text-purple-200 mb-1">
                          System prompt
                        </label>
                        <textarea
                          value={promptForm.systemPrompt}
                          onChange={(event) => setPromptForm((prev) => ({ ...prev, systemPrompt: event.target.value }))}
                          rows={3}
                          placeholder="You are a helpful TA who offers hints without giving away the answer."
                          className="w-full px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-900 bg-white dark:bg-gray-950 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-purple-700 dark:text-purple-200 mb-1">
                          User prompt template
                        </label>
                        <textarea
                          value={promptForm.userPrompt}
                          onChange={(event) => setPromptForm((prev) => ({ ...prev, userPrompt: event.target.value }))}
                          rows={3}
                          placeholder="Lesson: {{lesson_title}}\nQuestion: {{question_prompt}}\nStudent answer: {{student_answer}}\nOffer a concise hint."
                          className="w-full px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-900 bg-white dark:bg-gray-950 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-purple-700 dark:text-purple-200 mb-1">
                            Temperature (optional)
                          </label>
                          <input
                            value={promptForm.temperature}
                            onChange={(event) => setPromptForm((prev) => ({ ...prev, temperature: event.target.value }))}
                            placeholder="0.2"
                            className="w-full px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-900 bg-white dark:bg-gray-950 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-purple-700 dark:text-purple-200 mb-1">
                            Top P (optional)
                          </label>
                          <input
                            value={promptForm.topP}
                            onChange={(event) => setPromptForm((prev) => ({ ...prev, topP: event.target.value }))}
                            placeholder="0.9"
                            className="w-full px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-900 bg-white dark:bg-gray-950 text-sm"
                          />
                        </div>
                      </div>
                      {promptError && <p className="text-xs text-rose-500">{promptError}</p>}
                      <button
                        type="button"
                        onClick={handleCreatePrompt}
                        disabled={creatingPrompt}
                        className="w-full px-4 py-2 rounded-lg text-white font-semibold bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-60"
                      >
                        {creatingPrompt ? 'Saving…' : 'Create prompt'}
                      </button>
                    </div>
                  )}
                </div>

                <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Optional hint…" className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent" />
                <button disabled={busy || !question.trim()} className="w-full px-4 py-2 rounded-xl text-white font-semibold bg-gradient-to-r from-indigo-600 to-fuchsia-600 disabled:opacity-50">
                  {busy ? 'Adding…' : 'Add Activity'}
                </button>
                {topicsError && (
                  <p className="text-xs text-rose-500">{topicsError}</p>
                )}
              </form>

              <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Course Topics</div>
                  {lesson?.courseOfferingId && (
                    <span className="text-xs text-gray-500">Course #{lesson.courseOfferingId}</span>
                  )}
                </div>
                <form onSubmit={handleCreateTopic} className="space-y-2">
                  <input
                    value={newTopicName}
                    onChange={(event) => setNewTopicName(event.target.value)}
                    placeholder="New topic name…"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent"
                  />
                  {topicCreateError && <p className="text-xs text-rose-500">{topicCreateError}</p>}
                  <button
                    type="submit"
                    disabled={creatingTopic || !newTopicName.trim() || !lesson?.courseOfferingId}
                    className="w-full px-3 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {creatingTopic ? 'Adding…' : 'Add Topic'}
                  </button>
                </form>
                <div className="space-y-1 max-h-48 overflow-y-auto text-sm">
                  {topics.length === 0 ? (
                    <div className="text-gray-500 text-xs">No topics yet.</div>
                  ) : (
                    topics.map((topic) => (
                      <div key={topic.id} className="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs">
                        {topic.name}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
