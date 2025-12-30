import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Register service worker for PWA
// In development, unregister any existing service workers to prevent caching issues
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    // Check if we're in development mode
    const isDev = import.meta.env.DEV || 
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1';
    
    if (isDev) {
      // In development, unregister existing service workers to prevent stale cache issues
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          console.log('Unregistered old service worker in dev mode');
        }
      } catch (error) {
        console.warn('Error unregistering service workers:', error);
      }
    } else {
      // In production, register the service worker
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          console.log('Service Worker registered successfully:', registration.scope);
        })
        .catch((error) => {
          console.log('Service Worker registration failed:', error);
        });
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
