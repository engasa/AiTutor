import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import Nav from '../components/Nav';
import ProtectedRoute from '../components/ProtectedRoute';
import api from '../lib/api';
import type { Lesson, ModuleDetail } from '../lib/types';
import { requireUser } from '../hooks/useLocalUser';

type TemplateSummary = {
  id: number;
  title: string;
  modules: Array<{
    id: number;
    title: string;
    lessons: Array<{ id: number; title: string }>;
  }>;
};

export default function InstructorModuleLessons() {
  const navigate = useNavigate();
  const { moduleId } = useParams();
  const user = requireUser('INSTRUCTOR');
  const [module, setModule] = useState<ModuleDetail | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);

  const loadData = async () => {
    if (!moduleId) return;
    setLoading(true);
    try {
      const [moduleDetail, lessonData] = await Promise.all([
        api.moduleById(Number(moduleId)),
        api.lessonsForModule(Number(moduleId)),
      ]);
      setModule(moduleDetail);
      setLessons(lessonData);
    } catch (error) {
      console.error('Failed to load module lessons', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !moduleId) return;
    loadData();
  }, [user?.id, moduleId]);

  const ensureTemplatesLoaded = () => {
    if (templates.length > 0) return;
    api
      .listTemplates()
      .then((data) => setTemplates(data))
      .catch((error) => console.error('Failed to load templates', error));
  };

  const onCreateLesson = async (event: FormEvent) => {
    event.preventDefault();
    if (!moduleId || !title.trim()) return;
    setCreating(true);
    try {
      await api.createLesson(Number(moduleId), { title: title.trim() });
      setTitle('');
      loadData();
    } catch (error) {
      console.error('Failed to create lesson', error);
    } finally {
      setCreating(false);
    }
  };

  const lessonOptions = useMemo(() => {
    if (!selectedTemplateId) return [];
    const template = templates.find((t) => t.id === selectedTemplateId);
    if (!template) return [];
    return template.modules;
  }, [selectedTemplateId, templates]);

  const toggleLesson = (lessonId: number) => {
    setSelectedLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  };

  const onImportLessons = async () => {
    if (!module || !moduleId || !selectedTemplateId || selectedLessonIds.size === 0) return;
    setImporting(true);
    try {
      await api.importIntoCourse(module.courseOfferingId, {
        templateId: selectedTemplateId,
        lessonTemplateIds: Array.from(selectedLessonIds),
        targetModuleId: Number(moduleId),
      });
      setShowImport(false);
      setSelectedTemplateId(null);
      setSelectedLessonIds(new Set());
      loadData();
    } catch (error) {
      console.error('Import lessons failed', error);
    } finally {
      setImporting(false);
    }
  };

  return (
    <ProtectedRoute role="INSTRUCTOR">
      <div className="min-h-dvh bg-gradient-to-br from-sky-50 via-indigo-50 to-fuchsia-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
        <Nav />
        <div className="container mx-auto px-4 py-8 space-y-6">
          <button onClick={() => navigate(-1)} className="text-sm text-gray-600 hover:underline">
            ← Back
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Lessons</h2>
              {module && <p className="text-sm text-gray-500">Module: {module.title}</p>}
            </div>
            <button
              onClick={() => {
                ensureTemplatesLoaded();
                setShowImport((prev) => !prev);
              }}
              className="px-3 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold"
            >
              {showImport ? 'Close' : 'Import Lessons'}
            </button>
          </div>

          {showImport && (
            <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/70 shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Select template</label>
                <select
                  value={selectedTemplateId ?? ''}
                  onChange={(e) => {
                    const value = e.target.value ? Number(e.target.value) : null;
                    setSelectedTemplateId(value);
                    setSelectedLessonIds(new Set());
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent"
                >
                  <option value="">Choose template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              {selectedTemplateId && lessonOptions.length > 0 ? (
                <div className="space-y-3">
                  {lessonOptions.map((moduleGroup) => (
                    <div key={moduleGroup.id} className="border border-gray-200 dark:border-gray-800 rounded-xl">
                      <div className="px-3 py-2 text-sm font-semibold bg-gray-50 dark:bg-gray-900 rounded-t-xl">
                        {moduleGroup.title}
                      </div>
                      <div className="p-3 space-y-2">
                        {moduleGroup.lessons.length === 0 ? (
                          <div className="text-xs text-gray-500">No lessons to import.</div>
                        ) : (
                          moduleGroup.lessons.map((lesson) => (
                            <label
                              key={lesson.id}
                              className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition ${
                                selectedLessonIds.has(lesson.id)
                                  ? 'border-transparent ring-2 ring-offset-2 ring-purple-500 dark:ring-offset-gray-950'
                                  : 'border-gray-200 dark:border-gray-800'
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={selectedLessonIds.has(lesson.id)}
                                onChange={() => toggleLesson(lesson.id)}
                              />
                              <span className="text-sm">{lesson.title}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={onImportLessons}
                    disabled={importing || selectedLessonIds.size === 0}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold disabled:opacity-50"
                  >
                    {importing ? 'Importing…' : 'Import selected lessons'}
                  </button>
                </div>
              ) : selectedTemplateId ? (
                <div className="text-sm text-gray-500">Selected template has no lessons yet.</div>
              ) : null}
            </div>
          )}

          <form onSubmit={onCreateLesson} className="flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="New lesson title…"
              className="flex-1 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
            />
            <button
              disabled={creating || !title.trim()}
              className="px-4 py-2 rounded-xl text-white font-semibold bg-gradient-to-r from-sky-600 to-indigo-600 disabled:opacity-50"
            >
              {creating ? 'Adding…' : 'Add Lesson'}
            </button>
          </form>

          {loading ? (
            <div className="text-gray-500">Loading…</div>
          ) : lessons.length === 0 ? (
            <div className="text-gray-500">No lessons yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {lessons.map((lesson) => (
                <button
                  key={lesson.id}
                  onClick={() => navigate(`/instructor/lesson/${lesson.id}`)}
                  className="text-left p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/60 hover:shadow-md transition group"
                >
                  <div className="font-semibold group-hover:underline">{lesson.title}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
