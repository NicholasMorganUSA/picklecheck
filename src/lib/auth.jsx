import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

const AuthContext = createContext({ user: null, session: null, loading: true });

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const value = {
    user: session?.user ?? null,
    session,
    loading,
    signInWithGoogle: (redirectTo) => supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo || (window.location.origin + '/') },
    }),
    signUpWithEmail: (email, password, fullName) => supabase.auth.signUp({
      email,
      password,
      options: { data: fullName ? { full_name: fullName } : {} },
    }),
    signInWithEmail: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
