import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

export default function ProtectedRoute({ children, redirectTo = '/login' }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', fontSize: 16 }}>
        Checking authentication...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
