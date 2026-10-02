import { db } from './db';
import type { Activity, ActivityEntity, ID } from './types';
import { newId } from '@/lib/ids';

export async function logActivity(
  companyId: ID,
  entity: ActivityEntity,
  entityId: ID,
  action: string,
  message: string,
  refs: { clientId?: ID | null; documentId?: ID | null } = {},
): Promise<void> {
  const activity: Activity = {
    id: newId(),
    companyId,
    at: new Date().toISOString(),
    entity,
    entityId,
    clientId: refs.clientId ?? null,
    documentId: refs.documentId ?? null,
    action,
    message,
  };
  await db.activities.add(activity);
}

export async function recentActivity(companyId: ID, limit = 20): Promise<Activity[]> {
  return db.activities
    .where('[companyId+at]')
    .between([companyId, ''], [companyId, '￿'])
    .reverse()
    .limit(limit)
    .toArray();
}
