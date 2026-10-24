import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Navbar from './components/Navbar';
import Footer from './components/Footer';

import Home from './pages/Home';
import Services from './pages/Services';
import About from './pages/About';
import Contact from './pages/Contact';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import JobOffers from './pages/JobOffers';
import JobOfferDetail from './pages/JobOfferDetail';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import DatoriDiLavoro from './pages/DatoriDiLavoro';
import CookieBanner from './components/CookieBanner';
import PrivacyPolicy from './pages/PrivacyPolicy';
import CookiePolicy from './pages/CookiePolicy';
import TerminiCondizioni from './pages/TerminiCondizioni';
import NoteLegali from './pages/NoteLegali';
import Candidati from './pages/Candidati';


// ─── Smart dashboard router ────────────────────────────────────────────────────
const DashboardRouter: React.FC = () => {
  const { profile, loading } = useAuth();
  // Aspetta che il profilo sia caricato prima di decidere quale dashboard mostrare.
  // Senza questo controllo, se il profilo è ancora null (caricamento lento),
  // l'admin verrebbe mostrato al pannello utente per errore.
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', gap: '16px' }}>
      <div style={{ width: '48px', height: '48px', border: '5px solid #6E4274', borderTop: '5px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: '#6E4274', fontWeight: 900, fontSize: '12px', letterSpacing: '0.25em', textTransform: 'uppercase', margin: 0 }}>Caricamento...</p>
    </div>
  );
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />;
  return <UserDashboard />;
};

// ─── Scroll to top + Reveal animations on route change ────────────────────────
const RevealObserver: React.FC = () => {
  const location = useLocation();
  useEffect(() => {
    // Riporta la pagina in cima ad ogni cambio di route
    window.scrollTo({ top: 0, behavior: 'instant' });

    const observer = new IntersectionObserver(
      (entries) => entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('active');
      }),
      { threshold: 0.1 }
    );
    const timer = setTimeout(() => {
      document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    }, 50);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [location.pathname]);
  return null;
};

// ─── All routes ───────────────────────────────────────────────────────────────
const AppRoutes: React.FC = () => (
  <>
    <RevealObserver />
    <CookieBanner />
    <Routes>
      {/* Login & Reset Password — no Navbar/Footer */}
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Google Ads Landing Pages — Focalizzate ad alta conversione */}
      <Route path="/candidati" element={<Candidati />} />
      <Route path="/lavoro-germania" element={<Candidati />} />
      <Route path="/candidatura" element={<Candidati />} />
      <Route path="/ads" element={<Candidati />} />

      {/* Dashboard: protected, auto-routes admin→/admin, user→UserDashboard */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardRouter />
          </ProtectedRoute>
        }
      />

      {/* Admin panel — protected, admin role required */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Public pages with Navbar + Footer */}
      <Route
        path="/*"
        element={
          <>
            <Navbar />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/servizi" element={<Services />} />
              <Route path="/offerte" element={<JobOffers />} />
              <Route path="/offerte/:slug" element={<JobOfferDetail />} />
              <Route path="/chi-siamo" element={<About />} />
              <Route path="/contatti" element={<Contact />} />
              <Route path="/datori-di-lavoro" element={<DatoriDiLavoro />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/cookie-policy" element={<CookiePolicy />} />
              <Route path="/termini-e-condizioni" element={<TerminiCondizioni />} />
              <Route path="/note-legali" element={<NoteLegali />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Footer />
          </>
        }
      />
    </Routes>
  </>
);

// ─── Root App ──────────────────────────────────────────────────────────────────
const App: React.FC = () => (
  <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
