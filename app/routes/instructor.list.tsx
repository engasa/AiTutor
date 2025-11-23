import { useEffect, useOptimistic, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import AddActivityPanel from '../components/AddActivityPanel';
import ActivityDetailsCard from '../components/ActivityDetailsCard';
import EditActivityPanel from '../components/EditActivityPanel';
import AddCourseTopicsButton from '../components/AddCourseTopicsButton';
import Nav from '../components/Nav';
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
import { CourseTopicsProvider, useCourseTopics } from '../hooks/useCourseTopics';
import type { Route } from './+types/instructor.list';
import { fetchJson, requireUserFromRequest } from '~/lib/server-api';

import type { ActivityUpdatePayload } from '../lib/activityForm';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import TopicSyncMappingDialog from '~/components/TopicSyncMappingDialog';

function SyncTopicsButton({
  courseId,
  syncing,
  onSync,
}: {
  courseId: number;
  syncing: boolean;
  onSync: () => Promise<void>;
}) {
  const label = syncing ? 'Syncing…' : 'Sync now';
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Sync topics now"
            onClick={() => {
              if (!syncing) onSync();
            }}
            disabled={syncing}
            className="w-full px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 text-white text-sm font-semibold shadow-sm hover:shadow-md transition disabled:opacity-50"
          >
            {label}
          </button>
        </TooltipTrigger>
        <TooltipContent>Topics are synced from EduAI for this course.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserFromRequest(request, 'INSTRUCTOR');
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
    if (module.courseOfferingId) {
      course = await fetchJson<Course>(request, `/api/courses/${module.courseOfferingId}`);
    }
  }

  return { course, module, lesson, activities };
}

export default function InstructorLessonBuilder({ loaderData }: Route.ComponentProps) {
  const { lessonId } = useParams();
  const numericLessonId = lessonId ? Number(lessonId) : null;
  const { course, module, lesson, activities: initialActivities } = loaderData;
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [oActivities, addActivityOpt] = useOptimistic(
    activities,
    (state, patch: (items: Activity[]) => Activity[]) => patch(state),
  );

  const [updatingTopicsFor, setUpdatingTopicsFor] = useState<number | null>(null);
  const [updatingModesFor, setUpdatingModesFor] = useState<number | null>(null);

  const [showAddPanel, setShowAddPanel] = useState(false);

  const [editingActivityId, setEditingActivityId] = useState<number | null>(null);
  const [savingActivityId, setSavingActivityId] = useState<number | null>(null);
  const [deletingActivityId, setDeletingActivityId] = useState<number | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const courseOfferingId = lesson?.courseOfferingId ?? null;
  const courseTopics = useCourseTopics(courseOfferingId);
  const { topics, loading: loadingTopics, error: topicsError } = courseTopics;
  const [syncingTopics, setSyncingTopics] = useState(false);
  const [showMapping, setShowMapping] = useState(false);
  const [missingTopics, setMissingTopics] = useState<{ id: number; name: string }[]>([]);

  const [showTopicSaving, setShowTopicSaving] = useState(false);
  const topicSavingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [showModeSaving, setShowModeSaving] = useState(false);
  const modeSavingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [promptDrafts, setPromptDrafts] = useState<Record<number, string>>({});
  const [savingPromptId, setSavingPromptId] = useState<number | null>(null);
  const [promptErrors, setPromptErrors] = useState<Record<number, string>>({});

  const beginTopicUpdate = (activityId: number) => {
    setUpdatingTopicsFor(activityId);
    setShowTopicSaving(false);
    if (topicSavingTimeoutRef.current) {
      clearTimeout(topicSavingTimeoutRef.current);
    }
    topicSavingTimeoutRef.current = setTimeout(() => setShowTopicSaving(true), 300);
  };

  const endTopicUpdate = (activityId: number) => {
    let shouldClear = false;
    setUpdatingTopicsFor((current) => {
      if (current !== activityId) {
        return current;
      }
      shouldClear = true;
      return null;
    });
    if (shouldClear) {
      if (topicSavingTimeoutRef.current) {
        clearTimeout(topicSavingTimeoutRef.current);
        topicSavingTimeoutRef.current = null;
      }
      setShowTopicSaving(false);
    }
  };

  const beginModeUpdate = (activityId: number) => {
    setUpdatingModesFor(activityId);
    setShowModeSaving(false);
    if (modeSavingTimeoutRef.current) {
      clearTimeout(modeSavingTimeoutRef.current);
    }
    modeSavingTimeoutRef.current = setTimeout(() => setShowModeSaving(true), 300);
  };

  const endModeUpdate = (activityId: number) => {
    let shouldClear = false;
    setUpdatingModesFor((current) => {
      if (current !== activityId) {
        return current;
      }
      shouldClear = true;
      return null;
    });
    if (shouldClear) {
      if (modeSavingTimeoutRef.current) {
        clearTimeout(modeSavingTimeoutRef.current);
        modeSavingTimeoutRef.current = null;
      }
      setShowModeSaving(false);
    }
  };

  // Adjust state during render when loader data changes
  const [prevInitialActivities, setPrevInitialActivities] = useState(initialActivities);
  if (initialActivities !== prevInitialActivities) {
    setPrevInitialActivities(initialActivities);
    setActivities(initialActivities);
  }

  const beginEditingActivity = (activity: Activity) => {
    setEditingActivityId(activity.id);
    setEditError(null);
  };

  const cancelEditingActivity = () => {
    setEditingActivityId(null);
    setSavingActivityId(null);
    setEditError(null);
  };

  const handleEditSubmit = async (activityId: number, payload: ActivityUpdatePayload) => {
    setEditError(null);
    setSavingActivityId(activityId);
    try {
      const updatePayload: Parameters<typeof api.updateActivity>[1] = {
        title: payload.title,
        instructionsMd: payload.instructionsMd,
        question: payload.question,
        type: payload.type,
        options: payload.options,
        answer: payload.answer,
        hints: payload.hints,
      };

      const updated = await api.updateActivity(activityId, updatePayload);
      setActivities((prev) =>
        prev.map((activity) => (activity.id === activityId ? updated : activity)),
      );
      cancelEditingActivity();
    } catch (error) {
      console.error('Failed to update activity', error);
      setEditError('Could not save activity. Please try again.');
    } finally {
      setSavingActivityId((current) => (current === activityId ? null : current));
    }
  };

  const refreshActivities = async () => {
    if (!numericLessonId) return;
    try {
      const activityData = await api.activitiesForLesson(numericLessonId);
      setActivities(activityData);
    } catch (error) {
      console.error('Failed to refresh activities', error);
    }
  };

  useEffect(() => {
    return () => {
      if (topicSavingTimeoutRef.current) {
        clearTimeout(topicSavingTimeoutRef.current);
        topicSavingTimeoutRef.current = null;
      }
      if (modeSavingTimeoutRef.current) {
        clearTimeout(modeSavingTimeoutRef.current);
        modeSavingTimeoutRef.current = null;
      }
    };
  }, []);



  const handleDeleteActivity = async (activityId: number) => {
    if (typeof window === 'undefined') {
      return;
    }
    const confirmed = window.confirm('Remove this activity? This action cannot be undone.');
    if (!confirmed) {
      return;
    }

    setDeletingActivityId(activityId);
    try {
      await api.deleteActivity(activityId);
      setActivities((prev) => prev.filter((activity) => activity.id !== activityId));
      if (editingActivityId === activityId) {
        cancelEditingActivity();
      }
    } catch (error) {
      console.error('Failed to remove activity', error);
      alert('Failed to remove activity. Please try again.');
    } finally {
      setDeletingActivityId((current) => (current === activityId ? null : current));
    }
  };

  const handleActivityModeChange = async (
    activityId: number,
    mode: 'teach' | 'guide' | 'custom',
    enabled: boolean
  ) => {
    const activity = oActivities.find((a) => a.id === activityId);
    if (!activity) return;

    const newTeach = mode === 'teach' ? enabled : activity.enableTeachMode;
    const newGuide = mode === 'guide' ? enabled : activity.enableGuideMode;
    const newCustom = mode === 'custom' ? enabled : activity.enableCustomMode;

    if (!newTeach && !newGuide && !newCustom) {
      alert('At least one AI mode must be enabled');
      return;
    }

    // Optimistic UI via useOptimistic
    addActivityOpt((items) =>
      items.map((a) =>
        a.id === activityId
          ? {
              ...a,
              enableTeachMode: newTeach,
              enableGuideMode: newGuide,
              enableCustomMode: newCustom,
              customPrompt: mode === 'custom' && !enabled ? null : a.customPrompt,
            }
          : a,
      ),
    );

    beginModeUpdate(activityId);
    try {
      const payload: Record<string, unknown> = {
        enableTeachMode: newTeach,
        enableGuideMode: newGuide,
        enableCustomMode: newCustom,
      };
      if (mode === 'custom' && !enabled) {
        payload.customPrompt = null;
      }
      const updated = await api.updateActivity(activityId, payload);
      setActivities((prev) => prev.map((a) => (a.id === activityId ? updated : a)));
    } catch (error) {
      console.error('Failed to update AI modes', error);
    } finally {
      endModeUpdate(activityId);
    }
  };

  const handleCustomPromptSave = async (activity: Activity) => {
    const draft = (promptDrafts[activity.id] ?? activity.customPrompt ?? '').trim();
    setPromptErrors((prev) => ({ ...prev, [activity.id]: '' }));

    addActivityOpt((items) =>
      items.map((item) =>
        item.id === activity.id ? { ...item, customPrompt: draft || null } : item,
      ),
    );
    setSavingPromptId(activity.id);
    try {
      const updated = await api.updateActivity(activity.id, { customPrompt: draft || null });
      setActivities((prev) =>
        prev.map((item) => (item.id === activity.id ? updated : item)),
      );
      if (!draft) {
        setPromptDrafts((prev) => {
          const next = { ...prev };
          delete next[activity.id];
          return next;
        });
      }
    } catch (error) {
      console.error('Failed to save custom prompt', error);
      setPromptErrors((prev) => ({
        ...prev,
        [activity.id]: 'Could not save the custom prompt. Please try again.',
      }));
      setActivities((prev) => [...prev]);
    } finally {
      setSavingPromptId((current) => (current === activity.id ? null : current));
    }
  };

  const handleActivityMainTopicChange = async (activityId: number, value: string) => {
    if (!value) return;
    const newTopicId = Number(value);
    if (!Number.isFinite(newTopicId)) return;

    const topic = topics.find((entry) => entry.id === newTopicId);
    if (!topic) return;

    const targetActivity = oActivities.find((activity) => activity.id === activityId);
    if (!targetActivity) return;
    // Optimistic UI via useOptimistic
    addActivityOpt((items) =>
      items.map((activity) =>
        activity.id === activityId
          ? {
              ...activity,
              mainTopic: topic,
              secondaryTopics: activity.secondaryTopics.filter((item) => item.id !== newTopicId),
            }
          : activity,
      ),
    );

    beginTopicUpdate(activityId);
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
      // Base state remains unchanged; optimistic view will clear on next render
    } finally {
      endTopicUpdate(activityId);
    }
  };

  const handleActivitySecondaryToggle = async (
    activityId: number,
    topicId: number,
    checked: boolean,
  ) => {
    const topic = topics.find((entry) => entry.id === topicId);
    if (!topic) return;

    const targetActivity = oActivities.find((activity) => activity.id === activityId);
    if (!targetActivity) return;

    const nextSecondary = checked
      ? [...targetActivity.secondaryTopics.filter((item) => item.id !== topicId), topic]
      : targetActivity.secondaryTopics.filter((item) => item.id !== topicId);

    // Optimistic UI via useOptimistic
    addActivityOpt((items) =>
      items.map((activity) =>
        activity.id === activityId
          ? {
              ...activity,
              secondaryTopics: nextSecondary.sort((a, b) => a.name.localeCompare(b.name)),
            }
          : activity,
      ),
    );

    beginTopicUpdate(activityId);
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
      // Base state remains unchanged; optimistic view will clear on next render
    } finally {
      endTopicUpdate(activityId);
    }
  };

  return (
    <CourseTopicsProvider value={courseTopics}>
      <div className="min-h-dvh bg-gradient-to-br from-sky-50 via-indigo-50 to-fuchsia-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
        <Nav />
        <div className="container mx-auto px-4 py-8">
            <Breadcrumb className="mb-6">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/instructor">Teaching</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator>/</BreadcrumbSeparator>
                <BreadcrumbItem>
                  {course && module ? (
                    <BreadcrumbLink asChild>
                      <Link to={`/instructor/courses/${module.courseOfferingId}`}>{course.title}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>Course</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                <BreadcrumbSeparator>/</BreadcrumbSeparator>
                <BreadcrumbItem>
                  {module && lesson ? (
                    <BreadcrumbLink asChild>
                      <Link to={`/instructor/module/${lesson.moduleId}`}>{module.title}</Link>
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
            <h2 className="text-2xl font-bold mb-4">{lesson?.title || 'Lesson'}</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 space-y-4">
              <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
                <div className="font-semibold mb-2">Activities</div>
                {oActivities.length === 0 ? (
                  <div className="text-gray-500">No activities yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {oActivities.map((activity, i) => {
                      const isUpdatingTopics = updatingTopicsFor === activity.id;
                      const isUpdatingModes = updatingModesFor === activity.id;
                      const mainTopicId = activity.mainTopic?.id ?? '';
                      const secondaryIds = new Set(activity.secondaryTopics.map((item) => item.id));
                      const isEditing = editingActivityId === activity.id;
                      const isSaving = savingActivityId === activity.id;
                      const isDeleting = deletingActivityId === activity.id;
                      const isCustomEnabled = activity.enableCustomMode;
                      const promptDraft = promptDrafts[activity.id] ?? activity.customPrompt ?? '';
                      const isSavingPrompt = savingPromptId === activity.id;
                      const promptError = promptErrors[activity.id];
                      return (
                        <li
                          key={activity.id}
                          className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs text-gray-500">#{i + 1} • {activity.type}</div>
                              <div className="font-medium whitespace-pre-wrap">
                                {activity.question}
                              </div>
                              {(isSaving || isDeleting) && (
                                <div className="text-[0.7rem] text-gray-500 mt-1">
                                  {isSaving ? 'Saving…' : 'Removing…'}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {isEditing ? (
                                <span className="px-3 py-1 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200 text-xs font-medium">
                                  Editing…
                                </span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => beginEditingActivity(activity)}
                                    className="px-3 py-1 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200 text-xs font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition"
                                    disabled={isDeleting}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteActivity(activity.id)}
                                    className="px-3 py-1 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200 text-xs font-medium hover:bg-rose-200 dark:hover:bg-rose-900/60 transition"
                                    disabled={isDeleting}
                                  >
                                    {isDeleting ? 'Removing…' : 'Remove'}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {isEditing ? (
                            <EditActivityPanel
                              key={activity.id}
                              activity={activity}
                              busy={isSaving}
                              error={editError}
                              onSubmit={(payload) => handleEditSubmit(activity.id, payload)}
                              onCancel={cancelEditingActivity}
                            />
                          ) : (
                            <ActivityDetailsCard activity={activity} />
                          )}

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
                                    className={`w-full px-3 py-2 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-950 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                                      showTopicSaving ? 'disabled:opacity-60' : ''
                                    }`}
                                  >
                                    <option value="">Select a topic…</option>
                                    {topics.map((topic) => (
                                      <option key={topic.id} value={topic.id}>
                                        {topic.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                                    Secondary topics
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
                                            } ${
                                              showTopicSaving && isUpdatingTopics ? 'opacity-60' : ''
                                            }`}
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
                            {showTopicSaving && isUpdatingTopics && (
                              <span className="text-[0.7rem] text-indigo-500">Saving…</span>
                            )}
                          </div>

                          <div className="rounded-xl border border-dashed border-purple-200/70 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 p-3 space-y-2">
                            <div className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                              AI Study Buddy Modes
                            </div>
                            <div className="space-y-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={activity.enableTeachMode}
                                  onChange={(e) => handleActivityModeChange(activity.id, 'teach', e.target.checked)}
                                  disabled={isUpdatingModes}
                                  className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm">Teach me</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={activity.enableGuideMode}
                                  onChange={(e) => handleActivityModeChange(activity.id, 'guide', e.target.checked)}
                                  disabled={isUpdatingModes}
                                  className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm">Guide me</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={activity.enableCustomMode}
                                  onChange={(e) =>
                                    handleActivityModeChange(activity.id, 'custom', e.target.checked)
                                  }
                                  disabled={isUpdatingModes}
                                  className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm">Custom prompt</span>
                              </label>
                            </div>
                            {showModeSaving && isUpdatingModes && (
                              <span className="text-[0.7rem] text-purple-500">Saving…</span>
                            )}
                            {isCustomEnabled && (
                              <div className="mt-3 space-y-2">
                                <label className="text-xs font-semibold text-purple-700 dark:text-purple-300 block">
                                  Custom AI prompt
                                </label>
                                <textarea
                                  value={promptDraft}
                                  onChange={(event) =>
                                    setPromptDrafts((prev) => ({
                                      ...prev,
                                      [activity.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Write a custom prompt the AI should follow for this activity…"
                                  rows={3}
                                  className="w-full px-3 py-2 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-gray-950 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                                  disabled={isSavingPrompt}
                                />
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleCustomPromptSave(activity)}
                                    disabled={isSavingPrompt}
                                    className="px-3 py-2 rounded-lg bg-purple-600 text-white text-xs font-semibold shadow hover:shadow-md transition disabled:opacity-60 disabled:cursor-not-allowed"
                                  >
                                    {isSavingPrompt ? 'Saving…' : 'Save prompt'}
                                  </button>
                                  {promptError && (
                                    <span className="text-[0.75rem] text-rose-600 dark:text-rose-300">
                                      {promptError}
                                    </span>
                                  )}
                                  {!promptError && isSavingPrompt && (
                                    <span className="text-[0.75rem] text-purple-600 dark:text-purple-300">
                                      Saving prompt…
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAddPanel((open) => !open)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold shadow hover:shadow-md transition"
                >
                  {showAddPanel ? 'Hide add activities' : 'Add activities'}
                </button>
              </div>

              {showAddPanel && numericLessonId !== null && (
                <AddActivityPanel
                  lessonId={numericLessonId}
                  onActivityCreated={refreshActivities}
                />
              )}
            </div>

            <aside className="space-y-4">
              <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Course Topics</div>
                  {lesson?.courseOfferingId && (
                    <span className="text-xs text-gray-500">Course #{lesson.courseOfferingId}</span>
                  )}
                </div>
                {topicsError && <p className="text-xs text-rose-500">{topicsError}</p>}
                <div className="flex items-center gap-2">
                  {!!course?.externalId || course?.externalSource === 'EDUAI' ? (
                    // EduAI course: Show only sync button
                    lesson?.courseOfferingId && (
                      <SyncTopicsButton
                        courseId={lesson.courseOfferingId}
                        syncing={syncingTopics}
                        onSync={async () => {
                          if (!lesson?.courseOfferingId) return;
                          setSyncingTopics(true);
                          try {
                            const result = await api.syncCourseTopics(lesson.courseOfferingId);
                            // Refresh topics first so the dialog options reflect latest topics
                            await courseTopics.refresh();
                            if (result && Array.isArray(result.missingTopics) && result.missingTopics.length > 0) {
                              setMissingTopics(result.missingTopics.map((t: any) => ({ id: t.id, name: t.name })));
                              setShowMapping(true);
                            }
                          } catch (e) {
                            console.error('Failed to sync topics', e);
                            alert('Failed to sync topics from EduAI. Please try again.');
                          } finally {
                            setSyncingTopics(false);
                          }
                        }}
                      />
                    )
                  ) : (
                    // Regular course: Show add topics button
                    <AddCourseTopicsButton
                      disabled={!lesson?.courseOfferingId}
                    />
                  )}
                </div>
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
      <TopicSyncMappingDialog
        open={showMapping}
        onClose={() => setShowMapping(false)}
        topics={topics}
        missing={missingTopics}
        busy={syncingTopics}
        onApply={async (mappings) => {
          if (!lesson?.courseOfferingId) return;
          await api.remapCourseTopics(lesson.courseOfferingId, mappings);
          await Promise.all([courseTopics.refresh(), refreshActivities()]);
        }}
      />
    </CourseTopicsProvider>
  );
}
