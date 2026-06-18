import { useUiStore } from '../../stores/uiStore';

export function ToastContainer() {
  const toasts = useUiStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  const latest = toasts[toasts.length - 1];

  return (
    <div className="toast show">
      {latest.message}
    </div>
  );
}
