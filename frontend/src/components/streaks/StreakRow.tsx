import type { StreakState } from '../../types';

interface StreakRowProps {
  streakKey: string;
  icon: string;
  label: string;
  streak: StreakState;
}

export function StreakRow({ icon, label, streak }: StreakRowProps) {
  return (
    <div className="streak-row">
      <div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{icon} {label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Last: {streak.lastDateKey ?? 'Never'}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div className="streak-cnt">{streak.current} 🔥</div>
        {streak.shields > 0 && (
          <div className="shield-pill">🛡️ {streak.shields}</div>
        )}
      </div>
    </div>
  );
}
