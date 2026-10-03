/**
 * Switches to the waiting version of the app and reloads once it is active.
 * Waiting for `controllerchange` alone is not enough: a tab opened on the
 * first visit has no controller, so that event never fires there.
 */
export function activateUpdate(
  waiting: ServiceWorker | null | undefined,
  reload: () => void = () => window.location.reload(),
  container: Pick<EventTarget, 'addEventListener'> | undefined = navigator.serviceWorker,
): void {
  let reloading = false;
  const reloadOnce = () => {
    if (reloading) return;
    reloading = true;
    reload();
  };
  if (!waiting) return reloadOnce();
  container?.addEventListener('controllerchange', reloadOnce);
  waiting.addEventListener('statechange', () => {
    if (waiting.state === 'activated') reloadOnce();
  });
  waiting.postMessage({ type: 'SKIP_WAITING' });
}
