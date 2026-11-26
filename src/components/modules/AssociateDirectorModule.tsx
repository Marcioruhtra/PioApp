import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  Briefcase,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  Download,
  Edit2,
  FileText,
  GraduationCap,
  Layers,
  ListChecks,
  Plus,
  Printer,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import {
  AssociateDirectivePriority,
  AssociateDirectiveStatus,
  MemberCategory,
  MemberTrainingProgress,
  ModuleName,
} from '../../types';
import { formatDateAO } from '../../utils/date';
import { Modal } from '../common/Modal';
import { ROLE_LABELS } from '../../services/permissionService';
import { getMemberTeamLabel, isDirectionMember } from '../../services/accountSyncService';
import {
  calculateTeamAttendanceStats,
} from '../../utils/activityUtils';
import {
  buildCatalogProgressSummaries,
  buildInstructorWorkloadSummaries,
  computeTrainingProgressPct,
  getMembersWithoutTraining,
  getModuleMedalStudySessions,
  getTrainingStagnationDays,
  isTrainingProgressStalled,
  resolveCatalogRequirementsForProgress,
  TRAINING_STALLED_DAYS_THRESHOLD,
} from '../../utils/associateTrainingUtils';

interface AssociateDirectorModuleProps {
  onNavigate?: (module: ModuleName) => void;
}

type AssociateTab = 'visao' | 'equipas' | 'formacao' | 'supervisao';
type TeamSortField = 'overall' | 'members' | 'training' | 'participation' | 'evaluation';

const DIRECTIVE_STATUS_LABELS: Record<AssociateDirectiveStatus, string> = {
  pendente: 'Pendente',
  em_curso: 'Em Curso',
  concluido: 'Concluída',
  validado: 'Validada',
};

const CATEGORY_LABELS: Record<MemberCategory | 'mista', string> = {
  embaixador: 'Embaixadores',
  lider: 'Liderança',
  aspirante: 'Aspirantes',
  mista: 'Mista',
};

export const AssociateDirectorModule: React.FC<AssociateDirectorModuleProps> = ({ onNavigate }) => {
  const {
    state,
    currentUser,
    can,
    addUnit,
    updateUnit,
    deleteUnit,
    assignMemberToUnit,
    createAssociateDirective,
    updateAssociateDirectiveStatus,
    deleteAssociateDirective,
    saveTeamEvaluation,
    deleteTeamEvaluation,
    createCircular,
    sendMessage,
    updateTrainingProgress,
    batchEnrollTrainingProgress,
    assignTrainingInstructor,
    approveFinalTraining,
    revokeTrainingApproval,
  } = useClub();

  const canViewModule = can('associate_director', 'VIEW');
  const canCreate = can('associate_director', 'CREATE');
  const canEdit = can('associate_director', 'EDIT');
  const canApprove = can('associate_director', 'APPROVE');
  const canExport = can('associate_director', 'EXPORT');
  const canPrint = can('associate_director', 'PRINT');

  const canCreateTraining = can('training', 'CREATE') || canEdit;
  const canEditTraining = can('training', 'EDIT') || canEdit;
  const canApproveInvestiture =
    can('training', 'APPROVE') ||
    canApprove ||
    currentUser.role === 'diretor' ||
    currentUser.role === 'admin_tecnico' ||
    currentUser.role === 'instrutor';
  const canExportTraining = can('training', 'EXPORT') || canExport;

  const [activeTab, setActiveTab] = useState<AssociateTab>('visao');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filtros e ordenação da Visão Executiva
  const [sortField, setSortField] = useState<TeamSortField>('overall');
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Estados de Gestão de Equipas
  const [selectedUnitId, setSelectedUnitId] = useState<string>(state.settings.units[0]?.id || '');
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [unitForm, setUnitForm] = useState({
    name: '',
    category: 'mista' as MemberCategory | 'mista',
    leaderUserId: '',
  });
  const [unassignedSearch, setUnassignedSearch] = useState('');
  const [unassignedCategoryFilter, setUnassignedCategoryFilter] = useState<'todas' | MemberCategory>('todas');
  const [assignTargetByMemberId, setAssignTargetByMemberId] = useState<Record<string, string>>({});
  const [teamRosterSearch, setTeamRosterSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'unit' | 'directive' | 'evaluation';
    id: string;
    title: string;
    description: string;
  } | null>(null);

  // Estados de Supervisão Formativa (Módulos e Medalhas)
  const [trainingSubView, setTrainingSubView] = useState<'acompanhamento' | 'catalogo' | 'instrutores'>('acompanhamento');
  const [trainingTeamFilter, setTrainingTeamFilter] = useState<string>('todas');
  const [trainingTypeFilter, setTrainingTypeFilter] = useState<'todos' | 'classe' | 'especialidade'>('todos');
  const [trainingTargetFilter, setTrainingTargetFilter] = useState<string>('todos');
  const [trainingInstructorFilter, setTrainingInstructorFilter] = useState<string>('todos');
  const [trainingReadinessFilter, setTrainingReadinessFilter] = useState<
    'todos' | 'prontos' | 'aprovados' | 'em_curso' | 'estagnados'
  >('todos');
  const [trainingSearch, setTrainingSearch] = useState('');
  const [inspectedProgressId, setInspectedProgressId] = useState<string | null>(null);
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [batchEnrollModalOpen, setBatchEnrollModalOpen] = useState(false);
  const [batchEnrollForm, setBatchEnrollForm] = useState({
    type: 'classe' as 'classe' | 'especialidade',
    targetId: state.classes[0]?.id || '',
    scope: 'unit' as 'unit' | 'category' | 'sem_formacao' | 'manual',
    unitName: state.settings.units[0]?.name || '',
    category: 'embaixador' as MemberCategory,
    selectedMemberIds: [] as string[],
    instructorUserId: '',
  });

  // Estados de Diretivas & Avaliações
  const [directiveModalOpen, setDirectiveModalOpen] = useState(false);
  const [directiveForm, setDirectiveForm] = useState({
    title: '',
    description: '',
    targetUnitName: 'Todas',
    assignedLeaderName: '',
    priority: 'alta' as AssociateDirectivePriority,
    dueDate: new Date().toISOString().split('T')[0],
    checklistNotes: '',
    publishCircular: false,
  });
  const [directiveStatusFilter, setDirectiveStatusFilter] = useState<'todas' | AssociateDirectiveStatus>('todas');

  const [evaluationModalOpen, setEvaluationModalOpen] = useState(false);
  const [evaluationForm, setEvaluationForm] = useState({
    unitId: state.settings.units[0]?.id || '',
    periodLabel: `Ciclo ${new Date().getFullYear()}`,
    disciplineScore: 85,
    teamworkScore: 85,
    punctualityScore: 85,
    trainingCommitmentScore: 85,
    observations: '',
  });

  // Envio rápido de comunicado para equipa ou líderes
  const [quickMessageModalOpen, setQuickMessageModalOpen] = useState(false);
  const [quickMessageForm, setQuickMessageForm] = useState({
    recipientType: 'unit' as 'unit' | 'category' | 'all',
    recipientId: '',
    subject: '',
    content: '',
  });

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    window.setTimeout(() => setFeedback(null), 5000);
  };

  const activeMembers = useMemo(
    () => state.members.filter((m) => m.status === 'ativo'),
    [state.members]
  );

  const membersWithoutTeam = useMemo(
    () => activeMembers.filter((m) => !m.unitOrTeam?.trim() && !isDirectionMember(m, state.users)),
    [activeMembers, state.users]
  );

  const evaluations = state.teamEvaluations || [];
  const directives = state.associateDirectives || [];

  // Cálculo completo por equipa (sem dados financeiros e sem lista nominal de presenças)
  const teamMetrics = useMemo(() => {
    const list = state.settings.units.map((unit) => {
      const teamMembers = activeMembers.filter((m) => m.unitOrTeam === unit.name);
      const teamMemberIds = new Set(teamMembers.map((m) => m.id));
      const leaderUser = state.users.find((u) => u.id === unit.leaderUserId);

      const teamTraining = state.trainingProgress.filter((tp) => teamMemberIds.has(tp.memberId));
      const avgTrainingPct =
        teamTraining.length > 0
          ? Math.round(
              teamTraining.reduce((sum, tp) => {
                const totalReq = tp.totalRequirements || 1;
                return sum + Math.min(100, Math.round((tp.completedRequirements.length / totalReq) * 100));
              }, 0) / teamTraining.length
            )
          : 0;
      const investedCount = teamTraining.filter((tp) => tp.finalAuthorizedApproval).length;
      const readyForInvestitureCount = teamTraining.filter(
        (tp) =>
          !tp.finalAuthorizedApproval &&
          (tp.totalRequirements || 0) > 0 &&
          tp.completedRequirements.length >= tp.totalRequirements
      ).length;

      // Indicador percentual agregado de participação em reuniões/atividades da equipa (considera apenas atividades com lista de presenças registada)
      const { totalSlots, participationPct: aggregateParticipationPct } =
        calculateTeamAttendanceStats(teamMemberIds, state.activities);

      const unitEvals = evaluations.filter((ev) => ev.unitId === unit.id || ev.unitName === unit.name);
      const latestEval = unitEvals[0];
      const evaluationPct = latestEval ? latestEval.overallScore : null;

      const unitDirectives = directives.filter(
        (d) => d.targetUnitName === unit.name || d.targetUnitName === 'Todas'
      );
      const openDirectivesCount = unitDirectives.filter(
        (d) => d.status === 'pendente' || d.status === 'em_curso'
      ).length;

      // Índice combinado (formação + participação agregada + avaliação se existir)
      const components: number[] = [];
      if (teamTraining.length > 0) components.push(avgTrainingPct);
      if (totalSlots > 0) components.push(aggregateParticipationPct);
      if (evaluationPct !== null) components.push(evaluationPct);
      const overallPct =
        components.length > 0
          ? Math.round(components.reduce((acc, v) => acc + v, 0) / components.length)
          : 0;

      return {
        unit,
        leaderUser,
        leaderName: leaderUser?.name || 'Sem líder vinculado',
        teamMembers,
        memberCount: teamMembers.length,
        avgTrainingPct,
        investedCount,
        readyForInvestitureCount,
        aggregateParticipationPct,
        evaluationPct,
        latestEval,
        openDirectivesCount,
        overallPct,
      };
    });

    return [...list].sort((a, b) => {
      if (sortField === 'members') return b.memberCount - a.memberCount;
      if (sortField === 'training') return b.avgTrainingPct - a.avgTrainingPct;
      if (sortField === 'participation') return b.aggregateParticipationPct - a.aggregateParticipationPct;
      if (sortField === 'evaluation') return (b.evaluationPct ?? -1) - (a.evaluationPct ?? -1);
      return b.overallPct - a.overallPct;
    });
  }, [state.settings.units, state.users, state.trainingProgress, state.activities, activeMembers, evaluations, directives, sortField]);

  // Métricas globais do Gabinete
  const allocatedPct =
    activeMembers.length > 0
      ? Math.round(((activeMembers.length - membersWithoutTeam.length) / activeMembers.length) * 100)
      : 0;

  const globalAvgTrainingPct = useMemo(() => {
    if (state.trainingProgress.length === 0) return 0;
    return Math.round(
      state.trainingProgress.reduce((sum, tp) => {
        const totalReq = tp.totalRequirements || 1;
        return sum + Math.min(100, Math.round((tp.completedRequirements.length / totalReq) * 100));
      }, 0) / state.trainingProgress.length
    );
  }, [state.trainingProgress]);

  const openDirectivesCount = directives.filter(
    (d) => d.status === 'pendente' || d.status === 'em_curso'
  ).length;

  const unitsWithoutLeader = state.settings.units.filter((u) => !u.leaderUserId);
  const candidatesReadyForInvestiture = useMemo(() => {
    return state.trainingProgress
      .map((tp) => {
        const member = activeMembers.find((m) => m.id === tp.memberId);
        if (!member) return null;
        const pct = tp.totalRequirements > 0
          ? Math.min(100, Math.round((tp.completedRequirements.length / tp.totalRequirements) * 100))
          : 0;
        return {
          progress: tp,
          member,
          pct,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [state.trainingProgress, activeMembers]);

  const pendingInvestituresCount = candidatesReadyForInvestiture.filter(
    (c) => !c.progress.finalAuthorizedApproval && c.pct >= 100
  ).length;
  const approvedInvestituresCount = candidatesReadyForInvestiture.filter(
    (c) => c.progress.finalAuthorizedApproval
  ).length;
  const stalledTrainingCount = useMemo(
    () => candidatesReadyForInvestiture.filter((c) => isTrainingProgressStalled(c.progress)).length,
    [candidatesReadyForInvestiture]
  );

  const membersWithoutTraining = useMemo(
    () => getMembersWithoutTraining(state.members, state.trainingProgress, state.users),
    [state.members, state.trainingProgress, state.users]
  );

  const catalogSummaries = useMemo(
    () => buildCatalogProgressSummaries(state.classes, state.specialties, state.trainingProgress, activeMembers),
    [state.classes, state.specialties, state.trainingProgress, activeMembers]
  );

  const instructorWorkloads = useMemo(
    () => buildInstructorWorkloadSummaries(state.users, state.trainingProgress, activeMembers),
    [state.users, state.trainingProgress, activeMembers]
  );

  const studySessions = useMemo(
    () => getModuleMedalStudySessions(state.activities),
    [state.activities]
  );

  const trainingInstructors = useMemo(() => {
    return state.users
      .filter((u) => u.active && u.role !== 'membro')
      .slice()
      .sort((a, b) => {
        const aPref = a.role === 'instrutor' || a.role === 'diretor_associado' ? 0 : 1;
        const bPref = b.role === 'instrutor' || b.role === 'diretor_associado' ? 0 : 1;
        if (aPref !== bPref) return aPref - bPref;
        return a.name.localeCompare(b.name);
      });
  }, [state.users]);

  // Equipa selecionada no separador de Gestão de Equipas
  const activeSelectedUnit = useMemo(() => {
    return (
      teamMetrics.find((tm) => tm.unit.id === selectedUnitId) ||
      teamMetrics[0] ||
      null
    );
  }, [teamMetrics, selectedUnitId]);

  const filteredUnassignedMembers = useMemo(() => {
    const q = unassignedSearch.trim().toLowerCase();
    return membersWithoutTeam.filter((m) => {
      if (unassignedCategoryFilter !== 'todas' && m.category !== unassignedCategoryFilter) return false;
      if (!q) return true;
      return (
        m.fullName.toLowerCase().includes(q) ||
        String(m.manualNumber || '').toLowerCase().includes(q)
      );
    });
  }, [membersWithoutTeam, unassignedSearch, unassignedCategoryFilter]);

  const filteredTeamRoster = useMemo(() => {
    if (!activeSelectedUnit) return [];
    const q = teamRosterSearch.trim().toLowerCase();
    return activeSelectedUnit.teamMembers.filter((m) => {
      if (!q) return true;
      return (
        m.fullName.toLowerCase().includes(q) ||
        String(m.manualNumber || '').toLowerCase().includes(q)
      );
    });
  }, [activeSelectedUnit, teamRosterSearch]);

  const eligibleLeaders = useMemo(() => {
    return state.users.filter((u) => u.active && u.role !== 'membro' && u.role !== 'admin_tecnico');
  }, [state.users]);

  if (!canViewModule) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
        <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Acesso Restrito ao Gabinete do Diretor-associado</h2>
        <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
          Este módulo é exclusivo do Diretor-associado. Outros cargos apenas podem visualizá-lo mediante autorização expressa concedida pelo Administrador Técnico na Grelha de Permissões.
        </p>
      </div>
    );
  }

  // Exportação CSV do ranking executivo de equipas
  const handleExportExecutiveCsv = () => {
    if (!canExport) {
      showFeedback('error', 'Sem permissão na grelha para exportar relatórios deste módulo.');
      return;
    }

    let csv = '\uFEFFEquipa;Categoria;Lider;Efetivo;Progresso_Formacao_%;Participacao_Agregada_%;Ultima_Avaliacao_%;Indice_Global_%;Diretivas_Abertas\n';
    teamMetrics.forEach((tm) => {
      csv += `"${tm.unit.name}";"${CATEGORY_LABELS[tm.unit.category]}";"${tm.leaderName}";${tm.memberCount};${tm.avgTrainingPct};${tm.aggregateParticipationPct};${tm.evaluationPct !== null ? tm.evaluationPct : 'N/A'};${tm.overallPct};${tm.openDirectivesCount}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Supervisao_Diretor_Associado_${state.settings.currentYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showFeedback('success', 'Mapa executivo de supervisão das equipas exportado em CSV.');
  };

  // Handlers CRUD de Equipas
  const openCreateUnitModal = () => {
    setEditingUnitId(null);
    setUnitForm({ name: '', category: 'mista', leaderUserId: '' });
    setUnitModalOpen(true);
  };

  const openEditUnitModal = (unitId: string) => {
    const unit = state.settings.units.find((u) => u.id === unitId);
    if (!unit) return;
    setEditingUnitId(unit.id);
    setUnitForm({
      name: unit.name,
      category: unit.category,
      leaderUserId: unit.leaderUserId || '',
    });
    setUnitModalOpen(true);
  };

  const handleSaveUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitForm.name.trim()) {
      showFeedback('error', 'Informe o nome da equipa ou unidade.');
      return;
    }
    const res = editingUnitId
      ? updateUnit(editingUnitId, unitForm.name, unitForm.category, unitForm.leaderUserId || undefined)
      : addUnit(unitForm.name, unitForm.category, unitForm.leaderUserId || undefined);

    if (res.success) {
      setUnitModalOpen(false);
      showFeedback('success', editingUnitId ? 'Equipa atualizada com sucesso.' : 'Nova equipa registada e sincronizada.');
    } else {
      showFeedback('error', res.error || 'Erro ao guardar equipa.');
    }
  };

  const requestDeleteUnit = (unitId: string, unitName: string, memberCount: number) => {
    setConfirmDelete({
      type: 'unit',
      id: unitId,
      title: `Remover equipa "${unitName}"?`,
      description:
        memberCount > 0
          ? `Esta equipa possui ${memberCount} membro(s) ativo(s). Ao confirmar, todos serão movidos automaticamente para a fila "Sem Equipa".`
          : 'A equipa selecionada será removida permanentemente do registo de unidades do clube.',
    });
  };

  const handleConfirmDeleteAction = () => {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;
    setConfirmDelete(null);

    if (type === 'unit') {
      const unitObj = state.settings.units.find((u) => u.id === id);
      const res = deleteUnit(id);
      if (res.success) {
        if (selectedUnitId === id) setSelectedUnitId('');
        showFeedback(
          'success',
          `Equipa "${unitObj?.name || ''}" removida. Os membros associados passaram para a fila Sem Equipa.`
        );
      } else {
        showFeedback('error', res.error || 'Erro ao remover equipa.');
      }
      return;
    }

    if (type === 'directive') {
      const res = deleteAssociateDirective(id);
      if (res.success) showFeedback('success', 'Diretiva removida do histórico.');
      else showFeedback('error', res.error || 'Erro ao remover diretiva.');
      return;
    }

    if (type === 'evaluation') {
      const res = deleteTeamEvaluation(id);
      if (res.success) showFeedback('success', 'Avaliação removida.');
      else showFeedback('error', res.error || 'Erro ao remover avaliação.');
    }
  };

  const handleAssignMember = (memberId: string, unitName?: string) => {
    const res = assignMemberToUnit(memberId, unitName);
    if (res.success) {
      setAssignTargetByMemberId((prev) => {
        if (!(memberId in prev)) return prev;
        const next = { ...prev };
        delete next[memberId];
        return next;
      });
      showFeedback(
        'success',
        unitName ? `Membro alocado à equipa "${unitName}".` : 'Membro desvinculado da equipa.'
      );
    } else {
      showFeedback('error', res.error || 'Erro ao alocar membro.');
    }
  };

  // Handler Diretiva Operacional
  const handleSaveDirective = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createAssociateDirective({
      title: directiveForm.title,
      description: directiveForm.description,
      targetUnitName: directiveForm.targetUnitName,
      assignedLeaderName: directiveForm.assignedLeaderName,
      priority: directiveForm.priority,
      dueDate: directiveForm.dueDate,
      checklistNotes: directiveForm.checklistNotes,
    });
    if (!res.success) {
      showFeedback('error', res.error || 'Erro ao emitir diretiva.');
      return;
    }

    if (directiveForm.publishCircular && can('requests', 'CREATE')) {
      createCircular({
        title: `[Diretiva · ${directiveForm.targetUnitName}] ${directiveForm.title.trim()}`,
        content: `${directiveForm.description.trim()}\nPrazo: ${formatDateAO(directiveForm.dueDate)}`,
        targetRoles: ['diretor', 'diretor_associado', 'secretario', 'instrutor', 'membro'],
        priority: directiveForm.priority === 'urgente' ? 'urgente' : directiveForm.priority === 'alta' ? 'alta' : 'normal',
      });
    }

    setDirectiveModalOpen(false);
    setDirectiveForm({
      title: '',
      description: '',
      targetUnitName: 'Todas',
      assignedLeaderName: '',
      priority: 'alta',
      dueDate: new Date().toISOString().split('T')[0],
      checklistNotes: '',
      publishCircular: false,
    });
    showFeedback('success', 'Diretiva operacional emitida e sincronizada na nuvem.');
  };

  // Handler Avaliação de Equipa
  const handleSaveEvaluation = (e: React.FormEvent) => {
    e.preventDefault();
    const unit = state.settings.units.find((u) => u.id === evaluationForm.unitId);
    if (!unit) {
      showFeedback('error', 'Selecione uma equipa válida para registar a avaliação.');
      return;
    }
    const res = saveTeamEvaluation({
      unitId: unit.id,
      unitName: unit.name,
      periodLabel: evaluationForm.periodLabel,
      disciplineScore: evaluationForm.disciplineScore,
      teamworkScore: evaluationForm.teamworkScore,
      punctualityScore: evaluationForm.punctualityScore,
      trainingCommitmentScore: evaluationForm.trainingCommitmentScore,
      observations: evaluationForm.observations,
    });
    if (res.success) {
      setEvaluationModalOpen(false);
      showFeedback('success', `Avaliação da equipa "${unit.name}" registada (${res.evaluation?.overallScore}%).`);
    } else {
      showFeedback('error', res.error || 'Erro ao guardar avaliação.');
    }
  };

  // Handler Mensagem Rápida de Coordenação
  const handleSendQuickMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickMessageForm.subject.trim() || !quickMessageForm.content.trim()) {
      showFeedback('error', 'Preencha o assunto e o conteúdo da mensagem.');
      return;
    }
    if (quickMessageForm.recipientType !== 'all' && !quickMessageForm.recipientId) {
      showFeedback('error', 'Selecione o destinatário da coordenação.');
      return;
    }
    const res = sendMessage({
      senderId: currentUser.id,
      senderName: currentUser.name,
      recipientType: quickMessageForm.recipientType,
      recipientId: quickMessageForm.recipientType === 'all' ? 'all' : quickMessageForm.recipientId,
      subject: quickMessageForm.subject.trim(),
      content: quickMessageForm.content.trim(),
    });
    if (res.success) {
      setQuickMessageModalOpen(false);
      setQuickMessageForm({ recipientType: 'unit', recipientId: '', subject: '', content: '' });
      showFeedback('success', 'Comunicado de coordenação enviado para a equipa selecionada.');
    } else {
      showFeedback('error', res.error || 'Erro ao enviar comunicado.');
    }
  };

  const filteredTraining = candidatesReadyForInvestiture.filter((item) => {
    if (trainingTeamFilter !== 'todas' && (item.member.unitOrTeam || '') !== trainingTeamFilter) return false;
    if (trainingTypeFilter !== 'todos' && item.progress.type !== trainingTypeFilter) return false;
    if (trainingTargetFilter !== 'todos') {
      const [fType, fId] = trainingTargetFilter.split('::');
      if (item.progress.type !== fType || (item.progress.targetId !== fId && item.progress.targetTitle !== fId)) {
        return false;
      }
    }
    if (
      trainingInstructorFilter !== 'todos' &&
      item.progress.instructorUserId !== trainingInstructorFilter &&
      item.progress.instructorName !== trainingInstructorFilter
    ) {
      return false;
    }
    if (trainingReadinessFilter === 'prontos' && !(item.pct >= 100 && !item.progress.finalAuthorizedApproval)) return false;
    if (trainingReadinessFilter === 'aprovados' && !item.progress.finalAuthorizedApproval) return false;
    if (trainingReadinessFilter === 'em_curso' && (item.pct >= 100 || item.progress.finalAuthorizedApproval)) return false;
    if (trainingReadinessFilter === 'estagnados' && !isTrainingProgressStalled(item.progress)) return false;
    const q = trainingSearch.trim().toLowerCase();
    if (q) {
      const matchesName = item.member.fullName.toLowerCase().includes(q);
      const matchesNum = String(item.member.manualNumber || '').toLowerCase().includes(q);
      const matchesTitle = item.progress.targetTitle.toLowerCase().includes(q);
      if (!matchesName && !matchesNum && !matchesTitle) return false;
    }
    return true;
  });

  const inspectedItem = useMemo(() => {
    if (!inspectedProgressId) return null;
    return candidatesReadyForInvestiture.find((c) => c.progress.id === inspectedProgressId) || null;
  }, [inspectedProgressId, candidatesReadyForInvestiture]);

  const openBatchEnrollModal = (preset?: {
    type?: 'classe' | 'especialidade';
    targetId?: string;
    scope?: 'unit' | 'category' | 'sem_formacao' | 'manual';
    memberIds?: string[];
  }) => {
    const nextType = preset?.type || (state.classes.length > 0 ? 'classe' : 'especialidade');
    const defaultTarget =
      preset?.targetId ||
      (nextType === 'classe' ? state.classes[0]?.id || '' : state.specialties[0]?.id || '');
    const defaultInstructor =
      trainingInstructors.find((u) => u.role === 'instrutor')?.id ||
      trainingInstructors[0]?.id ||
      currentUser.id;
    setBatchEnrollForm({
      type: nextType,
      targetId: defaultTarget,
      scope: preset?.scope || (membersWithoutTraining.length > 0 ? 'sem_formacao' : 'unit'),
      unitName: state.settings.units[0]?.name || '',
      category: 'embaixador',
      selectedMemberIds: preset?.memberIds || [],
      instructorUserId: defaultInstructor,
    });
    setBatchEnrollModalOpen(true);
  };

  const batchEnrollTargetMembers = useMemo(() => {
    if (batchEnrollForm.scope === 'unit') {
      return activeMembers.filter((m) => m.unitOrTeam === batchEnrollForm.unitName);
    }
    if (batchEnrollForm.scope === 'category') {
      return activeMembers.filter((m) => m.category === batchEnrollForm.category);
    }
    if (batchEnrollForm.scope === 'sem_formacao') {
      return membersWithoutTraining;
    }
    const idSet = new Set(batchEnrollForm.selectedMemberIds);
    return activeMembers.filter((m) => idSet.has(m.id));
  }, [batchEnrollForm, activeMembers, membersWithoutTraining]);

  const handleBatchEnrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchEnrollForm.targetId) {
      showFeedback('error', 'Selecione um Módulo ou Medalha do catálogo.');
      return;
    }

    let targetTitle = '';
    let totalReqs = 6;
    if (batchEnrollForm.type === 'classe') {
      const cls = state.classes.find((c) => c.id === batchEnrollForm.targetId);
      if (!cls) {
        showFeedback('error', 'Módulo selecionado não encontrado.');
        return;
      }
      targetTitle = cls.title;
      totalReqs = cls.requirements?.length || cls.requirementsCount || 8;
    } else {
      const esp = state.specialties.find((s) => s.id === batchEnrollForm.targetId);
      if (!esp) {
        showFeedback('error', 'Medalha selecionada não encontrada.');
        return;
      }
      targetTitle = esp.title;
      totalReqs = esp.requirements?.length || esp.requirementsCount || 6;
    }

    const chosenInstr = state.users.find((u) => u.id === batchEnrollForm.instructorUserId);
    const res = batchEnrollTrainingProgress({
      memberIds: batchEnrollTargetMembers.map((m) => m.id),
      type: batchEnrollForm.type,
      targetId: batchEnrollForm.targetId,
      targetTitle,
      totalRequirements: totalReqs,
      instructorUserId: chosenInstr?.id || currentUser.id,
      instructorName: chosenInstr?.name || currentUser.name,
    });

    if (res.success) {
      setBatchEnrollModalOpen(false);
      showFeedback(
        'success',
        `Inscrição em lote concluída para "${targetTitle}": ${res.createdCount} membro(s) inscrito(s)${
          res.skippedCount ? ` (${res.skippedCount} já matriculado(s))` : ''
        }.`
      );
    } else {
      showFeedback('error', res.error || 'Não foi possível concluir a inscrição em lote.');
    }
  };

  const handleExportTrainingReadinessCsv = () => {
    if (!canExportTraining) {
      showFeedback('error', 'Sem permissão na grelha para exportar mapas de Módulos e Medalhas.');
      return;
    }
    let csv = '\uFEFFNumero;Membro;Categoria;Equipa;Tipo;Modulo_ou_Medalha;Instrutor;Concluidos;Total;Progresso_%;Dias_Sem_Atualizacao;Situacao\n';
    filteredTraining.forEach(({ progress, member, pct }) => {
      const tipoLabel = progress.type === 'classe' ? 'Módulo' : 'Medalha';
      const sit = progress.finalAuthorizedApproval
        ? 'Investidura Aprovada'
        : pct >= 100
        ? 'Pronto p/ Validação'
        : isTrainingProgressStalled(progress)
        ? 'Estagnado'
        : 'Em Formação';
      const dias = getTrainingStagnationDays(progress);
      csv += `"${member.manualNumber}";"${member.fullName}";"${CATEGORY_LABELS[member.category]}";"${getMemberTeamLabel(member, state.users)}";"${tipoLabel}";"${progress.targetTitle}";"${progress.instructorName}";${progress.completedRequirements.length};${progress.totalRequirements};${pct};${dias};"${sit}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Supervisao_Modulos_Medalhas_${state.settings.currentYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showFeedback('success', 'Mapa de prontidão e progresso de Módulos e Medalhas exportado em CSV.');
  };

  const handleToggleInspectedRequirement = (progress: MemberTrainingProgress, reqNumber: number) => {
    if (!canEditTraining) {
      showFeedback('error', 'Sem permissão na grelha para atualizar requisitos de formação.');
      return;
    }
    const exists = progress.completedRequirements.includes(reqNumber);
    const nextReqs = exists
      ? progress.completedRequirements.filter((n) => n !== reqNumber)
      : [...progress.completedRequirements, reqNumber].sort((a, b) => a - b);
    const res = updateTrainingProgress(progress.id, nextReqs, inspectionNotes.trim() || undefined);
    if (!res.success) {
      showFeedback('error', res.error || 'Erro ao atualizar requisito.');
    }
  };

  const filteredDirectives = directives.filter((d) =>
    directiveStatusFilter === 'todas' ? true : d.status === directiveStatusFilter
  );

  const tabs: { id: AssociateTab; label: string; count?: number }[] = [
    { id: 'visao', label: 'Visão Executiva' },
    { id: 'equipas', label: 'Equipas & Alocação', count: state.settings.units.length },
    { id: 'formacao', label: 'Supervisão Formativa', count: pendingInvestituresCount },
    { id: 'supervisao', label: 'Diretivas & Avaliações', count: openDirectivesCount },
  ];

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {/* Cabeçalho Institucional do Módulo */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Direção Associada</span>
            <span aria-hidden="true">/</span>
            <span>{ROLE_LABELS[currentUser.role]?.label}</span>
            <span aria-hidden="true">·</span>
            <span>Ano {state.settings.currentYear}</span>
          </div>
          <div className="flex items-center gap-2.5 mt-1">
            <Briefcase className="w-5 h-5 text-blue-900 shrink-0" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
              Gabinete do Diretor-associado
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
            Supervisão especializada de Módulos e Medalhas, coordenação de instrutores e equipas, sessões de estudo e prontidão de investidura, com total separação da tesouraria e das listas nominais de presença.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {can('messaging', 'CREATE') && (
            <button
              onClick={() => {
                setQuickMessageForm({
                  recipientType: 'unit',
                  recipientId: state.settings.units[0]?.name || '',
                  subject: '',
                  content: '',
                });
                setQuickMessageModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Comunicar Equipa</span>
            </button>
          )}
          {canExport && (
            <button
              onClick={handleExportExecutiveCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
          )}
          {canPrint && (
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Boletim</span>
            </button>
          )}
          {canCreate && (
            <button
              onClick={() => {
                setDirectiveForm((prev) => ({
                  ...prev,
                  targetUnitName: state.settings.units[0]?.name || 'Todas',
                }));
                setDirectiveModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Diretiva</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Operacional */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between print:hidden ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-bold px-2 py-0.5 hover:underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Navegação por Sub-abas do Gabinete */}
      <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 overflow-x-auto print:hidden">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span className="font-mono tabular-nums text-[11px] text-slate-500">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: VISÃO EXECUTIVA & RADAR OPERACIONAL                            */}
      {/* ===================================================================== */}
      {activeTab === 'visao' && (
        <div className="space-y-6">
          {/* Strip de 4 KPIs Executivos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold text-slate-600">Cobertura de Equipas</span>
                <Layers className="w-4 h-4 text-blue-900 shrink-0" />
              </div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums mt-2">{allocatedPct}%</div>
              <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 tabular-nums">
                <span>{state.settings.units.length} equipas</span>
                <span aria-hidden="true">·</span>
                <span>{membersWithoutTeam.length} sem alocação</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold text-slate-600">Módulos e Medalhas</span>
                <GraduationCap className="w-4 h-4 text-blue-900 shrink-0" />
              </div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums mt-2">{globalAvgTrainingPct}%</div>
              <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 tabular-nums flex-wrap">
                <span>{state.trainingProgress.length} planos</span>
                <span aria-hidden="true">·</span>
                <span>{pendingInvestituresCount} prontos</span>
                <span aria-hidden="true">·</span>
                <span>{membersWithoutTraining.length} sem formação</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold text-slate-600">Sessões de Estudo</span>
                <ClipboardCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              </div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums mt-2">{studySessions.upcoming.length}</div>
              <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 tabular-nums flex-wrap">
                <span>Módulos e Medalhas</span>
                <span aria-hidden="true">·</span>
                <span>{studySessions.completed.length} realizadas</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold text-slate-600">Diretivas & Avaliações</span>
                <Activity className="w-4 h-4 text-amber-700 shrink-0" />
              </div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums mt-2">{openDirectivesCount}</div>
              <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 tabular-nums">
                <span>{directives.length} diretivas emitidas</span>
                <span aria-hidden="true">·</span>
                <span>{evaluations.length} avaliações</span>
              </div>
            </div>
          </div>

          {/* Radar de Atenção Operacional + Matriz Comparativa das Equipas */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Radar de Ações Recomendadas */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Radar de Supervisão Imediata</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Pendências administrativas detetadas em tempo real</p>
                </div>
              </div>

              <div className="divide-y divide-slate-100 flex-1">
                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">Membros ativos sem equipa</p>
                    <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                      {membersWithoutTeam.length} de {activeMembers.length} aguardam alocação
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('equipas')}
                    className="px-2.5 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Alocar Agora
                  </button>
                </div>

                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">Equipas sem líder atribuído</p>
                    <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                      {unitsWithoutLeader.length} equipa(s) sem responsável designado
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('equipas')}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Gerir Líderes
                  </button>
                </div>

                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">Membros sem Módulo ou Medalha</p>
                    <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                      {membersWithoutTraining.length} membro(s) ativo(s) ainda sem plano formativo
                    </p>
                  </div>
                  {canCreateTraining ? (
                    <button
                      onClick={() => openBatchEnrollModal({ scope: 'sem_formacao' })}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Inscrever em Lote
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setTrainingSubView('instrutores');
                        setActiveTab('formacao');
                      }}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Consultar
                    </button>
                  )}
                </div>

                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">Formações estagnadas (+{TRAINING_STALLED_DAYS_THRESHOLD} dias)</p>
                    <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                      {stalledTrainingCount} plano(s) sem avanço recente de requisitos
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setTrainingSubView('acompanhamento');
                      setTrainingReadinessFilter('estagnados');
                      setActiveTab('formacao');
                    }}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Ver Atrasos
                  </button>
                </div>
              </div>

              {onNavigate && (
                <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500">Atalhos complementares:</span>
                  <div className="flex items-center gap-3">
                    {can('reports', 'VIEW') && (
                      <button
                        onClick={() => onNavigate('reports')}
                        className="font-semibold text-blue-900 hover:underline whitespace-nowrap cursor-pointer"
                      >
                        Relatórios Oficiais
                      </button>
                    )}
                    {can('training', 'VIEW') && (
                      <button
                        onClick={() => onNavigate('training')}
                        className="font-semibold text-blue-900 hover:underline whitespace-nowrap cursor-pointer"
                      >
                        Formação
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Ranking Comparativo de Desempenho das Equipas */}
            <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Ranking Comparativo de Desempenho das Equipas</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Consolidação de efetivo, progresso formativo, participação agregada e avaliação da direção
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as TeamSortField)}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                  >
                    <option value="overall">Ordenar: Índice Global</option>
                    <option value="members">Ordenar: Efetivo</option>
                    <option value="training">Ordenar: Formação (%)</option>
                    <option value="participation">Ordenar: Reuniões (%)</option>
                    <option value="evaluation">Ordenar: Avaliação</option>
                  </select>
                </div>
              </div>

              {teamMetrics.length === 0 ? (
                <div className="p-10 text-center space-y-3">
                  <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-600">
                    Nenhuma equipa configurada no sistema até ao momento.
                  </p>
                  {canEdit && (
                    <button
                      onClick={() => {
                        setActiveTab('equipas');
                        openCreateUnitModal();
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Criar Primeira Equipa</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-3 px-4">Equipa & Liderança</th>
                        <th className="py-3 px-3 text-right">Efetivo</th>
                        <th className="py-3 px-3 text-right">Formação</th>
                        <th className="py-3 px-3 text-right">Reuniões</th>
                        <th className="py-3 px-3 text-right">Avaliação</th>
                        <th className="py-3 px-4 text-right">Índice Global</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {teamMetrics.map((tm, index) => (
                        <tr
                          key={tm.unit.id}
                          onClick={() => {
                            setSelectedUnitId(tm.unit.id);
                            setActiveTab('equipas');
                          }}
                          className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">
                              <span className="font-mono tabular-nums text-slate-400 mr-2">
                                {String(index + 1).padStart(2, '0')}.
                              </span>
                              {tm.unit.name}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {CATEGORY_LABELS[tm.unit.category]} · Líder: {tm.leaderName}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-800">
                            {tm.memberCount}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                            {tm.avgTrainingPct}%
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                            {tm.aggregateParticipationPct}%
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                            {tm.evaluationPct !== null ? `${tm.evaluationPct}%` : '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`font-mono tabular-nums font-bold ${
                                tm.overallPct >= 80
                                  ? 'text-emerald-700'
                                  : tm.overallPct >= 50
                                  ? 'text-blue-900'
                                  : 'text-amber-700'
                              }`}
                            >
                              {tm.overallPct}%
                            </span>
                            <span className="text-[11px] text-slate-500 ml-1.5">
                              {tm.overallPct >= 80 ? 'Nominal' : tm.overallPct >= 50 ? 'Regular' : 'Atenção'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: GESTÃO AVANÇADA DE EQUIPAS & ALOCAÇÃO DE MEMBROS               */}
      {/* ===================================================================== */}
      {activeTab === 'equipas' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Coluna Esquerda: Lista de Equipas + CRUD */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Equipas / Unidades ({teamMetrics.length})</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Selecione uma equipa para gerir o efetivo</p>
                </div>
                {canEdit && (
                  <button
                    onClick={openCreateUnitModal}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nova Equipa</span>
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-100">
                {teamMetrics.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Nenhuma equipa registada ainda.
                  </div>
                ) : (
                  teamMetrics.map((tm) => {
                    const isSelected = activeSelectedUnit?.unit.id === tm.unit.id;
                    return (
                      <div
                        key={tm.unit.id}
                        onClick={() => setSelectedUnitId(tm.unit.id)}
                        className={`p-4 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold text-slate-900 truncate">{tm.unit.name}</h3>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                              {CATEGORY_LABELS[tm.unit.category]} · Líder: {tm.leaderName}
                            </p>
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => openEditUnitModal(tm.unit.id)}
                                title="Editar equipa e líder"
                                className="p-1.5 text-slate-500 hover:text-blue-900 rounded hover:bg-slate-100 cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => requestDeleteUnit(tm.unit.id, tm.unit.name, tm.memberCount)}
                                title="Remover equipa"
                                className="p-1.5 text-slate-400 hover:text-rose-700 rounded hover:bg-rose-50 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600 tabular-nums">
                          <span>{tm.memberCount} membro(s)</span>
                          <span>Formação {tm.avgTrainingPct}% · Índice {tm.overallPct}%</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Coluna Centro & Direita: Detalhes do Efetivo da Equipa Selecionada + Fila Sem Equipa */}
            <div className="xl:col-span-2 space-y-6">
              {/* Efetivo da Equipa Selecionada */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      {activeSelectedUnit
                        ? `Efetivo da Equipa: ${activeSelectedUnit.unit.name}`
                        : 'Selecione uma Equipa'}
                    </h2>
                    {activeSelectedUnit && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Líder: {activeSelectedUnit.leaderName} · {activeSelectedUnit.memberCount} membros ativos · {activeSelectedUnit.investedCount} investidura(s) aprovada(s)
                      </p>
                    )}
                  </div>

                  {activeSelectedUnit && (
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={teamRosterSearch}
                          onChange={(e) => setTeamRosterSearch(e.target.value)}
                          placeholder="Filtrar membro..."
                          className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                        />
                      </div>
                      {canCreate && (
                        <button
                          onClick={() => {
                            setEvaluationForm((prev) => ({
                              ...prev,
                              unitId: activeSelectedUnit.unit.id,
                            }));
                            setEvaluationModalOpen(true);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Avaliar Equipa
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {!activeSelectedUnit ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Crie ou selecione uma equipa à esquerda para visualizar e gerir os membros.
                  </div>
                ) : filteredTeamRoster.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Nenhum membro encontrado nesta equipa. Utilize o painel abaixo para alocar membros sem equipa.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="py-2.5 px-4">Nº Membro</th>
                          <th className="py-2.5 px-4">Nome Completo</th>
                          <th className="py-2.5 px-3">Categoria</th>
                          <th className="py-2.5 px-3">Contacto</th>
                          <th className="py-2.5 px-3 text-right">Formação</th>
                          {canEdit && <th className="py-2.5 px-4 text-right">Realocação</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredTeamRoster.map((mem) => {
                          const memTraining = state.trainingProgress.filter((tp) => tp.memberId === mem.id);
                          const memPct =
                            memTraining.length > 0
                              ? Math.round(
                                  memTraining.reduce(
                                    (sum, tp) =>
                                      sum + Math.min(100, Math.round((tp.completedRequirements.length / (tp.totalRequirements || 1)) * 100)),
                                    0
                                  ) / memTraining.length
                                )
                              : 0;

                          return (
                            <tr key={mem.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600">
                                {mem.manualNumber}
                              </td>
                              <td className="py-2.5 px-4 font-semibold text-slate-900">
                                {mem.fullName}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {CATEGORY_LABELS[mem.category]}
                              </td>
                              <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600">
                                {mem.phone}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-800">
                                {memTraining.length > 0 ? `${memPct}%` : 'Sem plano'}
                              </td>
                              {canEdit && (
                                <td className="py-2.5 px-4 text-right">
                                  <div className="inline-flex items-center gap-1.5">
                                    <select
                                      value={mem.unitOrTeam || ''}
                                      onChange={(e) => handleAssignMember(mem.id, e.target.value || undefined)}
                                      className="px-2 py-1 text-[11px] border border-slate-200 rounded bg-white text-slate-700"
                                      aria-label={`Mover ${mem.fullName} de equipa`}
                                    >
                                      <option value="">Sem Equipa</option>
                                      {state.settings.units.map((u) => (
                                        <option key={u.id} value={u.name}>
                                          {u.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Fila de Membros Sem Equipa para Alocação Rápida */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Membros Ativos Sem Equipa ({membersWithoutTeam.length})
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Aloque rapidamente membros disponíveis diretamente para uma equipa ativa
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={unassignedSearch}
                        onChange={(e) => setUnassignedSearch(e.target.value)}
                        placeholder="Nome ou Nº..."
                        className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                      />
                    </div>
                    <select
                      value={unassignedCategoryFilter}
                      onChange={(e) => setUnassignedCategoryFilter(e.target.value as 'todas' | MemberCategory)}
                      className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
                    >
                      <option value="todas">Todas categorias</option>
                      <option value="embaixador">Embaixadores</option>
                      <option value="lider">Liderança</option>
                      <option value="aspirante">Aspirantes</option>
                    </select>
                  </div>
                </div>

                {filteredUnassignedMembers.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    {membersWithoutTeam.length === 0
                      ? 'Todos os membros ativos estão devidamente alocados às suas equipas.'
                      : 'Nenhum membro sem equipa corresponde aos filtros aplicados.'}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredUnassignedMembers.map((m) => {
                      const selectedUnitTarget =
                        assignTargetByMemberId[m.id] ||
                        activeSelectedUnit?.unit.name ||
                        state.settings.units[0]?.name ||
                        '';

                      return (
                        <div key={m.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">{m.fullName}</p>
                            <p className="text-[11px] text-slate-500 tabular-nums">
                              Nº {m.manualNumber} · {CATEGORY_LABELS[m.category]} · Tel: {m.phone}
                            </p>
                          </div>

                          {canEdit && state.settings.units.length > 0 && (
                            <div className="flex items-center gap-2 shrink-0">
                              <select
                                value={selectedUnitTarget}
                                onChange={(e) => {
                                  const nextVal = e.target.value;
                                  setAssignTargetByMemberId((prev) => ({
                                    ...prev,
                                    [m.id]: nextVal,
                                  }));
                                }}
                                aria-label={`Equipa de destino para ${m.fullName}`}
                                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
                              >
                                {state.settings.units.map((u) => (
                                  <option key={u.id} value={u.name}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => {
                                  if (selectedUnitTarget) handleAssignMember(m.id, selectedUnitTarget);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Alocar</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: SUPERVISÃO ESPECIALIZADA DE MÓDULOS E MEDALHAS                 */}
      {/* ===================================================================== */}
      {activeTab === 'formacao' && (
        <div className="space-y-6">
          {/* Resumo + Sub-navegação + Ações do Centro de Módulos e Medalhas */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
              <button
                onClick={() => setTrainingSubView('acompanhamento')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  trainingSubView === 'acompanhamento'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Acompanhamento & Validação ({filteredTraining.length})
              </button>
              <button
                onClick={() => setTrainingSubView('catalogo')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  trainingSubView === 'catalogo'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Painel por Módulo & Medalha ({catalogSummaries.length})
              </button>
              <button
                onClick={() => setTrainingSubView('instrutores')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  trainingSubView === 'instrutores'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Instrutores & Sem Formação ({membersWithoutTraining.length})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs text-slate-600 tabular-nums mr-2 flex items-center gap-2">
                <span>{pendingInvestituresCount} prontos p/ validar</span>
                <span aria-hidden="true">·</span>
                <span>{approvedInvestituresCount} homologados</span>
                <span aria-hidden="true">·</span>
                <span>{stalledTrainingCount} estagnados</span>
              </div>

              {canExportTraining && (
                <button
                  onClick={handleExportTrainingReadinessCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar Mapa CSV</span>
                </button>
              )}

              {canCreateTraining && (
                <button
                  onClick={() => openBatchEnrollModal()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Inscrever em Lote</span>
                </button>
              )}
            </div>
          </div>

          {/* SUB-VISTA 1: ACOMPANHAMENTO INDIVIDUAL, REQUISITOS & HOMOLOGAÇÃO */}
          {trainingSubView === 'acompanhamento' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Supervisão de Módulos, Medalhas & Homologação de Investidura ({filteredTraining.length})
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Inspeção de requisitos, atribuição de instrutor e validação final de investidura pelo Diretor-associado
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={trainingSearch}
                      onChange={(e) => setTrainingSearch(e.target.value)}
                      placeholder="Pesquisar membro, Nº ou título..."
                      className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                    />
                  </div>

                  <select
                    value={trainingTeamFilter}
                    onChange={(e) => setTrainingTeamFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
                  >
                    <option value="todas">Todas as equipas</option>
                    {state.settings.units.map((u) => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </select>

                  <select
                    value={trainingTypeFilter}
                    onChange={(e) => {
                      setTrainingTypeFilter(e.target.value as any);
                      setTrainingTargetFilter('todos');
                    }}
                    className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
                  >
                    <option value="todos">Módulos & Medalhas</option>
                    <option value="classe">Apenas Módulos</option>
                    <option value="especialidade">Apenas Medalhas</option>
                  </select>

                  <select
                    value={trainingTargetFilter}
                    onChange={(e) => setTrainingTargetFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 max-w-[220px]"
                  >
                    <option value="todos">Todos Módulos / Medalhas</option>
                    {catalogSummaries
                      .filter((c) => trainingTypeFilter === 'todos' || c.type === trainingTypeFilter)
                      .map((c) => (
                        <option key={`${c.type}::${c.id}`} value={`${c.type}::${c.id}`}>
                          {c.type === 'classe' ? 'Módulo' : 'Medalha'}: {c.title}
                        </option>
                      ))}
                  </select>

                  <select
                    value={trainingInstructorFilter}
                    onChange={(e) => setTrainingInstructorFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
                  >
                    <option value="todos">Todos os instrutores</option>
                    {instructorWorkloads.map((ins) => (
                      <option key={ins.instructorUserId} value={ins.instructorUserId}>
                        {ins.instructorName}
                      </option>
                    ))}
                  </select>

                  <select
                    value={trainingReadinessFilter}
                    onChange={(e) => setTrainingReadinessFilter(e.target.value as any)}
                    className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
                  >
                    <option value="todos">Todos os estágios</option>
                    <option value="prontos">Prontos p/ Validação (100%)</option>
                    <option value="aprovados">Investidura Aprovada</option>
                    <option value="em_curso">Em Formação (&lt; 100%)</option>
                    <option value="estagnados">Estagnados (+{TRAINING_STALLED_DAYS_THRESHOLD} dias)</option>
                  </select>
                </div>
              </div>

              {filteredTraining.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500">
                  Nenhum registo formativo encontrado com os filtros selecionados.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-3 px-4">Membro</th>
                        <th className="py-3 px-3">Equipa</th>
                        <th className="py-3 px-3">Módulo / Medalha</th>
                        <th className="py-3 px-3">Instrutor Responsável</th>
                        <th className="py-3 px-3 text-right">Requisitos</th>
                        <th className="py-3 px-3 text-right">Situação</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTraining.map(({ progress, member, pct }) => {
                        const stalledDays = getTrainingStagnationDays(progress);
                        const isStalled = stalledDays >= TRAINING_STALLED_DAYS_THRESHOLD;
                        return (
                          <tr key={progress.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">{member.fullName}</div>
                              <div className="text-[11px] font-mono tabular-nums text-slate-500">
                                Nº {member.manualNumber} · {CATEGORY_LABELS[member.category]}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-700">
                              {getMemberTeamLabel(member, state.users)}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-900">{progress.targetTitle}</div>
                              <div className="text-[11px] text-slate-500">
                                {progress.type === 'classe' ? 'Módulo' : 'Medalha'}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              {canEditTraining && trainingInstructors.length > 0 ? (
                                <select
                                  value={
                                    trainingInstructors.some((u) => u.id === progress.instructorUserId)
                                      ? progress.instructorUserId
                                      : ''
                                  }
                                  onChange={(e) => {
                                    const chosen = trainingInstructors.find((u) => u.id === e.target.value);
                                    if (!chosen) return;
                                    const res = assignTrainingInstructor(progress.id, chosen.id, chosen.name);
                                    if (res.success) {
                                      showFeedback('success', `Instrutor de "${progress.targetTitle}" atualizado para ${chosen.name}.`);
                                    } else {
                                      showFeedback('error', res.error || 'Erro ao atribuir instrutor.');
                                    }
                                  }}
                                  aria-label={`Instrutor de ${member.fullName}`}
                                  className="px-2 py-1 text-[11px] border border-slate-200 rounded bg-white text-slate-700 max-w-[170px]"
                                >
                                  {!trainingInstructors.some((u) => u.id === progress.instructorUserId) && (
                                    <option value="">{progress.instructorName || 'Selecionar...'}</option>
                                  )}
                                  {trainingInstructors.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-slate-600">{progress.instructorName}</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-800">
                              <div>{progress.completedRequirements.length}/{progress.totalRequirements} ({pct}%)</div>
                              {isStalled && (
                                <div className="text-[10px] font-sans font-semibold text-amber-700">
                                  Parado há {stalledDays}d
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {progress.finalAuthorizedApproval ? (
                                <span className="text-xs font-semibold text-emerald-700">Investidura Aprovada</span>
                              ) : pct >= 100 ? (
                                <span className="text-xs font-semibold text-amber-700">Pronto p/ Validação</span>
                              ) : (
                                <span className="text-xs text-slate-500">Em Formação</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInspectionNotes(progress.observations || '');
                                    setInspectedProgressId(progress.id);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                                >
                                  <ListChecks className="w-3 h-3" />
                                  <span>Requisitos</span>
                                </button>
                                {canApproveInvestiture && !progress.finalAuthorizedApproval && pct >= 100 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const res = approveFinalTraining(progress.id);
                                      if (res.success) {
                                        showFeedback('success', `Investidura homologada para ${member.fullName} (${progress.targetTitle}).`);
                                      } else {
                                        showFeedback('error', res.error || 'Erro ao homologar investidura.');
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md cursor-pointer"
                                  >
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>Homologar</span>
                                  </button>
                                )}
                                {canApproveInvestiture && progress.finalAuthorizedApproval && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const res = revokeTrainingApproval(progress.id);
                                      if (res.success) {
                                        showFeedback('success', `Homologação reaberta para ${member.fullName} (${progress.targetTitle}).`);
                                      } else {
                                        showFeedback('error', res.error || 'Erro ao reabrir homologação.');
                                      }
                                    }}
                                    className="text-[11px] font-semibold text-slate-500 hover:text-rose-700 underline cursor-pointer px-1"
                                  >
                                    Reabrir
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
          )}

          {/* SUB-VISTA 2: COBERTURA E GARGALOS POR MÓDULO & MEDALHA */}
          {trainingSubView === 'catalogo' && (
            <div className="space-y-6">
              {(['classe', 'especialidade'] as const).map((groupType) => {
                const items = catalogSummaries.filter((c) => c.type === groupType);
                const heading = groupType === 'classe' ? 'Módulos Oficiais' : 'Medalhas / Especialidades';
                return (
                  <div key={groupType} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">
                          {heading} ({items.length})
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Cobertura de inscritos, progresso médio, pendências de validação e atrasos no catálogo
                        </p>
                      </div>
                    </div>

                    {items.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500">
                        Nenhum item ativo nesta categoria do catálogo.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                              <th className="py-2.5 px-4">Título</th>
                              <th className="py-2.5 px-3 text-right">Requisitos</th>
                              <th className="py-2.5 px-3 text-right">Inscritos</th>
                              <th className="py-2.5 px-3 text-right">Média %</th>
                              <th className="py-2.5 px-3 text-right">Estagnados</th>
                              <th className="py-2.5 px-3 text-right">Prontos</th>
                              <th className="py-2.5 px-3 text-right">Aprovados</th>
                              <th className="py-2.5 px-4 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {items.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50">
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-slate-900">{item.title}</div>
                                  <div className="text-[11px] text-slate-500">
                                    {item.instructorNames.length > 0
                                      ? `Instrutores: ${item.instructorNames.join(', ')}`
                                      : 'Sem instrutor atribuído ainda'}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">
                                  {item.requirementsCount}
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                                  {item.enrolledCount}
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                                  {item.avgPct}%
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums">
                                  <span className={item.stalledCount > 0 ? 'font-bold text-amber-700' : 'text-slate-500'}>
                                    {item.stalledCount}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums">
                                  <span className={item.readyForValidationCount > 0 ? 'font-bold text-blue-900' : 'text-slate-500'}>
                                    {item.readyForValidationCount}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-emerald-700">
                                  {item.approvedCount}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTrainingTypeFilter(item.type);
                                        setTrainingTargetFilter(`${item.type}::${item.id}`);
                                        setTrainingReadinessFilter('todos');
                                        setTrainingSubView('acompanhamento');
                                      }}
                                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                                    >
                                      Ver Inscritos
                                    </button>
                                    {canCreateTraining && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openBatchEnrollModal({
                                            type: item.type,
                                            targetId: item.id,
                                            scope: 'unit',
                                          })
                                        }
                                        className="px-2.5 py-1 text-[11px] font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer"
                                      >
                                        Inscrever Equipa
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
                );
              })}
            </div>
          )}

          {/* SUB-VISTA 3: COORDENAÇÃO DE INSTRUTORES & MEMBROS SEM FORMAÇÃO */}
          {trainingSubView === 'instrutores' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Carga & Desempenho de Instrutores */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-slate-200">
                  <h2 className="text-sm font-bold text-slate-900">
                    Coordenação de Instrutores ({instructorWorkloads.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Carga de planos por instrutor, prontidão de investidura e estagnações
                  </p>
                </div>

                {instructorWorkloads.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Nenhum instrutor registado ou com planos atribuídos.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {instructorWorkloads.map((ins) => (
                      <div key={ins.instructorUserId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-3.5 h-3.5 text-blue-900 shrink-0" />
                            <h3 className="text-xs font-bold text-slate-900 truncate">{ins.instructorName}</h3>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                            {ins.totalAssigned} plano(s) ({ins.modulesCount} módulos · {ins.medalsCount} medalhas) · Média {ins.avgPct}% · {ins.readyForValidationCount} pronto(s) · {ins.stalledCount} estagnado(s)
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setTrainingInstructorFilter(ins.instructorUserId);
                              setTrainingReadinessFilter('todos');
                              setTrainingSubView('acompanhamento');
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                          >
                            Ver Planos
                          </button>
                          {canCreate && (
                            <button
                              type="button"
                              onClick={() => {
                                setDirectiveForm((prev) => ({
                                  ...prev,
                                  title: `Acompanhamento de Módulos/Medalhas — ${ins.instructorName}`,
                                  assignedLeaderName: ins.instructorName,
                                  description: `Revisão de requisitos pendentes (${ins.stalledCount} estagnado(s)) e preparação de investidura.`,
                                }));
                                setDirectiveModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer"
                            >
                              Diretiva
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Membros Ativos Sem Nenhum Módulo ou Medalha */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Membros Ativos Sem Formação ({membersWithoutTraining.length})
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Membros ativos que ainda não iniciaram nenhum módulo nem medalha
                    </p>
                  </div>
                  {canCreateTraining && membersWithoutTraining.length > 0 && (
                    <button
                      type="button"
                      onClick={() => openBatchEnrollModal({ scope: 'sem_formacao' })}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Inscrever Todos
                    </button>
                  )}
                </div>

                {membersWithoutTraining.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Todos os membros ativos elegíveis possuem pelo menos um módulo ou medalha atribuído.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
                    {membersWithoutTraining.map((mem) => (
                      <div key={mem.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">{mem.fullName}</p>
                          <p className="text-[11px] text-slate-500 tabular-nums">
                            Nº {mem.manualNumber} · {CATEGORY_LABELS[mem.category]} · {getMemberTeamLabel(mem, state.users)}
                          </p>
                        </div>
                        {canCreateTraining && (
                          <button
                            type="button"
                            onClick={() =>
                              openBatchEnrollModal({
                                scope: 'manual',
                                memberIds: [mem.id],
                              })
                            }
                            className="px-2.5 py-1 text-[11px] font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Inscrever
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: DIRETIVAS OPERACIONAIS & AVALIAÇÕES DE EQUIPAS                 */}
      {/* ===================================================================== */}
      {activeTab === 'supervisao' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Bloco 1: Diretivas & Planos de Ação */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Diretivas & Planos de Ação ({filteredDirectives.length})</h2>
                <p className="text-xs text-slate-500 mt-0.5">Ordens operacionais e metas emitidas para equipas e liderança</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={directiveStatusFilter}
                  onChange={(e) => setDirectiveStatusFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
                >
                  <option value="todas">Todos estados</option>
                  <option value="pendente">Pendentes</option>
                  <option value="em_curso">Em Curso</option>
                  <option value="concluido">Concluídas</option>
                  <option value="validado">Validadas</option>
                </select>
                {canCreate && (
                  <button
                    onClick={() => setDirectiveModalOpen(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Emitir</span>
                  </button>
                )}
              </div>
            </div>

            {filteredDirectives.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-600">
                  Nenhuma diretiva operacional registada para os filtros selecionados.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredDirectives.map((dir) => (
                  <div key={dir.id} className="p-4 space-y-2 hover:bg-slate-50/70">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-slate-900">{dir.title}</h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Alvo: {dir.targetUnitName}
                          {dir.assignedLeaderName ? ` · Resp.: ${dir.assignedLeaderName}` : ''}
                          {' · '}Prazo: {formatDateAO(dir.dueDate)}
                          {' · '}Prioridade: {dir.priority}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {(canEdit || canApprove) ? (
                          <select
                            value={dir.status}
                            onChange={(e) => {
                              const nextStatus = e.target.value as AssociateDirectiveStatus;
                              const res = updateAssociateDirectiveStatus(dir.id, nextStatus);
                              if (res.success) {
                                showFeedback('success', `Diretiva atualizada para ${DIRECTIVE_STATUS_LABELS[nextStatus]}.`);
                              } else {
                                showFeedback('error', res.error || 'Erro ao atualizar diretiva.');
                              }
                            }}
                            className="px-2 py-1 text-[11px] font-semibold border border-slate-200 rounded bg-white text-slate-800"
                          >
                            <option value="pendente">Pendente</option>
                            <option value="em_curso">Em Curso</option>
                            <option value="concluido">Concluída</option>
                            {(canApprove || canEdit) && <option value="validado">Validada</option>}
                          </select>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-700">
                            {DIRECTIVE_STATUS_LABELS[dir.status]}
                          </span>
                        )}

                        {canEdit && (
                          <button
                            onClick={() =>
                              setConfirmDelete({
                                type: 'directive',
                                id: dir.id,
                                title: `Remover diretiva "${dir.title}"?`,
                                description:
                                  'Esta diretiva operacional será removida permanentemente do acompanhamento do Gabinete.',
                              })
                            }
                            title="Remover diretiva"
                            className="p-1 text-slate-400 hover:text-rose-700 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">{dir.description}</p>
                    {dir.checklistNotes && (
                      <p className="text-[11px] text-slate-500">Notas: {dir.checklistNotes}</p>
                    )}
                    <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                      <span>Emitida por {dir.createdByName} em {formatDateAO(dir.createdAt)}</span>
                      {dir.validatedByName && (
                        <span className="text-emerald-700 font-semibold">Validada por {dir.validatedByName}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bloco 2: Avaliações Periódicas de Desempenho das Equipas */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Avaliações de Desempenho das Equipas ({evaluations.length})</h2>
                <p className="text-xs text-slate-500 mt-0.5">Registo estruturado em 4 critérios (Disciplina, União, Pontualidade, Formação)</p>
              </div>
              {canCreate && state.settings.units.length > 0 && (
                <button
                  onClick={() => {
                    setEvaluationForm((prev) => ({
                      ...prev,
                      unitId: prev.unitId || state.settings.units[0]?.id || '',
                    }));
                    setEvaluationModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Nova Avaliação</span>
                </button>
              )}
            </div>

            {evaluations.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <TrendingUp className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-600">
                  Ainda não foram registadas avaliações periódicas de equipas.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {evaluations.map((ev) => (
                  <div key={ev.id} className="p-4 space-y-2.5 hover:bg-slate-50/70">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900">
                          {ev.unitName} · {ev.periodLabel}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Avaliado por {ev.evaluatedByName} em {formatDateAO(ev.evaluatedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-sm font-mono tabular-nums font-bold ${
                            ev.overallScore >= 80
                              ? 'text-emerald-700'
                              : ev.overallScore >= 60
                              ? 'text-blue-900'
                              : 'text-amber-700'
                          }`}
                        >
                          {ev.overallScore}%
                        </span>
                        {canEdit && (
                          <button
                            onClick={() =>
                              setConfirmDelete({
                                type: 'evaluation',
                                id: ev.id,
                                title: `Remover avaliação de "${ev.unitName}"?`,
                                description: `A avaliação referente a "${ev.periodLabel}" (${ev.overallScore}%) será eliminada permanentemente do histórico.`,
                              })
                            }
                            className="p-1 text-slate-400 hover:text-rose-700 rounded cursor-pointer"
                            title="Remover avaliação"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-[11px] tabular-nums">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                        <span className="text-slate-500 block">Disciplina</span>
                        <strong className="font-mono text-slate-900">{ev.disciplineScore}%</strong>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                        <span className="text-slate-500 block">União</span>
                        <strong className="font-mono text-slate-900">{ev.teamworkScore}%</strong>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                        <span className="text-slate-500 block">Pontualidade</span>
                        <strong className="font-mono text-slate-900">{ev.punctualityScore}%</strong>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                        <span className="text-slate-500 block">Formação</span>
                        <strong className="font-mono text-slate-900">{ev.trainingCommitmentScore}%</strong>
                      </div>
                    </div>

                    {ev.observations && (
                      <p className="text-xs text-slate-600 leading-relaxed">{ev.observations}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAIS DE OPERAÇÃO DO GABINETE                                        */}
      {/* ===================================================================== */}

      {/* Modal Criar/Editar Equipa */}
      <Modal
        isOpen={unitModalOpen}
        onClose={() => setUnitModalOpen(false)}
        title={editingUnitId ? 'Editar Equipa / Unidade' : 'Registar Nova Equipa / Unidade'}
        description="Configure o nome da equipa, categoria alvo e o líder responsável."
      >
        <form onSubmit={handleSaveUnit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nome da Equipa *</label>
            <input
              type="text"
              required
              value={unitForm.name}
              onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
              placeholder="Ex.: Unidade Águias, Patrulha Leões"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900/20"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Categoria *</label>
            <select
              value={unitForm.category}
              onChange={(e) => setUnitForm({ ...unitForm, category: e.target.value as MemberCategory | 'mista' })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="mista">Mista (Todas categorias)</option>
              <option value="embaixador">Embaixador</option>
              <option value="lider">Líder</option>
              <option value="aspirante">Aspirante</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Líder Responsável</label>
            <select
              value={unitForm.leaderUserId}
              onChange={(e) => setUnitForm({ ...unitForm, leaderUserId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="">Sem líder atribuído</option>
              {eligibleLeaders.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({ROLE_LABELS[u.role]?.label || u.role})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setUnitModalOpen(false)}
              className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg cursor-pointer"
            >
              {editingUnitId ? 'Guardar Alterações' : 'Criar Equipa'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Emitir Diretiva Operacional */}
      <Modal
        isOpen={directiveModalOpen}
        onClose={() => setDirectiveModalOpen(false)}
        title="Emitir Diretiva Operacional"
        description="Defina uma orientação ou meta operacional supervisionada pelo Gabinete do Diretor-associado."
      >
        <form onSubmit={handleSaveDirective} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Título da Diretiva *</label>
            <input
              type="text"
              required
              value={directiveForm.title}
              onChange={(e) => setDirectiveForm({ ...directiveForm, title: e.target.value })}
              placeholder="Ex.: Conclusão dos requisitos de Módulo até ao encerramento do trimestre"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Equipa Alvo *</label>
              <select
                value={directiveForm.targetUnitName}
                onChange={(e) => setDirectiveForm({ ...directiveForm, targetUnitName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="Todas">Todas as Equipas</option>
                {state.settings.units.map((u) => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Líder / Encarregado</label>
              <input
                type="text"
                value={directiveForm.assignedLeaderName}
                onChange={(e) => setDirectiveForm({ ...directiveForm, assignedLeaderName: e.target.value })}
                placeholder="Nome do líder responsável"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Prioridade</label>
              <select
                value={directiveForm.priority}
                onChange={(e) => setDirectiveForm({ ...directiveForm, priority: e.target.value as AssociateDirectivePriority })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Prazo de Cumprimento *</label>
              <input
                type="date"
                required
                value={directiveForm.dueDate}
                onChange={(e) => setDirectiveForm({ ...directiveForm, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Descrição & Metas *</label>
            <textarea
              required
              rows={3}
              value={directiveForm.description}
              onChange={(e) => setDirectiveForm({ ...directiveForm, description: e.target.value })}
              placeholder="Detalhe os entregáveis e critérios de acompanhamento..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Notas de Verificação (Opcional)</label>
            <input
              type="text"
              value={directiveForm.checklistNotes}
              onChange={(e) => setDirectiveForm({ ...directiveForm, checklistNotes: e.target.value })}
              placeholder="Critérios práticos de confirmação"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          {can('requests', 'CREATE') && (
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={directiveForm.publishCircular}
                onChange={(e) => setDirectiveForm({ ...directiveForm, publishCircular: e.target.checked })}
                className="w-3.5 h-3.5 text-blue-900 rounded"
              />
              <span>Publicar simultaneamente como Circular Oficial para a liderança e membros</span>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setDirectiveModalOpen(false)}
              className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg cursor-pointer"
            >
              Emitir Diretiva
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Registar Avaliação de Equipa */}
      <Modal
        isOpen={evaluationModalOpen}
        onClose={() => setEvaluationModalOpen(false)}
        title="Avaliação Periódica de Desempenho de Equipa"
        description="Registe a pontuação (0 a 100) nos quatro pilares operacionais de supervisão."
      >
        <form onSubmit={handleSaveEvaluation} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Equipa *</label>
              <select
                value={evaluationForm.unitId}
                onChange={(e) => setEvaluationForm({ ...evaluationForm, unitId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                {state.settings.units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Período de Referência *</label>
              <input
                type="text"
                required
                value={evaluationForm.periodLabel}
                onChange={(e) => setEvaluationForm({ ...evaluationForm, periodLabel: e.target.value })}
                placeholder="Ex.: 1º Trimestre 2026"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Disciplina & Ordem (0-100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={evaluationForm.disciplineScore}
                onChange={(e) => setEvaluationForm({ ...evaluationForm, disciplineScore: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Espírito de Equipa (0-100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={evaluationForm.teamworkScore}
                onChange={(e) => setEvaluationForm({ ...evaluationForm, teamworkScore: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pontualidade & Prazos (0-100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={evaluationForm.punctualityScore}
                onChange={(e) => setEvaluationForm({ ...evaluationForm, punctualityScore: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Compromisso Formativo (0-100)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={evaluationForm.trainingCommitmentScore}
                onChange={(e) => setEvaluationForm({ ...evaluationForm, trainingCommitmentScore: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between">
            <span className="font-semibold text-slate-700">Média Global Calculada</span>
            <span className="text-base font-mono tabular-nums font-bold text-blue-900">
              {Math.round(
                (evaluationForm.disciplineScore +
                  evaluationForm.teamworkScore +
                  evaluationForm.punctualityScore +
                  evaluationForm.trainingCommitmentScore) /
                  4
              )}%
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Observações da Direção Associada</label>
            <textarea
              rows={2}
              value={evaluationForm.observations}
              onChange={(e) => setEvaluationForm({ ...evaluationForm, observations: e.target.value })}
              placeholder="Pontos fortes e recomendações de melhoria para a equipa..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEvaluationModalOpen(false)}
              className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg cursor-pointer"
            >
              Guardar Avaliação
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Comunicação Direta com Equipa */}
      <Modal
        isOpen={quickMessageModalOpen}
        onClose={() => setQuickMessageModalOpen(false)}
        title="Enviar Comunicado de Coordenação"
        description="Envie instruções operacionais diretamente para uma equipa, categoria ou todo o clube."
      >
        <form onSubmit={handleSendQuickMessage} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tipo de Destinatário</label>
              <select
                value={quickMessageForm.recipientType}
                onChange={(e) =>
                  setQuickMessageForm({
                    ...quickMessageForm,
                    recipientType: e.target.value as 'unit' | 'category' | 'all',
                    recipientId: '',
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="unit">Equipa / Unidade</option>
                <option value="category">Categoria</option>
                <option value="all">Todo o Clube</option>
              </select>
            </div>

            {quickMessageForm.recipientType !== 'all' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Selecionar Destino *</label>
                <select
                  value={quickMessageForm.recipientId}
                  onChange={(e) => setQuickMessageForm({ ...quickMessageForm, recipientId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">Selecione...</option>
                  {quickMessageForm.recipientType === 'unit'
                    ? state.settings.units.map((u) => (
                        <option key={u.id} value={u.name}>{u.name}</option>
                      ))
                    : [
                        { id: 'embaixador', label: 'Embaixadores' },
                        { id: 'lider', label: 'Liderança' },
                        { id: 'aspirante', label: 'Aspirantes' },
                      ].map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Assunto *</label>
            <input
              type="text"
              required
              value={quickMessageForm.subject}
              onChange={(e) => setQuickMessageForm({ ...quickMessageForm, subject: e.target.value })}
              placeholder="Ex.: Alinhamento operacional para sábado"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Mensagem *</label>
            <textarea
              required
              rows={4}
              value={quickMessageForm.content}
              onChange={(e) => setQuickMessageForm({ ...quickMessageForm, content: e.target.value })}
              placeholder="Escreva a instrução ou aviso..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setQuickMessageModalOpen(false)}
              className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg cursor-pointer"
            >
              Enviar Comunicado
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Boletim Executivo de Impressão (A4) */}
      {isPrintModalOpen && (
        <div className="print-modal-wrapper fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="printable-document-modal bg-white w-full max-w-4xl rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
              <span className="text-sm font-bold text-slate-900">Pré-visualização do Boletim Executivo (A4)</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-lg cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6 print-document-body text-slate-900">
              <div className="border-b border-slate-300 pb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold">{state.settings.clubName}</h2>
                  <p className="text-xs text-slate-600">{state.settings.city} · {state.settings.country}</p>
                </div>
                <div className="text-right text-xs text-slate-600 tabular-nums">
                  <div className="font-bold text-slate-900">Boletim de Supervisão Executiva</div>
                  <div>Gabinete do Diretor-associado · Ano {state.settings.currentYear}</div>
                  <div>Emitido por {currentUser.name} em {formatDateAO(new Date().toISOString())}</div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 text-xs tabular-nums">
                <div className="border border-slate-200 rounded p-3">
                  <span className="text-slate-500 block">Cobertura Equipas</span>
                  <strong className="text-base">{allocatedPct}%</strong>
                </div>
                <div className="border border-slate-200 rounded p-3">
                  <span className="text-slate-500 block">Formação Média</span>
                  <strong className="text-base">{globalAvgTrainingPct}%</strong>
                </div>
                <div className="border border-slate-200 rounded p-3">
                  <span className="text-slate-500 block">Sessões de Estudo</span>
                  <strong className="text-base">{studySessions.upcoming.length}</strong>
                </div>
                <div className="border border-slate-200 rounded p-3">
                  <span className="text-slate-500 block">Diretivas Ativas</span>
                  <strong className="text-base">{openDirectivesCount}</strong>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Quadro Consolidado das Equipas
                </h3>
                <table className="w-full text-left text-xs border border-slate-200 border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="py-2 px-3">Equipa</th>
                      <th className="py-2 px-3">Líder</th>
                      <th className="py-2 px-3 text-right">Efetivo</th>
                      <th className="py-2 px-3 text-right">Formação</th>
                      <th className="py-2 px-3 text-right">Reuniões</th>
                      <th className="py-2 px-3 text-right">Avaliação</th>
                      <th className="py-2 px-3 text-right">Índice Global</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {teamMetrics.map((tm) => (
                      <tr key={tm.unit.id}>
                        <td className="py-2 px-3 font-semibold">{tm.unit.name}</td>
                        <td className="py-2 px-3">{tm.leaderName}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">{tm.memberCount}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">{tm.avgTrainingPct}%</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">{tm.aggregateParticipationPct}%</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {tm.evaluationPct !== null ? `${tm.evaluationPct}%` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-bold">{tm.overallPct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {directives.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Diretivas Operacionais em Acompanhamento
                  </h3>
                  <div className="space-y-1.5 text-xs">
                    {directives.slice(0, 8).map((d) => (
                      <div key={d.id} className="border border-slate-200 rounded p-2.5 flex justify-between gap-4">
                        <div>
                          <strong>{d.title}</strong> ({d.targetUnitName}) — {d.description}
                        </div>
                        <span className="font-semibold shrink-0">{DIRECTIVE_STATUS_LABELS[d.status]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Resumo de Módulos, Medalhas & Prontidão de Investidura
                </h3>
                <div className="grid grid-cols-4 gap-3 text-xs tabular-nums mb-3">
                  <div className="border border-slate-200 rounded p-2.5">
                    <span className="text-slate-500 block">Planos Ativos</span>
                    <strong>{candidatesReadyForInvestiture.length}</strong>
                  </div>
                  <div className="border border-slate-200 rounded p-2.5">
                    <span className="text-slate-500 block">Prontos p/ Validação</span>
                    <strong>{pendingInvestituresCount}</strong>
                  </div>
                  <div className="border border-slate-200 rounded p-2.5">
                    <span className="text-slate-500 block">Investiduras Aprovadas</span>
                    <strong>{approvedInvestituresCount}</strong>
                  </div>
                  <div className="border border-slate-200 rounded p-2.5">
                    <span className="text-slate-500 block">Membros Sem Formação</span>
                    <strong>{membersWithoutTraining.length}</strong>
                  </div>
                </div>
              </div>

              <div className="print-signature-section pt-8 grid grid-cols-2 gap-12 text-center text-xs">
                <div className="border-t border-slate-400 pt-2">
                  <div className="font-semibold">{currentUser.name}</div>
                  <div className="text-slate-500">{ROLE_LABELS[currentUser.role]?.label || currentUser.role}</div>
                </div>
                {(() => {
                  const directorUser = state.users.find((u) => u.role === 'diretor');
                  return (
                    <div className="border-t border-slate-400 pt-2">
                      <div className="font-semibold">{directorUser?.name || 'Diretor do Clube'}</div>
                      <div className="text-slate-500">Visto · {ROLE_LABELS.diretor.label}</div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Inspeção de Requisitos & Homologação de Módulo / Medalha */}
      <Modal
        isOpen={Boolean(inspectedItem)}
        onClose={() => setInspectedProgressId(null)}
        title={inspectedItem ? `Requisitos: ${inspectedItem.progress.targetTitle}` : 'Inspeção de Requisitos'}
        description={
          inspectedItem
            ? `${inspectedItem.member.fullName} (Nº ${inspectedItem.member.manualNumber}) · ${
                inspectedItem.progress.type === 'classe' ? 'Módulo' : 'Medalha'
              }`
            : ''
        }
        maxWidth="2xl"
      >
        {inspectedItem && (() => {
          const reqList = resolveCatalogRequirementsForProgress(
            inspectedItem.progress,
            state.classes,
            state.specialties
          );
          const effectivePct = computeTrainingProgressPct({
            completedRequirements: inspectedItem.progress.completedRequirements,
            totalRequirements: reqList.length,
          });
          return (
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-900">
                    Progresso: {inspectedItem.progress.completedRequirements.length}/{reqList.length} ({effectivePct}%)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Instrutor: {inspectedItem.progress.instructorName} · Atualizado em {formatDateAO(inspectedItem.progress.updatedAt)}
                  </div>
                </div>
                <div className="text-right">
                  {inspectedItem.progress.finalAuthorizedApproval ? (
                    <span className="text-xs font-bold text-emerald-700">Investidura Homologada</span>
                  ) : effectivePct >= 100 ? (
                    <span className="text-xs font-bold text-amber-700">Pronto para Homologação</span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-600">Em Formação</span>
                  )}
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {reqList.map((reqTitle, index) => {
                  const reqNumber = index + 1;
                  const checked = inspectedItem.progress.completedRequirements.includes(reqNumber);
                  return (
                    <label
                      key={reqNumber}
                      className={`p-3 flex items-start gap-2.5 ${
                        canEditTraining ? 'cursor-pointer hover:bg-slate-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canEditTraining || inspectedItem.progress.finalAuthorizedApproval}
                        onChange={() => handleToggleInspectedRequirement(inspectedItem.progress, reqNumber)}
                        className="mt-0.5 rounded text-blue-900"
                      />
                      <span className={checked ? 'text-slate-900 font-medium' : 'text-slate-600'}>
                        <strong className="font-mono tabular-nums mr-1.5">#{reqNumber}</strong>
                        {reqTitle}
                      </span>
                    </label>
                  );
                })}
              </div>

              {canEditTraining && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Notas de Supervisão do Diretor-associado (Opcional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inspectionNotes}
                      onChange={(e) => setInspectionNotes(e.target.value)}
                      placeholder="Observações sobre avaliação prática ou pendências..."
                      className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const res = updateTrainingProgress(
                          inspectedItem.progress.id,
                          inspectedItem.progress.completedRequirements,
                          inspectionNotes.trim()
                        );
                        if (res.success) {
                          showFeedback('success', 'Observações formativas guardadas.');
                        } else {
                          showFeedback('error', res.error || 'Erro ao guardar observações.');
                        }
                      }}
                      className="px-3 py-1.5 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      Guardar Nota
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInspectedProgressId(null)}
                  className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Fechar
                </button>

                {canApproveInvestiture && (
                  inspectedItem.progress.finalAuthorizedApproval ? (
                    <button
                      type="button"
                      onClick={() => {
                        const res = revokeTrainingApproval(inspectedItem.progress.id);
                        if (res.success) {
                          showFeedback('success', `Investidura reaberta para reavaliação (${inspectedItem.member.fullName}).`);
                        } else {
                          showFeedback('error', res.error || 'Erro ao reabrir investidura.');
                        }
                      }}
                      className="px-4 py-2 font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
                    >
                      Reabrir / Revogar Homologação
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const res = approveFinalTraining(inspectedItem.progress.id);
                        if (res.success) {
                          showFeedback('success', `Investidura homologada com sucesso para ${inspectedItem.member.fullName}!`);
                          setInspectedProgressId(null);
                        } else {
                          showFeedback('error', res.error || 'Erro ao homologar investidura.');
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Homologar Investidura</span>
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Modal Inscrição em Lote em Módulo ou Medalha */}
      <Modal
        isOpen={batchEnrollModalOpen}
        onClose={() => setBatchEnrollModalOpen(false)}
        title="Inscrever Membros em Módulo ou Medalha"
        description="Matricule toda uma equipa, categoria ou membros sem formação com atribuição direta de instrutor."
        maxWidth="lg"
      >
        <form onSubmit={handleBatchEnrollSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tipo *</label>
              <select
                value={batchEnrollForm.type}
                onChange={(e) => {
                  const nextType = e.target.value as 'classe' | 'especialidade';
                  const firstId =
                    nextType === 'classe' ? state.classes[0]?.id || '' : state.specialties[0]?.id || '';
                  setBatchEnrollForm((prev) => ({ ...prev, type: nextType, targetId: firstId }));
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="classe">Módulo</option>
                <option value="especialidade">Medalha</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {batchEnrollForm.type === 'classe' ? 'Selecionar Módulo *' : 'Selecionar Medalha *'}
              </label>
              <select
                value={batchEnrollForm.targetId}
                onChange={(e) => setBatchEnrollForm((prev) => ({ ...prev, targetId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                required
              >
                <option value="">Selecione...</option>
                {(batchEnrollForm.type === 'classe' ? state.classes : state.specialties).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Grupo Alvo *</label>
              <select
                value={batchEnrollForm.scope}
                onChange={(e) =>
                  setBatchEnrollForm((prev) => ({
                    ...prev,
                    scope: e.target.value as 'unit' | 'category' | 'sem_formacao' | 'manual',
                  }))
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="unit">Por Equipa / Unidade</option>
                <option value="category">Por Categoria</option>
                <option value="sem_formacao">Membros Sem Formação ({membersWithoutTraining.length})</option>
                <option value="manual">Seleção Manual de Membros</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Instrutor Responsável *</label>
              <select
                value={batchEnrollForm.instructorUserId}
                onChange={(e) =>
                  setBatchEnrollForm((prev) => ({ ...prev, instructorUserId: e.target.value }))
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                {trainingInstructors.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({ROLE_LABELS[u.role]?.label || u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {batchEnrollForm.scope === 'unit' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Equipa *</label>
              <select
                value={batchEnrollForm.unitName}
                onChange={(e) => setBatchEnrollForm((prev) => ({ ...prev, unitName: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                {state.settings.units.map((u) => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
              </select>
            </div>
          )}

          {batchEnrollForm.scope === 'category' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Categoria *</label>
              <select
                value={batchEnrollForm.category}
                onChange={(e) =>
                  setBatchEnrollForm((prev) => ({ ...prev, category: e.target.value as MemberCategory }))
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
              >
                <option value="embaixador">Embaixadores</option>
                <option value="lider">Liderança</option>
                <option value="aspirante">Aspirantes</option>
              </select>
            </div>
          )}

          {batchEnrollForm.scope === 'manual' && (
            <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
              {activeMembers.map((m) => {
                const checked = batchEnrollForm.selectedMemberIds.includes(m.id);
                return (
                  <label key={m.id} className="px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setBatchEnrollForm((prev) => ({
                          ...prev,
                          selectedMemberIds: checked
                            ? prev.selectedMemberIds.filter((id) => id !== m.id)
                            : [...prev.selectedMemberIds, m.id],
                        }))
                      }
                      className="rounded text-blue-900"
                    />
                    <span className="font-medium text-slate-900">{m.fullName}</span>
                    <span className="text-slate-500 ml-auto tabular-nums">Nº {m.manualNumber}</span>
                  </label>
                );
              })}
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700 tabular-nums">
            Serão processados <strong>{batchEnrollTargetMembers.length}</strong> membro(s) elegível(is). Membros já inscritos neste item serão ignorados automaticamente sem duplicação.
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setBatchEnrollModalOpen(false)}
              className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={batchEnrollTargetMembers.length === 0 || !batchEnrollForm.targetId}
              className="px-4 py-2 font-semibold text-white bg-blue-900 hover:bg-blue-800 disabled:opacity-50 rounded-lg cursor-pointer"
            >
              Confirmar Inscrição em Lote
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Confirmação de Remoção Segura */}
      <Modal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete?.title || 'Confirmar remoção'}
        description="Esta ação altera os registos oficiais do Gabinete do Diretor-associado."
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{confirmDelete?.description}</p>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmDeleteAction}
              className="px-4 py-2 font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg cursor-pointer"
            >
              Confirmar Remoção
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
