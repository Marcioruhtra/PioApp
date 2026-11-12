/**
 * Serviço de Auditoria Institucional
 * Registo inalterável de todas as ações de relevo institucional.
 */

import { AuditLogEntry, ModuleName, RoleType } from '../types';
import { getNowISOString } from '../utils/date';

export function createAuditLog(
  actorUserId: string,
  actorName: string,
  actorRole: RoleType,
  module: ModuleName,
  action: string,
  details: string,
  entityId?: string,
  entityName?: string,
  reason?: string
): AuditLogEntry {
  return {
    id: `AUDIT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: getNowISOString(),
    actorUserId,
    actorName,
    actorRole,
    module,
    action,
    entityId,
    entityName,
    details,
    reason,
  };
}
