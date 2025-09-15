import type { Route } from './+types/home';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import api from '../lib/api';
import type { User } from '../lib/types';
import { useLocalUser } from '../hooks/useLocalUser';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'AI Tutor - Login' },
    { name: 'description', content: 'Login to AI Tutor learning platform' },
  ];
}

export default function Home() {
  const navigate = useNavigate();
  const { saveAuth } = useLocalUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.login(email, password);
      const { token, user } = response;
      saveAuth(token, { id: user.id, name: user.name, role: user.role });
      navigate(user.role === 'STUDENT' ? '/student' : '/instructor');
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh bg-gradient-to-br from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="container mx-auto px-4 py-16">
        <header className="text-center mb-10">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">
            AI Tutor
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-3 max-w-2xl mx-auto">
            Login to access your personalized learning experience
          </p>
        </header>

        <section className="max-w-md mx-auto">
          <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur rounded-3xl border border-gray-200/60 dark:border-gray-800 p-8 shadow-sm">
            <form onSubmit={onLogin} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter your password"
                  required
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed shadow hover:shadow-md transition"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <div className="mt-8 text-center text-sm text-gray-500">
              <p className="mb-2">Demo credentials:</p>
              <div className="space-y-1 text-xs">
                <p><strong>Student:</strong> student@example.com / student123</p>
                <p><strong>Instructor:</strong> instructor@example.com / instructor123</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
