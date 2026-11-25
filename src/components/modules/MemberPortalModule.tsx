import React, { useState } from 'react';
import {
  UserCheck,
  Wallet,
  Calendar,
  GraduationCap,
  FileText,
  Upload,
  AlertTriangle,
  CheckCircle,
  Clock,
  Printer,
  Plus,
  Eye,
  MessageSquare,
  Key,
  ShieldCheck,
  Lock,
  Lightbulb,
  Send,
  Check,
  Search,
  Filter,
  Sparkles,
  User,
  Trash2,
  CheckCircle2,
  ShieldAlert,
  CreditCard,
  QrCode,
  Bell,
  RefreshCw,
  MapPin,
  Download,
  ChevronRight,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { formatKz, parseKzToCents } from '../../utils/currency';
import { evaluateIdentityCardValidity, formatDateAO, formatDateTimeAO } from '../../utils/date';
import { Modal } from '../common/Modal';
import {
  PaymentMethod,
  OfficialDocument,
  PaymentProofReport,
  MemberSuggestion,
  SuggestionCategory,
  SuggestionStatus,
  ActivityRsvpStatus,
} from '../../types';
import { PrintDocumentModal } from '../common/PrintDocumentModal';
import { ProofDocumentViewerModal } from '../common/ProofDocumentViewerModal';
import { MemberDigitalCardModal } from '../common/MemberDigitalCardModal';
import { processProofFile } from '../../utils/fileUpload';
import { EnrollmentStatusCard } from '../members/EnrollmentStatusCard';
import { MemberReconfirmationForm } from '../members/MemberReconfirmationForm';
import { evaluateEnrollmentAvailability } from '../../services/enrollmentService';
import {
  DEFAULT_QUOTA_FEE_ID,
  calculateMemberQuotaSummary,
  getSelectableInstitutionalFees,
  getTodayISODate,
  resolveQuotaConfig,
} from '../../services/quotaService';
import { getStrictLinkedMember, getMemberTeamLabel } from '../../services/accountSyncService';
import {
  ACTIVITY_TYPE_COLORS,
  downloadActivityICS,
  getActivityDateOnly,
  getActivityStageLabel,
  getActivityTimeRangeLabel,
  getActivityTypeLabel,
  getMemberPortalVisibleActivities,
} from '../../utils/activityUtils';

const SUGGESTION_CATEGORY_MAP: Record<SuggestionCategory, { label: string; badgeBg: string; text: string }> = {
  geral: { label: 'Geral', badgeBg: 'bg-slate-100 border-slate-300 text-slate-800', text: 'text-slate-800' },
  atividades: { label: 'Atividades & Acampamentos', badgeBg: 'bg-blue-100 border-blue-300 text-blue-900', text: 'text-blue-900' },
  lideranca: { label: 'Liderança & Reuniões', badgeBg: 'bg-amber-100 border-amber-300 text-amber-900', text: 'text-amber-900' },
  material_espaco: { label: 'Material & Espaço Físico', badgeBg: 'bg-emerald-100 border-emerald-300 text-emerald-900', text: 'text-emerald-900' },
  espiritual: { label: 'Espiritual & Social', badgeBg: 'bg-purple-100 border-purple-300 text-purple-900', text: 'text-purple-900' },
  organizacao: { label: 'Organização & Disciplina', badgeBg: 'bg-cyan-100 border-cyan-300 text-cyan-900', text: 'text-cyan-900' },
  outro: { label: 'Outro Assunto', badgeBg: 'bg-slate-100 border-slate-300 text-slate-800', text: 'text-slate-800' },
};

export const MemberPortalModule: React.FC = () => {
  const {
    state,
    currentUser,
    can,
    submitPaymentProof,
    createCircular,
    markCircularAsRead,
    selfResetPassword,
    requestPasswordReset,
    submitMemberSuggestion,
    markSuggestionAsViewed,
    respondToSuggestion,
    deleteSuggestion,
    markMessageAsRead,
    replyToMessage,
    submitMemberReconfirmation,
    submitActivityRsvp,
  } = useClub();

  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [isDigitalCardOpen, setIsDigitalCardOpen] = useState(false);
  const [isReconfirmationModalOpen, setIsReconfirmationModalOpen] = useState(false);
  const enrollmentAvailability = evaluateEnrollmentAvailability(state.settings.enrollmentConfig);
  const [printedReceipt, setPrintedReceipt] = useState<OfficialDocument | null>(null);
  const [selectedProofToView, setSelectedProofToView] = useState<PaymentProofReport | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);
  const [suggestionToDelete, setSuggestionToDelete] = useState<{ id: string; subject: string } | null>(null);

  // Membro estritamente vinculado ao utilizador autenticado (sem fallback para outros membros)
  const member = getStrictLinkedMember(currentUser, state.members);
  const memberId = member?.id || '';

  // Atividades estritamente autorizadas pelo Diretor para o Portal do Membro
  const todayISO = getTodayISODate();
  const portalActivities = getMemberPortalVisibleActivities(state.activities);
  const upcomingPortalActivities = portalActivities.filter((a) => {
    const refDate = getActivityDateOnly(a.endDate) || getActivityDateOnly(a.startDate);
    return refDate >= todayISO && a.stage !== 'encerrado';
  });
  const pastPortalActivities = portalActivities
    .filter((a) => {
      const refDate = getActivityDateOnly(a.endDate) || getActivityDateOnly(a.startDate);
      return refDate < todayISO || a.stage === 'encerrado';
    })
    .slice()
    .reverse();

  const myRecordedAttendances = member
    ? (state.activities || []).filter((act) => act.attendees?.some((att) => att.memberId === member.id))
    : [];
  const myPresentCount = member
    ? myRecordedAttendances.filter((act) => act.attendees.some((att) => att.memberId === member.id && att.present)).length
    : 0;
  const myAttendancePct =
    myRecordedAttendances.length > 0 ? Math.round((myPresentCount / myRecordedAttendances.length) * 100) : null;

  // Dados exclusivos do membro
  const myReceipts = state.receipts.filter((r) => r.memberId === member?.id);
  const myProofs = state.paymentProofs.filter((p) => p.memberId === member?.id);
  const myTraining = state.trainingProgress.filter((p) => p.memberId === member?.id);
  const myCirculars = (state.circulars || []).filter(c => c.targetRoles.includes(currentUser.role));

  const activeQuotaConfig = resolveQuotaConfig(state.settings, state.fees);
  const myQuotaSummary = member
    ? calculateMemberQuotaSummary(
        member,
        activeQuotaConfig,
        state.fees,
        state.receipts,
        getTodayISODate(),
        state.quotaWaivers || []
      )
    : null;

  const myMessages = (state.messages || []).filter((msg) => {
    if (!member) return false;
    if (msg.recipientType === 'all') return true;
    if (msg.recipientType === 'member' && msg.recipientId === member.id) return true;
    if (msg.recipientType === 'unit' && member.unitOrTeam && msg.recipientId.toLowerCase() === member.unitOrTeam.toLowerCase()) return true;
    if (msg.recipientType === 'category' && msg.recipientId.toLowerCase() === member.category.toLowerCase()) return true;
    return false;
  });

  const unreadMessagesCount = member
    ? myMessages.filter(m => !(m.readBy && m.readBy.includes(member.id))).length
    : 0;
  const [replyInputMap, setReplyInputMap] = useState<Record<string, string>>({});
  const [replyFeedback, setReplyFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);


  const selectableInstitutionalFees = getSelectableInstitutionalFees(state.fees, state.settings);

  // Formulário Comprovativo
  const [proofForm, setProofForm] = useState({
    feeDefinitionId: selectableInstitutionalFees[0]?.id || DEFAULT_QUOTA_FEE_ID,
    amountStr: '2500',
    paymentMethod: 'multicaixa_express' as PaymentMethod,
    paymentDate: new Date().toISOString().split('T')[0],
    fileName: '',
    base64: '',
    accountId: state.accounts[0]?.id || '',
  });

  // Estados para Redefinição de Senha (1 vez a cada 2 meses)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isRequestingAdminReset, setIsRequestingAdminReset] = useState(false);

  // Cálculo da janela de 2 meses (60 dias)
  const COOLDOWN_DAYS = 60;
  const lastChangedMs = currentUser.lastPasswordChangedAt
    ? new Date(currentUser.lastPasswordChangedAt).getTime()
    : null;
  const nowMs = Date.now();
  const elapsedDays = lastChangedMs ? (nowMs - lastChangedMs) / (1000 * 60 * 60 * 24) : 999;
  const isCooldownActive = elapsedDays < COOLDOWN_DAYS;
  const daysRemaining = isCooldownActive ? Math.ceil(COOLDOWN_DAYS - elapsedDays) : 0;
  const nextAllowedDate = lastChangedMs
    ? new Date(lastChangedMs + COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const handleSelfPasswordResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasswordInput.length < 6) {
      setPasswordFeedback({ type: 'error', message: 'A palavra-passe deve conter pelo menos 6 caracteres.' });
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordFeedback({ type: 'error', message: 'A confirmação de palavra-passe não coincide.' });
      return;
    }
    const res = selfResetPassword(newPasswordInput);
    if (res.success) {
      setPasswordFeedback({ type: 'success', message: 'Palavra-passe alterada com sucesso! A próxima alteração direta no portal estará disponível daqui a 2 meses.' });
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordFeedback(null);
      }, 3500);
    } else {
      setPasswordFeedback({ type: 'error', message: res.error || 'Erro ao alterar palavra-passe.' });
    }
  };

  const handleFallbackSystemReset = () => {
    setIsRequestingAdminReset(true);
    const res = requestPasswordReset(currentUser.email);
    setIsRequestingAdminReset(false);
    if (res.success) {
      setPasswordFeedback({
        type: 'success',
        message: 'Pedido oficial enviado com sucesso! O Administrador Técnico foi notificado no módulo de Auditoria e fornecerá uma nova palavra-passe temporária.',
      });
    } else {
      setPasswordFeedback({ type: 'error', message: res.error || 'Erro ao enviar pedido ao Administrador.' });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileUploadError(null);
    setIsProcessingFile(true);
    try {
      const processed = await processProofFile(file);
      setProofForm((prev) => ({
        ...prev,
        fileName: processed.fileName,
        base64: processed.base64,
      }));
    } catch (err: any) {
      setFileUploadError(err.message || 'Erro ao processar ficheiro.');
      e.target.value = '';
    } finally {
      setIsProcessingFile(false);
    }
  };

  const [proofSubmitError, setProofSubmitError] = useState<string | null>(null);
  const [portalActionSuccess, setPortalActionSuccess] = useState<string | null>(null);

  const handleProofSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProofSubmitError(null);
    const fee = selectableInstitutionalFees.find(f => f.id === proofForm.feeDefinitionId) || selectableInstitutionalFees[0];
    const res = submitPaymentProof({
      feeDefinitionId: fee?.id || proofForm.feeDefinitionId,
      feeTitle: fee?.title || 'Quota Regular (Cada Domingo)',
      amountInCents: parseKzToCents(proofForm.amountStr),
      paymentMethod: proofForm.paymentMethod,
      referenceCode: '',
      paymentDate: proofForm.paymentDate,
      attachmentFileName: proofForm.fileName,
      attachmentBase64: proofForm.base64,
      accountId: proofForm.accountId,
    });
    
    if (res.success) {
      setIsProofModalOpen(false);
      setProofSubmitError(null);
      setPortalActionSuccess('Comprovativo submetido com sucesso! Aguarda conferência da Tesouraria.');
      setTimeout(() => setPortalActionSuccess(null), 4000);
      setProofForm({
        feeDefinitionId: selectableInstitutionalFees[0]?.id || DEFAULT_QUOTA_FEE_ID,
        amountStr: '2500',
        paymentMethod: 'multicaixa_express',
        paymentDate: new Date().toISOString().split('T')[0],
        fileName: '',
        base64: '',
        accountId: state.accounts[0]?.id || '',
      });
    } else {
      setProofSubmitError(res.error || 'Erro ao submeter comprovativo.');
    }
  };



  // Estados das Abas do Portal
  const [activePortalTab, setActivePortalTab] = useState<'geral' | 'agenda' | 'sugestoes' | 'mensagens'>('geral');
  const [agendaScopeFilter, setAgendaScopeFilter] = useState<'proximas' | 'anteriores'>('proximas');
  const [rsvpNoteMap, setRsvpNoteMap] = useState<Record<string, string>>({});
  const [rsvpFeedback, setRsvpFeedback] = useState<{
    activityId: string;
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  React.useEffect(() => {
    if (activePortalTab === 'mensagens' && member) {
      myMessages.forEach(msg => {
        const isUnread = !(msg.readBy && msg.readBy.includes(member.id));
        if (isUnread) {
          markMessageAsRead(msg.id, member.id);
        }
      });
    }
  }, [activePortalTab, member?.id, myMessages.length]);

  const [directorSuggestionTab, setDirectorSuggestionTab] = useState<'todos' | 'meus'>('todos');
  const isDirectorOrAdmin = currentUser.role === 'diretor' || currentUser.role === 'admin_tecnico';

  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [suggestionForm, setSuggestionForm] = useState<{
    category: SuggestionCategory;
    subject: string;
    content: string;
    isAnonymous: boolean;
  }>({
    category: 'geral',
    subject: '',
    content: '',
    isAnonymous: false,
  });
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);
  const [suggestionFeedback, setSuggestionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estados para Resposta do Diretor
  const [selectedSuggestionToReply, setSelectedSuggestionToReply] = useState<MemberSuggestion | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyAutoMarkViewed, setReplyAutoMarkViewed] = useState(true);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Estado para Detalhes de Sugestão
  const [selectedSuggestionToView, setSelectedSuggestionToView] = useState<MemberSuggestion | null>(null);

  // Filtros
  const [suggestionStatusFilter, setSuggestionStatusFilter] = useState<string>('all');
  const [suggestionCategoryFilter, setSuggestionCategoryFilter] = useState<string>('all');
  const [suggestionSearch, setSuggestionSearch] = useState('');

  const allSuggestions = state.suggestions || [];
  
  // Sugestões exclusivas do próprio membro vinculado
  const mySuggestions = member
    ? allSuggestions.filter((s) => s.memberId === member.id)
    : [];

  // Sugestões para visualização do Diretor
  const directorSuggestions = allSuggestions.filter((s) => {
    if (suggestionStatusFilter !== 'all') {
      if (suggestionStatusFilter === 'pendente' && s.viewedByDirector) return false;
      if (suggestionStatusFilter === 'visualizado' && (!s.viewedByDirector || s.status === 'respondido')) return false;
      if (suggestionStatusFilter === 'respondido' && s.status !== 'respondido') return false;
    }
    if (suggestionCategoryFilter !== 'all' && s.category !== suggestionCategoryFilter) {
      return false;
    }
    if (suggestionSearch.trim()) {
      const q = suggestionSearch.toLowerCase();
      const matchSubject = s.subject.toLowerCase().includes(q);
      const matchContent = s.content.toLowerCase().includes(q);
      const matchAuthor = s.isAnonymous ? false : s.memberName.toLowerCase().includes(q);
      if (!matchSubject && !matchContent && !matchAuthor) return false;
    }
    return true;
  });

  const unviewedCount = allSuggestions.filter((s) => !s.viewedByDirector).length;
  const answeredCount = mySuggestions.filter((s) => s.status === 'respondido').length;

  const handleSuggestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionForm.subject.trim() || !suggestionForm.content.trim()) {
      setSuggestionFeedback({ type: 'error', message: 'O assunto e a mensagem são obrigatórios.' });
      return;
    }
    setIsSubmittingSuggestion(true);
    setSuggestionFeedback(null);
    const res = submitMemberSuggestion({
      category: suggestionForm.category,
      subject: suggestionForm.subject,
      content: suggestionForm.content,
      isAnonymous: suggestionForm.isAnonymous,
    });
    setIsSubmittingSuggestion(false);
    if (res.success) {
      setSuggestionFeedback({
        type: 'success',
        message: 'A sua sugestão foi enviada confidencialmente à Direção! O Diretor poderá visualizá-la e responder diretamente.',
      });
      setSuggestionForm({
        category: 'geral',
        subject: '',
        content: '',
        isAnonymous: false,
      });
      setTimeout(() => {
        setIsSuggestionModalOpen(false);
        setSuggestionFeedback(null);
        setActivePortalTab('sugestoes');
      }, 1800);
    } else {
      setSuggestionFeedback({ type: 'error', message: res.error || 'Erro ao enviar sugestão.' });
    }
  };

  const handleDirectorReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSuggestionToReply) return;
    setReplyError(null);
    setIsSubmittingReply(true);
    const res = respondToSuggestion(
      selectedSuggestionToReply.id,
      replyText,
      replyAutoMarkViewed
    );
    setIsSubmittingReply(false);
    if (res.success) {
      setSelectedSuggestionToReply(null);
      setReplyText('');
      setReplyError(null);
    } else {
      setReplyError(res.error || 'Erro ao gravar resposta.');
    }
  };

  const handleQuickMarkViewed = (suggestionId: string) => {
    markSuggestionAsViewed(suggestionId);
  };

  if (!member || !can('member_portal', 'VIEW')) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 max-w-xl mx-auto text-center space-y-3 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-black text-slate-900 dark:text-white">
          Acesso Restrito ao Portal do Membro
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Esta conta de utilizador não está vinculada a nenhuma ficha de membro oficial. Apenas utilizadores vinculados a um membro têm acesso ao Portal do Membro, garantindo que cada pessoa visualize e interaja exclusivamente com os seus próprios dados e registos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {portalActionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center justify-between shadow-xs">
          <span>{portalActionSuccess}</span>
          <button
            type="button"
            onClick={() => setPortalActionSuccess(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold ml-2 text-sm"
          >
            ×
          </button>
        </div>
      )}

      {/* Topo do Portal */}
      <div className="bg-slate-900 text-white p-6 rounded-xl border border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-blue-400 font-bold">
              Área Exclusiva do Membro · Clube de Embaixadores Pioneiros D'Alvorada
            </div>
            <h1 className="text-2xl font-black text-slate-100 mt-1">{member.fullName}</h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Matrícula Oficial: <strong>{member.manualNumber}</strong> · Equipa: <strong>{getMemberTeamLabel(member, state.users)}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsDigitalCardOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-300 bg-slate-800 hover:bg-slate-700 active:bg-slate-850 rounded-lg border border-amber-400/50 shadow-xs transition-colors cursor-pointer"
              title="Visualizar o meu Cartão Digital Oficial com QR Code"
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span>O Meu Cartão Digital</span>
            </button>
            <button
              onClick={() => setIsDigitalCardOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-800 hover:bg-blue-700 rounded-lg border border-blue-900 shadow-xs transition-colors cursor-pointer"
              title="Gerar PDF para impressão do cartão digital"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Cartão (PDF)</span>
            </button>
            <button
              onClick={() => {
                setPasswordFeedback(null);
                setNewPasswordInput('');
                setConfirmPasswordInput('');
                setIsPasswordModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
              title="Redefinir palavra-passe da conta (permitido 1 vez a cada 2 meses)"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Redefinir Senha</span>
            </button>
            <button
              onClick={() => setIsProofModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-xs transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Reportar Pagamento</span>
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Seleção de Abas do Portal */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 rounded-xl shadow-xs">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActivePortalTab('geral')}
            className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
              activePortalTab === 'geral'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Meu Painel Pessoal & Registos</span>
          </button>
          <button
            onClick={() => setActivePortalTab('agenda')}
            className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
              activePortalTab === 'agenda'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Agenda do Clube</span>
            {upcomingPortalActivities.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-black bg-emerald-600 text-white rounded-full">
                {upcomingPortalActivities.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActivePortalTab('sugestoes')}
            className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
              activePortalTab === 'sugestoes'
                ? 'bg-amber-500 text-amber-950 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            <span>
              {isDirectorOrAdmin ? 'Aba de Sugestões da Direção' : 'Sugestões à Direção (Confidencial)'}
            </span>
            {isDirectorOrAdmin && unviewedCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-black bg-rose-600 text-white rounded-full">
                {unviewedCount} {unviewedCount === 1 ? 'não lida' : 'não lidas'}
              </span>
            )}
            {!isDirectorOrAdmin && answeredCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-black bg-emerald-700 text-white rounded-full">
                {answeredCount} resp.
              </span>
            )}
          </button>
          <button
            onClick={() => setActivePortalTab('mensagens')}
            className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
              activePortalTab === 'mensagens'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Mensagens e Avisos</span>
            {unreadMessagesCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-black bg-rose-600 text-white rounded-full">
                {unreadMessagesCount} {unreadMessagesCount === 1 ? 'nova' : 'novas'}
              </span>
            )}
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500">
          <Lock className="w-3.5 h-3.5 text-amber-600" />
          <span>Canal Seguro & Confidencial Diretor ↔ Membro</span>
        </div>
      </div>

      {activePortalTab === 'geral' && (() => {
        const biValidity = evaluateIdentityCardValidity(member.identityCardExpiryDate);
        return (
        <div className="space-y-6">
          {biValidity.isExpired && (
            <div className="bg-rose-50 border border-rose-300 p-4 rounded-xl text-xs text-rose-950 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-700 mt-0.5" />
              <div>
                <span className="font-bold">Bilhete de Identidade (B.I.) Expirado: </span>
                O seu B.I. expirou em <strong>{formatDateAO(member.identityCardExpiryDate)}</strong>.{' '}
                {enrollmentAvailability.isReconfirmationOpen
                  ? 'Atualize os dados do seu B.I. através do botão «Fazer Reconfirmação de Dados» abaixo.'
                  : 'Apresente o seu B.I. renovado na Secretaria para atualização da ficha.'}
              </div>
            </div>
          )}

          {/* Situação Documental e Reconfirmação na Secretaria */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-900" />
                <span>Situação Cadastral e Documental na Secretaria</span>
              </h2>
              {enrollmentAvailability.isReconfirmationOpen &&
                member.status !== 'arquivado' &&
                member.status !== 'transferido' && (
                  <button
                    type="button"
                    onClick={() => setIsReconfirmationModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>
                      {enrollmentAvailability.periodId &&
                      member.lastReconfirmedPeriodId === enrollmentAvailability.periodId
                        ? 'Atualizar Reconfirmação'
                        : 'Fazer Reconfirmação de Dados'}
                    </span>
                  </button>
                )}
            </div>
            <EnrollmentStatusCard
              registeredMember={member}
              reconfirmationInfo={{
                isReconfirmationOpen: enrollmentAvailability.isReconfirmationOpen,
                periodId: enrollmentAvailability.periodId,
                onStartReconfirmation: () => setIsReconfirmationModalOpen(true),
              }}
            />
          </div>

          {/* Alerta Institucional de Pagamentos */}
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-900 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-700 mt-0.5" />
            <div>
              <span className="font-bold">Aviso da Tesouraria: </span>
              A submissão de comprovativo de pagamento não constitui confirmação automática. A regularização
              da quota só é oficial após conferência bancária pelo Tesoureiro e emissão do respetivo recibo.
            </div>
          </div>

          {/* Situação Pessoal das Quotas (Recalculada Automaticamente) */}
          {myQuotaSummary && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-blue-900" />
                    <span>Situação das Minhas Quotas</span>
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Valor definido pela Tesouraria/Direção: <strong>{formatKz(myQuotaSummary.unitQuotaInCents)}</strong> por{' '}
                    {myQuotaSummary.frequency === 'domingo' ? 'domingo' : 'mês'} · {myQuotaSummary.periodsCharged}{' '}
                    {myQuotaSummary.frequency === 'domingo'
                      ? myQuotaSummary.periodsCharged === 1
                        ? 'domingo cobrado'
                        : 'domingos cobrados'
                      : myQuotaSummary.periodsCharged === 1
                      ? 'mês cobrado'
                      : 'meses cobrados'}{' '}
                    desde {formatDateAO(myQuotaSummary.effectiveStartDate)}.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase border ${
                      myQuotaSummary.status === 'regularizado'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : myQuotaSummary.status === 'antecipado'
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : myQuotaSummary.status === 'parcial'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    {myQuotaSummary.status === 'regularizado'
                      ? 'Regularizado'
                      : myQuotaSummary.status === 'antecipado'
                      ? 'Antecipado'
                      : myQuotaSummary.status === 'parcial'
                      ? 'Pagamento Parcial'
                      : 'Em Atraso'}
                  </span>
                  {myQuotaSummary.balanceDueInCents > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetFeeId =
                          activeQuotaConfig.activeQuotaFeeId ||
                          state.fees.find((f) => f.category === 'quota_diaria' || f.category === 'quota_mensal')?.id ||
                          state.fees[0]?.id ||
                          '';
                        setProofForm((prev) => ({
                          ...prev,
                          feeDefinitionId: targetFeeId,
                          amountStr: String(Math.round(myQuotaSummary.balanceDueInCents / 100)),
                        }));
                        setIsProofModalOpen(true);
                      }}
                      className="px-3 py-1.5 text-[11px] font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors"
                    >
                      Enviar Comprovativo de Regularização
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Total Devido no Ciclo</div>
                  <div className="text-base font-black text-slate-900 mt-0.5 tabular-nums">
                    {formatKz(myQuotaSummary.totalDueInCents)}
                  </div>
                  {myQuotaSummary.totalWaivedInCents > 0 && (
                    <div className="text-[10px] text-amber-800 mt-0.5 tabular-nums">
                      Dívida zerada/isenta: {formatKz(myQuotaSummary.totalWaivedInCents)}
                    </div>
                  )}
                </div>
                <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200">
                  <div className="text-[10px] font-bold uppercase text-emerald-700">Já Pago (Confirmado)</div>
                  <div className="text-base font-black text-emerald-800 mt-0.5 tabular-nums">
                    {formatKz(myQuotaSummary.totalPaidInCents)}
                  </div>
                </div>
                <div
                  className={`p-3 rounded-lg border ${
                    myQuotaSummary.balanceDueInCents > 0
                      ? 'bg-rose-50/70 border-rose-200'
                      : 'bg-blue-50/70 border-blue-200'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase text-slate-600">
                    {myQuotaSummary.creditInCents > 0 ? 'Crédito Antecipado' : 'Saldo em Dívida'}
                  </div>
                  <div
                    className={`text-base font-black mt-0.5 tabular-nums ${
                      myQuotaSummary.balanceDueInCents > 0
                        ? 'text-rose-700'
                        : myQuotaSummary.creditInCents > 0
                        ? 'text-blue-800'
                        : 'text-emerald-700'
                    }`}
                  >
                    {myQuotaSummary.creditInCents > 0
                      ? `+${formatKz(myQuotaSummary.creditInCents)}`
                      : formatKz(myQuotaSummary.balanceDueInCents)}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
                  <span>Progresso de Regularização</span>
                  <span className="font-bold text-slate-900 tabular-nums">{myQuotaSummary.progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      myQuotaSummary.status === 'regularizado' || myQuotaSummary.status === 'antecipado'
                        ? 'bg-emerald-600'
                        : myQuotaSummary.status === 'parcial'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${myQuotaSummary.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Cartão Resumo: Próximas Atividades Autorizadas pelo Diretor */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-900" />
                  <span>Próximas Atividades do Clube ({upcomingPortalActivities.length})</span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Atividades oficiais autorizadas pelo Diretor para consulta e confirmação de presença.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePortalTab('agenda')}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-900 hover:underline cursor-pointer self-start sm:self-auto"
              >
                <span>Ver Agenda Completa</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {upcomingPortalActivities.length === 0 ? (
              <p className="text-xs text-slate-500">
                Nenhuma atividade futura publicada pelo Diretor no momento.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {upcomingPortalActivities.slice(0, 3).map((act) => {
                  const myRsvp = act.rsvps?.find((r) => r.memberId === member.id);
                  const tRange = getActivityTimeRangeLabel(act);
                  return (
                    <div
                      key={act.id}
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-blue-900 uppercase">
                          {getActivityTypeLabel(act.type)}
                        </span>
                        {myRsvp && (
                          <span
                            className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              myRsvp.status === 'vou'
                                ? 'bg-emerald-100 text-emerald-800'
                                : myRsvp.status === 'talvez'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {myRsvp.status === 'vou'
                              ? 'Confirmado'
                              : myRsvp.status === 'talvez'
                              ? 'Talvez'
                              : 'Não Posso'}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-slate-900 truncate">{act.title}</h3>
                      <p className="text-[11px] text-slate-600">
                        {formatDateAO(act.startDate)}
                        {tRange ? ` · ${tRange}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{act.location}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

      {/* Grid de Seções do Membro */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bloco 1: Meus Recibos Oficiais */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-blue-900" />
              <span>Meus Recibos Emitidos ({myReceipts.length})</span>
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {myReceipts.length === 0 ? (
              <p className="p-4 text-xs text-slate-500">Nenhum recibo emitido até ao momento.</p>
            ) : (
              myReceipts.map((r) => (
                <div key={r.id} className="p-4 flex items-center justify-between hover:bg-slate-50 text-xs">
                  <div>
                    <span className="font-mono font-bold text-slate-900">{r.receiptNumber}</span>
                    <p className="text-slate-600 font-medium mt-0.5">{r.feeTitle}</p>
                    <p className="text-[10px] text-slate-400">{r.periodLabel} · {formatDateAO(r.paidAt)}</p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <span className="font-black text-slate-900 block">{formatKz(r.amountPaidInCents)}</span>
                      <span className="text-[10px] font-bold uppercase text-emerald-700">Confirmado</span>
                    </div>
                    <button
                      onClick={() =>
                        setPrintedReceipt({
                          id: r.id,
                          documentNumber: r.receiptNumber,
                          documentType: 'recibo',
                          title: `Recibo Oficial - ${r.memberName}`,
                          year: state.settings.currentYear,
                          issuedToName: r.memberName,
                          issuedToMemberId: member?.manualNumber || r.memberId,
                          issuedByUserId: r.treasurerUserId,
                          issuedByName: r.treasurerName,
                          issuedByRole: r.treasurerRole,
                          issuedAt: r.paidAt,
                          contentData: {
                            valor: formatKz(r.amountPaidInCents),
                            mes: r.periodLabel,
                            metodo: r.paymentMethod,
                            memberId: member?.manualNumber || r.memberId,
                            rubrica: r.feeTitle,
                          },
                          isCancelled: r.isCancelled || false,
                        })
                      }
                      className="p-1.5 text-slate-500 hover:text-blue-900 rounded"
                      title="Imprimir Recibo"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bloco 2: Meus Módulos e Medalhas */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-blue-900" />
              <span>Módulos e Medalhas em Curso</span>
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {myTraining.length === 0 ? (
              <p className="p-4 text-xs text-slate-500">Nenhuma formação curricular em curso.</p>
            ) : (
              myTraining.map((tr) => {
                const pct = Math.round((tr.completedRequirements.length / tr.totalRequirements) * 100);
                return (
                  <div key={tr.id} className="p-4 text-xs hover:bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{tr.targetTitle}</span>
                      <span className="font-bold text-blue-900">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden my-2">
                      <div className="bg-blue-900 h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Instrutor: {tr.instructorName}</span>
                      <span className={tr.finalAuthorizedApproval ? 'text-emerald-700 font-bold' : 'text-amber-700'}>
                        {tr.finalAuthorizedApproval ? 'Investidura Aprovada' : 'Em Curso'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Bloco 3: Circulares & Avisos Oficiais */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-blue-900" />
              <span>Circulares & Avisos ({myCirculars.length})</span>
            </h2>
          </div>

          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {myCirculars.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400 italic">Nenhum comunicado oficial pendente.</p>
            ) : (
              myCirculars.map((circular) => {
                const isRead = member && circular.readBy.includes(member.id);
                return (
                  <div key={circular.id} className={`p-4 transition-colors ${!isRead ? 'bg-blue-50/30' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${
                            circular.priority === 'urgente' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                            circular.priority === 'alta' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                            'bg-blue-100 text-blue-800 border-blue-200'
                          }`}>
                            {circular.priority}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatDateAO(circular.publishedAt)}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">{circular.title}</h3>
                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap line-clamp-3">
                          {circular.content}
                        </p>
                      </div>
                      {!isRead ? (
                        <button
                          onClick={() => markCircularAsRead(circular.id)}
                          className="px-3 py-1.5 text-[10px] font-bold bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition-all shadow-xs shrink-0"
                        >
                          Confirmar Leitura
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 text-emerald-600 shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase">Lido</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Bloco 4: Segurança da Conta & Palavra-passe (1 vez a cada 2 meses) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-blue-900" />
              <span>Segurança da Conta & Credenciais</span>
            </h2>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
              isCooldownActive ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {isCooldownActive ? `Bloqueio (${daysRemaining}d)` : 'Disponível'}
            </span>
          </div>

          <div className="p-4 text-xs space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900">Redefinição no Portal do Membro</p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Regra de segurança: cada utilizador pode redefinir a palavra-passe diretamente <strong>1 vez a cada 2 meses</strong>.
                </p>
              </div>
              <button
                onClick={() => {
                  setPasswordFeedback(null);
                  setNewPasswordInput('');
                  setConfirmPasswordInput('');
                  setIsPasswordModalOpen(true);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded shadow-xs shrink-0 transition-colors ${
                  isCooldownActive
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                    : 'bg-blue-900 hover:bg-blue-800 text-white'
                }`}
              >
                {isCooldownActive ? 'Ver Método do Sistema' : 'Redefinir Palavra-passe'}
              </button>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <p>
                <span className="font-semibold text-slate-800">Última alteração: </span>
                {currentUser.lastPasswordChangedAt
                  ? formatDateAO(currentUser.lastPasswordChangedAt)
                  : currentUser.lastAdminPasswordResetAt
                    ? `Redefinida pelo Administrador em ${formatDateAO(currentUser.lastAdminPasswordResetAt)} (pronta para redefinição pessoal)`
                    : 'Nunca alterada diretamente no portal'}
              </p>
              {isCooldownActive && nextAllowedDate && (
                <p className="text-amber-800 font-medium">
                  Próxima alteração direta permitida em: <strong>{formatDateAO(nextAllowedDate)}</strong> (faltam {daysRemaining} dias).
                </p>
              )}
            </div>

            {currentUser.lastAdminPasswordResetAt && !currentUser.lastPasswordChangedAt && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-[11px] flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                <p>
                  <strong>Redefinição liberada pelo Administrador:</strong> A sua palavra-passe foi redefinida pelo Administrador. Já pode definir livremente a sua nova palavra-passe pessoal aqui no Portal do Membro.
                </p>
              </div>
            )}

            {currentUser.passwordResetRequested && (
              <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-blue-700 shrink-0 mt-0.5" />
                <p>
                  <strong>Solicitação pendente:</strong> O seu pedido de redefinição foi enviado ao Administrador. Assim que o Administrador concluir a redefinição, poderá definir a sua nova palavra-passe pessoal aqui no Portal do Membro.
                </p>
              </div>
            )}

            {isCooldownActive && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                <p>
                  Esqueceu a palavra-passe durante este intervalo? O sistema permite solicitar redefinição assistida oficial ao Administrador Técnico.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comprovativos Submetidos Pendentes de Validação */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Comprovativos de Pagamento Enviados à Tesouraria ({myProofs.length})
          </h2>
        </div>

        <div className="divide-y divide-slate-100">
          {myProofs.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">Nenhum comprovativo reportado.</p>
          ) : (
            myProofs.map((prf) => (
              <div key={prf.id} className="p-4 flex items-center justify-between hover:bg-slate-50 text-xs">
                <div>
                  <span className="font-semibold text-slate-900">{prf.feeTitle}</span>
                  <p className="text-slate-500 text-[11px]">
                    Ref: {prf.referenceCode} · Data: {formatDateAO(prf.paymentDate)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedProofToView(prf)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors cursor-pointer"
                    title="Visualizar documento anexado"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Ver Anexo</span>
                  </button>
                  <div className="text-right">
                    <span className="font-bold text-slate-900 block">{formatKz(prf.amountInCents)}</span>
                    <span className={`text-[10px] font-bold uppercase ${
                      prf.status === 'confirmado'
                        ? 'text-emerald-700'
                        : prf.status === 'rejeitado'
                        ? 'text-rose-700'
                        : 'text-amber-700'
                    }`}>
                      {prf.status === 'submetido' ? 'Pendente de Conferência' : prf.status}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
        );
      })()}

      {/* ABA AGENDA DO CLUBE (ATIVIDADES AUTORIZADAS PELO DIRETOR) */}
      {activePortalTab === 'agenda' && (() => {
        const displayedAgendaActivities =
          agendaScopeFilter === 'proximas' ? upcomingPortalActivities : pastPortalActivities;

        const handleRsvp = (activityId: string, status: ActivityRsvpStatus) => {
          const note = rsvpNoteMap[activityId];
          const res = submitActivityRsvp(activityId, status, note);
          if (res.success) {
            setRsvpFeedback({
              activityId,
              type: 'success',
              message:
                status === 'vou'
                  ? 'Presença confirmada! A direção foi notificada.'
                  : status === 'talvez'
                  ? 'Resposta «Talvez» registada.'
                  : 'Ausência justificada/registada.',
            });
            setTimeout(() => setRsvpFeedback(null), 4000);
          } else {
            setRsvpFeedback({
              activityId,
              type: 'error',
              message: res.error || 'Erro ao enviar confirmação.',
            });
          }
        };

        return (
          <div className="space-y-5">
            {/* Barra Informativa & Resumo Pessoal */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-900" />
                  <span>Agenda Oficial do Clube</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Visualização exclusiva das atividades autorizadas pela Direção para os membros, com exportação para calendário pessoal e confirmação de presença.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap shrink-0">
                {myAttendancePct !== null && (
                  <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                    <span className="text-[10px] font-bold uppercase text-blue-800 block">Minha Assiduidade</span>
                    <span className="font-black text-blue-950">
                      {myPresentCount} / {myRecordedAttendances.length} ({myAttendancePct}%)
                    </span>
                  </div>
                )}

                <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setAgendaScopeFilter('proximas')}
                    className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                      agendaScopeFilter === 'proximas'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Próximas ({upcomingPortalActivities.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgendaScopeFilter('anteriores')}
                    className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                      agendaScopeFilter === 'anteriores'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Anteriores ({pastPortalActivities.length})
                  </button>
                </div>
              </div>
            </div>

            {displayedAgendaActivities.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-2">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-800">
                  {agendaScopeFilter === 'proximas'
                    ? 'Nenhuma atividade futura autorizada para visualização'
                    : 'Nenhuma atividade anterior publicada neste histórico'}
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Apenas atividades expressamente liberadas pelo Diretor do Clube ficam visíveis no Portal do Membro.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {displayedAgendaActivities.map((act) => {
                  const typeStyle = ACTIVITY_TYPE_COLORS[act.type] || ACTIVITY_TYPE_COLORS.reuniao_regular;
                  const timeRange = getActivityTimeRangeLabel(act);
                  const endDateOnly = getActivityDateOnly(act.endDate);
                  const startDateOnly = getActivityDateOnly(act.startDate);
                  const hasDistinctEnd = Boolean(endDateOnly && endDateOnly !== startDateOnly);
                  const myRsvp = act.rsvps?.find((r) => r.memberId === member.id);
                  const linkedFee =
                    act.hasMemberContribution && act.feeDefinitionId
                      ? state.fees.find((f) => f.id === act.feeDefinitionId)
                      : undefined;
                  const currentFeedback = rsvpFeedback?.activityId === act.id ? rsvpFeedback : null;

                  return (
                    <div
                      key={act.id}
                      className={`bg-white rounded-xl border border-slate-200 border-l-4 ${typeStyle.border} p-5 shadow-xs space-y-4`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${typeStyle.badge}`}>
                              {getActivityTypeLabel(act.type)}
                            </span>
                            <span className="text-[10px] font-bold uppercase text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              {act.department}
                            </span>
                            <span className="text-[10px] font-bold uppercase text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
                              {getActivityStageLabel(act.stage)}
                            </span>
                          </div>

                          <h3 className="text-base font-black text-slate-900">{act.title}</h3>

                          <div className="text-xs text-slate-600 flex items-center gap-3 flex-wrap">
                            <span className="flex items-center gap-1 font-semibold">
                              <Calendar className="w-3.5 h-3.5 text-blue-900" />
                              <span>
                                {formatDateAO(act.startDate)}
                                {hasDistinctEnd ? ` até ${formatDateAO(act.endDate)}` : ''}
                              </span>
                            </span>
                            {timeRange && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="flex items-center gap-1 font-semibold">
                                  <Clock className="w-3.5 h-3.5 text-blue-900" />
                                  <span>{timeRange}</span>
                                </span>
                              </>
                            )}
                            <span className="text-slate-300">·</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>{act.location}</span>
                            </span>
                          </div>

                          {act.description && (
                            <p className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-3 leading-relaxed mt-2">
                              {act.description}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => downloadActivityICS(act, state.settings.clubName)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Exportar .ics</span>
                          </button>

                          {linkedFee && (
                            <button
                              type="button"
                              onClick={() => {
                                setProofForm((prev) => ({
                                  ...prev,
                                  feeDefinitionId: linkedFee.id,
                                  amountStr: String(Math.round(linkedFee.amountInCents / 100)),
                                }));
                                setIsProofModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors cursor-pointer"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Pagar Inscrição ({formatKz(linkedFee.amountInCents)})</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Secção de Confirmação de Presença (RSVP) */}
                      {act.stage !== 'encerrado' && (
                        <div className="pt-3 border-t border-slate-100 space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-800">
                              Confirmação de Presença (RSVP):
                            </span>
                            {myRsvp && (
                              <span
                                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full self-start sm:self-auto ${
                                  myRsvp.status === 'vou'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : myRsvp.status === 'talvez'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                A sua resposta atual:{' '}
                                {myRsvp.status === 'vou'
                                  ? 'Vou Participar'
                                  : myRsvp.status === 'talvez'
                                  ? 'Talvez'
                                  : 'Não Posso Ir'}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
                            <input
                              type="text"
                              placeholder="Observação opcional (ex: Chego 15 min depois, levo material...)"
                              value={rsvpNoteMap[act.id] ?? myRsvp?.note ?? ''}
                              onChange={(e) =>
                                setRsvpNoteMap((prev) => ({ ...prev, [act.id]: e.target.value }))
                              }
                              className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                            />
                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleRsvp(act.id, 'vou')}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                                  myRsvp?.status === 'vou'
                                    ? 'bg-emerald-700 text-white border-emerald-700'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Vou Participar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRsvp(act.id, 'talvez')}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                                  myRsvp?.status === 'talvez'
                                    ? 'bg-amber-600 text-white border-amber-600'
                                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                }`}
                              >
                                <HelpCircle className="w-3.5 h-3.5" />
                                <span>Talvez</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRsvp(act.id, 'nao_posso')}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                                  myRsvp?.status === 'nao_posso'
                                    ? 'bg-rose-700 text-white border-rose-700'
                                    : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                                }`}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Não Posso Ir</span>
                              </button>
                            </div>
                          </div>

                          {currentFeedback && (
                            <p
                              className={`text-[11px] font-semibold ${
                                currentFeedback.type === 'success' ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {currentFeedback.message}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

  {/* ABA DE SUGESTÕES À DIREÇÃO */}
  {activePortalTab === 'sugestoes' && (
    <div className="space-y-6">
      {/* Banner Confidencial */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 text-white p-5 rounded-xl border border-amber-500/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300">
              <Lock className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Canal Estritamente Confidencial · Diretor ↔ Membro
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white">
            {isDirectorOrAdmin
              ? 'Aba da Direção · Caixa de Sugestões dos Membros'
              : 'Caixa de Sugestões à Direção do Clube'}
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            {isDirectorOrAdmin
              ? 'Como Diretor, pode analisar todas as sugestões enviadas pelos membros, sinalizar como visualizadas e dar uma resposta confidencial oficial.'
              : 'Envie sugestões de melhoria, ideias de atividades ou observações diretamente ao Diretor. O Diretor analisará, colocará visualizado e poderá dar-lhe uma resposta privada.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setSuggestionFeedback(null);
              setSuggestionForm({ category: 'geral', subject: '', content: '', isAnonymous: false });
              setIsSuggestionModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Lightbulb className="w-4 h-4 text-amber-950" />
            <span>Escrever Nova Sugestão</span>
          </button>
        </div>
      </div>

      {/* SE FOR DIRETOR / ADMIN: Exibir Navegação de Gestão da Direção */}
      {isDirectorOrAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-xs flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDirectorSuggestionTab('todos')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-2 ${
                directorSuggestionTab === 'todos'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>Todas as Sugestões Recebidas</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                directorSuggestionTab === 'todos' ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-700'
              }`}>
                {allSuggestions.length}
              </span>
            </button>
            <button
              onClick={() => setDirectorSuggestionTab('meus')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-2 ${
                directorSuggestionTab === 'meus'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>Minhas Sugestões Pessoais</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                directorSuggestionTab === 'meus' ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-700'
              }`}>
                {mySuggestions.length}
              </span>
            </button>
          </div>

          {unviewedCount > 0 && (
            <div className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              <span>{unviewedCount} {unviewedCount === 1 ? 'sugestão aguarda' : 'sugestões aguardam'} a sua visualização</span>
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO PARA O DIRETOR: VISÃO GERAL DE TODAS AS SUGESTÕES */}
      {isDirectorOrAdmin && directorSuggestionTab === 'todos' ? (
        <div className="space-y-4">
          {/* Métricas e Filtros Rápidos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              onClick={() => setSuggestionStatusFilter('all')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                suggestionStatusFilter === 'all'
                  ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-900/10'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="text-[11px] font-bold uppercase text-slate-500">Total Recebidas</div>
              <div className="text-xl font-black text-slate-900 mt-1">{allSuggestions.length}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Todas as categorias</div>
            </div>

            <div
              onClick={() => setSuggestionStatusFilter('pendente')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                suggestionStatusFilter === 'pendente'
                  ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="text-[11px] font-bold uppercase text-amber-700 flex items-center gap-1">
                <span>Por Visualizar</span>
                {unviewedCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
              </div>
              <div className="text-xl font-black text-amber-900 mt-1">{unviewedCount}</div>
              <div className="text-[10px] text-amber-700/80 mt-0.5">Sem marcação de visto</div>
            </div>

            <div
              onClick={() => setSuggestionStatusFilter('visualizado')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                suggestionStatusFilter === 'visualizado'
                  ? 'bg-sky-50/70 border-sky-300 ring-2 ring-sky-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="text-[11px] font-bold uppercase text-sky-800">Visualizadas</div>
              <div className="text-xl font-black text-sky-950 mt-1">
                {allSuggestions.filter((s) => s.viewedByDirector && s.status !== 'respondido').length}
              </div>
              <div className="text-[10px] text-sky-700/80 mt-0.5">Visto pelo Diretor</div>
            </div>

            <div
              onClick={() => setSuggestionStatusFilter('respondido')}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                suggestionStatusFilter === 'respondido'
                  ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="text-[11px] font-bold uppercase text-emerald-800">Respondidas</div>
              <div className="text-xl font-black text-emerald-950 mt-1">
                {allSuggestions.filter((s) => s.status === 'respondido').length}
              </div>
              <div className="text-[10px] text-emerald-700/80 mt-0.5">Com resposta oficial</div>
            </div>
          </div>

          {/* Barra de Pesquisa e Filtros */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Pesquisar por assunto, mensagem ou autor..."
                value={suggestionSearch}
                onChange={(e) => setSuggestionSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={suggestionCategoryFilter}
                onChange={(e) => setSuggestionCategoryFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-900"
              >
                <option value="all">Todas as Áreas / Categorias</option>
                <option value="geral">Geral</option>
                <option value="atividades">Atividades & Acampamentos</option>
                <option value="lideranca">Liderança & Reuniões</option>
                <option value="material_espaco">Material & Espaço Físico</option>
                <option value="espiritual">Espiritual & Social</option>
                <option value="organizacao">Organização & Disciplina</option>
                <option value="outro">Outro Assunto</option>
              </select>

              <select
                value={suggestionStatusFilter}
                onChange={(e) => setSuggestionStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-900"
              >
                <option value="all">Todos os Estados</option>
                <option value="pendente">Apenas Por Visualizar</option>
                <option value="visualizado">Apenas Visualizadas</option>
                <option value="respondido">Apenas Respondidas</option>
              </select>
            </div>
          </div>

          {/* Lista de Sugestões para o Diretor */}
          <div className="space-y-3">
            {directorSuggestions.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                <Lightbulb className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">Nenhuma sugestão encontrada</p>
                <p className="text-xs text-slate-400 mt-1">
                  Tente ajustar os filtros ou a pesquisa de texto.
                </p>
              </div>
            ) : (
              directorSuggestions.map((sug) => {
                const catInfo = SUGGESTION_CATEGORY_MAP[sug.category] || SUGGESTION_CATEGORY_MAP.geral;
                return (
                  <div
                    key={sug.id}
                    className={`bg-white rounded-xl border transition-all p-5 shadow-xs hover:shadow-sm space-y-3 ${
                      !sug.viewedByDirector ? 'border-amber-300 bg-amber-50/20 ring-1 ring-amber-300/50' : 'border-slate-200'
                    }`}
                  >
                    {/* Topo da sugestão */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${catInfo.badgeBg}`}>
                          {catInfo.label}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">{sug.id}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-[11px] text-slate-500">{formatDateAO(sug.createdAt)}</span>
                        {sug.isAnonymous ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            <Lock className="w-3 h-3 text-amber-600" />
                            <span>Membro Anónimo (Confidencial)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                            <User className="w-3 h-3 text-blue-900" />
                            <span>{sug.memberName}</span>
                            {sug.memberManualNumber && (
                              <span className="text-[10px] font-mono text-slate-500">({sug.memberManualNumber})</span>
                            )}
                          </span>
                        )}
                      </div>

                      {/* Status Pill */}
                      <div className="flex items-center gap-2">
                        {sug.status === 'respondido' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Respondido</span>
                          </span>
                        ) : sug.viewedByDirector ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                            <Eye className="w-3 h-3" />
                            <span>Visualizado</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                            <Clock className="w-3 h-3" />
                            <span>Por Visualizar</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Assunto e Mensagem */}
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">{sug.subject}</h3>
                      <p className="text-xs text-slate-700 mt-1.5 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100">
                        {sug.content}
                      </p>
                    </div>

                    {/* Resposta do Diretor (se existir) */}
                    {sug.responseContent && (
                      <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Resposta da Direção ({sug.respondedByDirectorName || 'Diretor'}):</span>
                          </span>
                          {sug.respondedAt && (
                            <span className="text-[10px] text-emerald-700">{formatDateAO(sug.respondedAt)}</span>
                          )}
                        </div>
                        <p className="text-xs text-emerald-950 whitespace-pre-wrap leading-relaxed">
                          {sug.responseContent}
                        </p>
                      </div>
                    )}

                    {/* Rodapé e Ações do Diretor */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        {sug.viewedByDirector ? (
                          <span className="text-sky-700 flex items-center gap-1 font-medium">
                            <Eye className="w-3.5 h-3.5" />
                            <span>Visualizado por {sug.viewedByDirectorName || 'Diretor'} em {sug.viewedAt ? formatDateAO(sug.viewedAt) : 'data registada'}</span>
                          </span>
                        ) : (
                          <span className="text-amber-700 flex items-center gap-1 font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Pendente de leitura pela Direção</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {!sug.viewedByDirector && (
                          <button
                            onClick={() => handleQuickMarkViewed(sug.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-300 rounded-lg transition-colors cursor-pointer"
                            title="Marcar esta sugestão como visualizada pela Direção"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Colocar Visualizado</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setSelectedSuggestionToReply(sug);
                            setReplyText(sug.responseContent || '');
                            setReplyAutoMarkViewed(true);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors cursor-pointer"
                          title="Escrever uma resposta oficial ao membro"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{sug.responseContent ? 'Editar Resposta' : 'Dar uma Resposta (Opcional)'}</span>
                        </button>

                        <button
                          onClick={() => setSuggestionToDelete({ id: sug.id, subject: sug.subject })}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Eliminar sugestão"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* CONTEÚDO PARA MEMBRO (OU DIRETOR NA ABA 'MEUS') */
        <div className="space-y-4">
          {/* Bloco de Ação Rápida */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span>Minhas Sugestões Enviadas à Direção ({mySuggestions.length})</span>
              </h3>
              <p className="text-xs text-slate-500">
                Acompanhe aqui o estado das suas sugestões: se já foram visualizadas pelo Diretor e as respetivas respostas.
              </p>
            </div>

            <button
              onClick={() => {
                setSuggestionFeedback(null);
                setSuggestionForm({ category: 'geral', subject: '', content: '', isAnonymous: false });
                setIsSuggestionModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Enviar Nova Sugestão ao Diretor</span>
            </button>
          </div>

          {/* Lista das Minhas Sugestões */}
          <div className="space-y-3">
            {mySuggestions.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 space-y-3">
                <Lightbulb className="w-10 h-10 text-amber-400 mx-auto" />
                <div>
                  <p className="text-sm font-bold text-slate-800">Ainda não enviou nenhuma sugestão à Direção</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    A sua voz é muito importante para o crescimento do Clube. Tem ideias de acampamento, atividades, espaço ou formação? Envie já uma sugestão confidencial!
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSuggestionFeedback(null);
                    setSuggestionForm({ category: 'geral', subject: '', content: '', isAnonymous: false });
                    setIsSuggestionModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Escrever Minha Primeira Sugestão</span>
                </button>
              </div>
            ) : (
              mySuggestions.map((sug) => {
                const catInfo = SUGGESTION_CATEGORY_MAP[sug.category] || SUGGESTION_CATEGORY_MAP.geral;
                return (
                  <div
                    key={sug.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${catInfo.badgeBg}`}>
                          {catInfo.label}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">{sug.id}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-[11px] text-slate-500">{formatDateAO(sug.createdAt)}</span>
                        {sug.isAnonymous && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            <Lock className="w-3 h-3 text-amber-600" />
                            <span>Enviado como Anónimo</span>
                          </span>
                        )}
                      </div>

                      <div>
                        {sug.status === 'respondido' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Respondido pela Direção</span>
                          </span>
                        ) : sug.viewedByDirector ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                            <Eye className="w-3 h-3" />
                            <span>Visualizado pelo Diretor</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3 h-3" />
                            <span>Aguardando Visualização</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm sm:text-base font-bold text-slate-900">{sug.subject}</h4>
                      <p className="text-xs text-slate-700 mt-1.5 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100">
                        {sug.content}
                      </p>
                    </div>

                    {/* Resposta do Diretor */}
                    {sug.responseContent ? (
                      <div className="bg-emerald-50/90 border border-emerald-300/80 rounded-xl p-4 space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                            <MessageSquare className="w-4 h-4 text-emerald-700" />
                            <span>Resposta Oficial do Diretor ({sug.respondedByDirectorName || 'Direção'}):</span>
                          </span>
                          {sug.respondedAt && (
                            <span className="text-[10px] font-medium text-emerald-800">{formatDateAO(sug.respondedAt)}</span>
                          )}
                        </div>
                        <p className="text-xs text-emerald-950 whitespace-pre-wrap leading-relaxed pl-5">
                          {sug.responseContent}
                        </p>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic bg-slate-50 px-3 py-2 rounded-lg flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {sug.viewedByDirector
                            ? `O Diretor visualizou a sua sugestão em ${sug.viewedAt ? formatDateAO(sug.viewedAt) : 'data recente'}. Resposta opcional pendente.`
                            : 'A sua sugestão foi entregue na caixa de entrada do Diretor e aguarda visualização.'}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Lock className="w-3 h-3 text-amber-600" />
                        <span>Processo confidencial: Visível apenas para si e para o Diretor</span>
                      </span>

                      <button
                        onClick={() => setSuggestionToDelete({ id: sug.id, subject: sug.subject })}
                        className="text-slate-400 hover:text-rose-600 text-[11px] flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remover</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  )}

      {/* MODAL 1: Reportar Comprovativo de Pagamento */}
      <Modal
        isOpen={isProofModalOpen}
        onClose={() => setIsProofModalOpen(false)}
        title="Reportar Pagamento de Quota / Taxa"
        description="Envie os dados do comprovativo bancário ou Multicaixa para verificação pela Tesouraria."
        maxWidth="md"
      >
        <form onSubmit={handleProofSubmit} className="space-y-4 text-xs">
          {proofSubmitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-between">
              <span>{proofSubmitError}</span>
              <button
                type="button"
                onClick={() => setProofSubmitError(null)}
                className="text-rose-500 hover:text-rose-800 font-bold ml-2 text-sm"
              >
                ×
              </button>
            </div>
          )}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Taxa / Quota a Liquidar</label>
            <select
              value={
                selectableInstitutionalFees.some((f) => f.id === proofForm.feeDefinitionId)
                  ? proofForm.feeDefinitionId
                  : selectableInstitutionalFees[0]?.id || DEFAULT_QUOTA_FEE_ID
              }
              onChange={(e) => setProofForm({ ...proofForm, feeDefinitionId: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
            >
              {selectableInstitutionalFees.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} ({formatKz(f.amountInCents)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Comprovativo</label>
            <input
              type="file"
              onChange={handleFileChange}
              className="w-full p-2 border border-slate-200 rounded text-xs file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-900 hover:file:bg-blue-100"
              accept="image/*,.pdf"
              required={!proofForm.base64}
            />
            {isProcessingFile && (
              <p className="text-[11px] text-blue-600 mt-1.5 flex items-center gap-1.5">
                <span className="animate-spin inline-block w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full" />
                A otimizar e preparar comprovativo...
              </p>
            )}
            {fileUploadError && (
              <p className="text-[11px] text-rose-600 mt-1 font-semibold">{fileUploadError}</p>
            )}
            {proofForm.fileName && !isProcessingFile && (
              <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2 truncate">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold truncate">{proofForm.fileName}</span>
                </div>
                {proofForm.base64 && proofForm.base64.startsWith('data:image') && (
                  <img
                    src={proofForm.base64}
                    alt="Pré-visualização"
                    className="w-8 h-8 object-cover rounded border border-emerald-300 ml-2 shrink-0"
                  />
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Valor Pago em Kz</label>
              <input
                type="text"
                value={proofForm.amountStr}
                onChange={(e) => setProofForm({ ...proofForm, amountStr: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Método Utilizado</label>
              <select
                value={proofForm.paymentMethod}
                onChange={(e) => setProofForm({ ...proofForm, paymentMethod: e.target.value as PaymentMethod })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              >
                <option value="multicaixa_express">Multicaixa Express</option>
                <option value="transferencia_bancaria">Transferência Bancária</option>
                <option value="deposito_bancario">Depósito em Balcão</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Conta Institucional de Destino</label>
            <select
              value={proofForm.accountId}
              onChange={(e) => setProofForm({ ...proofForm, accountId: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
            >
              {state.accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.type === 'banco' ? 'Banco' : 'Cofre'})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsProofModalOpen(false)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded shadow-xs"
            >
              Submeter Comprovativo
            </button>
          </div>
        </form>
      </Modal>


      {/* MODAL: Redefinição de Palavra-passe no Portal do Membro (1 vez a cada 2 meses) */}
      {isPasswordModalOpen && (
        <Modal
          isOpen={isPasswordModalOpen}
          onClose={() => {
            setIsPasswordModalOpen(false);
            setPasswordFeedback(null);
          }}
          title="Redefinição de Palavra-passe · Segurança da Conta"
          description="Gestão de credenciais de acesso ao Portal do Membro com política de segurança de 2 meses."
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            {passwordFeedback && (
              <div
                className={`p-3 rounded-lg border flex items-start gap-2 ${
                  passwordFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-semibold leading-relaxed">{passwordFeedback.message}</span>
              </div>
            )}

            {isCooldownActive ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-950 rounded-xl space-y-2">
                  <p className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Intervalo de Redefinição Ativo (1 vez a cada 2 meses)</span>
                  </p>
                  <p className="leading-relaxed">
                    A sua palavra-passe foi alterada recentemente em{' '}
                    <strong>{formatDateAO(currentUser.lastPasswordChangedAt || '')}</strong>.
                    Por diretriz institucional, uma nova redefinição direta pelo portal só poderá ser realizada após decorridos 2 meses (60 dias).
                  </p>
                  <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 space-y-1 text-[11px]">
                    <p className="text-slate-700">
                      Próxima redefinição direta disponível em: <strong>{formatDateAO(nextAllowedDate || '')}</strong>
                    </p>
                    <p className="text-amber-800 font-bold">
                      Dias restantes de intervalo: {daysRemaining} dia(s).
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-slate-700">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-blue-900" />
                    <span>Esqueceu da palavra-passe durante este intervalo?</span>
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Caso tenha esquecido da sua senha e não possa aguardar o término do intervalo, utilize o <strong>método oficial definido pelo Sistema</strong>: envie uma solicitação ao Administrador Técnico para redefinir as credenciais assistidas.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPasswordModalOpen(false);
                      setPasswordFeedback(null);
                    }}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    disabled={isRequestingAdminReset}
                    onClick={handleFallbackSystemReset}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{isRequestingAdminReset ? 'A enviar pedido...' : 'Solicitar ao Administrador (Método do Sistema)'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSelfPasswordResetSubmit} className="space-y-4">
                <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-950 text-[11px] space-y-1">
                  <p className="font-bold text-blue-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Redefinição Direta Permitida</span>
                  </p>
                  <p>
                    {currentUser.lastAdminPasswordResetAt && !currentUser.lastPasswordChangedAt
                      ? 'A sua conta foi redefinida pelo Administrador. Defina abaixo a sua nova palavra-passe pessoal — após gravar, iniciará um ciclo de segurança de 2 meses (60 dias).'
                      : 'Após gravar a nova palavra-passe, o sistema iniciará um novo ciclo de segurança de 2 meses durante o qual a senha não poderá ser alterada diretamente pelo portal.'}
                  </p>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Nova Palavra-passe <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Mínimo de 6 caracteres"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-900"
                    required
                    minLength={6}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Confirmar Nova Palavra-passe <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Repita a nova palavra-passe"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-blue-900"
                    required
                    minLength={6}
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPasswordModalOpen(false);
                      setPasswordFeedback(null);
                    }}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Salvar Nova Palavra-passe</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}

      {/* MODAL: Submeter Sugestão à Direção */}
      <Modal
        isOpen={isSuggestionModalOpen}
        onClose={() => {
          setIsSuggestionModalOpen(false);
          setSuggestionFeedback(null);
        }}
        title="Enviar Sugestão à Direção"
        description="Canal estritamente confidencial. A sua mensagem é entregue diretamente ao Diretor do Clube."
        maxWidth="lg"
      >
        <form onSubmit={handleSuggestionSubmit} className="space-y-4 text-xs">
          {suggestionFeedback && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                suggestionFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {suggestionFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{suggestionFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuggestionFeedback(null)}
                className="text-slate-500 hover:text-slate-800 font-bold ml-2 text-sm"
              >
                ×
              </button>
            </div>
          )}

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1 text-[11px] text-amber-950">
            <div className="font-bold flex items-center gap-1.5 text-amber-900">
              <Lock className="w-3.5 h-3.5 text-amber-700" />
              <span>Garantia de Confidencialidade Diretor ↔ Membro</span>
            </div>
            <p className="leading-relaxed">
              Esta sugestão não será pública nem visível para outros membros, Secretaria ou Tesouraria.
              Apenas o <strong>Diretor do Clube</strong> terá acesso para visualizá-la, marcar como lida e enviar-lhe uma resposta opcional.
            </p>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Área / Categoria da Sugestão <span className="text-rose-500">*</span>
            </label>
            <select
              value={suggestionForm.category}
              onChange={(e) =>
                setSuggestionForm({ ...suggestionForm, category: e.target.value as SuggestionCategory })
              }
              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 bg-white"
            >
              <option value="geral">Geral</option>
              <option value="atividades">Atividades & Acampamentos</option>
              <option value="lideranca">Liderança & Reuniões</option>
              <option value="material_espaco">Material & Espaço Físico</option>
              <option value="espiritual">Espiritual & Social</option>
              <option value="organizacao">Organização & Disciplina</option>
              <option value="outro">Outro Assunto</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Assunto <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Proposta de atividade comunitária para o 2º trimestre"
              value={suggestionForm.subject}
              onChange={(e) => setSuggestionForm({ ...suggestionForm, subject: e.target.value })}
              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Descrição da Sugestão / Proposta <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={5}
              placeholder="Descreva a sua ideia de forma clara, o motivo da proposta e os benefícios esperados para o Clube..."
              value={suggestionForm.content}
              onChange={(e) => setSuggestionForm({ ...suggestionForm, content: e.target.value })}
              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 leading-relaxed"
              required
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={suggestionForm.isAnonymous}
                onChange={(e) => setSuggestionForm({ ...suggestionForm, isAnonymous: e.target.checked })}
                className="mt-0.5 rounded text-blue-900 focus:ring-blue-900 w-4 h-4 cursor-pointer"
              />
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-900 block text-xs">
                  Submeter como Membro Anónimo
                </span>
                <span className="text-[11px] text-slate-500 leading-relaxed block">
                  Ao ativar esta opção, o seu nome e matrícula não serão exibidos ao Diretor. O Diretor verá a sugestão como "Membro Anónimo", preservando o seu total anonimato.
                </span>
              </div>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsSuggestionModalOpen(false);
                setSuggestionFeedback(null);
              }}
              className="px-3.5 py-2 text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmittingSuggestion}
              className="px-4 py-2 font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmittingSuggestion ? 'A submeter...' : 'Enviar Sugestão à Direção'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Resposta do Diretor à Sugestão */}
      {selectedSuggestionToReply && (
        <Modal
          isOpen={true}
          onClose={() => {
            setSelectedSuggestionToReply(null);
            setReplyText('');
            setReplyError(null);
          }}
          title="Aba da Direção · Resposta à Sugestão"
          description="Processo confidencial e exclusivo da Direção com o membro autor da sugestão."
          maxWidth="lg"
        >
          <form onSubmit={handleDirectorReplySubmit} className="space-y-4 text-xs">
            {replyError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-between">
                <span>{replyError}</span>
                <button
                  type="button"
                  onClick={() => setReplyError(null)}
                  className="text-rose-500 hover:text-rose-800 font-bold ml-2 text-sm"
                >
                  ×
                </button>
              </div>
            )}
            {/* Resumo da Sugestão */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-[11px] flex-wrap gap-1">
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-blue-900" />
                  <span>
                    {selectedSuggestionToReply.isAnonymous
                      ? 'Membro Anónimo (Confidencial)'
                      : `${selectedSuggestionToReply.memberName} (${selectedSuggestionToReply.memberManualNumber || 'Membro'})`}
                  </span>
                </span>
                <span className="text-slate-500">{formatDateAO(selectedSuggestionToReply.createdAt)}</span>
              </div>
              <div className="font-bold text-slate-900 text-sm">
                {selectedSuggestionToReply.subject}
              </div>
              <div className="text-slate-700 whitespace-pre-wrap bg-white p-3 rounded-lg border border-slate-200 leading-relaxed text-xs">
                {selectedSuggestionToReply.content}
              </div>
            </div>

            {/* Campo de Resposta Opcional */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-semibold">
                  Resposta Oficial do Diretor <span className="text-slate-400 font-normal">(Opcional)</span>
                </label>
                <span className="text-[10px] text-slate-400">
                  Visível apenas para este membro
                </span>
              </div>
              <textarea
                rows={4}
                placeholder="Escreva a resposta ou considerações da Direção para o membro (opcional)..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-900 leading-relaxed text-xs"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Se não pretender escrever uma resposta textual agora, pode simplesmente marcar a sugestão como "Visualizado".
              </p>
            </div>

            {/* Opção Marcar como Visualizado */}
            <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-xl">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={replyAutoMarkViewed}
                  onChange={(e) => setReplyAutoMarkViewed(e.target.checked)}
                  className="rounded text-blue-900 focus:ring-blue-900 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs font-semibold text-sky-950">
                  Marcar como "Visualizado pelo Diretor"
                </span>
              </label>
              <p className="text-[11px] text-sky-800 mt-1 pl-6">
                O membro verá a indicação de que o Diretor leu e considerou a sugestão apresentada.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <div>
                {!selectedSuggestionToReply.viewedByDirector && (
                  <button
                    type="button"
                    onClick={() => {
                      handleQuickMarkViewed(selectedSuggestionToReply.id);
                      setSelectedSuggestionToReply(null);
                      setReplyText('');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-sky-800 bg-sky-100 hover:bg-sky-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Apenas Colocar Visualizado</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSuggestionToReply(null);
                    setReplyText('');
                  }}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReply}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isSubmittingReply
                      ? 'A gravar...'
                      : replyText.trim()
                      ? 'Gravar e Enviar Resposta'
                      : 'Confirmar & Visualizar'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Impressão de Recibo do Membro */}
      <PrintDocumentModal
        document={printedReceipt}
        onClose={() => setPrintedReceipt(null)}
      />

      {/* ABA DE MENSAGENS */}
      {activePortalTab === 'mensagens' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold uppercase text-slate-800 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-900" />
              <span>Caixa de Mensagens & Comunicados ({myMessages.length})</span>
            </h2>
            {unreadMessagesCount > 0 && (
              <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full">
                {unreadMessagesCount} {unreadMessagesCount === 1 ? 'por ler' : 'por ler'}
              </span>
            )}
          </div>

          {myMessages.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              Nenhuma mensagem ou comunicado recebido no momento.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 space-y-4">
              {myMessages.map(msg => {
                const isUnread = !(msg.readBy && msg.readBy.includes(member.id));

                return (
                  <div key={msg.id} className={`p-4 rounded-xl border transition-colors space-y-3 ${isUnread ? 'bg-blue-50/40 border-blue-200' : 'bg-white border-slate-200'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isUnread && <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>}
                        <h3 className="font-bold text-sm text-slate-900">{msg.subject}</h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                          {msg.recipientType === 'all' ? 'Broadcast' : msg.recipientType.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">{formatDateAO(msg.createdAt)}</span>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-100">
                      {msg.content}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span className="font-semibold text-slate-800">Remetente: {msg.senderName}</span>
                    </div>

                    {/* Fio de Respostas */}
                    {msg.replies && msg.replies.length > 0 && (
                      <div className="pl-4 border-l-2 border-blue-900 space-y-2 pt-2">
                        <div className="font-bold text-[11px] text-blue-900">Respostas e Esclarecimentos:</div>
                        {msg.replies.map(rep => (
                          <div key={rep.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px]">
                            <div className="flex justify-between font-semibold text-slate-800">
                              <span>{rep.senderName}</span>
                              <span className="text-[10px] text-slate-400">{formatDateAO(rep.createdAt)}</span>
                            </div>
                            <p className="text-slate-700 mt-0.5">{rep.content}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Caixa de Resposta Rápida */}
                    <div className="pt-2 flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Escrever uma resposta à direção..."
                        value={replyInputMap[msg.id] || ''}
                        onChange={(e) => setReplyInputMap({ ...replyInputMap, [msg.id]: e.target.value })}
                        className="flex-1 p-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-900 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const text = replyInputMap[msg.id];
                          if (!text || !text.trim()) return;
                          const res = replyToMessage(msg.id, text);
                          if (res.success) {
                            setReplyInputMap({ ...replyInputMap, [msg.id]: '' });
                          }
                        }}
                        className="px-3 py-2 bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
                      >
                        Responder
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Visualização de Comprovativo Enviado */}
      <ProofDocumentViewerModal
        proof={selectedProofToView}
        onClose={() => setSelectedProofToView(null)}
      />

      {/* Cartão Digital Oficial do Membro */}
      <MemberDigitalCardModal
        member={isDigitalCardOpen ? member : null}
        onClose={() => setIsDigitalCardOpen(false)}
      />

      {/* Modal: Reconfirmação de Dados e Documentos do Membro */}
      {isReconfirmationModalOpen && enrollmentAvailability.isReconfirmationOpen && (
        <Modal
          isOpen={isReconfirmationModalOpen}
          onClose={() => setIsReconfirmationModalOpen(false)}
          title="Reconfirmação de Dados e Documentos"
          description="Atualize os seus dados cadastrais e documentos anexados para confirmar a sua permanência ativa no clube."
          maxWidth="3xl"
        >
          <MemberReconfirmationForm
            member={member}
            currentPeriodId={enrollmentAvailability.periodId}
            onSubmit={async (formData) => {
              const res = await submitMemberReconfirmation(member.id, formData);
              if (res.success) {
                setIsReconfirmationModalOpen(false);
                setPortalActionSuccess(
                  `Reconfirmação de dados concluída com sucesso (${formatDateTimeAO(new Date().toISOString())})! O seu estado encontra-se Ativo.`
                );
                setTimeout(() => setPortalActionSuccess(null), 5000);
              }
              return res;
            }}
            onCancel={() => setIsReconfirmationModalOpen(false)}
          />
        </Modal>
      )}
      {suggestionToDelete && (
        <Modal
          isOpen={Boolean(suggestionToDelete)}
          onClose={() => setSuggestionToDelete(null)}
          title="Eliminar Sugestão"
          description="Esta operação remove permanentemente a sugestão selecionada."
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900">
              Tem a certeza de que deseja eliminar a sugestão <strong>{suggestionToDelete.subject}</strong>?
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSuggestionToDelete(null)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteSuggestion(suggestionToDelete.id);
                  setSuggestionToDelete(null);
                }}
                className="px-4 py-1.5 font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-xs cursor-pointer"
              >
                Sim, Eliminar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
