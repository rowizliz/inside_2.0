import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();

  console.log('ProtectedRoute:', { currentUser });

  // Cho phép truy cập các đường dẫn public đặc biệt (như reset-password) mà không redirect về /login
  const isPublicRecoveryPath =
    typeof window !== 'undefined' &&
    window.location &&
    (window.location.pathname === '/reset-password' ||
     window.location.pathname === '/signup' ||
     window.location.pathname === '/login');

  if (!currentUser && !isPublicRecoveryPath) {
    console.log('Redirecting to login');
    return <Navigate to="/login" />;
  }

  console.log('Rendering protected content');
  return children;
}