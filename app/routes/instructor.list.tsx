import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import Nav from '../components/Nav';
import ProtectedRoute from '../components/ProtectedRoute';
import api from '../lib/api';
import type { Activity, ActivityType, Lesson, PromptTemplate } from '../lib/types';
import { requireUser } from '../hooks/useLocalUser';

export default function InstructorLessonBuilder() {
  const navigate = useNavigate();
  const { lessonId } = useParams();
  const user = requireUser('INSTRUCTOR');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState<'MCQ' | 'SHORT_TEXT'>('MCQ');
  const [question, setQuestion] = useState('');
  const [choices, setChoices] = useState<string[]>(['', '', '', '']);
  const [correct, setCorrect] = useState<number>(0);
  const [textAnswer, setTextAnswer] = useState('');
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(true);
  const [selectedPromptId, setSelectedPromptId] = useState<number | ''>('');
  const [showPromptForm, setShowPromptForm] = useState(false);
  const [promptForm, setPromptForm] = useState({
    name: '',
    systemPrompt: '',
    userPrompt: '',
    activityTypeId: '' as number | '',
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

  const loadActivityTypes = () => {
    api
      .listActivityTypes()
      .then((data) => {
        setActivityTypes(data);
        setPromptForm((prev) => ({
          ...prev,
          activityTypeId:
            prev.activityTypeId !== ''
              ? prev.activityTypeId
              : data.length > 0
                ? data[0].id
                : '',
        }));
      })
      .catch((error) => console.error('Failed to load activity types', error));
  };

  useEffect(() => {
    if (!user || !lessonId) return;
    refresh();
  }, [lessonId, user?.id]);

  useEffect(() => {
    if (!user) return;
    loadPrompts();
    loadActivityTypes();
  }, [user?.id]);

  const resetPromptForm = () => {
    setPromptForm({
      name: '',
      systemPrompt: '',
      userPrompt: '',
      activityTypeId: activityTypes.length > 0 ? activityTypes[0].id : '',
      temperature: '',
      topP: '',
    });
  };

  const togglePromptForm = () => {
    setPromptError(null);
    setShowPromptForm((open) => {
      const next = !open;
      if (next) {
        setPromptForm((current) => ({
          ...current,
          activityTypeId:
            typeof current.activityTypeId === 'number'
              ? current.activityTypeId
              : activityTypes[0]?.id ?? '',
        }));
      } else {
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

    const activityTypeId = typeof promptForm.activityTypeId === 'number'
      ? promptForm.activityTypeId
      : activityTypes[0]?.id;

    if (!activityTypeId) {
      setPromptError('Select an activity type for this prompt.');
      return;
    }

    const payload: Parameters<typeof api.createPrompt>[0] = {
      name,
      systemPrompt,
      userPrompt,
      activityTypeId,
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

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!lessonId || !question.trim()) return;
    setBusy(true);
    const promptTemplateId = selectedPromptId === '' ? null : selectedPromptId;
    try {
      if (type === 'MCQ') {
        await api.createActivity(Number(lessonId), {
          question: question.trim(),
          type,
          options: { choices },
          answer: { correctIndex: correct },
          hints: hint.trim() ? [hint.trim()] : [],
          promptTemplateId,
        });
      } else {
        await api.createActivity(Number(lessonId), {
          question: question.trim(),
          type,
          answer: { text: textAnswer.trim() },
          hints: hint.trim() ? [hint.trim()] : [],
          promptTemplateId,
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
                      const isUpdating = updatingPromptFor === activity.id;
                      return (
                        <li
                          key={activity.id}
                          className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3"
                        >
                          <div>
                            <div className="text-xs text-gray-500">#{i + 1} • {activity.type}</div>
                            <div className="font-medium whitespace-pre-wrap">{activity.question}</div>
                          </div>
                          <div className="rounded-xl border border-dashed border-purple-200/70 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 p-3">
                            <div className="flex items-center justify-between text-xs font-semibold text-purple-700 dark:text-purple-300">
                              <span>Prompt</span>
                              <span className="text-[0.7rem] font-normal text-purple-500 dark:text-purple-200">
                                {activity.promptTemplate?.name ?? 'None selected'}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                              <select
                                value={activity.promptTemplateId ?? ''}
                                onChange={(event) => handleActivityPromptChange(activity.id, event.target.value)}
                                disabled={loadingPrompts || isUpdating}
                                className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-900 bg-white dark:bg-gray-950 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent disabled:opacity-60"
                              >
                                <option value="">No prompt</option>
                                {prompts.map((prompt) => (
                                  <option key={prompt.id} value={prompt.id}>
                                    {prompt.name}
                                  </option>
                                ))}
                              </select>
                              {isUpdating && (
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

            <aside>
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
                      {activityTypes.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold text-purple-700 dark:text-purple-200 mb-1">
                            Activity type
                          </label>
                          <select
                            value={promptForm.activityTypeId === '' ? '' : promptForm.activityTypeId}
                            onChange={(event) =>
                              setPromptForm((prev) => ({
                                ...prev,
                                activityTypeId: event.target.value ? Number(event.target.value) : '',
                              }))
                            }
                            className="w-full px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-900 bg-white dark:bg-gray-950 text-sm"
                          >
                            {activityTypes.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
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
              </form>
            </aside>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
