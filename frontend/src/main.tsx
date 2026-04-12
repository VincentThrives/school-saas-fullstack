import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

async function enableMocking() {
  // Only enable MSW mocks if VITE_USE_MOCKS=true
  // When real backend is running, skip mocks so requests go to the proxy
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true') {
    const { worker } = await import('./mocks/browser');
    return worker.start({
      onUnhandledRequest: 'bypass',
    });
  }
  return Promise.resolve();
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
