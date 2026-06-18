import { useState } from 'react';
import { mockDailyHabits, mockWeeklyHabits } from '../../data/mockData';
import type { DailyHabit, WeeklyHabit } from '../../types';
import { HabitItem } from '../../components/habits/HabitItem';
import { WeeklyHabitItem } from '../../components/habits/WeeklyHabitItem';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { PageHeader } from '../../components/layout/PageHeader';
import { useUiStore } from '../../stores/uiStore';

const MOTIVATIONS = [
  'Every quest completed is a step toward your best self.',
  'The grind today builds the legend of tomorrow.',
  'Small wins compound into massive victories.',
  'Champions are made in the moments they want to quit.',
  'Your future self is watching. Make them proud.',
];

function resetTimer() {
  const now = new Date();
  const h = 23 - now.getHours();
  const m = 59 - now.getMinutes();
  return `Resets in ${h}h ${m}m`;
}

export function QuestsScreen() {
  const showToast = useUiStore((s) => s.showToast);
  const [dailyHabits, setDailyHabits] = useState<DailyHabit[]>(mockDailyHabits);
  const [weeklyHabits, setWeeklyHabits] = useState<WeeklyHabit[]>(mockWeeklyHabits);

  const completedCount = dailyHabits.filter((h) => h.completedToday).length;
  const totalCount = dailyHabits.length;
  const dailyPct = Math.round((completedCount / totalCount) * 100);
  const motivation = MOTIVATIONS[new Date().getDay() % MOTIVATIONS.length];

  function handleToggleDaily(id: string) {
    setDailyHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const next = { ...h, completedToday: !h.completedToday };
        if (next.completedToday) {
          showToast(`+${h.xpReward} XP — ${h.name} ✓`, 'success');
        }
        return next;
      })
    );
  }

  function handleToggleWeekly(id: string) {
    setWeeklyHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const next = { ...h, completedThisWeek: !h.completedThisWeek };
        if (next.completedThisWeek) {
          showToast(`🎉 Weekly Complete: ${h.name} +${h.xpReward} XP`, 'success');
        }
        return next;
      })
    );
  }

  return (
    <div className="screen-content fade-up">
      <PageHeader
        title="Quests"
        right={<div className="reset-timer">{resetTimer()}</div>}
      />

      <Card>
        <div className="row-between" style={{ marginBottom: 8 }}>
          <div className="card-title" style={{ margin: 0 }}>Daily Quests</div>
          <div className="quest-pct">{completedCount} / {totalCount}</div>
        </div>
        <ProgressBar value={dailyPct} color="var(--success)" />
        <div className="motivation">{motivation}</div>
        {dailyHabits.map((h) => (
          <HabitItem key={h.id} habit={h} onToggle={handleToggleDaily} />
        ))}
      </Card>

      <Card title="Weekly Quests">
        {weeklyHabits.map((h) => (
          <WeeklyHabitItem key={h.id} habit={h} onToggle={handleToggleWeekly} />
        ))}
      </Card>
    </div>
  );
}
