import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import Nav from '../components/Nav';
import ProtectedRoute from '../components/ProtectedRoute';
import api from '../lib/api';
import type { QuestionList } from '../lib/types';
import { requireUser } from '../hooks/useLocalUser';

export default function InstructorTopicLists() {
  const navigate = useNavigate();
  const { topicId } = useParams();
  const user = requireUser('INSTRUCTOR');
  const [lists, setLists] = useState<QuestionList[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const refresh = () => {
    if (!topicId) return;
    setLoading(true);
    api
      .listsForTopic(Number(topicId))
      .then((data) => setLists(data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user || !topicId) return;
    refresh();
  }, [topicId]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!topicId || !title.trim()) return;
    setCreating(true);
    try {
      await api.createList(title.trim(), Number(topicId));
      setTitle('');
      refresh();
    } finally {
      setCreating(false);
    }
  };

  return (
    <ProtectedRoute role="INSTRUCTOR">
      <div className="min-h-dvh bg-gradient-to-br from-sky-50 via-indigo-50 to-fuchsia-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900">
        <Nav />
        <div className="container mx-auto px-4 py-8">
          <button onClick={() => navigate(-1)} className="text-sm text-gray-600 hover:underline">
            ← Back
          </button>
          <h2 className="text-2xl font-bold mb-4">Question Lists</h2>

          <form onSubmit={onCreate} className="mb-6 flex gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="New list title…"
              className="flex-1 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
            />
            <button
              disabled={creating || !title.trim()}
              className="px-4 py-2 rounded-xl text-white font-semibold bg-gradient-to-r from-sky-600 to-indigo-600 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Create List'}
            </button>
          </form>

          {loading ? (
            <div className="text-gray-500">Loading…</div>
          ) : lists.length === 0 ? (
            <div className="text-gray-500">No lists yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {lists.map((l) => (
                <button
                  key={l.id}
                  onClick={() => navigate(`/instructor/list/${l.id}`)}
                  className="text-left p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/60 hover:shadow-md transition group"
                >
                  <div className="font-semibold group-hover:underline">{l.title}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
