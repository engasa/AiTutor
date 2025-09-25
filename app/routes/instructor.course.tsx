import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import Nav from '../components/Nav';
import ProtectedRoute from '../components/ProtectedRoute';
import api from '../lib/api';
import type { Course, Module } from '../lib/types';
import { requireUser } from '../hooks/useLocalUser';

export default function InstructorCourseModules() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const user = requireUser('INSTRUCTOR');
  const numericCourseId = courseId ? Number(courseId) : null;
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [selectedSourceCourseId, setSelectedSourceCourseId] = useState<number | null>(null);
  const [sourceModules, setSourceModules] = useState<Module[]>([]);
  const [loadingSourceCourses, setLoadingSourceCourses] = useState(false);
  const [loadingSourceModules, setLoadingSourceModules] = useState(false);
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);

  const loadModules = () => {
    if (!numericCourseId) return;
    setLoading(true);
    api
      .modulesForCourse(numericCourseId)
      .then((data) => setModules(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user || !numericCourseId) return;
    loadModules();
  }, [user?.id, numericCourseId]);

  const ensureSourceCoursesLoaded = () => {
    if (availableCourses.length > 0) return;
    setLoadingSourceCourses(true);
    api
      .listCourses()
      .then((data: Course[]) => {
        const nextCourses = numericCourseId
          ? data.filter((course: Course) => course.id !== numericCourseId)
          : data;
        setAvailableCourses(nextCourses);
      })
      .catch((error) => console.error('Failed to load courses', error))
      .finally(() => setLoadingSourceCourses(false));
  };

  useEffect(() => {
    if (selectedSourceCourseId == null) {
      setSourceModules([]);
      setSelectedModuleIds(new Set());
      return;
    }

    setLoadingSourceModules(true);
    api
      .modulesForCourse(selectedSourceCourseId)
      .then((data: Module[]) => {
        setSourceModules(data);
        setSelectedModuleIds(new Set());
      })
      .catch((error) => console.error('Failed to load modules for course', error))
      .finally(() => setLoadingSourceModules(false));
  }, [selectedSourceCourseId]);

  const onCreateModule = async (event: FormEvent) => {
    event.preventDefault();
    if (!numericCourseId || !title.trim()) return;
    setCreating(true);
    try {
      await api.createModule(numericCourseId, { title: title.trim() });
      setTitle('');
      loadModules();
    } catch (error) {
      console.error('Failed to create module', error);
    } finally {
      setCreating(false);
    }
  };

  const toggleModuleSelection = (moduleId: number) => {
    setSelectedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const onImport = async () => {
    if (!numericCourseId || selectedSourceCourseId == null || selectedModuleIds.size === 0) return;
    setImporting(true);
    try {
      await api.importIntoCourse(numericCourseId, {
        sourceCourseId: selectedSourceCourseId,
        moduleIds: Array.from(selectedModuleIds),
      });
      setShowImport(false);
      setSelectedSourceCourseId(null);
      setSourceModules([]);
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
                  if (!showImport) {
                    ensureSourceCoursesLoaded();
                  } else {
                    setSelectedSourceCourseId(null);
                    setSourceModules([]);
                    setSelectedModuleIds(new Set());
                  }
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
                <label className="block text-sm font-semibold mb-1">Choose course to copy</label>
                <select
                  value={selectedSourceCourseId ?? ''}
                  onChange={(e) => {
                    const nextValue = e.target.value ? Number(e.target.value) : null;
                    setSelectedSourceCourseId(nextValue);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-transparent"
                >
                  <option value="">Select course…</option>
                  {availableCourses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title} • {course.status}
                    </option>
                  ))}
                </select>
                {loadingSourceCourses && (
                  <p className="mt-2 text-xs text-gray-500">Loading courses…</p>
                )}
                {!loadingSourceCourses && availableCourses.length === 0 && (
                  <p className="mt-2 text-xs text-gray-500">
                    You don’t have another course to copy from yet.
                  </p>
                )}
              </div>

              {selectedSourceCourseId == null ? (
                <p className="text-sm text-gray-500">Select a course to preview its modules.</p>
              ) : loadingSourceModules ? (
                <p className="text-sm text-gray-500">Loading modules…</p>
              ) : sourceModules.length === 0 ? (
                <p className="text-sm text-gray-500">Selected course has no modules yet.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Select modules to import (lessons and activities included).
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {sourceModules.map((module) => (
                      <label
                        key={module.id}
                        className={`p-3 rounded-xl border cursor-pointer transition ${
                          selectedModuleIds.has(module.id)
                            ? 'border-transparent ring-2 ring-offset-2 ring-purple-500 dark:ring-offset-gray-950'
                            : 'border-gray-200 dark:border-gray-800'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selectedModuleIds.has(module.id)}
                          onChange={() => toggleModuleSelection(module.id)}
                        />
                        <div className="font-semibold">{module.title}</div>
                        {module.description && (
                          <div className="text-xs text-gray-500">{module.description}</div>
                        )}
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={onImport}
                    disabled={
                      importing ||
                      selectedSourceCourseId == null ||
                      selectedModuleIds.size === 0
                    }
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold disabled:opacity-50"
                  >
                    {importing ? 'Importing…' : 'Import modules'}
                  </button>
                </div>
              )}
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
