import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';
import { useConfirm } from '@/components/ui/overlay';

/**
 * Warns before leaving a page with unsaved changes (in-app navigation and
 * closing the tab). Call `allowNavigation()` right before navigating after a save.
 */
export function useUnsavedGuard(dirty: boolean) {
  const confirm = useConfirm();
  const skip = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !skip.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    void confirm({
      title: 'Discard unsaved changes?',
      description: 'You have changes that have not been saved yet.',
      confirmLabel: 'Discard changes',
      cancelLabel: 'Keep editing',
      danger: true,
    }).then((ok) => (ok ? blocker.proceed() : blocker.reset()));
  }, [blocker, confirm]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      if (skip.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  return useCallback(() => {
    skip.current = true;
  }, []);
}
