// Renders PNG icons from the SVG sources for the PWA, Electron and Android.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const icon = join(root, 'public', 'icon.svg');
const maskable = join(root, 'public', 'icon-maskable.svg');
mkdirSync(join(root, 'build'), { recursive: true });
mkdirSync(join(root, 'assets'), { recursive: true });

const render = (src, size, out) => sharp(src, { density: 384 }).resize(size, size).png().toFile(join(root, out));

await Promise.all([
  render(icon, 192, 'public/pwa-192.png'),
  render(icon, 512, 'public/pwa-512.png'),
  render(maskable, 512, 'public/pwa-maskable-512.png'),
  render(maskable, 180, 'public/apple-touch-icon.png'),
  render(icon, 512, 'build/icon.png'), // electron-builder (converted to .ico)
  render(maskable, 1024, 'assets/icon-only.png'), // @capacitor/assets
  render(maskable, 1024, 'assets/icon-foreground.png'),
  sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#0d1117' } })
    .png()
    .toFile(join(root, 'assets/icon-background.png')),
  sharp({ create: { width: 2732, height: 2732, channels: 4, background: '#0d1117' } })
    .composite([{ input: await sharp(icon, { density: 384 }).resize(600, 600).png().toBuffer(), gravity: 'center' }])
    .png()
    .toFile(join(root, 'assets/splash.png')),
  sharp({ create: { width: 2732, height: 2732, channels: 4, background: '#0d1117' } })
    .composite([{ input: await sharp(icon, { density: 384 }).resize(600, 600).png().toBuffer(), gravity: 'center' }])
    .png()
    .toFile(join(root, 'assets/splash-dark.png')),
]);
console.log('[icons] PNG icons generated');
