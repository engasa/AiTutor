import { Link, useLocation, useNavigate } from 'react-router';
import { requireUser } from '../hooks/useLocalUser';

export default function Nav() {
  const navigate = useNavigate();
  const loc = useLocation();
  const u = requireUser();

  return (
    <div className="sticky top-0 z-40 backdrop-blur bg-white/60 dark:bg-gray-950/60 border-b border-gray-200/60 dark:border-gray-800">
      <div className="container mx-auto px-4 py-3 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500" />
          <span className="font-extrabold tracking-tight">AI Tutor</span>
        </Link>
        <nav className="ml-auto flex items-center gap-2 text-sm">
          {u && (
            <span className="hidden md:inline text-gray-500">
              {u.name} • {u.role}
            </span>
          )}
          {loc.pathname.startsWith('/student') && (
            <Link to="/student" className="px-3 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
              My Courses
            </Link>
          )}
          {loc.pathname.startsWith('/instructor') && (
            <Link to="/instructor" className="px-3 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
              Teaching
            </Link>
          )}
          <button
            onClick={() => navigate('/')}
            className="px-3 py-1 rounded-md bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow hover:shadow-md"
          >
            Switch Role
          </button>
        </nav>
      </div>
    </div>
  );
}

