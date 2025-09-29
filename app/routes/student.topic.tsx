import { Link, useLoaderData, useNavigate, useParams } from 'react-router';
import type { ClientLoaderFunctionArgs } from 'react-router';
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

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const moduleId = Number(params.moduleId);
  const [module, lessons] = await Promise.all([
    api.moduleById(moduleId),
    api.lessonsForModule(moduleId),
  ]);

  // Fetch course details for breadcrumb
  const course = await api.courseById(module.courseOfferingId);

  return { course, module, lessons };
}

export default function StudentModuleLessons() {
  const navigate = useNavigate();
  const { moduleId } = useParams();
  const user = requireUser('STUDENT');
  const { course, module, lessons } = useLoaderData<typeof clientLoader>();

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
          {lessons.length === 0 ? (
            <div className="text-gray-500">No lessons available yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {lessons.map((lesson: Lesson) => (
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

