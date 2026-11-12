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
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { Member, MemberCategory, MemberStatus, DeletionRequest } from '../../types';
import { formatDateAO, generateManualNumber } from '../../utils/date';
import { Modal } from '../common/Modal';
import { EmptyState } from '../common/EmptyState';
import { isMemberNumberUnique, findPotentialDuplicateMember } from '../../services/storageService';
import { MemberDigitalCardModal } from '../common/MemberDigitalCardModal';
import { processProfilePhoto } from '../../utils/fileUpload';

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
  } = useClub();

  const isAdmin = currentUser.role === 'admin_tecnico' || can('audit', 'ADMIN');
  const isSecretary = currentUser.role === 'secretario';
  const isDirector = currentUser.role === 'diretor';
  const isDirectorOrSecretary = isDirector || isSecretary || isAdmin;
  const canEdit = can('members', 'EDIT') || isSecretary || isAdmin || isDirector;
  const canEditCategory = isAdmin || isSecretary || isDirector;

  // Visualização e Navegação
  const [activeView, setActiveView] = useState<'members' | 'authorizations'>('members');
  const [authFilter, setAuthFilter] = useState<'todos' | 'pendente' | 'aprovado' | 'rejeitado' | 'executado'>('todos');

  // Filtros e Pesquisa
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [statusFilter, setStatusFilter] = useState<string>('ativo');

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
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [rejectingReq, setRejectingReq] = useState<DeletionRequest | null>(null);
  const [rejectJustification, setRejectJustification] = useState('');
  const [isBatchRenewalOpen, setIsBatchRenewalOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
      bloodType: m.bloodType || 'O+',
      allergiesOrMedicalNotes: m.allergiesOrMedicalNotes || '',
      investitureDate: m.investitureDate || '',
    });
    setEditError(null);
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
      investitureDate: (editFormData.category === 'embaixador' || editFormData.category === 'lider')
        ? (editFormData.investitureDate.trim() || undefined)
        : undefined,
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

  // Estados do Formulário de Registo
  const [formData, setFormData] = useState({
    manualNumber: '',
    fullName: '',
    birthDate: '',
    gender: 'M' as 'M' | 'F',
    identityCardNumber: '',
    phone: '',
    email: '',
    address: '',
    category: 'embaixador' as MemberCategory,
    unitOrTeam: 'Unidade Águias',
    guardianName: '',
    guardianPhone: '',
    emergencyName: '',
    emergencyRelationship: '',
    emergencyPhone: '',
    bloodType: 'O+',
    allergiesOrMedicalNotes: '',
    investitureDate: '',
    joinedDate: new Date().toISOString().split('T')[0],
  });

  const handleRegBirthDateChange = (dateVal: string) => {
    const autoNumber = generateManualNumber(formData.identityCardNumber, dateVal);
    setFormData((prev) => ({
      ...prev,
      birthDate: dateVal,
      manualNumber: autoNumber,
    }));
  };

  const handleRegBIChange = (biVal: string) => {
    const autoNumber = generateManualNumber(biVal, formData.birthDate);
    setFormData((prev) => ({
      ...prev,
      identityCardNumber: biVal,
      manualNumber: autoNumber,
    }));
  };

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      return matchSearch && matchCategory && matchStatus;
    });
  }, [state.members, searchQuery, categoryFilter, statusFilter]);

  const pendingAuthCount = useMemo(() => {
    return (state.deletionRequests || []).filter((r) => r.status === 'pendente').length;
  }, [state.deletionRequests]);

  const filteredAuthRequests = useMemo(() => {
    const list = state.deletionRequests || [];
    if (authFilter === 'todos') return list;
    return list.filter((r) => r.status === authFilter);
  }, [state.deletionRequests, authFilter]);

  // Submissão do Registo com Validação Dupla
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validação de Campos Obrigatórios
    if (!formData.manualNumber.trim()) {
      setFormError('O Número de Membro manual é obrigatório (ex: 2026/015).');
      return;
    }
    if (!formData.fullName.trim() || formData.fullName.trim().length < 3) {
      setFormError('O Nome Completo institucional é obrigatório.');
      return;
    }
    if (!formData.birthDate) {
      setFormError('A Data de Nascimento é obrigatória.');
      return;
    }
    if (!formData.identityCardNumber.trim()) {
      setFormError('O Número do Bilhete de Identidade (B.I.) angolano é obrigatório.');
      return;
    }
    if (!formData.phone.trim()) {
      setFormError('O Contacto telefónico principal é obrigatório.');
      return;
    }

    // Validação Prévia de Unicidade
    if (!isMemberNumberUnique(formData.manualNumber, state.members)) {
      setFormError(`O número de membro "${formData.manualNumber}" já existe no cadastro.`);
      return;
    }

    const duplicate = findPotentialDuplicateMember(
      formData.identityCardNumber,
      formData.fullName,
      formData.birthDate,
      state.members
    );
    if (duplicate) {
      setFormError(
        `Detetado potencial duplicado: Já existe o membro "${duplicate.fullName}" com o mesmo B.I. ou data de nascimento.`
      );
      return;
    }

    setIsSubmitting(true);

    const result = addMember({
      manualNumber: formData.manualNumber.trim(),
      fullName: formData.fullName.trim(),
      birthDate: formData.birthDate,
      gender: formData.gender,
      identityCardNumber: formData.identityCardNumber.trim().toUpperCase(),
      phone: formData.phone.trim(),
      email: formData.email.trim() || undefined,
      address: formData.address.trim() || 'Luanda, Angola',
      category: formData.category,
      unitOrTeam: formData.unitOrTeam,
      guardianName: formData.guardianName.trim() || undefined,
      guardianPhone: formData.guardianPhone.trim() || undefined,
      guardianValidated: Boolean(formData.guardianName.trim()),
      emergencyContact: {
        name: formData.emergencyName.trim() || formData.guardianName.trim() || formData.fullName.trim(),
        relationship: formData.emergencyRelationship.trim() || (formData.guardianName.trim() ? 'Encarregado de Educação' : 'Familiar'),
        phone: formData.emergencyPhone.trim() || formData.guardianPhone.trim() || formData.phone.trim(),
        phoneVerified: false,
      },
      bloodType: formData.bloodType,
      allergiesOrMedicalNotes: formData.allergiesOrMedicalNotes.trim() || undefined,
      investitureDate: (formData.category === 'embaixador' || formData.category === 'lider')
        ? (formData.investitureDate.trim() || undefined)
        : undefined,
      joinedDate: formData.joinedDate,
      annualRenewalYear: state.settings.currentYear,
      status: 'ativo',
    });

    setIsSubmitting(false);

    if (result.success) {
      setIsRegisterOpen(false);
      // Reset formulário
      setFormData({
        manualNumber: '',
        fullName: '',
        birthDate: '',
        gender: 'M',
        identityCardNumber: '',
        phone: '',
        email: '',
        address: '',
        category: 'aspirante',
        unitOrTeam: '',
        guardianName: '',
        guardianPhone: '',
        emergencyName: '',
        emergencyRelationship: '',
        emergencyPhone: '',
        bloodType: 'O+',
        allergiesOrMedicalNotes: '',
        investitureDate: '',
        joinedDate: new Date().toISOString().split('T')[0],
      });
    } else {
      setFormError(result.error || 'Erro ao registar membro.');
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
    const res = executeApprovedMemberOperation(reqId);
    if (res.success) {
      showFeedback('success', 'Operação autorizada executada com sucesso.');
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
                setFormError(null);
                setIsRegisterOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Novo Membro (Secretaria)</span>
            </button>
          )}

          {isDirectorOrSecretary && (
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

      {/* Navegação entre Fichas de Membros e Autorizações da Direção */}
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
                <option value="arquivado">Arquivados (Histórico)</option>
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
                <table className="w-full min-w-[750px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Identificador</th>
                      <th className="py-3 px-4">Nome Completo</th>
                      <th className="py-3 px-4">Categoria / Unidade</th>
                      <th className="py-3 px-4">B.I. (Angola)</th>
                      <th className="py-3 px-4">Renovação</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredMembers.map((member) => (
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
                          <div className="text-[11px] text-slate-500 font-medium mt-1">{member.unitOrTeam || 'Sem Equipa'}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                          {member.identityCardNumber}
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
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            member.status === 'ativo'
                              ? 'text-emerald-700'
                              : 'text-slate-500'
                          }`}>
                            {member.status === 'ativo' ? 'Ativo' : 'Arquivado'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => setSelectedMember(member)}
                              className="p-1.5 text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded transition-colors"
                              title="Consultar Perfil Completo"
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
                            {canEdit && (
                              <button
                                onClick={() => handleOpenEdit(member)}
                                className="p-1.5 text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded transition-colors"
                                title="Editar Ficha de Membro"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {can('members', 'ARCHIVE') && member.status === 'ativo' && (
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
                            {(can('members', 'ADMIN') || isDirectorOrSecretary) && (
                              <button
                                onClick={() => {
                                  setMemberToDelete(member);
                                  setDeleteReason('');
                                }}
                                className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-slate-100 rounded transition-colors"
                                title="Solicitar Eliminação à Direção"
                              >
                                <Trash2 className="w-4 h-4" />
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
                        ? can('members', 'APPROVE') && isDirectorOrSecretary
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
                            <div className="text-[10px] text-slate-500 capitalize">{(req.requestedByRole || 'Membro').replace('_', ' ')}</div>
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
                                {(isTargetDelete ? can('members', 'ADMIN') : can('members', 'ARCHIVE')) ? (
                                  <button
                                    type="button"
                                    onClick={() => handleExecuteRequest(req.id)}
                                    className="px-3 py-1.5 text-[11px] font-bold bg-blue-900 hover:bg-blue-800 text-white rounded shadow-xs flex items-center gap-1.5 transition-colors"
                                    title="Efetivar a operação autorizada no sistema"
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

      {/* MODAL 1: Formulário Completo de Registo (Secretaria) */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Registo Institucional de Membro"
        description="Preencha os dados institucionais oficiais. O registo de membro é independente da conta de acesso."
        maxWidth="3xl"
      >
        <form onSubmit={handleRegisterSubmit} className="space-y-6">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* Secção 1: Identificação */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-1">
              1. Identificação Pessoal
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-semibold">
                    Nº de Matrícula <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-blue-900 font-mono font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    Automático: EBX-XXXMMAA
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="Gerado automático (EBX-XXXMMAA)"
                  value={formData.manualNumber}
                  onChange={(e) => setFormData({ ...formData, manualNumber: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded font-mono font-bold bg-slate-50 text-blue-900 focus:ring-1 focus:ring-blue-900"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nome completo de registo civil"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Data de Nascimento <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => handleRegBirthDateChange(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Sexo <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'M' | 'F' })}
                  className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                >
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  B.I. (Angola) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="007849312LA041"
                  value={formData.identityCardNumber}
                  onChange={(e) => handleRegBIChange(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded font-mono uppercase focus:ring-1 focus:ring-blue-900"
                  required
                />
              </div>
            </div>
          </div>

          {/* Secção 2: Contactos e Localização */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-1">
              2. Contactos e Residência
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Telefone Principal <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="+244 9XX XXX XXX"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">E-mail (Opcional)</label>
                <input
                  type="email"
                  placeholder="exemplo@dominio.ao"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Município / Bairro</label>
                <input
                  type="text"
                  placeholder="Ex: Talatona, Benfica"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                />
              </div>
            </div>
          </div>

          {/* Secção 3: Informação do Clube */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-1">
              3. Enquadramento Institucional
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Categoria</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as MemberCategory })}
                  className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900 bg-white"
                >
                  <option value="embaixador">Embaixador</option>
                  <option value="lider">Líder</option>
                  <option value="aspirante">Aspirante</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Equipa / Unidade</label>
                <select
                  value={formData.unitOrTeam}
                  onChange={(e) => setFormData({ ...formData, unitOrTeam: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900 bg-white"
                >
                  <option value="">Sem Equipa</option>
                  {state.settings.units.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name} ({u.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Data de Admissão</label>
                <input
                  type="date"
                  value={formData.joinedDate}
                  onChange={(e) => setFormData({ ...formData, joinedDate: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                />
              </div>

              {(formData.category === 'embaixador' || formData.category === 'lider') && (
                <div className="sm:col-span-3 bg-amber-50/70 p-3 rounded-lg border border-amber-200">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-amber-900 font-bold">
                      Data Oficial de Investidura ({formData.category === 'lider' ? 'Líder' : 'Embaixador'})
                    </label>
                    <span className="text-[10px] text-amber-800 font-medium">Exibida no Cartão Digital</span>
                  </div>
                  <input
                    type="date"
                    value={formData.investitureDate}
                    onChange={(e) => setFormData({ ...formData, investitureDate: e.target.value })}
                    className="w-full p-2 border border-amber-300 rounded focus:ring-1 focus:ring-amber-500 bg-white text-xs font-semibold"
                  />
                  <p className="text-[10px] text-amber-700 mt-1">
                    Indique a data da cerimónia oficial em que o membro/líder foi investido com o lenço/insígnia oficial.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Secção 4: Encarregado de Educação e Emergência */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-100 pb-1">
              4. Encarregado de Educação e Emergência (Acesso Restrito)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nome do Encarregado</label>
                <input
                  type="text"
                  placeholder="Nome do Pai/Mãe/Tutor"
                  value={formData.guardianName}
                  onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Telefone do Encarregado</label>
                <input
                  type="tel"
                  placeholder="+244 9XX XXX XXX"
                  value={formData.guardianPhone}
                  onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Grupo Sanguíneo</label>
                <select
                  value={formData.bloodType}
                  onChange={(e) => setFormData({ ...formData, bloodType: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                >
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
                  placeholder="Ex: Alergia a picadas de insetos ou asma ligeira"
                  value={formData.allergiesOrMedicalNotes}
                  onChange={(e) => setFormData({ ...formData, allergiesOrMedicalNotes: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsRegisterOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'A registar...' : 'Concluir Registo Oficial'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Perfil Completo do Membro (Com Restrições por Papel) */}
      {selectedMember && (
        <Modal
          isOpen={Boolean(selectedMember) && !isArchiveOpen}
          onClose={() => setSelectedMember(null)}
          title={`Ficha Institucional: ${selectedMember.fullName}`}
          description={`Identificador Interno: ${selectedMember.id} · Matrícula: ${selectedMember.manualNumber}`}
          maxWidth="2xl"
        >
          <div className="space-y-6 text-xs text-slate-800">
            {/* Banner do Cartão Digital com Foto */}
            <div className="flex items-center justify-between bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-slate-800 p-3 rounded-xl text-blue-900 dark:text-blue-200 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border-2 border-amber-400/80 overflow-hidden shrink-0 flex items-center justify-center shadow-xs">
                  {selectedMember.photoUrl ? (
                    <img src={selectedMember.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-blue-900 dark:text-amber-400 shrink-0" />
                    <span>Credencial & Cartão Digital de Membro</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    Matrícula: {selectedMember.manualNumber} · Validação por QR Code
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCardMember(selectedMember)}
                className="px-3.5 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
              >
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span>Ver / Gerir Cartão & Foto</span>
              </button>
            </div>

            {/* Bloco Geral */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500">Categoria:</span>
                <p className="font-bold text-slate-900 capitalize">{selectedMember.category}</p>
              </div>
              <div>
                <span className="text-slate-500">Unidade:</span>
                <p className="font-semibold text-slate-900">{selectedMember.unitOrTeam || '-'}</p>
              </div>
              <div>
                <span className="text-slate-500">Data de Nascimento:</span>
                <p className="font-semibold text-slate-900">{formatDateAO(selectedMember.birthDate)}</p>
              </div>
              <div>
                <span className="text-slate-500">B.I. (Angola):</span>
                <p className="font-mono font-bold text-slate-900">{selectedMember.identityCardNumber}</p>
              </div>
              <div>
                <span className="text-slate-500">Telefone:</span>
                <p className="font-semibold text-slate-900">{selectedMember.phone}</p>
              </div>
              <div>
                <span className="text-slate-500">Ano de Renovação:</span>
                <p className="font-bold text-blue-900">{selectedMember.annualRenewalYear}</p>
              </div>
              {(selectedMember.category === 'embaixador' || selectedMember.category === 'lider') && (
                <div>
                  <span className="text-slate-500">Data de Investidura:</span>
                  <p className="font-bold text-amber-700">
                    {selectedMember.investitureDate ? formatDateAO(selectedMember.investitureDate) : 'Homologada / Sem data'}
                  </p>
                </div>
              )}
            </div>

            {/* Informações Protegidas (Menores e Encarregados) */}
            <div className="border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-slate-700 font-bold">
                <Lock className="w-3.5 h-3.5 text-blue-900" />
                <span>Dados do Encarregado e Controlo de Menor</span>
              </div>

              {can('members', 'VIEW') ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500">Encarregado de Educação:</span>
                    <p className="font-semibold">{selectedMember.guardianName || 'Não especificado'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Telefone do Encarregado:</span>
                    <p className="font-semibold">{selectedMember.guardianPhone || 'Não especificado'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Grupo Sanguíneo:</span>
                    <p className="font-semibold">{selectedMember.bloodType || 'Não testado'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Observações Médicas:</span>
                    <p className="font-semibold">{selectedMember.allergiesOrMedicalNotes || 'Nenhuma restrição'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 italic">
                  O acesso aos dados de encarregados e saúde está reservado à Secretaria e Direção.
                </p>
              )}
            </div>

            {/* Edição Rápida de Categoria e Equipa (Secretário e Administrador) */}
            {canEditCategory && (
              <div className="border border-blue-200 bg-blue-50/70 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-blue-950 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-blue-800" />
                      <span>Edição de Categoria e Equipa (Secretaria & Administração)</span>
                    </p>
                    <p className="text-[11px] text-blue-800 mt-0.5">
                      Altere a categoria institucional do membro ou transfira-o para qualquer equipa do clube:
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="font-semibold text-slate-700">Categoria:</span>
                  {(['embaixador', 'lider', 'aspirante'] as MemberCategory[]).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        const res = updateMemberCategory(selectedMember.id, cat);
                        if (res.success) {
                          setSelectedMember({ ...selectedMember, category: cat });
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        selectedMember.category === cat
                          ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {cat === 'embaixador' ? 'Embaixador' : cat === 'lider' ? 'Líder' : 'Aspirante'}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-blue-100">
                  <span className="font-semibold text-slate-700">Equipa / Unidade:</span>
                  <select
                    value={selectedMember.unitOrTeam || ''}
                    onChange={(e) => {
                      const newTeam = e.target.value || undefined;
                      const res = assignMemberToUnit(selectedMember.id, newTeam);
                      if (res.success) {
                        setSelectedMember({ ...selectedMember, unitOrTeam: newTeam });
                      }
                    }}
                    className="p-1.5 border border-slate-300 rounded-lg bg-white text-xs font-medium focus:ring-1 focus:ring-blue-900"
                  >
                    <option value="">Sem Equipa</option>
                    {state.settings.units.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name} ({u.category})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Conta de Acesso Associada */}
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-900">Conta de Acesso ao Sistema</p>
                <p className="text-slate-500 mt-0.5">
                  A conta de login é separada do perfil e só pode ser criada pelo Administrador Técnico.
                </p>
              </div>
              <span className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-300 rounded text-slate-700">
                {state.users.some((u) => u.linkedMemberId === selectedMember.id)
                  ? 'Conta Criada'
                  : 'Sem Conta de Login'}
              </span>
            </div>

            {/* Ações Disponíveis */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {can('members', 'ARCHIVE') && selectedMember.status === 'arquivado' && (
                <button
                  type="button"
                  onClick={() => {
                    const res = unarchiveMember(selectedMember.id);
                    if (res.success) {
                      setSelectedMember((prev) => prev ? { ...prev, status: 'ativo' } : null);
                      showFeedback('success', 'Membro desarquivado com sucesso.');
                    } else {
                      showFeedback('error', res.error || 'Erro ao desarquivar');
                    }
                  }}
                  className="px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Desarquivar Membro</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded"
              >
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}

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

      {/* MODAL: Solicitação Formal de Eliminação Definitiva à Direção (Req 2.1 & 2.4) */}
      {memberToDelete && (
        <Modal
          isOpen={Boolean(memberToDelete)}
          onClose={() => {
            setMemberToDelete(null);
            setDeleteReason('');
          }}
          title={`Solicitar Eliminação Definitiva: ${memberToDelete.fullName}`}
          description="Fluxo formal de autorização prévia da Direção com preservação de registos financeiros."
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-950 rounded-xl space-y-2">
              <p className="font-bold text-xs text-rose-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                <span>Salvaguarda e Autorização Prévia da Direção</span>
              </p>
              <p className="leading-relaxed">
                A solicitação criará um pedido de autorização pendente na Direção. A ficha do membro <strong>não é eliminada de imediato</strong>. Adicionalmente, todos os recibos emitidos, quotas liquidadas e documentos oficiais <strong>são preservados permanentemente</strong> para auditoria.
              </p>
              <div className="bg-white/80 p-2 rounded border border-rose-200 font-mono text-[11px] text-slate-800">
                Membro: <strong>{memberToDelete.fullName}</strong> · Nº: <strong>{memberToDelete.manualNumber}</strong> · ID: <strong>{memberToDelete.id}</strong>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Motivo fundamentado da eliminação <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Duplicação de registo comprovada por certidão / Cancelamento definitivo de admissão (mínimo 5 caracteres)"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setMemberToDelete(null);
                  setDeleteReason('');
                }}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteReason.trim().length < 5}
                onClick={handleDeleteSubmitRequest}
                className="px-4 py-1.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-40 rounded shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Submeter Pedido de Eliminação à Direção</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

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
              <span>{editingUnitId ? 'Editar Equipa Existente' : 'Criar Nova Equipa / Unidade'}</span>
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
                        {usr.name} ({usr.role})
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
                    (m) => m.status === 'ativo' && m.unitOrTeam !== unit.name
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
                            Líder da Equipa: <strong className="text-slate-800">{leaderUser ? `${leaderUser.name} (${leaderUser.role})` : 'Nenhum líder vinculado'}</strong>
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
                  <label className="block text-slate-700 font-semibold mb-1">Equipa / Unidade</label>
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
                  <label className="block text-slate-700 font-semibold mb-1">Grupo Sanguíneo</label>
                  <select
                    value={editFormData.bloodType}
                    onChange={(e) => setEditFormData({ ...editFormData, bloodType: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded"
                  >
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

      {/* MODAL: Cartão Digital Oficial com QR Code */}
      <MemberDigitalCardModal
        member={cardMember}
        onClose={() => setCardMember(null)}
      />
    </div>
  );
};
