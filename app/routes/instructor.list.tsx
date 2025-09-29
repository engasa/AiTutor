import { useEffect, useState } from 'react';
import { Link, useLoaderData, useNavigate, useParams } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';
import AddActivityPanel from '../components/AddActivityPanel';
import ActivityDetailsCard from '../components/ActivityDetailsCard';
import AddCourseTopicsButton from '../components/AddCourseTopicsButton';
import Nav from '../components/Nav';
import ProtectedRoute from '../components/ProtectedRoute';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/breadcrumb';
import api from '../lib/api';
import type { Activity, Course, Lesson, ModuleDetail, PromptTemplate } from '../lib/types';
import { CourseTopicsProvider, useCourseTopics } from '../hooks/useCourseTopics';
import { requireUser } from '../hooks/useLocalUser';

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const lessonId = Number(params.lessonId);
  const [lesson, activities] = await Promise.all([
    api.lessonById(lessonId),
    api.activitiesForLesson(lessonId),
  ]);

  // Fetch module and course details for breadcrumb
  let module = null;
  let course = null;
  if (lesson.moduleId) {
    module = await api.moduleById(lesson.moduleId);
    if (module.courseOfferingId) {
      course = await api.courseById(module.courseOfferingId);
    }
  }

  return { course, module, lesson, activities };
}

export default function InstructorLessonBuilder() {
  const navigate = useNavigate();
  const { lessonId } = useParams();
  const numericLessonId = lessonId ? Number(lessonId) : null;
  const user = requireUser('INSTRUCTOR');
  const { course, module, lesson, activities: initialActivities } = useLoaderData<typeof clientLoader>();
  const [activities, setActivities] = useState<Activity[]>(initialActivities);

  const [updatingTopicsFor, setUpdatingTopicsFor] = useState<number | null>(null);

  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loadingPrompts, setLoadingPrompts] = useState(true);
  const [updatingPromptFor, setUpdatingPromptFor] = useState<number | null>(null);

  const [showAddPanel, setShowAddPanel] = useState(false);

  const courseOfferingId = lesson?.courseOfferingId ?? null;
  const courseTopics = useCourseTopics(courseOfferingId);
  const { topics, loading: loadingTopics, error: topicsError } = courseTopics;

  const refreshActivities = async () => {
    if (!numericLessonId) return;
    try {
      const activityData = await api.activitiesForLesson(numericLessonId);
      setActivities(activityData);
    } catch (error) {
      console.error('Failed to refresh activities', error);
    }
  };

  const loadPrompts = () => {
    setLoadingPrompts(true);
    api
      .listPrompts()
      .then((data) => setPrompts(data))
      .catch((error) => console.error('Failed to load prompts', error))
      .finally(() => setLoadingPrompts(false));
  };

  useEffect(() => {
    if (!user) return;
    loadPrompts();
  }, [user?.id]);

  const handlePromptCreated = (created: PromptTemplate) => {
    setPrompts((prev) => [created, ...prev.filter((prompt) => prompt.id !== created.id)]);
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

  return (
    <ProtectedRoute role="INSTRUCTOR">
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
                {activities.length === 0 ? (
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

                          <ActivityDetailsCard activity={activity} />

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
                  prompts={prompts}
                  loadingPrompts={loadingPrompts}
                  onPromptCreated={handlePromptCreated}
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
                <AddCourseTopicsButton disabled={!lesson?.courseOfferingId} />
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
    </CourseTopicsProvider>
    </ProtectedRoute>
  );
}
