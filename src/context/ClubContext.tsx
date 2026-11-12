import React, { createContext, useContext, useState, useEffect } from 'react';
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
  ModuleName,
  PermissionAction,
  MemberCategory,
  DeletionRequest,
  ClubNotification,
  ChaplaincyRequest,
  ChaplaincyCategory,
  ChaplaincyStatus,
  MemberSuggestion,
  SuggestionCategory,
  SuggestionStatus,
  Message,
  Circular,
} from '../types';
import {
  ClubDatabaseState,
  loadInitialState,
  saveStateToStorage,
  resetToDemoData,
  resetToCleanAdminOnlyState,
  cleanSystemStorageSpace,
  generateNextDocumentNumber,
  isMemberNumberUnique,
  findPotentialDuplicateMember,
  openNewFiscalYear as openNewFiscalYearService,
} from '../services/storageService';
import { hasPermission, ROLE_PERMISSIONS_MATRIX, updatePermission, syncPermissionsMatrix, ROLE_LABELS } from '../services/permissionService';
import { createAuditLog } from '../services/auditService';
import { getNowISOString, formatDateAO, generateManualNumber } from '../utils/date';
import { formatKz } from '../utils/currency';
import { db } from '../firebase';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { verifyAndRepairMembersIntegrity, sanitizeMemberIntegrity, IntegrityCheckResult } from '../services/memberIntegrityService';
import { ToastMessage } from '../components/common/ToastContainer';
import { playNotificationSound } from '../utils/notificationSound';
import { showNativeNotification } from '../services/pushService';
import { isNotificationAuthorizedForUser } from '../utils/notificationSecurity';

interface ClubContextValue {
  state: ClubDatabaseState;
  currentUser: UserAccount;
  setCurrentUser: (user: UserAccount, remember?: boolean) => void;
  switchRole: (role: RoleType) => void;
  can: (module: ModuleName, action: PermissionAction) => boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Membros
  addMember: (memberData: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>) => { success: boolean; error?: string };
  updateMember: (id: string, updates: Partial<Member>) => { success: boolean; error?: string };
  archiveMember: (id: string, reason: string, directionAuthorized?: boolean) => { success: boolean; error?: string };
  unarchiveMember: (id: string) => { success: boolean; error?: string };
  renewMemberAnnual: (id: string, year: number) => { success: boolean; error?: string };
  requestMemberOperation: (targetMemberId: string, operationType: 'arquivamento' | 'eliminacao', reason: string) => { success: boolean; requestId?: string; error?: string };
  decideMemberOperationRequest: (requestId: string, decision: 'aprovado' | 'rejeitado', decisionReason?: string) => { success: boolean; error?: string };
  executeApprovedMemberOperation: (requestId: string) => { success: boolean; error?: string };
  uploadMemberPhoto: (memberId: string, photoBase64: string) => { success: boolean; error?: string };
  deleteMemberPhoto: (memberId: string) => { success: boolean; error?: string };

  // Tesouraria
  createReceipt: (data: {
    memberId: string;
    feeDefinitionId: string;
    periodLabel: string;
    amountPaidInCents: number;
    paymentMethod: PaymentReceipt['paymentMethod'];
    referenceOrProof?: string;
    notes?: string;
    customDonorName?: string;
    accountId?: string;
    activityId?: string;
  }) => { success: boolean; receipt?: PaymentReceipt; error?: string };
  cancelReceipt: (id: string, reason: string) => { success: boolean; error?: string };
  createExpense: (data: {
    title: string;
    description: string;
    category: string;
    amountInCents: number;
    accountId?: string;
  }) => { success: boolean; error?: string };
  approveExpense: (id: string, reason?: string) => { success: boolean; error?: string };
  rejectExpense: (id: string, reason: string) => { success: boolean; error?: string };
  payExpense: (id: string, accountId: string, proofUrl?: string) => { success: boolean; error?: string };
  closeFiscalMonth: (year: number, month: number) => { success: boolean; error?: string };
  reopenFiscalMonth: (id: string, reason: string) => { success: boolean; error?: string };

  // Atividades e Reuniões
  createActivity: (data: Omit<ClubActivity, 'id' | 'createdAt' | 'tasks' | 'attendees'>) => { success: boolean; error?: string; activity?: ClubActivity; id?: string };
  updateActivityStage: (id: string, stage: ClubActivity['stage']) => { success: boolean; error?: string };
  deleteActivity: (id: string) => { success: boolean; error?: string };
  toggleAttendance: (activityId: string, memberId: string, present: boolean, notes?: string) => void;
  addTaskToActivity: (activityId: string, task: Omit<ClubActivity['tasks'][0], 'id'>) => void;
  updateTaskStatus: (activityId: string, taskId: string, status: ClubActivity['tasks'][0]['status']) => void;
  saveMinuteToActivity: (activityId: string, minuteData: Omit<NonNullable<ClubActivity['minute']>, 'id' | 'minuteNumber'>) => { success: boolean; minuteNumber?: string };

  // Formação
  updateTrainingProgress: (
    progressId: string,
    completedReqs: number[],
    notes?: string
  ) => { success: boolean; error?: string };
  createTrainingProgress: (
    memberId: string,
    type: 'classe' | 'especialidade',
    targetId: string,
    targetTitle: string,
    totalRequirements: number
  ) => { success: boolean; error?: string };
  approveFinalTraining: (progressId: string) => { success: boolean; error?: string };
  revokeTrainingApproval: (progressId: string) => { success: boolean; error?: string };
  deleteTrainingProgress: (progressId: string) => { success: boolean; error?: string };

  // Documentos
  createOfficialDoc: (
    type: OfficialDocument['documentType'],
    title: string,
    content: Record<string, unknown>,
    issuedToName?: string,
    issuedToMemberId?: string
  ) => { success: boolean; docNumber?: string; error?: string };
  cancelOfficialDoc: (id: string, reason: string) => { success: boolean; error?: string };

  // Portal do Membro & Pedidos
  submitPortalRequest: (data: {
    category: MemberPortalRequest['category'];
    subject: string;
    details: string;
  }) => { success: boolean; error?: string };
  respondToRequest: (requestId: string, status: MemberPortalRequest['status'], responseNotes: string) => { success: boolean; error?: string };
  submitPaymentProof: (data: {
    feeDefinitionId: string;
    feeTitle: string;
    amountInCents: number;
    paymentMethod: PaymentProofReport['paymentMethod'];
    referenceCode: string;
    paymentDate: string;
    attachmentFileName: string;
    attachmentBase64?: string;
    accountId?: string;
  }) => { success: boolean; error?: string };
  verifyPaymentProof: (proofId: string, approve: boolean, rejectionReason?: string) => { success: boolean; error?: string };
  submitChaplaincyRequest: (data: { category: ChaplaincyCategory; subject: string; message: string; confidential: boolean }) => { success: boolean; error?: string };
  respondToChaplaincyRequest: (requestId: string, status: ChaplaincyStatus, responseNotes: string) => { success: boolean; error?: string };

  // Sugestões à Direção (Canal Confidencial Membro ↔ Diretor)
  submitMemberSuggestion: (data: {
    category: SuggestionCategory;
    subject: string;
    content: string;
    isAnonymous?: boolean;
  }) => { success: boolean; error?: string };
  markSuggestionAsViewed: (suggestionId: string) => { success: boolean; error?: string };
  respondToSuggestion: (suggestionId: string, responseContent: string, markAsViewed?: boolean) => { success: boolean; error?: string };
  deleteSuggestion: (suggestionId: string) => { success: boolean; error?: string };

  addAnnouncement: (title: string, content: string, urgency: ClubAnnouncement['urgency'], targetAudience: ClubAnnouncement['targetAudience']) => void;
  // Circulares
  createCircular: (data: Omit<Circular, 'id' | 'publishedAt' | 'publishedByUserId' | 'publishedByName' | 'readBy'>) => { success: boolean; error?: string };
  markCircularAsRead: (circularId: string) => void;
  deleteCircular: (circularId: string) => void;

  // Notificações
  addNotification: (data: Omit<ClubNotification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationAsRead: (notificationId: string) => void;
  markAllNotificationsAsRead: () => void;
  deleteNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  toasts: ToastMessage[];
  addToast: (title: string, message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
  soundEnabled: boolean;
  toggleSoundEnabled: () => void;

  // Utilizadores & Administração
  createUserAccount: (user: Omit<UserAccount, 'id' | 'createdAt'>) => { success: boolean; error?: string };
  toggleUserActive: (userId: string) => void;
  deleteUserAccount: (userId: string) => { success: boolean; error?: string };
  updateSettings: (newSettings: Partial<ClubSettings>) => void;
  openNewFiscalYear: (year: number) => { success: boolean; error?: string };
  manualPasswordReset: (userId: string, newPassword: string) => { success: boolean; error?: string };
  requestPasswordReset: (identifier: string) => { success: boolean; error?: string };
  resetAllDemoData: () => void;
  resetToCleanAdminOnlyState: () => { success: boolean; error?: string };
  cleanSystemStorageSpace: () => Promise<{ success: boolean; error?: string }>;
  importBackupJson: (jsonData: string) => { success: boolean; error?: string };
  exportBackupJson: () => string;
  updateRolePermission: (role: RoleType, module: ModuleName, action: PermissionAction, add: boolean) => { success: boolean; error?: string };
  createFeeDefinition: (data: Omit<FeeDefinition, 'id'>) => { success: boolean; id?: string; error?: string };
  updateFeeDefinition: (id: string, data: Partial<FeeDefinition>) => { success: boolean; error?: string };
  createTrainingClass: (data: { title: string; code?: string; minimumAge: number; requirements?: string[] }) => { success: boolean; id?: string; error?: string };
  updateTrainingClass: (id: string, titleOrData: string | { title: string; code?: string; minimumAge?: number; requirements?: string[] }, minimumAge?: number, requirementsCount?: number) => { success: boolean; error?: string };
  deleteTrainingClass: (id: string) => { success: boolean; error?: string };
  createSpecialtyHonor: (data: { title: string; code?: string; category: SpecialtyHonor['category']; requirements?: string[] }) => { success: boolean; id?: string; error?: string };
  updateSpecialtyHonor: (id: string, titleOrData: string | { title: string; code?: string; category?: SpecialtyHonor['category']; requirements?: string[] }, category?: string, requirementsCount?: number) => { success: boolean; error?: string };
  deleteSpecialtyHonor: (id: string) => { success: boolean; error?: string };
  addUnit: (name: string, category: MemberCategory | 'mista', leaderUserId?: string) => { success: boolean; error?: string };
  updateUnit: (id: string, name: string, category: MemberCategory | 'mista', leaderUserId?: string) => { success: boolean; error?: string };
  deleteUnit: (id: string) => { success: boolean; error?: string };
  assignMemberToUnit: (memberId: string, unitOrTeam?: string) => { success: boolean; error?: string };
  deleteMember: (id: string, directionAuthorized?: boolean) => { success: boolean; error?: string };
  selfResetPassword: (newPassword: string) => { success: boolean; error?: string; nextAllowedDate?: string; daysRemaining?: number };
  updateMemberCategory: (memberId: string, category: MemberCategory) => { success: boolean; error?: string };
  createTreasuryAccount: (data: Omit<TreasuryAccount, 'id' | 'currentBalanceInCents' | 'active'>) => { success: boolean; id?: string; error?: string };
  deleteTreasuryAccount: (id: string) => { success: boolean; error?: string };
  deleteFeeDefinition: (id: string) => { success: boolean; error?: string };
  updateUserRole: (userId: string, newRole: RoleType) => { success: boolean; error?: string };
  updateUserAccount: (userId: string, data: Partial<UserAccount> & { manualNumber?: string }, newPassword?: string) => { success: boolean; error?: string };
  sendMessage: (data: Omit<Message, 'id' | 'createdAt' | 'read'>) => { success: boolean; error?: string };
  markMessageAsRead: (messageId: string, memberId: string) => void;
  replyToMessage: (messageId: string, content: string) => { success: boolean; error?: string };
  deleteMessage: (messageId: string) => { success: boolean; error?: string };
  syncFromCloud: (remoteState: Partial<ClubDatabaseState>) => void;
  forceSyncCloud: () => Promise<void>;
  runIntegrityVerification: () => Promise<{ success: boolean; result: IntegrityCheckResult }>;
  isQuotaExceeded?: boolean;
}

const ClubContext = createContext<ClubContextValue | undefined>(undefined);

const getInitialUserSession = (): UserAccount | null => {
  if (typeof window === 'undefined') return null;
  const local = localStorage.getItem('pioapp_current_user');
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (parsed && parsed.id) return parsed;
    } catch {}
  }
  const session = sessionStorage.getItem('pioapp_current_user');
  if (session) {
    try {
      const parsed = JSON.parse(session);
      if (parsed && parsed.id) return parsed;
    } catch {}
  }
  return null;
};

export const ClubProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ClubDatabaseState>(() => {
    const loaded = loadInitialState();
    if (loaded && loaded.settings) {
      loaded.settings.permissionsMatrix = syncPermissionsMatrix(loaded.settings.permissionsMatrix);
    }
    const savedUser = getInitialUserSession();
    if (savedUser) {
      loaded.currentUser = savedUser;
    }
    return loaded;
  });

  const isInitialMount = React.useRef(true);
  const isRemoteUpdateRef = React.useRef(false);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark') {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Escrita imediata e centralizada no Firestore com garantia de integridade estrita
  const pushToFirestore = async (stateToPush: ClubDatabaseState) => {
    try {
      const now = getNowISOString();
      const { currentUser: _localUser, ...cloudState } = stateToPush;
      delete (cloudState as any).deletedUserEmails;
      delete (cloudState as any).deletedUserIds;

      // Garantir integridade de emergência e dados médicos antes de enviar para a nuvem
      if (Array.isArray(cloudState.members) && cloudState.members.length > 0) {
        const integrityCheck = verifyAndRepairMembersIntegrity(cloudState.members);
        cloudState.members = integrityCheck.sanitizedMembers;
      }

      await setDoc(doc(db, 'club_data', 'main_state'), JSON.parse(JSON.stringify({
        ...cloudState,
        updatedAt: cloudState.updatedAt || now,
      })), { merge: true });
      setIsQuotaExceeded(false);
    } catch (err: any) {
      if (
        err?.code === 'resource-exhausted' ||
        err?.message?.includes('resource-exhausted') ||
        err?.message?.includes('Quota limit exceeded') ||
        err?.message?.includes('quota')
      ) {
        setIsQuotaExceeded(true);
        console.warn("Firestore quota reached. Running in local storage mode.");
      } else if (err?.code === 'permission-denied' || err?.message?.includes('permission')) {
        console.warn("Firestore permissions updating. Data saved securely in local storage.");
      } else {
        console.error("Firestore sync write error:", err);
      }
    }
  };

  // Sincronização externa direta (usado no login ou carregamento explícito) com verificação de integridade
  const syncFromCloud = (remoteState: Partial<ClubDatabaseState>) => {
    setState((prev) => {
      isRemoteUpdateRef.current = true;
      const sanitizedRemote = { ...remoteState };
      if (Array.isArray(sanitizedRemote.members)) {
        sanitizedRemote.members = verifyAndRepairMembersIntegrity(sanitizedRemote.members).sanitizedMembers;
      }

      // Smart-merge para evitar que dados locais criados recentemente sejam apagados por cópia remota antiga
      const remoteActIds = new Set((sanitizedRemote.activities || []).map((a) => a.id));
      const localPendingActs = (prev.activities || []).filter((a) => !remoteActIds.has(a.id));
      const mergedActivities = [...(sanitizedRemote.activities || []), ...localPendingActs];

      const remoteExpIds = new Set((sanitizedRemote.expenses || []).map((e) => e.id));
      const localPendingExps = (prev.expenses || []).filter((e) => !remoteExpIds.has(e.id));
      const mergedExpenses = [...(sanitizedRemote.expenses || []), ...localPendingExps];

      const remoteMemIds = new Set((sanitizedRemote.members || []).map((m) => m.id));
      const localPendingMems = (prev.members || []).filter((m) => !remoteMemIds.has(m.id));
      const mergedMembers = [...(sanitizedRemote.members || []), ...localPendingMems];

      const merged = {
        ...prev,
        ...sanitizedRemote,
        activities: mergedActivities.length > 0 ? mergedActivities : prev.activities,
        expenses: mergedExpenses.length > 0 ? mergedExpenses : prev.expenses,
        members: mergedMembers.length > 0 ? mergedMembers : prev.members,
        currentUser: prev.currentUser, // Preserva a sessão local deste dispositivo
      };
      saveStateToStorage(merged);
      return merged;
    });
  };

  const forceSyncCloud = async () => {
    // Sanitizar membros antes de forçar sincronização
    const integrity = verifyAndRepairMembersIntegrity(state.members);
    const updatedState = { ...state, members: integrity.sanitizedMembers };
    if (integrity.hasIssues) {
      setState(updatedState);
      saveStateToStorage(updatedState);
    }
    await pushToFirestore(updatedState);
  };

  // Executa verificação ativa de integridade em todos os membros e sincroniza com o banco de dados principal
  const runIntegrityVerification = async (): Promise<{ success: boolean; result: IntegrityCheckResult }> => {
    const checkResult = verifyAndRepairMembersIntegrity(state.members);
    if (checkResult.hasIssues) {
      const now = getNowISOString();
      const updatedState = { ...state, members: checkResult.sanitizedMembers, updatedAt: now };
      setState(updatedState);
      saveStateToStorage(updatedState);
      await pushToFirestore(updatedState);
      logAction(
        'audit',
        'VERIFICACAO_INTEGRIDADE',
        `Verificação de integridade executada: ${checkResult.fixedCount} membro(s) sincronizados com o banco de dados principal do Firestore.`
      );
    } else {
      // Forçar garantia com o Firestore
      await pushToFirestore(state);
    }
    return { success: true, result: checkResult };
  };

  // 1. CARREGAMENTO INICIAL DIRETO DA NUVEM (CLOUD-FIRST NO ARRANQUE)
  useEffect(() => {
    getDoc(doc(db, 'club_data', 'main_state')).then((snap: any) => {
      if (snap.exists()) {
        const cloudData = snap.data() as ClubDatabaseState;
        if (cloudData && Array.isArray(cloudData.users) && cloudData.users.length > 0) {
          isRemoteUpdateRef.current = true;
          if (Array.isArray(cloudData.members)) {
            cloudData.members = verifyAndRepairMembersIntegrity(cloudData.members).sanitizedMembers;
          }
          setState((prev) => {
            const remoteTime = cloudData.updatedAt ? new Date(cloudData.updatedAt).getTime() : 0;
            const prevTime = prev.updatedAt ? new Date(prev.updatedAt).getTime() : 0;
            if (prevTime > 0 && remoteTime > 0 && remoteTime < prevTime) {
              return prev;
            }

            const remoteActIds = new Set((cloudData.activities || []).map((a) => a.id));
            const localPendingActs = (prev.activities || []).filter((a) => !remoteActIds.has(a.id));
            const mergedActivities = [...(cloudData.activities || []), ...localPendingActs];

            const remoteExpIds = new Set((cloudData.expenses || []).map((e) => e.id));
            const localPendingExps = (prev.expenses || []).filter((e) => !remoteExpIds.has(e.id));
            const mergedExpenses = [...(cloudData.expenses || []), ...localPendingExps];

            const remoteMemIds = new Set((cloudData.members || []).map((m) => m.id));
            const localPendingMems = (prev.members || []).filter((m) => !remoteMemIds.has(m.id));
            const mergedMembers = [...(cloudData.members || []), ...localPendingMems];

            const merged = {
              ...prev,
              ...cloudData,
              activities: mergedActivities.length > 0 ? mergedActivities : prev.activities,
              expenses: mergedExpenses.length > 0 ? mergedExpenses : prev.expenses,
              members: mergedMembers.length > 0 ? mergedMembers : prev.members,
              currentUser: prev.currentUser,
            };
            saveStateToStorage(merged);
            return merged;
          });
        }
      }
    }).catch((err: any) => {
      console.warn("Aviso ao carregar dados da nuvem na inicialização:", err);
    });
  }, []);

  // 2. SINCRONIZAÇÃO EM TEMPO REAL MULTI-DISPOSITIVO (ONSNAPSHOT)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'club_data', 'main_state'), (docSnap) => {
      if (docSnap.exists()) {
        const remoteData = docSnap.data() as ClubDatabaseState;
        if (remoteData && remoteData.updatedAt) {
          if (Array.isArray(remoteData.members)) {
            remoteData.members = verifyAndRepairMembersIntegrity(remoteData.members).sanitizedMembers;
          }
          setState((prev) => {
            const remoteTime = remoteData.updatedAt ? new Date(remoteData.updatedAt).getTime() : 0;
            const prevTime = prev.updatedAt ? new Date(prev.updatedAt).getTime() : 0;
            
            // Ignora se o snapshot remoto for mais antigo que o estado local mais recente deste dispositivo
            if (prevTime > 0 && remoteTime > 0 && remoteTime < prevTime) {
              return prev;
            }

            if (!prev.updatedAt || remoteData.updatedAt !== prev.updatedAt) {
              isRemoteUpdateRef.current = true;

              // Smart-merge activities: preserva todas as atividades remotas e mantém quaisquer atividades locais recém-agendadas
              const remoteActIds = new Set((remoteData.activities || []).map((a) => a.id));
              const localPendingActs = (prev.activities || []).filter((a) => !remoteActIds.has(a.id));
              const mergedActivities = [...(remoteData.activities || []), ...localPendingActs];

              // Smart-merge expenses
              const remoteExpIds = new Set((remoteData.expenses || []).map((e) => e.id));
              const localPendingExps = (prev.expenses || []).filter((e) => !remoteExpIds.has(e.id));
              const mergedExpenses = [...(remoteData.expenses || []), ...localPendingExps];

              // Smart-merge members
              const remoteMemIds = new Set((remoteData.members || []).map((m) => m.id));
              const localPendingMems = (prev.members || []).filter((m) => !remoteMemIds.has(m.id));
              const mergedMembers = [...(remoteData.members || []), ...localPendingMems];

              const merged = {
                ...prev,
                ...remoteData,
                activities: mergedActivities,
                expenses: mergedExpenses,
                members: mergedMembers,
                currentUser: prev.currentUser, // Garante que a sessão deste aparelho não é afetada por outros
              };
              saveStateToStorage(merged);
              return merged;
            }
            return prev;
          });
        }
      }
    }, (error) => {
      if (
        error?.code === 'resource-exhausted' ||
        error?.message?.includes('resource-exhausted') ||
        error?.message?.includes('Quota limit exceeded')
      ) {
        setIsQuotaExceeded(true);
      }
      console.warn("Firestore sync status (operating with local persistence):", error.message);
    });
    return () => unsub();
  }, []);

  // 3. ENVIO CONTÍNUO DE ALTERAÇÕES LOCAIS PARA A NUVEM
  useEffect(() => {
    saveStateToStorage(state);
    
    // Não sincroniza na primeira renderização sem alterações
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Não reenvia se a alteração veio de uma atualização remota recebida
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }

    // Debounce rápido (400ms) para propagar para outros dispositivos imediatamente
    const timer = setTimeout(() => {
      pushToFirestore(state);
    }, 400);

    return () => clearTimeout(timer);
  }, [state]);

  const currentUser = state.currentUser;

  const setCurrentUser = (user: UserAccount, remember: boolean = true) => {
    setState((prev) => ({ ...prev, currentUser: user }));
    if (typeof window !== 'undefined') {
      const serialized = JSON.stringify(user);
      if (remember) {
        localStorage.setItem('pioapp_current_user', serialized);
        localStorage.setItem('pioapp_authenticated_session', 'true');
        sessionStorage.removeItem('pioapp_current_user');
        sessionStorage.removeItem('pioapp_authenticated_session');
      } else {
        sessionStorage.setItem('pioapp_current_user', serialized);
        sessionStorage.setItem('pioapp_authenticated_session', 'true');
        localStorage.removeItem('pioapp_current_user');
        localStorage.removeItem('pioapp_authenticated_session');
      }
    }
  };

  const switchRole = (role: RoleType) => {
    const matching = state.users.find((u) => u.role === role);
    if (matching) {
      setCurrentUser(matching);
    } else {
      // Cria temporário se não existir
      const mockUser: UserAccount = {
        id: `USR-${role.toUpperCase()}`,
        email: `${role}@clubedalvorada.ao`,
        name: `Operador (${role})`,
        role,
        active: true,
        createdAt: getNowISOString(),
      };
      setCurrentUser(mockUser);
    }
  };

  const can = (module: ModuleName, action: PermissionAction): boolean => {
    if (currentUser.role === 'admin_tecnico') return true;
    const matrix = state.settings.permissionsMatrix;
    if (matrix && matrix[currentUser.role] && Array.isArray(matrix[currentUser.role][module])) {
      return matrix[currentUser.role][module].includes(action);
    }
    return hasPermission(currentUser.role, module, action);
  };

  const updateRolePermission = (role: RoleType, module: ModuleName, action: PermissionAction, add: boolean) => {
    if (!can('audit', 'ADMIN') && !can('settings', 'EDIT') && currentUser.role !== 'admin_tecnico' && currentUser.role !== 'diretor') {
      return { success: false, error: 'Apenas a Direção ou Administrador pode alterar a matriz de permissões.' };
    }

    updatePermission(role, module, action, add);
    const currentMatrix = state.settings.permissionsMatrix || JSON.parse(JSON.stringify(ROLE_PERMISSIONS_MATRIX));
    const roleMat = currentMatrix[role] ? { ...currentMatrix[role] } : {};
    const modActions = roleMat[module] ? [...roleMat[module]] : [];

    if (add) {
      if (!modActions.includes(action)) modActions.push(action);
    } else {
      const idx = modActions.indexOf(action);
      if (idx > -1) modActions.splice(idx, 1);
    }
    roleMat[module] = modActions;

    const newMatrix = { ...currentMatrix, [role]: roleMat };
    updateSettings({ permissionsMatrix: newMatrix });
    logAction('audit', 'ALTERACAO_PERMISSAO', `Permissão ${module}:${action} para o papel ${role} alterada para ${add ? 'Atribuída' : 'Revogada'}`);
    return { success: true };
  };

  const logAction = (
    module: ModuleName,
    action: string,
    details: string,
    entityId?: string,
    entityName?: string,
    reason?: string
  ) => {
    const entry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      module,
      action,
      details,
      entityId,
      entityName,
      reason
    );
    setState((prev) => ({
      ...prev,
      auditLogs: [entry, ...prev.auditLogs],
    }));
  };

  // --- SISTEMA DE NOTIFICAÇÕES E ALERTAS ---
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('club_notifications_sound_enabled') !== 'false';
    }
    return true;
  });

  const toggleSoundEnabled = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('club_notifications_sound_enabled', String(next));
      }
      return next;
    });
  };

  const addToast = (title: string, message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
    const id = `TOAST-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const addNotification = (notifData: Omit<ClubNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: ClubNotification = {
      ...notifData,
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: getNowISOString(),
      read: false,
    };

    setState((prev) => {
      const updated = [newNotif, ...(prev.notifications || [])];
      return { ...prev, notifications: updated };
    });

    // Apenas reproduz som, emite push e toast se o utilizador autenticado for destinatário autorizado
    const isTargetedForCurrent = isNotificationAuthorizedForUser(newNotif, currentUser);
    if (isTargetedForCurrent) {
      if (soundEnabled) {
        playNotificationSound();
      }

      // Dispara notificação nativa no sistema operativo se autorizado
      showNativeNotification(notifData.title, notifData.message, { targetModule: notifData.targetModule });

      const toastType = notifData.priority === 'urgente' ? 'error' : notifData.priority === 'alta' ? 'warning' : 'info';
      addToast(notifData.title, notifData.message, toastType);
    }
  };

  const markNotificationAsRead = (notificationId: string) => {
    setState((prev) => {
      const updated = (prev.notifications || []).map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      return { ...prev, notifications: updated };
    });
  };

  const markAllNotificationsAsRead = () => {
    setState((prev) => {
      const updated = (prev.notifications || []).map((n) => ({ ...n, read: true }));
      return { ...prev, notifications: updated };
    });
  };

  const deleteNotification = (notificationId: string) => {
    setState((prev) => {
      const updated = (prev.notifications || []).filter((n) => n.id !== notificationId);
      return { ...prev, notifications: updated };
    });
  };

  const clearAllNotifications = () => {
    setState((prev) => {
      return { ...prev, notifications: [] };
    });
  };

  // --- MEMBROS ---
  const addMember = (memberData: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!can('members', 'CREATE')) {
      return { success: false, error: 'Apenas a Secretaria possui autorização para registar novos membros.' };
    }

    let manualNum = memberData.manualNumber ? memberData.manualNumber.trim() : '';
    if (!manualNum) {
      manualNum = generateManualNumber(memberData.identityCardNumber, memberData.birthDate);
    }

    if (!isMemberNumberUnique(manualNum, state.members)) {
      return { success: false, error: `O número de matrícula "${manualNum}" já existe no cadastro.` };
    }

    const dup = findPotentialDuplicateMember(
      memberData.identityCardNumber,
      memberData.fullName,
      memberData.birthDate,
      state.members,
      memberData.email,
      memberData.phone
    );
    if (dup) {
      return {
        success: false,
        error: `Detetado potencial duplicado: O membro "${dup.fullName}" já está registado com o B.I. ${dup.identityCardNumber} (ID: ${dup.id}).`,
      };
    }

    // Auto-ID interno sequencial: CDA-MEM-00X
    const nextSeq = (state.members.length + 1).toString().padStart(3, '0');
    const newId = `CDA-MEM-${nextSeq}`;
    const now = getNowISOString();

    const rawNewMember: Member = {
      ...memberData,
      manualNumber: manualNum,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };

    const { sanitized: newMember } = sanitizeMemberIntegrity(rawNewMember);

    const newState = {
      ...state,
      members: [newMember, ...state.members],
    };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    logAction('members', 'REGISTO_MEMBRO', `Registo do membro ${newMember.fullName} (${newMember.manualNumber})`, newId, newMember.fullName);
    return { success: true };
  };

  const sendMessage = (data: Omit<Message, 'id' | 'createdAt' | 'read'>) => {
    const newMessage: Message = {
      id: `MSG-${Date.now()}`,
      ...data,
      createdAt: getNowISOString(),
      read: false,
    };

    const newState = {
      ...state,
      messages: [...(state.messages || []), newMessage],
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);
    return { success: true };
  };

  const markMessageAsRead = (messageId: string, memberId: string) => {
    const updatedMessages = (state.messages || []).map(m => {
      if (m.id === messageId) {
        const readBy = m.readBy || [];
        if (!readBy.includes(memberId)) {
          return { ...m, read: true, readBy: [...readBy, memberId] };
        }
      }
      return m;
    });
    const newState = { ...state, messages: updatedMessages };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);
  };

  const replyToMessage = (messageId: string, content: string) => {
    if (!content.trim()) return { success: false, error: 'A resposta não pode estar vazia.' };
    const reply = {
      id: `REP-${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.name,
      content: content.trim(),
      createdAt: getNowISOString(),
    };

    const updatedMessages = (state.messages || []).map(m => {
      if (m.id === messageId) {
        return {
          ...m,
          replies: [...(m.replies || []), reply],
        };
      }
      return m;
    });

    const newState = { ...state, messages: updatedMessages };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);
    return { success: true };
  };

  const deleteMessage = (messageId: string) => {
    const updatedMessages = (state.messages || []).filter(m => m.id !== messageId);
    const newState = { ...state, messages: updatedMessages };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);
    return { success: true };
  };

  const updateMember = (id: string, updates: Partial<Member>) => {
    const isAllowed = can('members', 'EDIT') || currentUser.role === 'admin_tecnico' || currentUser.role === 'secretario' || currentUser.role === 'diretor';
    if (!isAllowed) {
      return { success: false, error: 'Sem permissão para editar dados do membro.' };
    }

    if (updates.manualNumber && !isMemberNumberUnique(updates.manualNumber, state.members, id)) {
      return { success: false, error: `O número manual "${updates.manualNumber}" já se encontra atribuído.` };
    }

    const now = getNowISOString();
    let updatedName = '';
    const targetMember = state.members.find((m) => m.id === id);

    const updated = state.members.map((m) => {
      if (m.id === id) {
        updatedName = m.fullName;
        const merged = { ...m, ...updates, updatedAt: now };
        const { sanitized } = sanitizeMemberIntegrity(merged);
        return sanitized;
      }
      return m;
    });

    // Atualização automática da conta de login vinculada se existir
    let updatedUsers = state.users;
    if (targetMember) {
      const newName = updates.fullName !== undefined ? updates.fullName : targetMember.fullName;
      const newEmail = updates.email !== undefined ? updates.email : targetMember.email;

      updatedUsers = state.users.map((u) => {
        if (u.linkedMemberId === id || (targetMember.email && u.email && u.email.toLowerCase() === targetMember.email.toLowerCase())) {
          return {
            ...u,
            name: newName,
            email: newEmail || u.email,
          };
        }
        return u;
      });
    }

    const newState = { ...state, members: updated, users: updatedUsers };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    logAction('members', 'EDICAO_MEMBRO', `Atualização cadastral do membro e sincronização de conta de login`, id, updatedName);
    return { success: true };
  };

  const uploadMemberPhoto = (memberId: string, photoBase64: string) => {
    const targetMember = state.members.find((m) => m.id === memberId || m.manualNumber === memberId);
    if (!targetMember) {
      return { success: false, error: 'Membro não encontrado no sistema.' };
    }

    // Regra: cada utilizador pode carregar a foto para o seu próprio cartão,
    // ou a Direção (Diretor e Secretário com permissão de edição, além de Admin Técnico)
    const isOwnCard =
      currentUser.linkedMemberId === targetMember.id ||
      currentUser.linkedMemberId === targetMember.manualNumber ||
      (currentUser.email && targetMember.email && currentUser.email.toLowerCase() === targetMember.email.toLowerCase()) ||
      (currentUser.name && targetMember.fullName && currentUser.name.toLowerCase() === targetMember.fullName.toLowerCase());

    const isLeadershipAllowed =
      currentUser.role === 'admin_tecnico' ||
      ((currentUser.role === 'diretor' || currentUser.role === 'secretario') && can('members', 'EDIT'));

    if (!isOwnCard && !isLeadershipAllowed) {
      return {
        success: false,
        error: 'Não possui autorização para carregar a fotografia deste cartão de membro.',
      };
    }

    const now = getNowISOString();
    const updated = state.members.map((m) => {
      if (m.id === targetMember.id) {
        return { ...m, photoUrl: photoBase64, updatedAt: now };
      }
      return m;
    });

    const newState = { ...state, members: updated };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    logAction(
      'members',
      'UPLOAD_FOTO_CARTAO',
      `Upload de foto para o cartão digital de ${targetMember.fullName} (${targetMember.manualNumber}) efetuado por ${currentUser.name}`,
      targetMember.id,
      targetMember.fullName
    );

    return { success: true };
  };

  const deleteMemberPhoto = (memberId: string) => {
    const targetMember = state.members.find((m) => m.id === memberId || m.manualNumber === memberId);
    if (!targetMember) {
      return { success: false, error: 'Membro não encontrado no sistema.' };
    }

    // Regra estrita do clube: "porém a Direção (diretor e secretário com permissão da matriz de Permissões) tem a função de excluir essa mesma foto"
    const isLeadershipAllowed =
      currentUser.role === 'admin_tecnico' ||
      ((currentUser.role === 'diretor' || currentUser.role === 'secretario') && can('members', 'EDIT'));

    if (!isLeadershipAllowed) {
      return {
        success: false,
        error: 'Apenas a Direção (Diretor e Secretário com permissão ativa na matriz de Permissões) tem a função de excluir a foto do cartão digital.',
      };
    }

    const now = getNowISOString();
    const updated = state.members.map((m) => {
      if (m.id === targetMember.id) {
        const { photoUrl: _oldPhoto, ...rest } = m;
        return { ...rest, updatedAt: now };
      }
      return m;
    });

    const newState = { ...state, members: updated };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    logAction(
      'members',
      'EXCLUSAO_FOTO_CARTAO',
      `Foto do cartão digital de ${targetMember.fullName} (${targetMember.manualNumber}) excluída oficialmente pela Direção (${currentUser.name} - ${currentUser.role})`,
      targetMember.id,
      targetMember.fullName
    );

    return { success: true };
  };

  const archiveMember = (id: string, reason: string, directionAuthorized?: boolean) => {
    // 1. Verificação obrigatória na grelha de autorizações
    if (!can('members', 'ARCHIVE')) {
      return { success: false, error: 'Sem autorização na grelha de permissões para arquivar membros. Esta operação exige autorização prévia da Direção.' };
    }
    // 2. Confirmação de autorização da Direção para cargos não-diretoria
    const isDirectorOrAdmin = currentUser.role === 'diretor' || currentUser.role === 'admin_tecnico';
    if (!isDirectorOrAdmin && directionAuthorized === false) {
      return { success: false, error: 'O arquivamento deste membro exige autorização prévia formal da Direção do Clube.' };
    }
    if (!reason || reason.trim().length < 5) {
      return { success: false, error: 'É obrigatório indicar o motivo fundamentado do arquivamento (mínimo 5 caracteres).' };
    }

    const now = getNowISOString();
    let memberName = '';

    const updated = state.members.map((m) => {
      if (m.id === id) {
        memberName = m.fullName;
        return {
          ...m,
          status: 'arquivado' as const,
          archiveReason: reason,
          archivedAt: now,
          updatedAt: now,
        };
      }
      return m;
    });
    const newState = { ...state, members: updated };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    logAction('members', 'ARQUIVAMENTO_MEMBRO', `Membro arquivado com autorização da Direção: ${reason}`, id, memberName, reason);
    return { success: true };
  };

  const unarchiveMember = (id: string) => {
    if (!can('members', 'ARCHIVE')) {
      return { success: false, error: 'Sem autorização para desarquivar membros.' };
    }

    let memberName = '';

    const updated = state.members.map((m) => {
      if (m.id === id) {
        memberName = m.fullName;
        return {
          ...m,
          status: 'ativo' as const,
          archiveReason: undefined,
          archivedAt: undefined,
          updatedAt: getNowISOString(),
        };
      }
      return m;
    });
    const newState = { ...state, members: updated };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    logAction('members', 'DESARQUIVAMENTO_MEMBRO', `Membro desarquivado`, id, memberName);
    return { success: true };
  };

  const requestMemberOperation = (targetMemberId: string, operationType: 'arquivamento' | 'eliminacao', reason: string) => {
    const member = state.members.find(m => m.id === targetMemberId);
    if (!member) {
      return { success: false, error: 'Membro não encontrado.' };
    }
    if (!reason || reason.trim().length < 5) {
      return { success: false, error: 'É obrigatório indicar um motivo fundamentado (mínimo de 5 caracteres).' };
    }

    const hasPending = (state.deletionRequests || []).some(
      r => r.targetId === targetMemberId && r.operationType === operationType && r.status === 'pendente'
    );
    if (hasPending) {
      return { success: false, error: `Já existe um pedido de ${operationType} pendente de autorização da Direção para este membro.` };
    }

    const reqId = `REQ-AUTH-${Date.now().toString().slice(-4)}`;
    const newReq: DeletionRequest = {
      id: reqId,
      targetId: targetMemberId,
      targetType: 'member',
      targetMemberName: member.fullName,
      targetMemberManualNumber: member.manualNumber || member.id,
      operationType,
      reason: reason.trim(),
      requestedByUserId: currentUser.id,
      requestedByName: currentUser.name,
      requestedByRole: currentUser.role,
      requestedAt: getNowISOString(),
      status: 'pendente',
      createdAt: getNowISOString(),
    };

    const notif: ClubNotification = {
      id: `NOTIF-AUTH-${Date.now()}`,
      title: `Pedido de Autorização: ${operationType === 'eliminacao' ? 'Eliminação' : 'Arquivamento'} de Membro`,
      message: `${currentUser.name} (${currentUser.role}) solicitou autorização para ${operationType} do membro ${member.fullName} (${member.manualNumber || member.id}). Motivo: ${reason.trim()}`,
      timestamp: getNowISOString(),
      read: false,
      category: 'member',
      targetModule: 'members',
    };

    const newState = {
      ...state,
      deletionRequests: [newReq, ...(state.deletionRequests || [])],
      notifications: [notif, ...(state.notifications || [])],
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    logAction(
      'members',
      'SOLICITACAO_OPERACAO_MEMBRO',
      `Solicitação de ${operationType} de membro criada por ${currentUser.name}: ${member.fullName}`,
      targetMemberId,
      member.fullName,
      reason.trim()
    );

    return { success: true, requestId: reqId };
  };

  const decideMemberOperationRequest = (requestId: string, decision: 'aprovado' | 'rejeitado', decisionReason?: string) => {
    const req = (state.deletionRequests || []).find(r => r.id === requestId);
    if (!req) {
      return { success: false, error: 'Pedido de autorização não encontrado.' };
    }
    if (req.status !== 'pendente') {
      return { success: false, error: 'Este pedido já foi decidido anteriormente e não pode ser reavaliado.' };
    }

    // Validação estrita pela grelha de permissões sem alterar a matriz existente
    const isDirector = currentUser.role === 'diretor';
    const isTechAdmin = currentUser.role === 'admin_tecnico';

    if (req.operationType === 'eliminacao') {
      if (!can('members', 'ADMIN') || (!isDirector && !isTechAdmin)) {
        return { success: false, error: 'Apenas a Direção com permissão administrativa (members: ADMIN) pode autorizar a eliminação definitiva de membros.' };
      }
    } else {
      if (!can('members', 'ARCHIVE') || (!isDirector && !isTechAdmin)) {
        return { success: false, error: 'Apenas a Direção com permissão na grelha (members: ARCHIVE) pode autorizar o arquivamento de membros.' };
      }
    }

    // Regra: Impedir que um utilizador sem autorização aprove o próprio pedido
    if (req.requestedByUserId === currentUser.id && !isTechAdmin && !isDirector) {
      return { success: false, error: 'Não é permitido aprovar o próprio pedido sem autorização institucional da Direção.' };
    }

    if (decision === 'rejeitado' && (!decisionReason || decisionReason.trim().length < 3)) {
      return { success: false, error: 'É obrigatório indicar uma justificação para rejeitar o pedido.' };
    }

    const now = getNowISOString();
    const updatedRequests = (state.deletionRequests || []).map(r => {
      if (r.id === requestId) {
        return {
          ...r,
          status: decision,
          decidedByUserId: currentUser.id,
          decidedByName: currentUser.name,
          decidedByRole: currentUser.role,
          decidedAt: now,
          decisionReason: decisionReason?.trim() || (decision === 'aprovado' ? 'Autorizado pela Direção' : 'Rejeitado pela Direção'),
        };
      }
      return r;
    });

    const notif: ClubNotification = {
      id: `NOTIF-DECISION-${Date.now()}`,
      title: `Decisão de Pedido: ${req.operationType === 'eliminacao' ? 'Eliminação' : 'Arquivamento'}`,
      message: `O pedido de ${req.operationType} do membro ${req.targetMemberName} foi ${decision.toUpperCase()} por ${currentUser.name}.`,
      timestamp: now,
      read: false,
      category: 'member',
      targetModule: 'members',
    };

    const newState = {
      ...state,
      deletionRequests: updatedRequests,
      notifications: [notif, ...(state.notifications || [])],
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    logAction(
      'members',
      'DECISAO_OPERACAO_MEMBRO',
      `Pedido de ${req.operationType} (${req.targetMemberName}) ${decision.toUpperCase()} por ${currentUser.name}: ${decisionReason || 'Sem observações'}`,
      req.targetId,
      req.targetMemberName,
      decisionReason
    );

    return { success: true };
  };

  const executeApprovedMemberOperation = (requestId: string) => {
    const req = (state.deletionRequests || []).find(r => r.id === requestId);
    if (!req) {
      return { success: false, error: 'Pedido de autorização não encontrado.' };
    }
    if (req.status !== 'aprovado') {
      return { success: false, error: 'Apenas pedidos formalmente aprovados pela Direção podem ser executados.' };
    }
    if (req.executedAt) {
      return { success: false, error: 'Esta autorização já foi executada e consumida previamente.' };
    }

    const member = state.members.find(m => m.id === req.targetId);
    if (!member) {
      return { success: false, error: 'O membro associado a este pedido já não se encontra registado no sistema.' };
    }

    // Validação da permissão do executor segundo a grelha
    if (req.operationType === 'eliminacao') {
      if (!can('members', 'ADMIN')) {
        return { success: false, error: 'Sem permissão na grelha para executar a eliminação definitiva de membros (members: ADMIN).' };
      }
    } else {
      if (!can('members', 'ARCHIVE')) {
        return { success: false, error: 'Sem permissão na grelha para executar o arquivamento de membros (members: ARCHIVE).' };
      }
    }

    const now = getNowISOString();
    let updatedMembers = state.members;

    if (req.operationType === 'arquivamento') {
      updatedMembers = state.members.map(m => {
        if (m.id === req.targetId) {
          return {
            ...m,
            status: 'arquivado' as const,
            archiveReason: req.reason,
            archivedAt: now,
            updatedAt: now,
          };
        }
        return m;
      });
    } else if (req.operationType === 'eliminacao') {
      // Remoção estrita do membro PRESERVANDO integralmente recibos, movimentos financeiros e documentos (Req 2.4)
      updatedMembers = state.members.filter(m => m.id !== req.targetId);
    }

    const updatedRequests = (state.deletionRequests || []).map(r => {
      if (r.id === requestId) {
        return {
          ...r,
          status: 'executado' as const,
          executedAt: now,
          executedByUserId: currentUser.id,
          executedByName: currentUser.name,
        };
      }
      return r;
    });

    const newState = {
      ...state,
      members: updatedMembers,
      deletionRequests: updatedRequests,
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    logAction(
      'members',
      req.operationType === 'eliminacao' ? 'ELIMINACAO_MEMBRO_EXECUTADA' : 'ARQUIVAMENTO_MEMBRO_EXECUTADO',
      `${req.operationType === 'eliminacao' ? 'Eliminação definitiva' : 'Arquivamento'} de ${member.fullName} executado após autorização da Direção.`,
      member.id,
      member.fullName,
      req.reason
    );

    return { success: true };
  };

  const renewMemberAnnual = (id: string, year: number) => {
    if (!can('members', 'ADMIN')) {
      return { success: false, error: 'Apenas a Direção ou Secretaria podem validar a renovação anual.' };
    }

    const now = getNowISOString();
    let memberName = '';

    setState((prev) => {
      const updated = prev.members.map((m) => {
        if (m.id === id) {
          memberName = m.fullName;
          return { ...m, annualRenewalYear: year, updatedAt: now };
        }
        return m;
      });
      return { ...prev, members: updated };
    });

    logAction('members', 'RENOVACAO_ANUAL', `Renovação de matrícula para o ano ${year}`, id, memberName);
    return { success: true };
  };

  // --- TESOURARIA ---
  const createReceipt = (data: {
    memberId: string;
    feeDefinitionId: string;
    periodLabel: string;
    amountPaidInCents: number;
    paymentMethod: PaymentReceipt['paymentMethod'];
    referenceOrProof?: string;
    notes?: string;
    customDonorName?: string;
    accountId?: string;
    activityId?: string;
  }) => {
    if (!can('treasury', 'CREATE')) {
      return { success: false, error: 'Apenas a Tesouraria tem autorização para emitir recibos oficiais.' };
    }

    const fee = state.fees.find((f) => f.id === data.feeDefinitionId) || state.fees[0];
    if (!fee) {
      return { success: false, error: 'Taxa não encontrada. Cadastre uma taxa em Tesouraria.' };
    }

    let memberId = data.memberId;
    let memberName = '';

    if (data.customDonorName && data.customDonorName.trim()) {
      memberName = data.customDonorName.trim();
      memberId = data.memberId && data.memberId !== 'CUSTOM' ? data.memberId : `DONOR-${Date.now()}`;
    } else {
      const member = state.members.find((m) => m.id === data.memberId) || state.members[0];
      if (!member) {
        return { success: false, error: 'Membro ou titular não especificado. Selecione um membro válido.' };
      }
      memberId = member.id;
      memberName = member.fullName;
    }

    const targetAccountId = (data.accountId && state.accounts.some(a => a.id === data.accountId))
      ? data.accountId
      : (data.paymentMethod === 'numerario'
          ? state.accounts.find(a => a.type === 'caixa')?.id || state.accounts.find(a => a.active)?.id || state.accounts[0]?.id
          : state.accounts.find(a => a.type === 'banco')?.id || state.accounts.find(a => a.active)?.id || state.accounts[0]?.id)
        || state.accounts[0]?.id;
    const targetAccount = state.accounts.find(a => a.id === targetAccountId) || state.accounts[0];
    if (!targetAccount) {
      return { success: false, error: 'Conta financeira institucional de destino não encontrada. Adicione uma conta em Contas e Balanço.' };
    }

    const currentYear = state.settings.currentYear;
    const existingRecNumbers = state.receipts.map((r) => r.receiptNumber);
    const receiptNumber = generateNextDocumentNumber('REC', currentYear, existingRecNumbers);

    const newReceipt: PaymentReceipt = {
      id: receiptNumber,
      receiptNumber,
      memberId,
      memberName,
      feeDefinitionId: fee.id,
      feeTitle: fee.title,
      periodLabel: data.periodLabel,
      amountPaidInCents: data.amountPaidInCents,
      paymentMethod: data.paymentMethod,
      referenceOrProof: data.referenceOrProof,
      treasurerUserId: currentUser.id,
      treasurerName: currentUser.name,
      paidAt: getNowISOString(),
      status: 'confirmado',
      notes: data.notes,
      activityId: data.activityId,
    };

    setState((prev) => {
      const updatedAccounts = prev.accounts.map((acc) => {
        if (acc.id === targetAccountId) {
          return {
            ...acc,
            currentBalanceInCents: acc.currentBalanceInCents + data.amountPaidInCents,
          };
        }
        return acc;
      });

      return {
        ...prev,
        receipts: [newReceipt, ...prev.receipts],
        accounts: updatedAccounts,
      };
    });

    logAction('treasury', 'EMISSAO_RECIBO', `Recibo ${receiptNumber} emitido para ${memberName} no valor de ${data.amountPaidInCents / 100} Kz (Conta: ${targetAccount.name})`, newReceipt.id, memberName);
    return { success: true, receiptNumber, receipt: newReceipt };
  };


  const cancelReceipt = (id: string, reason: string) => {
    if (!can('treasury', 'EDIT')) {
      return { success: false, error: 'Sem autorização para anular recibos oficiais.' };
    }
    if (!reason || reason.trim().length < 5) {
      return { success: false, error: 'Obrigatorio registar o motivo da anulação do recibo.' };
    }

    const receipt = state.receipts.find((r) => r.id === id);
    if (!receipt) return { success: false, error: 'Recibo não encontrado.' };
    if (receipt.isCancelled) return { success: false, error: 'Este recibo já se encontra anulado.' };

    const now = getNowISOString();

    setState((prev) => {
      const updatedReceipts = prev.receipts.map((r) => {
        if (r.id === id) {
          return {
            ...r,
            status: 'anulado' as const,
            isCancelled: true,
            cancellationReason: reason,
            cancelledAt: now,
            cancelledByUserId: currentUser.id,
          };
        }
        return r;
      });

      // Estorna da conta
      const accountId = receipt.paymentMethod === 'numerario' ? 'ACC-01' : 'ACC-02';
      const updatedAccounts = prev.accounts.map((acc) => {
        if (acc.id === accountId) {
          return {
            ...acc,
            currentBalanceInCents: acc.currentBalanceInCents - receipt.amountPaidInCents,
          };
        }
        return acc;
      });

      return {
        ...prev,
        receipts: updatedReceipts,
        accounts: updatedAccounts,
      };
    });

    logAction('treasury', 'ANULACAO_RECIBO', `Recibo ${receipt.receiptNumber} anulado: ${reason}`, id, receipt.receiptNumber, reason);
    return { success: true };
  };

  const createExpense = (data: {
    title: string;
    description: string;
    category: string;
    amountInCents: number;
    accountId?: string;
  }) => {
    const nextSeq = (state.expenses.length + 1).toString().padStart(3, '0');
    const newId = `EXP-${state.settings.currentYear}-${nextSeq}`;

    const newExp: ExpenseRequest = {
      id: newId,
      title: data.title,
      description: data.description,
      category: data.category,
      amountInCents: data.amountInCents,
      requestedByUserId: currentUser.id,
      requestedByName: currentUser.name,
      accountId: data.accountId,
      status: 'solicitado',
      createdAt: getNowISOString(),
    };

    setState((prev) => ({
      ...prev,
      expenses: [newExp, ...prev.expenses],
    }));

    addNotification({
      title: `Nova Despesa: ${data.title}`,
      message: `${currentUser.name} solicitou despesa no valor de ${formatKz(data.amountInCents)} (${data.category}).`,
      category: 'financial',
      targetModule: 'treasury',
      priority: 'normal',
    });

    logAction('treasury', 'SOLICITACAO_DESPESA', `Pedido de despesa: ${data.title}`, newId, data.title);
    return { success: true };
  };

  const approveExpense = (id: string, reason?: string) => {
    if (!can('treasury', 'APPROVE')) {
      return { success: false, error: 'Apenas Diretor ou Tesoureiro podem aprovar despesas.' };
    }

    const exp = state.expenses.find((e) => e.id === id);
    if (!exp) return { success: false, error: 'Despesa não encontrada.' };

    // REGRA DE INTEGRIDADE: Se for solicitada pelo próprio utilizador, exige 2º aprovador independente!
    const isOwnRequest = exp.requestedByUserId === currentUser.id;

    if (isOwnRequest && !exp.approvedByUserId) {
      // Primeira aprovação em despesa própria: aguarda 2º aprovador
      setState((prev) => {
        const updated = prev.expenses.map((e) => {
          if (e.id === id) {
            return {
              ...e,
              approvedByUserId: currentUser.id,
              approvedByName: currentUser.name,
              approvalReason: reason || 'Pré-aprovação própria; requer 2º aprovador independente.',
            };
          }
          return e;
        });
        return { ...prev, expenses: updated };
      });
      logAction('treasury', 'PRE_APROVACAO_DESPESA', `Despesa própria pré-aprovada. Aguarda segundo aprovador independente.`, id, exp.title);
      return { success: true, error: 'Despesa própria: registada primeira assinatura. Requer segundo aprovador independente.' };
    }

    // Se já tinha 1º aprovador ou é de outro utilizador
    setState((prev) => {
      const updatedExpenses = prev.expenses.map((e) => {
        if (e.id === id) {
          return {
            ...e,
            status: 'aprovado' as const,
            approvedByUserId: e.approvedByUserId || currentUser.id,
            approvedByName: e.approvedByName || currentUser.name,
            secondApproverUserId: isOwnRequest ? undefined : currentUser.id,
            secondApproverName: isOwnRequest ? undefined : currentUser.name,
            approvalReason: reason || e.approvalReason || 'Despesa aprovada em conformidade orçamental.',
          };
        }
        return e;
      });

      const updatedActivities = prev.activities.map((a) => {
        if (a.expenseRequestId === id || (exp.activityId && a.id === exp.activityId)) {
          return {
            ...a,
            costApprovedInCents: exp.amountInCents,
          };
        }
        return a;
      });

      return { ...prev, expenses: updatedExpenses, activities: updatedActivities };
    });

    addNotification({
      title: 'Despesa Aprovada pela Direção/Tesouraria',
      message: `A despesa "${exp.title}" (${formatKz(exp.amountInCents)}) foi aprovada e aguarda liquidação.`,
      category: 'financial',
      targetModule: 'treasury',
      priority: 'alta',
    });

    logAction('treasury', 'APROVACAO_DESPESA', `Despesa aprovada`, id, exp.title);
    return { success: true };
  };

  const rejectExpense = (id: string, reason: string) => {
    if (!can('treasury', 'APPROVE') && currentUser.role !== 'admin_tecnico' && currentUser.role !== 'diretor' && currentUser.role !== 'tesoureiro') {
      return { success: false, error: 'Apenas Diretor ou Tesoureiro podem rejeitar despesas.' };
    }
    const exp = state.expenses.find((e) => e.id === id);
    if (!exp) return { success: false, error: 'Despesa não encontrada.' };
    
    setState((prev) => ({
      ...prev,
      expenses: prev.expenses.map(e => e.id === id ? { ...e, status: 'rejeitado' as const, approvalReason: reason || 'Despesa não autorizada.' } : e)
    }));
    logAction('treasury', 'REJEICAO_DESPESA', `Despesa rejeitada: ${reason}`, id, exp.title);
    return { success: true };
  };

  const payExpense = (id: string, accountId: string, proofUrl?: string) => {
    if (!can('treasury', 'CREATE') && !can('treasury', 'APPROVE') && currentUser.role !== 'admin_tecnico' && currentUser.role !== 'diretor' && currentUser.role !== 'tesoureiro') {
      return { success: false, error: 'Sem autorização para efetuar pagamento de despesa.' };
    }

    const exp = state.expenses.find((e) => e.id === id);
    if (!exp) return { success: false, error: 'Despesa não encontrada.' };
    if (exp.status !== 'aprovado') {
      return { success: false, error: 'Apenas despesas com aprovação prévia podem ser pagas.' };
    }

    let targetAccountId = accountId;
    let account = state.accounts.find((a) => a.id === targetAccountId);
    if (!account) {
      account = state.accounts.find(a => a.active) || state.accounts[0];
      if (account) targetAccountId = account.id;
    }
    if (!account) return { success: false, error: 'Conta financeira não encontrada.' };
    if (account.currentBalanceInCents < exp.amountInCents) {
      return { 
        success: false, 
        error: `Saldo insuficiente na conta ${account.name}. Saldo disponível: ${(account.currentBalanceInCents / 100).toLocaleString('pt-AO')} Kz (Valor da despesa: ${(exp.amountInCents / 100).toLocaleString('pt-AO')} Kz).` 
      };
    }

    const now = getNowISOString();

    setState((prev) => {
      const updatedExpenses = prev.expenses.map((e) => {
        if (e.id === id) {
          return {
            ...e,
            status: 'pago' as const,
            accountId: targetAccountId,
            paymentProofUrl: proofUrl || 'Comprovativo_Pagamento.pdf',
            paidAt: now,
          };
        }
        return e;
      });

      const updatedAccounts = prev.accounts.map((a) => {
        if (a.id === targetAccountId) {
          return {
            ...a,
            currentBalanceInCents: a.currentBalanceInCents - exp.amountInCents,
          };
        }
        return a;
      });

      const updatedActivities = prev.activities.map((a) => {
        if (a.expenseRequestId === id || (exp.activityId && a.id === exp.activityId)) {
          return {
            ...a,
            costPaidInCents: exp.amountInCents,
          };
        }
        return a;
      });

      return {
        ...prev,
        expenses: updatedExpenses,
        accounts: updatedAccounts,
        activities: updatedActivities,
      };
    });

    logAction('treasury', 'PAGAMENTO_DESPESA', `Pagamento da despesa ${exp.title} debitado na conta ${account.name}`, id, exp.title);
    return { success: true };
  };

  const closeFiscalMonth = (year: number, month: number) => {
    if (!can('treasury', 'ARCHIVE')) {
      return { success: false, error: 'Sem autorização para realizar o fecho mensal.' };
    }

    const existing = state.monthlyClosings.find((c) => c.year === year && c.month === month && !c.isReopened);
    if (existing) {
      return { success: false, error: `O mês ${month}/${year} já se encontra encerrado.` };
    }

    // Calcula receitas e despesas reais
    const totalIncome = state.receipts
      .filter((r) => !r.isCancelled)
      .reduce((acc, curr) => acc + curr.amountPaidInCents, 0);

    const totalExpense = state.expenses
      .filter((e) => e.status === 'pago')
      .reduce((acc, curr) => acc + curr.amountInCents, 0);

    const closingBalance = totalIncome - totalExpense;
    const closingId = `CLS-${year}-${month.toString().padStart(2, '0')}`;

    const newClosing: MonthlyClosing = {
      id: closingId,
      year,
      month,
      totalIncomeInCents: totalIncome,
      totalExpenseInCents: totalExpense,
      closingBalanceInCents: closingBalance,
      closedByUserId: currentUser.id,
      closedByName: currentUser.name,
      closedAt: getNowISOString(),
    };

    setState((prev) => ({
      ...prev,
      monthlyClosings: [newClosing, ...prev.monthlyClosings],
    }));

    logAction('treasury', 'FECHO_MENSAL', `Fecho do mês fiscal ${month}/${year} concluído com sucesso`, closingId);
    return { success: true };
  };

  const reopenFiscalMonth = (id: string, reason: string) => {
    if (!can('treasury', 'REOPEN')) {
      return { success: false, error: 'Apenas a Direção Geral tem autorização para reabrir um mês fiscal encerrado.' };
    }
    if (!reason || reason.trim().length < 5) {
      return { success: false, error: 'É obrigatório fundamentar a reabertura do mês fiscal.' };
    }

    const now = getNowISOString();

    setState((prev) => {
      const updated = prev.monthlyClosings.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            isReopened: true,
            reopenReason: reason,
            reopenedByUserId: currentUser.id,
            reopenedAt: now,
          };
        }
        return c;
      });
      return { ...prev, monthlyClosings: updated };
    });

    logAction('treasury', 'REABERTURA_MES_FISCAL', `Reabertura autorizada do fecho: ${reason}`, id, id, reason);
    return { success: true };
  };

  // --- ATIVIDADES ---
  const createActivity = (data: Omit<ClubActivity, 'id' | 'createdAt' | 'tasks' | 'attendees'>) => {
    console.log("[DEBUG] createActivity called with data:", data);
    if (!can('activities', 'CREATE')) {
      console.warn("[DEBUG] createActivity: permission denied");
      return { success: false, error: 'Sem permissão para agendar atividades.' };
    }

    const now = getNowISOString();
    const currentYr = state.settings?.currentYear || new Date().getFullYear();
    
    let seq = state.activities.length + 1;
    let newId = `ACT-${currentYr}-${seq.toString().padStart(3, '0')}`;
    while (state.activities.some((a) => a.id === newId)) {
      seq++;
      newId = `ACT-${currentYr}-${seq.toString().padStart(3, '0')}`;
    }

    let generatedExpense: ExpenseRequest | null = null;
    let expenseId: string | undefined = undefined;

    if (data.costEstimatedInCents && data.costEstimatedInCents > 0) {
      let expSeq = state.expenses.length + 1;
      expenseId = `EXP-${currentYr}-${expSeq.toString().padStart(3, '0')}`;
      while (state.expenses.some((e) => e.id === expenseId)) {
        expSeq++;
        expenseId = `EXP-${currentYr}-${expSeq.toString().padStart(3, '0')}`;
      }
      generatedExpense = {
        id: expenseId,
        activityId: newId,
        title: `Custo de Atividade: ${data.title}`,
        description: `Orçamento e custo operacional solicitado para a atividade "${data.title}" (${data.department || 'Geral'}) em ${data.location}.`,
        category: 'Atividades e Eventos',
        amountInCents: data.costEstimatedInCents,
        requestedByUserId: currentUser.id,
        requestedByName: currentUser.name,
        status: 'solicitado',
        createdAt: now,
      };
    }

    const newActivity: ClubActivity = {
      ...data,
      department: data.department || 'Instrução Geral',
      id: newId,
      tasks: [],
      attendees: [],
      expenseRequestId: expenseId,
      costEstimatedInCents: data.costEstimatedInCents || 0,
      costApprovedInCents: 0,
      costPaidInCents: 0,
      createdAt: now,
    };

    const updatedActivities = [newActivity, ...state.activities.filter((a) => a.id !== newId)];
    const updatedExpenses = generatedExpense
      ? [generatedExpense, ...state.expenses.filter((e) => e.id !== expenseId)]
      : state.expenses;

    console.log("[DEBUG] createActivity: newActivity created:", newActivity);
    console.log("[DEBUG] createActivity: updatedActivities length:", updatedActivities.length);

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'activities',
      'CRIACAO_ATIVIDADE',
      `Nova atividade agendada: ${data.title}`,
      newId,
      data.title
    );
    const updatedAuditLogs = [auditEntry, ...state.auditLogs];

    if (generatedExpense) {
      updatedAuditLogs.unshift(createAuditLog(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'treasury',
        'SOLICITACAO_DESPESA_AUTOMATICA',
        `Solicitação de custo gerada automaticamente para a atividade: ${data.title}`,
        generatedExpense.id,
        formatKz(data.costEstimatedInCents)
      ));
    }

    const newNotif: ClubNotification = {
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: `Nova Atividade: ${data.title}`,
      message: `Agendada para ${formatDateAO(data.startDate)} no departamento ${data.department || 'Instrução Geral'}. Local: ${data.location}`,
      category: 'announcement',
      targetModule: 'activities',
      priority: 'normal',
      timestamp: now,
      read: false,
    };

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      activities: updatedActivities,
      expenses: updatedExpenses,
      notifications: [newNotif, ...(state.notifications || [])],
      auditLogs: updatedAuditLogs,
    };

    console.log("[DEBUG] createActivity: saving nextState...");
    saveStateToStorage(nextState);
    setState(nextState);
    pushToFirestore(nextState).then(() => console.log("[DEBUG] createActivity: pushToFirestore successful"));

    // Reproduzir feedback auditivo e nativo se o utilizador atual for destinatário
    const isTargetedForCurrent = isNotificationAuthorizedForUser(newNotif, currentUser);
    if (isTargetedForCurrent) {
      if (soundEnabled) {
        playNotificationSound();
      }
      showNativeNotification(newNotif.title, newNotif.message, { targetModule: newNotif.targetModule });
      addToast(newNotif.title, newNotif.message, 'info');
    }

    return { success: true, activity: newActivity, id: newId };
  };

  const updateActivityStage = (id: string, stage: ClubActivity['stage']) => {
    if (!can('activities', 'EDIT')) {
      return { success: false, error: 'Sem autorização para alterar a fase da atividade.' };
    }

    const now = getNowISOString();
    const updated = state.activities.map((a) => {
      if (a.id === id) {
        return { ...a, stage };
      }
      return a;
    });

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'activities',
      'MUDANCA_FASE',
      `Fase alterada para ${stage}`,
      id
    );

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      activities: updated,
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);

    return { success: true };
  };

  const deleteActivity = (id: string) => {
    console.log("[DEBUG] deleteActivity called for id:", id);
    if (!can('activities', 'ARCHIVE') && !can('activities', 'EDIT') && currentUser.role !== 'diretor' && currentUser.role !== 'admin_tecnico') {
      console.warn("[DEBUG] deleteActivity: permission denied");
      return { success: false, error: 'Sem autorização para eliminar atividades.' };
    }
    const act = state.activities.find((a) => a.id === id);
    if (!act) {
      console.warn("[DEBUG] deleteActivity: activity not found");
      return { success: false, error: 'Atividade não encontrada.' };
    }

    const now = getNowISOString();
    const updatedActivities = state.activities.filter((a) => a.id !== id);
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'activities',
      'REMOCAO_ATIVIDADE',
      `Atividade eliminada: ${act.title}`,
      id,
      act.title
    );

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      activities: updatedActivities,
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    console.log("[DEBUG] deleteActivity: saving state and pushing to Firestore...");
    saveStateToStorage(nextState);
    setState(nextState);
    pushToFirestore(nextState).then(() => console.log("[DEBUG] deleteActivity: pushToFirestore successful"));

    return { success: true };
  };

  const toggleAttendance = (activityId: string, memberId: string, present: boolean, notes?: string) => {
    if (!can('activities', 'EDIT')) return;

    const now = getNowISOString();
    const updated = state.activities.map((act) => {
      if (act.id === activityId) {
        const existing = act.attendees.filter((att) => att.memberId !== memberId);
        return {
          ...act,
          attendees: [...existing, { memberId, present, notes }],
        };
      }
      return act;
    });

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      activities: updated,
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);
  };

  const addTaskToActivity = (activityId: string, task: Omit<ClubActivity['tasks'][0], 'id'>) => {
    const taskId = `TSK-${Date.now()}`;
    const now = getNowISOString();

    const updated = state.activities.map((act) => {
      if (act.id === activityId) {
        return {
          ...act,
          tasks: [...act.tasks, { ...task, id: taskId }],
        };
      }
      return act;
    });

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      activities: updated,
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);
  };

  const updateTaskStatus = (activityId: string, taskId: string, status: ClubActivity['tasks'][0]['status']) => {
    const now = getNowISOString();
    const updated = state.activities.map((act) => {
      if (act.id === activityId) {
        return {
          ...act,
          tasks: act.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
        };
      }
      return act;
    });

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      activities: updated,
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);
  };

  const saveMinuteToActivity = (
    activityId: string,
    minuteData: Omit<NonNullable<ClubActivity['minute']>, 'id' | 'minuteNumber'>
  ) => {
    if (!can('activities', 'CREATE')) {
      return { success: false };
    }

    const currentYear = state.settings.currentYear;
    const existingDocNumbers = state.documents.map((d) => d.documentNumber);
    const minuteNumber = generateNextDocumentNumber('ATA', currentYear, existingDocNumbers);
    const now = getNowISOString();

    const minute = {
      ...minuteData,
      id: minuteNumber,
      minuteNumber,
    };

    const officialDoc: OfficialDocument = {
      id: `DOC-${Date.now()}`,
      documentNumber: minuteNumber,
      documentType: 'ata',
      title: `Ata da Reunião - ${minuteData.date}`,
      year: currentYear,
      issuedByUserId: currentUser.id,
      issuedByName: currentUser.name,
      issuedAt: now,
      contentData: {
        chairPerson: minuteData.chairPerson,
        secretary: minuteData.secretary,
        agenda: minuteData.agenda,
        deliberations: minuteData.deliberations,
      },
      isCancelled: false,
    };

    const updatedActivities = state.activities.map((a) => {
      if (a.id === activityId) {
        return { ...a, minute };
      }
      return a;
    });

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      activities: updatedActivities,
      documents: [officialDoc, ...state.documents],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);

    logAction('activities', 'EMISSAO_ATA', `Ata ${minuteNumber} redigida e anexada`, activityId, minuteNumber);
    return { success: true, minuteNumber };
  };

  // --- FORMAÇÃO ---
  const updateTrainingProgress = (
    progressId: string,
    completedReqs: number[],
    notes?: string
  ) => {
    if (!can('training', 'EDIT')) {
      return { success: false, error: 'Apenas os instrutores podem registar requisitos concluídos.' };
    }

    const now = getNowISOString();

    setState((prev) => {
      const updated = prev.trainingProgress.map((prg) => {
        if (prg.id === progressId) {
          return {
            ...prg,
            completedRequirements: completedReqs,
            instructorValidated: true,
            observations: notes || prg.observations,
            updatedAt: now,
          };
        }
        return prg;
      });
      return { ...prev, trainingProgress: updated };
    });

    logAction('training', 'ATUALIZACAO_REQUISITOS', `Progresso de formação atualizado pelo instrutor`, progressId);
    return { success: true };
  };

  const createTrainingProgress = (
    memberId: string,
    type: 'classe' | 'especialidade',
    targetId: string,
    targetTitle: string,
    totalRequirements: number
  ) => {
    if (!can('training', 'CREATE')) {
      return { success: false, error: 'Sem permissão para inscrever membro em classe ou especialidade.' };
    }

    const nextId = `PRG-${Date.now().toString().slice(-4)}`;
    const newProgress: MemberTrainingProgress = {
      id: nextId,
      memberId,
      type,
      targetId,
      targetTitle,
      completedRequirements: [],
      totalRequirements,
      instructorUserId: currentUser.id,
      instructorName: currentUser.name,
      instructorValidated: false,
      finalAuthorizedApproval: false,
      updatedAt: getNowISOString(),
    };

    setState((prev) => ({
      ...prev,
      trainingProgress: [newProgress, ...prev.trainingProgress],
    }));

    logAction('training', 'INICIO_CLASSE', `Membro inscrito em ${targetTitle}`, nextId, targetTitle);
    return { success: true };
  };

  const approveFinalTraining = (progressId: string) => {
    if (
      !can('training', 'APPROVE') &&
      currentUser.role !== 'diretor' &&
      currentUser.role !== 'instrutor' &&
      currentUser.role !== 'admin_tecnico'
    ) {
      return { success: false, error: 'Apenas a Direção ou Instrutores autorizados têm permissão para aprovar investiduras.' };
    }

    const item = state.trainingProgress.find((p) => p.id === progressId);
    if (!item) return { success: false, error: 'Registo de formação não encontrado.' };

    const classObj = item.type === 'classe'
      ? state.classes.find((c) => c.id === item.targetId || c.code === item.targetId || c.title?.toLowerCase() === item.targetTitle?.toLowerCase())
      : null;
    const specObj = item.type === 'especialidade'
      ? state.specialties.find((s) => s.id === item.targetId || s.code === item.targetId || s.title?.toLowerCase() === item.targetTitle?.toLowerCase())
      : null;

    const actualReqs = (item.type === 'classe' ? classObj?.requirements : specObj?.requirements) || [];
    const totalCount = actualReqs.length > 0 ? actualReqs.length : (item.totalRequirements || 8);
    const allCompleted = Array.from({ length: totalCount }, (_, i) => i + 1);
    const now = getNowISOString();

    setState((prev) => {
      const updated = prev.trainingProgress.map((p) => {
        if (p.id === progressId) {
          return {
            ...p,
            totalRequirements: totalCount,
            completedRequirements: allCompleted,
            instructorValidated: true,
            finalAuthorizedApproval: true,
            approvedByDirectorId: currentUser.id,
            approvedAt: now,
            updatedAt: now,
          };
        }
        return p;
      });
      return { ...prev, trainingProgress: updated };
    });

    logAction(
      'training',
      'VALIDACAO_FINAL_INVESTIDURA',
      `Investidura autorizada e validada para ${item.targetTitle} (Membro: ${item.memberId})`,
      progressId,
      item.targetTitle
    );
    return { success: true };
  };

  const revokeTrainingApproval = (progressId: string) => {
    if (
      !can('training', 'APPROVE') &&
      currentUser.role !== 'diretor' &&
      currentUser.role !== 'instrutor' &&
      currentUser.role !== 'admin_tecnico'
    ) {
      return { success: false, error: 'Apenas a Direção ou Instrutores autorizados têm permissão para reabrir aprovações de investidura.' };
    }

    const item = state.trainingProgress.find((p) => p.id === progressId);
    if (!item) return { success: false, error: 'Registo de formação não encontrado.' };

    const now = getNowISOString();

    setState((prev) => ({
      ...prev,
      trainingProgress: prev.trainingProgress.map((p) => {
        if (p.id === progressId) {
          return {
            ...p,
            finalAuthorizedApproval: false,
            approvedByDirectorId: undefined,
            approvedAt: undefined,
            updatedAt: now,
          };
        }
        return p;
      }),
    }));

    logAction('training', 'REVOGACAO_INVESTIDURA', `Aprovação de investidura reaberta para reavaliação de ${item.targetTitle}`, progressId, item.targetTitle);
    return { success: true };
  };

  const deleteTrainingProgress = (progressId: string) => {
    if (
      !can('training', 'APPROVE') &&
      currentUser.role !== 'diretor' &&
      currentUser.role !== 'admin_tecnico'
    ) {
      return { success: false, error: 'Apenas a Direção possui permissão para retirar/desmatricular um membro da classe ou especialidade.' };
    }

    const item = state.trainingProgress.find((p) => p.id === progressId);
    if (!item) return { success: false, error: 'Registo de formação não encontrado.' };

    setState((prev) => ({
      ...prev,
      trainingProgress: prev.trainingProgress.filter((p) => p.id !== progressId),
    }));

    logAction('training', 'DESMATRICULA_CLASSE', `Membro desmatriculado/retirado de ${item.targetTitle}`, progressId, item.targetTitle);
    return { success: true };
  };

  const createTrainingClass = (data: {
    title: string;
    code?: string;
    minimumAge: number;
    requirements?: string[];
  }) => {
    if (!can('training', 'CREATE') && !can('training', 'ADMIN') && currentUser.role !== 'diretor' && currentUser.role !== 'instrutor' && currentUser.role !== 'admin_tecnico') {
      return { success: false, error: 'Apenas Diretores e Instrutores autorizados podem criar novas classes.' };
    }
    if (!data.title.trim()) {
      return { success: false, error: 'O título da classe é obrigatório.' };
    }

    const code = (data.code && data.code.trim()) 
      ? data.code.trim().toUpperCase() 
      : data.title.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 15);

    const reqs = data.requirements && data.requirements.length > 0 
      ? data.requirements.map(r => r.trim()).filter(Boolean)
      : [];

    const newClass: TrainingClass = {
      id: `CLS-${Date.now().toString().slice(-6)}`,
      code,
      title: data.title.trim(),
      minimumAge: Number(data.minimumAge) || 10,
      requirementsCount: reqs.length,
      requirements: reqs,
      active: true,
    };

    setState((prev) => ({
      ...prev,
      classes: [...prev.classes, newClass],
    }));

    logAction('training', 'CRIACAO_CLASSE', `Nova classe criada: ${newClass.title} (${newClass.code}) com ${reqs.length} requisitos`, newClass.id, newClass.title);
    return { success: true, id: newClass.id };
  };

  const updateTrainingClass = (
    id: string,
    titleOrData: string | { title: string; code?: string; minimumAge?: number; requirements?: string[] },
    minimumAge?: number,
    requirementsCount?: number
  ) => {
    if (!can('training', 'EDIT') && !can('training', 'ADMIN') && currentUser.role !== 'diretor' && currentUser.role !== 'admin_tecnico' && currentUser.role !== 'instrutor') {
      return { success: false, error: 'Não possui permissão para editar classes.' };
    }

    let title: string;
    let code: string | undefined;
    let minAge: number | undefined = minimumAge;
    let reqs: string[] | undefined;
    let reqCount: number | undefined = requirementsCount;

    if (typeof titleOrData === 'object' && titleOrData !== null) {
      title = titleOrData.title;
      code = titleOrData.code;
      minAge = titleOrData.minimumAge !== undefined ? titleOrData.minimumAge : minAge;
      reqs = titleOrData.requirements;
      if (reqs) {
        reqCount = reqs.length;
      }
    } else {
      title = titleOrData;
    }

    setState((prev) => {
      const exists = prev.classes.some((c) => c.id === id);
      let updatedClasses: TrainingClass[];

      if (exists) {
        updatedClasses = prev.classes.map((c) => {
          if (c.id === id) {
            const finalReqs = reqs !== undefined ? reqs.map(r => r.trim()).filter(Boolean) : c.requirements;
            const finalCount = finalReqs && finalReqs.length > 0 ? finalReqs.length : (reqCount !== undefined ? reqCount : c.requirementsCount);
            return {
              ...c,
              title: title.trim() || c.title,
              ...(code ? { code: code.trim().toUpperCase() } : {}),
              ...(minAge !== undefined ? { minimumAge: minAge } : {}),
              requirementsCount: finalCount,
              requirements: finalReqs,
            };
          }
          return c;
        });
      } else {
        const finalReqs = reqs !== undefined ? reqs.map(r => r.trim()).filter(Boolean) : [];
        const finalCount = finalReqs.length > 0 ? finalReqs.length : (reqCount || 8);
        const newClass: TrainingClass = {
          id,
          code: code ? code.trim().toUpperCase() : id,
          title: title.trim() || id,
          minimumAge: minAge || 10,
          requirementsCount: finalCount,
          requirements: finalReqs,
          active: true,
        };
        updatedClasses = [...prev.classes, newClass];
      }

      const updatedProgress = prev.trainingProgress.map((p) => {
        if (p.targetId === id || p.targetTitle.toLowerCase() === title.trim().toLowerCase()) {
          const cls = updatedClasses.find(c => c.id === id);
          const newTotal = cls ? cls.requirementsCount : (reqCount || p.totalRequirements);
          return {
            ...p,
            targetId: id,
            targetTitle: title.trim() || p.targetTitle,
            totalRequirements: newTotal,
          };
        }
        return p;
      });

      return {
        ...prev,
        classes: updatedClasses,
        trainingProgress: updatedProgress,
      };
    });

    logAction('training', 'ATUALIZACAO_CLASSE', `Classe atualizada: ${title}`, id, title);
    return { success: true };
  };

  const createSpecialtyHonor = (data: {
    title: string;
    code?: string;
    category: SpecialtyHonor['category'];
    requirements?: string[];
  }) => {
    if (!can('training', 'CREATE') && !can('training', 'ADMIN') && currentUser.role !== 'diretor' && currentUser.role !== 'instrutor' && currentUser.role !== 'admin_tecnico') {
      return { success: false, error: 'Apenas Diretores e Instrutores autorizados podem criar novas especialidades.' };
    }
    if (!data.title.trim()) {
      return { success: false, error: 'O título da especialidade é obrigatório.' };
    }

    const code = (data.code && data.code.trim())
      ? data.code.trim().toUpperCase()
      : `ESP-${data.title.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 15)}`;

    const reqs = data.requirements && data.requirements.length > 0
      ? data.requirements.map(r => r.trim()).filter(Boolean)
      : [];

    const newSpecialty: SpecialtyHonor = {
      id: `ESP-${Date.now().toString().slice(-6)}`,
      code,
      title: data.title.trim(),
      category: data.category || 'habilidades',
      requirementsCount: reqs.length,
      requirements: reqs,
      active: true,
    };

    setState((prev) => ({
      ...prev,
      specialties: [...prev.specialties, newSpecialty],
    }));

    logAction('training', 'CRIACAO_ESPECIALIDADE', `Nova especialidade criada: ${newSpecialty.title} (${newSpecialty.category}) com ${reqs.length} requisitos`, newSpecialty.id, newSpecialty.title);
    return { success: true, id: newSpecialty.id };
  };

  const updateSpecialtyHonor = (
    id: string,
    titleOrData: string | { title: string; code?: string; category?: SpecialtyHonor['category']; requirements?: string[] },
    category?: string,
    requirementsCount?: number
  ) => {
    if (!can('training', 'EDIT') && !can('training', 'ADMIN') && currentUser.role !== 'diretor' && currentUser.role !== 'admin_tecnico' && currentUser.role !== 'instrutor') {
      return { success: false, error: 'Não possui permissão para editar especialidades.' };
    }

    let title: string;
    let code: string | undefined;
    let cat: SpecialtyHonor['category'] | undefined = category as SpecialtyHonor['category'];
    let reqs: string[] | undefined;
    let reqCount: number | undefined = requirementsCount;

    if (typeof titleOrData === 'object' && titleOrData !== null) {
      title = titleOrData.title;
      code = titleOrData.code;
      cat = titleOrData.category || cat;
      reqs = titleOrData.requirements;
      if (reqs) {
        reqCount = reqs.length;
      }
    } else {
      title = titleOrData;
    }

    setState((prev) => {
      const exists = prev.specialties.some((s) => s.id === id);
      let updatedSpecialties: SpecialtyHonor[];

      if (exists) {
        updatedSpecialties = prev.specialties.map((s) => {
          if (s.id === id) {
            const finalReqs = reqs !== undefined ? reqs.map(r => r.trim()).filter(Boolean) : s.requirements;
            const finalCount = finalReqs && finalReqs.length > 0 ? finalReqs.length : (reqCount !== undefined ? reqCount : s.requirementsCount);
            return {
              ...s,
              title: title.trim() || s.title,
              ...(code ? { code: code.trim().toUpperCase() } : {}),
              ...(cat ? { category: cat } : {}),
              requirementsCount: finalCount,
              requirements: finalReqs,
            };
          }
          return s;
        });
      } else {
        const finalReqs = reqs !== undefined ? reqs.map(r => r.trim()).filter(Boolean) : [];
        const finalCount = finalReqs.length > 0 ? finalReqs.length : (reqCount || 6);
        const newSpec: SpecialtyHonor = {
          id,
          code: code ? code.trim().toUpperCase() : id,
          title: title.trim() || id,
          category: cat || 'habilidades',
          requirementsCount: finalCount,
          requirements: finalReqs,
          active: true,
        };
        updatedSpecialties = [...prev.specialties, newSpec];
      }

      const updatedProgress = prev.trainingProgress.map((p) => {
        if (p.targetId === id || p.targetTitle.toLowerCase() === title.trim().toLowerCase()) {
          const esp = updatedSpecialties.find(s => s.id === id);
          const newTotal = esp ? esp.requirementsCount : (reqCount || p.totalRequirements);
          return {
            ...p,
            targetId: id,
            targetTitle: title.trim() || p.targetTitle,
            totalRequirements: newTotal,
          };
        }
        return p;
      });

      return {
        ...prev,
        specialties: updatedSpecialties,
        trainingProgress: updatedProgress,
      };
    });

    logAction('training', 'ATUALIZACAO_ESPECIALIDADE', `Formação/Especialidade atualizada: ${title}`, id, title);
    return { success: true };
  };

  const deleteTrainingClass = (id: string) => {
    if (!can('training', 'ADMIN') && !can('training', 'EDIT') && !['diretor', 'admin_tecnico', 'instrutor', 'secretario'].includes(currentUser.role)) {
      return { success: false, error: 'Apenas Diretores, Secretários e Instrutores têm autorização para remover classes.' };
    }
    setState((prev) => ({
      ...prev,
      classes: prev.classes.filter((c) => c.id !== id),
      trainingProgress: prev.trainingProgress.filter((p) => p.targetId !== id),
    }));
    logAction('training', 'REMOCAO_CLASSE', `Classe removida: ${id}`, id);
    return { success: true };
  };

  const deleteSpecialtyHonor = (id: string) => {
    if (!can('training', 'ADMIN') && !can('training', 'EDIT') && !['diretor', 'admin_tecnico', 'instrutor', 'secretario'].includes(currentUser.role)) {
      return { success: false, error: 'Apenas Diretores, Secretários e Instrutores têm autorização para remover especialidades.' };
    }
    setState((prev) => ({
      ...prev,
      specialties: prev.specialties.filter((s) => s.id !== id),
      trainingProgress: prev.trainingProgress.filter((p) => p.targetId !== id),
    }));
    logAction('training', 'REMOCAO_ESPECIALIDADE', `Especialidade removida: ${id}`, id);
    return { success: true };
  };

  const addUnit = (name: string, category: MemberCategory | 'mista', leaderUserId?: string) => {
    if (currentUser.role !== 'diretor' && currentUser.role !== 'secretario' && currentUser.role !== 'admin_tecnico') {
      return { success: false, error: 'Apenas o Diretor e o Secretário podem adicionar novas equipas/unidades.' };
    }
    const newUnit = {
      id: `UNT-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      category,
      leaderUserId: leaderUserId || undefined,
      active: true,
    };
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        units: [...prev.settings.units, newUnit],
      },
    }));
    logAction('settings', 'CRIACAO_UNIDADE', `Equipa/Unidade criada: ${name}`, newUnit.id, name);
    return { success: true };
  };

  const updateUnit = (id: string, name: string, category: MemberCategory | 'mista', leaderUserId?: string) => {
    if (currentUser.role !== 'diretor' && currentUser.role !== 'secretario' && currentUser.role !== 'admin_tecnico') {
      return { success: false, error: 'Apenas o Diretor e o Secretário podem editar equipas/unidades.' };
    }
    const trimmedName = name.trim();
    let oldName = '';
    setState((prev) => {
      const oldUnit = prev.settings.units.find((u) => u.id === id);
      oldName = oldUnit?.name || '';
      return {
        ...prev,
        settings: {
          ...prev.settings,
          units: prev.settings.units.map((u) => (u.id === id ? { ...u, name: trimmedName, category, leaderUserId: leaderUserId || undefined } : u)),
        },
        // Update member unitOrTeam if name changed
        members: oldName && oldName !== trimmedName
          ? prev.members.map((m) => (m.unitOrTeam === oldName ? { ...m, unitOrTeam: trimmedName } : m))
          : prev.members,
      };
    });
    logAction('settings', 'ATUALIZACAO_UNIDADE', `Equipa/Unidade atualizada: ${trimmedName}`, id, trimmedName);
    return { success: true };
  };

  const deleteUnit = (id: string) => {
    if (currentUser.role !== 'diretor' && currentUser.role !== 'secretario' && currentUser.role !== 'admin_tecnico') {
      return { success: false, error: 'Apenas o Diretor e o Secretário podem remover equipas/unidades.' };
    }
    let unitName = '';
    setState((prev) => {
      const target = prev.settings.units.find((u) => u.id === id);
      unitName = target?.name || '';
      return {
        ...prev,
        settings: {
          ...prev.settings,
          units: prev.settings.units.filter((u) => u.id !== id),
        },
        members: unitName
          ? prev.members.map((m) => (m.unitOrTeam === unitName ? { ...m, unitOrTeam: undefined } : m))
          : prev.members,
      };
    });
    logAction('settings', 'REMOCAO_UNIDADE', `Equipa/Unidade removida: ${unitName}`, id, unitName);
    return { success: true };
  };

  const assignMemberToUnit = (memberId: string, unitOrTeam?: string) => {
    const isAllowed = currentUser.role === 'secretario' || currentUser.role === 'diretor' || currentUser.role === 'admin_tecnico' || can('members', 'EDIT');
    if (!isAllowed) {
      return { success: false, error: 'Apenas a Secretaria e a Administração podem alocar membros em equipas.' };
    }
    const now = getNowISOString();
    let memberName = '';
    setState((prev) => ({
      ...prev,
      members: prev.members.map((m) => {
        if (m.id === memberId) {
          memberName = m.fullName;
          return { ...m, unitOrTeam: unitOrTeam ? unitOrTeam.trim() : undefined, updatedAt: now };
        }
        return m;
      }),
    }));
    logAction('members', 'ALOCACAO_EQUIPA', `Membro ${memberName} alocado à equipa: ${unitOrTeam || 'Nenhuma'}`, memberId, memberName);
    return { success: true };
  };

  const updateMemberCategory = (memberId: string, category: MemberCategory) => {
    const isAllowed = currentUser.role === 'admin_tecnico' || currentUser.role === 'secretario' || currentUser.role === 'diretor' || can('members', 'EDIT');
    if (!isAllowed) {
      return { success: false, error: 'Apenas o Administrador e o Secretário podem editar as categorias dos membros.' };
    }
    const now = getNowISOString();
    let memberName = '';
    setState((prev) => ({
      ...prev,
      members: prev.members.map((m) => {
        if (m.id === memberId) {
          memberName = m.fullName;
          return { ...m, category, updatedAt: now };
        }
        return m;
      }),
    }));
    logAction('members', 'ALTERACAO_CATEGORIA', `Categoria do membro ${memberName} alterada para: ${category}`, memberId, memberName);
    return { success: true };
  };

  const deleteMember = (id: string, directionAuthorized?: boolean) => {
    // 1. Verificação obrigatória na grelha de autorizações (members: DELETE)
    if (!can('members', 'DELETE')) {
      return { success: false, error: 'A eliminação definitiva de membros exige autorização prévia da Direção configurada na grelha de permissões (members: DELETE).' };
    }
    // 2. Confirmação expressa de autorização da Direção
    const isDirectorOrAdmin = currentUser.role === 'diretor' || currentUser.role === 'admin_tecnico';
    if (!isDirectorOrAdmin && !directionAuthorized) {
      return { success: false, error: 'A eliminação definitiva exige a confirmação expressa de autorização prévia da Direção do Clube.' };
    }

    let memberName = '';
    const now = getNowISOString();
    const target = state.members.find(m => m.id === id);
    if (!target) return { success: false, error: 'Membro não encontrado.' };
    memberName = target.fullName;

    // Atualiza eventual pedido de autorização pendente/aprovado para executado
    const updatedRequests = (state.deletionRequests || []).map(r => {
      if (r.targetId === id && r.operationType === 'eliminacao' && (r.status === 'pendente' || r.status === 'aprovado') && !r.executedAt) {
        return {
          ...r,
          status: 'executado' as const,
          decidedByUserId: r.decidedByUserId || currentUser.id,
          decidedByName: r.decidedByName || currentUser.name,
          decidedAt: r.decidedAt || now,
          executedAt: now,
          executedByUserId: currentUser.id,
          executedByName: currentUser.name,
        };
      }
      return r;
    });

    // REGRA 2.4: Preserva integralmente recibos, movimentos financeiros, comprovativos e documentos oficiais
    const newState = {
      ...state,
      members: state.members.filter(m => m.id !== id),
      deletionRequests: updatedRequests,
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);
    logAction('members', 'ELIMINACAO_MEMBRO', `Membro eliminado definitivamente com autorização prévia da Direção: ${memberName}`, id, memberName);
    return { success: true };
  };

  // --- DOCUMENTOS OFICIAIS ---
  const createOfficialDoc = (
    type: OfficialDocument['documentType'],
    title: string,
    content: Record<string, unknown>,
    issuedToName?: string,
    issuedToMemberId?: string
  ) => {
    if (!can('documents', 'CREATE')) {
      return { success: false, error: 'Sem permissão para emitir documentos oficiais.' };
    }

    const prefixMap: Record<OfficialDocument['documentType'], string> = {
      recibo: 'REC',
      mapa_financeiro: 'MAP',
      folha_presenca: 'PRE',
      ata: 'ATA',
      declaracao_membro: 'DEC',
      certificado: 'CRT',
      relatorio_anual: 'REL',
    };

    const prefix = prefixMap[type] || 'DOC';
    const year = state.settings.currentYear;
    const existingNums = state.documents.map((d) => d.documentNumber);
    const docNumber = generateNextDocumentNumber(prefix, year, existingNums);

    const finalIssuedToName = issuedToName && issuedToName.trim() ? issuedToName.trim() : (state.members[0]?.fullName || 'Membro do Clube');
    const finalIssuedToMemberId = issuedToMemberId && issuedToMemberId.trim() ? issuedToMemberId.trim() : state.members[0]?.id;

    const newDoc: OfficialDocument = {
      id: `DOC-${Date.now()}`,
      documentNumber: docNumber,
      documentType: type,
      title,
      year,
      issuedToName: finalIssuedToName,
      issuedToMemberId: finalIssuedToMemberId,
      issuedByUserId: currentUser.id,
      issuedByName: currentUser.name,
      issuedAt: getNowISOString(),
      contentData: content,
      isCancelled: false,
    };

    setState((prev) => ({
      ...prev,
      documents: [newDoc, ...prev.documents],
    }));

    logAction('documents', 'EMISSAO_DOCUMENTO', `Emissão de documento ${docNumber}: ${title}`, docNumber, title);
    return { success: true, docNumber };
  };

  const cancelOfficialDoc = (id: string, reason: string) => {
    if (!can('documents', 'ARCHIVE')) {
      return { success: false, error: 'Sem autorização para anular documentos oficiais.' };
    }
    if (!reason || reason.trim().length < 5) {
      return { success: false, error: 'Obrigatório especificar o motivo da anulação.' };
    }

    const now = getNowISOString();
    let docNumber = '';

    setState((prev) => {
      const updated = prev.documents.map((d) => {
        if (d.id === id) {
          docNumber = d.documentNumber;
          return {
            ...d,
            isCancelled: true,
            cancellationReason: reason,
            cancelledAt: now,
          };
        }
        return d;
      });
      return { ...prev, documents: updated };
    });

    logAction('documents', 'ANULACAO_DOCUMENTO', `Documento ${docNumber} anulado: ${reason}`, id, docNumber, reason);
    return { success: true };
  };

  // --- PORTAL DO MEMBRO & PEDIDOS ---
  // --- CIRCULARES ---
  const createCircular = (data: Omit<Circular, 'id' | 'publishedAt' | 'publishedByUserId' | 'publishedByName' | 'readBy'>) => {
    if (!can('requests', 'CREATE') && currentUser.role !== 'diretor' && currentUser.role !== 'admin_tecnico' && currentUser.role !== 'secretario') {
      return { success: false, error: 'Sem autorização para publicar circulares oficiais.' };
    }

    const now = getNowISOString();
    const newCircular: Circular = {
      ...data,
      id: `CIRC-${Date.now()}`,
      publishedAt: now,
      publishedByUserId: currentUser.id,
      publishedByName: currentUser.name,
      readBy: [],
    };

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      circulars: [newCircular, ...state.circulars],
    };

    saveStateToStorage(nextState);
    setState(nextState);
    pushToFirestore(nextState);

    addNotification({
      title: `Circular Oficial: ${data.title}`,
      message: 'Uma nova circular oficial foi publicada. Consulte o Portal do Membro.',
      category: 'announcement',
      targetModule: 'member_portal',
      priority: data.priority === 'urgente' ? 'urgente' : data.priority === 'alta' ? 'alta' : 'normal',
    });

    logAction('requests', 'PUBLICACAO_CIRCULAR', `Circular publicada: ${data.title}`, newCircular.id, data.title);
    return { success: true };
  };

  const markCircularAsRead = (circularId: string) => {
    const memberId = currentUser.linkedMemberId;
    if (!memberId) return;

    const circular = state.circulars.find(c => c.id === circularId);
    if (!circular || circular.readBy.includes(memberId)) return;

    const now = getNowISOString();
    const updatedCirculars = state.circulars.map(c => 
      c.id === circularId ? { ...c, readBy: [...c.readBy, memberId] } : c
    );

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      circulars: updatedCirculars,
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);
  };

  const deleteCircular = (circularId: string) => {
    if (!can('requests', 'ADMIN') && currentUser.role !== 'admin_tecnico' && currentUser.role !== 'diretor' && currentUser.role !== 'secretario') {
      return;
    }

    const circular = state.circulars.find(c => c.id === circularId);
    if (!circular) return;

    const now = getNowISOString();
    const updatedCirculars = state.circulars.filter(c => c.id !== circularId);

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      circulars: updatedCirculars,
    };

    saveStateToStorage(nextState);
    setState(nextState);
    pushToFirestore(nextState);

    logAction('requests', 'REMOCAO_CIRCULAR', `Circular removida: ${circular.title}`, circularId, circular.title);
  };



  // --- CAPELANIA DIGITAL ---
  const submitChaplaincyRequest = (data: {
    category: ChaplaincyCategory;
    subject: string;
    message: string;
    confidential: boolean;
  }) => {
    if (!can('chaplaincy', 'CREATE')) {
      return { success: false, error: 'Sem permissão para enviar pedidos de capelania.' };
    }
    if (!data.subject.trim() || !data.message.trim()) {
      return { success: false, error: 'O assunto e a mensagem são obrigatórios.' };
    }

    const memberId = currentUser.linkedMemberId || currentUser.id;
    const member = state.members.find((m) => m.id === memberId);
    const memberName = member ? member.fullName : currentUser.name;

    const nextSeq = ((state.chaplaincyRequests || []).length + 1).toString().padStart(3, '0');
    const newId = `CHAP-${state.settings.currentYear}-${nextSeq}`;

    const newReq: ChaplaincyRequest = {
      id: newId,
      memberId,
      memberName,
      category: data.category,
      subject: data.subject.trim(),
      message: data.message.trim(),
      confidential: data.confidential,
      status: 'pendente',
      createdAt: getNowISOString(),
    };

    const newState = {
      ...state,
      chaplaincyRequests: [newReq, ...(state.chaplaincyRequests || [])],
    };
    setState(newState);
    saveStateToStorage(newState);

    addNotification({
      title: 'Novo Pedido de Capelania Digital',
      message: `${memberName} enviou um pedido de apoio pastoral: "${data.subject}"`,
      category: 'request',
      targetModule: 'chaplaincy',
      recipientRoles: ['capelao', 'diretor'],
      isConfidential: true,
      priority: data.confidential ? 'urgente' : 'normal',
    });

    logAction('chaplaincy', 'ENVIO_PEDIDO_CAPELANIA', `Pedido de capelania submetido por ${memberName}: ${data.subject}`, newId, data.subject);
    return { success: true };
  };

  const respondToChaplaincyRequest = (
    requestId: string,
    status: ChaplaincyStatus,
    responseNotes: string
  ) => {
    if (!can('chaplaincy', 'APPROVE')) {
      return { success: false, error: 'Sem permissão para responder a pedidos de capelania.' };
    }
    if (!responseNotes.trim()) {
      return { success: false, error: 'É obrigatório escrever uma resposta ou nota de acompanhamento.' };
    }

    const now = getNowISOString();
    let targetMemberId = '';
    let targetSubject = '';

    const updatedChaplaincy = (state.chaplaincyRequests || []).map((r) => {
      if (r.id === requestId) {
        targetMemberId = r.memberId;
        targetSubject = r.subject;
        return {
          ...r,
          status,
          responseNotes: responseNotes.trim(),
          respondedBy: `${currentUser.name} (${ROLE_LABELS[currentUser.role]?.label || currentUser.role})`,
          respondedAt: now,
        };
      }
      return r;
    });

    const newState = {
      ...state,
      chaplaincyRequests: updatedChaplaincy,
    };
    setState(newState);
    saveStateToStorage(newState);

    addNotification({
      title: `Pedido de Capelania Respondido`,
      message: `O Capelão / Diretor respondeu ao seu pedido confidencial de capelania: "${targetSubject || requestId}"`,
      category: 'request',
      targetModule: 'chaplaincy',
      recipientUserId: targetMemberId,
      isConfidential: true,
      priority: status === 'respondido' ? 'normal' : 'alta',
    });

    logAction('chaplaincy', 'RESPOSTA_CAPELANIA', `Pedido de capelania ${requestId} atualizado para ${status}`, requestId, responseNotes);
    return { success: true };
  };

  // --- SUGESTÕES À DIREÇÃO (CANAL CONFIDENCIAL MEMBRO ↔ DIRETOR) ---
  const submitMemberSuggestion = (data: {
    category: SuggestionCategory;
    subject: string;
    content: string;
    isAnonymous?: boolean;
  }) => {
    if (!data.subject.trim() || !data.content.trim()) {
      return { success: false, error: 'O assunto e o conteúdo da sugestão são obrigatórios.' };
    }

    const memberId = currentUser.linkedMemberId || currentUser.id;
    const member = state.members.find((m) => m.id === memberId);
    const memberName = member ? member.fullName : currentUser.name;
    const memberManualNumber = member ? member.manualNumber : undefined;

    const nextSeq = ((state.suggestions || []).length + 1).toString().padStart(4, '0');
    const newId = `SUG-${state.settings.currentYear}-${nextSeq}`;
    const now = getNowISOString();

    const newSuggestion: MemberSuggestion = {
      id: newId,
      memberId,
      memberName,
      memberManualNumber,
      isAnonymous: Boolean(data.isAnonymous),
      category: data.category,
      subject: data.subject.trim(),
      content: data.content.trim(),
      status: 'pendente',
      viewedByDirector: false,
      createdAt: now,
      updatedAt: now,
    };

    const newState = {
      ...state,
      suggestions: [newSuggestion, ...(state.suggestions || [])],
      updatedAt: now,
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    const authorLabel = data.isAnonymous ? 'Um membro (Confidencial/Anónimo)' : memberName;
    addNotification({
      title: '💡 Nova Sugestão de Membro à Direção',
      message: `${authorLabel} enviou uma nova sugestão confidencial: "${data.subject.trim()}". Acesse a aba da Direção no Portal do Membro para consultar.`,
      category: 'system',
      targetModule: 'member_portal',
      recipientRole: 'diretor',
      isConfidential: true,
      priority: 'alta',
    });

    addToast('Sugestão Enviada com Sucesso', 'A sua sugestão foi encaminhada confidencialmente ao Diretor do Clube.', 'success');
    logAction('member_portal', 'ENVIO_SUGESTAO_DIRECAO', `Sugestão confidencial enviada à Direção: ${data.subject.trim()}`, newId, data.subject.trim());
    return { success: true };
  };

  const markSuggestionAsViewed = (suggestionId: string) => {
    if (currentUser.role !== 'diretor' && currentUser.role !== 'admin_tecnico') {
      return { success: false, error: 'Apenas a Direção pode marcar sugestões como visualizadas.' };
    }

    const now = getNowISOString();
    let authorMemberId = '';
    let suggestionSubject = '';

    const updatedSuggestions = (state.suggestions || []).map((s) => {
      if (s.id === suggestionId) {
        authorMemberId = s.memberId;
        suggestionSubject = s.subject;
        return {
          ...s,
          viewedByDirector: true,
          viewedAt: now,
          viewedByDirectorName: currentUser.name,
          status: s.status === 'pendente' ? ('visualizado' as const) : s.status,
          updatedAt: now,
        };
      }
      return s;
    });

    const newState = {
      ...state,
      suggestions: updatedSuggestions,
      updatedAt: now,
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    if (authorMemberId) {
      addNotification({
        title: '👁️ Sugestão Visualizada pela Direção',
        message: `O Diretor visualizou a sua sugestão "${suggestionSubject}".`,
        category: 'member',
        targetModule: 'member_portal',
        recipientUserId: authorMemberId,
        isConfidential: true,
        priority: 'normal',
      });
    }

    addToast('Marcado como Visualizado', 'A sugestão foi sinalizada como visualizada pela Direção.', 'info');
    logAction('member_portal', 'VISUALIZACAO_SUGESTAO', `Diretor ${currentUser.name} visualizou a sugestão ${suggestionId}`, suggestionId, suggestionSubject);
    return { success: true };
  };

  const respondToSuggestion = (suggestionId: string, responseContent: string, markAsViewed: boolean = true) => {
    if (currentUser.role !== 'diretor' && currentUser.role !== 'admin_tecnico') {
      return { success: false, error: 'Apenas a Direção pode emitir respostas a sugestões dos membros.' };
    }

    const now = getNowISOString();
    let authorMemberId = '';
    let suggestionSubject = '';

    const updatedSuggestions = (state.suggestions || []).map((s) => {
      if (s.id === suggestionId) {
        authorMemberId = s.memberId;
        suggestionSubject = s.subject;
        const hasContent = Boolean(responseContent && responseContent.trim());
        return {
          ...s,
          responseContent: hasContent ? responseContent.trim() : undefined,
          respondedAt: hasContent ? now : undefined,
          respondedByDirectorName: hasContent ? currentUser.name : undefined,
          viewedByDirector: markAsViewed ? true : s.viewedByDirector,
          viewedAt: markAsViewed && !s.viewedAt ? now : s.viewedAt,
          viewedByDirectorName: markAsViewed && !s.viewedByDirectorName ? currentUser.name : s.viewedByDirectorName,
          status: hasContent ? ('respondido' as const) : (markAsViewed || s.viewedByDirector ? ('visualizado' as const) : ('pendente' as const)),
          updatedAt: now,
        };
      }
      return s;
    });

    const newState = {
      ...state,
      suggestions: updatedSuggestions,
      updatedAt: now,
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    if (authorMemberId && responseContent.trim()) {
      addNotification({
        title: '💬 Resposta do Diretor à sua Sugestão',
        message: `O Diretor respondeu à sua sugestão confidencial "${suggestionSubject}". Consulte a resposta no Portal do Membro.`,
        category: 'member',
        targetModule: 'member_portal',
        recipientUserId: authorMemberId,
        isConfidential: true,
        priority: 'alta',
      });
    }

    addToast('Resposta Guardada', 'A resposta confidencial do Diretor foi gravada com sucesso.', 'success');
    logAction('member_portal', 'RESPOSTA_SUGESTAO', `Diretor ${currentUser.name} respondeu à sugestão ${suggestionId}`, suggestionId, suggestionSubject);
    return { success: true };
  };

  const deleteSuggestion = (suggestionId: string) => {
    const target = (state.suggestions || []).find((s) => s.id === suggestionId);
    if (!target) return { success: false, error: 'Sugestão não encontrada.' };

    const isAuthor = target.memberId === (currentUser.linkedMemberId || currentUser.id);
    const isDirector = currentUser.role === 'diretor' || currentUser.role === 'admin_tecnico';

    if (!isAuthor && !isDirector) {
      return { success: false, error: 'Sem permissão para remover esta sugestão.' };
    }

    const now = getNowISOString();
    const newState = {
      ...state,
      suggestions: (state.suggestions || []).filter((s) => s.id !== suggestionId),
      updatedAt: now,
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    addToast('Sugestão Removida', 'A sugestão confidencial foi eliminada com sucesso.', 'info');
    logAction('member_portal', 'REMOCAO_SUGESTAO', `Sugestão ${suggestionId} eliminada`, suggestionId, target.subject);
    return { success: true };
  };

  const submitPaymentProof = (data: {
    feeDefinitionId: string;
    feeTitle: string;
    amountInCents: number;
    paymentMethod: PaymentProofReport['paymentMethod'];
    referenceCode: string;
    paymentDate: string;
    attachmentFileName: string;
    attachmentBase64?: string;
    accountId?: string;
  }) => {
    const memberId = currentUser.linkedMemberId || 'CDA-MEM-001';
    const member = state.members.find((m) => m.id === memberId);
    const memberName = member ? member.fullName : currentUser.name;

    const nextId = `PRF-${Date.now().toString().slice(-5)}`;
    const selectedAccount = state.accounts.find((a) => a.id === data.accountId) || state.accounts[0];

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 8);

    const newProof: PaymentProofReport = {
      id: nextId,
      memberId,
      memberName,
      feeDefinitionId: data.feeDefinitionId,
      feeTitle: data.feeTitle,
      amountInCents: data.amountInCents,
      paymentMethod: data.paymentMethod,
      referenceCode: data.referenceCode,
      paymentDate: data.paymentDate,
      attachmentFileName: data.attachmentFileName,
      attachmentBase64: data.attachmentBase64,
      expiresAt: expiresAt.toISOString(),
      accountId: selectedAccount ? selectedAccount.id : (state.accounts[0]?.id || 'ACC-01'),
      accountName: selectedAccount ? selectedAccount.name : (state.accounts[0]?.name || 'Conta Geral'),
      isVerifiedByTreasurer: false,
      status: 'submetido',
      createdAt: getNowISOString(),
    };

    const newState = {
      ...state,
      paymentProofs: [newProof, ...state.paymentProofs],
    };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    addNotification({
      title: 'Comprovativo de Pagamento Enviado',
      message: `${memberName} enviou comprovativo de ${data.feeTitle} (${formatKz(data.amountInCents)}). Ref: ${data.referenceCode}`,
      category: 'financial',
      targetModule: 'treasury',
      recipientRole: 'tesoureiro',
      isConfidential: true,
      priority: 'alta',
    });

    logAction('member_portal', 'SUBMISSAO_COMPROVATIVO', `Comprovativo enviado por ${memberName} (Ref: ${data.referenceCode}) para conta ${selectedAccount?.name || 'Geral'}`, nextId);
    return { success: true };
  };

  const verifyPaymentProof = (proofId: string, approve: boolean, rejectionReason?: string) => {
    if (!can('treasury', 'APPROVE')) {
      return { success: false, error: 'Apenas a Tesouraria tem competência para validar comprovativos de pagamento.' };
    }

    const proof = state.paymentProofs.find((p) => p.id === proofId);
    if (!proof) return { success: false, error: 'Comprovativo não encontrado.' };

    const now = getNowISOString();

    if (approve) {
      // Cria recibo automático para o membro
      const currentYear = state.settings.currentYear;
      const existingRecNumbers = state.receipts.map((r) => r.receiptNumber);
      const receiptNumber = generateNextDocumentNumber('REC', currentYear, existingRecNumbers);

      const newReceipt: PaymentReceipt = {
        id: receiptNumber,
        receiptNumber,
        memberId: proof.memberId,
        memberName: proof.memberName,
        feeDefinitionId: proof.feeDefinitionId,
        feeTitle: proof.feeTitle,
        periodLabel: `Ref: ${proof.referenceCode}`,
        amountPaidInCents: proof.amountInCents,
        paymentMethod: proof.paymentMethod,
        referenceOrProof: proof.referenceCode,
        treasurerUserId: currentUser.id,
        treasurerName: currentUser.name,
        paidAt: now,
        status: 'confirmado',
        notes: `Comprovativo validado por ${currentUser.name} (Conta: ${proof.accountName || 'Geral'})`,
      };

      setState((prev) => {
        const updatedProofs = prev.paymentProofs.map((p) => {
          if (p.id === proofId) {
            return {
              ...p,
              status: 'confirmado' as const,
              isVerifiedByTreasurer: true,
              verifiedByTreasurerId: currentUser.id,
              verifiedAt: now,
            };
          }
          return p;
        });

        // Credita na conta institucional escolhida pelo membro
        const targetAccountId = proof.accountId || prev.accounts[0]?.id || 'ACC-01';
        const updatedAccounts = prev.accounts.map((a) => {
          if (a.id === targetAccountId) {
            return { ...a, currentBalanceInCents: a.currentBalanceInCents + proof.amountInCents };
          }
          return a;
        });

        return {
          ...prev,
          paymentProofs: updatedProofs,
          receipts: [newReceipt, ...prev.receipts],
          accounts: updatedAccounts,
        };
      });

      logAction('treasury', 'VALIDACAO_COMPROVATIVO', `Comprovativo aprovado, recibo ${receiptNumber} gerado e creditado na conta ${proof.accountName || 'Geral'}`, proofId, receiptNumber);
    } else {
      setState((prev) => {
        const updatedProofs = prev.paymentProofs.map((p) => {
          if (p.id === proofId) {
            return {
              ...p,
              status: 'rejeitado' as const,
              isVerifiedByTreasurer: false,
              rejectionReason: rejectionReason || 'Comprovativo ilegível ou montante divergente.',
              verifiedByTreasurerId: currentUser.id,
              verifiedAt: now,
            };
          }
          return p;
        });
        return { ...prev, paymentProofs: updatedProofs };
      });

      logAction('treasury', 'REJEICAO_COMPROVATIVO', `Comprovativo rejeitado: ${rejectionReason}`, proofId, proofId, rejectionReason);
    }

    addNotification({
      title: approve ? 'Comprovativo de Pagamento Validado' : 'Comprovativo Rejeitado pela Tesouraria',
      message: approve
        ? `O seu comprovativo de ${proof.feeTitle} foi conferido com sucesso e o recibo oficial emitido.`
        : `O seu comprovativo de ${proof.feeTitle} foi rejeitado pela Tesouraria: ${rejectionReason || 'Ilegível ou divergente'}.`,
      category: 'financial',
      targetModule: 'member_portal',
      recipientUserId: proof.memberId,
      isConfidential: true,
      priority: approve ? 'normal' : 'urgente',
    });

    return { success: true };
  };



  // --- UTILIZADORES & ADMINISTRAÇÃO ---
  const createUserAccount = (user: Omit<UserAccount, 'id' | 'createdAt'> & { password?: string }) => {
    if (!can('audit', 'ADMIN') && currentUser.role !== 'admin_tecnico') {
      return { success: false, error: 'Apenas o Administrador Técnico tem autorização para criar contas de utilizador.' };
    }

    const emailClean = user.email.trim().toLowerCase();
    const exists = state.users.some((u) => u.email.trim().toLowerCase() === emailClean);
    if (exists) {
      return { success: false, error: 'Já existe uma conta de acesso com este endereço de e-mail.' };
    }

    const isInstitutional = user.email.toLowerCase() === 'institucional@clubedalvorada.ao' || 
                            user.role === 'admin_tecnico' || 
                            user.role === 'capelao' ||
                            user.name.toLowerCase().includes('institucional');
    const linkedMemberId = isInstitutional ? undefined : user.linkedMemberId;

    const newId = `USR-${Date.now().toString().slice(-4)}`;
    const newUser: UserAccount = {
      ...user,
      id: newId,
      linkedMemberId,
      createdAt: getNowISOString(),
    };

    const updatedUsers = [...state.users, newUser];
    const newState = {
      ...state,
      users: updatedUsers,
    };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    logAction('audit', 'CRIACAO_CONTA', `Conta criada para ${newUser.name} (${newUser.role})`, newId, newUser.email);
    return { success: true };
  };

  const updateUserAccount = (userId: string, data: Partial<UserAccount> & { manualNumber?: string }, newPassword?: string) => {
    if (!can('audit', 'ADMIN') && currentUser.role !== 'admin_tecnico') {
      return { success: false, error: 'Apenas o Administrador Técnico tem autorização para atualizar dados de login dos utilizadores.' };
    }
    const targetUser = state.users.find(u => u.id === userId);
    if (!targetUser) return { success: false, error: 'Utilizador não encontrado.' };

    const isInstitutional = targetUser.id === 'INST-001' || 
                            targetUser.id === 'USR-ADMIN' || 
                            targetUser.email.toLowerCase() === 'institucional@clubedalvorada.ao' || 
                            targetUser.role === 'admin_tecnico' ||
                            targetUser.role === 'capelao' ||
                            targetUser.name.toLowerCase().includes('institucional');

    if (isInstitutional && data.linkedMemberId && data.linkedMemberId.trim() !== '') {
      return { success: false, error: 'A Conta Institucional é estritamente independente e não pode ser vinculada a nenhum membro.' };
    }

    const effectiveLinkedMemberId = isInstitutional 
      ? undefined 
      : (data.linkedMemberId === '' ? undefined : (data.linkedMemberId !== undefined ? data.linkedMemberId : targetUser.linkedMemberId));

    const updatedUsers = state.users.map(u => {
      if (u.id === userId) {
        const userCopy = {
          ...u,
          ...data,
          linkedMemberId: effectiveLinkedMemberId,
          ...(newPassword !== undefined && newPassword.trim() !== '' ? { password: newPassword.trim() } : {}),
          passwordResetRequested: false,
        };
        delete (userCopy as any).manualNumber;
        return userCopy;
      }
      return u;
    });

    let updatedMembers = state.members;
    if (data.manualNumber !== undefined && effectiveLinkedMemberId) {
      updatedMembers = state.members.map(m => m.id === effectiveLinkedMemberId ? { ...m, manualNumber: data.manualNumber!.trim() } : m);
    }

    const newState = {
      ...state,
      users: updatedUsers,
      members: updatedMembers,
    };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    logAction('audit', 'ATUALIZACAO_CONTA_LOGIN', `Dados de login atualizados para ${targetUser.name}`, userId, targetUser.email);
    return { success: true };
  };

  const toggleUserActive = (userId: string) => {
    if (!can('audit', 'ADMIN')) return;
    const updated = state.users.map((u) => {
      if (u.id === userId) {
        return { ...u, active: !u.active };
      }
      return u;
    });
    const newState = { ...state, users: updated };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);
    logAction('audit', 'ALTERACAO_ESTADO_CONTA', `Estado da conta alternado`, userId);
  };

  const deleteUserAccount = (userId: string) => {
    if (!can('audit', 'ADMIN') && currentUser.role !== 'admin_tecnico') {
      return { success: false, error: 'Apenas o Administrador Técnico tem autorização para eliminar contas de utilizador.' };
    }
    
    const user = state.users.find(u => u.id === userId);
    if (!user) return { success: false, error: 'Utilizador não encontrado.' };

    // Proteção da conta institucional técnica de segurança
    if (user.id === 'INST-001' || user.id === 'USR-ADMIN' || user.email.toLowerCase() === 'institucional@clubedalvorada.ao') {
      return { success: false, error: 'A conta institucional e técnica de segurança não pode ser eliminada.' };
    }

    // Remoção real e definitiva da conta de utilizador sem listas negras de bloqueio
    const updatedUsers = state.users.filter(u => u.id !== userId);

    // Revoga subscrição push se existir
    import('../services/pushService').then(({ removePushSubscription }) => {
      removePushSubscription(userId);
    }).catch(() => {});

    // Se a conta a ser eliminada for a conta atualmente com sessão neste dispositivo, transita para conta institucional
    const nextCurrentUser = currentUser.id === userId ? {
      id: 'INST-001',
      name: 'Conta Institucional',
      email: 'institucional@clubedalvorada.ao',
      role: 'admin_tecnico' as RoleType,
      active: true,
      createdAt: getNowISOString(),
    } : currentUser;

    const newState = { 
      ...state, 
      users: updatedUsers,
      currentUser: nextCurrentUser,
    };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);
    logAction('audit', 'ELIMINACAO_CONTA', `Conta de utilizador eliminada definitivamente pelo administrador: ${user.name} (${user.role})`, userId, user.email);
    return { success: true };
  };


  const updateUserRole = (userId: string, newRole: RoleType) => {
    const isAdmin = currentUser.role === 'admin_tecnico' || can('audit', 'ADMIN');
    const isDirector = currentUser.role === 'diretor';

    if (!isAdmin && !isDirector) {
      return { success: false, error: 'Apenas o Administrador e o Diretor têm autorização para gerir ou promover cargos.' };
    }

    const targetUser = state.users.find(u => u.id === userId);
    if (!targetUser) return { success: false, error: 'Utilizador não encontrado.' };
    if (!targetUser.active) {
      return { success: false, error: 'Não é possível promover ou alterar o cargo de um utilizador com conta desativada.' };
    }

    // Regras exclusivas para o Diretor:
    // O Diretor pode promover a todos os cargos, mas NÃO pode promover a administrador nem diretor,
    // e não pode alterar contas de Administrador ou outro Diretor.
    if (isDirector && !isAdmin) {
      if (newRole === 'admin_tecnico') {
        return { success: false, error: 'O Diretor não tem autorização para promover ao cargo de Administrador.' };
      }
      if (newRole === 'diretor') {
        return { success: false, error: 'O Diretor não tem autorização para promover ao cargo de Diretor. Esta ação é reservada ao Administrador.' };
      }
      if (targetUser.role === 'admin_tecnico') {
        return { success: false, error: 'O Diretor não pode alterar o cargo do Administrador Técnico.' };
      }
      if (targetUser.role === 'diretor') {
        return { success: false, error: 'O Diretor não pode alterar o cargo de outro Diretor.' };
      }
    }

    setState((prev) => ({
      ...prev,
      users: prev.users.map(u => u.id === userId ? { ...u, role: newRole } : u)
    }));

    logAction(
      'audit',
      'ALTERACAO_CARGO',
      `${currentUser.role === 'diretor' ? 'Diretor' : 'Administrador'} alterou o cargo de ${targetUser.name} para ${newRole}`,
      userId,
      targetUser.name,
      newRole
    );
    return { success: true };
  };

  const updateSettings = (newSettings: Partial<ClubSettings>) => {
    if (!can('settings', 'EDIT') && currentUser.role !== 'admin_tecnico' && currentUser.role !== 'diretor') return;
    const now = getNowISOString();
    const nextState = {
      ...state,
      updatedAt: now,
      settings: { ...state.settings, ...newSettings },
    };
    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);
    logAction('settings', 'ATUALIZACAO_CONFIGURACAO', 'Configurações do clube atualizadas');
  };

  const openNewFiscalYear = (year: number) => {
    if (!can('settings', 'ADMIN')) {
      return { success: false, error: 'Apenas o Administrador Técnico tem autorização para abrir um novo ano fiscal.' };
    }
    setState((prev) => openNewFiscalYearService(prev, year));
    logAction('settings', 'ABERTURA_ANO_FISCAL', `Novo ano fiscal aberto: ${year}`);
    return { success: true };
  };

  const manualPasswordReset = (userId: string, newPassword: string) => {
    if (!can('audit', 'ADMIN')) {
      return { success: false, error: 'Apenas o Administrador Técnico pode redefinir palavras-passe.' };
    }
    const nowISO = getNowISOString();
    const updatedUsers = state.users.map(u => 
      u.id === userId 
        ? { ...u, password: newPassword.trim(), passwordResetRequested: false, lastPasswordChangedAt: nowISO } 
        : u
    );

    const updatedCurrentUser = state.currentUser.id === userId
      ? { ...state.currentUser, password: newPassword.trim(), passwordResetRequested: false, lastPasswordChangedAt: nowISO }
      : state.currentUser;

    const newState = {
      ...state,
      users: updatedUsers,
      currentUser: updatedCurrentUser,
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    logAction('audit', 'REDEFINICAO_SENHA', `Palavra-passe redefinida manualmente para o utilizador ${userId} e tempo de 2 meses reiniciado`, userId);
    return { success: true };
  };

  const requestPasswordReset = (identifier: string) => {
    const cleanId = identifier.trim();
    let user = state.users.find(u => 
      u.email.toLowerCase() === cleanId.toLowerCase() || 
      u.id.toLowerCase() === cleanId.toLowerCase() ||
      u.linkedMemberId === cleanId
    );
    
    if (!user) {
      const member = state.members.find(m => m.id === cleanId || m.manualNumber === cleanId || m.email?.toLowerCase() === cleanId.toLowerCase());
      if (member) {
        user = state.users.find(u => u.linkedMemberId === member.id);
      }
    }

    if (!user) {
      return { success: false, error: 'Utilizador não encontrado no sistema. Por favor contacte o Administrador.' };
    }

    const updatedUsers = state.users.map(u => u.id === user!.id ? { ...u, passwordResetRequested: true } : u);
    const newState = {
      ...state,
      users: updatedUsers,
    };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);
    logAction('audit', 'SOLICITACAO_REDEFINICAO_SENHA', `Solicitação de redefinição de senha para ${user.name}`, user.id);
    return { success: true };
  };

  const selfResetPassword = (newPassword: string) => {
    if (!newPassword || newPassword.trim().length < 6) {
      return { success: false, error: 'A nova palavra-passe deve conter pelo menos 6 caracteres.' };
    }

    const user = state.users.find(u => u.id === currentUser.id);
    if (!user) {
      return { success: false, error: 'Conta de utilizador não encontrada.' };
    }

    const now = new Date();
    const nowISO = getNowISOString();
    const COOLDOWN_DAYS = 60; // 1 vez a cada 2 meses (aprox 60 dias)

    if (user.lastPasswordChangedAt) {
      const lastChanged = new Date(user.lastPasswordChangedAt).getTime();
      const diffMs = now.getTime() - lastChanged;
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays < COOLDOWN_DAYS) {
        const daysRemaining = Math.ceil(COOLDOWN_DAYS - diffDays);
        const nextAllowedDate = new Date(lastChanged + COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
        return {
          success: false,
          error: `A redefinição direta no portal só é permitida 1 vez a cada 2 meses. A última alteração ocorreu em ${formatDateAO(user.lastPasswordChangedAt)}. Próxima alteração disponível em ${formatDateAO(nextAllowedDate)} (faltam ${daysRemaining} dias). Para redefinir dentro deste intervalo, use o método definido pelo sistema (solicitação assistida ao Administrador Técnico).`,
          nextAllowedDate,
          daysRemaining,
        };
      }
    }

    const updatedUser: UserAccount = {
      ...user,
      password: newPassword.trim(),
      lastPasswordChangedAt: nowISO,
      passwordResetRequested: false,
    };

    const newState = {
      ...state,
      users: state.users.map(u => u.id === user.id ? updatedUser : u),
      currentUser: updatedUser,
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    logAction('member_portal', 'REDEFINICAO_PROPRIA_SENHA', 'Utilizador redefiniu a sua própria senha com sucesso no Portal do Membro.', user.id, user.name);
    return { success: true };
  };

  const resetAllDemoData = () => {
    const fresh = resetToDemoData();
    setState(fresh);
  };

  const resetCleanSlate = () => {
    if (currentUser.role !== 'admin_tecnico' && !can('audit', 'ADMIN')) {
      return { success: false, error: 'Apenas o Administrador Técnico possui permissão para reiniciar o sistema do zero.' };
    }
    const clean = resetToCleanAdminOnlyState(currentUser);
    setState(clean);
    return { success: true };
  };

  const cleanStorageSpace = async () => {
    if (currentUser.role !== 'admin_tecnico' && !can('audit', 'ADMIN')) {
      return { success: false, error: 'Apenas o Administrador Técnico possui permissão para executar a limpeza de armazenamento do sistema.' };
    }
    const cleaned = cleanSystemStorageSpace(state, currentUser);
    setState(cleaned);
    await pushToFirestore(cleaned);
    return { success: true };
  };

  const createTreasuryAccount = (data: Omit<TreasuryAccount, 'id' | 'currentBalanceInCents' | 'active'>) => {
    if (!can('treasury', 'CREATE_ACCOUNT')) {
      return { success: false, error: 'Não possui permissão para criar novas contas financeiras.' };
    }
    const newAccount: TreasuryAccount = {
      ...data,
      id: `ACC-${Date.now()}`,
      currentBalanceInCents: data.initialBalanceInCents,
      active: true,
    };
    setState((prev) => ({
      ...prev,
      accounts: [...prev.accounts, newAccount],
    }));
    logAction('treasury', 'CRIACAO_CONTA', `Nova conta financeira criada: ${data.name}`, newAccount.id, data.name);
    return { success: true, id: newAccount.id };
  };

  const deleteTreasuryAccount = (id: string) => {
    if (!can('treasury', 'DELETE_ACCOUNT')) {
      return { success: false, error: 'Não possui permissão para remover contas financeiras.' };
    }
    
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== id),
    }));
    logAction('treasury', 'REMOCAO_CONTA', `Conta financeira removida: ${id}`, id, '');
    return { success: true };
  };

  const createFeeDefinition = (data: Omit<FeeDefinition, 'id'>) => {
    if (!can('treasury', 'CREATE_RUBRIC')) {
      return { success: false, error: 'Não possui permissão para criar novas rubricas financeiras.' };
    }
    const newFee: FeeDefinition = {
      ...data,
      id: `FEE-${Date.now()}`,
    };
    setState((prev) => ({
      ...prev,
      fees: [...prev.fees, newFee],
    }));
    logAction('treasury', 'CRIACAO_RUBRICA', `Nova rubrica criada: ${data.title}`, newFee.id, data.title);
    return { success: true, id: newFee.id };
  };

  const updateFeeDefinition = (id: string, data: Partial<FeeDefinition>) => {
    if (!can('treasury', 'CREATE_RUBRIC') && !can('treasury', 'EDIT')) {
      return { success: false, error: 'Não possui permissão para atualizar rubricas financeiras.' };
    }
    setState((prev) => ({
      ...prev,
      fees: prev.fees.map((f) => f.id === id ? { ...f, ...data } : f),
    }));
    logAction('treasury', 'ATUALIZACAO_RUBRICA', `Rubrica atualizada: ${id}`, id, data.title || '');
    return { success: true };
  };

  const deleteFeeDefinition = (id: string) => {
    if (!can('treasury', 'DELETE_RUBRIC')) {
      return { success: false, error: 'Não possui permissão para remover rubricas financeiras.' };
    }
    setState((prev) => ({
      ...prev,
      fees: prev.fees.filter((f) => f.id !== id),
    }));
    logAction('treasury', 'REMOCAO_RUBRICA', `Rubrica removida: ${id}`, id, '');
    return { success: true };
  };

  const importBackupJson = (jsonData: string) => {
    if (!can('audit', 'ADMIN')) {
      return { success: false, error: 'Apenas o Administrador Técnico pode restaurar cópias de segurança.' };
    }

    try {
      const parsed = JSON.parse(jsonData);
      if (!parsed.members || !parsed.receipts || !parsed.users) {
        return { success: false, error: 'Ficheiro de cópia de segurança inválido: estrutura incompleta.' };
      }
      setState(parsed);
      saveStateToStorage(parsed);
      logAction('audit', 'RESTAURACAO_BACKUP', 'Restauração integral de dados efetuada com sucesso');
      return { success: true };
    } catch {
      return { success: false, error: 'Erro ao interpretar JSON de restauro.' };
    }
  };

  const exportBackupJson = () => {
    logAction('audit', 'EXPORTACAO_BACKUP', 'Exportação de cópia de segurança do sistema');
    return JSON.stringify(state, null, 2);
  };


  return (
    <ClubContext.Provider
      value={{
        state,
        currentUser,
        setCurrentUser,
        switchRole,
        can,
        addMember,
        updateMember,
        archiveMember,
        unarchiveMember,
        renewMemberAnnual,
        requestMemberOperation,
        decideMemberOperationRequest,
        executeApprovedMemberOperation,
        uploadMemberPhoto,
        deleteMemberPhoto,
        createReceipt,
        cancelReceipt,
        createExpense,
        approveExpense,
        rejectExpense,
        payExpense,
        closeFiscalMonth,
        reopenFiscalMonth,
        createActivity,
        updateActivityStage,
        deleteActivity,
        toggleAttendance,
        addTaskToActivity,
        updateTaskStatus,
        saveMinuteToActivity,
        updateTrainingProgress,
        createTrainingProgress,
        approveFinalTraining,
        revokeTrainingApproval,
        deleteTrainingProgress,
        createOfficialDoc,
        cancelOfficialDoc,
        submitPortalRequest: () => ({ success: false, error: 'Módulo de pedidos substituído por Circulares.' }),
        respondToRequest: () => ({ success: false, error: 'Módulo de pedidos substituído por Circulares.' }),
        submitPaymentProof,
        verifyPaymentProof,
        submitChaplaincyRequest,
        respondToChaplaincyRequest,
        submitMemberSuggestion,
        markSuggestionAsViewed,
        respondToSuggestion,
        deleteSuggestion,
        createCircular,
        markCircularAsRead,
        deleteCircular,
        addAnnouncement: () => {},
        addNotification,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        deleteNotification,
        clearAllNotifications,
        toasts,
        addToast,
        dismissToast,
        soundEnabled,
        toggleSoundEnabled,
        createFeeDefinition,
        updateFeeDefinition,
        deleteFeeDefinition,
        createTreasuryAccount,
        deleteTreasuryAccount,
        createUserAccount,
        toggleUserActive,
        deleteUserAccount,
        updateSettings,
        openNewFiscalYear,
        manualPasswordReset,
        requestPasswordReset,
        selfResetPassword,
        resetAllDemoData,
        resetToCleanAdminOnlyState: resetCleanSlate,
        cleanSystemStorageSpace: cleanStorageSpace,
        importBackupJson,
        exportBackupJson,
        updateRolePermission,
        createTrainingClass,
        updateTrainingClass,
        deleteTrainingClass,
        createSpecialtyHonor,
        updateSpecialtyHonor,
        deleteSpecialtyHonor,
        addUnit,
        updateUnit,
        deleteUnit,
        assignMemberToUnit,
        deleteMember,
        updateMemberCategory,
        updateUserRole,
        updateUserAccount,
        sendMessage,
        markMessageAsRead,
        replyToMessage,
        deleteMessage,
        syncFromCloud,
        forceSyncCloud,
        runIntegrityVerification,
        isQuotaExceeded,
        theme,
        toggleTheme,
      }}
    >
      {children}
    </ClubContext.Provider>
  );
};

export const useClub = () => {
  const context = useContext(ClubContext);
  if (!context) {
    throw new Error('useClub must be used within a ClubProvider');
  }
  return context;
};
