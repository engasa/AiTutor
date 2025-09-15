import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { requireUser } from '../hooks/useLocalUser';
import type { Role } from '../lib/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  role?: Role;
}

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const user = requireUser(role);

  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  if (!user) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex items-center justify-center">
        <div className="text-gray-500">Redirecting to login...</div>
      </div>
    );
  }

  return <>{children}</>;
}