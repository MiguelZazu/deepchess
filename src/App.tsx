import { useEffect, useState } from 'react';
import { GraduationCap, Home, Menu, Microscope, Puzzle, Settings as SettingsIcon, Users, Zap } from 'lucide-react';
import { useIsMobile } from './components/mobile';
import { HomeView } from './views/HomeView';
import { GamesView } from './views/GamesView';
import { AnalysisView } from './views/AnalysisView';
import { SettingsView } from './views/SettingsView';
import { TrainView, type TrainTab } from './views/TrainView';
import { OpeningsTab } from './views/train/OpeningsTab';
import { loadAccounts, loadSettings, saveAccounts, saveSettings } from './lib/storage';
import { configureEngines, useEngineState } from './engine/instances';
import { LookProvider } from './lib/look';
import { setLang } from './i18n';
import type { Account, GameSummary, Platform, Settings } from './lib/types';
import { t } from './i18n';
import { configureSound } from './lib/sound';

type Route =
  | { name: 'home' }
  | { name: 'games'; platform: Platform; username: string }
  | { name: 'analysis' }
  | { name: 'train'; tab: TrainTab }
  | { name: 'openings' }
  | { name: 'settings' };

function parseHash(): Route {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'games' && (parts[1] === 'chesscom' || parts[1] === 'lichess') && parts[2])
    return { name: 'games', platform: parts[1], username: parts[2] };
  if (parts[0] === 'analysis') return { name: 'analysis' };
  if (parts[0] === 'openings' || (parts[0] === 'train' && parts[1] === 'openings')) return { name: 'openings' };
  if (parts[0] === 'train') return { name: 'train', tab: parts[1] === 'rush' ? 'rush' : 'puzzles' };
  if (parts[0] === 'settings') return { name: 'settings' };
  return { name: 'home' };
}

function toHash(r: Route) {
  if (r.name === 'games') return `#/games/${r.platform}/${encodeURIComponent(r.username)}`;
  if (r.name === 'home') return '#/';
  if (r.name === 'train') return `#/train/${r.tab}`;
  return `#/${r.name}`;
}

function loadCurrentGame(): { game: GameSummary | null; perspective?: string } {
  try {
    const raw = sessionStorage.getItem('dc:current');
    return raw ? JSON.parse(raw) : { game: null };
  } catch {
    return { game: null };
  }
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const [accounts, setAccounts] = useState<Account[]>(loadAccounts);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [current, setCurrent] = useState(loadCurrentGame);
  const engine = useEngineState();
  const mobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  // The language is global; setting it during render makes every child use it immediately.
  setLang(settings.language);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => configureSound(settings.sound), [settings.sound]);

  // (Re)create the engines whenever the engine selection changes; also warms them up.
  useEffect(() => {
    configureEngines({ id: settings.engine, threads: settings.threads, hashMb: settings.hashMb });
  }, [settings.engine, settings.threads, settings.hashMb]);

  const navigate = (r: Route) => {
    const h = toHash(r);
    setMenuOpen(false);
    if (location.hash !== h) location.hash = h;
    else setRoute(r);
    window.scrollTo({ top: 0 });
  };

  const updateSettings = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };

  const addAccount = (a: Account) => {
    const next = [a, ...accounts.filter((x) => !(x.platform === a.platform && x.username.toLowerCase() === a.username.toLowerCase()))];
    setAccounts(next);
    saveAccounts(next);
  };
  const removeAccount = (a: Account) => {
    const next = accounts.filter((x) => !(x.platform === a.platform && x.username === a.username));
    setAccounts(next);
    saveAccounts(next);
  };

  const analyze = (game: GameSummary | null, perspective?: string) => {
    const c = { game, perspective };
    setCurrent(c);
    try {
      sessionStorage.setItem('dc:current', JSON.stringify(c));
    } catch {
      /* ignore */
    }
    navigate({ name: 'analysis' });
  };

  const primary = accounts[0];
  const nav = [
    { id: 'home', get label() { return t('Inicio'); }, icon: Home, onClick: () => navigate({ name: 'home' }), active: route.name === 'home' },
    {
      id: 'games',
      get label() { return t('Partidas'); },
      icon: Users,
      onClick: () => (primary ? navigate({ name: 'games', platform: primary.platform, username: primary.username }) : navigate({ name: 'home' })),
      active: route.name === 'games',
    },
    { id: 'analysis', get label() { return t('Análisis'); }, icon: Microscope, onClick: () => navigate({ name: 'analysis' }), active: route.name === 'analysis' },
    {
      id: 'train',
      get label() { return t('Problemas'); },
      icon: Puzzle,
      onClick: () => navigate({ name: 'train', tab: route.name === 'train' ? route.tab : 'puzzles' }),
      active: route.name === 'train' && (!mobile || route.tab === 'puzzles'),
    },
    {
      id: 'rush',
      mobileOnly: true,
      get label() { return t('Contrarreloj'); },
      icon: Zap,
      onClick: () => navigate({ name: 'train', tab: 'rush' }),
      active: route.name === 'train' && route.tab === 'rush',
    },
    { id: 'openings', get label() { return t('Aperturas'); }, icon: GraduationCap, onClick: () => navigate({ name: 'openings' }), active: route.name === 'openings' },
    { id: 'settings', get label() { return t('Ajustes'); }, icon: SettingsIcon, onClick: () => navigate({ name: 'settings' }), active: route.name === 'settings' },
  ];

  const desktopNav = nav.filter((n) => !('mobileOnly' in n));
  const title = nav.find((n) => n.active)?.label ?? 'DeepChess';

  return (
    <LookProvider appearance={settings.appearance}>
    <div className="app">
      {mobile && (
        <header className="m-topbar">
          <button className="icon-btn m-burger" onClick={() => setMenuOpen(!menuOpen)} aria-label={t('Menú')} aria-expanded={menuOpen}>
            <Menu size={22} />
          </button>
          <span className="m-title">{title}</span>
          <div id="m-topbar-slot" className="m-topbar-slot" />
        </header>
      )}
      {mobile && menuOpen && (
        <div className="m-menu-backdrop" onClick={() => setMenuOpen(false)}>
          <nav className="m-menu" aria-label={t('Principal')} onClick={(e) => e.stopPropagation()}>
            <div className="m-menu-brand">
              <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={28} height={28} />
              <span className="brand-name">
                {t('Deep')}<b>{t('Chess')}</b>
              </span>
            </div>
            {nav.map((n) => (
              <button key={n.id} className={`nav-item ${n.active ? 'active' : ''}`} onClick={n.onClick}>
                <n.icon size={20} />
                <span>{n.label}</span>
              </button>
            ))}
            {accounts.length > 0 && <div className="nav-section">{t('Cuentas')}</div>}
            {accounts.map((a) => (
              <button
                key={`${a.platform}:${a.username}`}
                className="nav-account"
                onClick={() => navigate({ name: 'games', platform: a.platform, username: a.username })}
              >
                <span className={`pf ${a.platform}`} />
                {a.username}
              </button>
            ))}
            <div className="engine-status">
              <span className={`dot ${engine.status === 'ready' ? 'ok' : engine.status === 'error' ? 'err' : ''}`} />
              {engine.name}
            </div>
          </nav>
        </div>
      )}
      <nav className="sidebar" aria-label={t('Principal')}>
        <button className="brand" onClick={() => navigate({ name: 'home' })} aria-label={t('DeepChess inicio')}>
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={34} height={34} />
          <span className="brand-name">
            {t('Deep')}<b>{t('Chess')}</b>
          </span>
        </button>
        <div className="nav-items">
          {desktopNav.map((n) => (
            <button key={n.id} className={`nav-item ${n.active ? 'active' : ''}`} onClick={n.onClick}>
              <n.icon size={20} />
              <span>{n.label}</span>
            </button>
          ))}
        </div>
        {accounts.length > 0 && (
          <div className="nav-accounts">
            <div className="nav-section">{t('Cuentas')}</div>
            {accounts.map((a) => (
              <button
                key={`${a.platform}:${a.username}`}
                className={`nav-account ${route.name === 'games' && route.username.toLowerCase() === a.username.toLowerCase() && route.platform === a.platform ? 'active' : ''}`}
                onClick={() => navigate({ name: 'games', platform: a.platform, username: a.username })}
              >
                <span className={`pf ${a.platform}`} />
                {a.username}
              </button>
            ))}
          </div>
        )}
        <div className="engine-status" title={t('Motor local')}>
          <span className={`dot ${engine.status === 'ready' ? 'ok' : engine.status === 'error' ? 'err' : ''}`} />
          {engine.name}
          <span className="muted">
            {engine.status === 'ready' ? (engine.threads > 1 ? t('{n} hilos', { n: engine.threads }) : t('listo')) : engine.status === 'error' ? t('error') : t('cargando…')}
          </span>
        </div>
      </nav>

      <main className="main">
        {route.name === 'home' && (
          <HomeView
            accounts={accounts}
            onAddAccount={addAccount}
            onRemoveAccount={removeAccount}
            onOpenAccount={(a) => navigate({ name: 'games', platform: a.platform, username: a.username })}
            onAnalyze={analyze}
            onFreeBoard={() => analyze(null)}
          />
        )}
        {route.name === 'games' && (
          <GamesView
            key={`${route.platform}:${route.username}`}
            account={{ platform: route.platform, username: route.username, addedAt: 0 }}
            onAnalyze={analyze}
          />
        )}
        {route.name === 'analysis' && (
          <AnalysisView game={current.game} perspective={current.perspective} settings={settings} onSettings={updateSettings} />
        )}
        {route.name === 'train' && <TrainView tab={route.tab} onTab={(tab) => navigate({ name: 'train', tab })} />}
        {route.name === 'openings' && (
          <div className={mobile ? 'm-page' : 'page train'}>
            <OpeningsTab />
          </div>
        )}
        {route.name === 'settings' && <SettingsView settings={settings} onChange={updateSettings} />}
      </main>

    </div>
    </LookProvider>
  );
}
