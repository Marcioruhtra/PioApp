import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Eye,
  Edit2,
  Archive,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Phone,
  Shield,
  FileText,
  Heart,
  ChevronDown,
  X,
  Lock,
  Calendar,
  Building,
  Trash2,
  Plus,
  UserCheck,
  Check,
  ShieldCheck,
  Clock,
  XCircle,
  CreditCard,
  User,
  Camera,
  ClipboardList,
  FileSearch,
  FileCheck,
  MessageSquare,
  Download,
  Upload,
  Loader2,
  Paperclip,
  Image as ImageIcon,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import {
  Member,
  MemberCategory,
  MemberStatus,
  MemberDocumentationStatus,
  DeletionRequest,
  OfficialDocument,
  MemberEnrollmentRequest,
} from '../../types';
import { formatDateAO, formatDateTimeAO, generateManualNumber, getTodayISODate } from '../../utils/date';
import { Modal } from '../common/Modal';
import { EmptyState } from '../common/EmptyState';
import { isMemberNumberUnique, findPotentialDuplicateMember } from '../../services/storageService';
import { MemberDigitalCardModal } from '../common/MemberDigitalCardModal';
import { PrintDocumentModal } from '../common/PrintDocumentModal';
import { DocumentViewerModal, ViewingDocumentPayload } from '../common/DocumentViewerModal';
import { MemberDossierModal } from '../members/MemberDossierModal';
import { MemberRegistrationForm } from '../members/MemberRegistrationForm';
import { EnrollmentStatusCard } from '../members/EnrollmentStatusCard';
import {
  MemberRegistrationFormData,
  findDuplicateEnrollmentByBI,
  normalizeIdentityCardNumber,
  resolveMemberDocumentationStatus,
  validateRegistrationFields,
  evaluateEnrollmentAvailability,
  getLocalTodayDateString,
  getLocalCurrentTimeString,
} from '../../services/enrollmentService';
import { downloadDocumentFile, processProfilePhoto, processProofFile } from '../../utils/fileUpload';
import {
  ROLE_LABELS,
  hasManageEnrollmentPeriodPermission,
  hasApproveMemberAccountPermission,
  hasDeleteMemberUploadsPermission,
  canExecuteMemberDeletion,
} from '../../services/permissionService';
import {
  findLinkedUserAccountsForMember,
  getMemberTeamLabel,
  isDirectionMember,
  isPendingMemberAccountConfirmation,
} from '../../services/accountSyncService';

export const MembersModule: React.FC = () => {
  const {
    state,
    can,
    currentUser,
    addMember,
    updateMember,
    uploadMemberPhoto,
    deleteMemberPhoto,
    archiveMember,
    unarchiveMember,
    renewMemberAnnual,
    addUnit,
    updateUnit,
    deleteUnit,
    assignMemberToUnit,
    deleteMember,
    updateMemberCategory,
    requestMemberOperation,
    decideMemberOperationRequest,
    executeApprovedMemberOperation,
    markEnrollmentUnderReview,
    approveEnrollmentRequest,
    rejectEnrollmentRequest,
    updateMemberDocumentationStatus,
    updateEnrollmentReviewMessage,
    reopenEnrollments,
    closeEnrollmentsImmediately,
    approvePendingMemberAccount,
    rejectPendingMemberAccount,
  } = useClub();

  const isAdmin = currentUser.role === 'admin_tecnico' || can('audit', 'ADMIN');
  const isSecretary = currentUser.role === 'secretario';
  const isDirector = currentUser.role === 'diretor';
  const isAssociateDirector = currentUser.role === 'diretor_associado';
  const isDirectorOrSecretary = isDirector || isSecretary || isAdmin;
  const canManageTeams = isDirector || isAssociateDirector || isSecretary || isAdmin;
  const canEdit = can('members', 'EDIT') || isSecretary || isAdmin || isDirector || isAssociateDirector;
  const canEditCategory = isAdmin || isSecretary || isDirector || isAssociateDirector;
  const canApproveEnrollments = can('members', 'APPROVE_ENROLLMENT');
  const canApproveMemberAccounts = hasApproveMemberAccountPermission(
    currentUser.role,
    state.settings.permissionsMatrix
  );
  const canManageEnrollmentPeriod = hasManageEnrollmentPeriodPermission(
    currentUser.role,
    state.settings.permissionsMatrix
  );
  const canDeleteMemberUploads = hasDeleteMemberUploadsPermission(
    currentUser.role,
    state.settings.permissionsMatrix
  );
  const canDirectDeleteMember = can('members', 'DELETE') || can('members', 'ADMIN');
  const canExecuteApprovedDelete = canExecuteMemberDeletion(
    currentUser.role,
    state.settings.permissionsMatrix,
    true
  );

  // Visualização e Navegação
  const [activeView, setActiveView] = useState<'members' | 'enrollments' | 'authorizations'>('members');
  const [enrollmentFilter, setEnrollmentFilter] = useState<'todos' | 'pendente' | 'em_analise' | 'rejeitado'>('todos');
  const [authFilter, setAuthFilter] = useState<'todos' | 'pendente' | 'aprovado' | 'rejeitado' | 'executado'>('todos');

  // Filtros e Pesquisa
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [statusFilter, setStatusFilter] = useState<string>('ativo');
  const [documentationFilter, setDocumentationFilter] = useState<'todas' | MemberDocumentationStatus>('todas');

  // Modais de Operação
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isUnitsModalOpen, setIsUnitsModalOpen] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);
  const [memberToInsertId, setMemberToInsertId] = useState<string>('');
  const [unitFeedback, setUnitFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [unitForm, setUnitForm] = useState({
    name: '',
    category: 'mista' as MemberCategory | 'mista',
    leaderUserId: '',
  });
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [cardMember, setCardMember] = useState<Member | null>(null);
  const [printedDossierDoc, setPrintedDossierDoc] = useState<OfficialDocument | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [rejectingReq, setRejectingReq] = useState<DeletionRequest | null>(null);
  const [rejectJustification, setRejectJustification] = useState('');
  const [isBatchRenewalOpen, setIsBatchRenewalOpen] = useState(false);
  const [documentationMember, setDocumentationMember] = useState<Member | null>(null);
  const [docStatusForm, setDocStatusForm] = useState<{
    status: MemberDocumentationStatus;
    missingDocumentsNote: string;
  }>({
    status: 'regularizado',
    missingDocumentsNote: '',
  });
  const [viewingEnrollment, setViewingEnrollment] = useState<MemberEnrollmentRequest | null>(null);
  const [viewingDocument, setViewingDocument] = useState<ViewingDocumentPayload | null>(null);
  const [isProcessingEditDoc, setIsProcessingEditDoc] = useState<'bi' | 'photo' | null>(null);
  const [approvingEnrollment, setApprovingEnrollment] = useState<MemberEnrollmentRequest | null>(null);
  const [approveEnrollmentForm, setApproveEnrollmentForm] = useState({
    manualNumber: '',
    category: 'aspirante' as MemberCategory,
    unitOrTeam: '',
    reason: '',
    documentationStatus: 'regularizado' as MemberDocumentationStatus,
    missingDocumentsNote: '',
  });
  const [rejectingEnrollment, setRejectingEnrollment] = useState<MemberEnrollmentRequest | null>(null);
  const [rejectEnrollmentReason, setRejectEnrollmentReason] = useState('');
  const [isEnrollmentScheduleModalOpen, setIsEnrollmentScheduleModalOpen] = useState(false);
  const [enrollmentScheduleForm, setEnrollmentScheduleForm] = useState({
    openDate: '',
    openTime: '',
    closeDate: '',
    closeTime: '',
    enableReconfirmation: false,
  });
  const [enrollmentScheduleError, setEnrollmentScheduleError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState<Date>(() => new Date());
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  React.useEffect(() => {
    const timer = setInterval(() => setNowTick(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  const enrollmentAvailability = useMemo(
    () => evaluateEnrollmentAvailability(state.settings.enrollmentConfig, nowTick),
    [state.settings.enrollmentConfig, nowTick]
  );

  const reconfirmationStats = useMemo(() => {
    const cfg = state.settings.enrollmentConfig;
    const eligible = (state.members || []).filter(
      (m) => m.status === 'ativo' || m.status === 'inativo'
    );
    const periodId = cfg?.periodId;
    const reconfirmed = periodId
      ? eligible.filter((m) => m.lastReconfirmedPeriodId === periodId).length
      : 0;
    const newlyEnrolled = periodId
      ? eligible.filter((m) => m.enrolledPeriodId === periodId && m.lastReconfirmedPeriodId !== periodId).length
      : 0;
    const pending = Math.max(0, eligible.length - reconfirmed - newlyEnrolled);
    return { total: eligible.length, reconfirmed, newlyEnrolled, pending };
  }, [state.members, state.settings.enrollmentConfig]);

  const handleOpenEnrollmentScheduleModal = () => {
    const existing = state.settings.enrollmentConfig;
    const now = new Date();
    setEnrollmentScheduleForm({
      openDate: existing?.isOpen && existing.openDate ? existing.openDate : getLocalTodayDateString(now),
      openTime: existing?.isOpen && existing.openTime ? existing.openTime : getLocalCurrentTimeString(now),
      closeDate: existing?.isOpen && existing.closeDate ? existing.closeDate : '',
      closeTime: existing?.isOpen && existing.closeTime ? existing.closeTime : '',
      enableReconfirmation: Boolean(existing?.enableReconfirmation),
    });
    setEnrollmentScheduleError(null);
    setIsEnrollmentScheduleModalOpen(true);
  };

  const handleReopenEnrollmentsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollmentScheduleError(null);
    const res = reopenEnrollments(enrollmentScheduleForm);
    if (!res.success) {
      setEnrollmentScheduleError(res.error || 'Não foi possível reabrir as inscrições.');
      return;
    }
    setNowTick(new Date());
    setIsEnrollmentScheduleModalOpen(false);
    const updatedAvail = evaluateEnrollmentAvailability(res.config, new Date());
    const reconfNote = res.config?.enableReconfirmation
      ? ' Reconfirmação de dados e documentos ativada para membros registados.'
      : '';
    showFeedback(
      'success',
      updatedAvail.status === 'agendadas'
        ? `Reabertura agendada: ${updatedAvail.reasonLabel}${reconfNote}`
        : `Período aberto com sucesso! ${updatedAvail.closeLabel ? `Encerramento estipulado para ${updatedAvail.closeLabel}.` : ''}${reconfNote}`
    );
  };

  const handleCloseEnrollmentsNow = () => {
    const res = closeEnrollmentsImmediately();
    if (!res.success) {
      showFeedback('error', res.error || 'Sem permissão para encerrar inscrições.');
      return;
    }
    setNowTick(new Date());
    setIsEnrollmentScheduleModalOpen(false);
    const summaryText = res.summary
      ? ` Atualização automática: ${res.summary.keptActiveCount + res.summary.activatedCount} membro(s) ativo(s) e ${res.summary.archivedCount} membro(s) arquivado(s) por falta de reconfirmação.`
      : '';
    showFeedback(
      'success',
      `Período encerrado imediatamente.${summaryText}`
    );
  };

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setActionFeedback({ type, message });
    setTimeout(() => setActionFeedback(null), 5000);
  };

  // Estados de Edição de Membro
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editFormData, setEditFormData] = useState({
    manualNumber: '',
    fullName: '',
    birthDate: '',
    gender: 'M' as 'M' | 'F',
    identityCardNumber: '',
    phone: '',
    email: '',
    address: '',
    category: 'embaixador' as MemberCategory,
    unitOrTeam: '',
    guardianName: '',
    guardianPhone: '',
    emergencyName: '',
    emergencyRelationship: '',
    emergencyPhone: '',
    bloodType: 'O+',
    allergiesOrMedicalNotes: '',
    investitureDate: '',
    professionalCourse: '',
    biDocumentFileName: '',
    biDocumentBase64: '',
    photoDocumentFileName: '',
    photoDocumentBase64: '',
  });
  const [editError, setEditError] = useState<string | null>(null);

  const handleOpenEdit = (m: Member) => {
    setEditingMember(m);
    setEditFormData({
      manualNumber: m.manualNumber,
      fullName: m.fullName,
      birthDate: m.birthDate,
      gender: m.gender || 'M',
      identityCardNumber: m.identityCardNumber,
      phone: m.phone,
      email: m.email || '',
      address: m.address || '',
      category: m.category,
      unitOrTeam: m.unitOrTeam || '',
      guardianName: m.guardianName || '',
      guardianPhone: m.guardianPhone || '',
      emergencyName: m.emergencyContact?.name || '',
      emergencyRelationship: m.emergencyContact?.relationship || '',
      emergencyPhone: m.emergencyContact?.phone || '',
      bloodType: m.bloodType || '',
      allergiesOrMedicalNotes: m.allergiesOrMedicalNotes || '',
      investitureDate: m.investitureDate || '',
      professionalCourse: m.professionalCourse || '',
      biDocumentFileName: m.biDocumentFileName || '',
      biDocumentBase64: m.biDocumentBase64 || '',
      photoDocumentFileName: m.photoDocumentFileName || '',
      photoDocumentBase64: m.photoDocumentBase64 || '',
    });
    setEditError(null);
  };

  const handleEditAttachmentUpload = async (
    slot: 'bi' | 'photo',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditError(null);
    setIsProcessingEditDoc(slot);
    try {
      const processed = await processProofFile(file);
      if (slot === 'bi') {
        setEditFormData((prev) => ({
          ...prev,
          biDocumentFileName: processed.fileName,
          biDocumentBase64: processed.base64,
        }));
      } else {
        setEditFormData((prev) => ({
          ...prev,
          photoDocumentFileName: processed.fileName,
          photoDocumentBase64: processed.base64,
        }));
      }
    } catch (err: any) {
      setEditError(err?.message || 'Erro ao processar o documento selecionado.');
    } finally {
      setIsProcessingEditDoc(null);
      e.target.value = '';
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setEditError(null);

    if (!editFormData.manualNumber.trim()) {
      setEditError('O Número de Membro manual é obrigatório.');
      return;
    }
    if (!editFormData.fullName.trim()) {
      setEditError('O Nome Completo é obrigatório.');
      return;
    }

    const updates: Partial<Member> = {
      manualNumber: editFormData.manualNumber.trim(),
      fullName: editFormData.fullName.trim(),
      birthDate: editFormData.birthDate,
      gender: editFormData.gender,
      identityCardNumber: editFormData.identityCardNumber.trim(),
      phone: editFormData.phone.trim(),
      email: editFormData.email.trim() || undefined,
      address: editFormData.address.trim(),
      category: editFormData.category,
      unitOrTeam: editFormData.unitOrTeam.trim() || undefined,
      guardianName: editFormData.guardianName.trim() || undefined,
      guardianPhone: editFormData.guardianPhone.trim() || undefined,
      bloodType: editFormData.bloodType || undefined,
      allergiesOrMedicalNotes: editFormData.allergiesOrMedicalNotes.trim() || undefined,
      professionalCourse: editFormData.professionalCourse.trim() || undefined,
      investitureDate: (editFormData.category === 'embaixador' || editFormData.category === 'lider')
        ? (editFormData.investitureDate.trim() || undefined)
        : undefined,
      biDocumentFileName: editFormData.biDocumentFileName.trim() || undefined,
      biDocumentBase64: editFormData.biDocumentBase64.trim() || undefined,
      photoDocumentFileName: editFormData.photoDocumentFileName.trim() || undefined,
      photoDocumentBase64: editFormData.photoDocumentBase64.trim() || undefined,
      ...(editFormData.photoDocumentBase64.startsWith('data:image/') && !editingMember.photoUrl
        ? { photoUrl: editFormData.photoDocumentBase64 }
        : {}),
      emergencyContact: {
        name: editFormData.emergencyName.trim() || editingMember.emergencyContact?.name || 'Não especificado',
        relationship: editFormData.emergencyRelationship.trim() || editingMember.emergencyContact?.relationship || 'Familiar',
        phone: editFormData.emergencyPhone.trim() || editingMember.emergencyContact?.phone || editFormData.phone.trim(),
      },
    };

    const res = updateMember(editingMember.id, updates);
    if (res.success) {
      setEditingMember(null);
    } else {
      setEditError(res.error || 'Erro ao atualizar membro.');
    }
  };

  // Filtro de Membros
  const filteredMembers = useMemo(() => {
    return state.members.filter((m) => {
      const matchSearch =
        m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.manualNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.identityCardNumber.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCategory =
        categoryFilter === 'todas' || m.category === categoryFilter;

      const matchStatus =
        statusFilter === 'todas' || m.status === statusFilter;

      const docStatus = resolveMemberDocumentationStatus(m);
      const matchDoc =
        documentationFilter === 'todas' || docStatus === documentationFilter;

      return matchSearch && matchCategory && matchStatus && matchDoc;
    });
  }, [state.members, searchQuery, categoryFilter, statusFilter, documentationFilter]);

  const pendingAuthCount = useMemo(() => {
    return (state.deletionRequests || []).filter((r) => r.status === 'pendente').length;
  }, [state.deletionRequests]);

  const filteredAuthRequests = useMemo(() => {
    const list = state.deletionRequests || [];
    if (authFilter === 'todos') return list;
    return list.filter((r) => r.status === authFilter);
  }, [state.deletionRequests, authFilter]);

  const pendingEnrollmentsCount = useMemo(() => {
    return (state.enrollmentRequests || []).filter(
      (r) => r.status === 'pendente' || r.status === 'em_analise'
    ).length;
  }, [state.enrollmentRequests]);

  const pendingMemberAccounts = useMemo(() => {
    return (state.users || []).filter((u) => isPendingMemberAccountConfirmation(u));
  }, [state.users]);

  const activeEnrollmentQueue = useMemo(() => {
    return (state.enrollmentRequests || []).filter((r) => r && r.status !== 'aprovado' && !r.memberDeletedAt);
  }, [state.enrollmentRequests]);

  const filteredEnrollments = useMemo(() => {
    if (enrollmentFilter === 'todos') return activeEnrollmentQueue;
    return activeEnrollmentQueue.filter((r) => r.status === enrollmentFilter);
  }, [activeEnrollmentQueue, enrollmentFilter]);

  // Submissão do Registo pela Secretaria (Mesmo formulário oficial da inscrição)
  const handleSecretaryRegisterSubmit = (formData: MemberRegistrationFormData) => {
    const fieldCheck = validateRegistrationFields(formData, 'secretary');
    if (!fieldCheck.valid) {
      return {
        success: false,
        error: fieldCheck.error || 'Preencha todos os campos obrigatórios.',
      };
    }

    if (!isMemberNumberUnique(formData.manualNumber, state.members)) {
      return {
        success: false,
        error: `O número de membro "${formData.manualNumber}" já existe no cadastro.`,
      };
    }

    const biDup = findDuplicateEnrollmentByBI(
      formData.identityCardNumber,
      state.members,
      state.enrollmentRequests || []
    );
    if (biDup.duplicate) {
      return {
        success: false,
        error: biDup.error,
      };
    }

    const duplicate = findPotentialDuplicateMember(
      formData.identityCardNumber,
      formData.fullName,
      formData.birthDate,
      state.members
    );
    if (duplicate) {
      return {
        success: false,
        error: `Detetado potencial duplicado: Já existe o membro "${duplicate.fullName}" com o mesmo B.I. ou data de nascimento.`,
      };
    }

    const result = addMember({
      manualNumber: formData.manualNumber.trim(),
      fullName: formData.fullName.trim(),
      birthDate: formData.birthDate,
      gender: formData.gender,
      identityCardNumber: normalizeIdentityCardNumber(formData.identityCardNumber),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      address: formData.address.trim(),
      category: formData.category,
      unitOrTeam: formData.unitOrTeam.trim(),
      guardianName: formData.guardianName.trim(),
      guardianPhone: formData.guardianPhone.trim(),
      guardianValidated: Boolean(formData.guardianName.trim()),
      emergencyContact: {
        name: formData.emergencyName?.trim() || formData.guardianName.trim() || formData.fullName.trim(),
        relationship: formData.emergencyRelationship?.trim() || (formData.guardianName.trim() ? 'Encarregado de Educação' : 'Familiar'),
        phone: formData.emergencyPhone?.trim() || formData.guardianPhone.trim() || formData.phone.trim(),
        phoneVerified: false,
      },
      bloodType: formData.bloodType.trim() || undefined,
      allergiesOrMedicalNotes: formData.allergiesOrMedicalNotes.trim(),
      professionalCourse: formData.professionalCourse.trim() || undefined,
      investitureDate: (formData.category === 'embaixador' || formData.category === 'lider')
        ? formData.investitureDate.trim()
        : undefined,
      joinedDate: formData.category === 'aspirante' ? getTodayISODate() : formData.joinedDate,
      annualRenewalYear: state.settings.currentYear,
      status: 'ativo',
      biDocumentFileName: (formData.biDocumentFileName || '').trim() || undefined,
      biDocumentBase64: (formData.biDocumentBase64 || '').trim() || undefined,
      photoDocumentFileName: (formData.photoDocumentFileName || '').trim() || undefined,
      photoDocumentBase64: (formData.photoDocumentBase64 || '').trim() || undefined,
      photoUrl: formData.photoDocumentBase64?.startsWith('data:image/')
        ? formData.photoDocumentBase64
        : undefined,
    });

    if (result.success) {
      setIsRegisterOpen(false);
      showFeedback('success', `Membro "${formData.fullName.trim()}" registado oficialmente no cadastro.`);
    }

    return result;
  };

  const handleInspectEnrollment = (req: MemberEnrollmentRequest) => {
    if (req.status === 'pendente' && canApproveEnrollments) {
      const res = markEnrollmentUnderReview(req.id);
      if (res.success && res.request) {
        setViewingEnrollment(res.request);
        showFeedback('success', `Inscrição ${req.protocolNumber} colocada na fase "Em análise".`);
        return;
      }
    }
    setViewingEnrollment(req);
  };

  const handleOpenDocumentationModal = (m: Member) => {
    const currentStatus = resolveMemberDocumentationStatus(m);
    setDocumentationMember(m);
    setDocStatusForm({
      status: currentStatus,
      missingDocumentsNote: m.missingDocumentsNote || '',
    });
  };

  const handleConfirmDocumentationUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentationMember) return;
    const res = updateMemberDocumentationStatus(
      documentationMember.id,
      docStatusForm.status,
      docStatusForm.missingDocumentsNote
    );
    if (res.success) {
      showFeedback(
        'success',
        docStatusForm.status === 'regularizado'
          ? `Situação documental de "${documentationMember.fullName}" marcada como Regularizada.`
          : `Situação documental de "${documentationMember.fullName}" marcada como Falta de Documento.`
      );
      setDocumentationMember(null);
    } else {
      showFeedback('error', res.error || 'Erro ao atualizar situação documental.');
    }
  };

  const handleOpenApproveEnrollment = (req: MemberEnrollmentRequest) => {
    const isPresencial = req.documentDeliveryMethod === 'presencial';
    setApprovingEnrollment(req);
    setApproveEnrollmentForm({
      manualNumber: req.manualNumber,
      category: req.category,
      unitOrTeam: req.unitOrTeam || '',
      reason: '',
      documentationStatus: isPresencial ? 'falta_documento' : 'regularizado',
      missingDocumentsNote: isPresencial
        ? 'Entrega presencial de documentos (B.I. e Fotografia) pendente na Secretaria'
        : '',
    });
  };

  const handleConfirmApproveEnrollment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingEnrollment) return;

    if (
      approveEnrollmentForm.documentationStatus === 'falta_documento' &&
      approveEnrollmentForm.missingDocumentsNote.trim().length < 3
    ) {
      showFeedback(
        'error',
        'Indique qual documento está em falta antes de confirmar a validação.'
      );
      return;
    }

    const res = approveEnrollmentRequest(approvingEnrollment.id, {
      manualNumber: approveEnrollmentForm.manualNumber,
      category: approveEnrollmentForm.category,
      unitOrTeam: approveEnrollmentForm.unitOrTeam,
      reason: approveEnrollmentForm.reason || 'Inscrição validada após análise',
      documentationStatus: approveEnrollmentForm.documentationStatus,
      missingDocumentsNote: approveEnrollmentForm.missingDocumentsNote,
    });

    if (res.success && res.member) {
      setApprovingEnrollment(null);
      setViewingEnrollment(null);
      showFeedback(
        'success',
        `Inscrição validada para "${res.member.fullName}"! Ficha adicionada automaticamente em Fichas de Membros (${res.member.manualNumber}).`
      );
    } else {
      showFeedback('error', res.error || 'Erro ao validar solicitação de inscrição.');
    }
  };

  const handleConfirmRejectEnrollment = () => {
    if (!rejectingEnrollment) return;
    const res = rejectEnrollmentRequest(rejectingEnrollment.id, rejectEnrollmentReason);
    if (res.success) {
      showFeedback('success', `Solicitação de inscrição de "${rejectingEnrollment.fullName}" marcada como "Inscrição Recusada" com registo do motivo.`);
      setRejectingEnrollment(null);
      setRejectEnrollmentReason('');
      setViewingEnrollment(null);
    } else {
      showFeedback('error', res.error || 'Erro ao recusar solicitação de inscrição.');
    }
  };

  // 1. Solicitação Formal de Arquivamento à Direção (Req 2.1)
  const handleArchiveSubmitRequest = () => {
    if (!selectedMember) return;
    if (!archiveReason || archiveReason.trim().length < 5) {
      showFeedback('error', 'É obrigatório indicar o motivo fundamentado do arquivamento (mínimo 5 caracteres).');
      return;
    }
    const res = requestMemberOperation(selectedMember.id, 'arquivamento', archiveReason);
    if (res.success) {
      setIsArchiveOpen(false);
      setArchiveReason('');
      setSelectedMember(null);
      showFeedback('success', `Pedido de autorização para arquivamento registado com sucesso. Aguarda validação da Direção.`);
    } else {
      showFeedback('error', res.error || 'Erro ao submeter pedido de arquivamento.');
    }
  };

  // 2. Solicitação Formal de Eliminação Definitiva à Direção (Req 2.1)
  const handleDeleteSubmitRequest = () => {
    if (!memberToDelete) return;
    if (!deleteReason || deleteReason.trim().length < 5) {
      showFeedback('error', 'É obrigatório indicar o motivo fundamentado da eliminação (mínimo 5 caracteres).');
      return;
    }
    const res = requestMemberOperation(memberToDelete.id, 'eliminacao', deleteReason);
    if (res.success) {
      showFeedback('success', `Pedido de autorização para eliminação definitiva registado com sucesso. Nenhum registo será eliminado antes de aprovação formal.`);
      setMemberToDelete(null);
      setDeleteReason('');
    } else {
      showFeedback('error', res.error || 'Erro ao submeter pedido de eliminação.');
    }
  };

  // 2B. Eliminação Definitiva Direta (com eliminação automática da conta vinculada sem autorização prévia do administrador)
  const handleDirectDeleteMember = () => {
    if (!memberToDelete) return;
    if (!deleteReason || deleteReason.trim().length < 5) {
      showFeedback('error', 'É obrigatório indicar o motivo fundamentado da eliminação (mínimo 5 caracteres).');
      return;
    }
    const linkedAccounts = findLinkedUserAccountsForMember(state.users, memberToDelete);
    const res = deleteMember(memberToDelete.id, true, deleteReason);
    if (res.success) {
      showFeedback(
        'success',
        linkedAccounts.length > 0
          ? `Membro "${memberToDelete.fullName}" e ${linkedAccounts.length} conta(s) de acesso vinculada(s) eliminados definitivamente com sucesso.`
          : `Membro "${memberToDelete.fullName}" eliminado definitivamente com sucesso.`
      );
      setMemberToDelete(null);
      setDeleteReason('');
    } else {
      showFeedback('error', res.error || 'Erro ao eliminar membro.');
    }
  };

  // 3. Decisão da Direção: Aprovação (Req 2.2)
  const handleApproveRequest = (reqId: string) => {
    const res = decideMemberOperationRequest(reqId, 'aprovado', 'Autorizado pela Direção');
    if (res.success) {
      showFeedback('success', 'Pedido aprovado pela Direção com sucesso. Está pronto para execução.');
    } else {
      showFeedback('error', res.error || 'Erro ao aprovar pedido.');
    }
  };

  // 4. Decisão da Direção: Rejeição com Motivo (Req 2.2)
  const handleRejectConfirm = () => {
    if (!rejectingReq) return;
    if (!rejectJustification || rejectJustification.trim().length < 3) {
      showFeedback('error', 'É obrigatório indicar uma justificação para rejeitar o pedido.');
      return;
    }
    const res = decideMemberOperationRequest(rejectingReq.id, 'rejeitado', rejectJustification);
    if (res.success) {
      setRejectingReq(null);
      setRejectJustification('');
      showFeedback('success', 'Pedido rejeitado formalmente com registo de justificação.');
    } else {
      showFeedback('error', res.error || 'Erro ao rejeitar pedido.');
    }
  };

  // 5. Execução após Aprovação Válida (Req 2.3)
  const handleExecuteRequest = (reqId: string) => {
    const req = (state.deletionRequests || []).find((r) => r.id === reqId);
    const res = executeApprovedMemberOperation(reqId);
    if (res.success) {
      if (req?.operationType === 'arquivamento') {
        showFeedback('success', `Arquivamento de "${req.targetMemberName}" executado com sucesso. Eventuais contas de login vinculadas foram desativadas automaticamente.`);
      } else if (req?.operationType === 'eliminacao') {
        showFeedback('success', `Eliminação definitiva de "${req.targetMemberName}" e contas de login vinculadas executada com sucesso.`);
      } else {
        showFeedback('success', 'Operação autorizada executada com sucesso.');
      }
    } else {
      showFeedback('error', res.error || 'Erro ao executar operação aprovada.');
    }
  };

  // Renovação Anual em Lote
  const handleBatchRenewalConfirm = () => {
    const currentYear = state.settings.currentYear;
    let renewedCount = 0;
    state.members.forEach((m) => {
      if (m.status === 'ativo' && m.annualRenewalYear < currentYear) {
        renewMemberAnnual(m.id, currentYear);
        renewedCount++;
      }
    });
    setIsBatchRenewalOpen(false);
    showFeedback('success', `Processo concluído: ${renewedCount} membros renovados para o ano ${currentYear}.`);
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {/* Banner de Feedback de Ações */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-xs transition-all ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-slate-500 hover:text-slate-700 text-xs px-2 py-0.5"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Topo do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs w-full max-w-full min-w-0">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-900 shrink-0" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Gestão de Membros Institucionais
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cadastro oficial de Membros (Embaixadores, Líderes e Aspirantes) do Clube de Embaixadores.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {can('members', 'ADMIN') && (
            <button
              onClick={() => setIsBatchRenewalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title="Renovação de Matrícula para o Ano Corrente"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Renovação em Lote</span>
            </button>
          )}

          {can('members', 'CREATE') && (
            <button
              onClick={() => {
                setIsRegisterOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Novo Membro (Secretaria)</span>
            </button>
          )}

          {canManageTeams && (
            <button
              onClick={() => {
                setEditingUnitId(null);
                setExpandedUnitId(null);
                setUnitFeedback(null);
                setUnitForm({ name: '', category: 'mista', leaderUserId: '' });
                setIsUnitsModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors shadow-xs"
            >
              <Building className="w-3.5 h-3.5" />
              <span>Gerir Equipas e Membros</span>
            </button>
          )}
        </div>
      </div>

      {/* Navegação entre Fichas de Membros, Solicitações de Inscrição e Autorizações da Direção */}
      <div className="flex border-b border-slate-200 gap-2 bg-white px-3 sm:px-5 pt-3 rounded-xl shadow-xs overflow-x-auto whitespace-nowrap w-full max-w-full min-w-0">
        <button
          type="button"
          onClick={() => setActiveView('members')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeView === 'members'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Fichas de Membros ({state.members.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveView('enrollments')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 relative ${
            activeView === 'enrollments'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Solicitação de Inscrição</span>
          {pendingEnrollmentsCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-emerald-600 text-white animate-pulse">
              {pendingEnrollmentsCount}
            </span>
          )}
          {pendingMemberAccounts.length > 0 && (
            <span
              className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-amber-500 text-white"
              title="Contas de login criadas por membros aguardando confirmação do Diretor"
            >
              {pendingMemberAccounts.length} conta(s)
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveView('authorizations')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 relative ${
            activeView === 'authorizations'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Autorizações da Direção</span>
          {pendingAuthCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-amber-500 text-white animate-pulse">
              {pendingAuthCount}
            </span>
          )}
        </button>
      </div>

      {activeView === 'members' && (
        <div className="space-y-6 w-full max-w-full min-w-0">
          {/* Barra de Filtros e Pesquisa */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-3 justify-between w-full max-w-full min-w-0">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Pesquisar por nome, B.I. ou código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
              {/* Categoria */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
              >
                <option value="todas">Todas as Categorias</option>
                <option value="embaixador">Embaixadores</option>
                <option value="lider">Líderes</option>
                <option value="aspirante">Aspirantes</option>
              </select>

              {/* Estado */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
              >
                <option value="todas">Todos os Estados</option>
                <option value="ativo">Apenas Ativos</option>
                <option value="inativo">Inativos (Sem Reconfirmação)</option>
                <option value="arquivado">Arquivados (Histórico)</option>
                <option value="transferido">Transferidos</option>
              </select>

              {/* Situação Documental */}
              <select
                value={documentationFilter}
                onChange={(e) =>
                  setDocumentationFilter(e.target.value as 'todas' | MemberDocumentationStatus)
                }
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
              >
                <option value="todas">Documentação (Todas)</option>
                <option value="regularizado">Regularizado</option>
                <option value="falta_documento">Falta de Documento</option>
              </select>
            </div>
          </div>

          {/* Tabela de Membros */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden w-full max-w-full min-w-0">
            {filteredMembers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhum membro encontrado"
                description="Não existem registos de membros correspondentes aos filtros selecionados."
                actionText={can('members', 'CREATE') ? 'Registar Novo Membro' : undefined}
                onAction={() => setIsRegisterOpen(true)}
              />
            ) : (
              <div className="overflow-x-auto w-full max-w-full min-w-0">
                <table className="w-full min-w-[900px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Identificador</th>
                      <th className="py-3 px-4">Nome Completo</th>
                      <th className="py-3 px-4">Categoria / Equipa</th>
                      <th className="py-3 px-4">B.I. (Angola)</th>
                      <th className="py-3 px-4">Documentação</th>
                      <th className="py-3 px-4">Renovação</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredMembers.map((member) => {
                      const docStatus = resolveMemberDocumentationStatus(member);
                      return (
                      <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-slate-900">{member.id}</div>
                          <div className="text-[10px] text-slate-500">Nº {member.manualNumber}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 overflow-hidden shrink-0 flex items-center justify-center">
                              {member.photoUrl ? (
                                <img src={member.photoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{member.fullName}</div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{member.phone}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {member.category === 'embaixador' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Embaixador
                              </span>
                            )}
                            {member.category === 'lider' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                Líder
                              </span>
                            )}
                            {member.category === 'aspirante' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Aspirante
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium mt-1">
                            {isDirectionMember(member, state.users) ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 font-bold text-[10px]">
                                Direção
                              </span>
                            ) : (
                              getMemberTeamLabel(member, state.users)
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                          {member.identityCardNumber}
                        </td>
                        <td className="py-3 px-4">
                          {docStatus === 'falta_documento' ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>Falta de Documento</span>
                              </span>
                              {member.missingDocumentsNote && (
                                <div
                                  className="text-[10px] text-amber-900/80 max-w-[190px] truncate"
                                  title={member.missingDocumentsNote}
                                >
                                  {member.missingDocumentsNote}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Regularizado</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[11px] font-medium ${
                            member.annualRenewalYear === state.settings.currentYear
                              ? 'text-emerald-700 font-semibold'
                              : 'text-amber-700'
                          }`}>
                            Ano {member.annualRenewalYear}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              member.status === 'ativo'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : member.status === 'inativo'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : member.status === 'transferido'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {member.status === 'ativo'
                              ? 'Ativo'
                              : member.status === 'inativo'
                              ? 'Inativo'
                              : member.status === 'transferido'
                              ? 'Transferido'
                              : 'Arquivado'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => setSelectedMember(member)}
                              className="p-1.5 text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded transition-colors"
                              title={
                                can('members', 'VIEW_DOSSIER_360')
                                  ? 'Abrir Dossiê 360º do Membro'
                                  : 'Consultar Ficha Cadastral do Membro'
                              }
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setCardMember(member)}
                              className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                              title="Emitir Cartão Digital com QR Code"
                            >
                              <CreditCard className="w-4 h-4" />
                            </button>
                            {(isSecretary || canEdit) && (
                              <button
                                onClick={() => handleOpenDocumentationModal(member)}
                                className={`p-1.5 rounded transition-colors ${
                                  docStatus === 'falta_documento'
                                    ? 'text-amber-700 hover:text-amber-900 hover:bg-amber-50'
                                    : 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50'
                                }`}
                                title="Definir Situação Documental (Regularizado / Falta de Documento)"
                              >
                                <FileCheck className="w-4 h-4" />
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => handleOpenEdit(member)}
                                className="p-1.5 text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded transition-colors"
                                title="Editar Ficha de Membro"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {can('members', 'ARCHIVE') && (member.status === 'ativo' || member.status === 'inativo') && (
                              <button
                                onClick={() => {
                                  setSelectedMember(member);
                                  setArchiveReason('');
                                  setIsArchiveOpen(true);
                                }}
                                className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-slate-100 rounded transition-colors"
                                title="Solicitar Arquivamento à Direção"
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            )}
                            {can('members', 'ARCHIVE') && member.status === 'arquivado' && (
                              <button
                                onClick={() => {
                                  const res = unarchiveMember(member.id);
                                  if (!res.success) {
                                    showFeedback('error', res.error || 'Erro ao desarquivar');
                                  } else {
                                    showFeedback('success', 'Membro desarquivado com sucesso.');
                                  }
                                }}
                                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded transition-colors"
                                title="Desarquivar Membro"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}
                            {(canDirectDeleteMember || isDirectorOrSecretary) && (
                              <button
                                onClick={() => {
                                  setMemberToDelete(member);
                                  setDeleteReason('');
                                }}
                                className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-slate-100 rounded transition-colors"
                                title={canDirectDeleteMember ? 'Eliminar Membro (e Conta Vinculada)' : 'Solicitar Eliminação à Direção'}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeView === 'enrollments' && (
        <div className="space-y-4 w-full max-w-full min-w-0">
          {/* Header e Filtros de Solicitações de Inscrição */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full max-w-full min-w-0">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-900 shrink-0" />
                <span>Solicitação de Inscrição de Novos Membros</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Fluxo: <strong>1. Pendente</strong> (aguarda visualização) → <strong>2. Em análise</strong> → <strong>3. Validada</strong> (passa automaticamente para Membros Registados e sai desta lista) ou <strong>Inscrição Recusada</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs w-full md:w-auto">
              {(
                [
                  { key: 'todos', label: 'Todas', count: activeEnrollmentQueue.length },
                  { key: 'pendente', label: 'Pendentes', count: activeEnrollmentQueue.filter((r) => r.status === 'pendente').length },
                  { key: 'em_analise', label: 'Em análise', count: activeEnrollmentQueue.filter((r) => r.status === 'em_analise').length },
                  { key: 'rejeitado', label: 'Inscrição Recusada', count: activeEnrollmentQueue.filter((r) => r.status === 'rejeitado').length },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setEnrollmentFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all border ${
                    enrollmentFilter === tab.key
                      ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          {/* Controlo do Período de Inscrições (Ecrã de Login) */}
          <div
            className={`p-4 rounded-xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full max-w-full ${
              enrollmentAvailability.status === 'abertas'
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                : enrollmentAvailability.status === 'agendadas'
                ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                : 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
            }`}
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                    enrollmentAvailability.status === 'abertas'
                      ? 'bg-emerald-100 dark:bg-emerald-900/70 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                      : enrollmentAvailability.status === 'agendadas'
                      ? 'bg-blue-100 dark:bg-blue-900/70 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700'
                      : 'bg-rose-100 dark:bg-rose-900/70 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-700'
                  }`}
                >
                  {enrollmentAvailability.status === 'abertas' ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : enrollmentAvailability.status === 'agendadas' ? (
                    <Clock className="w-3.5 h-3.5" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>{enrollmentAvailability.statusLabel}</span>
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Período de Inscrições e Reconfirmação no Clube (Ecrã de Login)
                </span>
                {enrollmentAvailability.enableReconfirmation && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/70 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700">
                    <RefreshCw className="w-3 h-3" />
                    <span>Reconfirmação Ativa</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-700 dark:text-slate-200">
                {enrollmentAvailability.reasonLabel}{' '}
                <span className="text-slate-600 dark:text-slate-300">
                  {enrollmentAvailability.isCurrentlyOpen
                    ? enrollmentAvailability.enableReconfirmation
                      ? 'Os botões «Fazer Inscrição no Clube» e «Fazer Reconfirmação de Dados» estão visíveis no ecrã de login.'
                      : 'O botão «Fazer Inscrição no Clube» está visível no ecrã de login.'
                    : 'Os botões de inscrição/reconfirmação encontram-se ocultos no ecrã de login.'}
                </span>
              </p>

              {enrollmentAvailability.enableReconfirmation && enrollmentAvailability.isCurrentlyOpen && (
                <div className="flex flex-wrap gap-3 text-[11px] text-blue-900 dark:text-blue-200 pt-0.5 font-medium">
                  <span>
                    <strong>Reconfirmados neste período:</strong> {reconfirmationStats.reconfirmed}
                  </span>
                  {reconfirmationStats.newlyEnrolled > 0 && (
                    <span>
                      <strong>Novos admitidos no período:</strong> {reconfirmationStats.newlyEnrolled}
                    </span>
                  )}
                  <span>
                    <strong>Pendentes de reconfirmação:</strong> {reconfirmationStats.pending}
                  </span>
                </div>
              )}

              {enrollmentAvailability.finalizationSummary && (
                <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 bg-white/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-lg inline-flex flex-wrap gap-3">
                  <span>
                    Definição Automática Pós-Período:{' '}
                    <strong className="text-emerald-700 dark:text-emerald-400">
                      {enrollmentAvailability.finalizationSummary.keptActiveCount +
                        enrollmentAvailability.finalizationSummary.activatedCount}{' '}
                      Ativos
                    </strong>
                    {' · '}
                    <strong className="text-rose-700 dark:text-rose-400">
                      {enrollmentAvailability.finalizationSummary.archivedCount} Arquivados (não reconfirmaram)
                    </strong>
                  </span>
                </div>
              )}

              {(enrollmentAvailability.openLabel || enrollmentAvailability.closeLabel) && state.settings.enrollmentConfig?.isOpen && (
                <div className="flex flex-wrap gap-3 text-[11px] text-slate-600 dark:text-slate-300 pt-0.5">
                  {enrollmentAvailability.openLabel && (
                    <span>
                      <strong>Abertura:</strong> {enrollmentAvailability.openLabel}
                    </span>
                  )}
                  {enrollmentAvailability.closeLabel && (
                    <span>
                      <strong>Encerramento:</strong> {enrollmentAvailability.closeLabel}
                    </span>
                  )}
                </div>
              )}

              {state.settings.enrollmentConfig?.updatedByName && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Última atualização por <strong>{state.settings.enrollmentConfig.updatedByName}</strong> em{' '}
                  {formatDateTimeAO(state.settings.enrollmentConfig.updatedAt)}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {canManageEnrollmentPeriod ? (
                <>
                  <button
                    type="button"
                    onClick={handleOpenEnrollmentScheduleModal}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {enrollmentAvailability.status === 'encerradas'
                        ? 'Reabrir Inscrições'
                        : 'Estipular Datas / Reabrir'}
                    </span>
                  </button>

                  {state.settings.enrollmentConfig?.isOpen !== false && (
                    <button
                      type="button"
                      onClick={handleCloseEnrollmentsNow}
                      className="px-3.5 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Encerrar Imediatamente</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Gestão restrita via Grelha de Permissões (Abrir / Encerrar Inscrições)</span>
                </div>
              )}
            </div>
          </div>

          {pendingMemberAccounts.length > 0 && (
            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/90 text-amber-950 space-y-3 shadow-xs w-full max-w-full">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-700 shrink-0" />
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wide text-amber-900">
                      Contas de Login Criadas por Membros · Aguardando Confirmação ({pendingMemberAccounts.length})
                    </h3>
                    <p className="text-[11px] text-amber-900/90 mt-0.5">
                      Membros com inscrição validada que definiram as suas próprias credenciais de acesso. Precisam de confirmação para ficarem ativas.
                    </p>
                  </div>
                </div>

                {!canApproveMemberAccounts && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Restrito via Grelha de Permissões (Definida pelo Administrador)</span>
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {pendingMemberAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="p-3 bg-white rounded-lg border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{acc.name}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Matrícula: <strong className="font-mono text-slate-900">{acc.manualNumber || 'S/N'}</strong>
                        {' · '}
                        E-mail: <strong className="font-mono text-slate-900">{acc.email}</strong>
                        {' · '}
                        Solicitado em {formatDateTimeAO(acc.createdAt)}
                      </div>
                    </div>

                    {canApproveMemberAccounts && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const res = approvePendingMemberAccount(acc.id);
                            if (res.success) {
                              showFeedback(
                                'success',
                                `Conta de login de "${acc.name}" confirmada e ativada com sucesso!`
                              );
                            } else {
                              showFeedback('error', res.error || 'Erro ao confirmar conta de login.');
                            }
                          }}
                          className="px-3 py-1.5 text-[11px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg shadow-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Confirmar e Ativar Conta</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const res = rejectPendingMemberAccount(
                              acc.id,
                              'Solicitação de conta recusada na gestão de inscrições.'
                            );
                            if (res.success) {
                              showFeedback(
                                'success',
                                `Solicitação de conta de "${acc.name}" recusada e removida.`
                              );
                            } else {
                              showFeedback('error', res.error || 'Erro ao recusar conta.');
                            }
                          }}
                          className="px-3 py-1.5 text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Recusar</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!canApproveEnrollments && (
            <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-950 dark:text-amber-200 flex items-start gap-2.5 w-full max-w-full">
              <Lock className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Modo apenas de consulta</p>
                <p className="text-[11px] text-amber-900 dark:text-amber-300 mt-0.5">
                  O seu cargo atual não tem a permissão <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">Validar / Recusar Inscrições</code> ativa na Grelha de Permissões gerida pelo Administrador Técnico.
                </p>
              </div>
            </div>
          )}

          {/* Tabela de Solicitações de Inscrição */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden w-full max-w-full min-w-0">
            {filteredEnrollments.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Nenhuma solicitação de inscrição encontrada"
                description={
                  enrollmentFilter === 'todos'
                    ? 'Quando um candidato preencher o formulário de inscrição no clube, a solicitação aparecerá aqui na fase Pendente para análise da Secretaria.'
                    : 'Não existem solicitações de inscrição nesta fase.'
                }
              />
            ) : (
              <div className="overflow-x-auto w-full max-w-full min-w-0">
                <table className="w-full min-w-[850px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Protocolo / Submissão</th>
                      <th className="py-3 px-4">Candidato</th>
                      <th className="py-3 px-4">Categoria / Equipa</th>
                      <th className="py-3 px-4">B.I. & Nascimento</th>
                      <th className="py-3 px-4">Fase / Decisão</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredEnrollments.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-blue-900">{req.protocolNumber}</div>
                          <div className="text-[10px] text-slate-500">Matrícula: {req.manualNumber}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{formatDateTimeAO(req.submittedAt)}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{req.fullName}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{req.phone}</span>
                          </div>
                          {req.email && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{req.email}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              req.category === 'embaixador'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : req.category === 'lider'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {req.category}
                          </span>
                          <div className="text-[11px] text-slate-500 mt-1">{req.unitOrTeam || 'Definida na validação'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono text-[11px] text-slate-700">{req.identityCardNumber}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">Nasc.: {formatDateAO(req.birthDate)}</div>
                        </td>
                        <td className="py-3 px-4">
                          {req.status === 'pendente' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3" />
                              <span>1. Pendente</span>
                            </span>
                          )}
                          {req.status === 'em_analise' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                <FileSearch className="w-3 h-3" />
                                <span>2. Em análise</span>
                              </span>
                              {req.underReviewStartedByName && (
                                <div className="text-[10px] text-slate-500 mt-1">
                                  Analista: <strong>{req.underReviewStartedByName}</strong>
                                </div>
                              )}
                            </div>
                          )}
                          {req.status === 'aprovado' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle className="w-3 h-3" />
                                <span>3. Inscrição validada</span>
                              </span>
                              <div className="text-[10px] text-slate-500 mt-1">
                                Por: <strong>{req.reviewedByName}</strong> ({formatDateAO(req.reviewedAt || '')})
                              </div>
                              {req.createdMemberId && (
                                <div className="text-[10px] text-emerald-800 font-mono">
                                  Membro: {req.createdMemberId}
                                </div>
                              )}
                            </div>
                          )}
                          {req.status === 'rejeitado' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                <XCircle className="w-3 h-3" />
                                <span>3. Inscrição Recusada</span>
                              </span>
                              <div className="text-[10px] text-slate-500 mt-1">
                                Por: <strong>{req.reviewedByName}</strong>
                              </div>
                              {req.decisionReason && (
                                <div className="text-[10px] text-rose-700 italic mt-0.5 bg-rose-50/50 p-1 rounded">
                                  "{req.decisionReason}"
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleInspectEnrollment(req)}
                              className="p-1.5 text-slate-600 hover:text-blue-900 hover:bg-slate-100 rounded transition-colors"
                              title={
                                req.status === 'pendente' && canApproveEnrollments
                                  ? 'Visualizar Ficha e Colocar Em Análise'
                                  : 'Consultar Ficha Completa Submetida'
                              }
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {(req.status === 'pendente' || req.status === 'em_analise') && canApproveEnrollments && (
                              <>
                                {req.status === 'pendente' && (
                                  <button
                                    type="button"
                                    onClick={() => handleInspectEnrollment(req)}
                                    className="px-2.5 py-1.5 text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded flex items-center gap-1 transition-colors"
                                    title="Visualizar ficha e passar para a fase Em análise"
                                  >
                                    <FileSearch className="w-3 h-3" />
                                    <span>Analisar</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleOpenApproveEnrollment(req)}
                                  className="px-2.5 py-1.5 text-[11px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded shadow-xs flex items-center gap-1 transition-colors"
                                  title="Validar Inscrição e Criar Membro Oficial"
                                >
                                  <UserCheck className="w-3 h-3" />
                                  <span>Validar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectingEnrollment(req);
                                    setRejectEnrollmentReason('');
                                  }}
                                  className="px-2 py-1.5 text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded transition-colors"
                                  title="Recusar Solicitação de Inscrição"
                                >
                                  <XCircle className="w-3 h-3" />
                                  <span>Recusar</span>
                                </button>
                              </>
                            )}

                            {req.status === 'pendente' && !canApproveEnrollments && (
                              <span className="text-[10px] text-slate-400 italic">
                                Sem permissão na grelha
                              </span>
                            )}

                            {req.status === 'aprovado' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveView('members');
                                  setStatusFilter('todas');
                                  setCategoryFilter('todas');
                                  setDocumentationFilter('todas');
                                  setSearchQuery(req.manualNumber || req.fullName);
                                }}
                                className="px-2.5 py-1.5 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded flex items-center gap-1 transition-colors"
                                title="Localizar este membro em Fichas de Membros"
                              >
                                <Users className="w-3 h-3" />
                                <span>Ver em Fichas</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeView === 'authorizations' && (
        <div className="space-y-4 w-full max-w-full min-w-0">
          {/* Header e Filtros de Autorização */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full max-w-full min-w-0">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-900 shrink-0" />
                <span>Fluxo de Autorização Prévia da Direção</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Nenhum membro pode ser eliminado ou arquivado definitivamente sem validação e autorização formal da Direção.
              </p>
            </div>

            {/* Filtros de Estado */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs w-full md:w-auto">
              {(
                [
                  { key: 'todos', label: 'Todos', count: (state.deletionRequests || []).length },
                  { key: 'pendente', label: 'Pendentes', count: pendingAuthCount },
                  { key: 'aprovado', label: 'Aprovados', count: (state.deletionRequests || []).filter((r) => r.status === 'aprovado').length },
                  { key: 'rejeitado', label: 'Rejeitados', count: (state.deletionRequests || []).filter((r) => r.status === 'rejeitado').length },
                  { key: 'executado', label: 'Executados', count: (state.deletionRequests || []).filter((r) => r.status === 'executado').length },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setAuthFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all border ${
                    authFilter === tab.key
                      ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          {/* Aviso Institucional e Integridade de Dados */}
          <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl text-xs text-blue-950 flex items-start gap-2.5 w-full max-w-full">
            <Shield className="w-4 h-4 text-blue-800 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Regras Institucionais e Salvaguarda de Auditoria (Req. 2.1 a 2.4):</p>
              <p className="text-[11px] leading-relaxed text-blue-900">
                1. <strong>Solicitação:</strong> Gera um pedido pendente sem alterar nem remover a ficha do membro.<br />
                2. <strong>Autorização:</strong> Apenas responsáveis da Direção com permissões adequadas na grelha (<code className="font-mono bg-blue-100 px-1 py-0.5 rounded">members: ADMIN</code> para eliminação e <code className="font-mono bg-blue-100 px-1 py-0.5 rounded">members: ARCHIVE</code> para arquivamento) podem aprovar ou rejeitar com justificação. É impedida a auto-aprovação de pedidos próprios.<br />
                3. <strong>Execução e Conservação:</strong> A execução só ocorre após autorização formal ativa. Recibos de quotas, movimentos de caixa e documentos emitidos <strong>nunca são apagados</strong>, assegurando a integridade histórica e contabilística do clube.
              </p>
            </div>
          </div>

          {/* Lista de Pedidos de Autorização */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden w-full max-w-full min-w-0">
            {filteredAuthRequests.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="Nenhum pedido de autorização registado"
                description={
                  authFilter === 'todos'
                    ? 'Ainda não foram solicitadas eliminações ou arquivamentos de membros.'
                    : `Não existem pedidos com o estado "${authFilter}".`
                }
              />
            ) : (
              <div className="overflow-x-auto w-full max-w-full min-w-0">
                <table className="w-full min-w-[850px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Pedido / Membro Alvo</th>
                      <th className="py-3 px-4">Operação</th>
                      <th className="py-3 px-4">Solicitante</th>
                      <th className="py-3 px-4">Motivo Apresentado</th>
                      <th className="py-3 px-4">Estado / Decisão</th>
                      <th className="py-3 px-4 text-right">Ação da Direção</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredAuthRequests.map((req) => {
                      const isTargetDelete = req.operationType === 'eliminacao';
                      const canApproveOperation = isTargetDelete
                        ? can('members', 'ADMIN') && (isDirector || isAdmin)
                        : can('members', 'ARCHIVE') && (isDirector || isAdmin);
                      const isOwnRequest = req.requestedByUserId === currentUser.id;
                      const canApproveStrict = canApproveOperation && (!isOwnRequest || isAdmin || isDirector);

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{req.targetMemberName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Nº {req.targetMemberManualNumber || 'S/N'} · ID: {req.targetId}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">Ref: {req.id}</div>
                          </td>
                          <td className="py-3 px-4">
                            {isTargetDelete ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <Trash2 className="w-3 h-3" />
                                <span>Eliminação</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Archive className="w-3 h-3" />
                                <span>Arquivamento</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{req.requestedByName}</div>
                            <div className="text-[10px] text-slate-500">
                              {req.requestedByRole ? (ROLE_LABELS[req.requestedByRole]?.label || req.requestedByRole) : 'Membro'}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{formatDateAO(req.requestedAt)}</div>
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <p className="text-slate-800 line-clamp-3 leading-snug">{req.reason}</p>
                          </td>
                          <td className="py-3 px-4">
                            {req.status === 'pendente' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3" />
                                <span>Aguardando Direção</span>
                              </span>
                            )}
                            {req.status === 'aprovado' && (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>Aprovado</span>
                                </span>
                                <div className="text-[10px] text-slate-500 mt-1">
                                  Por: <strong>{req.decidedByName}</strong> ({formatDateAO(req.decidedAt || '')})
                                </div>
                              </div>
                            )}
                            {req.status === 'rejeitado' && (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                  <XCircle className="w-3 h-3" />
                                  <span>Rejeitado</span>
                                </span>
                                <div className="text-[10px] text-slate-500 mt-1">
                                  Por: <strong>{req.decidedByName}</strong>
                                </div>
                                {req.decisionReason && (
                                  <div className="text-[10px] text-rose-700 italic mt-0.5 bg-rose-50/50 p-1 rounded">
                                    "{req.decisionReason}"
                                  </div>
                                )}
                              </div>
                            )}
                            {req.status === 'executado' && (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                  <Check className="w-3 h-3" />
                                  <span>Executado</span>
                                </span>
                                <div className="text-[10px] text-slate-500 mt-1">
                                  Por: <strong>{req.executedByName}</strong> ({formatDateAO(req.executedAt || '')})
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {req.status === 'pendente' && (
                              <div className="flex items-center justify-end gap-1.5">
                                {canApproveStrict ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleApproveRequest(req.id)}
                                      className="px-2.5 py-1.5 text-[11px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded shadow-xs flex items-center gap-1 transition-colors"
                                      title="Aprovar Pedido de Operação"
                                    >
                                      <ShieldCheck className="w-3 h-3" />
                                      <span>Aprovar</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRejectingReq(req);
                                        setRejectJustification('');
                                      }}
                                      className="px-2 py-1.5 text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded transition-colors"
                                      title="Rejeitar Pedido com Justificação"
                                    >
                                      <XCircle className="w-3 h-3" />
                                      <span>Rejeitar</span>
                                    </button>
                                  </>
                                ) : (isOwnRequest && !isDirector && !isAdmin) ? (
                                  <span className="text-[10px] text-slate-400 italic">
                                    Auto-aprovação impedida
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">
                                    Sem permissão na grelha
                                  </span>
                                )}
                              </div>
                            )}

                            {req.status === 'aprovado' && (
                              <div className="flex items-center justify-end gap-1.5">
                                {(isTargetDelete ? canExecuteApprovedDelete : can('members', 'ARCHIVE')) ? (
                                  <button
                                    type="button"
                                    onClick={() => handleExecuteRequest(req.id)}
                                    className="px-3 py-1.5 text-[11px] font-bold bg-blue-900 hover:bg-blue-800 text-white rounded shadow-xs flex items-center gap-1.5 transition-colors"
                                    title="Efetivar a operação autorizada no sistema (contas vinculadas são eliminadas automaticamente)"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Executar Operação</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">
                                    Aguardando executor com permissão
                                  </span>
                                )}
                              </div>
                            )}

                            {(req.status === 'rejeitado' || req.status === 'executado') && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                Concluído
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: Formulário Completo de Registo (Secretaria - mesmo formulário da auto-inscrição) */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Registo Institucional de Membro"
        description="Preencha os dados institucionais oficiais. O registo de membro é independente da conta de acesso."
        maxWidth="3xl"
      >
        <MemberRegistrationForm
          mode="secretary"
          units={state.settings.units}
          onSubmit={handleSecretaryRegisterSubmit}
          onCancel={() => setIsRegisterOpen(false)}
        />
      </Modal>

      {/* MODAL: Visualizar Ficha Completa da Solicitação de Inscrição */}
      {viewingEnrollment && (
        <Modal
          isOpen={Boolean(viewingEnrollment)}
          onClose={() => setViewingEnrollment(null)}
          title={`Solicitação de Inscrição: ${viewingEnrollment.protocolNumber}`}
          description={`Submetida em ${formatDateTimeAO(viewingEnrollment.submittedAt)}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Nº de Matrícula</span>
                <span className="font-mono font-bold text-blue-900">{viewingEnrollment.manualNumber}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Nome Completo</span>
                <span className="font-bold text-slate-900 text-sm">{viewingEnrollment.fullName}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">B.I. (Angola)</span>
                <span className="font-mono text-slate-800">{viewingEnrollment.identityCardNumber}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Data de Nascimento</span>
                <span className="text-slate-800">{formatDateAO(viewingEnrollment.birthDate)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Sexo</span>
                <span className="text-slate-800">{viewingEnrollment.gender === 'M' ? 'Masculino' : 'Feminino'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Telefone</span>
                <span className="text-slate-800">{viewingEnrollment.phone}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">E-mail</span>
                <span className="text-slate-800">{viewingEnrollment.email || 'Não informado'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Município / Bairro</span>
                <span className="text-slate-800">{viewingEnrollment.address || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Categoria</span>
                <span className="font-bold uppercase text-indigo-800">{viewingEnrollment.category}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Equipa</span>
                <span className="text-slate-800">{viewingEnrollment.unitOrTeam || 'Definida na autorização'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Data de Admissão</span>
                <span className="text-slate-800">
                  {viewingEnrollment.joinedDate ? formatDateAO(viewingEnrollment.joinedDate) : 'Definida na validação pela Secretaria'}
                </span>
              </div>
              {viewingEnrollment.investitureDate && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Investidura</span>
                  <span className="text-slate-800">{formatDateAO(viewingEnrollment.investitureDate)}</span>
                </div>
              )}
              {viewingEnrollment.professionalCourse && (
                <div className="sm:col-span-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Curso Profissional</span>
                  <span className="text-slate-800">{viewingEnrollment.professionalCourse}</span>
                </div>
              )}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Encarregado de Educação</span>
                <span className="text-slate-800">{viewingEnrollment.guardianName || 'Não informado'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Tel. Encarregado</span>
                <span className="text-slate-800">{viewingEnrollment.guardianPhone || 'Não informado'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Grupo Sanguíneo</span>
                <span className="font-bold text-rose-700">{viewingEnrollment.bloodType || 'Não informado'}</span>
              </div>
              {viewingEnrollment.allergiesOrMedicalNotes && (
                <div className="sm:col-span-3">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Alergias / Cuidados Médicos</span>
                  <span className="text-slate-800">{viewingEnrollment.allergiesOrMedicalNotes}</span>
                </div>
              )}
              <div className="sm:col-span-3 pt-2 border-t border-slate-200 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500">
                    Entrega de Documentos (B.I. e Fotografia)
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                      viewingEnrollment.documentDeliveryMethod === 'anexar_digital'
                        ? 'bg-blue-50 text-blue-900 border-blue-200'
                        : 'bg-amber-50 text-amber-900 border-amber-200'
                    }`}
                  >
                    {viewingEnrollment.documentDeliveryMethod === 'anexar_digital'
                      ? 'Anexados Digitalmente'
                      : 'Entrega Presencial na Secretaria'}
                  </span>
                </div>

                {(viewingEnrollment.documentDeliveryMethod === 'anexar_digital' ||
                  viewingEnrollment.biDocumentBase64 ||
                  viewingEnrollment.photoDocumentBase64) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {viewingEnrollment.biDocumentBase64 && (
                      <div className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2">
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                            B.I. / Documento Anexado
                          </span>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white truncate block">
                            {viewingEnrollment.biDocumentFileName || 'Documento B.I.'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setViewingDocument({
                                title: `Documento B.I. · ${viewingEnrollment.fullName}`,
                                fileName:
                                  viewingEnrollment.biDocumentFileName ||
                                  `BI-${viewingEnrollment.protocolNumber}`,
                                base64: viewingEnrollment.biDocumentBase64 || '',
                                subtitle: `Protocolo ${viewingEnrollment.protocolNumber}`,
                              })
                            }
                            className="px-2.5 py-1.5 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Visualizar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadDocumentFile(
                                viewingEnrollment.biDocumentBase64 || '',
                                viewingEnrollment.biDocumentFileName ||
                                  `BI-${viewingEnrollment.protocolNumber}`
                              )
                            }
                            className="px-2.5 py-1.5 text-[11px] font-bold bg-blue-900 hover:bg-blue-800 text-white rounded inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Baixar</span>
                          </button>
                        </div>
                      </div>
                    )}
                    {viewingEnrollment.photoDocumentBase64 && (
                      <div className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {viewingEnrollment.photoDocumentBase64.startsWith('data:image/') && (
                            <img
                              src={viewingEnrollment.photoDocumentBase64}
                              alt="Fotografia"
                              className="w-8 h-8 rounded object-cover border border-slate-200 dark:border-slate-600 shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block">
                              Fotografia Anexada
                            </span>
                            <span className="text-xs font-semibold text-slate-900 dark:text-white truncate block">
                              {viewingEnrollment.photoDocumentFileName || 'Fotografia'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setViewingDocument({
                                title: `Fotografia Anexada · ${viewingEnrollment.fullName}`,
                                fileName:
                                  viewingEnrollment.photoDocumentFileName ||
                                  `Foto-${viewingEnrollment.protocolNumber}`,
                                base64: viewingEnrollment.photoDocumentBase64 || '',
                                subtitle: `Protocolo ${viewingEnrollment.protocolNumber}`,
                              })
                            }
                            className="px-2.5 py-1.5 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Visualizar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadDocumentFile(
                                viewingEnrollment.photoDocumentBase64 || '',
                                viewingEnrollment.photoDocumentFileName ||
                                  `Foto-${viewingEnrollment.protocolNumber}`
                              )
                            }
                            className="px-2.5 py-1.5 text-[11px] font-bold bg-blue-900 hover:bg-blue-800 text-white rounded inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Baixar</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <EnrollmentStatusCard
              request={
                state.enrollmentRequests?.find((r) => r.id === viewingEnrollment.id) ||
                viewingEnrollment
              }
              compact
            />

            {(viewingEnrollment.status === 'em_analise' || viewingEnrollment.status === 'pendente') && canApproveEnrollments && (
              <div className="p-3.5 bg-blue-50/70 dark:bg-slate-800/80 border border-blue-200 dark:border-blue-900/60 rounded-xl space-y-2">
                <label className="block font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-800 dark:text-blue-400" />
                  <span>Mensagem da Secretaria para o Candidato (Em Análise)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Estamos a analisar a sua documentação. Por favor confirme o seu contacto."
                  defaultValue={viewingEnrollment.reviewMessage || ''}
                  id="enrollmentReviewMessageInput"
                  className="w-full p-2.5 border border-blue-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const inputEl = document.getElementById('enrollmentReviewMessageInput') as HTMLTextAreaElement;
                      if (inputEl) {
                        const msg = inputEl.value;
                        const res = updateEnrollmentReviewMessage(viewingEnrollment.id, msg);
                        if (res.success) {
                          showFeedback('success', 'Mensagem de análise atualizada com sucesso para o candidato.');
                          const latestReq = state.enrollmentRequests?.find((r) => r.id === viewingEnrollment.id);
                          if (latestReq) setViewingEnrollment(latestReq);
                        } else {
                          showFeedback('error', res.error || 'Erro ao atualizar mensagem.');
                        }
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded shadow-xs"
                  >
                    Guardar Mensagem para o Candidato
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewingEnrollment(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Fechar
              </button>
              {(viewingEnrollment.status === 'pendente' || viewingEnrollment.status === 'em_analise') && canApproveEnrollments && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingEnrollment(viewingEnrollment);
                      setRejectEnrollmentReason('');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg"
                  >
                    Recusar Inscrição
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenApproveEnrollment(viewingEnrollment)}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Validar Inscrição</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Validar Solicitação de Inscrição */}
      {approvingEnrollment && (
        <Modal
          isOpen={Boolean(approvingEnrollment)}
          onClose={() => setApprovingEnrollment(null)}
          title={`Validar Inscrição: ${approvingEnrollment.fullName}`}
          description={`Protocolo ${approvingEnrollment.protocolNumber} — Defina a equipa e confirme os dados para marcar como Inscrição Validada.`}
          maxWidth="lg"
        >
          <form onSubmit={handleConfirmApproveEnrollment} className="space-y-4 text-xs">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950">
              Ao confirmar, a inscrição é validada, o candidato passa para <strong>Membros Registados</strong> e o pedido sai automaticamente da fila de Solicitações de Inscrição.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nº de Matrícula Oficial</label>
                <input
                  type="text"
                  value={approveEnrollmentForm.manualNumber}
                  onChange={(e) => setApproveEnrollmentForm({ ...approveEnrollmentForm, manualNumber: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded font-mono font-bold text-blue-900"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Categoria</label>
                <select
                  value={approveEnrollmentForm.category}
                  onChange={(e) =>
                    setApproveEnrollmentForm({ ...approveEnrollmentForm, category: e.target.value as MemberCategory })
                  }
                  className="w-full p-2 border border-slate-200 rounded bg-white"
                >
                  <option value="embaixador">Embaixador</option>
                  <option value="lider">Líder</option>
                  <option value="aspirante">Aspirante</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Equipa</label>
                <select
                  value={approveEnrollmentForm.unitOrTeam}
                  onChange={(e) => setApproveEnrollmentForm({ ...approveEnrollmentForm, unitOrTeam: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded bg-white"
                >
                  <option value="">Sem Equipa</option>
                  {state.settings.units.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
              <label className="block font-semibold text-slate-800">
                Situação Documental na Secretaria
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setApproveEnrollmentForm({
                      ...approveEnrollmentForm,
                      documentationStatus: 'regularizado',
                      missingDocumentsNote: '',
                    })
                  }
                  className={`p-2.5 rounded-lg border text-left transition-colors ${
                    approveEnrollmentForm.documentationStatus === 'regularizado'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Regularizado</span>
                  </div>
                  <p className="text-[10px] font-normal opacity-80 mt-0.5">
                    Documentação completa e conforme
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setApproveEnrollmentForm({
                      ...approveEnrollmentForm,
                      documentationStatus: 'falta_documento',
                    })
                  }
                  className={`p-2.5 rounded-lg border text-left transition-colors ${
                    approveEnrollmentForm.documentationStatus === 'falta_documento'
                      ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Falta de Documento</span>
                  </div>
                  <p className="text-[10px] font-normal opacity-80 mt-0.5">
                    Registar documento pendente na Secretaria
                  </p>
                </button>
              </div>
              {approveEnrollmentForm.documentationStatus === 'falta_documento' && (
                <div>
                  <label className="block font-semibold text-amber-900 dark:text-amber-200 mb-1">
                    Especifique o(s) documento(s) em falta <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Falta cópia do B.I. e 2 fotografias tipo passe"
                    value={approveEnrollmentForm.missingDocumentsNote}
                    onChange={(e) =>
                      setApproveEnrollmentForm({
                        ...approveEnrollmentForm,
                        missingDocumentsNote: e.target.value,
                      })
                    }
                    className="w-full p-2 border border-amber-300 dark:border-amber-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Observação da Secretaria (Opcional)</label>
              <input
                type="text"
                placeholder="Ex: Ficha conferida e validada pela Secretaria"
                value={approveEnrollmentForm.reason}
                onChange={(e) => setApproveEnrollmentForm({ ...approveEnrollmentForm, reason: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setApprovingEnrollment(null)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Confirmar Validação</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Recusar Solicitação de Inscrição */}
      {rejectingEnrollment && (
        <Modal
          isOpen={Boolean(rejectingEnrollment)}
          onClose={() => {
            setRejectingEnrollment(null);
            setRejectEnrollmentReason('');
          }}
          title={`Recusar Inscrição: ${rejectingEnrollment.fullName}`}
          description={`Protocolo ${rejectingEnrollment.protocolNumber} — Indique o motivo da não autorização.`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Motivo / Justificação <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Dados de B.I. incorretos / Candidato fora da faixa etária (mínimo 3 caracteres)"
                value={rejectEnrollmentReason}
                onChange={(e) => setRejectEnrollmentReason(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setRejectingEnrollment(null);
                  setRejectEnrollmentReason('');
                }}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={rejectEnrollmentReason.trim().length < 3}
                onClick={handleConfirmRejectEnrollment}
                className="px-4 py-1.5 font-bold text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-40 rounded shadow-xs flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Confirmar Recusa</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: Dossiê 360º do Membro (Dados & Saúde, Formação, Assiduidade, Quotas & Histórico) */}
      <MemberDossierModal
        member={
          selectedMember && !isArchiveOpen
            ? state.members.find((m) => m.id === selectedMember.id) || selectedMember
            : null
        }
        canEdit={canEdit}
        canEditCategory={canEditCategory}
        onClose={() => setSelectedMember(null)}
        onOpenCard={(m) => setCardMember(m)}
        onOpenEdit={(m) => handleOpenEdit(m)}
        onPrintDocument={(doc) => setPrintedDossierDoc(doc)}
        onFeedback={showFeedback}
      />

      {/* MODAL 3: Solicitação Formal de Arquivamento à Direção (Req 2.1) */}
      {selectedMember && isArchiveOpen && (
        <Modal
          isOpen={isArchiveOpen}
          onClose={() => {
            setIsArchiveOpen(false);
            setArchiveReason('');
          }}
          title={`Solicitar Arquivamento: ${selectedMember.fullName}`}
          description="Fluxo formal de solicitação com validação prévia obrigatória pela Direção."
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-800" />
                <span>Procedimento Institucional de Autorização</span>
              </p>
              <p className="text-[11px] leading-relaxed">
                A submissão deste formulário cria um pedido de autorização pendente para a Direção. O membro continua ativo e operacional no sistema até aprovação e execução formal da operação.
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-[11px] space-y-1">
              <div>Identificador Único: <strong>{selectedMember.id}</strong></div>
              <div>Nº de Matrícula: <strong>{selectedMember.manualNumber}</strong></div>
              <div>Nome: <strong>{selectedMember.fullName}</strong></div>
              <div>Categoria: <strong>{selectedMember.category.toUpperCase()}</strong></div>
            </div>

            {(() => {
              const linkedForArchive = findLinkedUserAccountsForMember(state.users, selectedMember);
              if (linkedForArchive.length === 0) return null;
              return (
                <div className="p-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl space-y-1">
                  <p className="font-bold text-[11px] flex items-center gap-1.5 text-slate-900">
                    <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Conta(s) de Login Vinculada(s) ({linkedForArchive.length})</span>
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Quando o arquivamento for executado, a(s) conta(s) abaixo será(ão) <strong>desativada(s) automaticamente</strong> até que a ficha seja desarquivada:
                  </p>
                  <ul className="space-y-1 pt-0.5">
                    {linkedForArchive.map((acc) => (
                      <li key={acc.id} className="font-mono text-[11px] bg-white px-2 py-1 rounded border border-slate-200">
                        {acc.name} ({acc.email})
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Motivo fundamentado do arquivamento <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Pedido formal de transferência para outra congregação / Mudança de província (mínimo 5 caracteres)"
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-900 text-xs"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsArchiveOpen(false);
                  setArchiveReason('');
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={archiveReason.trim().length < 5}
                onClick={handleArchiveSubmitRequest}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-40 rounded shadow-xs flex items-center gap-1.5"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Submeter Pedido à Direção</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Eliminação Definitiva ou Solicitação à Direção (Req 2.1 & 2.4 + Eliminação automática da conta vinculada) */}
      {memberToDelete && (() => {
        const linkedAccounts = findLinkedUserAccountsForMember(state.users, memberToDelete);
        return (
          <Modal
            isOpen={Boolean(memberToDelete)}
            onClose={() => {
              setMemberToDelete(null);
              setDeleteReason('');
            }}
            title={
              canDirectDeleteMember
                ? `Eliminar Membro Definitivamente: ${memberToDelete.fullName}`
                : `Solicitar Eliminação Definitiva: ${memberToDelete.fullName}`
            }
            description={
              canDirectDeleteMember
                ? 'A ficha do membro e qualquer conta de acesso vinculada serão eliminadas sem necessidade de autorização prévia do administrador.'
                : 'Fluxo formal de autorização prévia da Direção com preservação de registos financeiros.'
            }
            maxWidth="md"
          >
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-950 dark:text-rose-100 rounded-xl space-y-2">
                <p className="font-bold text-xs text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0" />
                  <span>
                    {canDirectDeleteMember
                      ? 'Eliminação Definitiva & Salvaguarda Contabilística'
                      : 'Salvaguarda e Autorização Prévia da Direção'}
                  </span>
                </p>
                <p className="leading-relaxed">
                  {canDirectDeleteMember ? (
                    <>
                      A eliminação remove permanentemente a ficha do membro. Todos os recibos emitidos, quotas liquidadas e documentos oficiais <strong>são preservados permanentemente</strong> para auditoria.
                    </>
                  ) : (
                    <>
                      A solicitação criará um pedido de autorização pendente na Direção. Após aprovação e execução (pela Secretaria ou Direção), os recibos e documentos oficiais <strong>são preservados permanentemente</strong> para auditoria.
                    </>
                  )}
                </p>
                <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded border border-rose-200 dark:border-rose-800 font-mono text-[11px] text-slate-800 dark:text-slate-100">
                  Membro: <strong>{memberToDelete.fullName}</strong> · Nº: <strong>{memberToDelete.manualNumber}</strong> · ID: <strong>{memberToDelete.id}</strong>
                </div>
              </div>

              {linkedAccounts.length > 0 && (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-100 rounded-xl space-y-1.5">
                  <p className="font-bold text-xs flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>Conta(s) de Acesso Vinculada(s) Detetada(s) ({linkedAccounts.length})</span>
                  </p>
                  <p className="leading-relaxed text-[11px]">
                    Com a eliminação deste membro, a(s) conta(s) abaixo será(ão) <strong>eliminada(s) automaticamente em simultâneo</strong>, sem necessidade de autorização prévia do Administrador Técnico:
                  </p>
                  <ul className="space-y-1 pt-1">
                    {linkedAccounts.map((acc) => (
                      <li
                        key={acc.id}
                        className="font-mono text-[11px] bg-white/80 dark:bg-slate-900/80 px-2 py-1 rounded border border-amber-200 dark:border-amber-800 text-slate-800 dark:text-slate-100"
                      >
                        {acc.name} ({acc.email}) · {ROLE_LABELS[acc.role]?.label || acc.role}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                  Motivo fundamentado da eliminação <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: Duplicação de registo comprovada por certidão / Cancelamento definitivo de admissão (mínimo 5 caracteres)"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setMemberToDelete(null);
                    setDeleteReason('');
                  }}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancelar
                </button>
                {canDirectDeleteMember ? (
                  <>
                    {isSecretary && !isDirector && !isAdmin && (
                      <button
                        type="button"
                        disabled={deleteReason.trim().length < 5}
                        onClick={handleDeleteSubmitRequest}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 rounded transition-colors"
                      >
                        Submeter Pedido à Direção
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={deleteReason.trim().length < 5}
                      onClick={handleDirectDeleteMember}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-40 rounded shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>
                        {linkedAccounts.length > 0
                          ? 'Eliminar Membro e Conta Vinculada'
                          : 'Eliminar Membro Definitivamente'}
                      </span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={deleteReason.trim().length < 5}
                    onClick={handleDeleteSubmitRequest}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-40 rounded shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Submeter Pedido de Eliminação à Direção</span>
                  </button>
                )}
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* MODAL: Rejeição de Pedido de Autorização com Justificação Obrigatória (Req 2.2) */}
      {rejectingReq && (
        <Modal
          isOpen={Boolean(rejectingReq)}
          onClose={() => {
            setRejectingReq(null);
            setRejectJustification('');
          }}
          title={`Rejeitar Pedido: ${rejectingReq.operationType === 'eliminacao' ? 'Eliminação' : 'Arquivamento'}`}
          description="Indique formalmente a fundamentação da Direção para a rejeição do pedido."
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 font-mono text-[11px]">
              <div>Membro Alvo: <strong>{rejectingReq.targetMemberName}</strong> (Nº {rejectingReq.targetMemberManualNumber || 'S/N'})</div>
              <div>Solicitado por: <strong>{rejectingReq.requestedByName}</strong> ({rejectingReq.requestedByRole})</div>
              <div>Motivo Inicial: <em>"{rejectingReq.reason}"</em></div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Justificação fundamentada da rejeição <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Falta de documentação comprovativa / Decisão do plenário de manter o membro ativo (mínimo 3 caracteres)"
                value={rejectJustification}
                onChange={(e) => setRejectJustification(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setRejectingReq(null);
                  setRejectJustification('');
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={rejectJustification.trim().length < 3}
                onClick={handleRejectConfirm}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-40 rounded shadow-xs flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Confirmar Rejeição Formal</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 4: Renovação Anual em Lote */}
      <Modal
        isOpen={isBatchRenewalOpen}
        onClose={() => setIsBatchRenewalOpen(false)}
        title={`Renovação Anual de Matrículas - Ano Fiscal ${state.settings.currentYear}`}
        description="Atualização coletiva de membros ativos sem alterar histórico de anos anteriores nem duplicar cobranças."
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-950 rounded">
            <p className="font-bold">Regras de Integridade de Renovação:</p>
            <ul className="list-disc list-inside mt-1 space-y-1 text-slate-700">
              <li>Não liquida dívidas de anos passados automaticamente.</li>
              <li>Não duplica cobranças já existentes.</li>
              <li>Preserva os anos anteriores no histórico de auditoria.</li>
            </ul>
          </div>

          <div>
            <h5 className="font-bold text-slate-800 mb-2">
              Membros Elegíveis para Renovação:
            </h5>
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded">
              {state.members
                .filter((m) => m.status === 'ativo' && m.annualRenewalYear < state.settings.currentYear)
                .map((m) => (
                  <div key={m.id} className="p-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900">{m.fullName}</span>
                      <span className="text-slate-500 text-[11px] ml-2 font-mono">({m.manualNumber})</span>
                    </div>
                    <span className="text-amber-800 font-medium">Ano atual: {m.annualRenewalYear}</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              onClick={() => setIsBatchRenewalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              onClick={handleBatchRenewalConfirm}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs"
            >
              Executar Renovação Autorizada
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Gestão de Equipas / Unidades e Atribuição de Membros */}
      <Modal
        isOpen={isUnitsModalOpen}
        onClose={() => setIsUnitsModalOpen(false)}
        title="Gestão de Equipas e Inserção de Membros"
        description="O Secretário e o Diretor podem criar equipas (compostas por uma mistura de Embaixadores, Líderes e Aspirantes), editar nomes, vincular líderes e inserir membros nas equipas."
        maxWidth="2xl"
      >
        <div className="space-y-6 text-xs">
          {/* Notificação de Sucesso ou Erro */}
          {unitFeedback && (
            <div
              className={`p-3 rounded-lg flex items-center justify-between gap-2 border ${
                unitFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {unitFeedback.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className="font-medium">{unitFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setUnitFeedback(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Formulário de Criação / Edição de Equipa */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!unitForm.name.trim()) {
                setUnitFeedback({ type: 'error', message: 'O nome da equipa é obrigatório.' });
                return;
              }

              if (editingUnitId) {
                const res = updateUnit(editingUnitId, unitForm.name, unitForm.category, unitForm.leaderUserId || undefined);
                if (res.success) {
                  setEditingUnitId(null);
                  setUnitForm({ name: '', category: 'mista', leaderUserId: '' });
                  setUnitFeedback({ type: 'success', message: 'Equipa atualizada com sucesso!' });
                } else {
                  setUnitFeedback({ type: 'error', message: res.error || 'Erro ao atualizar equipa.' });
                }
              } else {
                const res = addUnit(unitForm.name, unitForm.category, unitForm.leaderUserId || undefined);
                if (res.success) {
                  setUnitForm({ name: '', category: 'mista', leaderUserId: '' });
                  setUnitFeedback({ type: 'success', message: 'Nova equipa criada com sucesso no Clube de Embaixadores!' });
                } else {
                  setUnitFeedback({ type: 'error', message: res.error || 'Erro ao criar equipa.' });
                }
              }
            }}
            className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
          >
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Building className="w-4 h-4 text-blue-900" />
              <span>{editingUnitId ? 'Editar Equipa Existente' : 'Criar Nova Equipa'}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nome da Equipa</label>
                <input
                  type="text"
                  placeholder="Ex: Equipa Águias"
                  value={unitForm.name}
                  onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded bg-white focus:ring-1 focus:ring-blue-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Categoria da Equipa</label>
                <select
                  value={unitForm.category}
                  onChange={(e) => setUnitForm({ ...unitForm, category: e.target.value as MemberCategory | 'mista' })}
                  className="w-full p-2 border border-slate-200 rounded bg-white focus:ring-1 focus:ring-blue-900 font-medium"
                >
                  <option value="mista">Mista (Embaixadores, Líderes e Aspirantes)</option>
                  <option value="embaixador">Embaixadores</option>
                  <option value="lider">Líderes</option>
                  <option value="aspirante">Aspirantes</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Líder Vinculado (Conta Ativa)</label>
                <select
                  value={unitForm.leaderUserId}
                  onChange={(e) => setUnitForm({ ...unitForm, leaderUserId: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded bg-white focus:ring-1 focus:ring-blue-900"
                >
                  <option value="">Sem líder atribuído</option>
                  {state.users
                    .filter((u) => u.active)
                    .map((usr) => (
                      <option key={usr.id} value={usr.id}>
                        {usr.name} ({ROLE_LABELS[usr.role]?.label || usr.role})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                  * A liderança de equipa não altera a categoria do membro (permanece como Embaixador/Aspirante). Para promover a Líder, edite a categoria na gestão de membros.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {editingUnitId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingUnitId(null);
                    setUnitForm({ name: '', category: 'mista', leaderUserId: '' });
                  }}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
                >
                  Cancelar Edição
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-1.5 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors"
              >
                {editingUnitId ? 'Guardar Alterações da Equipa' : 'Criar Equipa no Clube'}
              </button>
            </div>
          </form>

          {/* Lista de Equipas Atuais e Inserção de Membros */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center justify-between">
              <span>Equipas Registadas e Membros Atribuídos:</span>
              <span className="text-[11px] text-slate-500 font-normal">
                {state.settings.units.length} equipas configuradas
              </span>
            </h4>

            {state.settings.units.length === 0 ? (
              <div className="p-6 text-center text-slate-500 bg-slate-50 border border-slate-200 rounded-xl">
                Nenhuma equipa registada ainda. Crie a primeira equipa acima.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {state.settings.units.map((unit) => {
                  const leaderUser = state.users.find((u) => u.id === unit.leaderUserId);
                  const teamMembers = state.members.filter(
                    (m) => m.unitOrTeam === unit.name && m.status === 'ativo'
                  );
                  const embaixadores = teamMembers.filter((m) => m.category === 'embaixador').length;
                  const lideres = teamMembers.filter((m) => m.category === 'lider').length;
                  const aspirantes = teamMembers.filter((m) => m.category === 'aspirante').length;
                  const isExpanded = expandedUnitId === unit.id;
                  const availableToAdd = state.members.filter(
                    (m) => m.status === 'ativo' && m.unitOrTeam !== unit.name && !isDirectionMember(m, state.users)
                  );

                  return (
                    <div
                      key={unit.id}
                      className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs"
                    >
                      {/* Topo do Card da Equipa */}
                      <div className="p-3.5 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 text-sm">{unit.name}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                unit.category === 'mista'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : unit.category === 'embaixador'
                                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                  : unit.category === 'lider'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {unit.category === 'mista' ? 'Equipa Mista' : unit.category}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-600 mt-1">
                            Líder da Equipa: <strong className="text-slate-800">{leaderUser ? `${leaderUser.name} (${ROLE_LABELS[leaderUser.role]?.label || leaderUser.role})` : 'Nenhum líder vinculado'}</strong>
                          </p>

                          {/* Mistura de Categorias na Equipa */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] mt-2">
                            <span className="font-semibold text-slate-700">
                              {teamMembers.length} membro{teamMembers.length !== 1 ? 's' : ''}:
                            </span>
                            {embaixadores > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-[10px]">
                                {embaixadores} Embaixador{embaixadores > 1 ? 'es' : ''}
                              </span>
                            )}
                            {lideres > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200 text-[10px]">
                                {lideres} Líder{lideres > 1 ? 'es' : ''}
                              </span>
                            )}
                            {aspirantes > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200 text-[10px]">
                                {aspirantes} Aspirante{aspirantes > 1 ? 's' : ''}
                              </span>
                            )}
                            {teamMembers.length === 0 && (
                              <span className="text-slate-400 italic">Sem membros inseridos</span>
                            )}
                          </div>
                        </div>

                        {/* Ações da Equipa */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setExpandedUnitId(isExpanded ? null : unit.id)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1 ${
                              isExpanded
                                ? 'bg-blue-900 text-white border-blue-900'
                                : 'bg-white text-blue-950 border-blue-200 hover:bg-blue-50'
                            }`}
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span>{isExpanded ? 'Ocultar Membros' : `Ver / Inserir Membros (${teamMembers.length})`}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingUnitId(unit.id);
                              setUnitForm({
                                name: unit.name,
                                category: unit.category,
                                leaderUserId: unit.leaderUserId || '',
                              });
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded transition-colors"
                            title="Editar Dados da Equipa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const res = deleteUnit(unit.id);
                              if (res.success) {
                                setUnitFeedback({ type: 'success', message: `Equipa "${unit.name}" removida com sucesso.` });
                              } else {
                                setUnitFeedback({ type: 'error', message: res.error || 'Erro ao remover equipa.' });
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                            title="Eliminar Equipa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Painel Expandido: Lista de Membros e Inserção na Equipa */}
                      {isExpanded && (
                        <div className="p-4 space-y-4 bg-white border-t border-slate-100">
                          {/* Barra de Inserção de Novo Membro nesta Equipa */}
                          <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg space-y-2">
                            <p className="font-bold text-blue-950 text-xs flex items-center gap-1.5">
                              <Plus className="w-3.5 h-3.5 text-blue-800" />
                              <span>Inserir Membro nesta Equipa (Secretaria & Direção)</span>
                            </p>
                            <div className="flex flex-col sm:flex-row items-center gap-2">
                              <select
                                value={memberToInsertId}
                                onChange={(e) => setMemberToInsertId(e.target.value)}
                                className="w-full sm:flex-1 p-2 border border-slate-200 rounded bg-white text-xs"
                              >
                                <option value="">Selecione um membro para inserir nesta equipa...</option>
                                {availableToAdd
                                  .sort((a, b) => a.fullName.localeCompare(b.fullName))
                                  .map((m) => (
                                    <option key={m.id} value={m.id}>
                                      [{m.category.toUpperCase()}] {m.fullName} ({m.manualNumber})
                                      {m.unitOrTeam ? ` (Atualmente em: ${m.unitOrTeam})` : ' (Sem Equipa)'}
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!memberToInsertId) {
                                    setUnitFeedback({ type: 'error', message: 'Por favor selecione um membro na lista.' });
                                    return;
                                  }
                                  const res = assignMemberToUnit(memberToInsertId, unit.name);
                                  if (res.success) {
                                    setMemberToInsertId('');
                                    setUnitFeedback({ type: 'success', message: 'Membro inserido na equipa com sucesso!' });
                                  } else {
                                    setUnitFeedback({ type: 'error', message: res.error || 'Erro ao inserir membro.' });
                                  }
                                }}
                                className="w-full sm:w-auto px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white font-semibold rounded shadow-xs whitespace-nowrap text-xs flex items-center justify-center gap-1"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Inserir na Equipa</span>
                              </button>
                            </div>
                          </div>

                          {/* Membros Atualmente na Equipa */}
                          <div>
                            <h5 className="font-bold text-slate-800 mb-2">
                              Membros Atualmente nesta Equipa ({teamMembers.length}):
                            </h5>
                            {teamMembers.length === 0 ? (
                              <p className="text-slate-400 italic py-2 text-center bg-slate-50 rounded-lg">
                                Esta equipa ainda não tem membros atribuídos. Utilize o campo acima para inserir membros.
                              </p>
                            ) : (
                              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                                {teamMembers.map((m) => (
                                  <div
                                    key={m.id}
                                    className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-900">{m.fullName}</span>
                                      <span className="text-[10px] text-slate-500 font-mono">
                                        (Nº {m.manualNumber})
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                          m.category === 'embaixador'
                                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                            : m.category === 'lider'
                                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                        }`}
                                      >
                                        {m.category === 'embaixador' ? 'Embaixador' : m.category === 'lider' ? 'Líder' : 'Aspirante'}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const res = assignMemberToUnit(m.id, undefined);
                                        if (res.success) {
                                          setUnitFeedback({ type: 'success', message: `Membro ${m.fullName} removido da equipa.` });
                                        }
                                      }}
                                      className="px-2 py-1 text-[11px] font-medium text-rose-700 hover:text-rose-900 hover:bg-rose-50 border border-rose-200 rounded transition-colors"
                                      title="Remover este membro da equipa"
                                    >
                                      Remover da Equipa
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-slate-100">
            <button
              onClick={() => setIsUnitsModalOpen(false)}
              className="px-4 py-2 font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg shadow-xs"
            >
              Concluir
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Editar Ficha de Membro (Secretário / Diretor / Admin) */}
      {editingMember && (
        <Modal
          isOpen={Boolean(editingMember)}
          onClose={() => setEditingMember(null)}
          title={`Editar Ficha de Membro: ${editingMember.fullName}`}
          description="Atualize os dados cadastrais e institucionais do membro."
          maxWidth="3xl"
        >
          <form onSubmit={handleEditSubmit} className="space-y-6">
            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{editError}</span>
              </div>
            )}

            {/* Secção 1 */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-1">
                1. Identificação Oficial
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-semibold">Nº de Matrícula</label>
                    <button
                      type="button"
                      onClick={() => {
                        const gen = generateManualNumber(editFormData.identityCardNumber, editFormData.birthDate);
                        setEditFormData({ ...editFormData, manualNumber: gen });
                      }}
                      className="text-[10px] text-blue-900 hover:text-blue-700 font-bold underline cursor-pointer"
                      title="Gerar automaticamente segundo a fórmula EBX-XXXMMAA"
                    >
                      Gerar EBX-XXXMMAA
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editFormData.manualNumber}
                    onChange={(e) => setEditFormData({ ...editFormData, manualNumber: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded font-mono font-bold bg-slate-50 text-blue-900 focus:ring-1 focus:ring-blue-900"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Nome Completo</label>
                  <input
                    type="text"
                    value={editFormData.fullName}
                    onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Data de Nascimento</label>
                  <input
                    type="date"
                    value={editFormData.birthDate}
                    onChange={(e) => setEditFormData({ ...editFormData, birthDate: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Género</label>
                  <select
                    value={editFormData.gender}
                    onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value as 'M' | 'F' })}
                    className="w-full p-2 border border-slate-200 rounded"
                  >
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">B.I. (Angola)</label>
                  <input
                    type="text"
                    value={editFormData.identityCardNumber}
                    onChange={(e) => setEditFormData({ ...editFormData, identityCardNumber: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded font-mono uppercase"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Secção 2 */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-1">
                2. Contactos e Residência
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Telefone</label>
                  <input
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">E-mail</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Município / Bairro</label>
                  <input
                    type="text"
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded"
                  />
                </div>
              </div>
            </div>

            {/* Secção 3 */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-1">
                3. Enquadramento Institucional
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Categoria</label>
                  <select
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value as MemberCategory })}
                    className="w-full p-2 border border-slate-200 rounded bg-white"
                  >
                    <option value="embaixador">Embaixador</option>
                    <option value="lider">Líder</option>
                    <option value="aspirante">Aspirante</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Equipa</label>
                  {editingMember && isDirectionMember(editingMember, state.users) ? (
                    <div className="w-full p-2 border border-blue-200 rounded bg-blue-50 text-blue-900 font-bold text-xs flex items-center justify-between">
                      <span>Direção</span>
                      <span className="text-[10px] font-medium text-blue-700">Cargo de Direção</span>
                    </div>
                  ) : (
                    <select
                      value={editFormData.unitOrTeam}
                      onChange={(e) => setEditFormData({ ...editFormData, unitOrTeam: e.target.value })}
                      className="w-full p-2 border border-slate-200 rounded bg-white"
                    >
                      <option value="">Sem Equipa</option>
                      {state.settings.units.map((u) => (
                        <option key={u.id} value={u.name}>
                          {u.name} ({u.category})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {(editFormData.category === 'embaixador' || editFormData.category === 'lider') && (
                  <div className="sm:col-span-2 bg-amber-50/70 p-3 rounded-lg border border-amber-200">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-amber-900 font-bold">
                        Data Oficial de Investidura ({editFormData.category === 'lider' ? 'Líder' : 'Embaixador'})
                      </label>
                      <span className="text-[10px] text-amber-800 font-medium">Exibida no Cartão Digital</span>
                    </div>
                    <input
                      type="date"
                      value={editFormData.investitureDate}
                      onChange={(e) => setEditFormData({ ...editFormData, investitureDate: e.target.value })}
                      className="w-full p-2 border border-amber-300 rounded focus:ring-1 focus:ring-amber-500 bg-white text-xs font-semibold"
                    />
                    <p className="text-[10px] text-amber-700 mt-1">
                      Indique a data da cerimónia oficial em que o membro/líder foi investido com o lenço/insígnia oficial.
                    </p>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">
                    Curso Profissional / Área Académica (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Informática de Gestão, Enfermagem, Mecânica..."
                    value={editFormData.professionalCourse}
                    onChange={(e) => setEditFormData({ ...editFormData, professionalCourse: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded"
                  />
                </div>
              </div>
            </div>

            {/* Secção 4 */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-1">
                4. Encarregado e Dados Médicos
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nome do Encarregado</label>
                  <input
                    type="text"
                    value={editFormData.guardianName}
                    onChange={(e) => setEditFormData({ ...editFormData, guardianName: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Telefone do Encarregado</label>
                  <input
                    type="tel"
                    value={editFormData.guardianPhone}
                    onChange={(e) => setEditFormData({ ...editFormData, guardianPhone: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Grupo Sanguíneo <span className="text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  <select
                    value={editFormData.bloodType}
                    onChange={(e) => setEditFormData({ ...editFormData, bloodType: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded bg-white"
                  >
                    <option value="">Não informado (Opcional)</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-slate-700 font-semibold mb-1">Alergias ou Cuidados Médicos</label>
                  <input
                    type="text"
                    value={editFormData.allergiesOrMedicalNotes}
                    onChange={(e) => setEditFormData({ ...editFormData, allergiesOrMedicalNotes: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded"
                  />
                </div>
              </div>
            </div>

            {/* Secção 5: Documentos Anexados */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-1 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-blue-900" />
                <span>5. Documentos Anexados (B.I. e Fotografia)</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2">
                  <span className="block font-semibold text-slate-700">Bilhete de Identidade (B.I.)</span>
                  {editFormData.biDocumentBase64 ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-900 truncate">
                        <FileText className="w-3.5 h-3.5 text-blue-800 shrink-0" />
                        <span className="truncate">{editFormData.biDocumentFileName || 'Documento B.I.'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setViewingDocument({
                              title: `Documento B.I. · ${editFormData.fullName}`,
                              fileName: editFormData.biDocumentFileName || `BI-${editFormData.manualNumber}`,
                              base64: editFormData.biDocumentBase64,
                            })
                          }
                          className="px-2 py-1 text-[11px] font-bold bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Visualizar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadDocumentFile(
                              editFormData.biDocumentBase64,
                              editFormData.biDocumentFileName || `BI-${editFormData.manualNumber}`
                            )
                          }
                          className="px-2 py-1 text-[11px] font-bold bg-blue-900 hover:bg-blue-800 text-white rounded inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Baixar</span>
                        </button>
                        {(!editingMember?.biDocumentBase64 || canDeleteMemberUploads) && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditFormData((prev) => ({
                                ...prev,
                                biDocumentFileName: '',
                                biDocumentBase64: '',
                              }))
                            }
                            className="p-1 text-rose-600 hover:text-rose-800"
                            title="Remover anexo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-1.5 p-2.5 border border-dashed border-slate-300 rounded-lg hover:bg-white cursor-pointer text-[11px] font-semibold text-blue-900">
                      {isProcessingEditDoc === 'bi' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>{isProcessingEditDoc === 'bi' ? 'A anexar...' : 'Anexar B.I. (PDF, Imagem, DOC)'}</span>
                      <input
                        type="file"
                        accept=".pdf,image/*,.doc,.docx,.odt,.rtf,.txt"
                        onChange={(e) => handleEditAttachmentUpload('bi', e)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2">
                  <span className="block font-semibold text-slate-700">Fotografia do Membro</span>
                  {editFormData.photoDocumentBase64 ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[11px] font-medium text-slate-900 truncate">
                        {editFormData.photoDocumentBase64.startsWith('data:image/') ? (
                          <img
                            src={editFormData.photoDocumentBase64}
                            alt="Fotografia"
                            className="w-6 h-6 rounded object-cover border border-slate-300 shrink-0"
                          />
                        ) : (
                          <ImageIcon className="w-3.5 h-3.5 text-blue-800 shrink-0" />
                        )}
                        <span className="truncate">{editFormData.photoDocumentFileName || 'Fotografia'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setViewingDocument({
                              title: `Fotografia · ${editFormData.fullName}`,
                              fileName: editFormData.photoDocumentFileName || `Foto-${editFormData.manualNumber}`,
                              base64: editFormData.photoDocumentBase64,
                            })
                          }
                          className="px-2 py-1 text-[11px] font-bold bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Visualizar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadDocumentFile(
                              editFormData.photoDocumentBase64,
                              editFormData.photoDocumentFileName || `Foto-${editFormData.manualNumber}`
                            )
                          }
                          className="px-2 py-1 text-[11px] font-bold bg-blue-900 hover:bg-blue-800 text-white rounded inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Baixar</span>
                        </button>
                        {(!editingMember?.photoDocumentBase64 || canDeleteMemberUploads) && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditFormData((prev) => ({
                                ...prev,
                                photoDocumentFileName: '',
                                photoDocumentBase64: '',
                              }))
                            }
                            className="p-1 text-rose-600 hover:text-rose-800"
                            title="Remover fotografia"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-1.5 p-2.5 border border-dashed border-slate-300 rounded-lg hover:bg-white cursor-pointer text-[11px] font-semibold text-blue-900">
                      {isProcessingEditDoc === 'photo' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ImageIcon className="w-3.5 h-3.5" />
                      )}
                      <span>{isProcessingEditDoc === 'photo' ? 'A anexar...' : 'Anexar Fotografia'}</span>
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx,.odt,.rtf,.txt"
                        onChange={(e) => handleEditAttachmentUpload('photo', e)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
              {!canDeleteMemberUploads &&
                Boolean(editingMember?.biDocumentBase64 || editingMember?.photoDocumentBase64) && (
                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Lock className="w-3 h-3 shrink-0" />
                    <span>
                      A exclusão de uploads já registados na ficha do membro só é permitida ao Diretor ou Secretário com permissão na grelha do Administrador.
                    </span>
                  </p>
                )}
              <p className="text-[11px] text-slate-500">
                Para anexar outros documentos adicionais (Autorizações, Comprovativos, Declarações), aceda também ao botão <strong>Ver Ficha</strong> do membro.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-sm"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Definir Situação Documental na Secretaria (Regularizado vs Falta de Documento) */}
      {documentationMember && (
        <Modal
          isOpen={Boolean(documentationMember)}
          onClose={() => setDocumentationMember(null)}
          title={`Situação Documental: ${documentationMember.fullName}`}
          description={`Matrícula ${documentationMember.manualNumber} · Defina se o membro está regularizado ou com documentos em falta na Secretaria.`}
          maxWidth="lg"
        >
          <form onSubmit={handleConfirmDocumentationUpdate} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setDocStatusForm({
                    status: 'regularizado',
                    missingDocumentsNote: '',
                  })
                }
                className={`p-3.5 rounded-xl border text-left transition-colors ${
                  docStatusForm.status === 'regularizado'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200 font-bold'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span>Regularizado</span>
                </div>
                <p className="text-[11px] font-normal text-slate-600 dark:text-slate-400 mt-1">
                  Todos os documentos oficiais do membro foram entregues e conferidos pela Secretaria.
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  setDocStatusForm((prev) => ({
                    ...prev,
                    status: 'falta_documento',
                  }))
                }
                className={`p-3.5 rounded-xl border text-left transition-colors ${
                  docStatusForm.status === 'falta_documento'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 text-amber-950 dark:text-amber-200 font-bold'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                  <span>Falta de Documento</span>
                </div>
                <p className="text-[11px] font-normal text-slate-600 dark:text-slate-400 mt-1">
                  Sinalizar que falta entregar um ou mais documentos na Secretaria.
                </p>
              </button>
            </div>

            {docStatusForm.status === 'falta_documento' && (
              <div className="space-y-2.5 p-3.5 bg-amber-50/70 dark:bg-slate-800/80 border border-amber-200 dark:border-amber-800/60 rounded-xl">
                <label className="block font-bold text-amber-950 dark:text-amber-200">
                  Indique o(s) documento(s) em falta <span className="text-rose-600">*</span>
                </label>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Bilhete de Identidade (B.I.)',
                    'Fotografia tipo passe',
                    'Autorização do Encarregado',
                    'Comprovativo de Residência',
                  ].map((docLabel) => (
                    <button
                      key={docLabel}
                      type="button"
                      onClick={() => {
                        setDocStatusForm((prev) => {
                          const existing = prev.missingDocumentsNote.trim();
                          if (existing.toLowerCase().includes(docLabel.toLowerCase())) {
                            return prev;
                          }
                          return {
                            ...prev,
                            missingDocumentsNote: existing
                              ? `${existing}; ${docLabel}`
                              : docLabel,
                          };
                        });
                      }}
                      className="px-2 py-1 text-[10px] font-semibold bg-white dark:bg-slate-700 hover:bg-amber-100 dark:hover:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded cursor-pointer"
                    >
                      + {docLabel}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  placeholder="Ex: Falta cópia do Bilhete de Identidade (B.I.) e 2 fotografias tipo passe."
                  value={docStatusForm.missingDocumentsNote}
                  onChange={(e) =>
                    setDocStatusForm((prev) => ({
                      ...prev,
                      missingDocumentsNote: e.target.value,
                    }))
                  }
                  className="w-full p-2.5 border border-amber-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDocumentationMember(null)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  docStatusForm.status === 'falta_documento' &&
                  docStatusForm.missingDocumentsNote.trim().length < 3
                }
                className="px-4 py-2 font-bold text-white bg-blue-900 hover:bg-blue-800 disabled:opacity-40 rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Guardar Situação Documental</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Reabrir / Estipular Datas e Horários do Período de Inscrições */}
      {isEnrollmentScheduleModalOpen && canManageEnrollmentPeriod && (
        <Modal
          isOpen={isEnrollmentScheduleModalOpen}
          onClose={() => {
            setIsEnrollmentScheduleModalOpen(false);
            setEnrollmentScheduleError(null);
          }}
          title="Gerir Abertura e Encerramento de Inscrições"
          description="Estipule a data e horário de abertura e a data e horário de encerramento das inscrições no clube, ou encerre imediatamente."
          maxWidth="lg"
        >
          <form onSubmit={handleReopenEnrollmentsSubmit} className="space-y-4 text-xs">
            {enrollmentScheduleError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{enrollmentScheduleError}</span>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                <span>Abertura das Inscrições</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Data de Abertura
                  </label>
                  <input
                    type="date"
                    value={enrollmentScheduleForm.openDate}
                    onChange={(e) =>
                      setEnrollmentScheduleForm((prev) => ({ ...prev, openDate: e.target.value }))
                    }
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Horário da Abertura
                  </label>
                  <input
                    type="time"
                    value={enrollmentScheduleForm.openTime}
                    onChange={(e) =>
                      setEnrollmentScheduleForm((prev) => ({ ...prev, openTime: e.target.value }))
                    }
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Se definir uma data/horário futuro, o botão de inscrição no ecrã de login só aparecerá a partir desse momento.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400" />
                <span>Encerramento das Inscrições</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Data de Encerramento
                  </label>
                  <input
                    type="date"
                    value={enrollmentScheduleForm.closeDate}
                    onChange={(e) =>
                      setEnrollmentScheduleForm((prev) => ({ ...prev, closeDate: e.target.value }))
                    }
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Horário de Encerramento
                  </label>
                  <input
                    type="time"
                    value={enrollmentScheduleForm.closeTime}
                    onChange={(e) =>
                      setEnrollmentScheduleForm((prev) => ({ ...prev, closeTime: e.target.value }))
                    }
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Quando a data e o horário de encerramento forem atingidos (ou ao clicar em «Encerrar Imediatamente»), o período será encerrado automaticamente.
              </p>
            </div>

            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 cursor-pointer">
              <input
                type="checkbox"
                checked={enrollmentScheduleForm.enableReconfirmation}
                onChange={(e) =>
                  setEnrollmentScheduleForm((prev) => ({
                    ...prev,
                    enableReconfirmation: e.target.checked,
                  }))
                }
                className="mt-0.5 w-4 h-4 rounded border-blue-300 text-blue-900 focus:ring-blue-900 shrink-0"
              />
              <div className="space-y-1">
                <div className="font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-blue-800 dark:text-blue-400" />
                  <span>Ativar Opção de Reconfirmação de Dados dos Membros</span>
                </div>
                <p className="text-[11px] text-blue-900/90 dark:text-blue-300 leading-relaxed">
                  Permite que os membros já registados e inscritos reconfirmem e atualizem os seus dados cadastrais e documentos durante este período. Após o término do período, os membros com ficha válida que passaram na inscrição ou concluíram a reconfirmação ficarão <strong>Ativos</strong>, enquanto os membros registados que não reconfirmarem serão marcados automaticamente como <strong>Inativos</strong>.
                </p>
              </div>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
              {state.settings.enrollmentConfig?.isOpen !== false ? (
                <button
                  type="button"
                  onClick={handleCloseEnrollmentsNow}
                  className="px-3.5 py-2 font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Encerrar Imediatamente</span>
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEnrollmentScheduleModalOpen(false);
                    setEnrollmentScheduleError(null);
                  }}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Reabrir / Salvar Período</span>
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Cartão Digital Oficial com QR Code */}
      <MemberDigitalCardModal
        member={cardMember}
        onClose={() => setCardMember(null)}
      />

      {/* MODAL: Impressão de Recibos / Documentos a partir do Dossiê 360º */}
      <PrintDocumentModal
        document={printedDossierDoc}
        onClose={() => setPrintedDossierDoc(null)}
      />

      {/* MODAL: Visualizador de Documentos Anexados */}
      <DocumentViewerModal
        documentItem={viewingDocument}
        onClose={() => setViewingDocument(null)}
      />
    </div>
  );
};
