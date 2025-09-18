import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Nav from '../components/Nav';
import ProtectedRoute from '../components/ProtectedRoute';
import api from '../lib/api';
import type { Course, CourseStatus } from '../lib/types';
import { requireUser } from '../hooks/useLocalUser';

type CourseTemplate = {
  id: number;
  title: string;
  description?: string | null;
};

export default function InstructorHome() {
  const navigate = useNavigate();
  const user = requireUser('INSTRUCTOR');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<CourseTemplate[]>([]);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [templateId, setTemplateId] = useState<number | ''>('');
  const [cloneContent, setCloneContent] = useState(true);
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

  const loadCourses = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.listCourses();
      setCourses(data);
    } catch (error) {
      console.error('Failed to load courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateCourseStatus = async (courseId: number, status: CourseStatus) => {
    setUpdatingStatusId(courseId);
    try {
      await api.updateCourse(courseId, { status });
      setCourses((prev) =>
        prev.map((course) => (course.id === courseId ? { ...course, status } : course))
      );
    } catch (error) {
      console.error('Failed to update course status', error);
      await loadCourses();
    } finally {
      setUpdatingStatusId((current) => (current === courseId ? null : current));
    }
  };

  useEffect(() => {
    if (!user) return;
    loadCourses();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    api
      .listTemplates()
      .then((data) => setTemplates(data))
      .catch((error) => console.error('Failed to load templates', error));
  }, [user?.id]);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      await api.createCourse({
        title: title.trim(),
        description: description.trim() ? description.trim() : undefined,
        templateId: templateId === '' ? undefined : Number(templateId),
        cloneContent,
        status: cloneContent ? 'ACTIVE' : 'DRAFT',
      });
      setShowCreate(false);
      setTitle('');
      setDescription('');
      setTemplateId('');
      setCloneContent(true);
      loadCourses();
    } catch (error) {
      console.error('Failed to create course', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <ProtectedRoute role="INSTRUCTOR">
      <div className="min-h-dvh bg-gradient-to-br from-sky-50 via-indigo-50 to-fuchsia-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
        <Nav />
        <div className="container mx-auto px-4 py-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Teaching</h2>
            <button
              onClick={() => setShowCreate((prev) => !prev)}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold shadow hover:bg-indigo-500"
            >
              {showCreate ? 'Close' : 'New Course'}
            </button>
          </div>

          {showCreate && (
            <form onSubmit={onCreate} className="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/70 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent"
                  placeholder="Algorithms - Winter Cohort"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent"
                  placeholder="Optional description for learners"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Start from template</label>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent"
                >
                  <option value="">Blank course</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
              {templateId !== '' && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={cloneContent}
                    onChange={(e) => setCloneContent(e.target.checked)}
                  />
                  Import modules and lessons from template
                </label>
              )}
              <button
                type="submit"
                disabled={creating || !title.trim()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white font-semibold disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create course'}
              </button>
            </form>
          )}

          {loading ? (
            <div className="text-gray-500">Loading…</div>
          ) : courses.length === 0 ? (
            <div className="text-gray-500">No courses yet. Create one to get started.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {courses.map((c) => (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/instructor/courses/${c.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/instructor/courses/${c.id}`);
                    }
                  }}
                  className="text-left p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/60 hover:shadow-md transition group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 cursor-pointer"
                >
                  <div className="font-semibold text-lg group-hover:underline">{c.title}</div>
                  {c.description && <div className="text-sm text-gray-500 mt-1">{c.description}</div>}
                  <div className="mt-5 flex flex-col gap-1 text-sm text-gray-500">
                    <span className="text-xs font-semibold uppercase tracking-wide">Status</span>
                    <div
                      className="relative inline-flex"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <select
                        value={c.status}
                        disabled={updatingStatusId === c.id}
                        onChange={(event) => {
                          event.stopPropagation();
                          updateCourseStatus(c.id, event.target.value as CourseStatus);
                        }}
                        className="appearance-none w-auto min-w-[6rem] px-4 pr-8 py-2 text-xs font-semibold tracking-wide rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-600 text-white border border-purple-400/60 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-950"
                        style={{ backgroundImage: 'none' }}
                      >
                        <option value="DRAFT">Draft</option>
                        <option value="ACTIVE">Active</option>
                        <option value="ARCHIVED">Completed</option>
                      </select>
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/80">
                        ▾
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
