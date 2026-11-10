import { AUDIT_LOG_UID } from './sink';

type RetentionStrapi = {
  log: { info: (obj: Record<string, unknown>, message: string) => void };
  db: {
    query: (uid: string) => {
      deleteMany: (params: {
        where: { occurred_at: { $lt: Date | string } };
      }) => Promise<{ count?: number } | number>;
    };
  };
};

export async function purgeAuditLog(
  strapi: RetentionStrapi,
  days: number,
): Promise<void> {
  if (days <= 0) {
    return;
  }

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);

  const result = await strapi.db
    .query(AUDIT_LOG_UID)
    .deleteMany({ where: { occurred_at: { $lt: cutoff } } });

  const count = typeof result === 'number' ? result : (result?.count ?? 0);
  strapi.log.info({ count, retentionDays: days, cutoff }, 'audit log purge');
}
