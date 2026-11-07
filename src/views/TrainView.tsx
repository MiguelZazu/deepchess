import { Puzzle, Zap } from 'lucide-react';
import { PuzzlesTab } from './train/PuzzlesTab';
import { RushTab } from './train/RushTab';
import { t } from '../i18n';

export type TrainTab = 'puzzles' | 'rush';
const TABS: { id: TrainTab; label: string; icon: typeof Puzzle }[] = [
  { id: 'puzzles', get label() { return t('Problemas'); }, icon: Puzzle },
  { id: 'rush', get label() { return t('Contrarreloj'); }, icon: Zap },
];

export function TrainView({ tab, onTab }: { tab: TrainTab; onTab: (t: TrainTab) => void }) {
  return (
    <div className="page train">
      <div className="settings-tabs train-tabs" role="tablist">
        {TABS.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'active' : ''} onClick={() => onTab(x.id)}>
            <x.icon size={16} /> {x.label}
          </button>
        ))}
      </div>
      {tab === 'puzzles' && <PuzzlesTab />}
      {tab === 'rush' && <RushTab />}
    </div>
  );
}
