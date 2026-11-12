/**
 * Tipos e Definições de Dados do Sistema de Gestão do Clube de Embaixadores Pioneiros D'Alvorada
 * Moeda: Kwanza (Kz) - Valores financeiros armazenados em cêntimos inteiros para evitar imprecisões binárias.
 */

export type RoleType = 
  | 'admin_tecnico' 
  | 'diretor' 
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
  | 'DELETE_RUBRIC';

export type ModuleName =
  | 'dashboard'
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
  | 'messaging';

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: RoleType;
  linkedMemberId?: string;
  active: boolean;
  phone?: string;
  password?: string;
  lastLogin?: string;
  createdAt: string;
  passwordResetRequested?: boolean;
  lastPasswordChangedAt?: string;
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

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  phoneVerified?: boolean;
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
  investitureDate?: string; // Data oficial de investidura (AAAA-MM-DD) para Embaixador ou Líder
  professionalCourse?: string; // Curso profissional que o membro está fazendo ou fez
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

