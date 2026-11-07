import { useEffect, useState } from 'react';
import { ArrowRight, ClipboardPaste, Cpu, Link2, Trash2, LayoutGrid, Loader2 } from 'lucide-react';
import { fetchProfile } from '../lib/api';
import { loadRecent, type RecentItem } from '../lib/storage';
import { summaryFromPgn } from '../lib/pgn';
import type { Account, GameSummary, Platform, Profile } from '../lib/types';
import { PlatformLogo } from '../components/PlatformLogo';
import { t } from '../i18n';

interface Props {
  accounts: Account[];
  onAddAccount: (a: Account) => void;
  onRemoveAccount: (a: Account) => void;
  onOpenAccount: (a: Account) => void;
  onAnalyze: (g: GameSummary, perspective?: string) => void;
  onFreeBoard: () => void;
}

export function HomeView({ accounts, onAddAccount, onRemoveAccount, onOpenAccount, onAnalyze, onFreeBoard }: Props) {
  const [platform, setPlatform] = useState<Platform>('chesscom');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pgn, setPgn] = useState('');
  const [pgnError, setPgnError] = useState<string | null>(null);
  const [recent] = useState<RecentItem[]>(() => loadRecent());

  const link = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    if (!u) return;
    setBusy(true);
    setError(null);
    try {
      const p = await fetchProfile(platform, u);
      const acc: Account = { platform, username: p.username, addedAt: Date.now() };
      onAddAccount(acc);
      setUsername('');
      onOpenAccount(acc);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const importPgn = () => {
    try {
      setPgnError(null);
      onAnalyze(summaryFromPgn(pgn));
    } catch (err) {
      setPgnError((err as Error).message?.includes('Invalid') ? t('PGN no válido.') : (err as Error).message || t('PGN no válido.'));
    }
  };

  return (
    <div className="page home">
      <header className="hero">
        <div className="hero-badge">
          <Cpu size={14} />{' '}{t('Stockfish 19 Lite · se ejecuta en tu dispositivo')}
        </div>
        <h1>
          {t('Analiza tus partidas como un')}{' '}<span className="grad">{t('profesional')}</span>
        </h1>
        <p className="hero-sub">
          {t('Vincula tu cuenta de Chess.com o Lichess y obtén precisión, clasificación de cada jugada, gráfico de evaluación y las mejores líneas.')}
        </p>
      </header>

      <div className="home-grid">
        <section className="card">
          <h3 className="card-title">
            <Link2 size={18} />{' '}{t('Vincular cuenta')}
          </h3>
          <form onSubmit={link} className="link-form">
            <div className="segmented" role="tablist">
              {(['chesscom', 'lichess'] as Platform[]).map((p) => (
                <button
                  type="button"
                  key={p}
                  role="tab"
                  aria-selected={platform === p}
                  className={platform === p ? 'active' : ''}
                  onClick={() => setPlatform(p)}
                >
                  <PlatformLogo platform={p} size={16} /> {p === 'chesscom' ? 'Chess.com' : 'Lichess'}
                </button>
              ))}
            </div>
            <div className="input-row">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={platform === 'chesscom' ? t('Usuario de Chess.com') : t('Usuario de Lichess')}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label={t('Nombre de usuario')}
              />
              <button className="btn primary" disabled={busy || !username.trim()}>
                {busy ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}
                {t('Vincular')}
              </button>
            </div>
            {error && <div className="form-error">{error}</div>}
            <p className="fine-print">
              {t('Solo se necesita el nombre de usuario: DeepChess lee tus partidas públicas mediante la API oficial. Nunca pedimos tu contraseña.')}
            </p>
          </form>

          {accounts.length > 0 && (
            <div className="account-list">
              {accounts.map((a) => (
                <AccountRow key={`${a.platform}:${a.username}`} account={a} onOpen={() => onOpenAccount(a)} onRemove={() => onRemoveAccount(a)} />
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <h3 className="card-title">
            <ClipboardPaste size={18} />{' '}{t('Pegar PGN')}
          </h3>
          <textarea
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
            placeholder={'[Event "Live Chess"]\n1. e4 e5 2. Nf3 Nc6 3. Bb5 …'}
            rows={6}
            spellCheck={false}
            aria-label={t('PGN')}
          />
          {pgnError && <div className="form-error">{pgnError}</div>}
          <div className="row-actions">
            <button className="btn primary" onClick={importPgn} disabled={!pgn.trim()}>
              {t('Analizar PGN')}
            </button>
            <button className="btn ghost" onClick={onFreeBoard}>
              <LayoutGrid size={16} />{' '}{t('Tablero libre')}
            </button>
          </div>
        </section>
      </div>

      {recent.length > 0 && (
        <section className="recent">
          <h3 className="section-title">{t('Análisis recientes')}</h3>
          <div className="recent-grid">
            {recent.slice(0, 8).map((r) => (
              <button key={r.game.id} className="recent-card" onClick={() => onAnalyze(r.game)}>
                <div className="recent-players">
                  <span>
                    <i className="piece-dot white" /> {r.game.white.name}
                  </span>
                  <span>
                    <i className="piece-dot black" /> {r.game.black.name}
                  </span>
                </div>
                {r.accuracy && (
                  <div className="recent-acc mono">
                    <span>{r.accuracy.w.toFixed(1)}</span>
                    <span>{r.accuracy.b.toFixed(1)}</span>
                  </div>
                )}
                <div className="recent-meta muted">
                  {r.game.opening ?? t('Partida')} · {new Date(r.game.endTime).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AccountRow({ account, onOpen, onRemove }: { account: Account; onOpen: () => void; onRemove: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    fetchProfile(account.platform, account.username).then(setProfile).catch(() => undefined);
  }, [account]);
  const r = profile?.ratings;
  return (
    <div className="account-row">
      <button className="account-main" onClick={onOpen}>
        <Avatar profile={profile} name={account.username} />
        <div className="account-info">
          <div className="account-name">
            {profile?.title && <span className="title-badge">{profile.title}</span>}
            {profile?.username ?? account.username}
            <PlatformLogo platform={account.platform} size={14} />
          </div>
          <div className="account-ratings">
            {r?.rapid && <span>{t('Rápidas')}{' '}{r.rapid}</span>}
            {r?.blitz && <span>{t('Blitz')}{' '}{r.blitz}</span>}
            {r?.bullet && <span>{t('Bala')}{' '}{r.bullet}</span>}
          </div>
        </div>
        <ArrowRight size={18} className="muted" />
      </button>
      <button className="icon-btn danger" onClick={onRemove} aria-label={t('Desvincular cuenta')} title={t('Desvincular')}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export function Avatar({ profile, name, size = 40 }: { profile: Profile | null; name: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (profile?.avatar && !broken) {
    return (
      <img
        className="avatar"
        src={profile.avatar}
        alt=""
        width={size}
        height={size}
        onError={() => setBroken(true)}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className="avatar fallback" style={{ width: size, height: size }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
