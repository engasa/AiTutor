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
import type { Course, Lesson, ModuleDetail } from '../lib/types';
import { requireUser } from '../hooks/useLocalUser';

export default function StudentModuleLessons() {
  const navigate = useNavigate();
  const { moduleId } = useParams();
  const user = requireUser('STUDENT');
  const numericModuleId = moduleId ? Number(moduleId) : null;
  const [course, setCourse] = useState<Course | null>(null);
  const [module, setModule] = useState<ModuleDetail | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !numericModuleId) return;
    setLoading(true);
    Promise.all([api.moduleById(numericModuleId), api.lessonsForModule(numericModuleId)])
      .then(async ([moduleData, lessonData]) => {
        setModule(moduleData);
        setLessons(lessonData);

        // Fetch course details for breadcrumb
        if (moduleData.courseOfferingId) {
          const courseData = await api.courseById(moduleData.courseOfferingId);
          setCourse(courseData);
        }
      })
      .catch((error) => console.error('Failed to load module data', error))
      .finally(() => setLoading(false));
  }, [user?.id, numericModuleId]);

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
                <BreadcrumbPage>{module?.title || 'Module'}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h2 className="text-2xl font-bold mb-4">{module?.title || 'Lessons'}</h2>
          {loading ? (
            <div className="text-gray-500">Loading…</div>
          ) : lessons.length === 0 ? (
            <div className="text-gray-500">No lessons available yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {lessons.map((lesson) => (
                <button
                  key={lesson.id}
                  onClick={() => navigate(`/student/lesson/${lesson.id}`)}
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

