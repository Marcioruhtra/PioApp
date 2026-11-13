/**
 * Utilitário global de controlo de inatividade de sessão (5 minutos).
 * Reforça a segurança das contas administrativas e operacionais.
 */

export const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos
export const INACTIVITY_WARNING_MS = 4 * 60 * 1000; // Aviso 1 minuto antes (4 minutos)

export function isSessionInactive(
  lastActivityTimestamp: number,
  nowTimestamp: number = Date.now(),
  timeoutMs: number = INACTIVITY_TIMEOUT_MS
): boolean {
  if (!Number.isFinite(lastActivityTimestamp) || lastActivityTimestamp <= 0) {
    return false;
  }
  return nowTimestamp - lastActivityTimestamp >= timeoutMs;
}

export function getRemainingInactivityMs(
  lastActivityTimestamp: number,
  nowTimestamp: number = Date.now(),
  timeoutMs: number = INACTIVITY_TIMEOUT_MS
): number {
  if (!Number.isFinite(lastActivityTimestamp) || lastActivityTimestamp <= 0) {
    return timeoutMs;
  }
  return Math.max(0, timeoutMs - (nowTimestamp - lastActivityTimestamp));
}
