import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import AppGate from './AppGate.jsx';
import Join from './components/Join.jsx';
import JoinByCode from './components/JoinByCode.jsx';
import IOSInstallPrompt from './components/IOSInstallPrompt.jsx';
import AndroidInstallPrompt from './components/AndroidInstallPrompt.jsx';
import { registerServiceWorker } from './lib/push.js';
import { AuthProvider } from './lib/auth.jsx';
import './index.css';

// Register the push service worker once the page has loaded (idempotent; it has
// no fetch handler so it can't affect caching/offline behaviour).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { registerServiceWorker(); });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Production app at the root — prompts Google sign-in if logged out */}
          <Route path="/" element={<AppGate />} />
          <Route path="/app" element={<AppGate />} />
          {/* Public demo — no login, in-memory sandbox */}
          <Route path="/demo" element={<App />} />
          {/* Invite link — sign in (if needed) then join the group */}
          <Route path="/join/:token" element={<Join />} />
          {/* picklecheck.in/<CODE> — short group-code join. Reserved/short paths
              and bad codes bounce to the app inside the component. */}
          <Route path="/:code" element={<JoinByCode />} />
          {/* Unknown paths fall back to the app (which prompts login) */}
          <Route path="*" element={<AppGate />} />
        </Routes>
        <IOSInstallPrompt />
        <AndroidInstallPrompt />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
