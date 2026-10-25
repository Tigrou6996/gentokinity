
import React, { useState, useEffect } from 'react';
import logoLBS from '../img/logo_LBS-192.png';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navLinks = [
  { path: '/', label: 'Home' },
  { path: '/servizi', label: 'Servizi' },
  { path: '/offerte', label: 'Offerte di lavoro' },
  { path: '/datori-di-lavoro', label: 'Per le aziende' },
  { path: '/chi-siamo', label: 'Chi siamo' },
  { path: '/contatti', label: 'Contatti' },
];

const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { session, user, profile, signOut } = useAuth();
  const isAdmin = profile?.role === 'admin' || (user as any)?.user_metadata?.role === 'admin';

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Chiudi menu mobile sul cambio route
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Blocca lo scroll della pagina quando il menu mobile è aperto
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

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

  const isActive = (path: string) => (path === '/' ? pathname === '/' : pathname.startsWith(path));

  // Trasparente solo sulla home non scrollata (hero scuro); altrove barra chiara
  const onHero = !isScrolled && pathname === '/' && !isMobileMenuOpen;

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-[60] border-b transition-colors duration-300 ${
          onHero ? 'bg-transparent border-white/15' : 'bg-white/95 backdrop-blur border-line'
        }`}
      >
        <nav aria-label="Navigazione principale" className="container-x relative h-16 flex items-center justify-between gap-6">
          {/* LOGO */}
          <Link to="/" className="flex items-center gap-2.5" aria-label="LBS — Home">
            <img src={logoLBS} alt="" className="h-9 w-9 flex-shrink-0" width={36} height={36} />
            <span className="leading-none">
              <span className={`block font-semibold text-[15px] tracking-tight ${onHero ? 'text-white' : 'text-plum-800'}`}>
                LBS Work
              </span>
              <span className={`hidden sm:block text-[11px] font-medium mt-0.5 ${onHero ? 'text-white/60' : 'text-ink-soft'}`}>
                Lavoro &amp; servizi in Germania
              </span>
            </span>
          </Link>

          {/* DESKTOP NAV */}
          <ul className="hidden lg:flex items-stretch self-stretch gap-7">
            {navLinks.map(link => (
              <li key={link.path} className="flex">
                <Link
                  to={link.path}
                  aria-current={isActive(link.path) ? 'page' : undefined}
                  className={`relative inline-flex items-center text-sm font-medium transition-colors ${ onHero ? isActive(link.path) ? 'text-white' : 'text-white/70 hover:text-white' : isActive(link.path) ? 'text-plum-800' : 'text-ink-soft hover:text-plum-800' }`}
                >
                  {link.label}
                  {isActive(link.path) && (
                    <span className={`absolute inset-x-0 -bottom-px h-0.5 ${onHero ? 'bg-sun-400' : 'bg-plum-600'}`} />
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {/* AZIONI */}
          <div className="hidden md:flex items-center gap-2">
            {session ? (
              <>
                <Link
                  to={isAdmin ? '/admin' : '/dashboard'}
                  className={`btn btn-sm ${onHero ? 'btn-ghost-light' : 'btn-outline'}`}
                >
                  <i className="fas fa-user-circle" />
                  {isAdmin ? 'Pannello admin' : 'Area personale'}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  aria-label="Esci"
                  className={`btn btn-sm !px-3 ${onHero ? 'btn-ghost-light' : 'btn-outline'}`}
                >
                  <i className={`fas ${isLoggingOut ? 'fa-spinner fa-spin' : 'fa-sign-out-alt'}`} />
                  <span className="hidden xl:inline">Esci</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className={`btn btn-sm !bg-transparent ${onHero ? 'text-white/85 hover:text-white' : 'text-plum-800 hover:text-plum-600'}`}
                >
                  Accedi
                </Link>
                <Link to="/contatti" className="btn btn-sm btn-accent">
                  Candidati ora <i className="fas fa-arrow-right text-[11px]" />
                </Link>
              </>
            )}
          </div>

          {/* MOBILE */}
          <div className="flex md:hidden items-center gap-2">
            {!session && (
              <Link to="/contatti" className="btn btn-sm btn-accent !px-4">Candidati</Link>
            )}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(o => !o)}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMobileMenuOpen ? 'Chiudi menu' : 'Apri menu'}
              className={`h-11 w-11 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${ onHero ? 'border-white/25 text-white' : 'border-line text-plum-800' }`}
            >
              <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'}`} />
            </button>
          </div>

          {/* TABLET: link compatti sotto lg */}
          <div className={`hidden md:flex lg:hidden absolute left-0 right-0 top-full justify-center border-t border-b ${onHero ? 'border-white/15' : 'bg-white/95 border-line'}`}>
            <ul className="flex gap-6 h-11 items-center">
              {navLinks.map(link => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className={`inline-flex text-[13px] font-medium ${ onHero ? isActive(link.path) ? 'text-white' : 'text-white/70' : isActive(link.path) ? 'text-plum-600' : 'text-ink-soft' }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </header>

      {/* MOBILE MENU */}
      <div
        id="mobile-menu"
        className={`fixed inset-0 z-[55] md:hidden bg-paper transition-all duration-300 ${ isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none' }`}
      >
        <div className="h-full overflow-y-auto pt-24 pb-8 px-5 flex flex-col">
          <ul className="flex flex-col">
            {navLinks.map((link, i) => (
              <li key={link.path} className="border-b border-line">
                <Link
                  to={link.path}
                  className={`flex items-center justify-between py-4 font-semibold text-xl tracking-tight transition-all duration-500 ${ isActive(link.path) ? 'text-plum-600' : 'text-plum-800' } ${isMobileMenuOpen ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'}`}
                  style={{ transitionDelay: isMobileMenuOpen ? `${60 + i * 40}ms` : '0ms' }}
                >
                  {link.label}
                  <i className="fas fa-arrow-right text-sm text-plum-300" />
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-8 flex flex-col gap-3">
            {session ? (
              <>
                <Link to={isAdmin ? '/admin' : '/dashboard'} className="btn btn-lg btn-primary w-full">
                  <i className="fas fa-user-circle" /> {isAdmin ? 'Pannello admin' : 'Area personale'}
                </Link>
                <button type="button" onClick={handleLogout} disabled={isLoggingOut} className="btn btn-lg btn-outline w-full">
                  <i className={`fas ${isLoggingOut ? 'fa-spinner fa-spin' : 'fa-sign-out-alt'}`} /> Esci
                </button>
              </>
            ) : (
              <>
                <Link to="/contatti" className="btn btn-lg btn-accent w-full">
                  Candidati gratis <i className="fas fa-arrow-right text-xs" />
                </Link>
                <Link to="/login" className="btn btn-lg btn-outline w-full">
                  <i className="fas fa-lock text-plum-400" /> Accedi
                </Link>
              </>
            )}
            <a href="tel:+393518818391" className="text-center text-sm text-ink-soft mt-2">
              Oppure chiamaci: <span className="font-semibold text-plum-800">+39 351 881 8391</span>
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
