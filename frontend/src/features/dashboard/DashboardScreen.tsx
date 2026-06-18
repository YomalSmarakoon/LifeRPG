import { mockDashboard } from '../../data/mockData';
import { CharacterCard } from '../../components/character/CharacterCard';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { PageHeader } from '../../components/layout/PageHeader';
import { useUiStore } from '../../stores/uiStore';

const { character, todayHabits, weeklyHabits, xpToday, completedTodayCount, totalHabitsToday } = mockDashboard;

export function DashboardScreen() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  const dailyPct = Math.round((completedTodayCount / totalHabitsToday) * 100);

  return (
    <div className="screen-content fade-up">
      <PageHeader
        title="Character"
        right={
          <button className="theme-btn" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        }
      />

      <CharacterCard character={character} />

      <Card>
        <div className="row-between" style={{ marginBottom: 8 }}>
          <div className="card-title" style={{ margin: 0 }}>Today&apos;s Progress</div>
          <div className="quest-pct">{completedTodayCount} / {totalHabitsToday}</div>
        </div>
        <ProgressBar value={dailyPct} color="var(--success)" />
      </Card>

      <Card>
        <div className="card-title">Metrics</div>
        <div className="metrics">
          <div className="metric">
            <div className="metric-val">{character.totalXp.toLocaleString()}</div>
            <div className="metric-lbl">Total XP ✨</div>
          </div>
          <div className="metric">
            <div className="metric-val">{xpToday}</div>
            <div className="metric-lbl">XP Today 📈</div>
          </div>
          <div className="metric">
            <div className="metric-val">{character.gold}</div>
            <div className="metric-lbl">Gold 💰</div>
          </div>
          <div className="metric">
            <div className="metric-val">
              {Math.max(...Object.values(character.streaks).map((s) => s.current))}
            </div>
            <div className="metric-lbl">Best Streak 🔥</div>
          </div>
        </div>
      </Card>

      <Card title="Today's Quests (Preview)">
        {todayHabits.slice(0, 5).map((h) => (
          <div key={h.id} className={`quest-item ${h.completedToday ? 'done' : ''}`}>
            <div className="quest-chk">{h.completedToday ? '✓' : ''}</div>
            <div className="quest-info">
              <div className="quest-name">{h.icon} {h.name}</div>
              <div className="quest-xp">+{h.xpReward} XP</div>
            </div>
          </div>
        ))}
        {todayHabits.length > 5 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            +{todayHabits.length - 5} more — see Quests tab
          </div>
        )}
      </Card>

      <Card title="Weekly Quests (Preview)">
        {weeklyHabits.slice(0, 3).map((h) => (
          <div key={h.id} className={`quest-item ${h.completedThisWeek ? 'done' : ''}`}>
            <div className="quest-chk">{h.completedThisWeek ? '✓' : ''}</div>
            <div className="quest-info">
              <div className="quest-name">{h.icon} {h.name}</div>
              <div className="quest-xp">+{h.xpReward} XP</div>
              {h.weeklyTrackingMode !== 'manual' && (
                <div className="weekly-prog">{Math.min(h.progress, h.weeklyTarget ?? 1)} / {h.weeklyTarget} completed</div>
              )}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
