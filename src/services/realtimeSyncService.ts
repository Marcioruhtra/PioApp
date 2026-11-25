/**
 * Utilitários puros de Sincronização em Tempo Real (Multi-dispositivo e Multi-aba)
 * Garantem ordem monotónica de versões, bloqueio de sobrescrita por estado vazio,
 * deteção precisa de alterações reais na nuvem e filtragem de ecos locais.
 */

import { ClubDatabaseState } from './storageService';

export const CLOUD_STATE_KEYS: (keyof ClubDatabaseState)[] = [
  'users',
  'members',
  'fees',
  'accounts',
  'receipts',
  'expenses',
  'monthlyClosings',
  'activities',
  'classes',
  'specialties',
  'trainingProgress',
  'documents',
  'circulars',
  'paymentProofs',
  'auditLogs',
  'notifications',
  'deletionRequests',
  'chaplaincyRequests',
  'suggestions',
  'messages',
  'associateDirectives',
  'teamEvaluations',
  'quotaWaivers',
  'musicItems',
  'enrollmentRequests',
  'settings',
];

/**
 * Gera um carimbo temporal ISO estritamente crescente (monotónico) face ao último conhecido,
 * evitando colisões no mesmo milissegundo em atualizações rápidas multi-dispositivo.
 */
export function getNextMonotonicSyncTimestamp(
  lastKnownIso?: string,
  nowMs: number = Date.now()
): string {
  const parsedLast = lastKnownIso ? Date.parse(lastKnownIso) : NaN;
  const safeLastMs = Number.isFinite(parsedLast) ? parsedLast : 0;
  const nextMs = Math.max(nowMs, safeLastMs + 1);
  return new Date(nextMs).toISOString();
}

/**
 * Compara apenas os campos sincronizados na nuvem, ignorando alterações locais exclusivas de `currentUser`.
 * Evita que logins ou trocas de perfil local disparem reescritas desnecessárias no Firestore.
 */
export function hasCloudPayloadChanged(
  prevState: ClubDatabaseState | null | undefined,
  nextState: ClubDatabaseState
): boolean {
  if (!prevState) return true;
  for (const key of CLOUD_STATE_KEYS) {
    if (prevState[key] !== nextState[key]) {
      return true;
    }
  }
  return false;
}

/**
 * Impede que um dispositivo em arranque lento envie o estado-casca vazio por cima dos dados reais da nuvem.
 */
export function isSafeCloudWritePayload(
  state: ClubDatabaseState,
  cloudConfirmedEmpty: boolean = false
): boolean {
  if (cloudConfirmedEmpty) return true;
  const hasUsers = Array.isArray(state.users) && state.users.length > 0;
  const hasMembers = Array.isArray(state.members) && state.members.length > 0;
  const hasLogs = Array.isArray(state.auditLogs) && state.auditLogs.length > 0;
  const hasEnrollments = Array.isArray(state.enrollmentRequests) && state.enrollmentRequests.length > 0;
  const hasMusic = Array.isArray(state.musicItems) && state.musicItems.length > 0;
  return hasUsers || hasMembers || hasLogs || hasEnrollments || hasMusic;
}

/**
 * Determina se um snapshot recebido deve ser ignorado por ser eco local pendente ou versão já aplicada.
 */
export function shouldSkipIncomingSnapshot(params: {
  remoteUpdatedAt?: string;
  lastRemoteUpdatedAt?: string;
  lastPushedUpdatedAt?: string;
  hasPendingWrites?: boolean;
}): boolean {
  if (params.hasPendingWrites) return true;
  const remote = (params.remoteUpdatedAt || '').trim();
  if (!remote) return false;
  return remote === params.lastRemoteUpdatedAt || remote === params.lastPushedUpdatedAt;
}

/**
 * Calcula o atraso de reconexão automática do listener em tempo real (backoff exponencial com limite).
 */
export function getReconnectDelayMs(attempt: number): number {
  const safeAttempt = Math.max(0, attempt);
  return Math.min(15000, 1500 * Math.pow(2, safeAttempt));
}
