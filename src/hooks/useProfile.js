import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';

// Loads the current user's profiles row (auto-created on first sign-in by the
// handle_new_user trigger) and exposes an updater for the editable name.
export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.warn('[profile] load error:', error.message);
        setProfile(data ?? null);
        setLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  const updateName = useCallback(async (full_name) => {
    if (!user) return { error: new Error('Not signed in') };
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name })
      .eq('id', user.id)
      .select()
      .single();
    if (error) {
      console.warn('[profile] name update error:', error.message);
    } else if (data) {
      setProfile(data);
    }
    return { data, error };
  }, [user]);

  return { profile, loading, updateName };
}
