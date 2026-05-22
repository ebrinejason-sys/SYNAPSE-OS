import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Subdomain-based routing: redirect to the right section based on hostname
// before React renders to avoid a flash of wrong content.
const host = window.location.hostname;
const path = window.location.pathname;

if (path === '/') {
  if (host.startsWith('demo.')) {
    window.history.replaceState(null, '', '/demo/doctor');
  } else if (host.startsWith('app.')) {
    window.history.replaceState(null, '', '/app/dashboard');
  } else if (host.startsWith('admin.')) {
    window.history.replaceState(null, '', '/admin');
  }
  // hospital subdomains e.g. mulago.synapseos.tech → /os/doctor/queue
  else if (host.includes('.synapseos.tech') && !host.startsWith('www.')) {
    window.history.replaceState(null, '', '/os/doctor/queue');
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
