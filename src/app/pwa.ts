import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';
import { APP_NAME } from '@/lib/brand';

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

/** Paths the app was published under before (GitHub Pages project paths). */
const PREVIOUS_PATHS = ['/almailgroup-invoice-maker/'];

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
      toast(`A new version of ${APP_NAME} is available`, {
        id: 'app-update',
        description: 'Save your work, then reload to update.',
        duration: Infinity,
        action: { label: 'Reload', onClick: () => void updateServiceWorker(true) },
      });
    },
    onOfflineReady() {
      toast.success(`${APP_NAME} now works offline`, {
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
  void removePreviousInstalls().catch(() => undefined);
}

/**
 * After the app moves to a new address (e.g. the repository is renamed), the
 * old address keeps a service worker serving a cached, outdated copy. Remove
 * it and its cache. Saved data is unaffected: it belongs to the site, not to
 * the path.
 */
async function removePreviousInstalls(): Promise<void> {
  const ownScope = new URL('./', location.href).href;
  const previous = PREVIOUS_PATHS.map((path) => new URL(path, location.origin).href).filter(
    (scope) => scope !== ownScope,
  );
  if (previous.length === 0) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations.filter((r) => previous.includes(r.scope)).map((r) => r.unregister()),
  );
  if (!('caches' in window)) return;
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => previous.some((scope) => name.includes(scope)))
      .map((name) => caches.delete(name)),
  );
}
