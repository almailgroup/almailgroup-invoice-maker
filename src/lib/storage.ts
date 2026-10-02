/**
 * Asks the browser to keep this site's data even under storage pressure.
 * Without it, IndexedDB data can (rarely) be evicted.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function storageStatus(): Promise<{
  persisted: boolean;
  usage: number | null;
  quota: number | null;
}> {
  try {
    const [persisted, estimate] = await Promise.all([
      navigator.storage?.persisted ? navigator.storage.persisted() : Promise.resolve(false),
      navigator.storage?.estimate ? navigator.storage.estimate() : Promise.resolve(undefined),
    ]);
    return { persisted, usage: estimate?.usage ?? null, quota: estimate?.quota ?? null };
  } catch {
    return { persisted: false, usage: null, quota: null };
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}
