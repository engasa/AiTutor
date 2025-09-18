import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import Nav from '../components/Nav';
import ProtectedRoute from '../components/ProtectedRoute';
import api from '../lib/api';
import type { Lesson, Module } from '../lib/types';
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

export default function InstructorCourseModules() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const user = requireUser('INSTRUCTOR');
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);

  const loadModules = () => {
    if (!courseId) return;
    setLoading(true);
    api
      .modulesForCourse(Number(courseId))
      .then((data) => setModules(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user || !courseId) return;
    loadModules();
  }, [user?.id, courseId]);

  const ensureTemplatesLoaded = () => {
    if (templates.length > 0) return;
    api
      .listTemplates()
      .then((data) => setTemplates(data))
      .catch((error) => console.error('Failed to load templates', error));
  };

  const onCreateModule = async (event: FormEvent) => {
    event.preventDefault();
    if (!courseId || !title.trim()) return;
    setCreating(true);
    try {
      await api.createModule(Number(courseId), { title: title.trim() });
      setTitle('');
      loadModules();
    } catch (error) {
      console.error('Failed to create module', error);
    } finally {
      setCreating(false);
    }
  };

  const moduleOptions = useMemo(() => {
    if (!selectedTemplateId) return [];
    const template = templates.find((t) => t.id === selectedTemplateId);
    return template?.modules ?? [];
  }, [selectedTemplateId, templates]);

  const toggleModuleSelection = (moduleId: number) => {
    setSelectedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const onImport = async () => {
    if (!courseId || !selectedTemplateId || selectedModuleIds.size === 0) return;
    setImporting(true);
    try {
      await api.importIntoCourse(Number(courseId), {
        templateId: selectedTemplateId,
        moduleTemplateIds: Array.from(selectedModuleIds),
      });
      setShowImport(false);
      setSelectedTemplateId(null);
      setSelectedModuleIds(new Set());
      loadModules();
    } catch (error) {
      console.error('Import failed', error);
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
            <h2 className="text-2xl font-bold">Modules</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  ensureTemplatesLoaded();
                  setShowImport((prev) => !prev);
                }}
                className="px-3 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold"
              >
                {showImport ? 'Close' : 'Import'}
              </button>
            </div>
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
                    setSelectedModuleIds(new Set());
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

              {selectedTemplateId && moduleOptions.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Select modules to import (lessons and activities included).</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {moduleOptions.map((m) => (
                      <label
                        key={m.id}
                        className={`p-3 rounded-xl border cursor-pointer transition ${
                          selectedModuleIds.has(m.id)
                            ? 'border-transparent ring-2 ring-offset-2 ring-purple-500 dark:ring-offset-gray-950'
                            : 'border-gray-200 dark:border-gray-800'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selectedModuleIds.has(m.id)}
                          onChange={() => toggleModuleSelection(m.id)}
                        />
                        <div className="font-semibold">{m.title}</div>
                        <div className="text-xs text-gray-500">{m.lessons.length} lessons</div>
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={onImport}
                    disabled={importing || selectedModuleIds.size === 0}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold disabled:opacity-50"
                  >
                    {importing ? 'Importing…' : 'Import modules'}
                  </button>
                </div>
              ) : selectedTemplateId ? (
                <div className="text-sm text-gray-500">Selected template has no modules yet.</div>
              ) : null}
            </div>
          )}

          <form onSubmit={onCreateModule} className="flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="New module title…"
              className="flex-1 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
            />
            <button
              disabled={creating || !title.trim()}
              className="px-4 py-2 rounded-xl text-white font-semibold bg-gradient-to-r from-sky-600 to-indigo-600 disabled:opacity-50"
            >
              {creating ? 'Adding…' : 'Add Module'}
            </button>
          </form>

          {loading ? (
            <div className="text-gray-500">Loading…</div>
          ) : modules.length === 0 ? (
            <div className="text-gray-500">No modules yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {modules.map((m) => (
                <button
                  key={m.id}
                  onClick={() => navigate(`/instructor/module/${m.id}`)}
                  className="text-left p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/60 hover:shadow-md transition group"
                >
                  <div className="font-semibold group-hover:underline">{m.title}</div>
                  {m.description && <div className="text-sm text-gray-500">{m.description}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
