import type { Route } from './+types/home';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import api from '../lib/api';
import type { Role, User } from '../lib/types';
import { useLocalUser } from '../hooks/useLocalUser';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'AI Tutor Playground' },
    { name: 'description', content: 'Vibrant AI learning playground for students & instructors' },
  ];
}

export default function Home() {
  const navigate = useNavigate();
  const { user, setUser } = useLocalUser();
  const [role, setRole] = useState<Role>(user?.role ?? 'STUDENT');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(user?.id ?? null);

  useEffect(() => {
    setLoading(true);
    api
      .users(role)
      .then((data) => setUsers(data))
      .finally(() => setLoading(false));
  }, [role]);

  const onEnter = () => {
    const u = users.find((x) => x.id === selected);
    if (!u) return;
    setUser({ id: u.id, name: u.name, role: u.role });
    navigate(u.role === 'STUDENT' ? '/student' : '/instructor');
  };

  const gradients = useMemo(
    () => ({
      STUDENT: 'from-fuchsia-500 via-pink-500 to-rose-500',
      INSTRUCTOR: 'from-cyan-500 via-sky-500 to-indigo-500',
    }),
    []
  );

  return (
    <main className="min-h-dvh bg-gradient-to-br from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="container mx-auto px-4 py-16">
        <header className="text-center mb-10">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">
            AI Tutor Playground
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-3 max-w-2xl mx-auto">
            Log in as a Student or Instructor, explore vibrant courses, topics, and interactive question lists with a gentle AI study guide.
          </p>
        </header>

        <section className="max-w-3xl mx-auto">
          <div className="flex justify-center mb-6">
            <div className="inline-flex rounded-full p-1 bg-gray-100 dark:bg-gray-800">
              {(['STUDENT', 'INSTRUCTOR'] as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                    role === r
                      ? 'bg-gradient-to-r text-white shadow ' + gradients[r]
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur rounded-3xl border border-gray-200/60 dark:border-gray-800 p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-2">Choose a {role.toLowerCase()}</h2>
            {loading ? (
              <div className="animate-pulse text-gray-500">Loading users…</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {users.map((u) => (
                  <label
                    key={u.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      selected === u.id
                        ? 'border-transparent ring-2 ring-offset-2 ring-purple-500 dark:ring-offset-gray-900 bg-purple-50 dark:bg-purple-950/40'
                        : 'border-gray-200 dark:border-gray-800 hover:border-purple-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="user"
                      className="sr-only"
                      checked={selected === u.id}
                      onChange={() => setSelected(u.id)}
                    />
                    <div
                      className={`w-10 h-10 rounded-full bg-gradient-to-br ${
                        u.role === 'STUDENT'
                          ? 'from-fuchsia-500 to-rose-500'
                          : 'from-sky-500 to-indigo-500'
                      }`}
                    />
                    <div>
                      <div className="font-semibold">{u.name}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </div>
                    <div className="ml-auto text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                      {u.role}
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={onEnter}
                disabled={!selected}
                className="px-6 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed shadow hover:shadow-md transition"
              >
                Enter as {role.toLowerCase()}
              </button>
            </div>
          </div>
        </section>

        <footer className="text-center mt-12 text-sm text-gray-500">
          Tip: You can change role anytime by returning home.
        </footer>
      </div>
    </main>
  );
}
