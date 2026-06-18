import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PageHeader } from '../../components/layout/PageHeader';
import { Modal } from '../../components/ui/Modal';

export function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const showToast = useUiStore((s) => s.showToast);
  const [showResetModal, setShowResetModal] = useState(false);

  function handleExport() {
    const data = { exportedAt: new Date().toISOString(), schemaVersion: 'mvp-1.0', note: 'Phase 1 mock export' };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `liferpg-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('💾 Data exported!');
  }

  return (
    <div className="screen-content fade-up">
      <PageHeader title="Settings" />

      <Card title="Account">
        <div className="setting-row">
          <div>
            <div className="setting-label">Username</div>
            <div className="setting-sub">{user?.username}</div>
          </div>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">Email</div>
            <div className="setting-sub">{user?.email}</div>
          </div>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">Timezone</div>
            <div className="setting-sub">{user?.timezone}</div>
          </div>
        </div>
      </Card>

      <Card title="Appearance">
        <div className="setting-row">
          <div>
            <div className="setting-label">Theme</div>
            <div className="setting-sub">Current: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</div>
          </div>
          <button className="theme-btn" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </Card>

      <Card title="Data Management">
        <div className="data-btns">
          <Button variant="accent" onClick={handleExport}>📤 Export</Button>
          <Button variant="danger" onClick={() => setShowResetModal(true)}>🗑️ Reset</Button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
          Export downloads a full JSON backup of your data.
          Reset will be available once backend is connected.
        </div>
      </Card>

      <Card title="About">
        <div className="setting-row">
          <div>
            <div className="setting-label">Version</div>
            <div className="setting-sub">MVP Phase 1</div>
          </div>
        </div>
        <div className="setting-row">
          <div>
            <div className="setting-label">Build</div>
            <div className="setting-sub">React + Vite + TypeScript</div>
          </div>
        </div>
      </Card>

      {showResetModal && (
        <Modal
          title="⚠️ Reset All Data"
          body="This will permanently delete all your progress, XP, quests, streaks, and achievements. This cannot be undone."
          extra={
            <Button variant="danger" fullWidth onClick={() => { setShowResetModal(false); showToast('Reset will be available in Phase 3'); }}>
              Yes, Reset Everything
            </Button>
          }
          onClose={() => setShowResetModal(false)}
        />
      )}
    </div>
  );
}
