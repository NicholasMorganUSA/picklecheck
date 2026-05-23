import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.jsx';
import AppGate from './AppGate.jsx';
import { AuthProvider } from './lib/auth.jsx';
import './index.css';

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
          {/* Unknown paths fall back to the app (which prompts login) */}
          <Route path="*" element={<AppGate />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
