import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';
import '@fontsource-variable/inter/wght.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import './styles.css';

// Native shells (Android via Capacitor, desktop via Electron) bundle every file,
// so the offline service worker is only needed for the web/PWA version.
const isNative = Capacitor.isNativePlatform() || location.protocol === 'app:';
if (!isNative && 'serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}

// The service worker (web) and the Android shell add the cross-origin isolation headers that
// enable the multi-threaded engine. A page loaded before they were in place isn't isolated yet,
// so reload it once per session.
const reloadOnceForIsolation = () => {
  try {
    if (crossOriginIsolated || sessionStorage.getItem('dc:coi-reload')) return;
    sessionStorage.setItem('dc:coi-reload', '1');
  } catch {
    return; // no storage → never risk a reload loop
  }
  location.reload();
};
if (typeof crossOriginIsolated !== 'undefined' && !crossOriginIsolated) {
  if (Capacitor.getPlatform() === 'android') reloadOnceForIsolation();
  else if (!isNative && 'serviceWorker' in navigator) {
    if (navigator.serviceWorker.controller) reloadOnceForIsolation();
    else navigator.serviceWorker.addEventListener('controllerchange', reloadOnceForIsolation, { once: true });
  }
}
document.documentElement.dataset.platform = Capacitor.getPlatform() === 'web' && location.protocol === 'app:' ? 'desktop' : Capacitor.getPlatform();

createRoot(document.getElementById('root')!).render(<App />);
