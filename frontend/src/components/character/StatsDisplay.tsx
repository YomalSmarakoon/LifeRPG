import type { CharacterStats } from '../../types';
import { STAT_COLORS, STAT_ICONS } from '../../utils/xp-calculator';
import { ProgressBar } from '../ui/ProgressBar';

interface StatsDisplayProps {
  stats: CharacterStats;
}

export function StatsDisplay({ stats }: StatsDisplayProps) {
  return (
    <div>
      {(Object.keys(stats) as (keyof CharacterStats)[]).map((key) => (
        <div key={key} className="stat-row">
          <div className="stat-lbl">{STAT_ICONS[key]} {key}</div>
          <div className="stat-bar">
            <ProgressBar value={Math.min(100, stats[key])} color={STAT_COLORS[key]} small />
          </div>
          <div className="stat-val">{stats[key]}</div>
        </div>
      ))}
    </div>
  );
}
