import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw, Search, Sparkles } from 'lucide-react';
import { chesscomArchiveGames, chesscomArchives, fetchProfile, lichessGames, profileUrl } from '../lib/api';
import { gameOutcomeForUser } from '../lib/chess';
import type { Account, GameSummary, Outcome, Profile, TimeClass } from '../lib/types';
import { Avatar } from './HomeView';
import { PlatformLogo } from '../components/PlatformLogo';
import { loadAnalyzed, type AnalyzedEntry } from '../lib/storage';

import { t } from '../i18n';

const TC_LABEL: Record<TimeClass, string> = {
  bullet: 'Bala',
  blitz: 'Blitz',
  rapid: 'Rápidas',
  daily: 'Diarias',
  classical: 'Clásicas',
  other: 'Otras',
};

interface Props {
  account: Account;
  onAnalyze: (g: GameSummary, perspective?: string) => void;
}

export function GamesView({ account, onAnalyze }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [archives, setArchives] = useState<string[] | null>(null);
  const [archiveIdx, setArchiveIdx] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tc, setTc] = useState<TimeClass | 'all'>('all');
  const [result, setResult] = useState<Outcome | 'all'>('all');
  const [query, setQuery] = useState('');
  // Accuracy of the games already reviewed in DeepChess (read once per visit of the list).
  const [analyzed] = useState(loadAnalyzed);

  const loadMore = useCallback(
    async (reset = false) => {
      setLoading(true);
      setError(null);
      try {
        if (account.platform === 'chesscom') {
          let list = reset ? null : archives;
          if (!list) {
            list = await chesscomArchives(account.username);
            setArchives(list);
          }
          let idx = reset ? 0 : archiveIdx;
          const collected: GameSummary[] = [];
          // Load whole months until we have at least ~15 new games or run out.
          while (idx < list.length && collected.length < 15) {
            collected.push(...(await chesscomArchiveGames(list[idx])));
            idx++;
          }
          setArchiveIdx(idx);
          setExhausted(idx >= list.length);
          setGames((prev) => (reset ? collected : [...prev, ...collected]));
        } else {
          const last = reset ? undefined : games[games.length - 1];
          const page = await lichessGames(account.username, last ? last.endTime - 1 : undefined);
          setExhausted(page.length === 0);
          setGames((prev) => (reset ? page : [...prev, ...page.filter((g) => !prev.some((p) => p.id === g.id))]));
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [account, archives, archiveIdx, games],
  );

  useEffect(() => {
    setGames([]);
    setArchives(null);
    setArchiveIdx(0);
    setExhausted(false);
    setProfile(null);
    fetchProfile(account.platform, account.username).then(setProfile).catch(() => undefined);
    void loadMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games.filter((g) => {
      if (tc !== 'all' && g.timeClass !== tc) return false;
      const o = gameOutcomeForUser(g, account.username);
      if (result !== 'all' && o?.outcome !== result) return false;
      if (q) {
        const hay = `${g.white.name} ${g.black.name} ${g.opening ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [games, tc, result, query, account.username]);

  const stats = useMemo(() => {
    const s = { win: 0, loss: 0, draw: 0 };
    for (const g of filtered) {
      const o = gameOutcomeForUser(g, account.username);
      if (o) s[o.outcome]++;
    }
    return s;
  }, [filtered, account.username]);

  const groups = useMemo(() => {
    const map = new Map<string, GameSummary[]>();
    for (const g of filtered) {
      const k = new Date(g.endTime).toLocaleDateString('es', { month: 'long', year: 'numeric' });
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(g);
    }
    return [...map.entries()];
  }, [filtered]);

  // Always show every rhythm the platform offers, with how many loaded games each has.
  const tcCounts = useMemo(() => {
    const base: TimeClass[] =
      account.platform === 'chesscom' ? ['bullet', 'blitz', 'rapid', 'daily'] : ['bullet', 'blitz', 'rapid', 'classical', 'daily'];
    const counts = new Map<TimeClass, number>(base.map((t) => [t, 0]));
    for (const g of games) counts.set(g.timeClass, (counts.get(g.timeClass) ?? 0) + 1);
    return [...counts.entries()];
  }, [games, account.platform]);
  const total = stats.win + stats.loss + stats.draw;

  return (
    <div className="page games">
      <header className="profile-head card">
        <Avatar profile={profile} name={account.username} size={64} />
        <div className="profile-info">
          <div className="profile-name">
            {profile?.title && <span className="title-badge">{profile.title}</span>}
            <h1>{profile?.username ?? account.username}</h1>
            <a href={profile?.url ?? profileUrl(account.platform, account.username)} target="_blank" rel="noreferrer" className="ext-link">
              <PlatformLogo platform={account.platform} size={14} />{' '}{t('Perfil')}{' '}<ExternalLink size={12} />
            </a>
          </div>
          {profile?.name && <div className="muted">{profile.name}</div>}
          <div className="rating-chips">
            {profile &&
              (Object.entries(profile.ratings) as [TimeClass, number | undefined][])
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <span key={k} className="chip">
                    {TC_LABEL[k]} <b>{v}</b>
                  </span>
                ))}
          </div>
        </div>
        {total > 0 && (
          <div className="wl">
            <div className="wl-bar">
              <span className="w" style={{ flex: stats.win }} />
              <span className="d" style={{ flex: stats.draw }} />
              <span className="l" style={{ flex: stats.loss }} />
            </div>
            <div className="wl-legend">
              <span>
                <b>{stats.win}</b> V
              </span>
              <span>
                <b>{stats.draw}</b> T
              </span>
              <span>
                <b>{stats.loss}</b> D
              </span>
            </div>
          </div>
        )}
      </header>

      <div className="filters">
        <div className="chip-group">
          <button className={`chip ${tc === 'all' ? 'active' : ''}`} onClick={() => setTc('all')}>
            {t('Todas')}{' '}<span className="count">{games.length}</span>
          </button>
          {tcCounts.map(([tcId, n]) => (
            <button
              key={tcId}
              className={`chip ${tc === tcId ? 'active' : ''}`}
              onClick={() => setTc(tcId)}
              disabled={n === 0 && tc !== tcId}
              title={n === 0 ? t('No hay partidas de este ritmo en los meses cargados') : undefined}
            >
              {t(TC_LABEL[tcId])} <span className="count">{n}</span>
            </button>
          ))}
        </div>
        <div className="chip-group">
          {(
            [
              ['all', 'Todos'],
              ['win', 'Victorias'],
              ['loss', 'Derrotas'],
              ['draw', 'Tablas'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} className={`chip ${result === k ? 'active' : ''}`} onClick={() => setResult(k)}>
              {t(l)}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Rival o apertura')} aria-label={t('Buscar')} />
        </label>
        <button className="icon-btn" onClick={() => loadMore(true)} aria-label={t('Recargar')} title={t('Recargar')}>
          <RefreshCw size={16} />
        </button>
      </div>

      {error && <div className="card error-card">{error}</div>}

      {groups.map(([month, list]) => (
        <section key={month} className="month">
          <h3 className="section-title">{month}</h3>
          <div className="game-list">
            {list.map((g) => (
              <GameRow key={g.id} game={g} username={account.username} analyzed={analyzed[g.id]} onAnalyze={() => onAnalyze(g, account.username)} />
            ))}
          </div>
        </section>
      ))}

      {!loading && !error && games.length > 0 && filtered.length === 0 && (
        <div className="empty-hint">{t('Ninguna partida coincide con los filtros.')}</div>
      )}
      {!loading && !error && games.length === 0 && <div className="empty-hint">{t('No hay partidas públicas.')}</div>}

      <div className="load-more">
        {loading ? (
          <span className="muted">
            <Loader2 size={16} className="spin" />{' '}{t('Cargando partidas…')}
          </span>
        ) : (
          !exhausted &&
          games.length > 0 && (
            <button className="btn ghost" onClick={() => loadMore()}>
              {t('Cargar partidas anteriores')}
            </button>
          )
        )}
      </div>
    </div>
  );
}

function GameRow({
  game,
  username,
  analyzed,
  onAnalyze,
}: {
  game: GameSummary;
  username: string;
  analyzed?: AnalyzedEntry;
  onAnalyze: () => void;
}) {
  const o = gameOutcomeForUser(game, username);
  const me = o?.color === 'black' ? game.black : game.white;
  const opp = o?.color === 'black' ? game.white : game.black;
  const myColor = o?.color ?? 'white';
  // Our own review first; otherwise the accuracy the platform reports (Chess.com reviewed games).
  const acc = analyzed
    ? myColor === 'white'
      ? analyzed.w
      : analyzed.b
    : game.accuracies
      ? myColor === 'white'
        ? game.accuracies.white
        : game.accuracies.black
      : undefined;
  const d = new Date(game.endTime);
  return (
    <button className={`game-row ${o?.outcome ?? 'draw'}`} onClick={onAnalyze}>
      <span className="result-pill">{o?.outcome === 'win' ? 'V' : o?.outcome === 'loss' ? 'D' : 'T'}</span>
      <div className="gr-players">
        <div className="gr-opp">
          <i className={`piece-dot ${myColor === 'white' ? 'black' : 'white'}`} />
          <span className="gr-name">{opp.name}</span>
          {opp.rating && <span className="muted">({opp.rating})</span>}
        </div>
        <div className="gr-sub muted">
          {TC_LABEL[game.timeClass]}
          {game.timeControl ? ` · ${formatTc(game.timeControl)}` : ''} · {d.toLocaleDateString()}{' '}
          {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {game.opening ? ` · ${game.opening}` : ''}
        </div>
      </div>
      <div className="gr-right">
        {me.rating && <span className="gr-rating mono">{me.rating}</span>}
        {acc != null && (
          <span className={`gr-acc mono ${analyzed ? 'mine' : ''}`} title={analyzed ? t('Tu precisión (analizada en DeepChess)') : t('Tu precisión')}>
            {acc.toFixed(1)}%
          </span>
        )}
        <span className="btn small primary gr-cta">
          <Sparkles size={14} />{' '}{t('Analizar')}
        </span>
      </div>
    </button>
  );
}

function formatTc(tc: string) {
  if (tc.includes('/')) {
    const days = Number(tc.split('/')[1]) / 86400;
    return days === 1 ? t('1 día') : t('{n} días', { n: days });
  }
  const [b, i] = tc.split('+').map(Number);
  const min = b / 60;
  return `${min >= 1 ? min : `${b}s`}${i ? `+${i}` : ''}`;
}
