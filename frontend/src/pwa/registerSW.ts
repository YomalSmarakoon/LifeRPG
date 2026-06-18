// Service worker registration. In dev mode this is a no-op.
// Phase 8 will handle the full update banner flow.
export function registerServiceWorker() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    // vite-plugin-pwa injects virtual:pwa-register at build time.
    // Lazy-importing avoids the TS error in dev where the virtual module doesn't exist.
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        registerSW({
          onNeedRefresh() {
            console.log('[PWA] Update available. Reload to apply.');
          },
          onOfflineReady() {
            console.log('[PWA] App ready for offline use.');
          },
        });
      })
      .catch(() => {
        // Not available in dev
      });
  }
}
