import { mockAchievementDefinitions, mockUnlockedAchievements } from '../../data/mockData';
import { PageHeader } from '../../components/layout/PageHeader';

export function AchievementsScreen() {
  const unlockedCodes = new Set(mockUnlockedAchievements.map((u) => u.code));
  const total = mockAchievementDefinitions.length;
  const unlocked = unlockedCodes.size;

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

      <div className="ach-grid">
        {mockAchievementDefinitions.map((def) => {
          const isUnlocked = unlockedCodes.has(def.code);
          const userAch = mockUnlockedAchievements.find((u) => u.code === def.code);
          return (
            <div key={def.code} className={`ach-card ${isUnlocked ? 'unlocked' : 'locked'}`}>
              <div className="ach-icon">{def.icon}</div>
              <div className="ach-name">{def.name}</div>
              <div className="ach-desc">{def.description}</div>
              <div className="ach-xp">+{def.xpReward} XP</div>
              {isUnlocked && userAch && (
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>
                  {new Date(userAch.unlockedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
