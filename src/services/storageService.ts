/**
 * Repositório Central de Dados e Lógica de Negócio do Sistema
 * Gerencia persistência local segura, validações de unicidade,
 * regras de auditoria inalterável e transições de estado.
 */

import {
  AuditLogEntry,
  ClubActivity,
  ClubAnnouncement,
  ClubSettings,
  ExpenseRequest,
  FeeDefinition,
  Member,
  MemberPortalRequest,
  MemberTrainingProgress,
  MonthlyClosing,
  OfficialDocument,
  PaymentProofReport,
  PaymentReceipt,
  RoleType,
  SpecialtyHonor,
  TrainingClass,
  TreasuryAccount,
  UserAccount,
  MemberCategory,
  ClubNotification,
  DeletionRequest,
  ChaplaincyRequest,
  MemberSuggestion,
  Message,
  Circular,
  AssociateDirective,
  TeamEvaluation,
  QuotaDebtWaiver,
  MusicItem,
  MemberEnrollmentRequest,
} from '../types';
import {
  INITIAL_ACCOUNTS,
  INITIAL_ACTIVITIES,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_CLASSES,
  INITIAL_DOCUMENTS,
  INITIAL_EXPENSES,
  INITIAL_FEES,
  INITIAL_MEMBERS,
  INITIAL_MONTHLY_CLOSINGS,
  INITIAL_MUSIC_ITEMS,
  INITIAL_PAYMENT_PROOFS,
  INITIAL_RECEIPTS,
  INITIAL_REQUESTS,
  INITIAL_SETTINGS,
  INITIAL_SPECIALTIES,
  INITIAL_TRAINING_PROGRESS,
  INITIAL_USERS,
  INITIAL_NOTIFICATIONS,
  INITIAL_DELETION_REQUESTS,
  INITIAL_CHAPLAINCY_REQUESTS,
  INITIAL_SUGGESTIONS,
} from './initialData';
import { createAuditLog } from './auditService';
import { getNowISOString, getTodayISODate } from '../utils/date';
import { verifyAndRepairMembersIntegrity } from './memberIntegrityService';
import {
  advanceCycleStartDateAfterCleanup,
  calculateMemberQuotaSummary,
  resolveQuotaConfig,
} from './quotaService';

const STORAGE_KEY = 'pioapp_club_data_v1';

export interface ClubDatabaseState {
  users: UserAccount[];
  members: Member[];
  fees: FeeDefinition[];
  accounts: TreasuryAccount[];
  receipts: PaymentReceipt[];
  expenses: ExpenseRequest[];
  monthlyClosings: MonthlyClosing[];
  activities: ClubActivity[];
  classes: TrainingClass[];
  specialties: SpecialtyHonor[];
  trainingProgress: MemberTrainingProgress[];
  documents: OfficialDocument[];
  circulars: Circular[];
  paymentProofs: PaymentProofReport[];
  auditLogs: AuditLogEntry[];
  notifications: ClubNotification[];
  deletionRequests: DeletionRequest[];
  chaplaincyRequests: ChaplaincyRequest[];
  suggestions: MemberSuggestion[];
  messages: Message[];
  associateDirectives?: AssociateDirective[];
  teamEvaluations?: TeamEvaluation[];
  quotaWaivers?: QuotaDebtWaiver[];
  musicItems?: MusicItem[];
  enrollmentRequests?: MemberEnrollmentRequest[];
  settings: ClubSettings;
  currentUser: UserAccount;
  updatedAt?: string;
}

export function createCleanCloudShellState(): ClubDatabaseState {
  const placeholderUser: UserAccount = {
    id: 'USR-GUEST',
    email: 'sistema@clubedalvorada.ao',
    name: 'Sistema em Sincronização',
    role: 'membro',
    active: true,
    createdAt: getNowISOString(),
  };

  return {
    users: [],
    members: [],
    fees: [],
    accounts: [
      {
        id: 'ACC-1',
        name: 'Caixa Geral',
        initialBalanceInCents: 0,
        currentBalanceInCents: 0,
        active: true,
        type: 'caixa',
      },
    ],
    receipts: [],
    expenses: [],
    monthlyClosings: [],
    activities: [],
    classes: [],
    specialties: [],
    trainingProgress: [],
    documents: [],
    circulars: [],
    paymentProofs: [],
    auditLogs: [],
    notifications: [],
    deletionRequests: [],
    chaplaincyRequests: [],
    suggestions: [],
    messages: [],
    associateDirectives: [],
    teamEvaluations: [],
    quotaWaivers: [],
    musicItems: [],
    enrollmentRequests: [],
    settings: {
      ...INITIAL_SETTINGS,
      departments: [],
      units: [],
      classes: [],
      currentYear: new Date().getFullYear(),
    },
    currentUser: placeholderUser,
  };
}

export function clearLegacyLocalDatabaseCache(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('pioapp_started_clean');
    }
  } catch {
    // Ignorado em ambientes restritos
  }
}

export function loadInitialState(): ClubDatabaseState {
  // No navegador, o sistema opera 100% em tempo real via Cloud Firestore sem memória cache permanente em localStorage
  if (typeof window !== 'undefined') {
    clearLegacyLocalDatabaseCache();
    return createCleanCloudShellState();
  }

  // Em ambiente de testes automatizados Node.js (sem window), devolve o conjunto completo de referência
  return {
    users: INITIAL_USERS,
    members: INITIAL_MEMBERS,
    fees: INITIAL_FEES,
    accounts: INITIAL_ACCOUNTS,
    receipts: INITIAL_RECEIPTS,
    expenses: INITIAL_EXPENSES,
    monthlyClosings: INITIAL_MONTHLY_CLOSINGS,
    activities: INITIAL_ACTIVITIES,
    classes: INITIAL_CLASSES,
    specialties: INITIAL_SPECIALTIES,
    trainingProgress: INITIAL_TRAINING_PROGRESS,
    documents: INITIAL_DOCUMENTS,
    circulars: [],
    paymentProofs: INITIAL_PAYMENT_PROOFS,
    auditLogs: INITIAL_AUDIT_LOGS,
    settings: INITIAL_SETTINGS,
    currentUser: INITIAL_USERS[1],
    notifications: INITIAL_NOTIFICATIONS,
    deletionRequests: INITIAL_DELETION_REQUESTS,
    chaplaincyRequests: INITIAL_CHAPLAINCY_REQUESTS,
    suggestions: INITIAL_SUGGESTIONS,
    messages: [],
    associateDirectives: [],
    teamEvaluations: [],
    quotaWaivers: [],
    enrollmentRequests: [],
  };
}

export function saveStateToStorage(_state: ClubDatabaseState): void {
  // Sistema 100% em tempo real na nuvem: nenhuma cópia permanente da base de dados é gravada em localStorage
  clearLegacyLocalDatabaseCache();
}

export function resetToDemoData(): ClubDatabaseState {
  clearLegacyLocalDatabaseCache();
  return {
    users: INITIAL_USERS,
    members: INITIAL_MEMBERS,
    fees: INITIAL_FEES,
    accounts: INITIAL_ACCOUNTS,
    receipts: INITIAL_RECEIPTS,
    expenses: INITIAL_EXPENSES,
    monthlyClosings: INITIAL_MONTHLY_CLOSINGS,
    activities: INITIAL_ACTIVITIES,
    classes: INITIAL_CLASSES,
    specialties: INITIAL_SPECIALTIES,
    trainingProgress: INITIAL_TRAINING_PROGRESS,
    documents: INITIAL_DOCUMENTS,
    circulars: [],
    paymentProofs: INITIAL_PAYMENT_PROOFS,
    auditLogs: INITIAL_AUDIT_LOGS,
    settings: INITIAL_SETTINGS,
    currentUser: INITIAL_USERS[1],
    notifications: INITIAL_NOTIFICATIONS,
    deletionRequests: INITIAL_DELETION_REQUESTS,
    chaplaincyRequests: INITIAL_CHAPLAINCY_REQUESTS,
    suggestions: INITIAL_SUGGESTIONS,
    messages: [],
    associateDirectives: [],
    teamEvaluations: [],
    quotaWaivers: [],
    musicItems: INITIAL_MUSIC_ITEMS,
    enrollmentRequests: [],
    updatedAt: getNowISOString(),
  };
}

/**
 * Reinicialização integral do sistema do zero:
 * Elimina todos os membros, saldos financeiros (fica a 0 Kz), recibos,
 * documentos oficiais, classes e especialidades, mantendo exclusivamente
 * o Administrador como o único utilizador cadastrado.
 */
export function resetToCleanAdminOnlyState(customAdmin?: Partial<UserAccount>): ClubDatabaseState {
  clearLegacyLocalDatabaseCache();
  const now = getNowISOString();
  const admin: UserAccount = {
    id: customAdmin?.id || 'USR-ADMIN',
    email: customAdmin?.email || 'admin@clubeembaixadores.ao',
    name: customAdmin?.name || 'Administrador Técnico',
    role: 'admin_tecnico',
    active: true,
    phone: customAdmin?.phone || '+244 923 111 222',
    createdAt: now,
  };

  const cleanState: ClubDatabaseState = {
    users: [admin],
    members: [],
    fees: [],
    accounts: [
      {
        id: 'ACC-1',
        name: 'Caixa Geral',
        initialBalanceInCents: 0,
        currentBalanceInCents: 0,
        active: true,
        type: 'caixa',
      },
    ],
    receipts: [],
    expenses: [],
    monthlyClosings: [],
    activities: [],
    classes: [],
    specialties: [],
    trainingProgress: [],
    documents: [],
    circulars: [],
    paymentProofs: [],
    messages: [],
    auditLogs: [
      {
        id: `AUD-INIT-${Date.now()}`,
        timestamp: now,
        actorUserId: admin.id,
        actorName: admin.name,
        actorRole: 'admin_tecnico',
        module: 'audit',
        action: 'REINICIALIZACAO_SISTEMA_ZERO',
        details: 'Sistema reiniciado do zero pelo Administrador. Todos os dados foram eliminados: sem membros, sem dinheiro (0 Kz), sem documentos, sem mensagens, sem registos de eliminação de membros e sem módulos/medalhas. Conta única mantida como Administrador Técnico.',
        reason: 'Reinício integral de sistema do zero solicitado pelo Administrador.',
      },
    ],
    settings: {
      clubName: 'Clube de Embaixadores',
      city: 'IASD Central de Talatona',
      country: 'Angola',
      currency: 'Kz',
      currentYear: new Date().getFullYear(),
      departments: [],
      units: [],
      memberCategories: {
        embaixador: 'Embaixador',
        lider: 'Líder',
        aspirante: 'Aspirante',
      },
      classes: [],
      documentTemplates: INITIAL_SETTINGS.documentTemplates,
    },
    currentUser: admin,
    notifications: [],
    deletionRequests: [],
    chaplaincyRequests: [],
    suggestions: [],
    associateDirectives: [],
    teamEvaluations: [],
    quotaWaivers: [],
    enrollmentRequests: [],
    updatedAt: now,
  };

  return cleanState;
}

/**
 * Limpeza do sistema para liberação de armazenamento na nuvem:
 * Mantém exclusivamente:
 * - Saldo das contas bancárias (accounts com saldos currentBalanceInCents intactos)
 * - Membros registados ativos (members ativos intactos; elimina arquivados/inativos)
 * - Contas de login no sistema (users intactos)
 * - Configurações e catálogo formativo (settings, classes, specialties)
 *
 * Elimina integralmente para liberar espaço:
 * - Todos os documentos oficiais gerados pelo sistema e seus arquivos
 * - Comprovativos de pagamento reportados no portal (mantendo 100% intactos os uploads nas fichas dos membros)
 * - Todas as atividades, reuniões, tarefas e atas
 * - Todas as sugestões confidenciais enviadas por membros à Direção
 * - Todos os avisos, editais, publicações e relatórios
 * - Todas as solicitações de membros e pedidos de capelania
 * - Todos os recibos oficiais emitidos
 * - Todas as despesas e aprovações
 */
export function cleanSystemStorageSpace(
  currentState: ClubDatabaseState,
  actorUser?: UserAccount,
  referenceDateStr?: string
): ClubDatabaseState {
  const now = getNowISOString();
  const _actor = actorUser || currentState.currentUser;
  const cleanupDateStr = referenceDateStr || getTodayISODate();

  const approvedEnrollments = (currentState.enrollmentRequests || []).filter(
    (req) => req && req.status === 'aprovado'
  );

  // Consolida a situação exata de quotas de cada membro ativo antes de apagar recibos e logs,
  // preservando integralmente todos os uploads feitos nas fichas dos membros.
  const preQuotaConfig = resolveQuotaConfig(currentState.settings, currentState.fees || []);
  const activeMembersWithCarryOver = currentState.members
    .filter((m) => m.status !== 'arquivado' && m.status !== 'inativo')
    .map((m) => {
      const matchedApprovedReq = approvedEnrollments.find(
        (req) =>
          (req.createdMemberId && req.createdMemberId === m.id) ||
          (m.enrollmentProtocol && req.protocolNumber === m.enrollmentProtocol)
      );

      const resolvedBiBase64 = m.biDocumentBase64 || matchedApprovedReq?.biDocumentBase64;
      const resolvedBiName = m.biDocumentFileName || matchedApprovedReq?.biDocumentFileName;
      const resolvedPhotoBase64 = m.photoDocumentBase64 || matchedApprovedReq?.photoDocumentBase64;
      const resolvedPhotoName = m.photoDocumentFileName || matchedApprovedReq?.photoDocumentFileName;
      const resolvedPhotoUrl =
        m.photoUrl ||
        (resolvedPhotoBase64?.startsWith('data:image/') ? resolvedPhotoBase64 : undefined);

      const summary = calculateMemberQuotaSummary(
        m,
        preQuotaConfig,
        currentState.fees || [],
        currentState.receipts || [],
        cleanupDateStr,
        currentState.quotaWaivers || []
      );
      return {
        ...m,
        ...(resolvedBiBase64 ? { biDocumentBase64: resolvedBiBase64 } : {}),
        ...(resolvedBiName ? { biDocumentFileName: resolvedBiName } : {}),
        ...(resolvedPhotoBase64 ? { photoDocumentBase64: resolvedPhotoBase64 } : {}),
        ...(resolvedPhotoName ? { photoDocumentFileName: resolvedPhotoName } : {}),
        ...(resolvedPhotoUrl ? { photoUrl: resolvedPhotoUrl } : {}),
        ...(Array.isArray(m.attachedDocuments) ? { attachedDocuments: m.attachedDocuments } : {}),
        quotaCarryOver: {
          snapshotDate: cleanupDateStr,
          debtInCents: summary.balanceDueInCents,
          creditInCents: summary.creditInCents,
          waivedInCents: 0,
        },
      };
    });

  const nextCycleStartDate = advanceCycleStartDateAfterCleanup(preQuotaConfig, cleanupDateStr);
  const nextSettings: ClubSettings = {
    ...currentState.settings,
    quotaConfig: {
      ...preQuotaConfig,
      cycleStartDate: nextCycleStartDate,
      updatedAt: now,
      updatedByUserId: _actor?.id,
      updatedByName: _actor?.name,
    },
  };

  const cleanedState: ClubDatabaseState = {
    ...currentState,
    // Elimina ficheiros pesados, documentos gerados, histórico de pagamentos/isenções e todos os registos de auditoria
    circulars: [],
    paymentProofs: [],
    activities: [],
    receipts: [],
    expenses: [],
    monthlyClosings: [],
    auditLogs: [],
    deletionRequests: [],
    messages: [],
    documents: [],
    // Preserva saldos bancários, membros ativos (com situação de quotas consolidada), utilizadores e configurações
    accounts: currentState.accounts.map((acc) => ({
      ...acc,
      currentBalanceInCents: acc.currentBalanceInCents,
    })),
    members: activeMembersWithCarryOver,
    users: currentState.users,
    settings: nextSettings,
    classes: currentState.classes,
    specialties: currentState.specialties,
    trainingProgress: currentState.trainingProgress,
    notifications: [],
    chaplaincyRequests: [],
    suggestions: [],
    associateDirectives: [],
    teamEvaluations: [],
    quotaWaivers: [],
    musicItems: [],
    // Limpeza de solicitações de inscrição:
    // Elimina todas as solicitações já analisadas ('aprovado' e 'rejeitado') para liberar espaço.
    // Aquelas que estão pendentes ou em estado de análise permanecem intactas com todos os documentos anexados.
    enrollmentRequests: (currentState.enrollmentRequests || []).filter(
      (req) => req.status === 'pendente' || req.status === 'em_analise'
    ),
    currentUser: currentState.currentUser,
    updatedAt: now,
  };

  return cleanedState;
}


/**
 * Gera próximo número sequencial de documento por tipo e ano
 * Exemplo: REC-2026-0003, ATA-2026-0002, DEC-2026-0002
 */
export function generateNextDocumentNumber(
  prefix: string,
  year: number,
  existingNumbers: string[]
): string {
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`);
  let maxSeq = 0;

  for (const num of existingNumbers) {
    const match = num.match(pattern);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  const nextSeq = (maxSeq + 1).toString().padStart(4, '0');
  return `${prefix}-${year}-${nextSeq}`;
}

/**
 * Inicia a abertura de um novo ano institucional.
 * Mantém dados históricos, não liquida dívidas e não apaga movimentos anteriores.
 */
export function openNewFiscalYear(currentState: ClubDatabaseState, newYear: number): ClubDatabaseState {
  const newState = {
    ...currentState,
    settings: {
      ...currentState.settings,
      currentYear: newYear,
    },
    updatedAt: getNowISOString(),
  };

  return newState;
}

/**
 * Validador de unicidade de número manual de membro
 */
export function isMemberNumberUnique(
  manualNumber: string,
  members: Member[],
  ignoreMemberId?: string
): boolean {
  if (!manualNumber) return true;
  const clean = String(manualNumber).trim().toLowerCase();
  return !members.some(
    (m) => m.id !== ignoreMemberId && String(m.manualNumber || '').trim().toLowerCase() === clean
  );
}

/**
 * Deteção de duplicados de membro por Bilhete de Identidade (B.I.) ou Nome + Data de Nascimento
 */
export function findPotentialDuplicateMember(
  identityCardNumber: string,
  fullName: string,
  birthDate: string,
  members: Member[],
  email?: string,
  phone?: string,
  ignoreMemberId?: string
): Member | undefined {
  const cleanBI = String(identityCardNumber || '').replace(/[\s.-]+/g, '').trim().toUpperCase();
  const cleanName = String(fullName || '').trim().toLowerCase();
  const cleanBirth = String(birthDate || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPhone = String(phone || '').trim().replace(/\s+/g, '');

  return members.find((m) => {
    if (m.id === ignoreMemberId) return false;
    // B.I. idêntico (normalizado sem espaços, pontos ou hífens)
    const memberBI = String(m.identityCardNumber || '').replace(/[\s.-]+/g, '').trim().toUpperCase();
    if (cleanBI && memberBI && memberBI === cleanBI) {
      return true;
    }
    // Nome idêntico e mesma data de nascimento
    if (cleanName && cleanBirth && String(m.fullName || '').trim().toLowerCase() === cleanName && m.birthDate === cleanBirth) {
      return true;
    }
    // E-mail idêntico
    if (cleanEmail && m.email && String(m.email).trim().toLowerCase() === cleanEmail) {
      return true;
    }
    // Telefone idêntico
    if (cleanPhone && m.phone && String(m.phone).trim().replace(/\s+/g, '') === cleanPhone) {
      return true;
    }
    return false;
  });
}
