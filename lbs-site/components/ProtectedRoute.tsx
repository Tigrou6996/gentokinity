import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const Spinner = ({ label }: { label: string }) => (
  <div style={{
    minHeight: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-color)', gap: '20px',
  }}>
    <div style={{
      width: '56px', height: '56px',
      border: '5px solid var(--secondary)',
      borderTop: '5px solid var(--primary)',
      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    }} />
    <p style={{
      color: 'var(--primary)', fontWeight: 900, fontSize: '12px',
      letterSpacing: '0.25em', textTransform: 'uppercase',
      fontFamily: 'var(--font-inter)',
    }}>{label}</p>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const { session, profile, loading } = useAuth();

  // 1. Auth still initializing
  if (loading) return <Spinner label="Caricamento..." />;

  // 2. Not authenticated → login
  if (!session) return <Navigate to="/login" replace />;

  // 3. Admin route: wait for profile to resolve before checking role
  //    (profile is null briefly during async fetch — don't redirect prematurely)
  if (requireAdmin) {
    if (profile === null) {
      // Profile still loading — show spinner instead of wrong redirect
      return <Spinner label="Verifica accesso..." />;
    }
    if (profile.role !== 'admin') {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
