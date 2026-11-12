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
      const parsed = JSON.parse(raw);
      // Validar integridade básica
      if (parsed.members && parsed.receipts && parsed.users) {
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
        if (parsed.settings) {
          parsed.settings.memberCategories = {
            embaixador: 'Embaixador',
            lider: 'Líder',
            aspirante: 'Aspirante',
          };
          if (parsed.settings.units) {
            parsed.settings.units = parsed.settings.units.map((u: any) => {
              let cat = u.category;
              if (cat === 'desbravador' || cat === 'aventureiro') cat = 'aspirante';
              else if (cat === 'conselheiro' || cat === 'apoio') cat = 'lider';
              else if (cat !== 'mista' && !allowedCategories.includes(cat)) cat = 'mista';
              return { ...u, category: cat };
            });
          }
        }
        if (parsed.fees) {
          parsed.fees = parsed.fees.map((f: any) => {
            if (f.targetCategory === 'desbravador' || f.targetCategory === 'aventureiro') {
              return { ...f, targetCategory: 'aspirante', title: f.title.replace('Desbravadores', 'Aspirantes').replace('Aventureiros', 'Aspirantes') };
            }
            return f;
          });
        }

        // Integridade e migração de classes curriculares
        if (!parsed.classes || !Array.isArray(parsed.classes) || parsed.classes.length === 0) {
          parsed.classes = INITIAL_CLASSES;
        } else {
          parsed.classes = parsed.classes.map((c: any) => {
            const initialMatch = INITIAL_CLASSES.find(ic => ic.id === c.id || ic.title?.toLowerCase() === (c.title || c.name)?.toLowerCase());
            const reqs = Array.isArray(c.requirements) && c.requirements.length > 0
              ? c.requirements
              : (initialMatch?.requirements || Array.from({ length: c.requirementsCount || 8 }, (_, i) => `Requisito Oficial #${i + 1}: Demonstração prática e curricular`));
            return {
              id: c.id,
              code: c.code || initialMatch?.code || c.id,
              title: c.title || c.name || initialMatch?.title || 'Classe Oficial',
              minimumAge: c.minimumAge || initialMatch?.minimumAge || 10,
              requirementsCount: reqs.length,
              requirements: reqs,
              active: c.active !== undefined ? c.active : true,
            };
          });

          // Adicionar quaisquer classes padrão essenciais ausentes
          INITIAL_CLASSES.forEach(ic => {
            if (!parsed.classes.some((c: any) => c.id === ic.id)) {
              parsed.classes.push(ic);
            }
          });
        }

        // Integridade e migração de especialidades
        if (!parsed.specialties || !Array.isArray(parsed.specialties) || parsed.specialties.length === 0) {
          parsed.specialties = INITIAL_SPECIALTIES;
        } else {
          parsed.specialties = parsed.specialties.map((s: any) => {
            const initialMatch = INITIAL_SPECIALTIES.find(is => is.id === s.id || is.title?.toLowerCase() === (s.title || s.name)?.toLowerCase());
            const reqs = Array.isArray(s.requirements) && s.requirements.length > 0
              ? s.requirements
              : (initialMatch?.requirements || Array.from({ length: s.requirementsCount || 6 }, (_, i) => `Requisito da Especialidade #${i + 1}: Demonstração prática e teórica`));
            return {
              id: s.id,
              code: s.code || initialMatch?.code || s.id,
              title: s.title || s.name || initialMatch?.title || 'Especialidade',
              category: s.category || initialMatch?.category || 'habilidades',
              requirementsCount: reqs.length,
              requirements: reqs,
              active: s.active !== undefined ? s.active : true,
            };
          });

          // Adicionar quaisquer especialidades padrão ausentes
          INITIAL_SPECIALTIES.forEach(is => {
            if (!parsed.specialties.some((s: any) => s.id === is.id)) {
              parsed.specialties.push(is);
            }
          });
        }

        // Integridade do progresso de formação
        if (!parsed.trainingProgress || !Array.isArray(parsed.trainingProgress) || parsed.trainingProgress.length === 0) {
          parsed.trainingProgress = INITIAL_TRAINING_PROGRESS;
        }

        // Limpeza de campos obsoletos de bloqueio se ainda existirem no armazenamento local
        if ('deletedUserEmails' in parsed) {
          delete parsed.deletedUserEmails;
        }
        if ('deletedUserIds' in parsed) {
          delete parsed.deletedUserIds;
        }

        parsed.notifications = parsed.notifications || INITIAL_NOTIFICATIONS;
        parsed.deletionRequests = parsed.deletionRequests || INITIAL_DELETION_REQUESTS;
        parsed.chaplaincyRequests = parsed.chaplaincyRequests || INITIAL_CHAPLAINCY_REQUESTS;
        parsed.suggestions = parsed.suggestions || INITIAL_SUGGESTIONS;
        parsed.circulars = parsed.circulars || [];
        parsed.messages = parsed.messages || [];
        
        // Deduplicação de fechos mensais
        if (parsed.monthlyClosings && Array.isArray(parsed.monthlyClosings)) {
          const uniqueClosings = new Map();
          parsed.monthlyClosings.forEach((c: any) => {
             uniqueClosings.set(c.id, c);
          });
          parsed.monthlyClosings = Array.from(uniqueClosings.values());
        }
        
        return parsed;

      }
    }
  } catch (e) {
    console.error('Falha ao ler dados do localStorage:', e);
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
