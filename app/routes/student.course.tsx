import { useEffect, useState } from 'react';
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
import type { Course, Module } from '../lib/types';
import { requireUser } from '../hooks/useLocalUser';

export default function StudentCourseModules() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const user = requireUser('STUDENT');
  const numericCourseId = courseId ? Number(courseId) : null;
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !numericCourseId) return;
    setLoading(true);
    Promise.all([api.courseById(numericCourseId), api.modulesForCourse(numericCourseId)])
      .then(([courseData, modulesData]) => {
        setCourse(courseData);
        setModules(modulesData);
      })
      .catch((error) => console.error('Failed to load course data', error))
      .finally(() => setLoading(false));
  }, [user?.id, numericCourseId]);

  return (
    <ProtectedRoute role="STUDENT">
      <div className="min-h-dvh bg-gradient-to-br from-purple-50 via-rose-50 to-orange-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
        <Nav />
        <div className="container mx-auto px-4 py-8">
          <Breadcrumb className="mb-6">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/student">My Courses</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator>/</BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbPage>{course?.title || 'Course'}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h2 className="text-2xl font-bold mb-4">Modules</h2>
          {loading ? (
            <div className="text-gray-500">Loading…</div>
          ) : modules.length === 0 ? (
            <div className="text-gray-500">No modules available yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {modules.map((module) => (
                <button
                  key={module.id}
                  onClick={() => navigate(`/student/module/${module.id}`)}
                  className="text-left p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/60 hover:shadow-md transition group"
                >
                  <div className="font-semibold group-hover:underline">{module.title}</div>
                  {module.description && <div className="text-sm text-gray-500">{module.description}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

