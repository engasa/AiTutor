/**
 * @file Instructor lesson editor — the heaviest authoring page in the app.
 *
 * Route: /instructor/lesson/:lessonId
 * Auth: PROFESSOR
 * Loads: lesson + activities (parallel), then walks up to module + course
 *        for breadcrumbs (sequential — module/course IDs come from lesson).
 * Owns:
 *   - Activity CRUD: create (AddActivityPanel), inline edit
 *     (EditActivityPanel), delete with confirm.
 *   - Per-activity topic assignment: a single main topic plus any number of
 *     secondary topics, both autosaved.
 *   - Per-activity AI mode toggles (teach / guide / custom) plus the custom
 *     prompt editor and its short button-title field.
 *   - EduAI topic sync: the SyncTopicsButton triggers /topics/sync; if the
 *     server returns missingTopics > 0, opens TopicSyncMappingDialog so the
 *     instructor can remap orphan local topics to fresh EduAI topic IDs.
 *   - Bug-report context push: the editor includes the activity currently
 *     being edited so reports can pinpoint it.
 * Gotchas:
 *   - Validation: at least one of teach/guide/custom must remain enabled.
 *     handleActivityModeChange refuses to disable the last one and alerts.
 *   - Saving indicators are debounced ~300ms (NOT 500ms) via
 *     topicSavingTimeoutRef and modeSavingTimeoutRef to avoid flicker on
 *     fast saves; both timers must be cleared on unmount.
 *   - Optimistic UI for mode/topic changes uses React 19 useOptimistic. On
 *     server failure the base state is left untouched, which lets the
 *     optimistic patch drop on the next render — this also drives the
 *     `setActivities((prev) => [...prev])` line in handleCustomPromptSave
 *     (force a re-render to clear stale optimism after a save error).
 *   - Custom prompt requires both a title (max 20 chars) and prompt body.
 *   - Bug-report context MUST be cleared on unmount to avoid leaking
 *     activity IDs into reports submitted from unrelated pages.
 * Related: components/AddActivityPanel, components/EditActivityPanel,
 *          components/TopicSyncMappingDialog, hooks/useCourseTopics
 */
import { useEffect, useOptimistic, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  AppBackdrop,
  AppContainer,
  DashboardCard,
  DashboardHero,
  SectionEyebrow,
  StatPill,
} from '~/components/AppShell';
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
import type { Activity, Course, Lesson, ModuleDetail, Topic } from '../lib/types';
import { CourseTopicsProvider, useCourseTopics } from '../hooks/useCourseTopics';
import type { Route } from './+types/instructor.list';
import { requireClientUser } from '~/lib/client-auth';

import type { ActivityUpdatePayload } from '../lib/activityForm';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip';
import TopicSyncMappingDialog from '~/components/TopicSyncMappingDialog';
import { useBugReport } from '~/components/bug-report/useBugReport';

/**
 * Tooltip-wrapped sync trigger surfaced only for EduAI-sourced courses. The
 * tooltip exists so instructors understand topics are externally owned and
 * the button is a re-pull rather than an arbitrary mutation.
 */
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
            className="w-full btn-secondary text-sm"
          >
            {label}
          </button>
        </TooltipTrigger>
        <TooltipContent>Topics are synced from EduAI for this course.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Loads the lesson and its activities (parallel), then walks up to the
 * module and course one step at a time because each ID lives on the
 * previous resource. The breadcrumb and EduAI sync path both depend on
 * having the parent course available.
 */
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  await requireClientUser('PROFESSOR');
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
    if (module.courseOfferingId) {
      course = (await api.courseById(module.courseOfferingId)) as Course;
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
  const [titleDrafts, setTitleDrafts] = useState<Record<number, string>>({});
  const [savingPromptId, setSavingPromptId] = useState<number | null>(null);
  const [promptErrors, setPromptErrors] = useState<Record<number, string>>({});
  const [promptSaved, setPromptSaved] = useState<Record<number, boolean>>({});
  const { setContext: setBugReportContext, clearContext: clearBugReportContext } = useBugReport();

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
    enabled: boolean,
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
    if (mode === 'custom' && !enabled) {
      setPromptSaved((prev) => ({ ...prev, [activityId]: false }));
    }

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
    const titleDraft = (titleDrafts[activity.id] ?? activity.customPromptTitle ?? '')
      .trim()
      .slice(0, 20);

    // Validate: both title and prompt are required
    if (!titleDraft) {
      setPromptErrors((prev) => ({
        ...prev,
        [activity.id]: 'Please provide a title for the custom prompt (max 20 characters).',
      }));
      return;
    }
    if (!draft) {
      setPromptErrors((prev) => ({
        ...prev,
        [activity.id]: 'Please provide the custom prompt text.',
      }));
      return;
    }

    setPromptErrors((prev) => ({ ...prev, [activity.id]: '' }));

    addActivityOpt((items) =>
      items.map((item) =>
        item.id === activity.id
          ? { ...item, customPrompt: draft, customPromptTitle: titleDraft }
          : item,
      ),
    );
    setSavingPromptId(activity.id);
    try {
      const updated = await api.updateActivity(activity.id, {
        customPrompt: draft,
        customPromptTitle: titleDraft,
      });
      setActivities((prev) => prev.map((item) => (item.id === activity.id ? updated : item)));
      setPromptSaved((prev) => ({ ...prev, [activity.id]: true }));
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
              secondaryTopics: nextSecondary.toSorted((a: Topic, b: Topic) =>
                a.name.localeCompare(b.name),
              ),
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
      <main className="app-shell">
        <AppBackdrop pattern="mesh" />
        <Nav />
        <AppContainer className="space-y-8 pb-12 pt-8">
          <Breadcrumb className="px-1 text-white/54">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/instructor" className="hover:text-white">
                    Teaching
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-white/24">/</BreadcrumbSeparator>
              <BreadcrumbItem>
                {course && module ? (
                  <BreadcrumbLink asChild>
                    <Link
                      to={`/instructor/courses/${module.courseOfferingId}`}
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
                    <Link to={`/instructor/module/${lesson.moduleId}`} className="hover:text-white">
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
            eyebrow={<SectionEyebrow tone="warm">Lesson builder</SectionEyebrow>}
            title={lesson?.title || 'Lesson'}
            description="Compose activities, tune AI modes, and manage topic alignment inside a dedicated authoring studio."
            aside={
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                <StatPill label="Activities" value={activities.length} />
                <StatPill label="Topics" value={topics.length} />
                <StatPill label="Sync" value={syncingTopics ? 'Running' : 'Ready'} />
              </div>
            }
          />

          <div className="grid grid-cols-1 gap-6 items-start lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <DashboardCard className="p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-white/40">
                      Activities
                    </div>
                    <div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                      Activity stack
                    </div>
                  </div>
                </div>
                {oActivities.length === 0 ? (
                  <div className="text-white/54">No activities yet.</div>
                ) : (
                  <ul className="space-y-3">
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
                      const isPromptSaved =
                        promptSaved[activity.id] ??
                        Boolean(activity.enableCustomMode && activity.customPrompt);
                      const promptError = promptErrors[activity.id];
                      return (
                        <li
                          key={activity.id}
                          className="space-y-3 rounded-[1.6rem] border border-white/10 bg-black/16 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-amber-300 text-xs font-semibold text-slate-950">
                                {i + 1}
                              </span>
                              <div>
                                <div className="mb-0.5 text-xs text-white/40">{activity.type}</div>
                                <div className="whitespace-pre-wrap font-medium text-white">
                                  {activity.question}
                                </div>
                                {(isSaving || isDeleting) && (
                                  <div className="mt-1 text-[0.7rem] text-white/42">
                                    {isSaving ? 'Saving...' : 'Removing...'}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {isEditing ? (
                                <span className="tag tag-accent">Editing</span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => beginEditingActivity(activity)}
                                    className="btn-secondary px-3 py-2 text-xs"
                                    disabled={isDeleting}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteActivity(activity.id)}
                                    className="rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-2 text-xs font-medium text-rose-100"
                                    disabled={isDeleting}
                                  >
                                    {isDeleting ? 'Removing...' : 'Remove'}
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

                          <div className="space-y-3 rounded-[1.2rem] border border-cyan-300/16 bg-cyan-300/8 p-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                              Topics
                            </div>
                            {topics.length === 0 ? (
                              <p className="text-xs text-white/48">
                                Define course topics to tag this activity.
                              </p>
                            ) : (
                              <div className="space-y-3">
                                <div>
                                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                                    Main topic
                                  </label>
                                  <select
                                    value={mainTopicId}
                                    onChange={(event) =>
                                      handleActivityMainTopicChange(activity.id, event.target.value)
                                    }
                                    disabled={loadingTopics || isUpdatingTopics}
                                    className={`input-field text-sm ${
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
                                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
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
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs cursor-pointer transition ${
                                              checked
                                                ? 'border-cyan-300/20 bg-cyan-300/12 text-cyan-100 shadow-sm'
                                                : 'border-white/10 bg-white/5 text-white/70 hover:border-cyan-300/16'
                                            } ${
                                              showTopicSaving && isUpdatingTopics
                                                ? 'opacity-60'
                                                : ''
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
                              <span className="text-[0.7rem] text-cyan-100">Saving...</span>
                            )}
                          </div>

                          <div className="space-y-2 rounded-[1.2rem] border border-amber-300/16 bg-amber-300/8 p-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100">
                              AI Study Buddy Modes
                            </div>
                            <div className="space-y-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={activity.enableTeachMode}
                                  onChange={(e) =>
                                    handleActivityModeChange(activity.id, 'teach', e.target.checked)
                                  }
                                  disabled={isUpdatingModes}
                                  className="rounded border-white/20"
                                />
                                <span className="text-sm text-white">Teach me</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={activity.enableGuideMode}
                                  onChange={(e) =>
                                    handleActivityModeChange(activity.id, 'guide', e.target.checked)
                                  }
                                  disabled={isUpdatingModes}
                                  className="rounded border-white/20"
                                />
                                <span className="text-sm text-white">Guide me</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={activity.enableCustomMode}
                                  onChange={(e) =>
                                    handleActivityModeChange(
                                      activity.id,
                                      'custom',
                                      e.target.checked,
                                    )
                                  }
                                  disabled={isUpdatingModes}
                                  className="rounded border-white/20"
                                />
                                <span className="text-sm text-white">Custom prompt</span>
                              </label>
                            </div>
                            {showModeSaving && isUpdatingModes && (
                              <span className="text-[0.7rem] text-amber-100">Saving...</span>
                            )}
                            {isCustomEnabled && (
                              <div className="mt-3 space-y-3">
                                <div>
                                  <label className="text-xs font-semibold text-primary block mb-1">
                                    Button title (shown to students, max 20 chars)
                                  </label>
                                  <input
                                    type="text"
                                    value={
                                      titleDrafts[activity.id] ?? activity.customPromptTitle ?? ''
                                    }
                                    onChange={(event) => {
                                      const value = event.target.value.slice(0, 20);
                                      setTitleDrafts((prev) => ({ ...prev, [activity.id]: value }));
                                      setPromptSaved((saved) => ({
                                        ...saved,
                                        [activity.id]: false,
                                      }));
                                    }}
                                    placeholder="e.g., Explain simply"
                                    maxLength={20}
                                    className="input-field text-sm"
                                    disabled={isSavingPrompt}
                                  />
                                  <div className="text-[0.65rem] text-muted-foreground mt-1">
                                    {
                                      (titleDrafts[activity.id] ?? activity.customPromptTitle ?? '')
                                        .length
                                    }
                                    /20 characters
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-primary block mb-1">
                                    Custom AI prompt
                                  </label>
                                  <textarea
                                    value={promptDraft}
                                    onChange={(event) =>
                                      setPromptDrafts((prev) => {
                                        setPromptSaved((saved) => ({
                                          ...saved,
                                          [activity.id]: false,
                                        }));
                                        return {
                                          ...prev,
                                          [activity.id]: event.target.value,
                                        };
                                      })
                                    }
                                    placeholder="Write a custom prompt the AI should follow for this activity…"
                                    rows={3}
                                    className="input-field text-sm"
                                    disabled={isSavingPrompt}
                                  />
                                  <div className="text-[0.65rem] text-muted-foreground mt-1">
                                    Tip: Use{' '}
                                    <code className="bg-secondary px-1 rounded">
                                      [INSERT TOPIC HERE]
                                    </code>{' '}
                                    and{' '}
                                    <code className="bg-secondary px-1 rounded">
                                      [ENTER KNOWLEDGE LEVEL]
                                    </code>{' '}
                                    as placeholders.
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleCustomPromptSave(activity)}
                                    disabled={isSavingPrompt}
                                    className="btn-primary py-2 text-xs"
                                  >
                                    {isSavingPrompt
                                      ? 'Saving...'
                                      : isPromptSaved
                                        ? 'Saved'
                                        : 'Save prompt'}
                                  </button>
                                  {promptError && (
                                    <span className="text-[0.75rem] text-rose-200">
                                      {promptError}
                                    </span>
                                  )}
                                  {!promptError && isSavingPrompt && (
                                    <span className="text-[0.75rem] text-amber-100">
                                      Saving prompt...
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
              </DashboardCard>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAddPanel((open) => !open)}
                  className="btn-primary"
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
              <DashboardCard className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white">Course Topics</div>
                  {lesson?.courseOfferingId && (
                    <span className="text-xs text-white/42">Course #{lesson.courseOfferingId}</span>
                  )}
                </div>
                {topicsError && <p className="text-xs text-rose-200">{topicsError}</p>}
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
                            if (
                              result &&
                              Array.isArray(result.missingTopics) &&
                              result.missingTopics.length > 0
                            ) {
                              setMissingTopics(
                                result.missingTopics.map((t: any) => ({ id: t.id, name: t.name })),
                              );
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
                    <AddCourseTopicsButton disabled={!lesson?.courseOfferingId} />
                  )}
                </div>
                <div className="max-h-48 space-y-1.5 overflow-y-auto text-sm">
                  {topics.length === 0 ? (
                    <div className="text-xs text-white/46">No topics yet.</div>
                  ) : (
                    topics.map((topic) => (
                      <div key={topic.id} className="tag">
                        {topic.name}
                      </div>
                    ))
                  )}
                </div>
              </DashboardCard>
            </aside>
          </div>
        </AppContainer>
      </main>
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
