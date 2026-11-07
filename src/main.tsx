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
document.documentElement.dataset.platform = Capacitor.getPlatform() === 'web' && location.protocol === 'app:' ? 'desktop' : Capacitor.getPlatform();

createRoot(document.getElementById('root')!).render(<App />);
