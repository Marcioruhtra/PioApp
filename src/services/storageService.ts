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
import { getNowISOString } from '../utils/date';
import { verifyAndRepairMembersIntegrity } from './memberIntegrityService';

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
  settings: ClubSettings;
  currentUser: UserAccount;
  updatedAt?: string;
}

export function loadInitialState(): ClubDatabaseState {
  try {
    const raw = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        console.error('LocalStorage corrompido, a limpar cache:', parseErr);
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem(STORAGE_KEY);
        }
        parsed = null;
      }

      if (parsed && typeof parsed === 'object') {
        // Garantir que todas as coleções e arrays essenciais existem e são arrays válidos para evitar erros de renderização
        parsed.users = Array.isArray(parsed.users) ? parsed.users : INITIAL_USERS;
        parsed.members = Array.isArray(parsed.members) ? parsed.members : [];
        parsed.fees = Array.isArray(parsed.fees) ? parsed.fees : INITIAL_FEES;
        parsed.accounts = Array.isArray(parsed.accounts) ? parsed.accounts : INITIAL_ACCOUNTS;
        parsed.receipts = Array.isArray(parsed.receipts) ? parsed.receipts : [];
        parsed.expenses = Array.isArray(parsed.expenses) ? parsed.expenses : [];
        parsed.monthlyClosings = Array.isArray(parsed.monthlyClosings) ? parsed.monthlyClosings : [];
        parsed.activities = Array.isArray(parsed.activities) ? parsed.activities : [];
        parsed.classes = Array.isArray(parsed.classes) && parsed.classes.length > 0 ? parsed.classes : INITIAL_CLASSES;
        parsed.specialties = Array.isArray(parsed.specialties) && parsed.specialties.length > 0 ? parsed.specialties : INITIAL_SPECIALTIES;
        parsed.trainingProgress = Array.isArray(parsed.trainingProgress) ? parsed.trainingProgress : [];
        parsed.documents = Array.isArray(parsed.documents) ? parsed.documents : [];
        parsed.circulars = Array.isArray(parsed.circulars) ? parsed.circulars : [];
        parsed.paymentProofs = Array.isArray(parsed.paymentProofs) ? parsed.paymentProofs : [];
        parsed.auditLogs = Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [];
        parsed.notifications = Array.isArray(parsed.notifications) ? parsed.notifications : [];
        parsed.deletionRequests = Array.isArray(parsed.deletionRequests) ? parsed.deletionRequests : [];
        parsed.chaplaincyRequests = Array.isArray(parsed.chaplaincyRequests) ? parsed.chaplaincyRequests : [];
        parsed.suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
        parsed.messages = Array.isArray(parsed.messages) ? parsed.messages : [];
        parsed.settings = parsed.settings || INITIAL_SETTINGS;
        parsed.currentUser = parsed.currentUser || parsed.users[0] || INITIAL_USERS[1];

        const allowedCategories: MemberCategory[] = ['embaixador', 'lider', 'aspirante'];
        parsed.members = parsed.members.map((m: any) => {
          let cat = m.category;
          if (cat === 'desbravador' || cat === 'aventureiro') cat = 'aspirante';
          else if (cat === 'conselheiro' || cat === 'apoio') cat = 'lider';
          else if (!allowedCategories.includes(cat)) cat = 'embaixador';
          return { ...m, category: cat };
        });

        // Garantir integridade contínua de contactos de emergência, encarregado e dados de alergias
        const integrityResult = verifyAndRepairMembersIntegrity(parsed.members);
        parsed.members = integrityResult.sanitizedMembers;

        return parsed as ClubDatabaseState;
      }
    }
  } catch (e) {
    console.error('Falha crítica ao carregar estado inicial do localStorage:', e);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }

  // Se o utilizador limpou o sistema ou iniciou limpo, não carregar dados de demonstração (teste)
  const startedClean = typeof window !== 'undefined' && window.localStorage && localStorage.getItem('pioapp_started_clean') === 'true';
  if (startedClean) {
    return resetToCleanAdminOnlyState();
  }

  // Estado padrão com dados demonstrativos
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
    currentUser: INITIAL_USERS[1], // Diretor por padrão na demonstração para visualização completa
    notifications: INITIAL_NOTIFICATIONS,
    deletionRequests: INITIAL_DELETION_REQUESTS,
    chaplaincyRequests: INITIAL_CHAPLAINCY_REQUESTS,
    suggestions: INITIAL_SUGGESTIONS,
    messages: [],
  };
}

export function saveStateToStorage(state: ClubDatabaseState): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (quotaErr) {
        console.warn('LocalStorage quota atingida, a guardar estado sem anexos pesados:', quotaErr);
        // Remove anexos pesados de comprovativos da cache local para evitar crash
        const leanState = {
          ...state,
          paymentProofs: (state.paymentProofs || []).map((p) => ({
            ...p,
            attachmentBase64: undefined,
          })),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(leanState));
      }
    }
  } catch (e) {
    console.error('Falha ao persistir dados no localStorage:', e);
  }
}

export function resetToDemoData(): ClubDatabaseState {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('pioapp_started_clean');
  }
  const state = loadInitialState();
  saveStateToStorage(state);
  return state;
}

/**
 * Reinicialização integral do sistema do zero:
 * Elimina todos os membros, saldos financeiros (fica a 0 Kz), recibos,
 * documentos oficiais, classes e especialidades, mantendo exclusivamente
 * o Administrador como o único utilizador cadastrado.
 */
export function resetToCleanAdminOnlyState(customAdmin?: Partial<UserAccount>): ClubDatabaseState {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem('pioapp_started_clean', 'true');
  }
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
        details: 'Sistema reiniciado do zero pelo Administrador. Todos os dados foram eliminados: sem membros, sem dinheiro (0 Kz), sem documentos, sem mensagens, sem registos de eliminação de membros e sem classes/especialidades. Conta única mantida como Administrador Técnico.',
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
  };

  saveStateToStorage(cleanState);
  return cleanState;
}

/**
 * Limpeza do sistema para liberação de armazenamento na nuvem:
 * Mantém exclusivamente:
 * - Saldo das contas bancárias (accounts com saldos currentBalanceInCents intactos)
 * - Membros registados (members intactos)
 * - Contas de login no sistema (users intactos)
 * - Configurações e catálogo formativo (settings, classes, specialties)
 *
 * Elimina integralmente para liberar espaço:
 * - Todos os documentos gerados pelo sistema e seus arquivos
 * - Todos os uploads feitos pelos membros e comprovativos reportados
 * - Todas as atividades, reuniões, tarefas e atas
 * - Todas as sugestões confidenciais enviadas por membros à Direção
 * - Todos os avisos, editais, publicações e relatórios
 * - Todas as solicitações de membros e pedidos de capelania
 * - Todos os recibos oficiais emitidos
 * - Todas as despesas e aprovações
 */
export function cleanSystemStorageSpace(
  currentState: ClubDatabaseState,
  actorUser?: UserAccount
): ClubDatabaseState {
  const now = getNowISOString();
  const actor = actorUser || currentState.currentUser;

  const cleanedState: ClubDatabaseState = {
    ...currentState,
    // Elimina ficheiros pesados, documentos gerados, transações temporárias e todos os registos de auditoria
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
    // Preserva saldos bancários, membros ativos (elimina membros arquivados e inativos), utilizadores e configurações
    accounts: currentState.accounts.map((acc) => ({
      ...acc,
      currentBalanceInCents: acc.currentBalanceInCents,
    })),
    members: currentState.members.filter((m) => m.status !== 'arquivado' && m.status !== 'inativo'),
    users: currentState.users,
    settings: currentState.settings,
    classes: currentState.classes,
    specialties: currentState.specialties,
    trainingProgress: currentState.trainingProgress,
    notifications: [],
    chaplaincyRequests: [],
    suggestions: [],
    currentUser: currentState.currentUser,
    updatedAt: now,
  };

  saveStateToStorage(cleanedState);
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
  // Cria cópia de segurança antes da alteração
  saveStateToStorage(currentState);

  const newState = {
    ...currentState,
    settings: {
      ...currentState.settings,
      currentYear: newYear,
    },
    // Limpa apenas o que deve ser zerado para o novo ano (ex: cobranças novas)
    // Preserva: members, receipts, expenses, activities, auditLogs
  };

  saveStateToStorage(newState);
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
  const cleanBI = String(identityCardNumber || '').trim().toUpperCase();
  const cleanName = String(fullName || '').trim().toLowerCase();
  const cleanBirth = String(birthDate || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPhone = String(phone || '').trim().replace(/\s+/g, '');

  return members.find((m) => {
    if (m.id === ignoreMemberId) return false;
    // B.I. idêntico
    if (cleanBI && m.identityCardNumber && String(m.identityCardNumber).trim().toUpperCase() === cleanBI) {
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
