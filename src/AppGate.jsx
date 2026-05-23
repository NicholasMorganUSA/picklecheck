import { useAuth } from './lib/auth.jsx';
import { useProfile } from './hooks/useProfile.js';
import SignIn from './components/SignIn.jsx';
import App from './App.jsx';

function Splash() {
  return (
    <div style={{
      minHeight: '100vh', background: '#08080c', color: 'rgba(255,255,255,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: '14px',
    }}>
      Loading&hellip;
    </div>
  );
}

// Gate for the real (authenticated) app:
//   auth loading   -> splash
//   no user        -> Google sign-in screen
//   profile loading -> splash
//   signed in      -> the app, fed a real `account` (vs the public /demo, which gets none)
export default function AppGate() {
  const { user, loading, signOut } = useAuth();
  const { profile, loading: profileLoading, updateName } = useProfile();

  if (loading) return <Splash />;
  if (!user) return <SignIn />;
  if (profileLoading) return <Splash />;

  const meta = user.user_metadata || {};
  const account = {
    user,
    email: user.email,
    name: profile?.full_name || meta.full_name || meta.name || user.email,
    avatarUrl: profile?.avatar_url || meta.avatar_url || null,
    isSuperadmin: !!profile?.is_superadmin,
    updateName,
    signOut,
  };

  return <App account={account} />;
}
