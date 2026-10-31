import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

import { sendLoginAlertEmail } from '../lib/emailService';

interface Profile {
  id: string;
  full_name: string | null;
  role: 'user' | 'admin';
  avatar_url: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, captchaToken?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string, currentPassword?: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getInitialProfile = (): Profile | null => {
  try {
    const raw = localStorage.getItem('lbs_cached_profile');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(getInitialProfile);
  const [loading, setLoading] = useState(true); // true until first auth event

  const fetchProfile = async (userId: string, currentUser?: User | null): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data) return data as Profile;

      // Fallback: se la riga in 'profiles' non esiste ancora (es. primo accesso Google)
      if (currentUser) {
        const fallbackProfile: Profile = {
          id: userId,
          full_name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || 'Utente',
          role: (currentUser.user_metadata?.role as any) || 'user',
          avatar_url: currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || null,
        };
        try {
          await supabase.from('profiles').upsert([fallbackProfile]);
        } catch (e) {
          console.warn('[Auth] Errore upsert profilo fallback:', e);
        }
        return fallbackProfile;
      }
    } catch (err) {
      console.warn('[Auth] Errore in fetchProfile:', err);
    }
    return null;
  };

  useEffect(() => {
    // ✅ Single source of truth: onAuthStateChange handles ALL state updates.
    // Se la pagina contiene parametri OAuth (?code= o #access_token=), mantieni loading=true
    // finché l'evento SIGNED_IN non ha completato lo scambio di sessione.
    const isOAuthCallback =
      typeof window !== 'undefined' &&
      (window.location.search.includes('code=') ||
       window.location.hash.includes('access_token='));

    let oauthTimeout: ReturnType<typeof setTimeout> | null = null;
    if (isOAuthCallback) {
      oauthTimeout = setTimeout(() => {
        setLoading(false);
      }, 6000);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (_event === 'INITIAL_SESSION' && !newSession && isOAuthCallback) {
          // Attendi che lo scambio OAuth avvenga
          return;
        }

        if (oauthTimeout) {
          clearTimeout(oauthTimeout);
          oauthTimeout = null;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          const sessionUser = newSession.user;
          // Se login con Google OAuth, invia notifica email di accesso
          if (_event === 'SIGNED_IN' && sessionUser.app_metadata?.provider === 'google' && sessionUser.email) {
            sendLoginAlertEmail({
              email: sessionUser.email,
              fullName: sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || null,
            }).catch(() => {});
          }

          // Le query Supabase non vanno attese dentro onAuthStateChange: il client
          // tiene il lock di sessione finché la callback non termina, quindi la
          // query restava bloccata fino al timeout (8s di caricamento). La
          // rimandiamo al tick successivo, fuori dalla callback.
          setTimeout(async () => {
            // Race fetchProfile against an 8-second timeout so loading never
            // hangs forever on slow networks / Supabase cold starts.
            const profilePromise = fetchProfile(sessionUser.id, sessionUser);
            const timeoutPromise = new Promise<null>(resolve =>
              setTimeout(() => resolve(null), 8000)
            );
            const p = await Promise.race([profilePromise, timeoutPromise]);
            if (p) {
              setProfile(p);
              try { localStorage.setItem('lbs_cached_profile', JSON.stringify(p)); } catch (e) {}
            } else {
              // Keep cached profile if network call timed out/failed, otherwise null
              setProfile(prev => prev || null);
            }
            setLoading(false); // Auth state is now resolved
          }, 0);
          return;
        }

        setProfile(null);
        try { localStorage.removeItem('lbs_cached_profile'); } catch (e) {}
        setLoading(false); // Auth state is now resolved
      }
    );

    return () => {
      if (oauthTimeout) clearTimeout(oauthTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string, captchaToken?: string): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        return { error: 'Email o password non corretti.' };
      }
      if (error.message.includes('Email not confirmed')) {
        return { error: 'Email non ancora confermata. Nel pannello Supabase (Authentication > Providers > Email) disattiva la spunta "Confirm email".' };
      }
      return { error: error.message };
    }

    // 📩 Invio asincrono notifica di sicurezza via email all'utente che accede
    if (data?.user?.email) {
      const userFullName = data.user.user_metadata?.full_name || profile?.full_name || null;
      sendLoginAlertEmail({
        email: data.user.email,
        fullName: userFullName,
      }).catch(err => {
        console.warn('[Auth] Impossibile inviare email di avviso accesso:', err);
      });
    }

    return { error: null };
  };

  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  };

  const resetPassword = async (email: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  };

  const updatePassword = async (newPassword: string, currentPassword?: string): Promise<{ error: string | null }> => {
    if (currentPassword) {
      if (!user?.email) {
        return { error: 'Sessione utente non valida.' };
      }
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) {
        return { error: 'La password attuale non è corretta.' };
      }
    }
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName: string, captchaToken?: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
    if (error) {
      if (error.message.includes('User already registered')) {
        return { error: 'Questa email è già registrata. Prova ad accedere.' };
      }
      return { error: error.message };
    }
    return { error: null };
  };

  const signOut = async () => {
    // ⚡ Optimistic update: clear local state immediately so the UI reacts
    // instantly (navbar shows login buttons right away) without waiting for
    // the async onAuthStateChange SIGNED_OUT event.
    setSession(null);
    setUser(null);
    setProfile(null);
    try { localStorage.removeItem('lbs_cached_profile'); } catch (e) {}

    // Then invalidate the token server-side (no scope: 'local' — that left
    // the JWT valid on Supabase servers, causing session restoration on refresh).
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signInWithGoogle, signUp, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
