// DeepChess desktop shell (Windows / macOS / Linux).
// Serves the built web app from dist/ through a privileged "app://" scheme so that
// Web Workers, WASM (Stockfish) and IndexedDB behave exactly like on the web.
const { app, BrowserWindow, protocol, shell, Menu, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const DIST = path.join(__dirname, '..', 'dist');
const isWebUrl = (u) => {
  try {
    const p = new URL(u).protocol;
    return p === 'https:' || p === 'http:';
  } catch {
    return false;
  }
};
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 380,
    minHeight: 600,
    backgroundColor: '#0b0e13',
    title: 'DeepChess',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, webviewTag: false, spellcheck: false },
  });
  win.once('ready-to-show', () => win.show());

  // External links (Chess.com / Lichess) open in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) {
      e.preventDefault();
      if (isWebUrl(url)) shell.openExternal(url); // never hand file:, smb:, ms-*: … to the OS
    }
  });

  win.loadURL('app://deepchess/');
  return win;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // The app needs no camera, microphone, location, notifications… → deny every permission request.
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  protocol.handle('app', async (request) => {
    const { pathname } = new URL(request.url);
    let rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
    let file = path.normalize(path.join(DIST, rel));
    if (file !== DIST && !file.startsWith(DIST + path.sep)) return new Response('Forbidden', { status: 403 });
    try {
      const stat = await fs.stat(file);
      if (stat.isDirectory()) file = path.join(file, 'index.html');
    } catch {
      file = path.join(DIST, 'index.html'); // SPA fallback
    }
    try {
      const body = await fs.readFile(file);
      const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
      return new Response(body, {
        headers: {
          'content-type': type,
          // Cross-origin isolation → SharedArrayBuffer → multi-threaded Stockfish.
          'cross-origin-opener-policy': 'same-origin',
          'cross-origin-embedder-policy': 'credentialless',
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  const win = createWindow();
  app.on('second-instance', () => {
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
