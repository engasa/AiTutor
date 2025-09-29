import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
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
import type { Activity, Course, Lesson, ModuleDetail } from '../lib/types';
import { requireUser } from '../hooks/useLocalUser';

export default function StudentLessonPlayer() {
  const navigate = useNavigate();
  const { lessonId } = useParams();
  const user = requireUser('STUDENT');
  const numericLessonId = lessonId ? Number(lessonId) : null;
  const [course, setCourse] = useState<Course | null>(null);
  const [module, setModule] = useState<ModuleDetail | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mcq, setMcq] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [assistant, setAssistant] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [wasCorrect, setWasCorrect] = useState(false);

  useEffect(() => {
    if (!user || !numericLessonId) return;
    setLoading(true);
    Promise.all([api.lessonById(numericLessonId), api.activitiesForLesson(numericLessonId)])
      .then(async ([lessonData, activityData]) => {
        setLesson(lessonData);
        setActivities(activityData);

        // Fetch module and course details for breadcrumb
        if (lessonData.moduleId) {
          const moduleData = await api.moduleById(lessonData.moduleId);
          setModule(moduleData);

          if (moduleData.courseOfferingId) {
            const courseData = await api.courseById(moduleData.courseOfferingId);
            setCourse(courseData);
          }
        }
      })
      .catch((error) => console.error('Failed to load lesson data', error))
      .finally(() => setLoading(false));
  }, [numericLessonId, user?.id]);

  useEffect(() => {
    setMcq(null);
    setText('');
    setAssistant([]);
    setResult(null);
    setWasCorrect(false);
  }, [idx]);

  const activity = activities[idx];
  const canNext = idx < activities.length - 1;
  const canPrev = idx > 0;

  const questionChunks = useMemo(() => (activity?.question || '').split(/\n/), [activity?.question]);

  const submit = async () => {
    if (!activity || !user) return;
    setSubmitting(true);
    try {
      const payload: any = { userId: user.id };
      if (activity.type === 'MCQ') payload.answerOption = mcq;
      else payload.answerText = text;
      const res = await api.submitAnswer(activity.id, payload);
      setResult(res.isCorrect ? 'Correct! 🎉' : 'Not quite. Keep going!');
      if (res.isCorrect) {
        setWasCorrect(true);
        setAssistant([res.message || 'Great job! Proceed when you are ready for the next question.']);
      } else {
        setWasCorrect(false);
        if (res.assistantCue) setAssistant((a) => [...a, res.assistantCue]);
      }
    } catch (e) {
      setResult('There was a problem submitting.');
      setWasCorrect(false);
    } finally {
      setSubmitting(false);
    }
  };

  const nudge = () => {
    if (!activity || wasCorrect) return;
    const next = activity.hints[assistant.length] || 'Break the question down into smaller parts.';
    setAssistant((a) => [...a, next]);
  };

  return (
    <ProtectedRoute role="STUDENT">
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
          <h2 className="text-2xl font-bold mb-4">{lesson?.title || 'Lesson'}</h2>

          {loading ? (
            <div className="text-gray-500">Loading…</div>
          ) : activities.length === 0 ? (
            <div className="text-gray-500">No activities yet.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 space-y-4">
                <div className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
                  <div className="text-xs text-gray-500 mb-2">
                    Activity {idx + 1} of {activities.length}
                  </div>
                  <div className="prose dark:prose-invert max-w-none">
                    {questionChunks.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                  {activity?.mainTopic && (
                    <div className="mt-3 text-xs text-indigo-600 dark:text-indigo-300">
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
                      disabled={wasCorrect}
                      className="px-4 py-2 rounded-xl font-semibold bg-gray-100 dark:bg-gray-800 disabled:opacity-50"
                    >
                      Guide me
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        disabled={!canPrev}
                        onClick={() => setIdx((i) => Math.max(0, i - 1))}
                        className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 disabled:opacity-50"
                      >
                        Prev
                      </button>
                      <button
                        disabled={!canNext}
                        onClick={() => setIdx((i) => Math.min(activities.length - 1, i + 1))}
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
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
