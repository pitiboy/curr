import type { Core } from '@strapi/strapi';

import { readAuditConfig } from '../src/audit/config';
import { purgeAuditLog } from '../src/audit/retention';

export async function auditLogRetentionTask({
  strapi,
}: {
  strapi: Core.Strapi;
}) {
  const cfg = readAuditConfig(process.env);
  await purgeAuditLog(strapi, cfg.retentionDays);
}
