import { useAchievements } from '../../hooks/api/useAchievements';
import { PageHeader } from '../../components/layout/PageHeader';

export function AchievementsScreen() {
  const { data: achievements, isLoading, error } = useAchievements();

  const total = achievements?.length ?? 0;
  const unlocked = achievements?.filter((a) => a.unlocked).length ?? 0;

  return (
    <div className="screen-content fade-up">
      <PageHeader
        title="Achievements"
        right={
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>
            {unlocked} / {total}
          </div>
        }
      />

      {isLoading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--danger)' }}>
          Failed to load achievements.
        </div>
      )}

      {achievements && (
        <div className="ach-grid">
          {achievements.map((ach) => (
            <div key={ach.code} className={`ach-card ${ach.unlocked ? 'unlocked' : 'locked'}`}>
              <div className="ach-icon">{ach.icon}</div>
              <div className="ach-name">{ach.name}</div>
              <div className="ach-desc">{ach.description}</div>
              <div className="ach-xp">+{ach.xpReward} XP</div>
              {ach.unlocked && ach.unlockedAt && (
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>
                  {new Date(ach.unlockedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
