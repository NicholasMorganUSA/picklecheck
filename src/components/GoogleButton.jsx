import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';

// Load the Google Identity Services script once.
let gisPromise = null;
function loadGis() {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.getElementById('gis-script');
    if (existing) { existing.addEventListener('load', () => resolve()); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.id = 'gis-script';
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
  return gisPromise;
}

// Renders Google's official sign-in button via GIS. Because the flow runs on our
// own origin (not Supabase's), the Google consent screen shows our domain.
// On success we hand the ID token to Supabase; onAuthStateChange does the rest.
export default function GoogleButton({ onError }) {
  const ref = useRef(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.warn('[auth] VITE_GOOGLE_CLIENT_ID is not set — Google button hidden.');
      return;
    }
    let cancelled = false;
    loadGis().then(() => {
      if (cancelled || !ref.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp) => {
          const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: resp.credential });
          if (error) {
            console.error('[auth] signInWithIdToken error:', error.message);
            onError?.(error.message);
          }
          // success -> AuthProvider's onAuthStateChange takes over
        },
      });
      ref.current.innerHTML = '';
      window.google.accounts.id.renderButton(ref.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'left',
        width: 320,
      });
    });
    return () => { cancelled = true; };
  }, [onError]);

  return <div ref={ref} style={{ display: 'flex', justifyContent: 'center', minHeight: '44px' }} />;
}
