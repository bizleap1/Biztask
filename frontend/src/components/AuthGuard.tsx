import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const normalizeRole = (role: string) =>
  role === 'DevEmployee' || role === 'MediaEmployee' ? 'Employee' : role;

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, allowedRoles }) => {
  const userStr = sessionStorage.getItem('user');
  const location = useLocation();

  if (!userStr) {
    return <Navigate to="/login" replace />;
  }

  let user: any;
  try {
    user = JSON.parse(userStr);
  } catch {
    sessionStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }

  // If user must change password, only allow them on the change-password page
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  // If they are on change-password but don't need to change it, redirect to dashboard
  if (!user.mustChangePassword && location.pathname === '/change-password') {
    return <Navigate to="/dashboard" replace />;
  }

  // Check role-based access (supports both canonical and legacy employee roles)
  if (allowedRoles) {
    const normalized = normalizeRole(user.role);
    if (!allowedRoles.includes(user.role) && !allowedRoles.includes(normalized)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};
