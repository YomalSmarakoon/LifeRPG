import { mockCharacter, mockHeatmapDays } from '../../data/mockData';
import { StreakRow } from '../../components/streaks/StreakRow';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatsDisplay } from '../../components/character/StatsDisplay';
import type { HeatmapDay } from '../../types';

const STREAK_CONFIGS = [
  { key: 'gym'       as const, icon: '🏋️', label: 'Gym'        },
  { key: 'code'      as const, icon: '💻', label: 'Code'       },
  { key: 'reading'   as const, icon: '📚', label: 'Reading'    },
  { key: 'earlyRise' as const, icon: '⏰', label: 'Early Rise' },
];

const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function calDayClass(day: HeatmapDay): string {
  const classes: string[] = ['cal-day'];
  if (day.isFuture) return [...classes, 'c-future'].join(' ');
  if (day.completedCount === 0) return classes.join(' ');
  if (day.completedCount >= day.totalCount * 0.8) classes.push('c-full');
  else classes.push('c-partial');
  if (day.isToday) classes.push('c-today');
  return classes.join(' ');
}

export function ProgressScreen() {
  const { streaks, stats } = mockCharacter;

  // Pad the calendar so first day falls on correct weekday (Mon=0)
  const firstDate = new Date(mockHeatmapDays[0].dateKey);
  const firstDow = (firstDate.getDay() + 6) % 7;
  const pads = Array.from({ length: firstDow });

  return (
    <div className="screen-content fade-up">
      <PageHeader title="Progress" />

      <Card title="30-Day Activity Heatmap">
        <div className="cal-header">
          {DOW_LABELS.map((d, i) => (
            <div key={i} className="cal-dow">{d}</div>
          ))}
        </div>
        <div className="cal-grid">
          {pads.map((_, i) => <div key={`pad-${i}`} />)}
          {mockHeatmapDays.map((day) => (
            <div key={day.dateKey} className={calDayClass(day)} title={day.dateKey} />
          ))}
        </div>
        <div className="cal-legend">
          <span><span className="cal-dot" style={{ background: 'var(--success)' }} />Active</span>
          <span><span className="cal-dot" style={{ background: 'var(--warning)', opacity: 0.8 }} />Partial</span>
          <span><span className="cal-dot" style={{ background: 'var(--surface3)' }} />Missed</span>
        </div>
      </Card>

      <Card title="Active Streaks">
        {STREAK_CONFIGS.map(({ key, icon, label }) => (
          <StreakRow key={key} streakKey={key} icon={icon} label={label} streak={streaks[key]} />
        ))}
      </Card>

      <Card title="Character Stats">
        <StatsDisplay stats={stats} />
      </Card>
    </div>
  );
}
