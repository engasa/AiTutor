import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Nav from '../components/Nav';
import ProtectedRoute from '../components/ProtectedRoute';
import api from '../lib/api';
import type { Course } from '../lib/types';
import { requireUser } from '../hooks/useLocalUser';

export default function StudentHome() {
  const navigate = useNavigate();
  const user = requireUser('STUDENT');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api
      .coursesForUser(user.id)
      .then((data) => setCourses(data))
      .catch((error) => {
        console.error('Failed to load courses:', error);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  return (
    <ProtectedRoute role="STUDENT">
      <div className="min-h-dvh bg-gradient-to-br from-purple-50 via-rose-50 to-orange-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
        <Nav />
        <div className="container mx-auto px-4 py-8">
          <h2 className="text-2xl font-bold mb-4">My Courses</h2>
          {loading ? (
            <div className="text-gray-500">Loading…</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {courses.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/student/courses/${c.id}`)}
                  className="text-left p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/60 hover:shadow-md transition group"
                >
                  <div
                    className="w-12 h-12 rounded-xl mb-3"
                    style={{ background: c.color || '#8B5CF6' }}
                  />
                  <div className="font-semibold group-hover:underline">{c.title}</div>
                  <div className="text-sm text-gray-500">{c.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

