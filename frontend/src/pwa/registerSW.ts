// Service worker registration. No-op in dev mode.
// vite.config.ts uses registerType: 'prompt' so updates are held until the
// user explicitly accepts — the UpdatePrompt component drives this via the
// callbacks registered here.

type SwCallbacks = {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
};

// Holds the Workbox updateSW function after registration so UpdatePrompt can call it.
let _updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;

export function getUpdateSW() {
  return _updateSW;
}

export function registerServiceWorker(callbacks?: SwCallbacks) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  // vite-plugin-pwa injects virtual:pwa-register at build time.
  // Lazy import avoids TS errors in dev where the virtual module doesn't exist.
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      _updateSW = registerSW({
        onNeedRefresh() {
          callbacks?.onNeedRefresh?.();
        },
        onOfflineReady() {
          callbacks?.onOfflineReady?.();
        },
      });
    })
    .catch(() => {
      // virtual module not available outside production build — safe to ignore
    });
}
