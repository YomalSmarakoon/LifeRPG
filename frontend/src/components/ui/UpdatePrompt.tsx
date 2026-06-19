import { getUpdateSW } from '../../pwa/registerSW';

type Props = {
  onDismiss: () => void;
};

export function UpdatePrompt({ onDismiss }: Props) {
  function handleReload() {
    const updateSW = getUpdateSW();
    if (updateSW) {
      updateSW(true).catch(() => window.location.reload());
    } else {
      window.location.reload();
    }
  }

  return (
    <div className="update-prompt" role="status">
      <span>⚡ New version available</span>
      <div className="update-prompt-actions">
        <button className="update-btn-reload" onClick={handleReload}>Reload</button>
        <button className="update-btn-dismiss" onClick={onDismiss}>Later</button>
      </div>
    </div>
  );
}
