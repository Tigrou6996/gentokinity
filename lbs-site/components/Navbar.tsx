
import React, { useState, useEffect } from 'react';
import logoLBS from '../img/logo_LBS.png';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { session, user, profile, signOut } = useAuth();
  const isAdmin = profile?.role === 'admin' || (user as any)?.user_metadata?.role === 'admin';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Chiudi menu mobile sul cambio route
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await signOut();
      // navigate AFTER signOut resolves — auth state is now null
      navigate('/', { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/servizi', label: 'Servizi' },
    { path: '/offerte', label: 'Offerte 🇩🇪' },
    { path: '/datori-di-lavoro', label: 'Datori di Lavoro' },
    { path: '/chi-siamo', label: 'Chi Siamo' },
    { path: '/contatti', label: 'Contatti' },
  ];

  // Trasparente solo sulla home NON scrollata; su tutte le altre pagine sempre solido
  const onHero = !isScrolled && pathname === '/';

  return (
    <>
      <nav className={`fixed top-0 w-full z-[60] transition-all duration-300 ${
        isScrolled || pathname !== '/'
          ? 'bg-[#3D2045]/95 backdrop-blur-md border-b-4 border-[#3D2045] py-3 shadow-xl'
          : 'bg-transparent py-5'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex justify-between items-center">

          {/* LOGO */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="bg-white/10 backdrop-blur-md border-2 border-white/30 p-1.5 px-3 flex items-center gap-2 hover:bg-white/20 transition-all">
              <img
                src={logoLBS}
                alt="LBS Lavoro Business e Servizi in Germania"
                className="h-9 w-auto flex-shrink-0 transition-all duration-300"
              />
              <span className="text-white font-black text-xs tracking-wider uppercase hidden sm:inline-block">
                LBS
              </span>
            </div>
          </Link>

          {/* DESKTOP NAV - SPIGOLOSO */}
          <div className="hidden lg:flex items-center gap-1 bg-white/10 backdrop-blur-xl border-2 border-white/30 p-1 shadow-lg">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-xs font-bold tracking-wider uppercase px-3.5 py-1.5 transition-all duration-200 ${
                  pathname === link.path
                    ? 'bg-[#ffdf20] text-[#3D2045] font-black shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* TABLET NAV (md to lg) - slightly more compact */}
          <div className="hidden md:flex lg:hidden items-center gap-0.5 bg-white/10 backdrop-blur-xl border-2 border-white/30 p-1 shadow-lg">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-[11px] font-bold tracking-tight uppercase px-2 py-1.5 transition-all duration-200 ${
                  pathname === link.path
                    ? 'bg-[#ffdf20] text-[#3D2045] font-black shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {link.label === 'Datori di Lavoro' ? 'Datori' : link.label}
              </Link>
            ))}
          </div>

          {/* AUTH BUTTONS / RIGHT ACTIONS */}
          <div className="hidden md:flex items-center gap-3">
            {session ? (
              <>
                <Link
                  to={isAdmin ? '/admin' : '/dashboard'}
                  className="text-xs font-bold uppercase tracking-wider px-5 py-2 border-2 border-white/30 text-white hover:bg-white/15 transition-all flex items-center gap-2"
                >
                  <i className="fas fa-user text-[#ffdf20]"></i>
                  {isAdmin ? 'Admin' : 'Area'}
                </Link>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="text-xs font-bold uppercase tracking-wider px-4 py-2 border-2 border-white/20 text-white/80 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <i className={`fas ${isLoggingOut ? 'fa-spinner fa-spin' : 'fa-sign-out-alt'}`}></i>
                  <span>Esci</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-xs font-bold uppercase tracking-wider px-4 py-2 text-white/90 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
                >
                  Accedi
                </Link>
                <Link
                  to="/contatti"
                  className="text-xs font-black uppercase tracking-wider px-5 py-2.5 border-2 border-[#ffdf20] bg-[#ffdf20] text-[#3D2045] hover:bg-yellow-300 transition-all duration-200 shadow-[3px_3px_0px_#3D2045] flex items-center gap-2"
                >
                  <span>Candidati Ora</span>
                  <i className="fas fa-arrow-right text-[10px]"></i>
                </Link>
              </>
            )}
          </div>

          {/* MOBILE BUTTONS */}
          <div className="md:hidden flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="w-10 h-10 bg-white/10 border-2 border-white/30 flex items-center justify-center text-white"
            >
              <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'} text-sm`}></i>
            </button>
          </div>
        </div>
      </nav>

      {/* MOBILE MENU */}
      <div className={`fixed inset-0 z-[55] bg-[#6E4274] flex flex-col items-center justify-center gap-8 transition-all duration-300 md:hidden ${
        isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}>
        {navLinks.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={`text-4xl font-black uppercase tracking-tighter transition-colors ${
              pathname === link.path ? 'text-yellow-300' : 'text-white hover:text-yellow-300'
            }`}
          >
            {link.label}
          </Link>
        ))}

        {/* Mobile Auth */}
        {session ? (
          <>
            <Link
              to={isAdmin ? '/admin' : '/dashboard'}
              className="text-2xl font-black text-white/80 uppercase tracking-tight flex items-center gap-3"
            >
              <i className="fas fa-user text-yellow-300"></i>
              {isAdmin ? 'Pannello Admin' : 'Area Personale'}
            </Link>
            <button
              onClick={handleLogout}
              className="text-white/60 text-lg font-black uppercase tracking-widest flex items-center gap-2"
            >
              <i className="fas fa-sign-out-alt"></i> Esci
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="text-2xl font-black text-white/80 uppercase tracking-tight flex items-center gap-3"
            >
              <i className="fas fa-lock text-yellow-300"></i> Accedi
            </Link>
            <Link
              to="/contatti"
              className="bg-yellow-300 text-[#3D2045] border-4 border-white px-10 py-4 text-lg font-black uppercase tracking-widest mt-4"
            >
              Candidati Gratis
            </Link>
          </>
        )}
      </div>
    </>
  );
};

export default Navbar;
