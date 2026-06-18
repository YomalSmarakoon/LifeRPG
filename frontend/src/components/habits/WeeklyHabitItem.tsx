import type { WeeklyHabit } from '../../types';

interface WeeklyHabitItemProps {
  habit: WeeklyHabit;
  onToggle?: (id: string) => void;
}

export function WeeklyHabitItem({ habit, onToggle }: WeeklyHabitItemProps) {
  const isManual = habit.weeklyTrackingMode === 'manual';
  const target = habit.weeklyTarget ?? 1;
  const progress = isManual ? (habit.completedThisWeek ? 1 : 0) : habit.progress;

  return (
    <div
      className={`quest-item ${habit.completedThisWeek ? 'done' : ''}`}
      onClick={() => (isManual ? onToggle?.(habit.id) : undefined)}
      style={{ cursor: isManual ? 'pointer' : 'default' }}
    >
      <div className="quest-chk">{habit.completedThisWeek ? '✓' : ''}</div>
      <div className="quest-info">
        <div className="quest-name">{habit.icon} {habit.name}</div>
        <div className="quest-xp">+{habit.xpReward} XP</div>
        {!isManual && (
          <div className="weekly-prog">
            {Math.min(progress, target)} / {target} completed
          </div>
        )}
      </div>
    </div>
  );
}
