import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();

  console.log('ProtectedRoute:', { currentUser });

  if (!currentUser) {
    console.log('Redirecting to login');
    return <Navigate to="/login" />;
  }

  console.log('Rendering protected content');
  return children;
} 