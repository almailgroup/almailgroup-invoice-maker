import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

/**
 * Registers the service worker that lets the app work offline. A new version
 * never reloads the page by itself: the user picks the moment, so nothing
 * typed into an open editor is lost.
 */
export function registerServiceWorker(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  const updateServiceWorker = registerSW({
    onNeedRefresh() {
      // Called more than once for updates found by a background check.
      toast('A new version of Invoice Maker is available', {
        id: 'app-update',
        description: 'Save your work, then reload to update.',
        duration: Infinity,
        action: { label: 'Reload', onClick: () => void updateServiceWorker(true) },
      });
    },
    onOfflineReady() {
      toast.success('Invoice Maker now works offline', {
        description: 'You can also install it as an app from your browser menu.',
      });
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Tabs that stay open for days still learn about new versions.
      setInterval(() => {
        if (navigator.onLine) registration.update().catch(() => undefined);
      }, UPDATE_CHECK_INTERVAL);
    },
  });
}
