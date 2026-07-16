import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// The reporting app follows Vite's documented recipe verbatim:
// https://vite.dev/guide/build#load-error-handling
// It reloads on ANY vite:preloadError. This handler makes the bug visible
// without reloading: it records the event on-page so you can read it.
window.addEventListener('vite:preloadError', (event) => {
  const log = document.getElementById('preload-error-log');
  if (log) {
    log.textContent = `vite:preloadError fired -> ${event.payload?.message}`;
    log.style.color = 'crimson';
  }
  // The documented recipe would do: window.location.reload()  <-- infinite loop
  event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
