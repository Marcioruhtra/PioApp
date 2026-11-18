/**
 * Tipos e Definições de Dados do Sistema de Gestão do Clube de Embaixadores Pioneiros D'Alvorada
 * Moeda: Kwanza (Kz) - Valores financeiros armazenados em cêntimos inteiros para evitar imprecisões binárias.
 */

export type RoleType = 
  | 'admin_tecnico' 
  | 'diretor' 
  | 'diretor_associado'
  | 'secretario' 
  | 'tesoureiro' 
  | 'instrutor' 
  | 'membro'
  | 'capelao';

export type PermissionAction =
  | 'VIEW'
  | 'CREATE'
  | 'EDIT'
  | 'APPROVE'
  | 'EXPORT'
  | 'PRINT'
  | 'ARCHIVE'
  | 'DELETE'
  | 'REOPEN'
  | 'ADMIN'
  | 'CREATE_ACCOUNT'
  | 'DELETE_ACCOUNT'
  | 'CREATE_RUBRIC'
  | 'DELETE_RUBRIC'
  | 'CONFIGURE_QUOTAS'
  | 'WAIVE_QUOTA_DEBT'
  | 'VIEW_DOSSIER_360'
  | 'APPROVE_ENROLLMENT'
  | 'MANAGE_ENROLLMENT_PERIOD'
  | 'APPROVE_MEMBER_ACCOUNT'
  | 'DELETE_MEMBER_UPLOADS';

export type ModuleName =
  | 'dashboard'
  | 'associate_director'
  | 'members'
  | 'treasury'
  | 'activities'
  | 'training'
  | 'documents'
  | 'member_portal'
  | 'requests'
  | 'reports'
  | 'settings'
  | 'audit'
  | 'chaplaincy'
  | 'suggestions'
  | 'messaging'
  | 'inventory'
  | 'awards'
  | 'music';

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: RoleType;
  linkedMemberId?: string;
  manualNumber?: string;
  active: boolean;
  phone?: string;
  password?: string;
  lastLogin?: string;
  createdAt: string;
  passwordResetRequested?: boolean;
  lastPasswordChangedAt?: string;
  lastAdminPasswordResetAt?: string;
  accountApprovalStatus?: 'aprovada' | 'pendente_confirmacao' | 'rejeitada';
  accountCreatedViaSelfService?: boolean;
  accountApprovedByUserId?: string;
  accountApprovedByName?: string;
  accountApprovedAt?: string;
  deactivatedByArchive?: boolean;
}

export type MemberCategory = 
  | 'embaixador'
  | 'lider' 
  | 'aspirante';

export type MemberStatus = 
  | 'ativo' 
  | 'inativo' 
  | 'arquivado' 
  | 'transferido';

export type MemberDocumentationStatus = 'regularizado' | 'falta_documento';

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  phoneVerified?: boolean;
}

export interface MemberQuotaCarryOver {
  snapshotDate: string; // Data (AAAA-MM-DD) da consolidação após limpeza na nuvem
  debtInCents: number; // Saldo em dívida transportado
  creditInCents: number; // Crédito adiantado transportado
  waivedInCents: number; // Total de dívidas zeradas preservado para exibição
}

export interface MemberAttachedDocument {
  id: string;
  title: string;
  fileName: string;
  base64: string;
  uploadedAt: string;
  uploadedByName?: string;
}

export interface Member {
  id: string; // ID interno auto-gerado (ex: PioApp-MEM-001)
  manualNumber: string; // Número de membro manual exclusivo (ex: 2026/012)
  fullName: string;
  birthDate: string; // AAAA-MM-DD
  gender: 'M' | 'F';
  identityCardNumber: string; // B.I. Angolano (ex: 007849312LA041)
  phone: string;
  email?: string;
  address: string; // Município/Bairro (ex: Luanda, Talatona)
  category: MemberCategory;
  unitOrTeam?: string; // Nome da Unidade / Patrulha (ex: Águias, Leões)
  guardianName?: string; // Encarregado de Educação (para menores)
  guardianPhone?: string;
  guardianValidated?: boolean;
  emergencyContact: EmergencyContact;
  bloodType?: string;
  allergiesOrMedicalNotes?: string;
  joinedDate: string;
  annualRenewalYear: number;
  status: MemberStatus;
  archiveReason?: string;
  archivedAt?: string;
  photoUrl?: string;
  biDocumentFileName?: string;
  biDocumentBase64?: string;
  photoDocumentFileName?: string;
  photoDocumentBase64?: string;
  attachedDocuments?: MemberAttachedDocument[];
  investitureDate?: string; // Data oficial de investidura (AAAA-MM-DD) para Embaixador ou Líder
  professionalCourse?: string; // Curso profissional que o membro está fazendo ou fez
  quotaCarryOver?: MemberQuotaCarryOver; // Saldo consolidado após limpeza da nuvem
  documentationStatus?: MemberDocumentationStatus; // Definido pelo Secretário: regularizado ou falta_documento
  missingDocumentsNote?: string; // Descrição dos documentos em falta quando documentationStatus === 'falta_documento'
  documentationUpdatedAt?: string;
  documentationUpdatedByName?: string;
  documentationUpdatedByRole?: RoleType;
  enrollmentProtocol?: string; // Protocolo de inscrição que originou o registo automático na Secretaria
  enrolledPeriodId?: string; // Identificador do período em que o membro foi admitido/aprovado
  lastReconfirmedPeriodId?: string; // Último período de inscrições em que o membro reconfirmou os dados
  lastReconfirmedAt?: string; // Data/hora da última reconfirmação de dados e documentos
  reconfirmationCount?: number; // Quantidade de reconfirmações realizadas
  createdAt: string;
  updatedAt: string;
}

export type FeePeriodicity = 'diaria' | 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'unica';

export type FeeCategory = 'quota_diaria' | 'quota_mensal' | 'contribuicao_atividade' | 'doacao' | 'outro';

export interface FeeDefinition {
  id: string;
  title: string;
  category: FeeCategory;
  periodicity: FeePeriodicity;
  amountInCents: number; // Em cêntimos de Kz (ex: 250000 = 2.500,00 Kz)
  targetCategory?: MemberCategory | 'todas';
  active: boolean;
  year: number;
}

export type PaymentMethod = 
  | 'multicaixa_express' 
  | 'transferencia_bancaria' 
  | 'deposito_bancario' 
  | 'numerario';

export type PaymentStatus = 'pendente' | 'confirmado' | 'anulado';

export interface PaymentReceipt {
  id: string;
  receiptNumber: string; // ex: REC-2026-0001
  memberId: string;
  memberName: string;
  feeDefinitionId: string;
  feeTitle: string;
  periodLabel: string; // ex: "Março 2026"
  amountPaidInCents: number; // Em cêntimos de Kz
  paymentMethod: PaymentMethod;
  referenceOrProof?: string;
  treasurerUserId: string;
  treasurerName: string;
  treasurerRole?: RoleType;
  paidAt: string; // Data real de pagamento
  status: PaymentStatus;
  notes?: string;
  isCancelled?: boolean;
  cancellationReason?: string;
  cancelledAt?: string;
  cancelledByUserId?: string;
  activityId?: string;
}

export interface TreasuryAccount {
  id: string;
  name: string; // ex: "Caixa Geral", "Banco BFA - CC", "Banco BAI", "Fundo de Acampamento"
  accountNumber?: string;
  type: 'caixa' | 'banco' | 'fundo';
  initialBalanceInCents: number;
  currentBalanceInCents: number;
  active: boolean;
}

export type ExpenseStatus = 
  | 'solicitado' 
  | 'aprovado' 
  | 'rejeitado' 
  | 'pago' 
  | 'cancelado';

export interface ExpenseRequest {
  id: string;
  activityId?: string;
  title: string;
  description: string;
  category: string;
  amountInCents: number;
  requestedByUserId: string;
  requestedByName: string;
  accountId?: string;
  status: ExpenseStatus;
  approvalReason?: string;
  approvedByUserId?: string;
  approvedByName?: string;
  secondApproverUserId?: string; // Exceção: despesa própria exige 2º aprovador
  secondApproverName?: string;
  paymentProofUrl?: string;
  paidAt?: string;
  createdAt: string;
}

export interface MonthlyClosing {
  id: string;
  year: number;
  month: number;
  totalIncomeInCents: number;
  totalExpenseInCents: number;
  closingBalanceInCents: number;
  closedByUserId: string;
  closedByName: string;
  closedAt: string;
  isReopened?: boolean;
  reopenReason?: string;
  reopenedByUserId?: string;
  reopenedAt?: string;
}

export type ActivityStage = 
  | 'planeamento' 
  | 'aprovacao' 
  | 'preparacao' 
  | 'execucao' 
  | 'relatorio' 
  | 'encerrado';

export interface ActivityTask {
  id: string;
  title: string;
  assigneeName: string;
  assigneeUserId?: string;
  dueDate: string;
  priority: 'baixa' | 'media' | 'alta' | 'urgente';
  status: 'pendente' | 'em_progresso' | 'concluido';
}

export interface ActivityAttendanceRecord {
  memberId: string;
  present: boolean;
  justified?: boolean;
  notes?: string;
}

export interface StructuredMinute {
  id: string;
  minuteNumber: string; // ex: ATA-2026-0001
  date: string;
  location: string;
  chairPerson: string;
  secretary: string;
  attendeesCount: number;
  agenda: string[];
  deliberations: string;
  observations?: string;
}

export interface ClubActivity {
  id: string;
  title: string;
  type: 'reuniao_regular' | 'acampamento' | 'civica' | 'formacao' | 'social' | 'diretoria';
  department: string;
  location: string;
  startDate: string;
  endDate?: string;
  stage: ActivityStage;
  requiresDirectorApproval: boolean;
  isApprovedByDirector?: boolean;
  costEstimatedInCents: number;
  costApprovedInCents: number;
  costPaidInCents: number;
  tasks: ActivityTask[];
  attendees: ActivityAttendanceRecord[];
  minute?: StructuredMinute;
  feeDefinitionId?: string;
  expenseRequestId?: string;
  createdAt: string;
}

export interface TrainingClass {
  id: string;
  code: string; // ex: "AMIGO", "COMPANHEIRO", "GUIA"
  title: string;
  minimumAge: number;
  requirementsCount: number;
  requirements?: string[];
  active: boolean;
}

export interface SpecialtyHonor {
  id: string;
  code: string; // ex: "ESP-PRIMEIROS-SOCORROS"
  title: string;
  category: 'natureza' | 'habilidades' | 'saude' | 'artes' | 'espiritual' | 'adra';
  requirementsCount: number;
  requirements?: string[];
  active: boolean;
}

export interface MemberTrainingProgress {
  id: string;
  memberId: string;
  type: 'classe' | 'especialidade';
  targetId: string; // ID da classe ou especialidade
  targetTitle: string;
  completedRequirements: number[]; // números de requisitos concluídos (ex: [1, 2, 4])
  totalRequirements: number;
  instructorUserId: string;
  instructorName: string;
  instructorValidated: boolean;
  finalAuthorizedApproval: boolean; // Percentagem não aprova sozinha; exige validação final autorizada
  approvedByDirectorId?: string;
  approvedAt?: string;
  observations?: string;
  updatedAt: string;
}

export type DocumentType = 
  | 'recibo' 
  | 'mapa_financeiro' 
  | 'folha_presenca' 
  | 'ata' 
  | 'declaracao_membro' 
  | 'certificado' 
  | 'relatorio_anual';

export interface OfficialDocument {
  id: string;
  documentNumber: string; // ex: REC-2026-0001, ATA-2026-0002, DEC-2026-0005
  documentType: DocumentType;
  title: string;
  year: number;
  issuedToName?: string;
  issuedToMemberId?: string;
  issuedByUserId: string;
  issuedByName: string;
  issuedByRole?: RoleType;
  issuedAt: string;
  contentData: Record<string, unknown>;
  isCancelled: boolean;
  cancellationReason?: string;
  cancelledAt?: string;
  isRejected?: boolean;
  rejectionReason?: string;
  rejectedAt?: string;
  content?: Record<string, unknown>;
}

export type RequestCategory = 
  | 'atualizacao_dados' 
  | 'tesouraria';

export type RequestStatus = 
  | 'pendente' 
  | 'em_analise' 
  | 'aprovado' 
  | 'rejeitado' 
  | 'concluido';

export interface MemberPortalRequest {
  id: string;
  memberId: string;
  memberName: string;
  category: RequestCategory;
  subject: string;
  details: string;
  proofAttachmentName?: string;
  status: RequestStatus;
  assignedRole: RoleType;
  assignedUserId?: string;
  assignedUserName?: string;
  responseNotes?: string;
  history: {
    status: RequestStatus;
    updatedBy: string;
    updatedAt: string;
    note?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentProofReport {
  id: string;
  memberId: string;
  memberName: string;
  feeDefinitionId: string;
  feeTitle: string;
  amountInCents: number;
  paymentMethod: PaymentMethod;
  referenceCode: string;
  paymentDate: string;
  attachmentFileName: string;
  accountId?: string;
  accountName?: string;
  isVerifiedByTreasurer: boolean; // A submissão não é confirmação de pagamento até validação da tesouraria
  verifiedByTreasurerId?: string;
  verifiedAt?: string;
  status: 'submetido' | 'confirmado' | 'rejeitado';
  rejectionReason?: string;
  attachmentBase64?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface ClubAnnouncement {
  id: string;
  title: string;
  content: string;
  urgency: 'normal' | 'importante' | 'urgente';
  targetAudience: 'todos' | 'lideranca' | 'pais' | 'embaixadores' | 'aspirantes';
  publishedByUserId: string;
  publishedByName: string;
  publishedAt: string;
  expiresAt?: string;
  active: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorUserId: string;
  actorName: string;
  actorRole: RoleType;
  module: ModuleName;
  action: string;
  entityId?: string;
  entityName?: string;
  details: string;
  reason?: string;
  ipAddress?: string;
}

export interface ClubNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  category: 'financial' | 'member' | 'training' | 'announcement' | 'system' | 'request';
  targetModule?: ModuleName;
  targetId?: string;
  recipientUserId?: string;
  targetMemberId?: string;
  recipientRole?: RoleType;
  recipientRoles?: RoleType[];
  priority?: 'normal' | 'alta' | 'urgente';
  isConfidential?: boolean;
}

export interface DeletionRequest {
  id: string;
  targetId: string;
  targetType: 'member' | 'user';
  targetMemberName?: string;
  targetMemberManualNumber?: string;
  operationType: 'arquivamento' | 'eliminacao';
  requestedByUserId: string;
  requestedByName?: string;
  requestedByRole?: RoleType;
  requestedAt: string;
  reason: string;
  status: 'pendente' | 'aprovado' | 'rejeitado' | 'executado';
  createdAt: string;
  decidedByUserId?: string;
  decidedByName?: string;
  decidedByRole?: RoleType;
  decidedAt?: string;
  decisionReason?: string;
  executedAt?: string;
  executedByUserId?: string;
  executedByName?: string;
}

export type QuotaBillingFrequency = 'domingo' | 'mensal';

export interface QuotaConfig {
  amountInCents: number; // Valor padrão da Quota em cêntimos de Kz (ex: 50000 = 500,00 Kz)
  categoryAmountsInCents?: Partial<Record<MemberCategory, number>>; // Valores opcionais por categoria
  frequency: QuotaBillingFrequency; // 'domingo' (cada domingo é cobrada a quota) ou 'mensal'
  cycleStartDate: string; // Data de início da contagem (AAAA-MM-DD)
  respectMemberJoinDate: boolean; // Se true, membros admitidos após cycleStartDate pagam a partir da admissão
  activeQuotaFeeId?: string; // ID da rubrica oficial vinculada às quotas
  updatedAt?: string;
  updatedByUserId?: string;
  updatedByName?: string;
}

export interface QuotaDebtWaiver {
  id: string; // ex: ZRD-2026-0001
  memberId: string;
  memberName: string;
  amountWaivedInCents: number; // Dívida zerada/perdoada em cêntimos de Kz
  grossDueAtWaiverInCents: number; // Total bruto devido no momento da operação
  paidAtWaiverInCents: number; // Total já pago no momento da operação
  previousBalanceInCents: number; // Saldo em dívida imediatamente antes de zerar
  cycleYear: number;
  reason: string;
  waivedByUserId: string;
  waivedByName: string;
  waivedByRole: RoleType;
  waivedAt: string;
  isReversed?: boolean;
  reversalReason?: string;
  reversedAt?: string;
  reversedByUserId?: string;
  reversedByName?: string;
}

export interface EnrollmentScheduleConfig {
  isOpen: boolean;
  periodId?: string; // Identificador único do período de inscrições
  enableReconfirmation?: boolean; // Permite que membros registados/inscritos façam reconfirmação de dados e documentos
  openedAt?: string; // Timestamp da abertura deste período
  openDate?: string; // AAAA-MM-DD
  openTime?: string; // HH:mm
  closeDate?: string; // AAAA-MM-DD
  closeTime?: string; // HH:mm
  closedImmediatelyAt?: string;
  finalizedPeriodId?: string; // PeriodId já processado após encerramento (evita reprocessamento)
  finalizedAt?: string; // Timestamp da definição automática de ativos/inativos no fim do período
  finalizationSummary?: {
    activatedCount: number;
    archivedCount: number;
    keptActiveCount: number;
    exemptedCount: number;
  };
  updatedAt?: string;
  updatedByUserId?: string;
  updatedByName?: string;
  updatedByRole?: RoleType;
}

export interface ClubSettings {
  clubName: string;
  headquarters?: string;
  address?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  city: string;
  country: string;
  currency: string;
  currentYear: number;
  departments: { id: string; name: string; leader: string; active: boolean }[];
  units: { id: string; name: string; category: MemberCategory | 'mista'; leaderUserId?: string; active: boolean }[];
  memberCategories: Record<string, string>; // Mapar id para nome customizável
  classes: { id: string; name: string; requirementsCount: number; active: boolean }[];
  documentTemplates: Record<DocumentType, string>; // Conteúdo padrão de modelos
  permissionsMatrix?: Record<RoleType, Record<ModuleName, PermissionAction[]>>;
  quotaConfig?: QuotaConfig;
  enrollmentConfig?: EnrollmentScheduleConfig;
}

export type ChaplaincyCategory = 'pedido_oracao' | 'aconselhamento' | 'visita_apoio' | 'outro';
export type ChaplaincyStatus = 'pendente' | 'em_oracao' | 'respondido' | 'arquivado';

export interface ChaplaincyRequest {
  id: string;
  memberId: string;
  memberName: string;
  category: ChaplaincyCategory;
  subject: string;
  message: string;
  confidential: boolean;
  status: ChaplaincyStatus;
  createdAt: string;
  responseNotes?: string;
  respondedBy?: string;
  respondedAt?: string;
}

export type SuggestionStatus = 'pendente' | 'visualizado' | 'respondido';

export type SuggestionCategory = 
  | 'geral'
  | 'atividades'
  | 'lideranca'
  | 'material_espaco'
  | 'espiritual'
  | 'organizacao'
  | 'outro';

export interface MemberSuggestion {
  id: string;
  memberId: string;
  memberName: string;
  memberManualNumber?: string;
  isAnonymous?: boolean;
  category: SuggestionCategory;
  subject: string;
  content: string;
  status: SuggestionStatus;
  viewedByDirector: boolean;
  viewedAt?: string;
  viewedByDirectorName?: string;
  responseContent?: string;
  respondedAt?: string;
  respondedByDirectorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageReply {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientType: 'member' | 'unit' | 'category' | 'all';
  subject: string;
  content: string;
  createdAt: string;
  read: boolean;
  readBy?: string[];
  replies?: MessageReply[];
}

export interface Circular {
  id: string;
  title: string;
  content: string;
  publishedAt: string;
  publishedByUserId: string;
  publishedByName: string;
  targetRoles: RoleType[];
  priority: 'normal' | 'alta' | 'urgente';
  readBy: string[];
}

export type AssociateDirectivePriority = 'normal' | 'alta' | 'urgente';
export type AssociateDirectiveStatus = 'pendente' | 'em_curso' | 'concluido' | 'validado';

export interface AssociateDirective {
  id: string;
  title: string;
  description: string;
  targetUnitName: string; // Nome da equipa ou 'Todas'
  assignedLeaderName?: string;
  priority: AssociateDirectivePriority;
  dueDate: string; // AAAA-MM-DD
  status: AssociateDirectiveStatus;
  checklistNotes?: string;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  validatedByName?: string;
  validatedAt?: string;
}

export interface TeamEvaluation {
  id: string;
  unitId: string;
  unitName: string;
  periodLabel: string;
  disciplineScore: number; // 0-100
  teamworkScore: number; // 0-100
  punctualityScore: number; // 0-100
  trainingCommitmentScore: number; // 0-100
  overallScore: number; // Média 0-100
  observations?: string;
  evaluatedByUserId: string;
  evaluatedByName: string;
  evaluatedAt: string;
}

export type MusicCategory = 'hino_oficial' | 'louvor_jovem' | 'marcha' | 'coral' | 'especial';

export interface MusicItem {
  id: string;
  title: string;
  composer?: string;
  category: MusicCategory;
  keySignature?: string; // ex: Dó Maior (C), Sol Maior (G)
  lyrics?: string;
  chordChartUrl?: string;
  audioUrl?: string;
  createdAt: string;
}

export interface WorshipRoster {
  id: string;
  date: string; // AAAA-MM-DD
  eventTitle: string; // ex: Reunião Regular de Domingo / Culto Jovem
  leadSingerName: string;
  instrumentalistNames: string[];
  songIds: string[];
  notes?: string;
  status: 'agendado' | 'realizado' | 'cancelado';
  createdByUserId: string;
  createdByName: string;
}

export interface MusicGear {
  id: string;
  itemName: string; // ex: Violão Acústico Yamaha / Teclado Casio / Microfone Shure SM58
  serialNumber?: string;
  condition: 'excelente' | 'bom' | 'manutencao';
  assignedToName?: string;
  notes?: string;
}

export type EnrollmentStatus = 'pendente' | 'em_analise' | 'aprovado' | 'rejeitado';

export type EnrollmentDocumentDeliveryMethod = 'anexar_digital' | 'presencial';

export interface MemberEnrollmentRequest {
  id: string; // ex: INS-2026-0001
  protocolNumber: string; // ex: INS-2026-0001
  manualNumber: string;
  fullName: string;
  birthDate: string; // AAAA-MM-DD
  gender: 'M' | 'F';
  identityCardNumber: string;
  phone: string;
  email?: string;
  address: string;
  category: MemberCategory;
  unitOrTeam?: string;
  guardianName?: string;
  guardianPhone?: string;
  emergencyContact: EmergencyContact;
  bloodType?: string;
  allergiesOrMedicalNotes?: string;
  joinedDate?: string;
  investitureDate?: string;
  professionalCourse?: string;
  documentDeliveryMethod?: EnrollmentDocumentDeliveryMethod;
  biDocumentFileName?: string;
  biDocumentBase64?: string;
  photoDocumentFileName?: string;
  photoDocumentBase64?: string;
  status: EnrollmentStatus;
  submittedAt: string;
  submittedByUserId?: string;
  underReviewStartedByUserId?: string;
  underReviewStartedByName?: string;
  underReviewStartedByRole?: RoleType;
  underReviewStartedAt?: string;
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewedByRole?: RoleType;
  reviewedAt?: string;
  decisionReason?: string;
  reviewMessage?: string;
  createdMemberId?: string;
  memberDeletedAt?: string;
  memberDeletedByUserId?: string;
  memberDeletedByName?: string;
}




