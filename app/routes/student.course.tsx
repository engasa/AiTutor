import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import Nav from '../components/Nav';
import api from '../lib/api';
import type { Topic } from '../lib/types';
import { requireUser } from '../hooks/useLocalUser';

export default function StudentCourseTopics() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const user = requireUser('STUDENT');
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !courseId) return;
    setLoading(true);
    api
      .topicsForCourse(Number(courseId))
      .then((data) => setTopics(data))
      .finally(() => setLoading(false));
  }, [courseId]);

  if (!user) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-purple-50 via-rose-50 to-orange-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
      <Nav />
      <div className="container mx-auto px-4 py-8">
        <button onClick={() => navigate(-1)} className="text-sm text-gray-600 hover:underline">
          ← Back
        </button>
        <h2 className="text-2xl font-bold mb-4">Topics</h2>
        {loading ? (
          <div className="text-gray-500">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {topics.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/student/topic/${t.id}`)}
                className="text-left p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/60 hover:shadow-md transition group"
              >
                <div className="font-semibold group-hover:underline">{t.name}</div>
                <div className="text-sm text-gray-500">{t.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
