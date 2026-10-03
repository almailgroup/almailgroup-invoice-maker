import { describe, expect, it, vi } from 'vitest';
import { activateUpdate } from './update';

function waitingWorker() {
  const worker = Object.assign(new EventTarget(), {
    state: 'installed' as ServiceWorkerState,
    postMessage: vi.fn(),
  });
  const activate = () => {
    worker.state = 'activated';
    worker.dispatchEvent(new Event('statechange'));
  };
  return { worker: worker as unknown as ServiceWorker, postMessage: worker.postMessage, activate };
}

describe('activateUpdate', () => {
  it('reloads once the new version is active, even in a tab without a controller', () => {
    const { worker, postMessage, activate } = waitingWorker();
    const reload = vi.fn();
    activateUpdate(worker, reload, new EventTarget());
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reload).not.toHaveBeenCalled();
    activate();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads only once when the controller changes too', () => {
    const { worker, activate } = waitingWorker();
    const reload = vi.fn();
    const container = new EventTarget();
    activateUpdate(worker, reload, container);
    container.dispatchEvent(new Event('controllerchange'));
    activate();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads straight away when no new version is waiting', () => {
    const reload = vi.fn();
    activateUpdate(null, reload, new EventTarget());
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
