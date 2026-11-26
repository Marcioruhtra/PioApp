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
  QuotaConfig,
  QuotaDebtWaiver,
  AssociateDirective,
  AssociateDirectivePriority,
  AssociateDirectiveStatus,
  TeamEvaluation,
  MusicItem,
  MemberEnrollmentRequest,
  MemberDocumentationStatus,
  EnrollmentScheduleConfig,
  ActivityRsvpStatus,
  ActivityTask,
  TeamChatMessage,
  TeamTask,
  TeamNote,
  TeamAward,
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
import {
  hasPermission,
  ROLE_PERMISSIONS_MATRIX,
  updatePermission,
  syncPermissionsMatrix,
  ROLE_LABELS,
  canGrantAssociateDirectorModule,
  canGrantWaiveQuotaDebt,
  canGrantApproveEnrollment,
  hasApproveEnrollmentPermission,
  canGrantManageEnrollmentPeriod,
  hasManageEnrollmentPeriodPermission,
  canGrantManageReconfirmationPeriod,
  hasManageReconfirmationPeriodPermission,
  canGrantApproveMemberAccount,
  hasApproveMemberAccountPermission,
  canGrantDeleteMemberUploads,
  hasDeleteMemberUploadsPermission,
  canGrantExportEnrollmentReconfLists,
  canGrantViewActivityFinancials,
  canExecuteMemberDeletion,
  sanitizeRoleType,
} from '../services/permissionService';
import { resolveMinuteOfficers } from '../utils/documentSigner';
import { applyBatchTrainingRequirementUpdate } from '../utils/associateTrainingUtils';
import {
  canActivityHaveMinute,
  canManageActivityPortalVisibility,
  getActivityDateOnly,
  applyBatchAttendanceToActivities,
  normalizeActivityType,
  normalizeActivityStage,
} from '../utils/activityUtils';
import {
  canPostInTeamChat,
  canDeleteTeamChatMessage,
  isAssignedTeamLeader,
  isDirectionChatMonitor,
} from '../utils/teamUtils';
import {
  MemberRegistrationFormData,
  MemberReconfirmationInput,
  EnrollmentReconfirmationExportType,
  EnrollmentReconfirmationPdfResult,
  buildEnrollmentAndReconfirmationPdf,
  validateEnrollmentSubmission,
  buildEnrollmentRequest,
  buildApprovedMemberFromEnrollment,
  markEnrollmentReviewed,
  startEnrollmentReview,
  generateNextMemberId,
  removeEnrollmentRequestsForDeletedMember,
  reconcileApprovedEnrollmentsWithMembers,
  validateEnrollmentScheduleInput,
  evaluateEnrollmentAvailability,
  formatScheduleDateTimeLabel,
  applyMemberReconfirmation,
  finalizeEndedEnrollmentPeriod,
  buildResubmittedEnrollmentRequest,
} from '../services/enrollmentService';
import { createAuditLog } from '../services/auditService';
import { getNowISOString, formatDateAO, generateManualNumber } from '../utils/date';
import { formatKz } from '../utils/currency';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { doc, setDoc, getDoc, getDocFromServer, onSnapshot } from 'firebase/firestore';
import { verifyAndRepairMembersIntegrity, sanitizeMemberIntegrity, IntegrityCheckResult } from '../services/memberIntegrityService';
import { ToastMessage } from '../components/common/ToastContainer';
import { playNotificationSound } from '../utils/notificationSound';
import { showNativeNotification, removePushSubscription } from '../services/pushService';
import { isNotificationAuthorizedForUser } from '../utils/notificationSecurity';
import {
  isInstitutionalAccountRecord,
  reconcileUsersAndMembers,
  syncMemberChangesToUsers,
  syncUserWithLinkedMember,
  getStrictLinkedMember,
  removeLinkedAccountsForMember,
  deactivateLinkedAccountsForMember,
  reactivateLinkedAccountsForMember,
  resolveLinkedMember,
  isDirectionMember,
  isDirectionRole,
  buildSelfServiceMemberAccount,
  confirmPendingMemberAccount as confirmPendingMemberAccountService,
  rejectPendingMemberAccount as rejectPendingMemberAccountService,
  isPendingMemberAccountConfirmation,
} from '../services/accountSyncService';
import {
  DEFAULT_QUOTA_FEE_ID,
  calculateMemberQuotaSummary,
  getSelectableInstitutionalFees,
  getTodayISODate,
  isFixedQuotaRubric,
  resolveQuotaConfig,
  reverseReceiptFromTreasuryAccounts,
  calculateMonthlyFiscalSummary,
  calculateMonthlyReconciliationPreview,
  isFiscalPeriodLocked,
  isDateInLockedFiscalPeriod,
} from '../services/quotaService';
import {
  getNextMonotonicSyncTimestamp,
  hasCloudPayloadChanged,
  isSafeCloudWritePayload,
  shouldSkipIncomingSnapshot,
  getReconnectDelayMs,
} from '../services/realtimeSyncService';

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
  submitEnrollmentRequest: (
    data: MemberRegistrationFormData
  ) => Promise<{ success: boolean; request?: MemberEnrollmentRequest; error?: string }>;
  resubmitEnrollmentRequest: (
    rejectedProtocolNumber: string,
    data: MemberRegistrationFormData
  ) => Promise<{ success: boolean; request?: MemberEnrollmentRequest; error?: string }>;
  markEnrollmentUnderReview: (
    requestId: string
  ) => { success: boolean; request?: MemberEnrollmentRequest; error?: string };
  updateEnrollmentReviewMessage: (
    requestId: string,
    reviewMessage: string
  ) => { success: boolean; request?: MemberEnrollmentRequest; error?: string };
  approveEnrollmentRequest: (
    requestId: string,
    options?: {
      manualNumber?: string;
      category?: MemberCategory;
      unitOrTeam?: string;
      reason?: string;
      documentationStatus?: MemberDocumentationStatus;
      missingDocumentsNote?: string;
    }
  ) => { success: boolean; member?: Member; error?: string };
  rejectEnrollmentRequest: (
    requestId: string,
    reason: string
  ) => { success: boolean; error?: string };
  updateMemberDocumentationStatus: (
    memberId: string,
    documentationStatus: MemberDocumentationStatus,
    missingDocumentsNote?: string
  ) => { success: boolean; error?: string };
  reopenEnrollments: (schedule: {
    openDate?: string;
    openTime?: string;
    closeDate?: string;
    closeTime?: string;
    enableEnrollments?: boolean;
    enableReconfirmation?: boolean;
  }) => { success: boolean; config?: EnrollmentScheduleConfig; error?: string };
  closeEnrollmentsImmediately: (scope?: 'all' | 'enrollments' | 'reconfirmation') => {
    success: boolean;
    config?: EnrollmentScheduleConfig;
    summary?: EnrollmentScheduleConfig['finalizationSummary'];
    error?: string;
  };
  submitMemberReconfirmation: (
    memberId: string,
    data: MemberReconfirmationInput
  ) => Promise<{ success: boolean; member?: Member; error?: string }>;
  finalizeEnrollmentPeriodIfEnded: () => {
    finalized: boolean;
    summary?: EnrollmentScheduleConfig['finalizationSummary'];
  };
  exportEnrollmentReconfirmationList: (
    listType: EnrollmentReconfirmationExportType
  ) => EnrollmentReconfirmationPdfResult;

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
  }) => { success: boolean; receipt?: PaymentReceipt; receiptNumber?: string; error?: string };
  cancelReceipt: (id: string, reason: string) => { success: boolean; error?: string };
  updateQuotaConfig: (
    configData: Partial<QuotaConfig> & { amountInCents: number }
  ) => { success: boolean; config?: QuotaConfig; error?: string };
  regularizeMemberQuota: (data: {
    memberId: string;
    amountPaidInCents: number;
    paymentMethod: PaymentReceipt['paymentMethod'];
    periodLabel?: string;
    accountId?: string;
    referenceOrProof?: string;
    notes?: string;
  }) => { success: boolean; receipt?: PaymentReceipt; receiptNumber?: string; error?: string };
  batchRegularizeQuotas: (data: {
    memberIds: string[];
    paymentMethod: PaymentReceipt['paymentMethod'];
    accountId: string;
    periodLabel?: string;
    amountMode: 'debt_balance' | 'fixed_amount';
    fixedAmountInCents?: number;
    referenceOrProof?: string;
    notes?: string;
  }) => {
    success: boolean;
    count?: number;
    skippedCount?: number;
    totalAmountInCents?: number;
    receipts?: PaymentReceipt[];
    error?: string;
  };
  waiveMemberQuotaDebt: (data: {
    memberId: string;
    reason: string;
    customAmountInCents?: number;
  }) => { success: boolean; waiver?: QuotaDebtWaiver; error?: string };
  waiveAllPendingQuotaDebts: (data: {
    memberIds: string[];
    reason: string;
  }) => { success: boolean; count: number; totalWaivedInCents: number; error?: string };
  reverseQuotaDebtWaiver: (
    waiverId: string,
    reason: string
  ) => { success: boolean; error?: string };
  createExpense: (data: {
    title: string;
    description: string;
    category: string;
    amountInCents: number;
    accountId?: string;
    invoiceFileName?: string;
    invoiceBase64?: string;
  }) => { success: boolean; error?: string };
  approveExpense: (id: string, reason?: string) => { success: boolean; error?: string };
  rejectExpense: (id: string, reason: string) => { success: boolean; error?: string };
  payExpense: (
    id: string,
    accountId: string,
    proofUrl?: string,
    proofAttachment?: { fileName?: string; base64?: string }
  ) => { success: boolean; error?: string };
  closeFiscalMonth: (
    year: number,
    month: number,
    options?: {
      verifiedBalancesByAccountId?: Record<string, number>;
      reconciliationNotes?: string;
    }
  ) => { success: boolean; error?: string; closing?: MonthlyClosing };
  reopenFiscalMonth: (id: string, reason: string) => { success: boolean; error?: string };

  // Atividades e Reuniões
  createActivity: (data: Omit<ClubActivity, 'id' | 'createdAt' | 'tasks' | 'attendees'>) => { success: boolean; error?: string; activity?: ClubActivity; id?: string };
  updateActivity: (
    id: string,
    data: Partial<Omit<ClubActivity, 'id' | 'createdAt' | 'tasks' | 'attendees' | 'minute' | 'rsvps'>>
  ) => { success: boolean; error?: string; activity?: ClubActivity };
  updateActivityStage: (id: string, stage: ClubActivity['stage']) => { success: boolean; error?: string };
  decideActivityApproval: (
    id: string,
    decision: 'aprovar' | 'devolver',
    notes?: string
  ) => { success: boolean; error?: string };
  toggleActivityPortalVisibility: (id: string, visible: boolean) => { success: boolean; error?: string };
  deleteActivity: (id: string) => { success: boolean; error?: string };
  toggleAttendance: (activityId: string, memberId: string, present: boolean, notes?: string) => void;
  batchToggleAttendance: (activityId: string, memberIds: string[], present: boolean, notes?: string) => void;
  addTaskToActivity: (activityId: string, task: Omit<ClubActivity['tasks'][0], 'id'>) => { success: boolean; error?: string };
  updateTaskStatus: (activityId: string, taskId: string, status: ClubActivity['tasks'][0]['status']) => { success: boolean; error?: string };
  updateTaskInActivity: (
    activityId: string,
    taskId: string,
    updates: Partial<Omit<ActivityTask, 'id'>>
  ) => { success: boolean; error?: string };
  deleteTaskFromActivity: (activityId: string, taskId: string) => { success: boolean; error?: string };
  saveMinuteToActivity: (
    activityId: string,
    minuteData: Omit<NonNullable<ClubActivity['minute']>, 'id' | 'minuteNumber'>,
    tasksToAdd?: Omit<ActivityTask, 'id'>[]
  ) => { success: boolean; minuteNumber?: string; error?: string };
  submitActivityRsvp: (
    activityId: string,
    status: ActivityRsvpStatus,
    note?: string
  ) => { success: boolean; error?: string };

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
  batchEnrollTrainingProgress: (data: {
    memberIds: string[];
    type: 'classe' | 'especialidade';
    targetId: string;
    targetTitle: string;
    totalRequirements: number;
    instructorUserId?: string;
    instructorName?: string;
  }) => { success: boolean; createdCount?: number; skippedCount?: number; error?: string };
  assignTrainingInstructor: (
    progressId: string,
    instructorUserId: string,
    instructorName: string
  ) => { success: boolean; error?: string };
  batchUpdateTrainingRequirements: (data: {
    progressIds: string[];
    requirementNumber: number;
    completed: boolean;
    notes?: string;
  }) => { success: boolean; updatedCount?: number; error?: string };
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
    proposedChanges?: MemberPortalRequest['proposedChanges'];
    attachmentFileName?: string;
    attachmentBase64?: string;
  }) => { success: boolean; request?: MemberPortalRequest; error?: string };
  respondToRequest: (
    requestId: string,
    status: MemberPortalRequest['status'],
    responseNotes: string,
    options?: { applyChanges?: boolean }
  ) => { success: boolean; error?: string };
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

  addAnnouncement: (
    title: string,
    content: string,
    urgency: ClubAnnouncement['urgency'],
    targetAudience: ClubAnnouncement['targetAudience']
  ) => { success: boolean; error?: string };
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
  createSelfServiceMemberAccount: (
    memberId: string,
    password: string,
    confirmPassword: string
  ) => Promise<{ success: boolean; account?: UserAccount; error?: string }>;
  approvePendingMemberAccount: (
    userId: string
  ) => { success: boolean; account?: UserAccount; error?: string };
  rejectPendingMemberAccount: (
    userId: string,
    reason?: string
  ) => { success: boolean; error?: string };
  toggleUserActive: (userId: string) => { success: boolean; error?: string };
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
  deleteMember: (id: string, directionAuthorized?: boolean, reason?: string) => { success: boolean; error?: string };
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
  refreshFromCloud: () => Promise<boolean>;
  runIntegrityVerification: () => Promise<{ success: boolean; result: IntegrityCheckResult }>;

  // Gabinete Exclusivo do Diretor-associado
  createAssociateDirective: (data: {
    title: string;
    description: string;
    targetUnitName: string;
    assignedLeaderName?: string;
    priority: AssociateDirectivePriority;
    dueDate: string;
    checklistNotes?: string;
  }) => { success: boolean; directive?: AssociateDirective; error?: string };
  updateAssociateDirectiveStatus: (
    id: string,
    status: AssociateDirectiveStatus,
    checklistNotes?: string
  ) => { success: boolean; error?: string };
  deleteAssociateDirective: (id: string) => { success: boolean; error?: string };
  saveTeamEvaluation: (data: {
    unitId: string;
    unitName: string;
    periodLabel: string;
    disciplineScore: number;
    teamworkScore: number;
    punctualityScore: number;
    trainingCommitmentScore: number;
    observations?: string;
  }) => { success: boolean; evaluation?: TeamEvaluation; error?: string };
  deleteTeamEvaluation: (id: string) => { success: boolean; error?: string };

  // Módulo de Música e Louvor
  createMusicItem: (
    data: Omit<MusicItem, 'id' | 'createdAt'>
  ) => Promise<{ success: boolean; item?: MusicItem; error?: string; warning?: string }>;
  updateMusicItem: (
    id: string,
    data: Partial<MusicItem>
  ) => Promise<{ success: boolean; item?: MusicItem; error?: string; warning?: string }>;
  deleteMusicItem: (id: string) => Promise<{ success: boolean; error?: string; warning?: string }>;

  // Módulo Minha Equipa & Chat Interno
  sendTeamChatMessage: (data: {
    unitId: string;
    content: string;
  }) => { success: boolean; message?: TeamChatMessage; error?: string };
  deleteTeamChatMessage: (messageId: string) => { success: boolean; error?: string };
  createTeamTask: (data: {
    unitId: string;
    title: string;
    description?: string;
    assignedMemberName?: string;
    dueDate: string;
  }) => { success: boolean; task?: TeamTask; error?: string };
  updateTeamTaskStatus: (taskId: string, status: 'pendente' | 'concluido') => { success: boolean; error?: string };
  deleteTeamTask: (taskId: string) => { success: boolean; error?: string };
  createTeamNote: (data: {
    unitId: string;
    title: string;
    content: string;
  }) => { success: boolean; note?: TeamNote; error?: string };
  deleteTeamNote: (noteId: string) => { success: boolean; error?: string };
  createTeamAward: (data: {
    unitId: string;
    title: string;
    date: string;
    description?: string;
  }) => { success: boolean; award?: TeamAward; error?: string };
  deleteTeamAward: (awardId: string) => { success: boolean; error?: string };

  isQuotaExceeded?: boolean;
  isCloudLoading: boolean;
}

const ClubContext = createContext<ClubContextValue | undefined>(undefined);

const getInitialUserSession = (): UserAccount | null => {
  if (typeof window === 'undefined') return null;
  const session = sessionStorage.getItem('pioapp_current_user');
  if (session) {
    try {
      const parsed = JSON.parse(session);
      if (parsed && parsed.id && parsed.role) {
        return { ...parsed, role: sanitizeRoleType(parsed.role) };
      }
    } catch {
      sessionStorage.removeItem('pioapp_current_user');
    }
  }
  const local = localStorage.getItem('pioapp_current_user');
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (parsed && parsed.id && parsed.role) {
        return { ...parsed, role: sanitizeRoleType(parsed.role) };
      }
    } catch {
      localStorage.removeItem('pioapp_current_user');
    }
  }
  return null;
};

const syncStoredSessionUser = (user: UserAccount) => {
  if (typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(user);
    if (localStorage.getItem('pioapp_authenticated_session') || localStorage.getItem('pioapp_current_user')) {
      localStorage.setItem('pioapp_current_user', serialized);
    } else if (sessionStorage.getItem('pioapp_authenticated_session') || sessionStorage.getItem('pioapp_current_user')) {
      sessionStorage.setItem('pioapp_current_user', serialized);
    }
  } catch {
    // Ignorado em ambientes restritos
  }
};

export const ClubProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setRawState] = useState<ClubDatabaseState>(() => {
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

  const stateRef = React.useRef<ClubDatabaseState>(state);
  const setState = (updater: React.SetStateAction<ClubDatabaseState>) => {
    const next = typeof updater === 'function' ? updater(stateRef.current) : updater;
    stateRef.current = next;
    setRawState(next);
  };

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const isRemoteUpdateRef = React.useRef(false);
  const hasLoadedFromCloudRef = React.useRef(typeof window === 'undefined');
  const cloudConfirmedEmptyRef = React.useRef(false);
  const lastPushedUpdatedAtRef = React.useRef<string>('');
  const lastRemoteUpdatedAtRef = React.useRef<string>('');
  const lastMonotonicTimestampRef = React.useRef<string>('');
  const lastCloudStateRef = React.useRef<ClubDatabaseState | null>(null);
  const isPushInFlightRef = React.useRef(false);
  const activePushDrainPromiseRef = React.useRef<
    Promise<{ success: boolean; queuedOffline?: boolean; error?: string; code?: string }> | null
  >(null);
  const queuedPushStateRef = React.useRef<{ state: ClubDatabaseState; allowEmptyWrite?: boolean } | null>(null);
  const pendingOfflineStateRef = React.useRef<{ state: ClubDatabaseState; allowEmptyWrite?: boolean } | null>(null);
  const broadcastChannelRef = React.useRef<BroadcastChannel | null>(null);
  const refreshFromCloudRef = React.useRef<((force?: boolean) => Promise<boolean>) | null>(null);
  const [isCloudLoading, setIsCloudLoading] = useState<boolean>(typeof window !== 'undefined');
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

  // Normaliza e substitui o estado local diretamente pela fonte única de verdade da nuvem (sem ressuscitar dados locais antigos)
  const normalizeCloudState = (remoteData: Partial<ClubDatabaseState>, prev: ClubDatabaseState): ClubDatabaseState => {
    const remoteUsers = Array.isArray(remoteData.users) ? remoteData.users : prev.users;
    const remoteSettings = remoteData.settings
      ? {
          ...prev.settings,
          ...remoteData.settings,
          permissionsMatrix: syncPermissionsMatrix(remoteData.settings.permissionsMatrix),
        }
      : prev.settings;

    const configuredUnitNames = new Set(
      (remoteSettings.units || []).map((u) => String(u.name || '').trim().toLowerCase())
    );

    const allowedCategories: MemberCategory[] = ['embaixador', 'lider', 'aspirante'];
    const rawMembers = Array.isArray(remoteData.members) ? remoteData.members : [];
    const migratedMembers = rawMembers.map((m: any) => {
      let cat = m?.category;
      if (cat === 'desbravador' || cat === 'aventureiro') cat = 'aspirante';
      else if (cat === 'conselheiro' || cat === 'apoio') cat = 'lider';
      else if (!allowedCategories.includes(cat)) cat = 'embaixador';

      const rawUnit = typeof m?.unitOrTeam === 'string' ? m.unitOrTeam.trim() : '';
      const cleanUnit =
        !rawUnit || (rawUnit.toLowerCase() === 'unidade águias' && !configuredUnitNames.has('unidade águias'))
          ? undefined
          : rawUnit;

      return { ...m, category: cat, unitOrTeam: cleanUnit };
    });

    const sanitizedMembers = verifyAndRepairMembersIntegrity(migratedMembers).sanitizedMembers;
    const rawEnrollments = Array.isArray(remoteData.enrollmentRequests) ? remoteData.enrollmentRequests : [];
    const remoteDeletions = Array.isArray(remoteData.deletionRequests) ? remoteData.deletionRequests : [];
    const remoteAuditLogs = Array.isArray(remoteData.auditLogs) ? remoteData.auditLogs : [];
    const reconciledEnrollments = reconcileApprovedEnrollmentsWithMembers(
      sanitizedMembers,
      rawEnrollments,
      remoteSettings.currentYear || new Date().getFullYear(),
      remoteDeletions,
      remoteAuditLogs
    );
    const reconciled = reconcileUsersAndMembers(remoteUsers, reconciledEnrollments.members);

    const finalizedOnSync = finalizeEndedEnrollmentPeriod({
      members: reconciled.members,
      enrollmentRequests: reconciledEnrollments.enrollmentRequests,
      config: remoteSettings.enrollmentConfig,
    });
    const postFinalizedMembers = finalizedOnSync.hasChanges ? finalizedOnSync.members : reconciled.members;
    const postFinalizedUsers = finalizedOnSync.hasChanges
      ? reconcileUsersAndMembers(reconciled.users, postFinalizedMembers).users
      : reconciled.users;
    const postFinalizedSettings = finalizedOnSync.hasChanges
      ? { ...remoteSettings, enrollmentConfig: finalizedOnSync.config }
      : remoteSettings;

    // Atualiza em tempo real os dados do utilizador atualmente autenticado neste dispositivo (ex: nome, email, Nº de Membro, senha, cargo, estado ativo)
    let nextCurrentUser = prev.currentUser
      ? { ...prev.currentUser, role: sanitizeRoleType(prev.currentUser.role) }
      : prev.currentUser;
    if (prev.currentUser && prev.currentUser.id !== 'INST-001' && postFinalizedUsers.length > 0) {
      const liveUser = postFinalizedUsers.find(
        (u) =>
          u.id === prev.currentUser.id ||
          (u.linkedMemberId && prev.currentUser.linkedMemberId && u.linkedMemberId === prev.currentUser.linkedMemberId) ||
          (u.email && prev.currentUser.email && u.email.toLowerCase() === prev.currentUser.email.toLowerCase())
      );
      if (liveUser) {
        nextCurrentUser = liveUser;
        syncStoredSessionUser(liveUser);
      }
    }

    return {
      ...prev,
      ...remoteData,
      users: postFinalizedUsers,
      members: postFinalizedMembers,
      fees: Array.isArray(remoteData.fees) ? remoteData.fees : [],
      accounts: Array.isArray(remoteData.accounts) && remoteData.accounts.length > 0 ? remoteData.accounts : prev.accounts,
      receipts: Array.isArray(remoteData.receipts) ? remoteData.receipts : [],
      expenses: Array.isArray(remoteData.expenses) ? remoteData.expenses : [],
      monthlyClosings: Array.isArray(remoteData.monthlyClosings) ? remoteData.monthlyClosings : [],
      activities: Array.isArray(remoteData.activities)
        ? remoteData.activities.map((act) => ({
            ...act,
            type: normalizeActivityType(act?.type),
            stage: normalizeActivityStage(act?.stage),
          }))
        : [],
      classes: Array.isArray(remoteData.classes) ? remoteData.classes : [],
      specialties: Array.isArray(remoteData.specialties) ? remoteData.specialties : [],
      trainingProgress: Array.isArray(remoteData.trainingProgress) ? remoteData.trainingProgress : [],
      documents: Array.isArray(remoteData.documents) ? remoteData.documents : [],
      circulars: Array.isArray(remoteData.circulars) ? remoteData.circulars : [],
      paymentProofs: Array.isArray(remoteData.paymentProofs) ? remoteData.paymentProofs : [],
      auditLogs: finalizedOnSync.hasChanges
        ? [
            createAuditLog(
              'SISTEMA-PERIODO',
              'Sistema Automático',
              'diretor',
              'members',
              'FINALIZACAO_AUTOMATICA_PERIODO_INSCRICAO',
              `Período de inscrições e reconfirmação encerrado automaticamente (${(finalizedOnSync.summary?.keptActiveCount || 0) + (finalizedOnSync.summary?.activatedCount || 0)} ativos · ${finalizedOnSync.summary?.archivedCount || 0} arquivados).`,
              finalizedOnSync.config?.periodId || 'ENROLLMENT_PERIOD',
              'Período de Inscrições e Reconfirmação'
            ),
            ...remoteAuditLogs,
          ]
        : remoteAuditLogs,
      notifications: Array.isArray(remoteData.notifications) ? remoteData.notifications : [],
      deletionRequests: remoteDeletions,
      chaplaincyRequests: Array.isArray(remoteData.chaplaincyRequests) ? remoteData.chaplaincyRequests : [],
      suggestions: Array.isArray(remoteData.suggestions) ? remoteData.suggestions : [],
      messages: Array.isArray(remoteData.messages) ? remoteData.messages : [],
      associateDirectives: Array.isArray(remoteData.associateDirectives) ? remoteData.associateDirectives : [],
      teamEvaluations: Array.isArray(remoteData.teamEvaluations) ? remoteData.teamEvaluations : [],
      quotaWaivers: Array.isArray(remoteData.quotaWaivers) ? remoteData.quotaWaivers : [],
      musicItems: Array.isArray(remoteData.musicItems) ? remoteData.musicItems : (prev.musicItems || []),
      enrollmentRequests: reconciledEnrollments.enrollmentRequests,
      teamChatMessages: Array.isArray(remoteData.teamChatMessages) ? remoteData.teamChatMessages : [],
      teamTasks: Array.isArray(remoteData.teamTasks) ? remoteData.teamTasks : [],
      teamNotes: Array.isArray(remoteData.teamNotes) ? remoteData.teamNotes : [],
      teamAwards: Array.isArray(remoteData.teamAwards) ? remoteData.teamAwards : [],
      settings: postFinalizedSettings,
      currentUser: nextCurrentUser,
    };
  };

  const applyRemoteCloudState = (remoteData: Partial<ClubDatabaseState>) => {
    const remoteUpdatedAt = remoteData.updatedAt || '';
    if (remoteUpdatedAt) {
      lastRemoteUpdatedAtRef.current = remoteUpdatedAt;
      const parsedMs = Date.parse(remoteUpdatedAt);
      if (Number.isFinite(parsedMs)) {
        lastMonotonicTimestampRef.current = getNextMonotonicSyncTimestamp(
          lastMonotonicTimestampRef.current,
          parsedMs
        );
      }
    }
    hasLoadedFromCloudRef.current = true;
    cloudConfirmedEmptyRef.current = false;
    isRemoteUpdateRef.current = true;
    const normalized = normalizeCloudState(remoteData, stateRef.current);
    stateRef.current = normalized;
    setState(normalized);
    setIsCloudLoading(false);
  };

  // Mantém stateRef.current sincronizado imediatamente mesmo entre múltiplas mutações síncronas na mesma ação
  const commitState = (
    updater: ClubDatabaseState | ((prev: ClubDatabaseState) => ClubDatabaseState),
    options?: { saveLocal?: boolean; pushCloud?: boolean; allowEmptyWrite?: boolean }
  ): ClubDatabaseState => {
    const prev = stateRef.current;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    stateRef.current = next;
    setState(next);
    if (options?.saveLocal !== false) {
      saveStateToStorage(next);
    }
    if (options?.pushCloud) {
      pushToFirestore(next, { allowEmptyWrite: options.allowEmptyWrite });
    }
    return next;
  };

  // Executa uma escrita atómica e normalizada para o Firestore
  const executeSingleFirestorePush = async (
    stateToPush: ClubDatabaseState,
    options?: { allowEmptyWrite?: boolean }
  ): Promise<{ success: boolean; queuedOffline?: boolean; error?: string; code?: string }> => {
    if (!options?.allowEmptyWrite && !isSafeCloudWritePayload(stateToPush, cloudConfirmedEmptyRef.current)) {
      return {
        success: false,
        error: 'A sincronização inicial com a nuvem ainda não foi concluída. Aguarde um instante e tente novamente.',
      };
    }

    const prevMonotonic = lastMonotonicTimestampRef.current;
    const prevPushed = lastPushedUpdatedAtRef.current;

    try {
      const { currentUser: _localUser, ...cloudState } = stateToPush;
      delete (cloudState as any).deletedUserEmails;
      delete (cloudState as any).deletedUserIds;

      // Garantir integridade e sincronização contínua contas <-> membros antes de enviar para a nuvem
      if (Array.isArray(cloudState.members) && cloudState.members.length > 0) {
        const integrityCheck = verifyAndRepairMembersIntegrity(cloudState.members);
        cloudState.members = integrityCheck.sanitizedMembers;
      }
      if (Array.isArray(cloudState.users) && Array.isArray(cloudState.members)) {
        const syncedCloud = reconcileUsersAndMembers(cloudState.users, cloudState.members);
        cloudState.users = syncedCloud.users;
        cloudState.members = syncedCloud.members;
      }

      const syncTimestamp = getNextMonotonicSyncTimestamp(
        lastMonotonicTimestampRef.current || lastRemoteUpdatedAtRef.current || lastPushedUpdatedAtRef.current
      );

      const serializedPayload = JSON.parse(
        JSON.stringify({
          ...cloudState,
          updatedAt: syncTimestamp,
        })
      );

      await setDoc(doc(db, 'club_data', 'main_state'), serializedPayload, { merge: true });

      lastMonotonicTimestampRef.current = syncTimestamp;
      lastPushedUpdatedAtRef.current = syncTimestamp;
      pendingOfflineStateRef.current = null;
      cloudConfirmedEmptyRef.current = false;
      setIsQuotaExceeded(false);

      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({ type: 'CLOUD_PUSHED', updatedAt: syncTimestamp });
        } catch {
          // Ignorado em navegadores sem canal ativo
        }
      }
      return { success: true };
    } catch (err: any) {
      lastMonotonicTimestampRef.current = prevMonotonic;
      lastPushedUpdatedAtRef.current = prevPushed;
      const errCode = String(err?.code || '');
      const errMsg = String(err?.message || err || '');

      if (
        errCode === 'resource-exhausted' ||
        errMsg.includes('resource-exhausted') ||
        errMsg.includes('Quota limit exceeded') ||
        errMsg.includes('quota')
      ) {
        setIsQuotaExceeded(true);
        pendingOfflineStateRef.current = { state: stateToPush, allowEmptyWrite: options?.allowEmptyWrite };
        console.warn('Cota do Firestore atingida temporariamente.');
        return {
          success: false,
          queuedOffline: true,
          code: errCode || 'resource-exhausted',
          error: 'Limite temporário de escritas no Firestore atingido. A alteração foi guardada localmente para envio posterior.',
        };
      } else if (errCode === 'permission-denied' || errMsg.includes('permission')) {
        reportFirestorePermissionError(err, OperationType.WRITE, 'club_data/main_state');
        return {
          success: false,
          code: 'permission-denied',
          error: 'Permissão negada ao gravar no Firestore. Verifique as regras de segurança da base de dados.',
        };
      } else if (
        errCode === 'invalid-argument' ||
        errMsg.toLowerCase().includes('maximum') ||
        errMsg.toLowerCase().includes('exceeds')
      ) {
        console.error('Erro de estrutura ou limite de tamanho no documento Firestore:', err);
        return {
          success: false,
          code: errCode || 'invalid-argument',
          error: 'O documento global na nuvem excedeu o limite de tamanho (1 MB) ou contém campos inválidos para o Firestore.',
        };
      } else if (errCode === 'unavailable' || errMsg.includes('the client is offline')) {
        pendingOfflineStateRef.current = { state: stateToPush, allowEmptyWrite: options?.allowEmptyWrite };
        console.warn('Sincronização com o Firestore em fila (ligação temporariamente indisponível):', errMsg);
        return {
          success: false,
          queuedOffline: true,
          code: errCode || 'unavailable',
          error: 'Sem ligação ativa ao servidor Firestore. A alteração foi colocada em fila para sincronização automática.',
        };
      } else {
        pendingOfflineStateRef.current = { state: stateToPush, allowEmptyWrite: options?.allowEmptyWrite };
        console.error('Erro de escrita na sincronização em tempo real do Firestore:', err);
        return {
          success: false,
          code: errCode || 'unknown',
          error: errMsg || 'Erro ao gravar dados no Firestore.',
        };
      }
    }
  };

  // Escrita serializada e coalescida no Firestore (evita corridas fora de ordem e preserva alterações offline)
  const pushToFirestore = async (
    stateToPush: ClubDatabaseState,
    options?: { allowEmptyWrite?: boolean }
  ): Promise<{ success: boolean; queuedOffline?: boolean; error?: string; code?: string }> => {
    if (!db || !(db as any).app) {
      return { success: false, error: 'Ligação ao Firestore não disponível neste ambiente.' };
    }
    if (!options?.allowEmptyWrite && !isSafeCloudWritePayload(stateToPush, cloudConfirmedEmptyRef.current)) {
      return {
        success: false,
        error: 'A aguardar sincronização inicial com o Firestore antes de gravar alterações.',
      };
    }

    lastCloudStateRef.current = stateToPush;
    queuedPushStateRef.current = { state: stateToPush, allowEmptyWrite: options?.allowEmptyWrite };

    if (isPushInFlightRef.current && activePushDrainPromiseRef.current) {
      return activePushDrainPromiseRef.current;
    }

    const drainPromise = (async (): Promise<{ success: boolean; queuedOffline?: boolean; error?: string; code?: string }> => {
      isPushInFlightRef.current = true;
      let lastResult: { success: boolean; queuedOffline?: boolean; error?: string; code?: string } = { success: true };
      try {
        while (queuedPushStateRef.current) {
          const nextJob = queuedPushStateRef.current;
          queuedPushStateRef.current = null;
          lastResult = await executeSingleFirestorePush(nextJob.state, { allowEmptyWrite: nextJob.allowEmptyWrite });
        }
        return lastResult;
      } finally {
        isPushInFlightRef.current = false;
        activePushDrainPromiseRef.current = null;
      }
    })();

    activePushDrainPromiseRef.current = drainPromise;
    return drainPromise;
  };

  // Sincronização externa direta (usado no login ou carregamento explícito) sem memória cache permanente
  const syncFromCloud = (remoteState: Partial<ClubDatabaseState>) => {
    applyRemoteCloudState(remoteState);
  };

  const refreshFromCloud = async (): Promise<boolean> => {
    if (refreshFromCloudRef.current) {
      return refreshFromCloudRef.current(true);
    }
    return false;
  };

  const forceSyncCloud = async () => {
    const integrity = verifyAndRepairMembersIntegrity(state.members);
    const updatedState = { ...state, members: integrity.sanitizedMembers, updatedAt: getNowISOString() };
    if (integrity.hasIssues) {
      setState(updatedState);
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
      await pushToFirestore(updatedState);
      logAction(
        'audit',
        'VERIFICACAO_INTEGRIDADE',
        `Verificação de integridade executada: ${checkResult.fixedCount} membro(s) sincronizados com o banco de dados principal do Firestore.`
      );
    } else {
      await pushToFirestore(state);
    }
    return { success: true, result: checkResult };
  };

  const reportFirestorePermissionError = (error: unknown, operationType: OperationType, path: string) => {
    try {
      handleFirestoreError(error, operationType, path);
    } catch {
      // Erro estruturado já registado via handleFirestoreError para diagnóstico
    }
  };

  // 1. CARREGAMENTO INICIAL + ESCUTA EM TEMPO REAL AUTO-RECUPERÁVEL + SINCRONIZAÇÃO MULTI-ABA/REDE
  useEffect(() => {
    let active = true;
    let unsubSnapshot: (() => void) | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;
    let lastRefreshMs = 0;
    let isRefreshingNow = false;

    // Desbloqueia apenas o spinner visual se a rede demorar; NUNCA marca hasLoadedFromCloudRef=true sem resposta real
    const safetyTimer = setTimeout(() => {
      if (active) {
        setIsCloudLoading(false);
      }
    }, 4500);

    const flushPendingOfflinePush = async () => {
      if (!active || !pendingOfflineStateRef.current) return;
      const pending = pendingOfflineStateRef.current;
      pendingOfflineStateRef.current = null;
      await pushToFirestore(pending.state, { allowEmptyWrite: pending.allowEmptyWrite });
    };

    const refreshLiveCloudSnapshot = async (force: boolean = false): Promise<boolean> => {
      if (!active || !db || !(db as any).app) return false;
      const nowMs = Date.now();
      if (!force && (isRefreshingNow || nowMs - lastRefreshMs < 2500)) {
        return false;
      }
      isRefreshingNow = true;
      lastRefreshMs = nowMs;

      try {
        await flushPendingOfflinePush();
        const mainStateRef = doc(db, 'club_data', 'main_state');
        let snap: any = null;
        try {
          snap = await getDocFromServer(mainStateRef);
        } catch {
          try {
            snap = await getDoc(mainStateRef);
          } catch {
            snap = null;
          }
        }

        if (!active) return false;
        if (snap && snap.exists()) {
          const cloudData = snap.data() as ClubDatabaseState;
          if (
            cloudData &&
            !isPushInFlightRef.current &&
            !queuedPushStateRef.current &&
            !pendingOfflineStateRef.current &&
            !shouldSkipIncomingSnapshot({
              remoteUpdatedAt: cloudData.updatedAt,
              lastRemoteUpdatedAt: lastRemoteUpdatedAtRef.current,
              lastPushedUpdatedAt: lastPushedUpdatedAtRef.current,
              hasPendingWrites: snap.metadata?.hasPendingWrites,
            })
          ) {
            applyRemoteCloudState(cloudData);
          } else {
            hasLoadedFromCloudRef.current = true;
            setIsCloudLoading(false);
          }
          return true;
        } else if (snap && !snap.exists()) {
          hasLoadedFromCloudRef.current = true;
          cloudConfirmedEmptyRef.current = true;
          setIsCloudLoading(false);
          return true;
        }
        return false;
      } finally {
        isRefreshingNow = false;
      }
    };

    refreshFromCloudRef.current = refreshLiveCloudSnapshot;

    const clearPendingReconnect = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const attachRealtimeListener = () => {
      if (!active || !db || !(db as any).app) return;
      clearPendingReconnect();
      if (unsubSnapshot) {
        try {
          unsubSnapshot();
        } catch {
          // Ignora falha ao fechar subscrição antiga
        }
        unsubSnapshot = null;
      }

      unsubSnapshot = onSnapshot(
        doc(db, 'club_data', 'main_state'),
        (docSnap) => {
          if (!active) return;
          reconnectAttempt = 0;

          if (!docSnap.exists()) {
            hasLoadedFromCloudRef.current = true;
            cloudConfirmedEmptyRef.current = true;
            setIsCloudLoading(false);
            return;
          }

          const remoteData = docSnap.data() as ClubDatabaseState;
          if (!remoteData) return;

          if (
            isPushInFlightRef.current ||
            Boolean(queuedPushStateRef.current) ||
            Boolean(pendingOfflineStateRef.current) ||
            shouldSkipIncomingSnapshot({
              remoteUpdatedAt: remoteData.updatedAt,
              lastRemoteUpdatedAt: lastRemoteUpdatedAtRef.current,
              lastPushedUpdatedAt: lastPushedUpdatedAtRef.current,
              hasPendingWrites: docSnap.metadata?.hasPendingWrites,
            })
          ) {
            hasLoadedFromCloudRef.current = true;
            setIsCloudLoading(false);
            return;
          }

          applyRemoteCloudState(remoteData);
        },
        (error) => {
          if (!active) return;

          if (
            error?.code === 'resource-exhausted' ||
            error?.message?.includes('resource-exhausted') ||
            error?.message?.includes('Quota limit exceeded')
          ) {
            setIsQuotaExceeded(true);
          } else if (error?.code === 'permission-denied') {
            reportFirestorePermissionError(error, OperationType.GET, 'club_data/main_state');
            return;
          } else {
            console.warn('Aviso na escuta em tempo real do Firestore (a agendar reconexão):', error?.message || error);
          }

          // Re-subscrição automática com backoff exponencial (um onSnapshot com erro não volta a emitir sem nova subscrição)
          if (unsubSnapshot) {
            try {
              unsubSnapshot();
            } catch {
              // Ignorado
            }
            unsubSnapshot = null;
          }

          const delayMs = getReconnectDelayMs(reconnectAttempt);
          reconnectAttempt += 1;
          clearPendingReconnect();
          reconnectTimer = setTimeout(() => {
            if (!active) return;
            refreshLiveCloudSnapshot(true).finally(() => {
              if (active) attachRealtimeListener();
            });
          }, delayMs);
        }
      );
    };

    const loadInitialFromCloud = async () => {
      if (!db || !(db as any).app) {
        hasLoadedFromCloudRef.current = true;
        setIsCloudLoading(false);
        clearTimeout(safetyTimer);
        return;
      }

      const mainStateRef = doc(db, 'club_data', 'main_state');
      let snap: any = null;

      try {
        snap = await getDocFromServer(mainStateRef);
      } catch (err: any) {
        if (err?.code === 'permission-denied') {
          reportFirestorePermissionError(err, OperationType.GET, 'club_data/main_state');
        } else if (err?.code === 'unavailable' || err?.message?.includes('the client is offline')) {
          await new Promise((r) => setTimeout(r, 1000));
          if (!active) return;
          try {
            snap = await getDocFromServer(mainStateRef);
          } catch {
            try {
              snap = await getDoc(mainStateRef);
            } catch {
              snap = null;
            }
          }
        } else {
          try {
            snap = await getDoc(mainStateRef);
          } catch {
            snap = null;
          }
        }
      }

      if (!active) return;

      if (snap && snap.exists()) {
        const cloudData = snap.data() as ClubDatabaseState;
        if (cloudData) {
          applyRemoteCloudState(cloudData);
        } else {
          hasLoadedFromCloudRef.current = true;
          setIsCloudLoading(false);
        }
      } else if (snap && !snap.exists()) {
        // Base de dados na nuvem confirmadamente vazia: inicializa apenas com conta técnica limpa
        const cleanAdmin = resetToCleanAdminOnlyState();
        hasLoadedFromCloudRef.current = true;
        cloudConfirmedEmptyRef.current = true;
        isRemoteUpdateRef.current = true;
        setState((prev) => ({
          ...cleanAdmin,
          currentUser: prev.currentUser && prev.currentUser.id === 'INST-001' ? prev.currentUser : cleanAdmin.currentUser,
        }));
        setIsCloudLoading(false);
      } else {
        setIsCloudLoading(false);
      }

      clearTimeout(safetyTimer);

      // Inicia escuta em tempo real apenas após confirmar a ligação inicial sem corrida de handshakes
      attachRealtimeListener();
    };

    loadInitialFromCloud().catch((err) => {
      console.warn('Aviso ao carregar dados da nuvem na inicialização:', err);
      if (active) {
        setIsCloudLoading(false);
        attachRealtimeListener();
      }
    });

    // Canal instantâneo entre abas do mesmo navegador
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('pioapp_cloud_sync_channel');
        broadcastChannelRef.current = channel;
        channel.onmessage = (event) => {
          if (!active) return;
          if (event?.data?.type === 'CLOUD_PUSHED') {
            refreshLiveCloudSnapshot(true);
          }
        };
      } catch {
        broadcastChannelRef.current = null;
      }
    }

    const handleOnline = () => {
      if (!active) return;
      reconnectAttempt = 0;
      refreshLiveCloudSnapshot(true).finally(() => {
        if (active && !unsubSnapshot) {
          attachRealtimeListener();
        }
      });
    };

    const handleFocusOrVisibility = () => {
      if (!active) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      refreshLiveCloudSnapshot(false).then(() => {
        if (active && !unsubSnapshot) {
          attachRealtimeListener();
        }
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('focus', handleFocusOrVisibility);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleFocusOrVisibility);
    }

    // Verificação periódica suave enquanto a aba está visível para garantir alinhamento caso o socket caia silenciosamente
    const periodicTimer = setInterval(() => {
      if (!active) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      refreshLiveCloudSnapshot(false);
    }, 25000);

    return () => {
      active = false;
      clearTimeout(safetyTimer);
      clearPendingReconnect();
      clearInterval(periodicTimer);
      if (unsubSnapshot) {
        unsubSnapshot();
      }
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.close();
        } catch {
          // Ignorado
        }
        broadcastChannelRef.current = null;
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('focus', handleFocusOrVisibility);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleFocusOrVisibility);
      }
    };
  }, []);

  // 2. LIQUIDAÇÃO AUTOMÁTICA DO PERÍODO DE INSCRIÇÕES E RECONFIRMAÇÃO QUANDO TERMINA A DATA/HORA ESTIPULADA
  useEffect(() => {
    const config = state.settings.enrollmentConfig;
    if (
      !config ||
      !config.enableReconfirmation ||
      !config.periodId ||
      config.finalizedPeriodId === config.periodId
    ) {
      return;
    }

    const checkAndFinalize = () => {
      const result = finalizeEndedEnrollmentPeriod({
        members: state.members,
        enrollmentRequests: state.enrollmentRequests || [],
        config: state.settings.enrollmentConfig,
      });
      if (!result.hasChanges || !result.config) return;

      const reconciled = reconcileUsersAndMembers(state.users, result.members);

      const now = getNowISOString();
      const totalActive = (result.summary?.keptActiveCount || 0) + (result.summary?.activatedCount || 0);
      const totalArchived = result.summary?.archivedCount || 0;
      const auditEntry = createAuditLog(
        'SISTEMA-PERIODO',
        'Sistema Automático',
        'diretor',
        'members',
        'FINALIZACAO_AUTOMATICA_PERIODO_INSCRICAO',
        `Fim do período de inscrições e reconfirmação: ${totalActive} membro(s) ativo(s) e ${totalArchived} membro(s) arquivado(s) por falta de reconfirmação (contas desativadas).`,
        result.config.periodId || 'ENROLLMENT_PERIOD',
        'Período de Inscrições e Reconfirmação'
      );

      const nextState: ClubDatabaseState = {
        ...state,
        members: reconciled.members,
        users: reconciled.users,
        settings: {
          ...state.settings,
          enrollmentConfig: result.config,
        },
        auditLogs: [auditEntry, ...state.auditLogs],
        updatedAt: now,
      };

      setState(nextState);
      saveStateToStorage(nextState);
      pushToFirestore(nextState);
    };

    checkAndFinalize();
    const timer = setInterval(checkAndFinalize, 12000);
    return () => clearInterval(timer);
  }, [
    state.settings.enrollmentConfig,
    state.members,
    state.enrollmentRequests,
  ]);

  // 3. ENVIO CONTÍNUO DE ALTERAÇÕES LOCAIS PARA A NUVEM (APÓS CARREGAMENTO INICIAL DA NUVEM)
  useEffect(() => {
    // Nunca envia o estado inicial vazio antes de confirmar o estado vivo do Firestore
    if (!hasLoadedFromCloudRef.current) {
      return;
    }

    // Não reenvia se a alteração veio de uma atualização remota recebida via onSnapshot/getDocFromServer
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      lastCloudStateRef.current = state;
      return;
    }

    // Ignora alterações estritamente locais (ex: login/logout ou troca local de currentUser sem tocar dados do clube)
    if (!hasCloudPayloadChanged(lastCloudStateRef.current, state)) {
      return;
    }

    lastCloudStateRef.current = state;

    // Evita escrita duplicada quando a ação já enviou diretamente esta exata versão
    if (state.updatedAt && state.updatedAt === lastPushedUpdatedAtRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      pushToFirestore(state);
    }, 80);

    return () => clearTimeout(timer);
  }, [state]);

  const currentUser = state.currentUser;

  const setCurrentUser = (user: UserAccount, remember: boolean = false) => {
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
    if (module === 'associate_director' && !canGrantAssociateDirectorModule(currentUser.role)) {
      return {
        success: false,
        error: 'Apenas o Administrador Técnico pode conceder ou revogar acesso ao módulo exclusivo do Diretor-associado na grelha de permissões.',
      };
    }

    if (module === 'treasury' && action === 'WAIVE_QUOTA_DEBT' && !canGrantWaiveQuotaDebt(currentUser.role)) {
      return {
        success: false,
        error: 'Apenas o Administrador Técnico pode conceder ou revogar a permissão de zerar dívidas de quotas na grelha de permissões.',
      };
    }

    if (module === 'members' && action === 'APPROVE_ENROLLMENT' && !canGrantApproveEnrollment(currentUser.role)) {
      return {
        success: false,
        error: 'Apenas o Administrador Técnico pode conceder ou revogar a permissão de autorizar inscrições de membros na grelha de permissões.',
      };
    }

    if (module === 'members' && action === 'MANAGE_ENROLLMENT_PERIOD' && !canGrantManageEnrollmentPeriod(currentUser.role)) {
      return {
        success: false,
        error: 'Apenas o Administrador Técnico pode conceder ou revogar a permissão de abrir e encerrar inscrições na grelha de permissões.',
      };
    }

    if (module === 'members' && action === 'MANAGE_RECONFIRMATION_PERIOD' && !canGrantManageReconfirmationPeriod(currentUser.role)) {
      return {
        success: false,
        error: 'Apenas o Administrador Técnico pode conceder ou revogar a permissão de abrir e encerrar reconfirmações na grelha de permissões.',
      };
    }

    if (module === 'members' && action === 'APPROVE_MEMBER_ACCOUNT' && !canGrantApproveMemberAccount(currentUser.role)) {
      return {
        success: false,
        error: 'Apenas o Administrador Técnico pode conceder ou revogar a permissão de confirmar contas de login de membros na grelha de permissões.',
      };
    }

    if (module === 'members' && action === 'DELETE_MEMBER_UPLOADS') {
      if (!canGrantDeleteMemberUploads(currentUser.role)) {
        return {
          success: false,
          error: 'Apenas o Administrador Técnico pode conceder ou revogar a permissão de apagar uploads nas fichas dos membros.',
        };
      }
      if (add && role !== 'diretor' && role !== 'secretario') {
        return {
          success: false,
          error: 'Apenas o Diretor e o Secretário podem receber permissão para apagar uploads nas fichas dos membros.',
        };
      }
    }

    if (module === 'members' && action === 'EXPORT_ENROLLMENT_RECONF_LISTS' && !canGrantExportEnrollmentReconfLists(currentUser.role)) {
      return {
        success: false,
        error: 'Apenas o Administrador Técnico pode conceder ou revogar a permissão de baixar listas de inscrição e reconfirmação na grelha de permissões.',
      };
    }

    if (module === 'activities' && action === 'VIEW_ACTIVITY_FINANCIALS' && !canGrantViewActivityFinancials(currentUser.role)) {
      return {
        success: false,
        error: 'Apenas o Administrador Técnico pode conceder ou revogar a permissão de visualizar informações financeiras das atividades na grelha de permissões.',
      };
    }

    if (!can('audit', 'ADMIN') && !can('settings', 'EDIT') && currentUser.role !== 'admin_tecnico' && currentUser.role !== 'diretor') {
      return { success: false, error: 'Apenas a Direção ou Administrador pode alterar a matriz de permissões.' };
    }

    updatePermission(role, module, action, add);
    const currentMatrix = syncPermissionsMatrix(state.settings.permissionsMatrix);
    const roleMat = { ...currentMatrix[role] };
    const modActions = Array.isArray(roleMat[module]) ? [...roleMat[module]] : [];

    if (add) {
      if (!modActions.includes(action)) modActions.push(action);
    } else {
      const idx = modActions.indexOf(action);
      if (idx > -1) modActions.splice(idx, 1);
    }
    roleMat[module] = modActions;

    const newMatrix = { ...currentMatrix, [role]: roleMat };
    updateSettings({ permissionsMatrix: newMatrix });
    logAction('audit', 'ALTERACAO_PERMISSAO', `Permissão ${module}:${action} para o papel ${ROLE_LABELS[role]?.label || role} alterada para ${add ? 'Atribuída' : 'Revogada'}`);
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
    commitState(
      (prev) => ({
        ...prev,
        auditLogs: [entry, ...prev.auditLogs],
        updatedAt: getNowISOString(),
      }),
      { saveLocal: true, pushCloud: false }
    );
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
    const now = getNowISOString();
    const newNotif: ClubNotification = {
      ...notifData,
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: now,
      read: false,
    };

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        notifications: [newNotif, ...(prev.notifications || [])],
      }),
      { saveLocal: true, pushCloud: false }
    );

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

  const addAnnouncement = (
    title: string,
    content: string,
    urgency: ClubAnnouncement['urgency'],
    targetAudience: ClubAnnouncement['targetAudience']
  ): { success: boolean; error?: string } => {
    const isAuthorized =
      can('requests', 'CREATE') ||
      can('activities', 'CREATE') ||
      currentUser.role === 'diretor' ||
      currentUser.role === 'diretor_associado' ||
      currentUser.role === 'secretario' ||
      currentUser.role === 'admin_tecnico';

    if (!isAuthorized) {
      return { success: false, error: 'Sem permissão para publicar alertas institucionais.' };
    }

    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!cleanTitle || !cleanContent) {
      return { success: false, error: 'O título e a mensagem do alerta são obrigatórios.' };
    }

    const priority: ClubNotification['priority'] =
      urgency === 'urgente' ? 'urgente' : urgency === 'importante' ? 'alta' : 'normal';

    const recipientRoles: RoleType[] | undefined =
      targetAudience === 'lideranca'
        ? ['diretor', 'diretor_associado', 'secretario', 'tesoureiro', 'instrutor', 'capelao', 'admin_tecnico']
        : undefined;

    const now = getNowISOString();
    const notifId = `NOTIF-ANN-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newNotif: ClubNotification = {
      id: notifId,
      title: cleanTitle,
      message: `${cleanContent} (Emitido por ${currentUser.name})`,
      timestamp: now,
      read: false,
      category: 'announcement',
      priority,
      recipientRoles,
    };

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'requests',
      'EMISSAO_ALERTA_INSTITUCIONAL',
      `Alerta institucional publicado: "${cleanTitle}" (${urgency})`,
      notifId,
      cleanTitle
    );

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        notifications: [newNotif, ...(prev.notifications || [])],
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );

    if (isNotificationAuthorizedForUser(newNotif, currentUser)) {
      if (soundEnabled) playNotificationSound();
      showNativeNotification(newNotif.title, newNotif.message);
      const toastType = priority === 'urgente' ? 'error' : priority === 'alta' ? 'warning' : 'info';
      addToast(newNotif.title, newNotif.message, toastType);
    }

    return { success: true };
  };

  const markNotificationAsRead = (notificationId: string) => {
    const now = getNowISOString();
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        notifications: (prev.notifications || []).map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        ),
      }),
      { saveLocal: true, pushCloud: true }
    );
  };

  const markAllNotificationsAsRead = () => {
    const now = getNowISOString();
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        notifications: (prev.notifications || []).map((n) => ({ ...n, read: true })),
      }),
      { saveLocal: true, pushCloud: true }
    );
  };

  const deleteNotification = (notificationId: string) => {
    const now = getNowISOString();
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        notifications: (prev.notifications || []).filter((n) => n.id !== notificationId),
      }),
      { saveLocal: true, pushCloud: true }
    );
  };

  const clearAllNotifications = () => {
    const now = getNowISOString();
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        notifications: [],
      }),
      { saveLocal: true, pushCloud: true }
    );
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

    // Auto-ID interno sequencial seguro: CDA-MEM-00X
    const newId = generateNextMemberId(state.members);
    const now = getNowISOString();

    const activeEnrollmentConfig = state.settings.enrollmentConfig;
    const activePeriodId =
      activeEnrollmentConfig?.isOpen && activeEnrollmentConfig.periodId
        ? activeEnrollmentConfig.periodId
        : undefined;

    const rawNewMember: Member = {
      ...memberData,
      manualNumber: manualNum,
      id: newId,
      enrolledPeriodId: memberData.enrolledPeriodId || activePeriodId,
      createdAt: now,
      updatedAt: now,
    };

    const { sanitized: newMember } = sanitizeMemberIntegrity(rawNewMember);
    const syncedUsers = syncMemberChangesToUsers(newMember, state.users);

    const newState = {
      ...state,
      members: [newMember, ...state.members],
      users: syncedUsers,
      updatedAt: now,
    };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    logAction('members', 'REGISTO_MEMBRO', `Registo do membro ${newMember.fullName} (${newMember.manualNumber})`, newId, newMember.fullName);
    return { success: true };
  };

  const submitEnrollmentRequest = async (
    data: MemberRegistrationFormData
  ): Promise<{ success: boolean; request?: MemberEnrollmentRequest; error?: string }> => {
    let baseState = state;

    // Sincroniza primeiro com o estado vivo da nuvem antes de validar duplicados de B.I.
    if (db && (db as any).app) {
      try {
        let snap: any = null;
        try {
          snap = await getDocFromServer(doc(db, 'club_data', 'main_state'));
        } catch {
          snap = await getDoc(doc(db, 'club_data', 'main_state')).catch(() => null);
        }
        if (snap && snap.exists()) {
          const cloudData = snap.data() as ClubDatabaseState;
          if (cloudData) {
            baseState = normalizeCloudState(cloudData, state);
          }
        }
      } catch {
        // Continua com baseState atual caso esteja offline
      }
    }

    const availability = evaluateEnrollmentAvailability(baseState.settings.enrollmentConfig);
    if (!availability.isEnrollmentsOpen) {
      return {
        success: false,
        error:
          availability.status === 'abertas'
            ? 'As inscrições de novos membros encontram-se encerradas neste momento (apenas a reconfirmação de dados está aberta).'
            : availability.reasonLabel || 'As inscrições no clube encontram-se encerradas no momento.',
      };
    }

    const existingRequests = baseState.enrollmentRequests || [];
    const validation = validateEnrollmentSubmission(data, baseState.members, existingRequests);
    if (!validation.valid || !validation.resolvedManualNumber) {
      return { success: false, error: validation.error || 'Dados de inscrição inválidos.' };
    }

    const newRequest = buildEnrollmentRequest(
      data,
      validation.resolvedManualNumber,
      baseState.settings.currentYear || new Date().getFullYear(),
      existingRequests,
      currentUser?.id && currentUser.id !== 'USR-GUEST' ? currentUser.id : undefined
    );

    const activeMatrix = baseState.settings.permissionsMatrix || ROLE_PERMISSIONS_MATRIX;
    const targetRoles = (Object.keys(ROLE_LABELS) as RoleType[]).filter((r) =>
      hasApproveEnrollmentPermission(r, activeMatrix)
    );

    const newNotification: ClubNotification = {
      id: `NOTIF-ENR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: 'Nova Solicitação de Inscrição',
      message: `${newRequest.fullName} (${newRequest.category.toUpperCase()}) preencheu a ficha de inscrição (${newRequest.protocolNumber}) e aguarda autorização.`,
      timestamp: newRequest.submittedAt,
      read: false,
      category: 'member',
      targetModule: 'members',
      targetId: newRequest.id,
      recipientRoles: targetRoles.length > 0 ? targetRoles : ['secretario', 'admin_tecnico'],
      priority: 'alta',
    };

    const auditEntry = createAuditLog(
      currentUser?.id || 'AUTO-INSCRICAO',
      currentUser?.id && currentUser.id !== 'USR-GUEST' ? currentUser.name : newRequest.fullName,
      currentUser?.id && currentUser.id !== 'USR-GUEST' ? currentUser.role : 'membro',
      'members',
      'SOLICITACAO_INSCRICAO',
      `Submissão direta da ficha de inscrição de ${newRequest.fullName} (Protocolo: ${newRequest.protocolNumber}, Matrícula prevista: ${newRequest.manualNumber})`,
      newRequest.id,
      newRequest.fullName
    );

    const now = getNowISOString();
    const newState: ClubDatabaseState = {
      ...baseState,
      enrollmentRequests: [newRequest, ...existingRequests],
      notifications: [newNotification, ...(baseState.notifications || [])],
      auditLogs: [auditEntry, ...(baseState.auditLogs || [])],
      updatedAt: now,
    };

    setState(newState);
    saveStateToStorage(newState);
    await pushToFirestore(newState);

    return { success: true, request: newRequest };
  };

  const resubmitEnrollmentRequest = async (
    rejectedProtocolNumber: string,
    data: MemberRegistrationFormData
  ): Promise<{ success: boolean; request?: MemberEnrollmentRequest; error?: string }> => {
    let baseState = state;
    if (db && (db as any).app) {
      try {
        let snap: any = null;
        try {
          snap = await getDocFromServer(doc(db, 'club_data', 'main_state'));
        } catch {
          snap = await getDoc(doc(db, 'club_data', 'main_state')).catch(() => null);
        }
        if (snap && snap.exists()) {
          const cloudData = snap.data() as ClubDatabaseState;
          if (cloudData) {
            baseState = normalizeCloudState(cloudData, state);
          }
        }
      } catch {
        // Fallback
      }
    }

    const availability = evaluateEnrollmentAvailability(baseState.settings.enrollmentConfig);
    if (!availability.isEnrollmentsOpen) {
      return {
        success: false,
        error:
          availability.status === 'abertas'
            ? 'As inscrições de novos membros encontram-se encerradas neste momento (apenas a reconfirmação de dados está aberta).'
            : availability.reasonLabel || 'As inscrições no clube encontram-se encerradas no momento.',
      };
    }

    const existingRequests = baseState.enrollmentRequests || [];
    const rejectedReq = existingRequests.find(
      (r) => r.protocolNumber === rejectedProtocolNumber || r.id === rejectedProtocolNumber
    );
    if (!rejectedReq || rejectedReq.status !== 'rejeitado') {
      return { success: false, error: 'Inscrição recusada não encontrada.' };
    }

    const activeRequestsForValidation = existingRequests.filter(
      (r) => r.protocolNumber !== rejectedReq.protocolNumber
    );
    const validation = validateEnrollmentSubmission(data, baseState.members, activeRequestsForValidation);
    if (!validation.valid || !validation.resolvedManualNumber) {
      return { success: false, error: validation.error || 'Dados de inscrição inválidos.' };
    }

    const newRequest = buildResubmittedEnrollmentRequest(
      rejectedReq,
      data,
      validation.resolvedManualNumber,
      baseState.settings.currentYear || new Date().getFullYear(),
      existingRequests,
      currentUser?.id && currentUser.id !== 'USR-GUEST' ? currentUser.id : undefined
    );

    const updatedRequests = [
      newRequest,
      ...existingRequests.filter((r) => r.protocolNumber !== rejectedReq.protocolNumber),
    ];

    const activeMatrix = baseState.settings.permissionsMatrix || ROLE_PERMISSIONS_MATRIX;
    const targetRoles = (Object.keys(ROLE_LABELS) as RoleType[]).filter((r) =>
      hasApproveEnrollmentPermission(r, activeMatrix)
    );

    const newNotification: ClubNotification = {
      id: `NOTIF-RESUB-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: 'Inscrição Refeita após Recusa',
      message: `${newRequest.fullName} refez a sua inscrição após recusa anterior (Novo Protocolo: ${newRequest.protocolNumber}) e aguarda autorização.`,
      timestamp: newRequest.submittedAt,
      read: false,
      category: 'member',
      targetModule: 'members',
      targetId: newRequest.id,
      recipientRoles: targetRoles.length > 0 ? targetRoles : ['secretario', 'admin_tecnico'],
      priority: 'alta',
    };

    const auditEntry = createAuditLog(
      currentUser?.id || 'AUTO-INSCRICAO',
      currentUser?.id && currentUser.id !== 'USR-GUEST' ? currentUser.name : newRequest.fullName,
      currentUser?.id && currentUser.id !== 'USR-GUEST' ? currentUser.role : 'membro',
      'members',
      'REFAZER_INSCRICAO',
      `Inscrição refeita a partir da recusada ${rejectedReq.protocolNumber} -> Novo Protocolo ${newRequest.protocolNumber}`,
      newRequest.protocolNumber,
      newRequest.fullName
    );

    const now = getNowISOString();
    const newState: ClubDatabaseState = {
      ...baseState,
      enrollmentRequests: updatedRequests,
      notifications: [newNotification, ...(baseState.notifications || [])],
      auditLogs: [auditEntry, ...(baseState.auditLogs || [])],
      updatedAt: now,
    };

    setState(newState);
    saveStateToStorage(newState);
    await pushToFirestore(newState);

    return { success: true, request: newRequest };
  };

  const markEnrollmentUnderReview = (
    requestId: string
  ): { success: boolean; request?: MemberEnrollmentRequest; error?: string } => {
    if (!hasApproveEnrollmentPermission(currentUser.role, state.settings.permissionsMatrix)) {
      return {
        success: false,
        error: 'Sem permissão na Grelha de Permissões para colocar inscrições em análise.',
      };
    }

    const existingRequests = state.enrollmentRequests || [];
    const targetReq = existingRequests.find((r) => r.id === requestId);
    if (!targetReq) {
      return { success: false, error: 'Solicitação de inscrição não encontrada.' };
    }
    if (targetReq.status === 'em_analise') {
      return { success: true, request: targetReq };
    }
    if (targetReq.status !== 'pendente') {
      return { success: false, error: 'Esta solicitação de inscrição já foi concluída.' };
    }

    const updatedRequest = startEnrollmentReview(targetReq, currentUser);
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'members',
      'ANALISE_INSCRICAO_MEMBRO',
      `Inscrição ${targetReq.protocolNumber} de ${targetReq.fullName} colocada em análise pela Secretaria.`,
      targetReq.id,
      targetReq.fullName
    );

    const now = getNowISOString();
    const newState: ClubDatabaseState = {
      ...state,
      enrollmentRequests: existingRequests.map((r) => (r.id === requestId ? updatedRequest : r)),
      auditLogs: [auditEntry, ...state.auditLogs],
      updatedAt: now,
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    return { success: true, request: updatedRequest };
  };

  const updateEnrollmentReviewMessage = (
    requestId: string,
    reviewMessage: string
  ): { success: boolean; request?: MemberEnrollmentRequest; error?: string } => {
    if (!hasApproveEnrollmentPermission(currentUser.role, state.settings.permissionsMatrix)) {
      return {
        success: false,
        error: 'Sem permissão na Grelha de Permissões para atualizar mensagens de análise.',
      };
    }

    const existingRequests = state.enrollmentRequests || [];
    const targetReq = existingRequests.find((r) => r.id === requestId);
    if (!targetReq) {
      return { success: false, error: 'Solicitação de inscrição não encontrada.' };
    }
    if (targetReq.status !== 'em_analise' && targetReq.status !== 'pendente') {
      return { success: false, error: 'Apenas inscrições em análise ou pendentes podem receber mensagens da Secretaria.' };
    }

    const cleanMsg = (reviewMessage || '').trim();
    const updatedRequest: MemberEnrollmentRequest = {
      ...targetReq,
      status: targetReq.status === 'pendente' ? 'em_analise' : targetReq.status,
      reviewMessage: cleanMsg,
      underReviewStartedByUserId: targetReq.underReviewStartedByUserId || currentUser.id,
      underReviewStartedByName: targetReq.underReviewStartedByName || currentUser.name,
      underReviewStartedByRole: targetReq.underReviewStartedByRole || currentUser.role,
      underReviewStartedAt: targetReq.underReviewStartedAt || getNowISOString(),
    };

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'members',
      'MENSAGEM_ANALISE_INSCRICAO',
      `Mensagem de análise atualizada para a inscrição ${targetReq.protocolNumber} (${targetReq.fullName}): "${cleanMsg}"`,
      targetReq.id,
      targetReq.fullName,
      cleanMsg
    );

    const now = getNowISOString();
    const newState: ClubDatabaseState = {
      ...state,
      enrollmentRequests: existingRequests.map((r) => (r.id === requestId ? updatedRequest : r)),
      auditLogs: [auditEntry, ...state.auditLogs],
      updatedAt: now,
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    return { success: true, request: updatedRequest };
  };

  const approveEnrollmentRequest = (
    requestId: string,
    options?: {
      manualNumber?: string;
      category?: MemberCategory;
      unitOrTeam?: string;
      reason?: string;
      documentationStatus?: MemberDocumentationStatus;
      missingDocumentsNote?: string;
    }
  ): { success: boolean; member?: Member; error?: string } => {
    if (!hasApproveEnrollmentPermission(currentUser.role, state.settings.permissionsMatrix)) {
      return {
        success: false,
        error: 'Sem permissão na Grelha de Permissões (APPROVE_ENROLLMENT) para validar inscrições de membros.',
      };
    }

    const existingRequests = state.enrollmentRequests || [];
    const targetReq = existingRequests.find((r) => r.id === requestId);
    if (!targetReq) {
      return { success: false, error: 'Solicitação de inscrição não encontrada.' };
    }
    if (targetReq.status !== 'pendente' && targetReq.status !== 'em_analise') {
      return { success: false, error: 'Esta solicitação de inscrição já foi analisada anteriormente.' };
    }

    const built = buildApprovedMemberFromEnrollment(
      targetReq,
      state.members,
      state.settings.currentYear || new Date().getFullYear(),
      {
        ...options,
        updatedByName: currentUser.name,
        updatedByRole: currentUser.role,
      }
    );
    if (!built.success || !built.member) {
      return { success: false, error: built.error || 'Não foi possível criar a ficha do membro.' };
    }

    const activePeriodCfg = state.settings.enrollmentConfig;
    const activePeriodId =
      activePeriodCfg?.isOpen && activePeriodCfg.periodId ? activePeriodCfg.periodId : undefined;

    const createdMember: Member = {
      ...built.member,
      ...(activePeriodId ? { enrolledPeriodId: activePeriodId } : {}),
    };
    const updatedRequest = markEnrollmentReviewed(targetReq, 'aprovado', currentUser, {
      reason: options?.reason,
      createdMemberId: createdMember.id,
      manualNumber: createdMember.manualNumber,
      category: createdMember.category,
      unitOrTeam: createdMember.unitOrTeam,
    });

    const syncedUsers = syncMemberChangesToUsers(createdMember, state.users);
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'members',
      'AUTORIZACAO_INSCRICAO_MEMBRO',
      `Inscrição ${targetReq.protocolNumber} validada para ${createdMember.fullName} (Matrícula: ${createdMember.manualNumber} · ID: ${createdMember.id})`,
      createdMember.id,
      createdMember.fullName,
      options?.reason
    );

    const now = getNowISOString();
    const newState: ClubDatabaseState = {
      ...state,
      members: [createdMember, ...state.members],
      users: syncedUsers,
      enrollmentRequests: existingRequests.map((r) => (r.id === requestId ? updatedRequest : r)),
      auditLogs: [auditEntry, ...state.auditLogs],
      updatedAt: now,
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    return { success: true, member: createdMember };
  };

  const rejectEnrollmentRequest = (
    requestId: string,
    reason: string
  ): { success: boolean; error?: string } => {
    if (!hasApproveEnrollmentPermission(currentUser.role, state.settings.permissionsMatrix)) {
      return {
        success: false,
        error: 'Sem permissão na Grelha de Permissões (APPROVE_ENROLLMENT) para recusar inscrições de membros.',
      };
    }

    const cleanReason = (reason || '').trim();
    if (cleanReason.length < 3) {
      return {
        success: false,
        error: 'É obrigatório indicar uma justificação (mínimo 3 caracteres) para recusar a inscrição.',
      };
    }

    const existingRequests = state.enrollmentRequests || [];
    const targetReq = existingRequests.find((r) => r.id === requestId);
    if (!targetReq) {
      return { success: false, error: 'Solicitação de inscrição não encontrada.' };
    }
    if (targetReq.status !== 'pendente' && targetReq.status !== 'em_analise') {
      return { success: false, error: 'Esta solicitação de inscrição já foi analisada anteriormente.' };
    }

    const updatedRequest = markEnrollmentReviewed(targetReq, 'rejeitado', currentUser, {
      reason: cleanReason,
    });

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'members',
      'REJEICAO_INSCRICAO_MEMBRO',
      `Inscrição ${targetReq.protocolNumber} de ${targetReq.fullName} recusada.`,
      targetReq.id,
      targetReq.fullName,
      cleanReason
    );

    const now = getNowISOString();
    const newState: ClubDatabaseState = {
      ...state,
      enrollmentRequests: existingRequests.map((r) => (r.id === requestId ? updatedRequest : r)),
      auditLogs: [auditEntry, ...state.auditLogs],
      updatedAt: now,
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    return { success: true };
  };

  const reopenEnrollments = (schedule: {
    openDate?: string;
    openTime?: string;
    closeDate?: string;
    closeTime?: string;
    enableEnrollments?: boolean;
    enableReconfirmation?: boolean;
  }): { success: boolean; config?: EnrollmentScheduleConfig; error?: string } => {
    const canManageEnrollments = hasManageEnrollmentPeriodPermission(
      currentUser.role,
      state.settings.permissionsMatrix
    );
    const canManageReconfirmation = hasManageReconfirmationPeriodPermission(
      currentUser.role,
      state.settings.permissionsMatrix
    );

    const enableReconfirmation = Boolean(schedule.enableReconfirmation);
    const enableEnrollments =
      schedule.enableEnrollments !== undefined
        ? Boolean(schedule.enableEnrollments)
        : enableReconfirmation && !canManageEnrollments
        ? false
        : true;

    if (!enableEnrollments && !enableReconfirmation) {
      return {
        success: false,
        error: 'Selecione pelo menos uma opção para abrir: Inscrições e/ou Reconfirmação de Dados.',
      };
    }

    if (enableEnrollments && !canManageEnrollments) {
      return {
        success: false,
        error: 'Sem permissão na Grelha de Permissões (Abrir / Encerrar Inscrições) para abrir inscrições.',
      };
    }

    if (enableReconfirmation && !canManageReconfirmation) {
      return {
        success: false,
        error: 'Sem permissão na Grelha de Permissões (Abrir / Encerrar Reconfirmações) para abrir reconfirmações de dados.',
      };
    }

    const validation = validateEnrollmentScheduleInput(schedule);
    if (!validation.valid || !validation.normalized) {
      return {
        success: false,
        error: validation.error || 'Datas ou horários de inscrição/reconfirmação inválidos.',
      };
    }

    const now = getNowISOString();
    const existingCfg = state.settings.enrollmentConfig;
    const periodId =
      existingCfg?.isOpen && existingCfg.periodId && existingCfg.finalizedPeriodId !== existingCfg.periodId
        ? existingCfg.periodId
        : `PER-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const nextConfig: EnrollmentScheduleConfig = {
      isOpen: true,
      periodId,
      enableEnrollments,
      enableReconfirmation,
      openedAt:
        existingCfg?.isOpen && existingCfg.periodId === periodId && existingCfg.openedAt
          ? existingCfg.openedAt
          : now,
      openDate: validation.normalized.openDate,
      openTime: validation.normalized.openTime,
      closeDate: validation.normalized.closeDate,
      closeTime: validation.normalized.closeTime,
      updatedAt: now,
      updatedByUserId: currentUser.id,
      updatedByName: currentUser.name,
      updatedByRole: currentUser.role,
    };

    const openDesc = nextConfig.openDate
      ? `Abertura: ${formatScheduleDateTimeLabel(nextConfig.openDate, nextConfig.openTime, '00:00')}`
      : 'Abertura imediata';
    const closeDesc = nextConfig.closeDate
      ? `Encerramento: ${formatScheduleDateTimeLabel(nextConfig.closeDate, nextConfig.closeTime, '23:59')}`
      : 'Sem data de encerramento agendada';

    const modeDesc =
      enableEnrollments && enableReconfirmation
        ? 'Inscrições e Reconfirmação de Dados Ativas'
        : enableReconfirmation
        ? 'Apenas Reconfirmação de Dados Ativa (Inscrições Encerradas)'
        : 'Apenas Novas Inscrições Ativas';

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'members',
      enableReconfirmation && !enableEnrollments ? 'ABERTURA_RECONFIRMACAO' : 'REABERTURA_INSCRICOES',
      `${enableReconfirmation && !enableEnrollments ? 'Período de reconfirmação de dados aberto separadamente' : 'Período de inscrições/reconfirmação aberto'} (${openDesc} · ${closeDesc} · ${modeDesc}).`,
      periodId,
      enableReconfirmation && !enableEnrollments ? 'Período de Reconfirmação' : 'Período de Inscrições'
    );

    const updatedUsers = enableReconfirmation
      ? state.users.map((u) => {
          if (!u) return u;
          if (isInstitutionalAccountRecord(u) || u.role === 'diretor' || u.role === 'secretario') {
            return u;
          }
          return { ...u, active: false };
        })
      : state.users;

    const nextState: ClubDatabaseState = {
      ...state,
      users: updatedUsers,
      settings: {
        ...state.settings,
        enrollmentConfig: nextConfig,
      },
      auditLogs: [auditEntry, ...state.auditLogs],
      updatedAt: now,
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);

    return { success: true, config: nextConfig };
  };

  const closeEnrollmentsImmediately = (
    scope: 'all' | 'enrollments' | 'reconfirmation' = 'all'
  ): {
    success: boolean;
    config?: EnrollmentScheduleConfig;
    summary?: EnrollmentScheduleConfig['finalizationSummary'];
    error?: string;
  } => {
    const canManageEnrollments = hasManageEnrollmentPeriodPermission(
      currentUser.role,
      state.settings.permissionsMatrix
    );
    const canManageReconfirmation = hasManageReconfirmationPeriodPermission(
      currentUser.role,
      state.settings.permissionsMatrix
    );

    const existingCfg = state.settings.enrollmentConfig;
    const wasEnrollmentsEnabled = existingCfg ? existingCfg.enableEnrollments !== false : true;
    const wasReconfirmationEnabled = Boolean(existingCfg?.enableReconfirmation);

    if (scope === 'enrollments') {
      if (!canManageEnrollments) {
        return {
          success: false,
          error: 'Sem permissão na Grelha de Permissões (Abrir / Encerrar Inscrições) para encerrar inscrições.',
        };
      }
    } else if (scope === 'reconfirmation') {
      if (!canManageReconfirmation) {
        return {
          success: false,
          error: 'Sem permissão na Grelha de Permissões (Abrir / Encerrar Reconfirmações) para encerrar reconfirmações.',
        };
      }
    } else {
      const canCloseAll =
        (!wasEnrollmentsEnabled || canManageEnrollments) &&
        (!wasReconfirmationEnabled || canManageReconfirmation) &&
        (canManageEnrollments || canManageReconfirmation);
      if (!canCloseAll) {
        return {
          success: false,
          error: 'Sem permissão na Grelha de Permissões para encerrar este período.',
        };
      }
    }

    const now = getNowISOString();

    // Encerramento parcial: fechar apenas as Inscrições mantendo a Reconfirmação aberta
    if (scope === 'enrollments' && wasReconfirmationEnabled && existingCfg?.isOpen) {
      const partialConfig: EnrollmentScheduleConfig = {
        ...existingCfg,
        isOpen: true,
        enableEnrollments: false,
        updatedAt: now,
        updatedByUserId: currentUser.id,
        updatedByName: currentUser.name,
        updatedByRole: currentUser.role,
      };
      const auditEntry = createAuditLog(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'members',
        'ENCERRAMENTO_INSCRICOES',
        'Inscrições para novos membros encerradas imediatamente (Reconfirmação de Dados mantida aberta).',
        partialConfig.periodId || 'ENROLLMENT_PERIOD',
        'Período de Inscrições'
      );
      const nextState: ClubDatabaseState = {
        ...state,
        settings: {
          ...state.settings,
          enrollmentConfig: partialConfig,
        },
        auditLogs: [auditEntry, ...state.auditLogs],
        updatedAt: now,
      };
      setState(nextState);
      saveStateToStorage(nextState);
      pushToFirestore(nextState);
      return { success: true, config: partialConfig };
    }

    // Encerramento da Reconfirmação (parcial se Inscrições ficarem abertas, ou total)
    if (scope === 'reconfirmation' && wasEnrollmentsEnabled && existingCfg?.isOpen) {
      const tempClosedForFinalize: EnrollmentScheduleConfig = {
        ...existingCfg,
        isOpen: false,
        closedImmediatelyAt: now,
        updatedAt: now,
        updatedByUserId: currentUser.id,
        updatedByName: currentUser.name,
        updatedByRole: currentUser.role,
      };
      const finalizedResult = finalizeEndedEnrollmentPeriod({
        members: state.members,
        enrollmentRequests: state.enrollmentRequests || [],
        config: tempClosedForFinalize,
        now: new Date(now),
      });
      const finalMembers = finalizedResult.hasChanges ? finalizedResult.members : state.members;
      const finalUsers = finalizedResult.hasChanges
        ? reconcileUsersAndMembers(state.users, finalMembers).users
        : state.users;
      const keepEnrollmentsOpenConfig: EnrollmentScheduleConfig = {
        ...(finalizedResult.config || tempClosedForFinalize),
        isOpen: true,
        enableEnrollments: true,
        enableReconfirmation: false,
        updatedAt: now,
        updatedByUserId: currentUser.id,
        updatedByName: currentUser.name,
        updatedByRole: currentUser.role,
      };
      const summaryDesc = finalizedResult.hasChanges && finalizedResult.summary
        ? ` Estado automático atualizado: ${finalizedResult.summary.keptActiveCount + finalizedResult.summary.activatedCount} membro(s) ativo(s) e ${finalizedResult.summary.archivedCount} membro(s) arquivado(s) por falta de reconfirmação (contas desativadas).`
        : '';
      const auditEntry = createAuditLog(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'members',
        'ENCERRAMENTO_RECONFIRMACAO',
        `Reconfirmação de dados encerrada imediatamente (Inscrições de novos membros mantidas abertas).${summaryDesc}`,
        keepEnrollmentsOpenConfig.periodId || 'RECONFIRMATION_PERIOD',
        'Período de Reconfirmação'
      );
      const nextState: ClubDatabaseState = {
        ...state,
        members: finalMembers,
        users: finalUsers,
        settings: {
          ...state.settings,
          enrollmentConfig: keepEnrollmentsOpenConfig,
        },
        auditLogs: [auditEntry, ...state.auditLogs],
        updatedAt: now,
      };
      setState(nextState);
      saveStateToStorage(nextState);
      pushToFirestore(nextState);
      return { success: true, config: keepEnrollmentsOpenConfig, summary: finalizedResult.summary };
    }

    const closedBaseConfig: EnrollmentScheduleConfig = {
      ...(existingCfg || {}),
      isOpen: false,
      closedImmediatelyAt: now,
      updatedAt: now,
      updatedByUserId: currentUser.id,
      updatedByName: currentUser.name,
      updatedByRole: currentUser.role,
    };

    const finalizedResult = finalizeEndedEnrollmentPeriod({
      members: state.members,
      enrollmentRequests: state.enrollmentRequests || [],
      config: closedBaseConfig,
      now: new Date(now),
    });

    const finalConfig = finalizedResult.hasChanges && finalizedResult.config
      ? finalizedResult.config
      : closedBaseConfig;
    const finalMembers = finalizedResult.hasChanges ? finalizedResult.members : state.members;
    const finalUsers = finalizedResult.hasChanges
      ? reconcileUsersAndMembers(state.users, finalMembers).users
      : state.users;
    const summaryDesc = finalizedResult.hasChanges && finalizedResult.summary
      ? ` Estado automático atualizado: ${finalizedResult.summary.keptActiveCount + finalizedResult.summary.activatedCount} membro(s) ativo(s) e ${finalizedResult.summary.archivedCount} membro(s) arquivado(s) por falta de reconfirmação (contas desativadas).`
      : '';

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'members',
      wasReconfirmationEnabled && !wasEnrollmentsEnabled ? 'ENCERRAMENTO_RECONFIRMACAO' : 'ENCERRAMENTO_INSCRICOES',
      `${wasReconfirmationEnabled && !wasEnrollmentsEnabled ? 'Período de reconfirmação de dados encerrado imediatamente.' : 'Período de inscrições no clube encerrado imediatamente.'}${summaryDesc}`,
      finalConfig.periodId || 'ENROLLMENT_PERIOD',
      wasReconfirmationEnabled && !wasEnrollmentsEnabled ? 'Período de Reconfirmação' : 'Período de Inscrições'
    );

    const nextState: ClubDatabaseState = {
      ...state,
      members: finalMembers,
      users: finalUsers,
      settings: {
        ...state.settings,
        enrollmentConfig: finalConfig,
      },
      auditLogs: [auditEntry, ...state.auditLogs],
      updatedAt: now,
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);

    return { success: true, config: finalConfig, summary: finalizedResult.summary };
  };

  const finalizeEnrollmentPeriodIfEnded = (): {
    finalized: boolean;
    summary?: EnrollmentScheduleConfig['finalizationSummary'];
  } => {
    const result = finalizeEndedEnrollmentPeriod({
      members: state.members,
      enrollmentRequests: state.enrollmentRequests || [],
      config: state.settings.enrollmentConfig,
    });
    if (!result.hasChanges || !result.config) {
      return { finalized: false };
    }

    const reconciled = reconcileUsersAndMembers(state.users, result.members);

    const now = getNowISOString();
    const totalActive = (result.summary?.keptActiveCount || 0) + (result.summary?.activatedCount || 0);
    const totalArchived = result.summary?.archivedCount || 0;
    const auditEntry = createAuditLog(
      'SISTEMA-PERIODO',
      'Sistema Automático',
      'diretor',
      'members',
      'FINALIZACAO_AUTOMATICA_PERIODO_INSCRICAO',
      `Fim do período de inscrições e reconfirmação: ${totalActive} membro(s) ativo(s) e ${totalArchived} membro(s) arquivado(s) por falta de reconfirmação (contas desativadas).`,
      result.config.periodId || 'ENROLLMENT_PERIOD',
      'Período de Inscrições e Reconfirmação'
    );

    const nextState: ClubDatabaseState = {
      ...state,
      members: reconciled.members,
      users: reconciled.users,
      settings: {
        ...state.settings,
        enrollmentConfig: result.config,
      },
      auditLogs: [auditEntry, ...state.auditLogs],
      updatedAt: now,
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);

    return { finalized: true, summary: result.summary };
  };

  const exportEnrollmentReconfirmationList = (
    listType: EnrollmentReconfirmationExportType
  ): EnrollmentReconfirmationPdfResult => {
    const res = buildEnrollmentAndReconfirmationPdf({
      listType,
      actorRole: currentUser.role,
      actorName: currentUser.name,
      clubName: state.settings.clubName,
      permissionsMatrix: state.settings.permissionsMatrix,
      enrollmentRequests: state.enrollmentRequests || [],
      members: state.members || [],
      enrollmentConfig: state.settings.enrollmentConfig,
      users: state.users || [],
      currentYear: state.settings.currentYear,
    });

    if (res.success) {
      logAction(
        'members',
        'EXPORTACAO_PDF_LISTA_INSCRICAO_RECONFIRMACAO',
        `${res.listLabel || listType} exportada em PDF (${res.rowsCount ?? 0} registo(s)).`
      );
    }
    return res;
  };

  const submitMemberReconfirmation = async (
    memberId: string,
    data: MemberReconfirmationInput
  ): Promise<{ success: boolean; member?: Member; error?: string }> => {
    let baseState = state;

    if (db && (db as any).app) {
      try {
        let snap: any = null;
        try {
          snap = await getDocFromServer(doc(db, 'club_data', 'main_state'));
        } catch {
          snap = await getDoc(doc(db, 'club_data', 'main_state')).catch(() => null);
        }
        if (snap && snap.exists()) {
          const cloudData = snap.data() as ClubDatabaseState;
          if (cloudData) {
            baseState = normalizeCloudState(cloudData, state);
          }
        }
      } catch {
        // Continua com baseState local caso esteja offline
      }
    }

    const availability = evaluateEnrollmentAvailability(baseState.settings.enrollmentConfig);
    if (!availability.isReconfirmationOpen) {
      return {
        success: false,
        error: 'O período de reconfirmação de dados dos membros não está aberto neste momento.',
      };
    }

    const targetMember = (baseState.members || []).find((m) => m.id === memberId);
    if (!targetMember) {
      return { success: false, error: 'Ficha de membro não encontrada para reconfirmação.' };
    }

    const now = getNowISOString();
    const applied = applyMemberReconfirmation({
      member: targetMember,
      existingMembers: baseState.members,
      data,
      periodId: baseState.settings.enrollmentConfig?.periodId,
      users: baseState.users,
      nowISO: now,
    });

    if (!applied.success || !applied.updatedMember) {
      return { success: false, error: applied.error || 'Não foi possível validar os dados de reconfirmação.' };
    }

    const updatedMember = applied.updatedMember;
    const nextMembers = baseState.members.map((m) => (m.id === updatedMember.id ? updatedMember : m));
    const nextUsers = applied.updatedUsers || baseState.users;

    const syncedCurrentUser =
      baseState.currentUser && baseState.currentUser.id !== 'USR-GUEST' && baseState.currentUser.id !== 'INST-001'
        ? nextUsers.find(
            (u) => u.id === baseState.currentUser.id || u.linkedMemberId === updatedMember.id
          ) || baseState.currentUser
        : baseState.currentUser;

    if (syncedCurrentUser && syncedCurrentUser.id !== 'USR-GUEST' && syncedCurrentUser !== baseState.currentUser) {
      syncStoredSessionUser(syncedCurrentUser);
    }

    const newNotification: ClubNotification = {
      id: `NOTIF-REC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: 'Reconfirmação de Dados Concluída',
      message: `${updatedMember.fullName} (${updatedMember.manualNumber}) reconfirmou e atualizou os seus dados cadastrais e documentos.`,
      timestamp: now,
      read: false,
      category: 'member',
      targetModule: 'members',
      targetId: updatedMember.id,
      recipientRoles: ['diretor', 'secretario', 'admin_tecnico'],
      priority: 'normal',
    };

    const auditEntry = createAuditLog(
      currentUser?.id && currentUser.id !== 'USR-GUEST' ? currentUser.id : updatedMember.id,
      currentUser?.id && currentUser.id !== 'USR-GUEST' ? currentUser.name : updatedMember.fullName,
      currentUser?.id && currentUser.id !== 'USR-GUEST' ? currentUser.role : 'membro',
      'members',
      'RECONFIRMACAO_MEMBRO',
      `Reconfirmação de dados e documentos concluída por ${updatedMember.fullName} (Matrícula: ${updatedMember.manualNumber}).`,
      updatedMember.id,
      updatedMember.fullName
    );

    const newState: ClubDatabaseState = {
      ...baseState,
      members: nextMembers,
      users: nextUsers,
      currentUser: syncedCurrentUser,
      notifications: [newNotification, ...(baseState.notifications || [])],
      auditLogs: [auditEntry, ...(baseState.auditLogs || [])],
      updatedAt: now,
    };

    setState(newState);
    saveStateToStorage(newState);
    await pushToFirestore(newState);

    return { success: true, member: updatedMember };
  };

  const updateMemberDocumentationStatus = (
    memberId: string,
    documentationStatus: MemberDocumentationStatus,
    missingDocumentsNote?: string
  ): { success: boolean; error?: string } => {
    const isAllowed =
      currentUser.role === 'secretario' ||
      currentUser.role === 'admin_tecnico' ||
      can('members', 'EDIT') ||
      currentUser.role === 'diretor' ||
      currentUser.role === 'diretor_associado';

    if (!isAllowed) {
      return {
        success: false,
        error: 'Sem autorização para definir a situação documental dos membros.',
      };
    }

    const targetMember = state.members.find((m) => m.id === memberId);
    if (!targetMember) {
      return { success: false, error: 'Membro não encontrado na Secretaria.' };
    }

    const cleanNote = (missingDocumentsNote || '').trim();
    if (documentationStatus === 'falta_documento' && cleanNote.length < 3) {
      return {
        success: false,
        error: 'Indique qual ou quais documentos estão em falta (mínimo 3 caracteres).',
      };
    }

    const now = getNowISOString();
    const updatedMembers = state.members.map((m) =>
      m.id === memberId
        ? {
            ...m,
            documentationStatus,
            missingDocumentsNote: documentationStatus === 'falta_documento' ? cleanNote : undefined,
            documentationUpdatedAt: now,
            documentationUpdatedByName: currentUser.name,
            documentationUpdatedByRole: currentUser.role,
            updatedAt: now,
          }
        : m
    );

    const statusDesc =
      documentationStatus === 'regularizado'
        ? 'Regularizado (documentação completa)'
        : `Falta de Documento (${cleanNote})`;

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'members',
      'SITUACAO_DOCUMENTAL_MEMBRO',
      `Situação documental de ${targetMember.fullName} (${targetMember.manualNumber}) definida como: ${statusDesc}.`,
      targetMember.id,
      targetMember.fullName
    );

    const newState: ClubDatabaseState = {
      ...state,
      members: updatedMembers,
      auditLogs: [auditEntry, ...state.auditLogs],
      updatedAt: now,
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    return { success: true };
  };

  const sendMessage = (data: Omit<Message, 'id' | 'createdAt' | 'read'>) => {
    if (!can('messaging', 'CREATE')) {
      return { success: false, error: 'Sem permissão para enviar mensagens.' };
    }
    const cleanSubject = (data.subject || '').trim();
    const cleanContent = (data.content || '').trim();
    if (!cleanSubject || !cleanContent) {
      return { success: false, error: 'O assunto e o conteúdo da mensagem são obrigatórios.' };
    }
    if (data.recipientType !== 'all' && !data.recipientId) {
      return { success: false, error: 'Selecione o destinatário da mensagem.' };
    }

    const now = getNowISOString();
    const newMessage: Message = {
      id: `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      ...data,
      subject: cleanSubject,
      content: cleanContent,
      createdAt: now,
      read: false,
    };

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'messaging',
      'ENVIO_MENSAGEM',
      `Mensagem enviada (${data.recipientType}): "${cleanSubject}"`,
      newMessage.id,
      cleanSubject
    );

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        messages: [...(prev.messages || []), newMessage],
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );
    return { success: true };
  };

  const markMessageAsRead = (messageId: string, memberId: string) => {
    const live = stateRef.current;
    const linked = getStrictLinkedMember(currentUser, live.members);
    if (!linked || linked.id !== memberId) return;

    const now = getNowISOString();
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        messages: (prev.messages || []).map((m) => {
          if (m.id === messageId) {
            const readBy = m.readBy || [];
            if (!readBy.includes(linked.id)) {
              return { ...m, read: true, readBy: [...readBy, linked.id] };
            }
          }
          return m;
        }),
      }),
      { saveLocal: true, pushCloud: true }
    );
  };

  const replyToMessage = (messageId: string, content: string) => {
    const live = stateRef.current;
    const linked = getStrictLinkedMember(currentUser, live.members);
    if (!linked) {
      return { success: false, error: 'Apenas utilizadores vinculados a um membro podem interagir no Portal do Membro.' };
    }
    if (!content.trim()) return { success: false, error: 'A resposta não pode estar vazia.' };

    const targetMessage = (live.messages || []).find((m) => m.id === messageId);
    if (!targetMessage) {
      return { success: false, error: 'Mensagem não encontrada.' };
    }
    const isRecipient =
      targetMessage.recipientType === 'all' ||
      (targetMessage.recipientType === 'member' && targetMessage.recipientId === linked.id) ||
      (targetMessage.recipientType === 'unit' &&
        Boolean(linked.unitOrTeam) &&
        targetMessage.recipientId.toLowerCase() === linked.unitOrTeam!.toLowerCase()) ||
      (targetMessage.recipientType === 'category' &&
        targetMessage.recipientId.toLowerCase() === linked.category.toLowerCase());

    if (!isRecipient) {
      return { success: false, error: 'Só pode responder a mensagens destinadas ao seu registo.' };
    }

    const now = getNowISOString();
    const reply = {
      id: `REP-${Date.now()}`,
      senderId: currentUser.id,
      senderName: linked.fullName || currentUser.name,
      content: content.trim(),
      createdAt: now,
    };

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        messages: (prev.messages || []).map((m) =>
          m.id === messageId ? { ...m, replies: [...(m.replies || []), reply] } : m
        ),
      }),
      { saveLocal: true, pushCloud: true }
    );
    return { success: true };
  };

  const deleteMessage = (messageId: string) => {
    if (!can('messaging', 'ADMIN')) {
      return { success: false, error: 'Sem permissão para eliminar mensagens do histórico.' };
    }
    const target = (stateRef.current.messages || []).find((m) => m.id === messageId);
    if (!target) {
      return { success: false, error: 'Mensagem não encontrada.' };
    }
    const now = getNowISOString();
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'messaging',
      'REMOCAO_MENSAGEM',
      `Mensagem eliminada do histórico: "${target.subject}"`,
      messageId,
      target.subject
    );

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        messages: (prev.messages || []).filter((m) => m.id !== messageId),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );
    return { success: true };
  };

  const updateMember = (id: string, updates: Partial<Member>) => {
    const isDocumentOnlyUpdate = Object.keys(updates).every((k) =>
      [
        'biDocumentFileName',
        'biDocumentBase64',
        'photoDocumentFileName',
        'photoDocumentBase64',
        'photoUrl',
        'attachedDocuments',
      ].includes(k)
    );
    const isAllowed =
      can('members', 'EDIT') ||
      (isDocumentOnlyUpdate && can('members', 'CREATE')) ||
      currentUser.role === 'admin_tecnico' ||
      currentUser.role === 'secretario' ||
      currentUser.role === 'diretor' ||
      currentUser.role === 'diretor_associado';
    if (!isAllowed) {
      return { success: false, error: 'Sem permissão para editar dados do membro.' };
    }

    if (updates.manualNumber && !isMemberNumberUnique(updates.manualNumber, state.members, id)) {
      return { success: false, error: `O número manual "${updates.manualNumber}" já se encontra atribuído.` };
    }

    const now = getNowISOString();
    let updatedName = '';
    const targetMember = state.members.find((m) => m.id === id);

    if (targetMember) {
      const isDeletingOrReplacingBi =
        ('biDocumentBase64' in updates &&
          Boolean(targetMember.biDocumentBase64) &&
          updates.biDocumentBase64 !== targetMember.biDocumentBase64) ||
        (!('biDocumentBase64' in updates) &&
          'biDocumentFileName' in updates &&
          Boolean(targetMember.biDocumentFileName) &&
          !updates.biDocumentFileName);

      const isDeletingOrReplacingPhotoDoc =
        ('photoDocumentBase64' in updates &&
          Boolean(targetMember.photoDocumentBase64) &&
          updates.photoDocumentBase64 !== targetMember.photoDocumentBase64) ||
        (!('photoDocumentBase64' in updates) &&
          'photoDocumentFileName' in updates &&
          Boolean(targetMember.photoDocumentFileName) &&
          !updates.photoDocumentFileName);

      const isDeletingOrReplacingPhotoUrl =
        'photoUrl' in updates &&
        Boolean(targetMember.photoUrl) &&
        updates.photoUrl !== targetMember.photoUrl;

      const isRemovingAttachedDoc =
        'attachedDocuments' in updates &&
        Array.isArray(targetMember.attachedDocuments) &&
        targetMember.attachedDocuments.some((existingDoc) => {
          const nextList = updates.attachedDocuments || [];
          const kept = nextList.find((d) => d.id === existingDoc.id);
          return !kept || kept.base64 !== existingDoc.base64;
        });

      if (
        (isDeletingOrReplacingBi ||
          isDeletingOrReplacingPhotoDoc ||
          isDeletingOrReplacingPhotoUrl ||
          isRemovingAttachedDoc) &&
        !hasDeleteMemberUploadsPermission(currentUser.role, state.settings.permissionsMatrix)
      ) {
        return {
          success: false,
          error:
            'Apenas o Diretor ou Secretário com permissão atribuída pelo Administrador na grelha de permissões pode apagar ou substituir uploads nas fichas dos membros.',
        };
      }
    }

    let savedUpdatedMember: Member | undefined;

    const updated = state.members.map((m) => {
      if (m.id === id) {
        updatedName = updates.fullName !== undefined ? updates.fullName : m.fullName;
        const merged = { ...m, ...updates, updatedAt: now };
        const { sanitized } = sanitizeMemberIntegrity(merged);
        if (isDirectionMember(sanitized, state.users)) {
          sanitized.unitOrTeam = undefined;
        }
        savedUpdatedMember = sanitized;
        return sanitized;
      }
      return m;
    });

    // Sincronização contínua e automática para todas as contas de login vinculadas (nome, email, Nº de Membro, telefone e estado de arquivamento)
    let updatedUsers = savedUpdatedMember
      ? syncMemberChangesToUsers(savedUpdatedMember, state.users, targetMember)
      : state.users;

    if (savedUpdatedMember && savedUpdatedMember.status === 'arquivado') {
      updatedUsers = deactivateLinkedAccountsForMember(updatedUsers, savedUpdatedMember).updatedUsers;
    } else if (
      savedUpdatedMember &&
      targetMember?.status === 'arquivado' &&
      savedUpdatedMember.status === 'ativo'
    ) {
      updatedUsers = reactivateLinkedAccountsForMember(updatedUsers, savedUpdatedMember).updatedUsers;
    }

    const syncedCurrentUser =
      state.currentUser.id !== 'INST-001'
        ? updatedUsers.find(
            (u) =>
              u.id === state.currentUser.id ||
              (savedUpdatedMember && u.linkedMemberId === savedUpdatedMember.id)
          ) || state.currentUser
        : state.currentUser;

    if (syncedCurrentUser !== state.currentUser) {
      syncStoredSessionUser(syncedCurrentUser);
    }

    const newState = {
      ...state,
      members: updated,
      users: updatedUsers,
      currentUser: syncedCurrentUser,
      updatedAt: now,
    };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    logAction('members', 'EDICAO_MEMBRO', `Atualização cadastral do membro e sincronização automática com conta de login`, id, updatedName);
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

    // Regra estrita: apenas Diretor e Secretário com permissão DELETE_MEMBER_UPLOADS atribuída pelo Administrador na grelha de permissões podem apagar uploads
    const isLeadershipAllowed = hasDeleteMemberUploadsPermission(
      currentUser.role,
      state.settings.permissionsMatrix
    );

    if (!isLeadershipAllowed) {
      return {
        success: false,
        error:
          'Apenas o Diretor ou Secretário com permissão ativa atribuída pelo Administrador na grelha de permissões pode apagar a fotografia da ficha do membro.',
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

    const target = state.members.find((m) => m.id === id);
    if (!target) {
      return { success: false, error: 'Membro não encontrado.' };
    }

    const now = getNowISOString();
    const cleanReason = reason.trim();
    const memberName = target.fullName;

    const updated = state.members.map((m) => {
      if (m.id === id) {
        return {
          ...m,
          status: 'arquivado' as const,
          archiveReason: cleanReason,
          archivedAt: now,
          updatedAt: now,
        };
      }
      return m;
    });

    const { updatedUsers, deactivatedUsers } = deactivateLinkedAccountsForMember(state.users, target);
    const deactivatedIds = new Set(deactivatedUsers.map((u) => u.id));
    const nextCurrentUser =
      currentUser.id !== 'INST-001' && deactivatedIds.has(currentUser.id)
        ? updatedUsers.find((u) => u.id === currentUser.id) || currentUser
        : currentUser;
    if (nextCurrentUser !== currentUser) {
      syncStoredSessionUser(nextCurrentUser);
    }

    const auditEntries: AuditLogEntry[] = [
      createAuditLog(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'members',
        'ARQUIVAMENTO_MEMBRO',
        deactivatedUsers.length > 0
          ? `Membro arquivado com autorização da Direção (${cleanReason}). Conta vinculada desativada automaticamente (${deactivatedUsers.map((u) => u.email).join(', ')}).`
          : `Membro arquivado com autorização da Direção: ${cleanReason}`,
        id,
        memberName,
        cleanReason
      ),
      ...deactivatedUsers.map((linkedUser) =>
        createAuditLog(
          currentUser.id,
          currentUser.name,
          currentUser.role,
          'audit',
          'DESATIVACAO_CONTA_VINCULADA',
          `Conta vinculada desativada automaticamente (${linkedUser.email}) com o arquivamento do membro ${memberName}.`,
          linkedUser.id,
          linkedUser.email,
          cleanReason
        )
      ),
    ];

    const newState = {
      ...state,
      members: updated,
      users: updatedUsers,
      currentUser: nextCurrentUser,
      auditLogs: [...auditEntries, ...state.auditLogs],
      updatedAt: now,
    };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    return { success: true };
  };

  const unarchiveMember = (id: string) => {
    if (!can('members', 'ARCHIVE')) {
      return { success: false, error: 'Sem autorização para desarquivar membros.' };
    }

    const target = state.members.find((m) => m.id === id);
    if (!target) {
      return { success: false, error: 'Membro não encontrado.' };
    }

    const now = getNowISOString();
    const memberName = target.fullName;

    const updated = state.members.map((m) => {
      if (m.id === id) {
        return {
          ...m,
          status: 'ativo' as const,
          archiveReason: undefined,
          archivedAt: undefined,
          updatedAt: now,
        };
      }
      return m;
    });

    const { updatedUsers, reactivatedUsers } = reactivateLinkedAccountsForMember(state.users, target);

    const auditEntries: AuditLogEntry[] = [
      createAuditLog(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'members',
        'DESARQUIVAMENTO_MEMBRO',
        reactivatedUsers.length > 0
          ? `Membro desarquivado. Conta vinculada reativada automaticamente (${reactivatedUsers.map((u) => u.email).join(', ')}).`
          : `Membro desarquivado`,
        id,
        memberName
      ),
      ...reactivatedUsers.map((linkedUser) =>
        createAuditLog(
          currentUser.id,
          currentUser.name,
          currentUser.role,
          'audit',
          'REATIVACAO_CONTA_VINCULADA',
          `Conta vinculada reativada automaticamente (${linkedUser.email}) após desarquivamento do membro ${memberName}.`,
          linkedUser.id,
          linkedUser.email
        )
      ),
    ];

    const newState = {
      ...state,
      members: updated,
      users: updatedUsers,
      auditLogs: [...auditEntries, ...state.auditLogs],
      updatedAt: now,
    };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

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
      message: `${currentUser.name} (${ROLE_LABELS[currentUser.role]?.label || currentUser.role}) solicitou autorização para ${operationType} do membro ${member.fullName} (${member.manualNumber || member.id}). Motivo: ${reason.trim()}`,
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
      if (!canExecuteMemberDeletion(currentUser.role, state.settings.permissionsMatrix, true)) {
        return { success: false, error: 'Sem permissão na grelha para executar a eliminação definitiva de membros.' };
      }
    } else {
      if (!can('members', 'ARCHIVE')) {
        return { success: false, error: 'Sem permissão na grelha para executar o arquivamento de membros (members: ARCHIVE).' };
      }
    }

    const now = getNowISOString();
    let updatedMembers = state.members;
    let updatedUsers = state.users;
    let removedLinkedUsers: UserAccount[] = [];
    let deactivatedLinkedUsers: UserAccount[] = [];

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
      const deactivationResult = deactivateLinkedAccountsForMember(state.users, member);
      updatedUsers = deactivationResult.updatedUsers;
      deactivatedLinkedUsers = deactivationResult.deactivatedUsers;
    }

    if (req.operationType === 'eliminacao') {
      // Remoção estrita do membro PRESERVANDO integralmente recibos, movimentos financeiros e documentos (Req 2.4)
      updatedMembers = state.members.filter(m => m.id !== req.targetId);
      const removalResult = removeLinkedAccountsForMember(state.users, member);
      updatedUsers = removalResult.updatedUsers;
      removedLinkedUsers = removalResult.removedUsers;

      if (removedLinkedUsers.length > 0) {
        removedLinkedUsers.forEach((u) => {
          removePushSubscription(u.id).catch(() => {});
        });
      }
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

    const extraAuditEntries: AuditLogEntry[] = [
      createAuditLog(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'members',
        req.operationType === 'eliminacao' ? 'ELIMINACAO_MEMBRO_EXECUTADA' : 'ARQUIVAMENTO_MEMBRO_EXECUTADO',
        req.operationType === 'eliminacao'
          ? `Eliminação definitiva de ${member.fullName} executada após autorização da Direção.`
          : deactivatedLinkedUsers.length > 0
            ? `Arquivamento de ${member.fullName} executado após autorização da Direção. Conta vinculada desativada automaticamente (${deactivatedLinkedUsers.map((u) => u.email).join(', ')}).`
            : `Arquivamento de ${member.fullName} executado após autorização da Direção.`,
        member.id,
        member.fullName,
        req.reason
      ),
      ...removedLinkedUsers.map((linkedUser) =>
        createAuditLog(
          currentUser.id,
          currentUser.name,
          currentUser.role,
          'audit',
          'ELIMINACAO_CONTA_VINCULADA',
          `Conta vinculada eliminada automaticamente (${linkedUser.email}) com a eliminação do membro ${member.fullName}, sem necessidade de autorização prévia do administrador.`,
          linkedUser.id,
          linkedUser.email,
          req.reason
        )
      ),
      ...deactivatedLinkedUsers.map((linkedUser) =>
        createAuditLog(
          currentUser.id,
          currentUser.name,
          currentUser.role,
          'audit',
          'DESATIVACAO_CONTA_VINCULADA',
          `Conta vinculada desativada automaticamente (${linkedUser.email}) com o arquivamento do membro ${member.fullName}.`,
          linkedUser.id,
          linkedUser.email,
          req.reason
        )
      ),
    ];

    const enrollmentRemoval =
      req.operationType === 'eliminacao'
        ? removeEnrollmentRequestsForDeletedMember(state.enrollmentRequests, member)
        : { updatedEnrollmentRequests: state.enrollmentRequests || [], removedRequests: [] };

    if (enrollmentRemoval.removedRequests.length > 0 && extraAuditEntries[0]) {
      extraAuditEntries[0] = {
        ...extraAuditEntries[0],
        details: `${extraAuditEntries[0].details} Ficha(s) de inscrição associada(s) também eliminada(s) (${enrollmentRemoval.removedRequests.map((r) => r.protocolNumber).join(', ')}).`,
      };
    }

    const removedReqIds = new Set(enrollmentRemoval.removedRequests.map((r) => r.id));
    const updatedNotifications =
      removedReqIds.size > 0
        ? (state.notifications || []).filter((n) => !n.targetId || !removedReqIds.has(n.targetId))
        : state.notifications || [];

    const newState = {
      ...state,
      members: updatedMembers,
      users: updatedUsers,
      deletionRequests: updatedRequests,
      enrollmentRequests: enrollmentRemoval.updatedEnrollmentRequests,
      notifications: updatedNotifications,
      auditLogs: [...extraAuditEntries, ...state.auditLogs],
      updatedAt: now,
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

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

    const liveState = stateRef.current;
    const directFeeMatch = liveState.fees.find((f) => f.id === data.feeDefinitionId);
    const selectableFees = getSelectableInstitutionalFees(liveState.fees, liveState.settings);
    const fee = directFeeMatch || selectableFees.find((f) => f.id === data.feeDefinitionId) || selectableFees[0];
    if (!fee) {
      return { success: false, error: 'Taxa não encontrada. Cadastre uma taxa em Tesouraria.' };
    }

    let memberId = data.memberId;
    let memberName = '';

    if (data.customDonorName && data.customDonorName.trim()) {
      memberName = data.customDonorName.trim();
      memberId = data.memberId && data.memberId !== 'CUSTOM' ? data.memberId : `DONOR-${Date.now()}`;
    } else {
      const member = liveState.members.find((m) => m.id === data.memberId) || liveState.members[0];
      if (!member) {
        return { success: false, error: 'Membro ou titular não especificado. Selecione um membro válido.' };
      }
      memberId = member.id;
      memberName = member.fullName;
    }

    const targetAccountId = (data.accountId && liveState.accounts.some(a => a.id === data.accountId))
      ? data.accountId
      : (data.paymentMethod === 'numerario'
          ? liveState.accounts.find(a => a.type === 'caixa')?.id || liveState.accounts.find(a => a.active)?.id || liveState.accounts[0]?.id
          : liveState.accounts.find(a => a.type === 'banco')?.id || liveState.accounts.find(a => a.active)?.id || liveState.accounts[0]?.id)
        || liveState.accounts[0]?.id;
    const targetAccount = liveState.accounts.find(a => a.id === targetAccountId) || liveState.accounts[0];
    if (!targetAccount) {
      return { success: false, error: 'Conta financeira institucional de destino não encontrada. Adicione uma conta em Contas e Balanço.' };
    }

    const currentYear = liveState.settings.currentYear;
    const existingRecNumbers = liveState.receipts.map((r) => r.receiptNumber);
    const receiptNumber = generateNextDocumentNumber('REC', currentYear, existingRecNumbers);

    const now = getNowISOString();
    const lockCheck = isDateInLockedFiscalPeriod(liveState.monthlyClosings, now);
    if (lockCheck.locked) {
      return {
        success: false,
        error: `O mês fiscal ${lockCheck.month}/${lockCheck.year} encontra-se encerrado e bloqueado. Solicite a reabertura à Direção antes de emitir novos recibos neste período.`,
      };
    }

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
      treasurerRole: currentUser.role,
      paidAt: now,
      status: 'confirmado',
      notes: data.notes,
      activityId: data.activityId,
      accountId: targetAccount.id,
      accountName: targetAccount.name,
    };

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'treasury',
      'EMISSAO_RECIBO',
      `Recibo ${receiptNumber} emitido para ${memberName} no valor de ${data.amountPaidInCents / 100} Kz (Conta: ${targetAccount.name})`,
      newReceipt.id,
      memberName
    );

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        receipts: [newReceipt, ...prev.receipts],
        accounts: prev.accounts.map((acc) =>
          acc.id === targetAccountId
            ? { ...acc, currentBalanceInCents: acc.currentBalanceInCents + data.amountPaidInCents }
            : acc
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );

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
    if (receipt.isCancelled || receipt.status === 'anulado') {
      return { success: false, error: 'Este recibo já se encontra anulado.' };
    }

    const periodLock = isDateInLockedFiscalPeriod(state.monthlyClosings, receipt.paidAt);
    if (periodLock.locked) {
      return {
        success: false,
        error: `O recibo pertence ao mês fiscal encerrado (${periodLock.month}/${periodLock.year}). Solicite à Direção a reabertura do fecho mensal antes de anular.`,
      };
    }

    const now = getNowISOString();

    const updatedReceipts = state.receipts.map((r) => {
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

    const reversal = reverseReceiptFromTreasuryAccounts(receipt, state.accounts);
    const reversedAccountNote = reversal.targetAccountName
      ? ` (Dedução na conta ${reversal.targetAccountName} e Disponibilidade Geral)`
      : '';

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'treasury',
      'ANULACAO_RECIBO',
      `Recibo ${receipt.receiptNumber} anulado: ${reason}${reversedAccountNote}`,
      id,
      receipt.receiptNumber,
      reason
    );

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      receipts: updatedReceipts,
      accounts: reversal.updatedAccounts,
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);

    return { success: true };
  };

  const updateQuotaConfig = (configData: Partial<QuotaConfig> & { amountInCents: number }) => {
    if (!can('treasury', 'CONFIGURE_QUOTAS') && currentUser.role !== 'admin_tecnico') {
      return {
        success: false,
        error: 'Sem permissão na Grelha de Permissões para definir ou alterar o valor das quotas.',
      };
    }

    const sanitizedAmount = Math.round(Number(configData.amountInCents));
    if (Number.isNaN(sanitizedAmount) || sanitizedAmount < 0) {
      return { success: false, error: 'Introduza um valor de quota válido em Kz.' };
    }

    const now = getNowISOString();
    const baseConfig = resolveQuotaConfig(state.settings, state.fees);
    const targetFeeId = configData.activeQuotaFeeId || baseConfig.activeQuotaFeeId || DEFAULT_QUOTA_FEE_ID;
    const frequency = configData.frequency || baseConfig.frequency || 'domingo';

    const nextConfig: QuotaConfig = {
      ...baseConfig,
      ...configData,
      amountInCents: sanitizedAmount,
      frequency,
      activeQuotaFeeId: targetFeeId,
      updatedAt: now,
      updatedByUserId: currentUser.id,
      updatedByName: currentUser.name,
    };

    const quotaFeeTitle =
      frequency === 'mensal' ? 'Quota Regular (Mensal)' : 'Quota Regular (Cada Domingo)';
    const quotaFeeCategory = frequency === 'mensal' ? ('quota_mensal' as const) : ('quota_diaria' as const);
    const quotaFeePeriodicity = frequency === 'mensal' ? ('mensal' as const) : ('diaria' as const);

    const existingFeeIndex = state.fees.findIndex((f) => f.id === targetFeeId);
    let updatedFees: FeeDefinition[];
    if (existingFeeIndex >= 0) {
      updatedFees = state.fees.map((f, idx) =>
        idx === existingFeeIndex
          ? {
              ...f,
              title: f.id === DEFAULT_QUOTA_FEE_ID ? quotaFeeTitle : f.title,
              category: quotaFeeCategory,
              periodicity: quotaFeePeriodicity,
              amountInCents: sanitizedAmount,
              active: true,
              year: state.settings.currentYear,
            }
          : f
      );
    } else {
      updatedFees = [
        {
          id: targetFeeId,
          title: quotaFeeTitle,
          category: quotaFeeCategory,
          periodicity: quotaFeePeriodicity,
          amountInCents: sanitizedAmount,
          targetCategory: 'todas',
          active: true,
          year: state.settings.currentYear,
        },
        ...state.fees,
      ];
    }

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      fees: updatedFees,
      settings: {
        ...state.settings,
        quotaConfig: nextConfig,
      },
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);

    logAction(
      'treasury',
      'ATUALIZACAO_VALOR_QUOTA',
      `Valor da quota definido para ${formatKz(sanitizedAmount)} (${frequency === 'domingo' ? 'Cada Domingo' : 'Mensal'}) por ${currentUser.name}`,
      targetFeeId,
      quotaFeeTitle
    );

    return { success: true, config: nextConfig };
  };

  const regularizeMemberQuota = (data: {
    memberId: string;
    amountPaidInCents: number;
    paymentMethod: PaymentReceipt['paymentMethod'];
    periodLabel?: string;
    accountId?: string;
    referenceOrProof?: string;
    notes?: string;
  }) => {
    if (!can('treasury', 'CREATE')) {
      return { success: false, error: 'Apenas a Tesouraria ou perfis autorizados podem regularizar quotas.' };
    }

    const paidCents = Math.round(Number(data.amountPaidInCents));
    if (Number.isNaN(paidCents) || paidCents <= 0) {
      return { success: false, error: 'O montante a regularizar deve ser superior a zero.' };
    }

    const member = state.members.find(
      (m) => m.id === data.memberId || m.manualNumber === data.memberId
    );
    if (!member) {
      return { success: false, error: 'Membro não encontrado para regularização de quota.' };
    }

    const quotaConfig = resolveQuotaConfig(state.settings, state.fees);
    const feeId = quotaConfig.activeQuotaFeeId || DEFAULT_QUOTA_FEE_ID;
    let quotaFee = state.fees.find((f) => f.id === feeId) ||
      state.fees.find((f) => f.category === 'quota_diaria') ||
      state.fees.find((f) => f.category === 'quota_mensal');

    const now = getNowISOString();
    const lockCheck = isDateInLockedFiscalPeriod(state.monthlyClosings, now);
    if (lockCheck.locked) {
      return {
        success: false,
        error: `O mês fiscal ${lockCheck.month}/${lockCheck.year} encontra-se encerrado. Solicite a reabertura à Direção para regularizar quotas neste período.`,
      };
    }

    const createdFeeToAdd: FeeDefinition | null = quotaFee
      ? null
      : {
          id: feeId,
          title:
            quotaConfig.frequency === 'mensal'
              ? 'Quota Regular (Mensal)'
              : 'Quota Regular (Cada Domingo)',
          category: quotaConfig.frequency === 'mensal' ? 'quota_mensal' : 'quota_diaria',
          periodicity: quotaConfig.frequency === 'mensal' ? 'mensal' : 'diaria',
          amountInCents: quotaConfig.amountInCents,
          targetCategory: 'todas',
          active: true,
          year: state.settings.currentYear,
        };

    if (!quotaFee && createdFeeToAdd) {
      quotaFee = createdFeeToAdd;
    }

    const targetAccountId =
      (data.accountId && state.accounts.some((a) => a.id === data.accountId))
        ? data.accountId
        : (data.paymentMethod === 'numerario'
            ? state.accounts.find((a) => a.type === 'caixa')?.id ||
              state.accounts.find((a) => a.active)?.id ||
              state.accounts[0]?.id
            : state.accounts.find((a) => a.type === 'banco')?.id ||
              state.accounts.find((a) => a.active)?.id ||
              state.accounts[0]?.id) || state.accounts[0]?.id;

    const targetAccount = state.accounts.find((a) => a.id === targetAccountId) || state.accounts[0];
    if (!targetAccount) {
      return {
        success: false,
        error: 'Conta financeira institucional de destino não encontrada. Adicione uma conta em Contas e Balanço.',
      };
    }

    const currentYear = state.settings.currentYear;
    const existingRecNumbers = state.receipts.map((r) => r.receiptNumber);
    const receiptNumber = generateNextDocumentNumber('REC', currentYear, existingRecNumbers);

    const newReceipt: PaymentReceipt = {
      id: receiptNumber,
      receiptNumber,
      memberId: member.id,
      memberName: member.fullName,
      feeDefinitionId: quotaFee!.id,
      feeTitle: quotaFee!.title,
      periodLabel:
        data.periodLabel?.trim() ||
        `Regularização de Quotas (${quotaConfig.frequency === 'domingo' ? 'Domingos' : 'Mensal'} ${currentYear})`,
      amountPaidInCents: paidCents,
      paymentMethod: data.paymentMethod,
      referenceOrProof: data.referenceOrProof?.trim() || undefined,
      treasurerUserId: currentUser.id,
      treasurerName: currentUser.name,
      treasurerRole: currentUser.role,
      paidAt: now,
      status: 'confirmado',
      notes: data.notes?.trim() || `Regularização de quota registada por ${currentUser.name}.`,
      accountId: targetAccount.id,
      accountName: targetAccount.name,
    };

    setState((prev) => {
      const updatedAccounts = prev.accounts.map((acc) =>
        acc.id === targetAccount.id
          ? { ...acc, currentBalanceInCents: acc.currentBalanceInCents + paidCents }
          : acc
      );
      const nextFees = createdFeeToAdd ? [createdFeeToAdd, ...prev.fees] : prev.fees;

      return {
        ...prev,
        updatedAt: now,
        fees: nextFees,
        receipts: [newReceipt, ...prev.receipts],
        accounts: updatedAccounts,
      };
    });

    const linkedUser = state.users.find(
      (u) =>
        u.linkedMemberId === member.id ||
        (member.manualNumber && u.manualNumber === member.manualNumber)
    );
    if (linkedUser) {
      addNotification({
        title: 'Quota Regularizada com Sucesso',
        message: `O recibo ${receiptNumber} no valor de ${formatKz(paidCents)} foi emitido e creditado na sua conta de quotas.`,
        category: 'financial',
        targetModule: 'member_portal',
        recipientUserId: linkedUser.id,
        targetMemberId: member.id,
        isConfidential: true,
        priority: 'normal',
      });
    }

    logAction(
      'treasury',
      'REGULARIZACAO_QUOTA',
      `Quota regularizada para ${member.fullName} (${formatKz(paidCents)}) · Recibo ${receiptNumber} (Conta: ${targetAccount.name})`,
      newReceipt.id,
      member.fullName
    );

    return { success: true, receiptNumber, receipt: newReceipt };
  };

  const batchRegularizeQuotas = (data: {
    memberIds: string[];
    paymentMethod: PaymentReceipt['paymentMethod'];
    accountId: string;
    periodLabel?: string;
    amountMode: 'debt_balance' | 'fixed_amount';
    fixedAmountInCents?: number;
    referenceOrProof?: string;
    notes?: string;
  }) => {
    if (!can('treasury', 'CREATE')) {
      return { success: false, error: 'Apenas a Tesouraria ou perfis autorizados podem regularizar quotas.' };
    }

    const uniqueIds = Array.from(new Set(data.memberIds || [])).filter(Boolean);
    if (uniqueIds.length === 0) {
      return { success: false, error: 'Selecione pelo menos um membro para regularização em lote.' };
    }

    const fixedCents = Math.round(Number(data.fixedAmountInCents || 0));
    if (data.amountMode === 'fixed_amount' && (Number.isNaN(fixedCents) || fixedCents <= 0)) {
      return { success: false, error: 'O montante fixo por membro deve ser superior a zero.' };
    }

    const curState = stateRef.current;
    const now = getNowISOString();
    const lockCheck = isDateInLockedFiscalPeriod(curState.monthlyClosings, now);
    if (lockCheck.locked) {
      return {
        success: false,
        error: `O mês fiscal ${lockCheck.month}/${lockCheck.year} encontra-se encerrado. Solicite a reabertura à Direção para regularizar quotas neste período.`,
      };
    }

    const targetAccount =
      curState.accounts.find((a) => a.id === data.accountId) ||
      curState.accounts.find((a) => a.active) ||
      curState.accounts[0];
    if (!targetAccount) {
      return {
        success: false,
        error: 'Conta financeira institucional de destino não encontrada.',
      };
    }

    const quotaConfig = resolveQuotaConfig(curState.settings, curState.fees);
    const feeId = quotaConfig.activeQuotaFeeId || DEFAULT_QUOTA_FEE_ID;
    let quotaFee =
      curState.fees.find((f) => f.id === feeId) ||
      curState.fees.find((f) => f.category === 'quota_diaria') ||
      curState.fees.find((f) => f.category === 'quota_mensal');

    const createdFeeToAdd: FeeDefinition | null = quotaFee
      ? null
      : {
          id: feeId,
          title:
            quotaConfig.frequency === 'mensal'
              ? 'Quota Regular (Mensal)'
              : 'Quota Regular (Cada Domingo)',
          category: quotaConfig.frequency === 'mensal' ? 'quota_mensal' : 'quota_diaria',
          periodicity: quotaConfig.frequency === 'mensal' ? 'mensal' : 'diaria',
          amountInCents: quotaConfig.amountInCents,
          targetCategory: 'todas',
          active: true,
          year: curState.settings.currentYear,
        };
    if (!quotaFee && createdFeeToAdd) {
      quotaFee = createdFeeToAdd;
    }

    const currentYear = curState.settings.currentYear;
    const todayISO = getTodayISODate();
    const accumulatedNumbers = [...curState.receipts.map((r) => r.receiptNumber)];
    const generatedReceipts: PaymentReceipt[] = [];
    let skippedCount = 0;
    let totalAmountInCents = 0;

    for (const memberId of uniqueIds) {
      const member = curState.members.find((m) => m.id === memberId || m.manualNumber === memberId);
      if (!member) {
        skippedCount++;
        continue;
      }

      let paidCents = fixedCents;
      if (data.amountMode === 'debt_balance') {
        const summary = calculateMemberQuotaSummary(
          member,
          quotaConfig,
          curState.fees,
          curState.receipts,
          todayISO,
          curState.quotaWaivers || []
        );
        paidCents = summary.balanceDueInCents;
      }

      if (paidCents <= 0) {
        skippedCount++;
        continue;
      }

      const receiptNumber = generateNextDocumentNumber('REC', currentYear, accumulatedNumbers);
      accumulatedNumbers.push(receiptNumber);

      const newReceipt: PaymentReceipt = {
        id: receiptNumber,
        receiptNumber,
        memberId: member.id,
        memberName: member.fullName,
        feeDefinitionId: quotaFee!.id,
        feeTitle: quotaFee!.title,
        periodLabel:
          data.periodLabel?.trim() ||
          `Regularização em Lote (${quotaConfig.frequency === 'domingo' ? 'Domingos' : 'Mensal'} ${currentYear})`,
        amountPaidInCents: paidCents,
        paymentMethod: data.paymentMethod,
        referenceOrProof: data.referenceOrProof?.trim() || undefined,
        treasurerUserId: currentUser.id,
        treasurerName: currentUser.name,
        treasurerRole: currentUser.role,
        paidAt: now,
        status: 'confirmado',
        notes: data.notes?.trim() || `Regularização em lote registada por ${currentUser.name}.`,
        accountId: targetAccount.id,
        accountName: targetAccount.name,
      };

      generatedReceipts.push(newReceipt);
      totalAmountInCents += paidCents;
    }

    if (generatedReceipts.length === 0) {
      return {
        success: false,
        error: 'Nenhum dos membros selecionados possuía saldo devedor elegível para regularização.',
      };
    }

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        fees: createdFeeToAdd ? [createdFeeToAdd, ...prev.fees] : prev.fees,
        receipts: [...generatedReceipts, ...prev.receipts],
        accounts: prev.accounts.map((acc) =>
          acc.id === targetAccount.id
            ? { ...acc, currentBalanceInCents: acc.currentBalanceInCents + totalAmountInCents }
            : acc
        ),
      }),
      { saveLocal: true, pushCloud: true }
    );

    for (const rec of generatedReceipts) {
      const targetMember = curState.members.find((m) => m.id === rec.memberId);
      const linkedUser = curState.users.find(
        (u) =>
          u.linkedMemberId === rec.memberId ||
          (targetMember?.manualNumber && u.manualNumber === targetMember.manualNumber)
      );
      if (linkedUser) {
        addNotification({
          title: 'Quota Regularizada com Sucesso',
          message: `O recibo ${rec.receiptNumber} no valor de ${formatKz(rec.amountPaidInCents)} foi emitido e creditado na sua conta de quotas.`,
          category: 'financial',
          targetModule: 'member_portal',
          recipientUserId: linkedUser.id,
          targetMemberId: rec.memberId,
          isConfidential: true,
          priority: 'normal',
        });
      }
    }

    logAction(
      'treasury',
      'REGULARIZACAO_QUOTAS_LOTE',
      `Regularização em lote para ${generatedReceipts.length} membro(s) · Total ${formatKz(totalAmountInCents)} (Conta: ${targetAccount.name})`,
      generatedReceipts[0].receiptNumber,
      `${generatedReceipts.length} recibos`
    );

    return {
      success: true,
      count: generatedReceipts.length,
      skippedCount,
      totalAmountInCents,
      receipts: generatedReceipts,
    };
  };

  const waiveMemberQuotaDebt = (data: {
    memberId: string;
    reason: string;
    customAmountInCents?: number;
  }) => {
    if (!can('treasury', 'WAIVE_QUOTA_DEBT') && currentUser.role !== 'admin_tecnico') {
      return {
        success: false,
        error: 'Sem permissão na Grelha de Permissões para zerar dívidas de quotas.',
      };
    }

    const cleanReason = (data.reason || '').trim();
    if (cleanReason.length < 3) {
      return {
        success: false,
        error: 'Indique um motivo ou justificação (mínimo 3 caracteres) para zerar a dívida.',
      };
    }

    const member = state.members.find(
      (m) => m.id === data.memberId || m.manualNumber === data.memberId
    );
    if (!member) {
      return { success: false, error: 'Membro não encontrado para zerar dívida de quota.' };
    }

    const quotaConfig = resolveQuotaConfig(state.settings, state.fees);
    const currentWaivers = state.quotaWaivers || [];
    const summary = calculateMemberQuotaSummary(
      member,
      quotaConfig,
      state.fees,
      state.receipts,
      getTodayISODate(),
      currentWaivers
    );

    if (summary.balanceDueInCents <= 0) {
      return {
        success: false,
        error: `${member.fullName} não possui saldo em dívida para zerar.`,
      };
    }

    const targetAmountInCents =
      typeof data.customAmountInCents === 'number' && !Number.isNaN(data.customAmountInCents)
        ? Math.min(summary.balanceDueInCents, Math.max(0, Math.round(data.customAmountInCents)))
        : summary.balanceDueInCents;

    if (targetAmountInCents <= 0) {
      return {
        success: false,
        error: 'O montante a abater/zerar deve ser superior a zero.',
      };
    }

    const currentYear = state.settings.currentYear;
    const cycleYear = Number((quotaConfig.cycleStartDate || '').slice(0, 4)) || currentYear;
    const existingIds = currentWaivers.map((w) => w.id);
    const waiverId = generateNextDocumentNumber('ZRD', currentYear, existingIds);
    const now = getNowISOString();

    const newWaiver: QuotaDebtWaiver = {
      id: waiverId,
      memberId: member.id,
      memberName: member.fullName,
      amountWaivedInCents: targetAmountInCents,
      grossDueAtWaiverInCents: summary.grossDueInCents,
      paidAtWaiverInCents: summary.totalPaidInCents,
      previousBalanceInCents: summary.balanceDueInCents,
      cycleYear,
      reason: cleanReason,
      waivedByUserId: currentUser.id,
      waivedByName: currentUser.name,
      waivedByRole: currentUser.role,
      waivedAt: now,
    };

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'treasury',
      'ZERAR_DIVIDA_QUOTA',
      `Dívida de quotas de ${member.fullName} zerada/abatida em ${formatKz(targetAmountInCents)} (Saldo anterior: ${formatKz(summary.balanceDueInCents)}). Motivo: ${cleanReason}`,
      waiverId,
      member.fullName,
      cleanReason
    );

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      quotaWaivers: [newWaiver, ...currentWaivers],
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);

    const linkedUser = state.users.find(
      (u) =>
        u.linkedMemberId === member.id ||
        (member.manualNumber && u.manualNumber === member.manualNumber)
    );
    if (linkedUser) {
      addNotification({
        title: 'Dívida de Quotas Zerada',
        message: `A sua dívida de quotas no valor de ${formatKz(targetAmountInCents)} foi zerada/regularizada por ${currentUser.name} (${cleanReason}).`,
        category: 'financial',
        targetModule: 'member_portal',
        recipientUserId: linkedUser.id,
        targetMemberId: member.id,
        isConfidential: true,
        priority: 'normal',
      });
    }

    return { success: true, waiver: newWaiver };
  };

  const waiveAllPendingQuotaDebts = (data: {
    memberIds: string[];
    reason: string;
  }) => {
    if (!can('treasury', 'WAIVE_QUOTA_DEBT') && currentUser.role !== 'admin_tecnico') {
      return {
        success: false,
        count: 0,
        totalWaivedInCents: 0,
        error: 'Sem permissão na Grelha de Permissões para zerar dívidas de quotas.',
      };
    }

    const cleanReason = (data.reason || '').trim();
    if (cleanReason.length < 3) {
      return {
        success: false,
        count: 0,
        totalWaivedInCents: 0,
        error: 'Indique um motivo ou justificação (mínimo 3 caracteres) para zerar as dívidas.',
      };
    }

    const quotaConfig = resolveQuotaConfig(state.settings, state.fees);
    const currentWaivers = [...(state.quotaWaivers || [])];
    const currentYear = state.settings.currentYear;
    const cycleYear = Number((quotaConfig.cycleStartDate || '').slice(0, 4)) || currentYear;
    const today = getTodayISODate();
    const now = getNowISOString();

    const targetIdsSet = new Set(data.memberIds);
    const newWaivers: QuotaDebtWaiver[] = [];
    const trackingIds = currentWaivers.map((w) => w.id);
    let totalWaivedInCents = 0;

    for (const member of state.members) {
      if (!targetIdsSet.has(member.id)) continue;
      const summary = calculateMemberQuotaSummary(
        member,
        quotaConfig,
        state.fees,
        state.receipts,
        today,
        currentWaivers
      );
      if (summary.balanceDueInCents <= 0) continue;

      const waiverId = generateNextDocumentNumber('ZRD', currentYear, trackingIds);
      trackingIds.push(waiverId);

      const waiver: QuotaDebtWaiver = {
        id: waiverId,
        memberId: member.id,
        memberName: member.fullName,
        amountWaivedInCents: summary.balanceDueInCents,
        grossDueAtWaiverInCents: summary.grossDueInCents,
        paidAtWaiverInCents: summary.totalPaidInCents,
        previousBalanceInCents: summary.balanceDueInCents,
        cycleYear,
        reason: cleanReason,
        waivedByUserId: currentUser.id,
        waivedByName: currentUser.name,
        waivedByRole: currentUser.role,
        waivedAt: now,
      };
      newWaivers.push(waiver);
      totalWaivedInCents += summary.balanceDueInCents;
    }

    if (newWaivers.length === 0) {
      return {
        success: false,
        count: 0,
        totalWaivedInCents: 0,
        error: 'Nenhum membro selecionado possui saldo em dívida para zerar.',
      };
    }

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'treasury',
      'ZERAR_DIVIDA_QUOTA_EM_LOTE',
      `Dívida de quotas zerada em lote para ${newWaivers.length} membro(s), totalizando ${formatKz(totalWaivedInCents)}. Motivo: ${cleanReason}`,
      newWaivers[0].id,
      `${newWaivers.length} membros`,
      cleanReason
    );

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      quotaWaivers: [...newWaivers, ...currentWaivers],
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);

    return {
      success: true,
      count: newWaivers.length,
      totalWaivedInCents,
    };
  };

  const reverseQuotaDebtWaiver = (waiverId: string, reason: string) => {
    if (!can('treasury', 'WAIVE_QUOTA_DEBT') && currentUser.role !== 'admin_tecnico') {
      return {
        success: false,
        error: 'Sem permissão para reverter anulações/isenções de dívida de quotas.',
      };
    }

    const cleanReason = (reason || '').trim();
    if (cleanReason.length < 3) {
      return {
        success: false,
        error: 'Indique o motivo da reversão (mínimo 3 caracteres).',
      };
    }

    const currentWaivers = state.quotaWaivers || [];
    const target = currentWaivers.find((w) => w.id === waiverId);
    if (!target) {
      return { success: false, error: 'Registo de dívida zerada não encontrado.' };
    }
    if (target.isReversed) {
      return { success: false, error: 'Este registo já foi revertido anteriormente.' };
    }

    const now = getNowISOString();
    const updatedWaivers = currentWaivers.map((w) =>
      w.id === waiverId
        ? {
            ...w,
            isReversed: true,
            reversalReason: cleanReason,
            reversedAt: now,
            reversedByUserId: currentUser.id,
            reversedByName: currentUser.name,
          }
        : w
    );

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'treasury',
      'REVERSAO_DIVIDA_ZERADA',
      `Revertida a isenção/zero de dívida ${waiverId} de ${target.memberName} (${formatKz(target.amountWaivedInCents)}). Motivo: ${cleanReason}`,
      waiverId,
      target.memberName,
      cleanReason
    );

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      quotaWaivers: updatedWaivers,
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);

    return { success: true };
  };

  const createExpense = (data: {
    title: string;
    description: string;
    category: string;
    amountInCents: number;
    accountId?: string;
    invoiceFileName?: string;
    invoiceBase64?: string;
  }) => {
    const curState = stateRef.current;
    let seq = curState.expenses.length + 1;
    let newId = `EXP-${curState.settings.currentYear}-${seq.toString().padStart(3, '0')}`;
    while (curState.expenses.some((e) => e.id === newId)) {
      seq++;
      newId = `EXP-${curState.settings.currentYear}-${seq.toString().padStart(3, '0')}`;
    }

    const now = getNowISOString();
    const newExp: ExpenseRequest = {
      id: newId,
      title: data.title,
      description: data.description,
      category: data.category,
      amountInCents: data.amountInCents,
      requestedByUserId: currentUser.id,
      requestedByName: currentUser.name,
      accountId: data.accountId,
      invoiceFileName: data.invoiceFileName,
      invoiceBase64: data.invoiceBase64,
      status: 'solicitado',
      createdAt: now,
    };

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        expenses: [newExp, ...prev.expenses],
      }),
      { saveLocal: true, pushCloud: true }
    );

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

    const curState = stateRef.current;
    const exp = curState.expenses.find((e) => e.id === id);
    if (!exp) return { success: false, error: 'Despesa não encontrada.' };

    const now = getNowISOString();
    // REGRA DE INTEGRIDADE: Se for solicitada pelo próprio utilizador, exige 2º aprovador independente!
    const isOwnRequest = exp.requestedByUserId === currentUser.id;

    if (isOwnRequest && !exp.approvedByUserId) {
      // Primeira aprovação em despesa própria: aguarda 2º aprovador
      commitState(
        (prev) => ({
          ...prev,
          updatedAt: now,
          expenses: prev.expenses.map((e) =>
            e.id === id
              ? {
                  ...e,
                  approvedByUserId: currentUser.id,
                  approvedByName: currentUser.name,
                  approvalReason: reason || 'Pré-aprovação própria; requer 2º aprovador independente.',
                }
              : e
          ),
        }),
        { saveLocal: true, pushCloud: true }
      );
      logAction('treasury', 'PRE_APROVACAO_DESPESA', `Despesa própria pré-aprovada. Aguarda segundo aprovador independente.`, id, exp.title);
      return { success: true, error: 'Despesa própria: registada primeira assinatura. Requer segundo aprovador independente.' };
    }

    // Se já tinha 1º aprovador ou é de outro utilizador
    commitState(
      (prev) => {
        const updatedExpenses = prev.expenses.map((e) =>
          e.id === id
            ? {
                ...e,
                status: 'aprovado' as const,
                approvedByUserId: e.approvedByUserId || currentUser.id,
                approvedByName: e.approvedByName || currentUser.name,
                secondApproverUserId: isOwnRequest ? undefined : currentUser.id,
                secondApproverName: isOwnRequest ? undefined : currentUser.name,
                approvalReason: reason || e.approvalReason || 'Despesa aprovada em conformidade orçamental.',
              }
            : e
        );

        const updatedActivities = prev.activities.map((a) =>
          a.expenseRequestId === id || (exp.activityId && a.id === exp.activityId)
            ? {
                ...a,
                costApprovedInCents: exp.amountInCents,
              }
            : a
        );

        return { ...prev, updatedAt: now, expenses: updatedExpenses, activities: updatedActivities };
      },
      { saveLocal: true, pushCloud: true }
    );

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
    const curState = stateRef.current;
    const exp = curState.expenses.find((e) => e.id === id);
    if (!exp) return { success: false, error: 'Despesa não encontrada.' };

    const now = getNowISOString();
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        expenses: prev.expenses.map((e) =>
          e.id === id ? { ...e, status: 'rejeitado' as const, approvalReason: reason || 'Despesa não autorizada.' } : e
        ),
      }),
      { saveLocal: true, pushCloud: true }
    );
    logAction('treasury', 'REJEICAO_DESPESA', `Despesa rejeitada: ${reason}`, id, exp.title);
    return { success: true };
  };

  const payExpense = (
    id: string,
    accountId: string,
    proofUrl?: string,
    proofAttachment?: { fileName?: string; base64?: string }
  ) => {
    if (!can('treasury', 'CREATE') && !can('treasury', 'APPROVE') && currentUser.role !== 'admin_tecnico' && currentUser.role !== 'diretor' && currentUser.role !== 'tesoureiro') {
      return { success: false, error: 'Sem autorização para efetuar pagamento de despesa.' };
    }

    const curState = stateRef.current;
    const exp = curState.expenses.find((e) => e.id === id);
    if (!exp) return { success: false, error: 'Despesa não encontrada.' };
    if (exp.status !== 'aprovado') {
      return { success: false, error: 'Apenas despesas com aprovação prévia podem ser pagas.' };
    }

    let targetAccountId = accountId;
    let account = curState.accounts.find((a) => a.id === targetAccountId);
    if (!account) {
      account = curState.accounts.find((a) => a.active) || curState.accounts[0];
      if (account) targetAccountId = account.id;
    }
    if (!account) return { success: false, error: 'Conta financeira não encontrada.' };
    if (account.currentBalanceInCents < exp.amountInCents) {
      return {
        success: false,
        error: `Saldo insuficiente na conta ${account.name}. Saldo disponível: ${(account.currentBalanceInCents / 100).toLocaleString('pt-AO')} Kz (Valor da despesa: ${(exp.amountInCents / 100).toLocaleString('pt-AO')} Kz).`,
      };
    }

    const now = getNowISOString();
    const periodLock = isDateInLockedFiscalPeriod(curState.monthlyClosings, now);
    if (periodLock.locked) {
      return {
        success: false,
        error: `O mês fiscal ${periodLock.month}/${periodLock.year} encontra-se encerrado. Solicite a reabertura à Direção para liquidar despesas neste período.`,
      };
    }

    commitState(
      (prev) => {
        const updatedExpenses = prev.expenses.map((e) =>
          e.id === id
            ? {
                ...e,
                status: 'pago' as const,
                accountId: targetAccountId,
                paymentProofUrl: proofAttachment?.fileName || proofUrl || 'Comprovativo_Pagamento.pdf',
                paymentProofFileName: proofAttachment?.fileName || e.paymentProofFileName,
                paymentProofBase64: proofAttachment?.base64 || e.paymentProofBase64,
                paidAt: now,
              }
            : e
        );

        const updatedAccounts = prev.accounts.map((a) =>
          a.id === targetAccountId
            ? {
                ...a,
                currentBalanceInCents: a.currentBalanceInCents - exp.amountInCents,
              }
            : a
        );

        const updatedActivities = prev.activities.map((a) =>
          a.expenseRequestId === id || (exp.activityId && a.id === exp.activityId)
            ? {
                ...a,
                costPaidInCents: exp.amountInCents,
              }
            : a
        );

        return {
          ...prev,
          updatedAt: now,
          expenses: updatedExpenses,
          accounts: updatedAccounts,
          activities: updatedActivities,
        };
      },
      { saveLocal: true, pushCloud: true }
    );

    logAction('treasury', 'PAGAMENTO_DESPESA', `Pagamento da despesa ${exp.title} debitado na conta ${account.name}`, id, exp.title);
    return { success: true };
  };

  const closeFiscalMonth = (
    year: number,
    month: number,
    options?: {
      verifiedBalancesByAccountId?: Record<string, number>;
      reconciliationNotes?: string;
    }
  ) => {
    if (!can('treasury', 'ARCHIVE')) {
      return { success: false, error: 'Sem autorização para realizar o fecho mensal.' };
    }

    if (!Number.isInteger(year) || year < 2000 || !Number.isInteger(month) || month < 1 || month > 12) {
      return { success: false, error: 'Selecione um mês e ano fiscal válidos para executar o fecho.' };
    }

    if (isFiscalPeriodLocked(state.monthlyClosings, year, month)) {
      return { success: false, error: `O mês ${month}/${year} já se encontra encerrado.` };
    }

    const preview = calculateMonthlyReconciliationPreview({
      receipts: state.receipts,
      expenses: state.expenses,
      accounts: state.accounts,
      paymentProofs: state.paymentProofs,
      year,
      month,
      verifiedBalancesByAccountId: options?.verifiedBalancesByAccountId,
    });

    const trimmedNotes = (options?.reconciliationNotes || '').trim();
    if (preview.varianceInCents !== 0 && trimmedNotes.length < 5) {
      return {
        success: false,
        error:
          'Foi detetada uma divergência entre o saldo real conferido e o saldo do sistema. Registe uma justificação nas notas de reconciliação (mínimo 5 caracteres).',
      };
    }

    const previousClosingsForPeriod = state.monthlyClosings.filter(
      (c) => c.year === year && c.month === month
    ).length;
    const baseClosingId = `CLS-${year}-${month.toString().padStart(2, '0')}`;
    const closingId =
      previousClosingsForPeriod > 0
        ? `${baseClosingId}-R${previousClosingsForPeriod + 1}`
        : baseClosingId;

    const now = getNowISOString();

    const newClosing: MonthlyClosing = {
      id: closingId,
      year,
      month,
      totalIncomeInCents: preview.totalIncomeInCents,
      totalExpenseInCents: preview.totalExpenseInCents,
      closingBalanceInCents: preview.closingBalanceInCents,
      closedByUserId: currentUser.id,
      closedByName: currentUser.name,
      closedAt: now,
      receiptsCount: preview.receiptsCount,
      cancelledReceiptsCount: preview.cancelledReceiptsCount,
      expensesCount: preview.expensesCount,
      pendingProofsCount: preview.pendingProofsCount,
      pendingExpensesCount: preview.pendingExpensesCount,
      systemAccountsBalanceInCents: preview.systemAccountsBalanceInCents,
      reconciledPhysicalBalanceInCents: preview.reconciledPhysicalBalanceInCents,
      varianceInCents: preview.varianceInCents,
      reconciliationStatus: preview.reconciliationStatus,
      reconciliationNotes: trimmedNotes || undefined,
      accountSnapshots: preview.accountSnapshots,
    };

    const statusText =
      preview.reconciliationStatus === 'conciliado'
        ? 'Conciliado (0,00 Kz diferença)'
        : `Divergência de ${formatKz(preview.varianceInCents)}`;

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'treasury',
      'FECHO_MENSAL',
      `Fecho do mês fiscal ${month}/${year} concluído (${statusText}). Receitas: ${formatKz(preview.totalIncomeInCents)} · Despesas: ${formatKz(preview.totalExpenseInCents)} · Resultado: ${formatKz(preview.closingBalanceInCents)}`,
      closingId,
      `${month.toString().padStart(2, '0')}/${year}`,
      trimmedNotes || undefined
    );

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      monthlyClosings: [newClosing, ...state.monthlyClosings],
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);

    return { success: true, closing: newClosing };
  };

  const reopenFiscalMonth = (id: string, reason: string) => {
    if (!can('treasury', 'REOPEN')) {
      return { success: false, error: 'Apenas a Direção Geral tem autorização para reabrir um mês fiscal encerrado.' };
    }
    const cleanReason = (reason || '').trim();
    if (cleanReason.length < 5) {
      return { success: false, error: 'É obrigatório fundamentar a reabertura do mês fiscal (mínimo 5 caracteres).' };
    }

    const targetClosing = state.monthlyClosings.find((c) => c.id === id);
    if (!targetClosing) {
      return { success: false, error: 'Registo de fecho fiscal não encontrado.' };
    }
    if (targetClosing.isReopened) {
      return { success: false, error: 'Este fecho fiscal já foi reaberto anteriormente.' };
    }

    const now = getNowISOString();

    const updatedClosings = state.monthlyClosings.map((c) => {
      if (c.id === id) {
        return {
          ...c,
          isReopened: true,
          reopenReason: cleanReason,
          reopenedByUserId: currentUser.id,
          reopenedByName: currentUser.name,
          reopenedAt: now,
        };
      }
      return c;
    });

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'treasury',
      'REABERTURA_MES_FISCAL',
      `Reabertura autorizada do fecho ${targetClosing.month}/${targetClosing.year} (${id}): ${cleanReason}`,
      id,
      `${targetClosing.month.toString().padStart(2, '0')}/${targetClosing.year}`,
      cleanReason
    );

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      monthlyClosings: updatedClosings,
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);

    return { success: true };
  };

  // --- ATIVIDADES ---
  const createActivity = (data: Omit<ClubActivity, 'id' | 'createdAt' | 'tasks' | 'attendees'>) => {
    if (!can('activities', 'CREATE')) {
      return { success: false, error: 'Sem permissão para agendar atividades.' };
    }

    if (data.endDate && getActivityDateOnly(data.endDate) < getActivityDateOnly(data.startDate)) {
      return { success: false, error: 'A data de término não pode ser anterior à data de início.' };
    }

    const curState = stateRef.current;
    const now = getNowISOString();
    const currentYr = curState.settings?.currentYear || new Date().getFullYear();

    let seq = curState.activities.length + 1;
    let newId = `ACT-${currentYr}-${seq.toString().padStart(3, '0')}`;
    while (curState.activities.some((a) => a.id === newId)) {
      seq++;
      newId = `ACT-${currentYr}-${seq.toString().padStart(3, '0')}`;
    }

    let generatedExpense: ExpenseRequest | null = null;
    let expenseId: string | undefined = undefined;

    if (data.costEstimatedInCents && data.costEstimatedInCents > 0) {
      let expSeq = curState.expenses.length + 1;
      expenseId = `EXP-${currentYr}-${expSeq.toString().padStart(3, '0')}`;
      while (curState.expenses.some((e) => e.id === expenseId)) {
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

    const canAuthorizePortal = canManageActivityPortalVisibility(
      currentUser.role,
      curState.settings.permissionsMatrix
    );
    const allowPortalVisibility = canAuthorizePortal ? Boolean(data.visibleInMemberPortal) : false;

    const newActivity: ClubActivity = {
      ...data,
      stage: normalizeActivityStage(data.stage),
      department: data.department || 'Instrução Geral',
      id: newId,
      visibleInMemberPortal: allowPortalVisibility,
      memberPortalPublishedByName: allowPortalVisibility ? currentUser.name : undefined,
      memberPortalPublishedAt: allowPortalVisibility ? now : undefined,
      rsvps: [],
      tasks: [],
      attendees: [],
      expenseRequestId: expenseId,
      costEstimatedInCents: data.costEstimatedInCents || 0,
      costApprovedInCents: 0,
      costPaidInCents: 0,
      createdAt: now,
    };

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

    commitState(
      (prev) => {
        const updatedActivities = [newActivity, ...prev.activities.filter((a) => a.id !== newId)];
        const updatedExpenses = generatedExpense
          ? [generatedExpense, ...prev.expenses.filter((e) => e.id !== expenseId)]
          : prev.expenses;
        const updatedAuditLogs = generatedExpense
          ? [
              createAuditLog(
                currentUser.id,
                currentUser.name,
                currentUser.role,
                'treasury',
                'SOLICITACAO_DESPESA_AUTOMATICA',
                `Solicitação de custo gerada automaticamente para a atividade: ${data.title}`,
                generatedExpense.id,
                formatKz(data.costEstimatedInCents)
              ),
              auditEntry,
              ...prev.auditLogs,
            ]
          : [auditEntry, ...prev.auditLogs];

        return {
          ...prev,
          updatedAt: now,
          activities: updatedActivities,
          expenses: updatedExpenses,
          notifications: [newNotif, ...(prev.notifications || [])],
          auditLogs: updatedAuditLogs,
        };
      },
      { saveLocal: true, pushCloud: true }
    );

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

  const updateActivity = (
    id: string,
    data: Partial<Omit<ClubActivity, 'id' | 'createdAt' | 'tasks' | 'attendees' | 'minute' | 'rsvps'>>
  ) => {
    if (!can('activities', 'EDIT')) {
      return { success: false, error: 'Sem permissão para editar atividades.' };
    }

    const curState = stateRef.current;
    const existing = curState.activities.find((a) => a.id === id);
    if (!existing) {
      return { success: false, error: 'Atividade não encontrada.' };
    }

    const nextTitle = (data.title !== undefined ? data.title : existing.title).trim();
    const nextLocation = (data.location !== undefined ? data.location : existing.location).trim();
    const nextStart = data.startDate !== undefined ? data.startDate : existing.startDate;
    const nextEnd = data.endDate !== undefined ? data.endDate : existing.endDate;

    if (!nextTitle) return { success: false, error: 'O título da atividade é obrigatório.' };
    if (!nextLocation) return { success: false, error: 'O local da atividade é obrigatório.' };
    if (!nextStart) return { success: false, error: 'A data de início é obrigatória.' };
    if (nextEnd && getActivityDateOnly(nextEnd) < getActivityDateOnly(nextStart)) {
      return { success: false, error: 'A data de término não pode ser anterior à data de início.' };
    }

    const now = getNowISOString();
    const currentYr = curState.settings?.currentYear || new Date().getFullYear();
    const canAuthorizePortal = canManageActivityPortalVisibility(
      currentUser.role,
      curState.settings.permissionsMatrix
    );

    const nextVisibleInPortal =
      data.visibleInMemberPortal !== undefined && canAuthorizePortal
        ? Boolean(data.visibleInMemberPortal)
        : Boolean(existing.visibleInMemberPortal);

    const nextHasCost = data.hasCost !== undefined ? Boolean(data.hasCost) : Boolean(existing.hasCost);
    const nextEstimatedCost =
      nextHasCost && data.costEstimatedInCents !== undefined
        ? Math.max(0, data.costEstimatedInCents)
        : nextHasCost
        ? existing.costEstimatedInCents
        : 0;

    let updatedActivityResult: ClubActivity = existing;

    commitState(
      (prev) => {
        let updatedExpenses = prev.expenses;
        let nextExpenseId = existing.expenseRequestId;

        if (nextHasCost && nextEstimatedCost > 0) {
          const linkedExpense = prev.expenses.find(
            (e) => e.id === existing.expenseRequestId || e.activityId === existing.id
          );
          if (linkedExpense) {
            nextExpenseId = linkedExpense.id;
            if (linkedExpense.status === 'solicitado') {
              updatedExpenses = prev.expenses.map((e) =>
                e.id === linkedExpense.id
                  ? {
                      ...e,
                      title: `Custo de Atividade: ${nextTitle}`,
                      amountInCents: nextEstimatedCost,
                    }
                  : e
              );
            }
          } else {
            let expSeq = prev.expenses.length + 1;
            let newExpenseId = `EXP-${currentYr}-${expSeq.toString().padStart(3, '0')}`;
            while (prev.expenses.some((e) => e.id === newExpenseId)) {
              expSeq++;
              newExpenseId = `EXP-${currentYr}-${expSeq.toString().padStart(3, '0')}`;
            }
            nextExpenseId = newExpenseId;
            const createdExpense: ExpenseRequest = {
              id: newExpenseId,
              activityId: existing.id,
              title: `Custo de Atividade: ${nextTitle}`,
              description: `Orçamento operacional solicitado após edição da atividade "${nextTitle}" em ${nextLocation}.`,
              category: 'Atividades e Eventos',
              amountInCents: nextEstimatedCost,
              requestedByUserId: currentUser.id,
              requestedByName: currentUser.name,
              status: 'solicitado',
              createdAt: now,
            };
            updatedExpenses = [createdExpense, ...prev.expenses];
          }
        } else {
          // Se o custo foi desativado na edição, remove pedidos pendentes ainda em "solicitado"
          const linkedPending = prev.expenses.find(
            (e) =>
              (e.id === existing.expenseRequestId || e.activityId === existing.id) &&
              e.status === 'solicitado'
          );
          if (linkedPending) {
            updatedExpenses = prev.expenses.filter((e) => e.id !== linkedPending.id);
            if (nextExpenseId === linkedPending.id) {
              nextExpenseId = undefined;
            }
          } else if (!nextHasCost) {
            nextExpenseId = undefined;
          }
        }

        updatedActivityResult = {
          ...existing,
          ...data,
          stage: normalizeActivityStage(data.stage !== undefined ? data.stage : existing.stage),
          title: nextTitle,
          location: nextLocation,
          startDate: nextStart,
          endDate: nextEnd || undefined,
          department: (data.department !== undefined ? data.department : existing.department) || 'Instrução Geral',
          hasCost: nextHasCost && nextEstimatedCost > 0,
          costEstimatedInCents: nextEstimatedCost,
          expenseRequestId: nextExpenseId,
          visibleInMemberPortal: nextVisibleInPortal,
          memberPortalPublishedByName:
            nextVisibleInPortal && !existing.visibleInMemberPortal
              ? currentUser.name
              : existing.memberPortalPublishedByName,
          memberPortalPublishedAt:
            nextVisibleInPortal && !existing.visibleInMemberPortal
              ? now
              : existing.memberPortalPublishedAt,
        };

        const auditEntry = createAuditLog(
          currentUser.id,
          currentUser.name,
          currentUser.role,
          'activities',
          'EDICAO_ATIVIDADE',
          `Atividade atualizada: ${updatedActivityResult.title}`,
          id,
          updatedActivityResult.title
        );

        return {
          ...prev,
          updatedAt: now,
          activities: prev.activities.map((a) => (a.id === id ? updatedActivityResult : a)),
          expenses: updatedExpenses,
          auditLogs: [auditEntry, ...prev.auditLogs],
        };
      },
      { saveLocal: true, pushCloud: true }
    );

    return { success: true, activity: updatedActivityResult };
  };

  const updateActivityStage = (id: string, stage: ClubActivity['stage']) => {
    if (!can('activities', 'EDIT') && !can('associate_director', 'EDIT')) {
      return { success: false, error: 'Sem autorização para alterar a fase da atividade.' };
    }

    const normalizedStage = normalizeActivityStage(stage);
    const now = getNowISOString();
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'activities',
      'MUDANCA_FASE',
      `Fase alterada para ${normalizedStage}`,
      id
    );

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        activities: prev.activities.map((a) => (a.id === id ? { ...a, stage: normalizedStage } : a)),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );

    return { success: true };
  };

  const decideActivityApproval = (
    id: string,
    decision: 'aprovar' | 'devolver',
    notes?: string
  ) => {
    const curState = stateRef.current;
    if (!canManageActivityPortalVisibility(currentUser.role, curState.settings.permissionsMatrix)) {
      return { success: false, error: 'Apenas o Diretor ou responsável autorizado pode aprovar ou devolver atividades.' };
    }

    const target = curState.activities.find((a) => a.id === id);
    if (!target) {
      return { success: false, error: 'Atividade não encontrada.' };
    }

    if (decision === 'devolver' && !notes?.trim()) {
      return { success: false, error: 'Indique o parecer ou motivo ao devolver a atividade para ajustes.' };
    }

    const now = getNowISOString();
    const nextStage: ClubActivity['stage'] =
      decision === 'aprovar'
        ? normalizeActivityStage(target.stage)
        : 'preparacao';

    const updatedActivity: ClubActivity = {
      ...target,
      isApprovedByDirector: decision === 'aprovar',
      stage: nextStage,
      directorDecisionNotes: notes?.trim() || undefined,
      directorDecisionByName: currentUser.name,
      directorDecisionAt: now,
    };

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'activities',
      decision === 'aprovar' ? 'APROVACAO_ATIVIDADE' : 'DEVOLUCAO_ATIVIDADE',
      decision === 'aprovar'
        ? `Atividade aprovada pela Direção: ${target.title}`
        : `Atividade devolvida para preparação (${target.title}): ${notes?.trim()}`,
      id,
      target.title
    );

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        activities: prev.activities.map((a) => (a.id === id ? updatedActivity : a)),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );

    return { success: true };
  };

  const toggleActivityPortalVisibility = (id: string, visible: boolean) => {
    const curState = stateRef.current;
    if (!canManageActivityPortalVisibility(currentUser.role, curState.settings.permissionsMatrix)) {
      return {
        success: false,
        error: 'Apenas o Diretor pode autorizar ou ocultar atividades no Portal do Membro.',
      };
    }

    const target = curState.activities.find((a) => a.id === id);
    if (!target) {
      return { success: false, error: 'Atividade não encontrada.' };
    }

    const now = getNowISOString();
    const updatedActivity: ClubActivity = {
      ...target,
      visibleInMemberPortal: visible,
      memberPortalPublishedByName: visible ? currentUser.name : target.memberPortalPublishedByName,
      memberPortalPublishedAt: visible ? now : target.memberPortalPublishedAt,
    };

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'activities',
      'VISIBILIDADE_PORTAL_ATIVIDADE',
      visible
        ? `Atividade autorizada no Portal do Membro pelo Diretor: ${target.title}`
        : `Atividade ocultada do Portal do Membro: ${target.title}`,
      id,
      target.title
    );

    const nextNotif: ClubNotification | null = visible
      ? {
          id: `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          title: `Agenda do Clube: ${target.title}`,
          message: `Nova atividade disponível no Portal do Membro para ${formatDateAO(target.startDate)} em ${target.location}. Confirme a sua presença!`,
          category: 'announcement',
          targetModule: 'member_portal',
          targetId: target.id,
          recipientRoles: ['membro', 'diretor', 'diretor_associado', 'secretario', 'tesoureiro', 'instrutor', 'capelao'],
          priority: 'normal',
          timestamp: now,
          read: false,
        }
      : null;

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        activities: prev.activities.map((a) => (a.id === id ? updatedActivity : a)),
        notifications: nextNotif ? [nextNotif, ...(prev.notifications || [])] : prev.notifications,
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );

    return { success: true };
  };

  const deleteActivity = (id: string) => {
    if (!can('activities', 'ARCHIVE') && !can('activities', 'EDIT') && currentUser.role !== 'diretor' && currentUser.role !== 'admin_tecnico') {
      return { success: false, error: 'Sem autorização para eliminar atividades.' };
    }
    const curState = stateRef.current;
    const act = curState.activities.find((a) => a.id === id);
    if (!act) {
      return { success: false, error: 'Atividade não encontrada.' };
    }

    const now = getNowISOString();
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

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        activities: prev.activities.filter((a) => a.id !== id),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );

    return { success: true };
  };

  const toggleAttendance = (activityId: string, memberId: string, present: boolean, notes?: string) => {
    if (!can('activities', 'EDIT')) return;

    const now = getNowISOString();
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        activities: prev.activities.map((act) => {
          if (act.id === activityId) {
            const existing = act.attendees.filter((att) => att.memberId !== memberId);
            return {
              ...act,
              attendees: [...existing, { memberId, present, notes }],
            };
          }
          return act;
        }),
      }),
      { saveLocal: true, pushCloud: true }
    );
  };

  const batchToggleAttendance = (activityId: string, memberIds: string[], present: boolean) => {
    if (!can('activities', 'EDIT')) {
      return { success: false, error: 'Sem permissão para registar presenças.' };
    }
    if (!memberIds || memberIds.length === 0) {
      return { success: false, error: 'Nenhum membro selecionado para marcação em lote.' };
    }

    const curState = stateRef.current;
    const targetAct = curState.activities.find((a) => a.id === activityId);
    if (!targetAct) {
      return { success: false, error: 'Atividade não encontrada.' };
    }

    const now = getNowISOString();
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'activities',
      'CHAMADA_EM_LOTE',
      `Chamada em lote (${present ? 'Presente' : 'Ausente'}) aplicada a ${memberIds.length} membro(s) em "${targetAct.title}".`,
      activityId,
      targetAct.title
    );

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        activities: applyBatchAttendanceToActivities(prev.activities, activityId, memberIds, present),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );

    return { success: true };
  };

  const addTaskToActivity = (activityId: string, task: Omit<ClubActivity['tasks'][0], 'id'>) => {
    if (!can('activities', 'EDIT') && !can('associate_director', 'EDIT')) {
      return { success: false, error: 'Sem permissão para atribuir tarefas.' };
    }
    if (!task.title || !task.title.trim()) {
      return { success: false, error: 'A descrição da tarefa é obrigatória.' };
    }

    const taskId = `TSK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = getNowISOString();
    const cleanTask = {
      ...task,
      title: task.title.trim(),
      id: taskId,
    };

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'activities',
      'CRIACAO_TAREFA',
      `Nova tarefa atribuída: ${cleanTask.title} (${cleanTask.assigneeName || 'Sem responsável'})`,
      taskId,
      cleanTask.title
    );

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        activities: prev.activities.map((act) =>
          act.id === activityId
            ? { ...act, tasks: [...act.tasks, cleanTask] }
            : act
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );

    return { success: true };
  };

  const updateTaskStatus = (activityId: string, taskId: string, status: ClubActivity['tasks'][0]['status']) => {
    if (!can('activities', 'EDIT') && !can('associate_director', 'EDIT')) {
      return { success: false, error: 'Sem permissão para atualizar estado de tarefas.' };
    }

    const now = getNowISOString();
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'activities',
      'ALTERACAO_ESTADO_TAREFA',
      `Estado da tarefa atualizado para ${status}`,
      taskId
    );

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        activities: prev.activities.map((act) =>
          act.id === activityId
            ? {
                ...act,
                tasks: act.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
              }
            : act
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );

    return { success: true };
  };

  const updateTaskInActivity = (
    activityId: string,
    taskId: string,
    updates: Partial<Omit<ActivityTask, 'id'>>
  ) => {
    if (!can('activities', 'EDIT') && !can('associate_director', 'EDIT')) {
      return { success: false, error: 'Sem permissão para editar tarefas.' };
    }
    if (updates.title !== undefined && !updates.title.trim()) {
      return { success: false, error: 'A descrição da tarefa não pode estar vazia.' };
    }

    const now = getNowISOString();
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'activities',
      'EDICAO_TAREFA',
      `Tarefa atualizada na atividade`,
      taskId
    );

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        activities: prev.activities.map((act) =>
          act.id === activityId
            ? {
                ...act,
                tasks: act.tasks.map((t) =>
                  t.id === taskId
                    ? {
                        ...t,
                        ...updates,
                        title: updates.title !== undefined ? updates.title.trim() : t.title,
                      }
                    : t
                ),
              }
            : act
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );

    return { success: true };
  };

  const deleteTaskFromActivity = (activityId: string, taskId: string) => {
    if (!can('activities', 'EDIT') && !can('associate_director', 'EDIT')) {
      return { success: false, error: 'Sem permissão para eliminar tarefas.' };
    }

    const now = getNowISOString();
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'activities',
      'REMOCAO_TAREFA',
      `Tarefa removida da atividade`,
      taskId
    );

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        activities: prev.activities.map((act) =>
          act.id === activityId
            ? {
                ...act,
                tasks: act.tasks.filter((t) => t.id !== taskId),
              }
            : act
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );

    return { success: true };
  };

  const saveMinuteToActivity = (
    activityId: string,
    minuteData: Omit<NonNullable<ClubActivity['minute']>, 'id' | 'minuteNumber'>,
    tasksToAdd?: Omit<ActivityTask, 'id'>[]
  ) => {
    if (!can('activities', 'CREATE')) {
      return { success: false, error: 'Sem permissão para redigir atas.' };
    }

    const curState = stateRef.current;
    const currentYear = curState.settings.currentYear;
    const targetActivity = curState.activities.find((a) => a.id === activityId);
    if (!targetActivity || !canActivityHaveMinute(targetActivity.type)) {
      return {
        success: false,
        error: 'Atas só podem ser redigidas quando o tipo de atividade for "Reunião da Comissão".',
      };
    }

    const existingMinuteNumber = targetActivity.minute?.minuteNumber;
    const existingDocNumbers = curState.documents.map((d) => d.documentNumber);
    const minuteNumber =
      existingMinuteNumber ||
      generateNextDocumentNumber('ATA', currentYear, existingDocNumbers);
    const now = getNowISOString();

    const resolvedOfficers = resolveMinuteOfficers(curState.users, currentUser);
    const minuteStatus = minuteData.status || 'aprovada';

    const minute = {
      ...minuteData,
      status: minuteStatus,
      chairPerson: resolvedOfficers.chairPerson,
      secretary: resolvedOfficers.secretary,
      id: minuteNumber,
      minuteNumber,
    };

    const contentData = {
      chairPerson: resolvedOfficers.chairPerson,
      chairPersonUserId: resolvedOfficers.chairPersonUserId,
      secretary: resolvedOfficers.secretary,
      secretaryUserId: resolvedOfficers.secretaryUserId,
      local: minuteData.location,
      presentes: minuteData.attendeesCount,
      quorumMet: minuteData.quorumMet,
      minuteStatus,
      agenda: minuteData.agenda,
      deliberacao: minuteData.deliberations,
      deliberations: minuteData.deliberations,
    };

    const docTitle = `Ata da Reunião - ${targetActivity.title}`;

    const generatedTasks: ActivityTask[] = (tasksToAdd || [])
      .filter((t) => t.title && t.title.trim().length > 0)
      .map((t, index) => ({
        ...t,
        title: t.title.trim(),
        id: `TSK-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 5)}`,
      }));

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'activities',
      'EMISSAO_ATA',
      `${existingMinuteNumber ? `Ata ${minuteNumber} atualizada` : `Ata ${minuteNumber} redigida e anexada`} (${minuteStatus === 'rascunho' ? 'Rascunho' : 'Aprovada'})${generatedTasks.length > 0 ? ` com ${generatedTasks.length} tarefa(s) gerada(s)` : ''}`,
      activityId,
      minuteNumber
    );

    commitState(
      (prev) => {
        const existingOfficialDoc = prev.documents.find(
          (d) => d.documentNumber === minuteNumber
        );

        const officialDoc: OfficialDocument = existingOfficialDoc
          ? {
              ...existingOfficialDoc,
              title: docTitle,
              issuedByUserId: currentUser.id,
              issuedByName: currentUser.name,
              issuedByRole: currentUser.role,
              issuedAt: now,
              contentData,
            }
          : {
              id: `DOC-${Date.now()}`,
              documentNumber: minuteNumber,
              documentType: 'ata',
              title: docTitle,
              year: currentYear,
              issuedByUserId: currentUser.id,
              issuedByName: currentUser.name,
              issuedByRole: currentUser.role,
              issuedAt: now,
              contentData,
              isCancelled: false,
            };

        return {
          ...prev,
          updatedAt: now,
          activities: prev.activities.map((a) =>
            a.id === activityId
              ? {
                  ...a,
                  minute,
                  tasks: generatedTasks.length > 0 ? [...a.tasks, ...generatedTasks] : a.tasks,
                }
              : a
          ),
          documents: existingOfficialDoc
            ? prev.documents.map((d) =>
                d.documentNumber === minuteNumber ? officialDoc : d
              )
            : [officialDoc, ...prev.documents],
          auditLogs: [auditEntry, ...prev.auditLogs],
        };
      },
      { saveLocal: true, pushCloud: true }
    );

    return { success: true, minuteNumber };
  };

  const submitActivityRsvp = (
    activityId: string,
    status: ActivityRsvpStatus,
    note?: string
  ) => {
    const curState = stateRef.current;
    const member = getStrictLinkedMember(currentUser, curState.members);
    if (!member) {
      return {
        success: false,
        error: 'A sua conta não está vinculada a nenhuma ficha oficial de membro.',
      };
    }

    const targetActivity = curState.activities.find((a) => a.id === activityId);
    if (!targetActivity) {
      return { success: false, error: 'Atividade não encontrada.' };
    }
    if (targetActivity.visibleInMemberPortal !== true) {
      return {
        success: false,
        error: 'Esta atividade não está autorizada pelo Diretor para visualização no Portal do Membro.',
      };
    }
    if (normalizeActivityStage(targetActivity.stage) === 'realizado') {
      return {
        success: false,
        error: 'Esta atividade já foi realizada.',
      };
    }

    const now = getNowISOString();
    const statusLabel =
      status === 'vou' ? 'Vou Participar' : status === 'talvez' ? 'Talvez' : 'Não Posso Ir';
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'member_portal',
      'CONFIRMACAO_PRESENCA_ATIVIDADE',
      `${member.fullName} confirmou "${statusLabel}" para "${targetActivity.title}"`,
      activityId,
      targetActivity.title
    );

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        activities: prev.activities.map((act) => {
          if (act.id !== activityId) return act;
          const filtered = (act.rsvps || []).filter((r) => r.memberId !== member.id);
          return {
            ...act,
            rsvps: [
              ...filtered,
              {
                memberId: member.id,
                memberName: member.fullName,
                status,
                note: note?.trim() || undefined,
                updatedAt: now,
              },
            ],
          };
        }),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );

    return { success: true };
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
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        trainingProgress: prev.trainingProgress.map((prg) =>
          prg.id === progressId
            ? {
                ...prg,
                completedRequirements: completedReqs,
                instructorValidated: true,
                observations: notes || prg.observations,
                updatedAt: now,
              }
            : prg
        ),
      }),
      { saveLocal: true, pushCloud: true }
    );

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
      return { success: false, error: 'Sem permissão para inscrever membro em módulo ou medalha.' };
    }

    const now = getNowISOString();
    const nextId = `PRG-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 5)}`;
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
      updatedAt: now,
    };

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        trainingProgress: [newProgress, ...prev.trainingProgress],
      }),
      { saveLocal: true, pushCloud: true }
    );

    logAction('training', 'INICIO_CLASSE', `Membro inscrito em ${targetTitle}`, nextId, targetTitle);
    return { success: true };
  };

  const batchEnrollTrainingProgress = (data: {
    memberIds: string[];
    type: 'classe' | 'especialidade';
    targetId: string;
    targetTitle: string;
    totalRequirements: number;
    instructorUserId?: string;
    instructorName?: string;
  }) => {
    if (!can('training', 'CREATE') && !can('associate_director', 'EDIT')) {
      return { success: false, error: 'Sem permissão para inscrever membros em lote em módulos ou medalhas.' };
    }

    const uniqueMemberIds = Array.from(new Set((data.memberIds || []).filter(Boolean)));
    if (uniqueMemberIds.length === 0) {
      return { success: false, error: 'Selecione pelo menos um membro elegível para inscrição.' };
    }

    const curState = stateRef.current;
    const normalizedTitle = data.targetTitle.trim().toLowerCase();
    const alreadyEnrolledIds = new Set(
      curState.trainingProgress
        .filter(
          (tp) =>
            tp.type === data.type &&
            (tp.targetId === data.targetId || tp.targetTitle.trim().toLowerCase() === normalizedTitle)
        )
        .map((tp) => tp.memberId)
    );

    const eligibleIds = uniqueMemberIds.filter((id) => !alreadyEnrolledIds.has(id));
    const skippedCount = uniqueMemberIds.length - eligibleIds.length;
    if (eligibleIds.length === 0) {
      return {
        success: false,
        error: 'Todos os membros selecionados já estão inscritos neste módulo ou medalha.',
      };
    }

    const now = getNowISOString();
    const instructorUserId = data.instructorUserId || currentUser.id;
    const instructorName = data.instructorName || currentUser.name;

    const createdItems: MemberTrainingProgress[] = eligibleIds.map((memberId, idx) => ({
      id: `PRG-${Date.now().toString().slice(-4)}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      memberId,
      type: data.type,
      targetId: data.targetId,
      targetTitle: data.targetTitle,
      completedRequirements: [],
      totalRequirements: data.totalRequirements,
      instructorUserId,
      instructorName,
      instructorValidated: false,
      finalAuthorizedApproval: false,
      updatedAt: now,
    }));

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'training',
      'INSCRICAO_LOTE_FORMACAO',
      `Inscrição em lote em "${data.targetTitle}": ${createdItems.length} inscrito(s)${skippedCount > 0 ? `, ${skippedCount} já matriculado(s)` : ''} · Instrutor: ${instructorName}`,
      data.targetId,
      data.targetTitle
    );

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        trainingProgress: [...createdItems, ...prev.trainingProgress],
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );

    return { success: true, createdCount: createdItems.length, skippedCount };
  };

  const assignTrainingInstructor = (
    progressId: string,
    instructorUserId: string,
    instructorName: string
  ) => {
    if (!can('training', 'EDIT') && !can('associate_director', 'EDIT')) {
      return { success: false, error: 'Sem permissão para atribuir ou alterar o instrutor responsável.' };
    }

    const curState = stateRef.current;
    const target = curState.trainingProgress.find((p) => p.id === progressId);
    if (!target) {
      return { success: false, error: 'Registo de formação não encontrado.' };
    }

    const cleanName = instructorName.trim();
    if (!cleanName) {
      return { success: false, error: 'Selecione um instrutor válido.' };
    }

    const now = getNowISOString();
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'training',
      'ATRIBUICAO_INSTRUTOR_FORMACAO',
      `Instrutor de "${target.targetTitle}" atualizado para ${cleanName}`,
      progressId,
      target.targetTitle
    );

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        trainingProgress: prev.trainingProgress.map((p) =>
          p.id === progressId
            ? {
                ...p,
                instructorUserId,
                instructorName: cleanName,
                updatedAt: now,
              }
            : p
        ),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );

    return { success: true };
  };

  const batchUpdateTrainingRequirements = (data: {
    progressIds: string[];
    requirementNumber: number;
    completed: boolean;
    notes?: string;
  }) => {
    if (!can('training', 'EDIT') && !can('associate_director', 'EDIT')) {
      return { success: false, updatedCount: 0, error: 'Sem permissão para registar chamada curricular em lote.' };
    }

    const uniqueIds = Array.from(new Set((data.progressIds || []).filter(Boolean)));
    if (uniqueIds.length === 0) {
      return { success: false, updatedCount: 0, error: 'Selecione pelo menos um registo de membro.' };
    }

    const curState = stateRef.current;
    const now = getNowISOString();
    const { updatedList, updatedCount } = applyBatchTrainingRequirementUpdate(
      curState.trainingProgress,
      uniqueIds,
      data.requirementNumber,
      data.completed,
      now,
      data.notes
    );

    if (updatedCount === 0) {
      return {
        success: false,
        updatedCount: 0,
        error: 'Nenhuma alteração aplicada (os membros selecionados já possuem este estado ou investidura homologada).',
      };
    }

    const firstTarget = curState.trainingProgress.find((p) => uniqueIds.includes(p.id));
    const targetLabel = firstTarget?.targetTitle || 'Módulo/Medalha';
    const actionLabel = data.completed ? 'Concluído' : 'Pendente';

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'training',
      'CHAMADA_CURRICULAR_LOTE',
      `Chamada curricular em lote ("${targetLabel}", Requisito #${data.requirementNumber} → ${actionLabel}): ${updatedCount} membro(s) atualizado(s)`,
      firstTarget?.targetId || uniqueIds[0],
      targetLabel
    );

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        trainingProgress: updatedList,
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );

    return { success: true, updatedCount };
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

    const curState = stateRef.current;
    const item = curState.trainingProgress.find((p) => p.id === progressId);
    if (!item) return { success: false, error: 'Registo de formação não encontrado.' };

    const classObj = item.type === 'classe'
      ? curState.classes.find((c) => c.id === item.targetId || c.code === item.targetId || c.title?.toLowerCase() === item.targetTitle?.toLowerCase())
      : null;
    const specObj = item.type === 'especialidade'
      ? curState.specialties.find((s) => s.id === item.targetId || s.code === item.targetId || s.title?.toLowerCase() === item.targetTitle?.toLowerCase())
      : null;

    const actualReqs = (item.type === 'classe' ? classObj?.requirements : specObj?.requirements) || [];
    const totalCount = actualReqs.length > 0 ? actualReqs.length : (item.totalRequirements || 8);
    const allCompleted = Array.from({ length: totalCount }, (_, i) => i + 1);
    const now = getNowISOString();

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        trainingProgress: prev.trainingProgress.map((p) =>
          p.id === progressId
            ? {
                ...p,
                totalRequirements: totalCount,
                completedRequirements: allCompleted,
                instructorValidated: true,
                finalAuthorizedApproval: true,
                approvedByDirectorId: currentUser.id,
                approvedAt: now,
                updatedAt: now,
              }
            : p
        ),
      }),
      { saveLocal: true, pushCloud: true }
    );

    logAction(
      'training',
      'VALIDACAO_FINAL_INVESTIDURA',
      `Investidura autorizada e validada por ${currentUser.name} (${ROLE_LABELS[currentUser.role]?.label || currentUser.role}) para ${item.targetTitle} (Membro: ${item.memberId})`,
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

    const curState = stateRef.current;
    const item = curState.trainingProgress.find((p) => p.id === progressId);
    if (!item) return { success: false, error: 'Registo de formação não encontrado.' };

    const now = getNowISOString();
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        trainingProgress: prev.trainingProgress.map((p) =>
          p.id === progressId
            ? {
                ...p,
                finalAuthorizedApproval: false,
                approvedByDirectorId: undefined,
                approvedAt: undefined,
                updatedAt: now,
              }
            : p
        ),
      }),
      { saveLocal: true, pushCloud: true }
    );

    logAction('training', 'REVOGACAO_INVESTIDURA', `Aprovação de investidura reaberta para reavaliação de ${item.targetTitle}`, progressId, item.targetTitle);
    return { success: true };
  };

  const deleteTrainingProgress = (progressId: string) => {
    if (
      !can('training', 'APPROVE') &&
      currentUser.role !== 'diretor' &&
      currentUser.role !== 'admin_tecnico'
    ) {
      return { success: false, error: 'Apenas a Direção possui permissão para retirar/desmatricular um membro do módulo ou medalha.' };
    }

    const curState = stateRef.current;
    const item = curState.trainingProgress.find((p) => p.id === progressId);
    if (!item) return { success: false, error: 'Registo de formação não encontrado.' };

    const now = getNowISOString();
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        trainingProgress: prev.trainingProgress.filter((p) => p.id !== progressId),
      }),
      { saveLocal: true, pushCloud: true }
    );

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
      return { success: false, error: 'Apenas Diretores e Instrutores autorizados podem criar novos módulos.' };
    }
    if (!data.title.trim()) {
      return { success: false, error: 'O título do módulo é obrigatório.' };
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

    logAction('training', 'CRIACAO_CLASSE', `Novo módulo criado: ${newClass.title} (${newClass.code}) com ${reqs.length} requisitos`, newClass.id, newClass.title);
    return { success: true, id: newClass.id };
  };

  const updateTrainingClass = (
    id: string,
    titleOrData: string | { title: string; code?: string; minimumAge?: number; requirements?: string[] },
    minimumAge?: number,
    requirementsCount?: number
  ) => {
    if (!can('training', 'EDIT') && !can('training', 'ADMIN') && currentUser.role !== 'diretor' && currentUser.role !== 'admin_tecnico' && currentUser.role !== 'instrutor') {
      return { success: false, error: 'Não possui permissão para editar módulos.' };
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

    logAction('training', 'ATUALIZACAO_CLASSE', `Módulo atualizado: ${title}`, id, title);
    return { success: true };
  };

  const createSpecialtyHonor = (data: {
    title: string;
    code?: string;
    category: SpecialtyHonor['category'];
    requirements?: string[];
  }) => {
    if (!can('training', 'CREATE') && !can('training', 'ADMIN') && currentUser.role !== 'diretor' && currentUser.role !== 'instrutor' && currentUser.role !== 'admin_tecnico') {
      return { success: false, error: 'Apenas Diretores e Instrutores autorizados podem criar novas medalhas.' };
    }
    if (!data.title.trim()) {
      return { success: false, error: 'O título da medalha é obrigatório.' };
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

    logAction('training', 'CRIACAO_ESPECIALIDADE', `Nova medalha criada: ${newSpecialty.title} (${newSpecialty.category}) com ${reqs.length} requisitos`, newSpecialty.id, newSpecialty.title);
    return { success: true, id: newSpecialty.id };
  };

  const updateSpecialtyHonor = (
    id: string,
    titleOrData: string | { title: string; code?: string; category?: SpecialtyHonor['category']; requirements?: string[] },
    category?: string,
    requirementsCount?: number
  ) => {
    if (!can('training', 'EDIT') && !can('training', 'ADMIN') && currentUser.role !== 'diretor' && currentUser.role !== 'admin_tecnico' && currentUser.role !== 'instrutor') {
      return { success: false, error: 'Não possui permissão para editar medalhas.' };
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

    logAction('training', 'ATUALIZACAO_ESPECIALIDADE', `Formação/Medalha atualizada: ${title}`, id, title);
    return { success: true };
  };

  const deleteTrainingClass = (id: string) => {
    if (!can('training', 'ADMIN') && !can('training', 'EDIT') && !['diretor', 'admin_tecnico', 'instrutor', 'secretario'].includes(currentUser.role)) {
      return { success: false, error: 'Apenas Diretores, Secretários e Instrutores têm autorização para remover módulos.' };
    }
    setState((prev) => ({
      ...prev,
      classes: prev.classes.filter((c) => c.id !== id),
      trainingProgress: prev.trainingProgress.filter((p) => p.targetId !== id),
    }));
    logAction('training', 'REMOCAO_CLASSE', `Módulo removido: ${id}`, id);
    return { success: true };
  };

  const deleteSpecialtyHonor = (id: string) => {
    if (!can('training', 'ADMIN') && !can('training', 'EDIT') && !['diretor', 'admin_tecnico', 'instrutor', 'secretario'].includes(currentUser.role)) {
      return { success: false, error: 'Apenas Diretores, Secretários e Instrutores têm autorização para remover medalhas.' };
    }
    setState((prev) => ({
      ...prev,
      specialties: prev.specialties.filter((s) => s.id !== id),
      trainingProgress: prev.trainingProgress.filter((p) => p.targetId !== id),
    }));
    logAction('training', 'REMOCAO_ESPECIALIDADE', `Medalha removida: ${id}`, id);
    return { success: true };
  };

  const addUnit = (name: string, category: MemberCategory | 'mista', leaderUserId?: string) => {
    if (
      currentUser.role !== 'diretor' &&
      currentUser.role !== 'diretor_associado' &&
      currentUser.role !== 'secretario' &&
      currentUser.role !== 'admin_tecnico' &&
      !can('associate_director', 'EDIT')
    ) {
      return { success: false, error: 'Apenas a Direção e o Secretário podem adicionar novas equipas.' };
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, error: 'Informe o nome da equipa ou unidade.' };
    }
    const duplicateUnit = state.settings.units.find(
      (u) => u.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicateUnit) {
      return { success: false, error: `Já existe uma equipa registada com o nome "${duplicateUnit.name}".` };
    }

    const now = getNowISOString();
    const newUnit = {
      id: `UNT-${Date.now().toString().slice(-4)}`,
      name: trimmedName,
      category,
      leaderUserId: leaderUserId || undefined,
      active: true,
    };
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'settings',
      'CRIACAO_UNIDADE',
      `Equipa/Unidade criada: ${trimmedName}`,
      newUnit.id,
      trimmedName
    );
    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      settings: {
        ...state.settings,
        units: [...state.settings.units, newUnit],
      },
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);
    return { success: true };
  };

  const updateUnit = (id: string, name: string, category: MemberCategory | 'mista', leaderUserId?: string) => {
    if (
      currentUser.role !== 'diretor' &&
      currentUser.role !== 'diretor_associado' &&
      currentUser.role !== 'secretario' &&
      currentUser.role !== 'admin_tecnico' &&
      !can('associate_director', 'EDIT')
    ) {
      return { success: false, error: 'Apenas a Direção e o Secretário podem editar equipas.' };
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, error: 'Informe o nome da equipa ou unidade.' };
    }
    const existingUnit = state.settings.units.find((u) => u.id === id);
    if (!existingUnit) {
      return { success: false, error: 'Equipa não encontrada.' };
    }
    const duplicateUnit = state.settings.units.find(
      (u) => u.id !== id && u.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicateUnit) {
      return { success: false, error: `Já existe outra equipa registada com o nome "${duplicateUnit.name}".` };
    }

    const now = getNowISOString();
    const oldName = existingUnit.name;
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'settings',
      'ATUALIZACAO_UNIDADE',
      `Equipa/Unidade atualizada: ${trimmedName}`,
      id,
      trimmedName
    );
    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      settings: {
        ...state.settings,
        units: state.settings.units.map((u) =>
          u.id === id ? { ...u, name: trimmedName, category, leaderUserId: leaderUserId || undefined } : u
        ),
      },
      members:
        oldName && oldName !== trimmedName
          ? state.members.map((m) => (m.unitOrTeam === oldName ? { ...m, unitOrTeam: trimmedName, updatedAt: now } : m))
          : state.members,
      teamChatMessages:
        oldName && oldName !== trimmedName
          ? (state.teamChatMessages || []).map((msg) =>
              msg.unitId === id ? { ...msg, unitName: trimmedName } : msg
            )
          : state.teamChatMessages || [],
      teamTasks:
        oldName && oldName !== trimmedName
          ? (state.teamTasks || []).map((t) => (t.unitId === id ? { ...t } : t))
          : state.teamTasks || [],
      teamNotes:
        oldName && oldName !== trimmedName
          ? (state.teamNotes || []).map((n) => (n.unitId === id ? { ...n } : n))
          : state.teamNotes || [],
      teamAwards:
        oldName && oldName !== trimmedName
          ? (state.teamAwards || []).map((a) => (a.unitId === id ? { ...a } : a))
          : state.teamAwards || [],
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);
    return { success: true };
  };

  const deleteUnit = (id: string) => {
    if (
      currentUser.role !== 'diretor' &&
      currentUser.role !== 'diretor_associado' &&
      currentUser.role !== 'secretario' &&
      currentUser.role !== 'admin_tecnico' &&
      !can('associate_director', 'EDIT')
    ) {
      return { success: false, error: 'Apenas a Direção e o Secretário podem remover equipas.' };
    }
    const target = state.settings.units.find((u) => u.id === id);
    if (!target) {
      return { success: false, error: 'Equipa não encontrada.' };
    }

    const now = getNowISOString();
    const unitName = target.name;
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'settings',
      'REMOCAO_UNIDADE',
      `Equipa/Unidade removida: ${unitName}`,
      id,
      unitName
    );
    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      settings: {
        ...state.settings,
        units: state.settings.units.filter((u) => u.id !== id),
      },
      members: unitName
        ? state.members.map((m) => (m.unitOrTeam === unitName ? { ...m, unitOrTeam: undefined, updatedAt: now } : m))
        : state.members,
      teamChatMessages: (state.teamChatMessages || []).filter((msg) => msg.unitId !== id),
      teamTasks: (state.teamTasks || []).filter((t) => t.unitId !== id),
      teamNotes: (state.teamNotes || []).filter((n) => n.unitId !== id),
      teamAwards: (state.teamAwards || []).filter((a) => a.unitId !== id),
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);
    return { success: true };
  };

  const assignMemberToUnit = (memberId: string, unitOrTeam?: string) => {
    const isAllowed =
      currentUser.role === 'secretario' ||
      currentUser.role === 'diretor' ||
      currentUser.role === 'diretor_associado' ||
      currentUser.role === 'admin_tecnico' ||
      can('members', 'EDIT') ||
      can('associate_director', 'EDIT');
    if (!isAllowed) {
      return { success: false, error: 'Apenas a Direção, Secretaria e Administração podem alocar membros em equipas.' };
    }
    const targetMember = state.members.find((m) => m.id === memberId);
    if (!targetMember) {
      return { success: false, error: 'Membro não encontrado.' };
    }
    if (isDirectionMember(targetMember, state.users) && unitOrTeam?.trim()) {
      return {
        success: false,
        error: 'Membros com cargo de Direção (Diretor, Diretor-associado ou Secretário) não fazem parte de equipas — na sua ficha consta automaticamente "Direção".',
      };
    }
    const now = getNowISOString();
    const trimmedTarget = unitOrTeam ? unitOrTeam.trim() : undefined;
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'members',
      'ALOCACAO_EQUIPA',
      `Membro ${targetMember.fullName} alocado à equipa: ${trimmedTarget || 'Nenhuma'}`,
      memberId,
      targetMember.fullName
    );
    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      members: state.members.map((m) =>
        m.id === memberId ? { ...m, unitOrTeam: trimmedTarget || undefined, updatedAt: now } : m
      ),
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);
    return { success: true };
  };

  const updateMemberCategory = (memberId: string, category: MemberCategory) => {
    const isAllowed =
      currentUser.role === 'admin_tecnico' ||
      currentUser.role === 'secretario' ||
      currentUser.role === 'diretor' ||
      currentUser.role === 'diretor_associado' ||
      can('members', 'EDIT') ||
      can('associate_director', 'EDIT');
    if (!isAllowed) {
      return { success: false, error: 'Apenas a Direção, Administrador e Secretário podem editar as categorias dos membros.' };
    }
    const targetMember = state.members.find((m) => m.id === memberId);
    if (!targetMember) {
      return { success: false, error: 'Membro não encontrado.' };
    }
    const now = getNowISOString();
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'members',
      'ALTERACAO_CATEGORIA',
      `Categoria do membro ${targetMember.fullName} alterada para: ${category}`,
      memberId,
      targetMember.fullName
    );
    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      members: state.members.map((m) => (m.id === memberId ? { ...m, category, updatedAt: now } : m)),
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);
    return { success: true };
  };

  const deleteMember = (id: string, directionAuthorized?: boolean, reason?: string) => {
    // 1. Verificação na grelha de permissões (members: DELETE ou members: ADMIN)
    // Contas vinculadas são eliminadas automaticamente sem necessidade de autorização prévia do Administrador Técnico (audit: ADMIN)
    const hasDeletePerm = can('members', 'DELETE') || can('members', 'ADMIN');
    if (!hasDeletePerm) {
      return { success: false, error: 'Sem permissão na grelha (members: DELETE ou members: ADMIN) para eliminar definitivamente membros.' };
    }
    const isDirectorOrAdmin = currentUser.role === 'diretor' || currentUser.role === 'admin_tecnico';
    if (!isDirectorOrAdmin && !hasDeletePerm && !directionAuthorized) {
      return { success: false, error: 'A eliminação definitiva exige permissão na grelha ou autorização da Direção do Clube.' };
    }

    const now = getNowISOString();
    const target = state.members.find(m => m.id === id);
    if (!target) return { success: false, error: 'Membro não encontrado.' };
    const memberName = target.fullName;
    const cleanReason = reason?.trim();

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
    // E elimina automaticamente qualquer conta de utilizador vinculada sem exigir autorização prévia do administrador
    const { updatedUsers, removedUsers } = removeLinkedAccountsForMember(state.users, target);
    if (removedUsers.length > 0) {
      removedUsers.forEach((u) => {
        removePushSubscription(u.id).catch(() => {});
      });
    }

    const auditEntries: AuditLogEntry[] = [
      createAuditLog(
        currentUser.id,
        currentUser.name,
        currentUser.role,
        'members',
        'ELIMINACAO_MEMBRO',
        `Membro eliminado definitivamente por ${currentUser.name} (${ROLE_LABELS[currentUser.role]?.label || currentUser.role}): ${memberName}`,
        id,
        memberName,
        cleanReason
      ),
      ...removedUsers.map((linkedUser) =>
        createAuditLog(
          currentUser.id,
          currentUser.name,
          currentUser.role,
          'audit',
          'ELIMINACAO_CONTA_VINCULADA',
          `Conta vinculada eliminada automaticamente (${linkedUser.email}) com a eliminação do membro ${memberName}, sem necessidade de autorização prévia do administrador.`,
          linkedUser.id,
          linkedUser.email,
          cleanReason
        )
      ),
    ];

    const { updatedEnrollmentRequests, removedRequests } = removeEnrollmentRequestsForDeletedMember(
      state.enrollmentRequests,
      target
    );

    if (removedRequests.length > 0 && auditEntries[0]) {
      auditEntries[0] = {
        ...auditEntries[0],
        details: `${auditEntries[0].details} Ficha(s) de inscrição associada(s) também eliminada(s) (${removedRequests.map((r) => r.protocolNumber).join(', ')}).`,
      };
    }

    const removedReqIds = new Set(removedRequests.map((r) => r.id));
    const updatedNotifications =
      removedReqIds.size > 0
        ? (state.notifications || []).filter((n) => !n.targetId || !removedReqIds.has(n.targetId))
        : state.notifications || [];

    const newState = {
      ...state,
      members: state.members.filter(m => m.id !== id),
      users: updatedUsers,
      deletionRequests: updatedRequests,
      enrollmentRequests: updatedEnrollmentRequests,
      notifications: updatedNotifications,
      auditLogs: [...auditEntries, ...state.auditLogs],
      updatedAt: now,
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);
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

    const now = getNowISOString();
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
      issuedByRole: currentUser.role,
      issuedAt: now,
      contentData: content,
      isCancelled: false,
    };

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'documents',
      'EMISSAO_DOCUMENTO',
      `Emissão de documento ${docNumber}: ${title}`,
      docNumber,
      title
    );

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      documents: [newDoc, ...state.documents],
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);
    return { success: true, docNumber };
  };

  const cancelOfficialDoc = (id: string, reason: string) => {
    if (!can('documents', 'ARCHIVE')) {
      return { success: false, error: 'Sem autorização para anular documentos oficiais.' };
    }
    if (!reason || reason.trim().length < 5) {
      return { success: false, error: 'Obrigatório especificar o motivo da anulação.' };
    }

    const targetDoc = state.documents.find((d) => d.id === id);
    if (!targetDoc) {
      return { success: false, error: 'Documento oficial não encontrado.' };
    }
    if (targetDoc.isCancelled) {
      return { success: false, error: 'Este documento já se encontra anulado.' };
    }

    const now = getNowISOString();
    const cleanReason = reason.trim();
    const updatedDocuments = state.documents.map((d) =>
      d.id === id
        ? {
            ...d,
            isCancelled: true,
            cancellationReason: cleanReason,
            cancelledAt: now,
          }
        : d
    );

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'documents',
      'ANULACAO_DOCUMENTO',
      `Documento ${targetDoc.documentNumber} anulado: ${cleanReason}`,
      id,
      targetDoc.documentNumber,
      cleanReason
    );

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      documents: updatedDocuments,
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);
    return { success: true };
  };

  // --- PORTAL DO MEMBRO & PEDIDOS ---
  // --- CIRCULARES ---
  const createCircular = (data: Omit<Circular, 'id' | 'publishedAt' | 'publishedByUserId' | 'publishedByName' | 'readBy'>) => {
    if (
      !can('requests', 'CREATE') &&
      currentUser.role !== 'diretor' &&
      currentUser.role !== 'diretor_associado' &&
      currentUser.role !== 'admin_tecnico' &&
      currentUser.role !== 'secretario'
    ) {
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
    const linked = getStrictLinkedMember(currentUser, state.members);
    if (!linked) return;
    const memberId = linked.id;

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

    const curState = stateRef.current;
    const memberId = currentUser.linkedMemberId || currentUser.id;
    const member = curState.members.find((m) => m.id === memberId);
    const memberName = member ? member.fullName : currentUser.name;

    let seq = (curState.chaplaincyRequests || []).length + 1;
    let newId = `CHAP-${curState.settings.currentYear}-${seq.toString().padStart(3, '0')}`;
    while ((curState.chaplaincyRequests || []).some((r) => r.id === newId)) {
      seq++;
      newId = `CHAP-${curState.settings.currentYear}-${seq.toString().padStart(3, '0')}`;
    }

    const now = getNowISOString();
    const newReq: ChaplaincyRequest = {
      id: newId,
      memberId,
      memberName,
      category: data.category,
      subject: data.subject.trim(),
      message: data.message.trim(),
      confidential: data.confidential,
      status: 'pendente',
      createdAt: now,
    };

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        chaplaincyRequests: [newReq, ...(prev.chaplaincyRequests || [])],
      }),
      { saveLocal: true, pushCloud: true }
    );

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

    const curState = stateRef.current;
    const targetReq = (curState.chaplaincyRequests || []).find((r) => r.id === requestId);
    if (!targetReq) {
      return { success: false, error: 'Pedido de capelania não encontrado.' };
    }

    const now = getNowISOString();
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        chaplaincyRequests: (prev.chaplaincyRequests || []).map((r) =>
          r.id === requestId
            ? {
                ...r,
                status,
                responseNotes: responseNotes.trim(),
                respondedBy: `${currentUser.name} (${ROLE_LABELS[currentUser.role]?.label || currentUser.role})`,
                respondedAt: now,
              }
            : r
        ),
      }),
      { saveLocal: true, pushCloud: true }
    );

    addNotification({
      title: `Pedido de Capelania Respondido`,
      message: `O Capelão / Diretor respondeu ao seu pedido confidencial de capelania: "${targetReq.subject || requestId}"`,
      category: 'request',
      targetModule: 'chaplaincy',
      recipientUserId: targetReq.memberId,
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
    const linkedMember = getStrictLinkedMember(currentUser, state.members);
    if (!linkedMember) {
      return { success: false, error: 'Apenas utilizadores vinculados a um membro podem enviar sugestões pelo Portal do Membro.' };
    }
    if (!data.subject.trim() || !data.content.trim()) {
      return { success: false, error: 'O assunto e o conteúdo da sugestão são obrigatórios.' };
    }

    const memberId = linkedMember.id;
    const memberName = linkedMember.fullName || currentUser.name;
    const memberManualNumber = linkedMember.manualNumber;

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

  const submitPortalRequest = (data: {
    category: MemberPortalRequest['category'];
    subject: string;
    details: string;
    proposedChanges?: MemberPortalRequest['proposedChanges'];
    attachmentFileName?: string;
    attachmentBase64?: string;
  }) => {
    if (!can('member_portal', 'VIEW')) {
      return { success: false, error: 'Sem permissão para submeter pedidos no Portal do Membro.' };
    }

    const curState = stateRef.current;
    const linkedMember = getStrictLinkedMember(currentUser, curState.members);
    if (!linkedMember) {
      return {
        success: false,
        error: 'Apenas utilizadores vinculados a um membro oficial podem submeter pedidos à Secretaria.',
      };
    }

    const subject = (data.subject || '').trim();
    const details = (data.details || '').trim();
    if (!subject) {
      return { success: false, error: 'Indique o assunto do pedido de atualização.' };
    }
    if (!details && !data.proposedChanges) {
      return { success: false, error: 'Descreva os dados a atualizar ou preencha pelo menos um campo.' };
    }

    const cleanedChanges: MemberPortalRequest['proposedChanges'] | undefined = data.proposedChanges
      ? Object.entries(data.proposedChanges).reduce<NonNullable<MemberPortalRequest['proposedChanges']>>(
          (acc, [k, v]) => {
            if (typeof v === 'string' && v.trim()) {
              (acc as Record<string, string>)[k] = v.trim();
            }
            return acc;
          },
          {}
        )
      : undefined;

    const hasCleanedChanges = Boolean(cleanedChanges && Object.keys(cleanedChanges).length > 0);
    if (!details && !hasCleanedChanges) {
      return { success: false, error: 'Indique os novos valores ou detalhes para o pedido.' };
    }

    const now = getNowISOString();
    const existingIds = (curState.requests || []).map((r) => r.id);
    const reqId = generateNextDocumentNumber('REQ', curState.settings.currentYear, existingIds);
    const assignedRole: RoleType = data.category === 'tesouraria' ? 'tesoureiro' : 'secretario';

    const newRequest: MemberPortalRequest = {
      id: reqId,
      memberId: linkedMember.id,
      memberName: linkedMember.fullName,
      category: data.category,
      subject,
      details: details || 'Solicitação de atualização cadastral conforme campos preenchidos.',
      proofAttachmentName: data.attachmentFileName,
      attachmentFileName: data.attachmentFileName,
      attachmentBase64: data.attachmentBase64,
      proposedChanges: hasCleanedChanges ? cleanedChanges : undefined,
      status: 'pendente',
      assignedRole,
      history: [
        {
          status: 'pendente',
          updatedBy: linkedMember.fullName,
          updatedAt: now,
          note: 'Pedido submetido pelo membro no Portal do Membro.',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        requests: [newRequest, ...(prev.requests || [])],
      }),
      { saveLocal: true, pushCloud: true }
    );

    addNotification({
      title: 'Novo Pedido de Atualização Cadastral',
      message: `${linkedMember.fullName} enviou um pedido (${subject}) para análise da Secretaria.`,
      category: data.category === 'tesouraria' ? 'financial' : 'request',
      targetModule: data.category === 'tesouraria' ? 'treasury' : 'members',
      priority: 'normal',
    });

    logAction(
      'member_portal',
      'PEDIDO_ATUALIZACAO_CADASTRAL',
      `Pedido ${reqId} submetido por ${linkedMember.fullName}: ${subject}`,
      reqId,
      linkedMember.fullName
    );

    return { success: true, request: newRequest };
  };

  const respondToRequest = (
    requestId: string,
    status: MemberPortalRequest['status'],
    responseNotes: string,
    options?: { applyChanges?: boolean }
  ) => {
    const curState = stateRef.current;
    const req = (curState.requests || []).find((r) => r.id === requestId);
    if (!req) {
      return { success: false, error: 'Pedido não encontrado.' };
    }

    const canHandleSecretary =
      can('members', 'EDIT') ||
      currentUser.role === 'secretario' ||
      currentUser.role === 'diretor' ||
      currentUser.role === 'admin_tecnico';
    const canHandleTreasury =
      req.category === 'tesouraria' &&
      (can('treasury', 'APPROVE') || currentUser.role === 'tesoureiro');

    if (!canHandleSecretary && !canHandleTreasury) {
      return { success: false, error: 'Sem permissão para analisar ou responder a este pedido.' };
    }

    const cleanNotes = (responseNotes || '').trim();
    if (status === 'rejeitado' && !cleanNotes) {
      return { success: false, error: 'Indique o motivo da rejeição para conhecimento do membro.' };
    }

    const now = getNowISOString();
    const shouldApplyChanges =
      Boolean(options?.applyChanges) &&
      (status === 'aprovado' || status === 'concluido') &&
      Boolean(req.proposedChanges && Object.keys(req.proposedChanges).length > 0);

    commitState(
      (prev) => {
        const nextRequests = (prev.requests || []).map((item) =>
          item.id === requestId
            ? {
                ...item,
                status,
                assignedUserId: currentUser.id,
                assignedUserName: currentUser.name,
                responseNotes: cleanNotes || item.responseNotes,
                history: [
                  ...(item.history || []),
                  {
                    status,
                    updatedBy: currentUser.name,
                    updatedAt: now,
                    note: shouldApplyChanges
                      ? `${cleanNotes || 'Dados aplicados à ficha.'} (Ficha do membro atualizada)`
                      : cleanNotes || undefined,
                  },
                ],
                updatedAt: now,
              }
            : item
        );

        let nextMembers = prev.members;
        let nextUsers = prev.users;

        if (shouldApplyChanges && req.proposedChanges) {
          const changes = req.proposedChanges;
          nextMembers = prev.members.map((m) => {
            if (m.id !== req.memberId) return m;
            return {
              ...m,
              phone: changes.phone || m.phone,
              address: changes.address || m.address,
              email: changes.email !== undefined ? changes.email : m.email,
              guardianName: changes.guardianName !== undefined ? changes.guardianName : m.guardianName,
              guardianPhone: changes.guardianPhone !== undefined ? changes.guardianPhone : m.guardianPhone,
              identityCardNumber: changes.identityCardNumber || m.identityCardNumber,
              identityCardExpiryDate:
                changes.identityCardExpiryDate !== undefined
                  ? changes.identityCardExpiryDate
                  : m.identityCardExpiryDate,
              emergencyContact: {
                ...m.emergencyContact,
                name: changes.emergencyContactName || m.emergencyContact?.name || '',
                phone: changes.emergencyContactPhone || m.emergencyContact?.phone || '',
              },
              updatedAt: now,
            };
          });
          const previousMember = prev.members.find((m) => m.id === req.memberId);
          const updatedMember = nextMembers.find((m) => m.id === req.memberId);
          if (updatedMember) {
            nextUsers = syncMemberChangesToUsers(updatedMember, prev.users, previousMember);
          }
        }

        return {
          ...prev,
          updatedAt: now,
          requests: nextRequests,
          members: nextMembers,
          users: nextUsers,
        };
      },
      { saveLocal: true, pushCloud: true }
    );

    const targetMember = curState.members.find((m) => m.id === req.memberId);
    const linkedUser = curState.users.find(
      (u) =>
        u.linkedMemberId === req.memberId ||
        (targetMember?.manualNumber && u.manualNumber === targetMember.manualNumber)
    );
    if (linkedUser) {
      const statusLabel =
        status === 'concluido'
          ? 'Concluído'
          : status === 'aprovado'
          ? 'Aprovado'
          : status === 'rejeitado'
          ? 'Rejeitado'
          : 'Em Análise';
      addNotification({
        title: `Pedido Cadastral ${statusLabel}`,
        message: `O seu pedido "${req.subject}" (${req.id}) foi atualizado por ${currentUser.name}${
          cleanNotes ? `: ${cleanNotes}` : '.'
        }`,
        category: 'request',
        targetModule: 'member_portal',
        recipientUserId: linkedUser.id,
        targetMemberId: req.memberId,
        isConfidential: true,
        priority: 'normal',
      });
    }

    logAction(
      'members',
      'RESPOSTA_PEDIDO_CADASTRAL',
      `Pedido ${req.id} (${req.memberName}) marcado como ${status}${shouldApplyChanges ? ' com aplicação automática na ficha' : ''}`,
      req.id,
      req.memberName
    );

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
    const linkedMember = getStrictLinkedMember(currentUser, state.members);
    if (!linkedMember) {
      return { success: false, error: 'Apenas utilizadores vinculados a um membro podem submeter comprovativos no Portal do Membro.' };
    }
    const memberId = linkedMember.id;
    const memberName = linkedMember.fullName || currentUser.name;

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
      accountId: selectedAccount
        ? selectedAccount.id
        : (state.accounts.find((a) => a.active)?.id || state.accounts[0]?.id || ''),
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
    if (proof.status === 'confirmado' || proof.isVerifiedByTreasurer) {
      return { success: false, error: 'Este comprovativo já foi validado anteriormente.' };
    }
    if (proof.status === 'rejeitado') {
      return { success: false, error: 'Este comprovativo já foi rejeitado.' };
    }

    const now = getNowISOString();

    if (approve) {
      // Cria recibo automático para o membro
      const currentYear = state.settings.currentYear;
      const existingRecNumbers = state.receipts.map((r) => r.receiptNumber);
      const receiptNumber = generateNextDocumentNumber('REC', currentYear, existingRecNumbers);

      const targetAccount =
        state.accounts.find((a) => a.id === proof.accountId) ||
        state.accounts.find((a) => a.active) ||
        state.accounts[0];
      const targetAccountId = targetAccount?.id || proof.accountId || '';

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
        treasurerRole: currentUser.role,
        paidAt: now,
        status: 'confirmado',
        notes: `Comprovativo validado por ${currentUser.name} (Conta: ${targetAccount?.name || proof.accountName || 'Geral'})`,
        accountId: targetAccount?.id || targetAccountId,
        accountName: targetAccount?.name || proof.accountName,
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
        const resolvedId = targetAccount?.id || targetAccountId;
        const updatedAccounts = prev.accounts.map((a) => {
          if (a.id === resolvedId) {
            return { ...a, currentBalanceInCents: a.currentBalanceInCents + proof.amountInCents };
          }
          return a;
        });

        return {
          ...prev,
          updatedAt: now,
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

    const isInstitutional = isInstitutionalAccountRecord({
      id: 'NEW',
      email: user.email,
      name: user.name,
      role: user.role,
    });
    const linkedMemberId = isInstitutional ? undefined : user.linkedMemberId;

    const nowISO = getNowISOString();
    const newId = `USR-${Date.now().toString().slice(-4)}`;
    const draftUser: UserAccount = {
      ...user,
      id: newId,
      linkedMemberId,
      createdAt: nowISO,
    };

    const { syncedUser: newUser, updatedMembers } = syncUserWithLinkedMember(
      draftUser,
      state.members,
      nowISO,
      {
        name: user.name,
        email: user.email,
        phone: user.phone,
        manualNumber: user.manualNumber,
        linkedMemberChanged: Boolean(linkedMemberId && (!user.name || !user.email)),
      }
    );

    const updatedUsers = [...state.users, newUser];
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'audit',
      'CRIACAO_CONTA',
      `Conta criada para ${newUser.name} (${ROLE_LABELS[newUser.role]?.label || newUser.role})`,
      newId,
      newUser.email
    );
    const newState: ClubDatabaseState = {
      ...state,
      users: updatedUsers,
      members: updatedMembers,
      auditLogs: [auditEntry, ...state.auditLogs],
      updatedAt: nowISO,
    };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    return { success: true };
  };

  const updateUserAccount = (userId: string, data: Partial<UserAccount> & { manualNumber?: string }, newPassword?: string) => {
    if (!can('audit', 'ADMIN') && currentUser.role !== 'admin_tecnico') {
      return { success: false, error: 'Apenas o Administrador Técnico tem autorização para atualizar dados de login dos utilizadores.' };
    }
    const targetUser = state.users.find(u => u.id === userId);
    if (!targetUser) return { success: false, error: 'Utilizador não encontrado.' };

    const effectiveRole = data.role || targetUser.role;
    const isInstitutional = isInstitutionalAccountRecord({
      id: targetUser.id,
      email: data.email ?? targetUser.email,
      name: data.name ?? targetUser.name,
      role: effectiveRole,
    });

    if (isInstitutional && data.linkedMemberId && data.linkedMemberId.trim() !== '') {
      return { success: false, error: 'A Conta Institucional é estritamente independente e não pode ser vinculada a nenhum membro.' };
    }

    const effectiveLinkedMemberId = isInstitutional 
      ? undefined 
      : (data.linkedMemberId === '' ? undefined : (data.linkedMemberId !== undefined ? data.linkedMemberId : targetUser.linkedMemberId));

    if (data.email && data.email.trim()) {
      const cleanEmail = data.email.trim().toLowerCase();
      const emailTaken = state.users.some(u => u.id !== userId && u.email.trim().toLowerCase() === cleanEmail);
      if (emailTaken) {
        return { success: false, error: 'Já existe outra conta de acesso com este endereço de e-mail.' };
      }
    }

    if (effectiveLinkedMemberId && data.manualNumber !== undefined && data.manualNumber.trim() !== '') {
      if (!isMemberNumberUnique(data.manualNumber.trim(), state.members, effectiveLinkedMemberId)) {
        return { success: false, error: `O Nº de Membro "${data.manualNumber.trim()}" já está atribuído a outro membro.` };
      }
    }

    const nowISO = getNowISOString();
    const isChangingPassword = newPassword !== undefined && newPassword.trim() !== '';
    const linkedMemberChanged = effectiveLinkedMemberId !== targetUser.linkedMemberId;

    const draftUser: UserAccount = {
      ...targetUser,
      ...data,
      linkedMemberId: effectiveLinkedMemberId,
      ...(isChangingPassword
        ? {
            password: newPassword!.trim(),
            passwordResetRequested: false,
            lastAdminPasswordResetAt: nowISO,
          }
        : {}),
    };
    if (isChangingPassword) {
      delete draftUser.lastPasswordChangedAt;
    }

    const { syncedUser, updatedMembers } = syncUserWithLinkedMember(
      draftUser,
      state.members,
      nowISO,
      {
        name: data.name,
        email: data.email,
        phone: data.phone,
        manualNumber: data.manualNumber,
        linkedMemberChanged,
      }
    );

    const updatedUsers = state.users.map(u => (u.id === userId ? syncedUser : u));

    const updatedCurrentUser =
      state.currentUser.id === userId ? syncedUser : state.currentUser;

    if (state.currentUser.id === userId) {
      syncStoredSessionUser(syncedUser);
    }

    const newState: ClubDatabaseState = {
      ...state,
      users: updatedUsers,
      members: updatedMembers,
      currentUser: updatedCurrentUser,
      updatedAt: nowISO,
    };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    logAction(
      'audit',
      isChangingPassword ? 'REDEFINICAO_SENHA' : 'ATUALIZACAO_CONTA_LOGIN',
      isChangingPassword
        ? `Palavra-passe atualizada pelo Administrador para ${syncedUser.name}; redefinição direta no Portal do Membro desbloqueada para o utilizador`
        : `Dados de login atualizados e sincronizados automaticamente para ${syncedUser.name}`,
      userId,
      syncedUser.email
    );
    return { success: true };
  };

  const toggleUserActive = (userId: string) => {
    if (!can('audit', 'ADMIN')) {
      return { success: false, error: 'Apenas o Administrador Técnico pode alterar o estado de contas.' };
    }
    const targetUser = state.users.find((u) => u.id === userId);
    if (!targetUser) {
      return { success: false, error: 'Conta de utilizador não encontrada.' };
    }
    const linkedMember = resolveLinkedMember(targetUser, state.members);
    if (!targetUser.active && linkedMember?.status === 'arquivado') {
      return {
        success: false,
        error: `Não é possível reativar a conta enquanto a ficha de ${linkedMember.fullName} estiver arquivada. Desarquive primeiro a ficha do membro.`,
      };
    }

    const nowISO = getNowISOString();
    const updated = state.users.map((u) => {
      if (u.id === userId) {
        const nextActive = !u.active;
        const { deactivatedByArchive: _clearedArchiveFlag, ...rest } = u;
        return {
          ...rest,
          active: nextActive,
          ...(nextActive && isPendingMemberAccountConfirmation(u)
            ? {
                accountApprovalStatus: 'aprovada' as const,
                accountApprovedByUserId: currentUser.id,
                accountApprovedByName: currentUser.name,
                accountApprovedAt: nowISO,
              }
            : {}),
        };
      }
      return u;
    });
    const newState = { ...state, users: updated, updatedAt: nowISO };
    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);
    logAction('audit', 'ALTERACAO_ESTADO_CONTA', `Estado da conta alternado para ${!targetUser.active ? 'Ativa' : 'Desativada'}`, userId, targetUser.email);
    return { success: true };
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
    removePushSubscription(userId).catch(() => {});

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

  const createSelfServiceMemberAccount = async (
    memberId: string,
    password: string,
    confirmPassword: string
  ): Promise<{ success: boolean; account?: UserAccount; error?: string }> => {
    let baseState = state;

    if (db && (db as any).app) {
      try {
        let snap: any = null;
        try {
          snap = await getDocFromServer(doc(db, 'club_data', 'main_state'));
        } catch {
          snap = await getDoc(doc(db, 'club_data', 'main_state')).catch(() => null);
        }
        if (snap && snap.exists()) {
          const cloudData = snap.data() as ClubDatabaseState;
          if (cloudData) {
            baseState = normalizeCloudState(cloudData, state);
          }
        }
      } catch {
        // Segue com baseState local caso esteja offline
      }
    }

    const member = baseState.members.find((m) => m.id === memberId);
    const linkedRequest = (baseState.enrollmentRequests || []).find(
      (r) =>
        r.createdMemberId === memberId ||
        (member?.enrollmentProtocol && r.protocolNumber === member.enrollmentProtocol)
    );

    const nowISO = getNowISOString();
    const built = buildSelfServiceMemberAccount({
      member: member as Member,
      password,
      confirmPassword,
      existingUsers: baseState.users,
      request: linkedRequest,
      nowISO,
    });

    if (!built.success || !built.account) {
      return { success: false, error: built.error || 'Não foi possível criar a conta de login.' };
    }

    const activeMatrix = baseState.settings.permissionsMatrix || ROLE_PERMISSIONS_MATRIX;
    const approverRoles = (Object.keys(ROLE_LABELS) as RoleType[]).filter((r) =>
      hasApproveMemberAccountPermission(r, activeMatrix)
    );

    const newNotification: ClubNotification = {
      id: `NOTIF-ACC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: 'Nova Conta de Login Aguarda Confirmação',
      message: `${built.account.name} (Matrícula: ${built.account.manualNumber}) criou as suas credenciais após validação da inscrição e aguarda confirmação do Diretor.`,
      timestamp: nowISO,
      read: false,
      category: 'system',
      targetModule: 'members',
      targetId: built.account.id,
      recipientRoles: approverRoles.length > 0 ? approverRoles : ['diretor', 'admin_tecnico'],
      priority: 'alta',
    };

    const auditEntry = createAuditLog(
      built.account.id,
      built.account.name,
      'membro',
      'audit',
      'CRIACAO_CONTA_AUTOSERVICO',
      `Membro ${built.account.name} (Matrícula: ${built.account.manualNumber}, E-mail: ${built.account.email}) criou credenciais de login vinculadas automaticamente à ficha ${member!.id} (aguarda confirmação do Diretor).`,
      built.account.id,
      built.account.email
    );

    const newState: ClubDatabaseState = {
      ...baseState,
      users: [...baseState.users, built.account],
      notifications: [newNotification, ...(baseState.notifications || [])],
      auditLogs: [auditEntry, ...(baseState.auditLogs || [])],
      updatedAt: nowISO,
    };

    setState(newState);
    saveStateToStorage(newState);
    await pushToFirestore(newState);

    return { success: true, account: built.account };
  };

  const approvePendingMemberAccount = (
    userId: string
  ): { success: boolean; account?: UserAccount; error?: string } => {
    const nowISO = getNowISOString();
    const res = confirmPendingMemberAccountService({
      userId,
      users: state.users,
      members: state.members,
      actor: currentUser,
      permissionsMatrix: state.settings.permissionsMatrix,
      nowISO,
    });

    if (!res.success || !res.confirmedUser || !res.updatedUsers) {
      return { success: false, error: res.error || 'Erro ao confirmar conta de login.' };
    }

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'audit',
      'CONFIRMACAO_CONTA_MEMBRO',
      `Conta de login de ${res.confirmedUser.name} (Matrícula: ${res.confirmedUser.manualNumber || 'S/N'} · E-mail: ${res.confirmedUser.email}) confirmada e ativada por ${currentUser.name}.`,
      res.confirmedUser.id,
      res.confirmedUser.email
    );

    const memberNotification: ClubNotification = {
      id: `NOTIF-ACC-OK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: 'Conta de Login Confirmada e Ativa',
      message: `A sua conta de login foi confirmada pelo Diretor. Já pode iniciar sessão com o seu e-mail (${res.confirmedUser.email}) ou Nº de Matrícula (${res.confirmedUser.manualNumber || 'S/N'}).`,
      timestamp: nowISO,
      read: false,
      category: 'member',
      targetModule: 'member_portal',
      recipientUserId: res.confirmedUser.linkedMemberId || res.confirmedUser.id,
      isConfidential: true,
      priority: 'alta',
    };

    const newState: ClubDatabaseState = {
      ...state,
      users: res.updatedUsers,
      notifications: [memberNotification, ...(state.notifications || [])],
      auditLogs: [auditEntry, ...state.auditLogs],
      updatedAt: nowISO,
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

    return { success: true, account: res.confirmedUser };
  };

  const rejectPendingMemberAccount = (
    userId: string,
    reason?: string
  ): { success: boolean; error?: string } => {
    const nowISO = getNowISOString();
    const res = rejectPendingMemberAccountService({
      userId,
      users: state.users,
      actor: currentUser,
      permissionsMatrix: state.settings.permissionsMatrix,
    });

    if (!res.success || !res.rejectedUser || !res.updatedUsers) {
      return { success: false, error: res.error || 'Erro ao recusar conta de login.' };
    }

    const cleanReason = (reason || '').trim() || 'Pedido de ativação recusado pelo responsável autorizado.';
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'audit',
      'RECUSA_CONTA_MEMBRO',
      `Solicitação de conta self-service de ${res.rejectedUser.name} (${res.rejectedUser.email}) recusada e removida; a ficha do membro permanece sem conta vinculada.`,
      res.rejectedUser.id,
      res.rejectedUser.email,
      cleanReason
    );

    const newState: ClubDatabaseState = {
      ...state,
      users: res.updatedUsers,
      auditLogs: [auditEntry, ...state.auditLogs],
      updatedAt: nowISO,
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);

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

    const nowISO = getNowISOString();
    const updatedUsers = state.users.map(u => (u.id === userId ? { ...u, role: newRole } : u));
    const updatedTargetUser = updatedUsers.find(u => u.id === userId);
    const updatedMembers = isDirectionRole(newRole)
      ? state.members.map((m) =>
          isDirectionMember(m, updatedUsers) && m.unitOrTeam
            ? { ...m, unitOrTeam: undefined, updatedAt: nowISO }
            : m
        )
      : state.members;
    const updatedCurrentUser =
      state.currentUser.id === userId && updatedTargetUser ? updatedTargetUser : state.currentUser;

    if (state.currentUser.id === userId && updatedTargetUser) {
      syncStoredSessionUser(updatedTargetUser);
    }

    const roleLabel = ROLE_LABELS[newRole]?.label || newRole;
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'audit',
      'ALTERACAO_CARGO',
      `${currentUser.role === 'diretor' ? 'Diretor' : 'Administrador'} alterou o cargo de ${targetUser.name} para ${roleLabel}`,
      userId,
      targetUser.name,
      roleLabel
    );

    const newState: ClubDatabaseState = {
      ...state,
      users: updatedUsers,
      members: updatedMembers,
      currentUser: updatedCurrentUser,
      auditLogs: [auditEntry, ...state.auditLogs],
      updatedAt: nowISO,
    };

    setState(newState);
    saveStateToStorage(newState);
    pushToFirestore(newState);
    return { success: true };
  };

  const updateSettings = (newSettings: Partial<ClubSettings>) => {
    if (!can('settings', 'EDIT') && currentUser.role !== 'admin_tecnico' && currentUser.role !== 'diretor') return;
    const now = getNowISOString();
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'settings',
      'ATUALIZACAO_CONFIGURACAO',
      'Configurações do clube atualizadas'
    );
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        settings: { ...prev.settings, ...newSettings },
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );
  };

  const openNewFiscalYear = (year: number) => {
    if (!can('settings', 'ADMIN')) {
      return { success: false, error: 'Apenas o Administrador Técnico tem autorização para abrir um novo ano fiscal.' };
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return { success: false, error: 'Informe um ano fiscal válido (entre 2000 e 2100).' };
    }
    if (year === state.settings.currentYear) {
      return { success: false, error: `O ano fiscal ${year} já se encontra ativo.` };
    }

    const rolledState = openNewFiscalYearService(state, year);
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'settings',
      'ABERTURA_ANO_FISCAL',
      `Novo ano fiscal aberto: ${year}`,
      String(year),
      `Ano Fiscal ${year}`
    );

    const nextState: ClubDatabaseState = {
      ...rolledState,
      auditLogs: [auditEntry, ...rolledState.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);
    return { success: true };
  };

  const manualPasswordReset = (userId: string, newPassword: string) => {
    if (!can('audit', 'ADMIN')) {
      return { success: false, error: 'Apenas o Administrador Técnico pode redefinir palavras-passe.' };
    }
    const nowISO = getNowISOString();
    const applyAdminPasswordReset = (u: UserAccount): UserAccount => {
      const copy: UserAccount = {
        ...u,
        password: newPassword.trim(),
        passwordResetRequested: false,
        lastAdminPasswordResetAt: nowISO,
      };
      delete copy.lastPasswordChangedAt;
      return copy;
    };

    const updatedUsers = state.users.map(u => 
      u.id === userId ? applyAdminPasswordReset(u) : u
    );

    const updatedCurrentUser = state.currentUser.id === userId
      ? applyAdminPasswordReset(state.currentUser)
      : state.currentUser;

    if (state.currentUser.id === userId) {
      syncStoredSessionUser(updatedCurrentUser);
    }

    const newState: ClubDatabaseState = {
      ...state,
      users: updatedUsers,
      currentUser: updatedCurrentUser,
      updatedAt: nowISO,
    };

    setState(newState);
    pushToFirestore(newState);

    logAction('audit', 'REDEFINICAO_SENHA', `Palavra-passe redefinida pelo Administrador para o utilizador ${userId}; redefinição direta no Portal do Membro desbloqueada para o utilizador`, userId);
    return { success: true };
  };

  const requestPasswordReset = (identifier: string) => {
    const cleanId = identifier.trim();
    const cleanLower = cleanId.toLowerCase();
    let user = state.users.find(u => 
      u.email.toLowerCase() === cleanLower || 
      u.id.toLowerCase() === cleanLower ||
      u.linkedMemberId === cleanId ||
      (u.manualNumber && u.manualNumber.toLowerCase() === cleanLower)
    );
    
    if (!user) {
      const member = state.members.find(m => m.id === cleanId || m.manualNumber?.toLowerCase() === cleanLower || m.email?.toLowerCase() === cleanLower);
      if (member) {
        user = state.users.find(u => u.linkedMemberId === member.id);
      }
    }

    if (!user) {
      return { success: false, error: 'Utilizador não encontrado no sistema. Por favor contacte o Administrador.' };
    }

    const nowISO = getNowISOString();
    const updatedUsers = state.users.map(u => u.id === user!.id ? { ...u, passwordResetRequested: true } : u);
    const updatedCurrentUser = state.currentUser.id === user.id ? { ...state.currentUser, passwordResetRequested: true } : state.currentUser;
    const auditEntry = createAuditLog(
      user.id,
      user.name,
      user.role,
      'audit',
      'SOLICITACAO_REDEFINICAO_SENHA',
      `Solicitação de redefinição de senha para ${user.name}`,
      user.id,
      user.name
    );

    const newState: ClubDatabaseState = {
      ...state,
      users: updatedUsers,
      currentUser: updatedCurrentUser,
      auditLogs: [auditEntry, ...state.auditLogs],
      updatedAt: nowISO,
    };
    setState(newState);
    pushToFirestore(newState);
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
    delete updatedUser.lastAdminPasswordResetAt;

    syncStoredSessionUser(updatedUser);

    const newState: ClubDatabaseState = {
      ...state,
      users: state.users.map(u => u.id === user.id ? updatedUser : u),
      currentUser: updatedUser,
      updatedAt: nowISO,
    };

    setState(newState);
    pushToFirestore(newState);

    logAction('member_portal', 'REDEFINICAO_PROPRIA_SENHA', 'Utilizador redefiniu a sua própria senha com sucesso no Portal do Membro.', user.id, user.name);
    return { success: true };
  };

  const resetAllDemoData = () => {
    const fresh = resetToDemoData();
    setState(fresh);
    pushToFirestore(fresh);
  };

  const resetCleanSlate = () => {
    if (currentUser.role !== 'admin_tecnico' && !can('audit', 'ADMIN')) {
      return { success: false, error: 'Apenas o Administrador Técnico possui permissão para reiniciar o sistema do zero.' };
    }
    const clean = resetToCleanAdminOnlyState(currentUser);
    cloudConfirmedEmptyRef.current = true;
    hasLoadedFromCloudRef.current = true;
    setState(clean);
    pushToFirestore(clean, { allowEmptyWrite: true });
    return { success: true };
  };

  const cleanStorageSpace = async () => {
    if (currentUser.role !== 'admin_tecnico' && !can('audit', 'ADMIN')) {
      return { success: false, error: 'Apenas o Administrador Técnico possui permissão para executar a limpeza de armazenamento do sistema.' };
    }
    const cleaned = cleanSystemStorageSpace(state, currentUser);
    hasLoadedFromCloudRef.current = true;
    setState(cleaned);
    await pushToFirestore(cleaned, { allowEmptyWrite: true });
    return { success: true };
  };

  const createTreasuryAccount = (data: Omit<TreasuryAccount, 'id' | 'currentBalanceInCents' | 'active'>) => {
    if (!can('treasury', 'CREATE_ACCOUNT')) {
      return { success: false, error: 'Não possui permissão para criar novas contas financeiras.' };
    }
    const now = getNowISOString();
    const newAccount: TreasuryAccount = {
      ...data,
      id: `ACC-${Date.now()}`,
      currentBalanceInCents: data.initialBalanceInCents,
      active: true,
    };
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'treasury',
      'CRIACAO_CONTA',
      `Nova conta financeira criada: ${data.name}`,
      newAccount.id,
      data.name
    );
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        accounts: [...prev.accounts, newAccount],
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );
    return { success: true, id: newAccount.id };
  };

  const deleteTreasuryAccount = (id: string) => {
    if (!can('treasury', 'DELETE_ACCOUNT')) {
      return { success: false, error: 'Não possui permissão para remover contas financeiras.' };
    }
    const now = getNowISOString();
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'treasury',
      'REMOCAO_CONTA',
      `Conta financeira removida: ${id}`,
      id,
      ''
    );
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        accounts: prev.accounts.filter((a) => a.id !== id),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );
    return { success: true };
  };

  const createFeeDefinition = (data: Omit<FeeDefinition, 'id'>) => {
    if (!can('treasury', 'CREATE_RUBRIC')) {
      return { success: false, error: 'Não possui permissão para criar novas rubricas financeiras.' };
    }
    const now = getNowISOString();
    const newFee: FeeDefinition = {
      ...data,
      id: `FEE-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    };
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'treasury',
      'CRIACAO_RUBRICA',
      `Nova rubrica criada: ${data.title}`,
      newFee.id,
      data.title
    );
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        fees: [...prev.fees, newFee],
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );
    return { success: true, id: newFee.id };
  };

  const updateFeeDefinition = (id: string, data: Partial<FeeDefinition>) => {
    if (!can('treasury', 'CREATE_RUBRIC') && !can('treasury', 'EDIT') && !can('treasury', 'CONFIGURE_QUOTAS')) {
      return { success: false, error: 'Não possui permissão para atualizar rubricas financeiras.' };
    }
    const now = getNowISOString();
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'treasury',
      'ATUALIZACAO_RUBRICA',
      `Rubrica atualizada: ${id}`,
      id,
      data.title || ''
    );
    commitState(
      (prev) => {
        const activeQuotaId = resolveQuotaConfig(prev.settings, prev.fees).activeQuotaFeeId;
        const shouldSyncQuotaAmount =
          id === activeQuotaId && typeof data.amountInCents === 'number' && data.amountInCents >= 0;

        const updatedFees = prev.fees.map((f) => (f.id === id ? { ...f, ...data } : f));
        const nextSettings = shouldSyncQuotaAmount
          ? {
              ...prev.settings,
              quotaConfig: {
                ...resolveQuotaConfig(prev.settings, updatedFees),
                amountInCents: Math.round(data.amountInCents!),
                updatedAt: now,
                updatedByUserId: currentUser.id,
                updatedByName: currentUser.name,
              },
            }
          : prev.settings;

        return {
          ...prev,
          updatedAt: now,
          fees: updatedFees,
          settings: nextSettings,
          auditLogs: [auditEntry, ...prev.auditLogs],
        };
      },
      { saveLocal: true, pushCloud: true }
    );
    return { success: true };
  };

  const deleteFeeDefinition = (id: string) => {
    if (!can('treasury', 'DELETE_RUBRIC')) {
      return { success: false, error: 'Não possui permissão para remover rubricas financeiras.' };
    }
    const live = stateRef.current;
    const targetFee = live.fees.find((f) => f.id === id);
    if (targetFee && isFixedQuotaRubric(targetFee, live.settings, live.fees)) {
      return {
        success: false,
        error: 'A Quota Regular é gerida exclusivamente na aba Quotas e não pode ser removida nas Rubricas Financeiras.',
      };
    }
    const now = getNowISOString();
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'treasury',
      'REMOCAO_RUBRICA',
      `Rubrica removida: ${id}`,
      id,
      ''
    );
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        fees: prev.fees.filter((f) => f.id !== id),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );
    return { success: true };
  };

  const importBackupJson = (jsonData: string) => {
    if (!can('audit', 'ADMIN')) {
      return { success: false, error: 'Apenas o Administrador Técnico pode restaurar cópias de segurança.' };
    }

    try {
      const parsed = JSON.parse(jsonData);
      if (!parsed || !Array.isArray(parsed.members) || !Array.isArray(parsed.receipts) || !Array.isArray(parsed.users)) {
        return { success: false, error: 'Ficheiro de cópia de segurança inválido: estrutura incompleta.' };
      }

      const now = getNowISOString();
      const restoredUsers: UserAccount[] = parsed.users;
      const restoredMembersRaw: Member[] = verifyAndRepairMembersIntegrity(parsed.members).sanitizedMembers;
      const reconciled = reconcileUsersAndMembers(restoredUsers, restoredMembersRaw);
      const safeSettings = {
        ...(state.settings || {}),
        ...(parsed.settings || {}),
        permissionsMatrix: syncPermissionsMatrix(parsed.settings?.permissionsMatrix),
      };

      const resolvedCurrentUser =
        reconciled.users.find((u) => u.id === currentUser.id) ||
        reconciled.users.find((u) => u.role === 'admin_tecnico' && u.active) ||
        reconciled.users[0] ||
        currentUser;

      const normalizedState: ClubDatabaseState = {
        ...state,
        ...parsed,
        users: reconciled.users,
        members: reconciled.members,
        fees: Array.isArray(parsed.fees) ? parsed.fees : [],
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
        receipts: Array.isArray(parsed.receipts) ? parsed.receipts : [],
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
        monthlyClosings: Array.isArray(parsed.monthlyClosings) ? parsed.monthlyClosings : [],
        activities: Array.isArray(parsed.activities) ? parsed.activities : [],
        classes: Array.isArray(parsed.classes) ? parsed.classes : [],
        specialties: Array.isArray(parsed.specialties) ? parsed.specialties : [],
        trainingProgress: Array.isArray(parsed.trainingProgress) ? parsed.trainingProgress : [],
        documents: Array.isArray(parsed.documents) ? parsed.documents : [],
        circulars: Array.isArray(parsed.circulars) ? parsed.circulars : [],
        paymentProofs: Array.isArray(parsed.paymentProofs) ? parsed.paymentProofs : [],
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
        deletionRequests: Array.isArray(parsed.deletionRequests) ? parsed.deletionRequests : [],
        chaplaincyRequests: Array.isArray(parsed.chaplaincyRequests) ? parsed.chaplaincyRequests : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        associateDirectives: Array.isArray(parsed.associateDirectives) ? parsed.associateDirectives : [],
        teamEvaluations: Array.isArray(parsed.teamEvaluations) ? parsed.teamEvaluations : [],
        quotaWaivers: Array.isArray(parsed.quotaWaivers) ? parsed.quotaWaivers : [],
        musicItems: Array.isArray(parsed.musicItems) ? parsed.musicItems : [],
        enrollmentRequests: Array.isArray(parsed.enrollmentRequests) ? parsed.enrollmentRequests : [],
        teamChatMessages: Array.isArray(parsed.teamChatMessages) ? parsed.teamChatMessages : [],
        teamTasks: Array.isArray(parsed.teamTasks) ? parsed.teamTasks : [],
        teamNotes: Array.isArray(parsed.teamNotes) ? parsed.teamNotes : [],
        teamAwards: Array.isArray(parsed.teamAwards) ? parsed.teamAwards : [],
        settings: safeSettings,
        currentUser: resolvedCurrentUser,
        updatedAt: now,
      };

      hasLoadedFromCloudRef.current = true;
      setState(normalizedState);
      saveStateToStorage(normalizedState);
      pushToFirestore(normalizedState, { allowEmptyWrite: true });
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


  // --- GABINETE EXCLUSIVO DO DIRETOR-ASSOCIADO: DIRETIVAS & AVALIAÇÕES DE EQUIPAS ---
  const createAssociateDirective = (data: {
    title: string;
    description: string;
    targetUnitName: string;
    assignedLeaderName?: string;
    priority: AssociateDirectivePriority;
    dueDate: string;
    checklistNotes?: string;
  }) => {
    if (!can('associate_director', 'CREATE')) {
      return { success: false, error: 'Sem permissão na grelha para emitir diretivas operacionais neste módulo.' };
    }
    if (!data.title.trim() || !data.description.trim()) {
      return { success: false, error: 'Preencha o título e a descrição da diretiva operacional.' };
    }

    const now = getNowISOString();
    const newDirective: AssociateDirective = {
      id: `DIR-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      title: data.title.trim(),
      description: data.description.trim(),
      targetUnitName: data.targetUnitName.trim() || 'Todas',
      assignedLeaderName: data.assignedLeaderName?.trim() || undefined,
      priority: data.priority,
      dueDate: data.dueDate,
      status: 'pendente',
      checklistNotes: data.checklistNotes?.trim() || undefined,
      createdByUserId: currentUser.id,
      createdByName: currentUser.name,
      createdAt: now,
      updatedAt: now,
    };

    const nextDirectives = [newDirective, ...(state.associateDirectives || [])];
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'associate_director',
      'EMISSAO_DIRETIVA_OPERACIONAL',
      `Diretiva emitida para ${newDirective.targetUnitName}: ${newDirective.title} (Prazo: ${formatDateAO(newDirective.dueDate)})`,
      newDirective.id,
      newDirective.title
    );

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      associateDirectives: nextDirectives,
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);

    return { success: true, directive: newDirective };
  };

  const updateAssociateDirectiveStatus = (
    id: string,
    status: AssociateDirectiveStatus,
    checklistNotes?: string
  ) => {
    const needsApprove = status === 'validado';
    if (needsApprove ? !can('associate_director', 'APPROVE') && !can('associate_director', 'EDIT') : !can('associate_director', 'EDIT')) {
      return { success: false, error: 'Sem permissão na grelha para atualizar ou validar esta diretiva.' };
    }

    const existing = (state.associateDirectives || []).find((d) => d.id === id);
    if (!existing) {
      return { success: false, error: 'Diretiva operacional não encontrada.' };
    }

    const now = getNowISOString();
    const updatedList = (state.associateDirectives || []).map((d) => {
      if (d.id !== id) return d;
      return {
        ...d,
        status,
        checklistNotes: checklistNotes !== undefined ? checklistNotes : d.checklistNotes,
        updatedAt: now,
        ...(status === 'validado'
          ? { validatedByName: currentUser.name, validatedAt: now }
          : {}),
      };
    });

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'associate_director',
      'ATUALIZACAO_DIRETIVA',
      `Estado da diretiva "${existing.title}" atualizado para ${status}`,
      id,
      existing.title
    );

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      associateDirectives: updatedList,
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);

    return { success: true };
  };

  // Módulo de Música e Louvor
  const createMusicItem = async (
    data: Omit<MusicItem, 'id' | 'createdAt'>
  ): Promise<{ success: boolean; item?: MusicItem; error?: string; warning?: string }> => {
    if (!can('music', 'CREATE')) {
      return { success: false, error: 'Sem permissão na grelha para adicionar hinos ao repertório.' };
    }
    const cleanTitle = (data.title || '').trim();
    if (!cleanTitle) {
      return { success: false, error: 'O título do hino/cântico é obrigatório.' };
    }

    let baseState = stateRef.current;
    if (
      db &&
      (db as any).app &&
      (!hasLoadedFromCloudRef.current || !Array.isArray(baseState.musicItems))
    ) {
      try {
        let snap: any = null;
        try {
          snap = await getDocFromServer(doc(db, 'club_data', 'main_state'));
        } catch {
          snap = await getDoc(doc(db, 'club_data', 'main_state')).catch(() => null);
        }
        if (snap && snap.exists()) {
          const cloudData = snap.data() as ClubDatabaseState;
          if (cloudData) {
            baseState = normalizeCloudState(cloudData, stateRef.current);
            hasLoadedFromCloudRef.current = true;
            cloudConfirmedEmptyRef.current = false;
          }
        } else if (snap && !snap.exists()) {
          hasLoadedFromCloudRef.current = true;
          cloudConfirmedEmptyRef.current = true;
        }
      } catch {
        // Continua com stateRef.current
      }
    }

    const now = getNowISOString();
    const newItem: MusicItem = {
      id: `MUS-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      title: cleanTitle,
      category: data.category || 'louvor_jovem',
      createdAt: now,
      ...(data.composer?.trim() ? { composer: data.composer.trim() } : {}),
      ...(data.keySignature?.trim() ? { keySignature: data.keySignature.trim() } : {}),
      ...(data.lyrics?.trim() ? { lyrics: data.lyrics.trim() } : {}),
      ...(data.chordChartUrl?.trim() ? { chordChartUrl: data.chordChartUrl.trim() } : {}),
      ...(data.audioUrl?.trim() ? { audioUrl: data.audioUrl.trim() } : {}),
    };

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'music',
      'CRIAR_HINO',
      `Registo de hino: ${newItem.title}`,
      newItem.id,
      newItem.title
    );

    const nextState: ClubDatabaseState = {
      ...baseState,
      updatedAt: now,
      musicItems: [newItem, ...(baseState.musicItems || [])],
      auditLogs: [auditEntry, ...(baseState.auditLogs || [])],
    };

    lastCloudStateRef.current = nextState;
    commitState(nextState, { saveLocal: true, pushCloud: false });

    const pushRes = await pushToFirestore(nextState, {
      allowEmptyWrite: cloudConfirmedEmptyRef.current,
    });

    if (!pushRes.success) {
      if (pushRes.queuedOffline) {
        return {
          success: true,
          item: newItem,
          warning: pushRes.error || 'Hino adicionado localmente e colocado em fila para envio ao Firestore.',
        };
      }
      lastCloudStateRef.current = baseState;
      commitState(baseState, { saveLocal: true, pushCloud: false });
      return {
        success: false,
        error: pushRes.error || 'Não foi possível gravar o hino no banco de dados Firestore.',
      };
    }

    return { success: true, item: newItem };
  };

  const updateMusicItem = async (
    id: string,
    data: Partial<MusicItem>
  ): Promise<{ success: boolean; item?: MusicItem; error?: string; warning?: string }> => {
    if (!can('music', 'EDIT')) {
      return { success: false, error: 'Sem permissão na grelha para editar este hino.' };
    }
    const baseState = stateRef.current;
    const list = baseState.musicItems || [];
    const existing = list.find((m) => m.id === id);
    if (!existing) return { success: false, error: 'Hino não encontrado no repertório.' };

    const now = getNowISOString();
    const nextTitle = data.title !== undefined ? data.title.trim() : existing.title;
    if (!nextTitle) {
      return { success: false, error: 'O título do hino/cântico é obrigatório.' };
    }

    const resolveOptionalField = (fieldKey: 'composer' | 'keySignature' | 'lyrics' | 'chordChartUrl' | 'audioUrl') => {
      if (Object.prototype.hasOwnProperty.call(data, fieldKey)) {
        const val = data[fieldKey];
        return typeof val === 'string' && val.trim() ? val.trim() : undefined;
      }
      return existing[fieldKey];
    };

    const composer = resolveOptionalField('composer');
    const keySignature = resolveOptionalField('keySignature');
    const lyrics = resolveOptionalField('lyrics');
    const chordChartUrl = resolveOptionalField('chordChartUrl');
    const audioUrl = resolveOptionalField('audioUrl');

    const updatedItem: MusicItem = {
      id: existing.id,
      title: nextTitle,
      category: data.category || existing.category,
      createdAt: existing.createdAt,
      ...(composer ? { composer } : {}),
      ...(keySignature ? { keySignature } : {}),
      ...(lyrics ? { lyrics } : {}),
      ...(chordChartUrl ? { chordChartUrl } : {}),
      ...(audioUrl ? { audioUrl } : {}),
    };

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'music',
      'EDITAR_HINO',
      `Atualização de hino: ${nextTitle}`,
      id,
      nextTitle
    );

    const nextState: ClubDatabaseState = {
      ...baseState,
      updatedAt: now,
      musicItems: list.map((m) => (m.id === id ? updatedItem : m)),
      auditLogs: [auditEntry, ...(baseState.auditLogs || [])],
    };

    lastCloudStateRef.current = nextState;
    commitState(nextState, { saveLocal: true, pushCloud: false });

    const pushRes = await pushToFirestore(nextState, {
      allowEmptyWrite: cloudConfirmedEmptyRef.current,
    });

    if (!pushRes.success) {
      if (pushRes.queuedOffline) {
        return {
          success: true,
          item: updatedItem,
          warning: pushRes.error || 'Alteração mantida localmente e em fila para envio ao Firestore.',
        };
      }
      lastCloudStateRef.current = baseState;
      commitState(baseState, { saveLocal: true, pushCloud: false });
      return {
        success: false,
        error: pushRes.error || 'Não foi possível gravar a atualização no Firestore.',
      };
    }

    return { success: true, item: updatedItem };
  };

  const deleteMusicItem = async (
    id: string
  ): Promise<{ success: boolean; error?: string; warning?: string }> => {
    if (!can('music', 'EDIT') && !can('music', 'CREATE')) {
      return { success: false, error: 'Sem permissão na grelha para remover hinos.' };
    }
    const baseState = stateRef.current;
    const existing = (baseState.musicItems || []).find((m) => m.id === id);
    if (!existing) return { success: false, error: 'Hino não encontrado no repertório.' };

    const now = getNowISOString();
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'music',
      'REMOVER_HINO',
      `Remoção de hino do repertório: ${existing.title}`,
      id,
      existing.title
    );

    const nextState: ClubDatabaseState = {
      ...baseState,
      updatedAt: now,
      musicItems: (baseState.musicItems || []).filter((m) => m.id !== id),
      auditLogs: [auditEntry, ...(baseState.auditLogs || [])],
    };

    lastCloudStateRef.current = nextState;
    commitState(nextState, { saveLocal: true, pushCloud: false });

    const pushRes = await pushToFirestore(nextState, {
      allowEmptyWrite: cloudConfirmedEmptyRef.current,
    });

    if (!pushRes.success) {
      if (pushRes.queuedOffline) {
        return {
          success: true,
          warning: pushRes.error || 'Remoção registada localmente e em fila para envio ao Firestore.',
        };
      }
      lastCloudStateRef.current = baseState;
      commitState(baseState, { saveLocal: true, pushCloud: false });
      return {
        success: false,
        error: pushRes.error || 'Não foi possível remover o hino no Firestore.',
      };
    }

    return { success: true };
  };

  const deleteAssociateDirective = (id: string) => {
    if (!can('associate_director', 'EDIT')) {
      return { success: false, error: 'Sem permissão na grelha para eliminar diretivas.' };
    }
    const existing = (state.associateDirectives || []).find((d) => d.id === id);
    if (!existing) {
      return { success: false, error: 'Diretiva não encontrada.' };
    }

    const now = getNowISOString();
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'associate_director',
      'REMOCAO_DIRETIVA',
      `Diretiva operacional removida: ${existing.title}`,
      id,
      existing.title
    );

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      associateDirectives: (state.associateDirectives || []).filter((d) => d.id !== id),
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);

    return { success: true };
  };

  const saveTeamEvaluation = (data: {
    unitId: string;
    unitName: string;
    periodLabel: string;
    disciplineScore: number;
    teamworkScore: number;
    punctualityScore: number;
    trainingCommitmentScore: number;
    observations?: string;
  }) => {
    if (!can('associate_director', 'CREATE') && !can('associate_director', 'EDIT')) {
      return { success: false, error: 'Sem permissão na grelha para registar avaliações de equipas.' };
    }
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    const discipline = clamp(data.disciplineScore);
    const teamwork = clamp(data.teamworkScore);
    const punctuality = clamp(data.punctualityScore);
    const training = clamp(data.trainingCommitmentScore);
    const overallScore = Math.round((discipline + teamwork + punctuality + training) / 4);
    const now = getNowISOString();

    const newEval: TeamEvaluation = {
      id: `EVAL-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      unitId: data.unitId,
      unitName: data.unitName,
      periodLabel: data.periodLabel.trim() || `${state.settings.currentYear}`,
      disciplineScore: discipline,
      teamworkScore: teamwork,
      punctualityScore: punctuality,
      trainingCommitmentScore: training,
      overallScore,
      observations: data.observations?.trim() || undefined,
      evaluatedByUserId: currentUser.id,
      evaluatedByName: currentUser.name,
      evaluatedAt: now,
    };

    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'associate_director',
      'AVALIACAO_EQUIPA',
      `Equipa ${data.unitName} avaliada (${newEval.periodLabel}): Pontuação Global ${overallScore}%`,
      newEval.id,
      data.unitName
    );

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      teamEvaluations: [newEval, ...(state.teamEvaluations || [])],
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);

    return { success: true, evaluation: newEval };
  };

  const deleteTeamEvaluation = (id: string) => {
    if (!can('associate_director', 'EDIT')) {
      return { success: false, error: 'Sem permissão na grelha para remover avaliações.' };
    }
    const existing = (state.teamEvaluations || []).find((e) => e.id === id);
    if (!existing) {
      return { success: false, error: 'Avaliação não encontrada.' };
    }

    const now = getNowISOString();
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'associate_director',
      'REMOCAO_AVALIACAO_EQUIPA',
      `Avaliação removida da equipa ${existing.unitName} (${existing.periodLabel})`,
      id,
      existing.unitName
    );

    const nextState: ClubDatabaseState = {
      ...state,
      updatedAt: now,
      teamEvaluations: (state.teamEvaluations || []).filter((e) => e.id !== id),
      auditLogs: [auditEntry, ...state.auditLogs],
    };

    setState(nextState);
    saveStateToStorage(nextState);
    pushToFirestore(nextState);

    return { success: true };
  };

  // --- MÓDULO MINHA EQUIPA & CHAT INTERNO ---
  const sendTeamChatMessage = (data: {
    unitId: string;
    content: string;
  }): { success: boolean; message?: TeamChatMessage; error?: string } => {
    if (!can('my_team', 'VIEW') || !can('my_team', 'CREATE')) {
      return { success: false, error: 'Sem permissão na grelha para enviar mensagens no chat da equipa.' };
    }

    const cleanContent = (data.content || '').trim();
    if (!cleanContent) {
      return { success: false, error: 'Escreva uma mensagem antes de enviar.' };
    }
    if (cleanContent.length > 1000) {
      return { success: false, error: 'A mensagem não pode exceder 1000 caracteres.' };
    }

    const live = stateRef.current;
    const unit = (live.settings.units || []).find((u) => u.id === data.unitId && u.active !== false);
    if (!unit) {
      return { success: false, error: 'Equipa não encontrada ou inativa.' };
    }

    const linkedMember = getStrictLinkedMember(currentUser, live.members);
    if (!canPostInTeamChat(unit, linkedMember, currentUser)) {
      return {
        success: false,
        error: 'Apenas os membros desta equipa ou o respetivo Líder atribuído podem interagir neste chat.',
      };
    }

    const now = getNowISOString();
    const newMsg: TeamChatMessage = {
      id: `TCHAT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      unitId: unit.id,
      unitName: unit.name,
      senderUserId: currentUser.id,
      senderMemberId: linkedMember?.id,
      senderName: linkedMember?.fullName || currentUser.name,
      senderRole: currentUser.role,
      isTeamLeader: isAssignedTeamLeader(unit, currentUser),
      content: cleanContent,
      createdAt: now,
    };

    commitState(
      (prev) => {
        const existing = prev.teamChatMessages || [];
        if (existing.some((m) => m.id === newMsg.id)) return prev;
        return {
          ...prev,
          updatedAt: now,
          teamChatMessages: [...existing, newMsg],
        };
      },
      { saveLocal: true, pushCloud: true }
    );

    return { success: true, message: newMsg };
  };

  const deleteTeamChatMessage = (messageId: string): { success: boolean; error?: string } => {
    const live = stateRef.current;
    const targetMsg = (live.teamChatMessages || []).find((m) => m.id === messageId);
    if (!targetMsg) {
      return { success: false, error: 'Mensagem não encontrada no chat da equipa.' };
    }

    const unit = (live.settings.units || []).find((u) => u.id === targetMsg.unitId);
    if (!canDeleteTeamChatMessage(unit, currentUser)) {
      return {
        success: false,
        error: 'Apenas a Direção (Diretor, Secretário, Diretor-associado) ou o Líder desta equipa pode excluir mensagens para todos.',
      };
    }

    const now = getNowISOString();
    const auditEntry = createAuditLog(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      'my_team',
      'EXCLUSAO_MSG_CHAT_EQUIPA',
      `Mensagem de ${targetMsg.senderName} excluída para todos no chat da equipa ${targetMsg.unitName}.`,
      targetMsg.id,
      targetMsg.unitName
    );

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        teamChatMessages: (prev.teamChatMessages || []).filter((m) => m.id !== messageId),
        auditLogs: [auditEntry, ...prev.auditLogs],
      }),
      { saveLocal: true, pushCloud: true }
    );

    return { success: true };
  };

  const createTeamTask = (data: {
    unitId: string;
    title: string;
    description?: string;
    assignedMemberName?: string;
    dueDate: string;
  }): { success: boolean; task?: TeamTask; error?: string } => {
    const live = stateRef.current;
    const unit = (live.settings.units || []).find((u) => u.id === data.unitId && u.active !== false);
    if (!unit) return { success: false, error: 'Equipa não encontrada.' };
    if (!isDirectionChatMonitor(currentUser.role) && !isAssignedTeamLeader(unit, currentUser)) {
      return { success: false, error: 'Apenas a Direção ou o Líder da Equipa podem criar tarefas.' };
    }
    const cleanTitle = (data.title || '').trim();
    if (!cleanTitle) return { success: false, error: 'O título da tarefa é obrigatório.' };

    const now = getNowISOString();
    const newTask: TeamTask = {
      id: `TTASK-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      unitId: unit.id,
      title: cleanTitle,
      description: data.description?.trim() || undefined,
      assignedMemberName: data.assignedMemberName?.trim() || undefined,
      dueDate: data.dueDate || now.slice(0, 10),
      status: 'pendente',
      createdByName: currentUser.name,
      createdAt: now,
    };

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        teamTasks: [newTask, ...(prev.teamTasks || [])],
      }),
      { saveLocal: true, pushCloud: true }
    );
    return { success: true, task: newTask };
  };

  const updateTeamTaskStatus = (taskId: string, status: 'pendente' | 'concluido'): { success: boolean; error?: string } => {
    const live = stateRef.current;
    const task = (live.teamTasks || []).find((t) => t.id === taskId);
    if (!task) return { success: false, error: 'Tarefa não encontrada.' };
    const unit = (live.settings.units || []).find((u) => u.id === task.unitId);
    if (!isDirectionChatMonitor(currentUser.role) && !(unit ? isAssignedTeamLeader(unit, currentUser) : false)) {
      return { success: false, error: 'Sem permissão para atualizar esta tarefa.' };
    }

    const now = getNowISOString();
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        teamTasks: (prev.teamTasks || []).map((t) => (t.id === taskId ? { ...t, status } : t)),
      }),
      { saveLocal: true, pushCloud: true }
    );
    return { success: true };
  };

  const deleteTeamTask = (taskId: string): { success: boolean; error?: string } => {
    const live = stateRef.current;
    const task = (live.teamTasks || []).find((t) => t.id === taskId);
    if (!task) return { success: false, error: 'Tarefa não encontrada.' };
    const unit = (live.settings.units || []).find((u) => u.id === task.unitId);
    if (!isDirectionChatMonitor(currentUser.role) && !(unit ? isAssignedTeamLeader(unit, currentUser) : false)) {
      return { success: false, error: 'Sem permissão para remover esta tarefa.' };
    }

    const now = getNowISOString();
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        teamTasks: (prev.teamTasks || []).filter((t) => t.id !== taskId),
      }),
      { saveLocal: true, pushCloud: true }
    );
    return { success: true };
  };

  const createTeamNote = (data: {
    unitId: string;
    title: string;
    content: string;
  }): { success: boolean; note?: TeamNote; error?: string } => {
    const live = stateRef.current;
    const unit = (live.settings.units || []).find((u) => u.id === data.unitId && u.active !== false);
    if (!unit) return { success: false, error: 'Equipa não encontrada.' };
    if (!isDirectionChatMonitor(currentUser.role) && !(unit ? isAssignedTeamLeader(unit, currentUser) : false)) {
      return { success: false, error: 'Apenas a Direção ou o Líder da Equipa podem criar notas de campo.' };
    }
    const cleanTitle = (data.title || '').trim();
    const cleanContent = (data.content || '').trim();
    if (!cleanTitle || !cleanContent) return { success: false, error: 'Preencha o título e o conteúdo da nota.' };

    const now = getNowISOString();
    const newNote: TeamNote = {
      id: `TNOTE-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      unitId: unit.id,
      title: cleanTitle,
      content: cleanContent,
      authorName: currentUser.name,
      createdAt: now,
    };

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        teamNotes: [newNote, ...(prev.teamNotes || [])],
      }),
      { saveLocal: true, pushCloud: true }
    );
    return { success: true, note: newNote };
  };

  const deleteTeamNote = (noteId: string): { success: boolean; error?: string } => {
    const live = stateRef.current;
    const note = (live.teamNotes || []).find((n) => n.id === noteId);
    if (!note) return { success: false, error: 'Nota não encontrada.' };
    const unit = (live.settings.units || []).find((u) => u.id === note.unitId);
    if (!isDirectionChatMonitor(currentUser.role) && !(unit ? isAssignedTeamLeader(unit, currentUser) : false)) {
      return { success: false, error: 'Sem permissão para remover esta nota.' };
    }

    const now = getNowISOString();
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        teamNotes: (prev.teamNotes || []).filter((n) => n.id !== noteId),
      }),
      { saveLocal: true, pushCloud: true }
    );
    return { success: true };
  };

  const createTeamAward = (data: {
    unitId: string;
    title: string;
    date: string;
    description?: string;
  }): { success: boolean; award?: TeamAward; error?: string } => {
    const live = stateRef.current;
    const unit = (live.settings.units || []).find((u) => u.id === data.unitId && u.active !== false);
    if (!unit) return { success: false, error: 'Equipa não encontrada.' };
    if (!isDirectionChatMonitor(currentUser.role) && !(unit ? isAssignedTeamLeader(unit, currentUser) : false)) {
      return { success: false, error: 'Apenas a Direção ou o Líder da Equipa podem registar conquistas.' };
    }
    const cleanTitle = (data.title || '').trim();
    if (!cleanTitle) return { success: false, error: 'O título da conquista é obrigatório.' };

    const now = getNowISOString();
    const newAward: TeamAward = {
      id: `TAWD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      unitId: unit.id,
      title: cleanTitle,
      date: data.date || now.slice(0, 10),
      description: data.description?.trim() || undefined,
    };

    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        teamAwards: [newAward, ...(prev.teamAwards || [])],
      }),
      { saveLocal: true, pushCloud: true }
    );
    return { success: true, award: newAward };
  };

  const deleteTeamAward = (awardId: string): { success: boolean; error?: string } => {
    const live = stateRef.current;
    const award = (live.teamAwards || []).find((a) => a.id === awardId);
    if (!award) return { success: false, error: 'Conquista não encontrada.' };
    const unit = (live.settings.units || []).find((u) => u.id === award.unitId);
    if (!isDirectionChatMonitor(currentUser.role) && !(unit ? isAssignedTeamLeader(unit, currentUser) : false)) {
      return { success: false, error: 'Sem permissão para remover esta conquista.' };
    }

    const now = getNowISOString();
    commitState(
      (prev) => ({
        ...prev,
        updatedAt: now,
        teamAwards: (prev.teamAwards || []).filter((a) => a.id !== awardId),
      }),
      { saveLocal: true, pushCloud: true }
    );
    return { success: true };
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
        submitEnrollmentRequest,
        resubmitEnrollmentRequest,
        markEnrollmentUnderReview,
        updateEnrollmentReviewMessage,
        approveEnrollmentRequest,
        rejectEnrollmentRequest,
        updateMemberDocumentationStatus,
        reopenEnrollments,
        closeEnrollmentsImmediately,
        submitMemberReconfirmation,
        finalizeEnrollmentPeriodIfEnded,
        exportEnrollmentReconfirmationList,
        createReceipt,
        cancelReceipt,
        updateQuotaConfig,
        regularizeMemberQuota,
        batchRegularizeQuotas,
        waiveMemberQuotaDebt,
        waiveAllPendingQuotaDebts,
        reverseQuotaDebtWaiver,
        createExpense,
        approveExpense,
        rejectExpense,
        payExpense,
        closeFiscalMonth,
        reopenFiscalMonth,
        createActivity,
        updateActivity,
        updateActivityStage,
        decideActivityApproval,
        toggleActivityPortalVisibility,
        deleteActivity,
        toggleAttendance,
        batchToggleAttendance,
        addTaskToActivity,
        updateTaskStatus,
        updateTaskInActivity,
        deleteTaskFromActivity,
        saveMinuteToActivity,
        submitActivityRsvp,
        updateTrainingProgress,
        createTrainingProgress,
        batchEnrollTrainingProgress,
        assignTrainingInstructor,
        batchUpdateTrainingRequirements,
        approveFinalTraining,
        revokeTrainingApproval,
        deleteTrainingProgress,
        createOfficialDoc,
        cancelOfficialDoc,
        submitPortalRequest,
        respondToRequest,
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
        addAnnouncement,
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
        createSelfServiceMemberAccount,
        approvePendingMemberAccount,
        rejectPendingMemberAccount,
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
        refreshFromCloud,
        runIntegrityVerification,
        createAssociateDirective,
        updateAssociateDirectiveStatus,
        deleteAssociateDirective,
        saveTeamEvaluation,
        deleteTeamEvaluation,
        createMusicItem,
        updateMusicItem,
        deleteMusicItem,
        sendTeamChatMessage,
        deleteTeamChatMessage,
        createTeamTask,
        updateTeamTaskStatus,
        deleteTeamTask,
        createTeamNote,
        deleteTeamNote,
        createTeamAward,
        deleteTeamAward,
        isQuotaExceeded,
        isCloudLoading,
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
