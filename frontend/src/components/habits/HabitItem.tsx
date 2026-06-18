import type { DailyHabit } from '../../types';

interface HabitItemProps {
  habit: DailyHabit;
  onToggle?: (id: string) => void;
}

export function HabitItem({ habit, onToggle }: HabitItemProps) {
  return (
    <div
      className={`quest-item ${habit.completedToday ? 'done' : ''}`}
      onClick={() => onToggle?.(habit.id)}
    >
      <div className="quest-chk">{habit.completedToday ? '✓' : ''}</div>
      <div className="quest-info">
        <div className="quest-name">{habit.icon} {habit.name}</div>
        <div className="quest-xp">+{habit.xpReward} XP</div>
      </div>
    </div>
  );
}
