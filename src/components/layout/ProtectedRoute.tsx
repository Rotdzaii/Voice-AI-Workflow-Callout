import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext';
import LoadingScreen from '../ui/LoadingScreen';

interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

export default function ProtectedRoute({ children, redirectTo = '/login' }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <LoadingScreen
        label="Đang chuẩn bị workspace..."
        subLabel="Vui lòng chờ trong giây lát"
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
