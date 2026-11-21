import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Safely register PWA service worker where supported (e.g. standalone/https)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  try {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        console.log('PWA: New content available.');
      },
      onOfflineReady() {
        console.log('PWA: App ready to work offline.');
      },
    });
  } catch (err) {
    console.debug('Service worker registration ignored:', err);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
