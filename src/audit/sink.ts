import type { AuditConfig } from './config';

export const AUDIT_LOG_UID = 'api::audit-log.audit-log';

export type AuditEntryData = Record<string, unknown>;

type AuditStrapi = {
  log: {
    info: (obj: Record<string, unknown>, message: string) => void;
    warn: (message: string) => void;
  };
  db: {
    query: (uid: string) => {
      create: (params: { data: AuditEntryData }) => Promise<unknown>;
    };
  };
};

function logWriteFailure(
  strapi: AuditStrapi,
  err: unknown,
  target: 'stdout' | 'db',
) {
  strapi.log.warn(`audit write failed (${target}): ${String(err)}`);
}

export async function writeAuditEntry(
  strapi: AuditStrapi,
  cfg: AuditConfig,
  entry: AuditEntryData,
): Promise<void> {
  if (cfg.sink === 'stdout' || cfg.sink === 'both') {
    try {
      strapi.log.info({ audit: entry }, 'audit');
    } catch (err) {
      logWriteFailure(strapi, err, 'stdout');
    }
  }

  if (cfg.sink === 'db' || cfg.sink === 'both') {
    try {
      await strapi.db.query(AUDIT_LOG_UID).create({ data: entry });
    } catch (err) {
      logWriteFailure(strapi, err, 'db');
    }
  }
}
