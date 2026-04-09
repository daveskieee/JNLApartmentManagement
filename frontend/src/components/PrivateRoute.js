import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

const normalizeRole = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'maintenance' || normalized === 'maintenance_staff') {
    return 'maintenance';
  }
  return normalized;
};

const PrivateRoute = ({ children, role }) => {
  const { user, token, isLoading } = useContext(AuthContext);
  
  // Check localStorage as fallback
  const localToken = localStorage.getItem('token');
  const localUserStr = localStorage.getItem('user');
  let parsedLocalUser = null;
  
  try {
    parsedLocalUser = localUserStr ? JSON.parse(localUserStr) : null;
  } catch (e) {
    console.error('Failed to parse user from localStorage:', e);
  }
  
  const finalToken = token || localToken;
  const finalUser = user || parsedLocalUser;

  // Debug logging
  console.log('PrivateRoute check:', { 
    hasToken: !!finalToken, 
    hasUser: !!finalUser,
    userRole: finalUser?.role,
    requiredRole: role,
    isLoading
  });

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!finalToken || !finalUser) {
    console.log('Redirecting to login: no token or user');
    return <Navigate to="/login" />;
  }

  // Check role - handle case where role might not match exactly
  if (role) {
    const userRole = normalizeRole(finalUser.role || finalUser.userRole);
    const requiredRole = normalizeRole(role);
    const roleMatch = userRole === requiredRole;
    console.log('Role check:', userRole, 'vs', role, 'match:', roleMatch);
    if (!roleMatch) {
      console.log('Redirecting to login: role mismatch');
      return <Navigate to="/login" />;
    }
  }

  return children;
};

export default PrivateRoute;
