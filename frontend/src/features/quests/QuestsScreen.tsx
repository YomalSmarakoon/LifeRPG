import { useHabits } from '../../hooks/api/useHabits';
import { useCompleteHabit } from '../../hooks/api/useCompleteHabit';
import { useUndoHabit } from '../../hooks/api/useUndoHabit';
import type { DailyHabit, WeeklyHabit } from '../../types';
import { HabitItem } from '../../components/habits/HabitItem';
import { WeeklyHabitItem } from '../../components/habits/WeeklyHabitItem';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { PageHeader } from '../../components/layout/PageHeader';
import { useUiStore } from '../../stores/uiStore';
import { useIsOffline } from '../../components/ui/OfflineBanner';

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
  const showLevelUp = useUiStore((s) => s.showLevelUp);
  const isOffline = useIsOffline();

  const { data: habitsData, isLoading } = useHabits();
  const completeMutation = useCompleteHabit();
  const undoMutation = useUndoHabit();

  const dailyHabits = (habitsData?.habits.filter((h) => h.frequency === 'daily') ?? []) as DailyHabit[];
  const weeklyHabits = (habitsData?.habits.filter((h) => h.frequency === 'weekly') ?? []) as WeeklyHabit[];

  const completedCount = dailyHabits.filter((h) => h.completedToday).length;
  const totalCount = dailyHabits.length;
  const dailyPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const motivation = MOTIVATIONS[new Date().getDay() % MOTIVATIONS.length];

  const isMutating = completeMutation.isPending || undoMutation.isPending;

  function handleToggleDaily(id: string) {
    if (isMutating) return;
    if (isOffline) {
      showToast('You are offline. Habit changes require a connection in this MVP.', 'warning');
      return;
    }
    const habit = dailyHabits.find((h) => h.id === id);
    if (!habit) return;

    if (habit.completedToday) {
      undoMutation.mutate(
        { habitId: id, dateKey: habit.dateKey },
        {
          onSuccess: (res) => {
            showToast(`↩ ${habit.name} undone — ${res.xpReverted} XP reverted`);
          },
          onError: () => showToast('Failed to undo. Try again.', 'error'),
        },
      );
    } else {
      completeMutation.mutate(
        { habitId: id, syncId: crypto.randomUUID() },
        {
          onSuccess: (res) => {
            if (res.alreadyProcessed) return;
            showToast(`+${res.xpAwarded} XP — ${habit.name} ✓`, 'success');
            if (res.levelUp) {
              showLevelUp({
                newLevel: res.newLevel,
                newRank: res.newRank,
                statBoostMessage: `You reached Level ${res.newLevel}! Stats boosted.`,
              });
            }
            res.unlockedAchievements.forEach((a) => {
              showToast(`🏆 Achievement: ${a.name} +${a.xpAwarded} XP`, 'success');
            });
            res.weeklyAutoCompleted.forEach((w) => {
              showToast(`🎉 Weekly complete: ${w.name} +${w.xpAwarded} XP`, 'success');
            });
          },
          onError: (err: unknown) => {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 409) {
              showToast('Already completed today.', 'warning');
            } else {
              showToast('Failed to complete. Try again.', 'error');
            }
          },
        },
      );
    }
  }

  function handleToggleWeekly(id: string) {
    if (isMutating) return;
    if (isOffline) {
      showToast('You are offline. Habit changes require a connection in this MVP.', 'warning');
      return;
    }
    const habit = weeklyHabits.find((h) => h.id === id);
    if (!habit || habit.weeklyTrackingMode !== 'manual' || habit.completedThisWeek) return;

    completeMutation.mutate(
      { habitId: id, syncId: crypto.randomUUID() },
      {
        onSuccess: (res) => {
          showToast(`🎉 Weekly Complete: ${habit.name} +${res.xpAwarded} XP`, 'success');
          if (res.levelUp) {
            showLevelUp({
              newLevel: res.newLevel,
              newRank: res.newRank,
              statBoostMessage: `You reached Level ${res.newLevel}! Stats boosted.`,
            });
          }
          res.unlockedAchievements.forEach((a) => {
            showToast(`🏆 Achievement: ${a.name} +${a.xpAwarded} XP`, 'success');
          });
        },
        onError: (err: unknown) => {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 409) {
            showToast('Already completed this week.', 'warning');
          } else if (status === 422) {
            showToast('This habit completes automatically.', 'warning');
          } else {
            showToast('Failed to complete. Try again.', 'error');
          }
        },
      },
    );
  }

  return (
    <div className="screen-content fade-up">
      <PageHeader
        title="Quests"
        right={<div className="reset-timer">{resetTimer()}</div>}
      />

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
