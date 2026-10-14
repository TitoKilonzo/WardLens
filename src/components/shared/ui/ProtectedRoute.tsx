import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { LoadingState } from './LoadingState';
import type { Role } from '../../../types';
export function ProtectedRoute({ roles }: { roles?:Role[] }) {
  const { user, loading } = useAuth(); const location = useLocation();
  if (loading) return <LoadingState label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
