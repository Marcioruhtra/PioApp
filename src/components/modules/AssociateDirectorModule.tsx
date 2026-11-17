import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  Briefcase,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Edit2,
  FileText,
  GraduationCap,
  Layers,
  MessageSquare,
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
  Users,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import {
  ActivityStage,
  AssociateDirectivePriority,
  AssociateDirectiveStatus,
  ClubActivity,
  MemberCategory,
  ModuleName,
} from '../../types';
import { formatDateAO } from '../../utils/date';
import { Modal } from '../common/Modal';
import { ROLE_LABELS } from '../../services/permissionService';
import { getMemberTeamLabel, isDirectionMember } from '../../services/accountSyncService';

interface AssociateDirectorModuleProps {
  onNavigate?: (module: ModuleName) => void;
}

type AssociateTab = 'visao' | 'equipas' | 'operacoes' | 'formacao' | 'supervisao';
type TeamSortField = 'overall' | 'members' | 'training' | 'participation' | 'evaluation';

const STAGE_LABELS: Record<ActivityStage, string> = {
  planeamento: 'Planeamento',
  aprovacao: 'Aprovação',
  preparacao: 'Preparação',
  execucao: 'Execução',
  relatorio: 'Relatório',
  encerrado: 'Encerrado',
};

const ACTIVITY_TYPE_LABELS: Record<ClubActivity['type'], string> = {
  reuniao_regular: 'Reunião Regular',
  acampamento: 'Acampamento',
  civica: 'Atividade Cívica',
  formacao: 'Formação',
  social: 'Ação Social',
  diretoria: 'Reunião de Diretoria',
};

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
    updateActivityStage,
    addTaskToActivity,
    updateTaskStatus,
    createAssociateDirective,
    updateAssociateDirectiveStatus,
    deleteAssociateDirective,
    saveTeamEvaluation,
    deleteTeamEvaluation,
    createCircular,
    sendMessage,
  } = useClub();

  const canViewModule = can('associate_director', 'VIEW');
  const canCreate = can('associate_director', 'CREATE');
  const canEdit = can('associate_director', 'EDIT');
  const canApprove = can('associate_director', 'APPROVE');
  const canExport = can('associate_director', 'EXPORT');
  const canPrint = can('associate_director', 'PRINT');

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
  const [assignTargetUnitName, setAssignTargetUnitName] = useState<string>(state.settings.units[0]?.name || '');
  const [teamRosterSearch, setTeamRosterSearch] = useState('');

  // Estados de Operações & Tarefas
  const [activityStageFilter, setActivityStageFilter] = useState<'todas' | ActivityStage>('todas');
  const [taskStatusFilter, setTaskStatusFilter] = useState<'todas' | 'pendente' | 'em_progresso' | 'concluido'>('todas');
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    activityId: state.activities[0]?.id || '',
    title: '',
    assigneeName: '',
    dueDate: new Date().toISOString().split('T')[0],
    priority: 'media' as 'baixa' | 'media' | 'alta' | 'urgente',
  });

  // Estados de Supervisão Formativa
  const [trainingTeamFilter, setTrainingTeamFilter] = useState<string>('todas');
  const [trainingTypeFilter, setTrainingTypeFilter] = useState<'todos' | 'classe' | 'especialidade'>('todos');
  const [trainingReadinessFilter, setTrainingReadinessFilter] = useState<'todos' | 'prontos' | 'em_curso'>('todos');

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

      // Indicador percentual agregado de participação em reuniões/atividades da equipa (nunca expõe chamada individual)
      const totalSlots = teamMembers.length * state.activities.length;
      let totalPresent = 0;
      if (totalSlots > 0) {
        state.activities.forEach((act) => {
          act.attendees?.forEach((att) => {
            if (att.present && teamMemberIds.has(att.memberId)) {
              totalPresent++;
            }
          });
        });
      }
      const aggregateParticipationPct =
        totalSlots > 0 ? Math.round((totalPresent / totalSlots) * 100) : 0;

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

  const allTasks = useMemo(() => {
    return state.activities.flatMap((act) =>
      (act.tasks || []).map((task) => ({
        ...task,
        activityId: act.id,
        activityTitle: act.title,
        activityStage: act.stage,
        activityDate: act.startDate,
      }))
    );
  }, [state.activities]);

  const completedTasksCount = allTasks.filter((t) => t.status === 'concluido').length;
  const urgentPendingTasksCount = allTasks.filter(
    (t) => t.status !== 'concluido' && (t.priority === 'urgente' || t.priority === 'alta')
  ).length;
  const taskCompletionPct =
    allTasks.length > 0 ? Math.round((completedTasksCount / allTasks.length) * 100) : 0;

  const openDirectivesCount = directives.filter(
    (d) => d.status === 'pendente' || d.status === 'em_curso'
  ).length;

  const unitsWithoutLeader = state.settings.units.filter((u) => !u.leaderUserId);
  const activitiesWithoutMinute = state.activities.filter(
    (act) => act.stage !== 'planeamento' && !act.minute
  );
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
    return state.users.filter((u) => u.active && u.role !== 'membro');
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

  const handleDeleteUnit = (unitId: string, unitName: string) => {
    const res = deleteUnit(unitId);
    if (res.success) {
      if (selectedUnitId === unitId) setSelectedUnitId('');
      showFeedback('success', `Equipa "${unitName}" removida. Os membros associados passaram para a fila Sem Equipa.`);
    } else {
      showFeedback('error', res.error || 'Erro ao remover equipa.');
    }
  };

  const handleAssignMember = (memberId: string, unitName?: string) => {
    const res = assignMemberToUnit(memberId, unitName);
    if (res.success) {
      showFeedback(
        'success',
        unitName ? `Membro alocado à equipa "${unitName}".` : 'Membro desvinculado da equipa.'
      );
    } else {
      showFeedback('error', res.error || 'Erro ao alocar membro.');
    }
  };

  // Handler Tarefa Operacional
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit && !can('activities', 'EDIT')) {
      showFeedback('error', 'Sem permissão para criar tarefas operacionais.');
      return;
    }
    if (!taskForm.activityId || !taskForm.title.trim()) {
      showFeedback('error', 'Selecione a atividade e descreva a tarefa operacional.');
      return;
    }
    addTaskToActivity(taskForm.activityId, {
      title: taskForm.title.trim(),
      assigneeName: taskForm.assigneeName.trim() || currentUser.name,
      dueDate: taskForm.dueDate,
      priority: taskForm.priority,
      status: 'pendente',
    });
    setTaskModalOpen(false);
    setTaskForm({
      activityId: state.activities[0]?.id || '',
      title: '',
      assigneeName: '',
      dueDate: new Date().toISOString().split('T')[0],
      priority: 'media',
    });
    showFeedback('success', 'Tarefa operacional adicionada à atividade e sincronizada.');
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

  const filteredActivities = state.activities.filter((act) =>
    activityStageFilter === 'todas' ? true : act.stage === activityStageFilter
  );

  const filteredTasks = allTasks.filter((t) =>
    taskStatusFilter === 'todas' ? true : t.status === taskStatusFilter
  );

  const filteredTraining = candidatesReadyForInvestiture.filter((item) => {
    if (trainingTeamFilter !== 'todas' && (item.member.unitOrTeam || '') !== trainingTeamFilter) return false;
    if (trainingTypeFilter !== 'todos' && item.progress.type !== trainingTypeFilter) return false;
    if (trainingReadinessFilter === 'prontos') return item.pct >= 100 && !item.progress.finalAuthorizedApproval;
    if (trainingReadinessFilter === 'em_curso') return item.pct < 100;
    return true;
  });

  const filteredDirectives = directives.filter((d) =>
    directiveStatusFilter === 'todas' ? true : d.status === directiveStatusFilter
  );

  const tabs: { id: AssociateTab; label: string; count?: number }[] = [
    { id: 'visao', label: 'Visão Executiva' },
    { id: 'equipas', label: 'Equipas & Alocação', count: state.settings.units.length },
    { id: 'operacoes', label: 'Operações & Tarefas', count: allTasks.filter((t) => t.status !== 'concluido').length },
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
            Supervisão administrativa integrada de equipas, coordenação de tarefas de atividades, prontidão formativa e diretivas operacionais, com total separação da tesouraria e das listas nominais de presença.
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
                <span className="text-xs font-semibold text-slate-600">Índice Médio Formativo</span>
                <GraduationCap className="w-4 h-4 text-blue-900 shrink-0" />
              </div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums mt-2">{globalAvgTrainingPct}%</div>
              <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 tabular-nums">
                <span>{state.trainingProgress.length} planos ativos</span>
                <span aria-hidden="true">·</span>
                <span>{pendingInvestituresCount} prontos p/ validação</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold text-slate-600">Execução de Tarefas</span>
                <ClipboardCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              </div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums mt-2">{taskCompletionPct}%</div>
              <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 tabular-nums">
                <span>{completedTasksCount}/{allTasks.length} concluídas</span>
                <span aria-hidden="true">·</span>
                <span>{urgentPendingTasksCount} prioritárias</span>
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
                    <p className="text-xs font-semibold text-slate-900">Atividades em curso sem ata</p>
                    <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                      {activitiesWithoutMinute.length} atividade(s) precisam de registo de ata
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('operacoes')}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Ver Atividades
                  </button>
                </div>

                <div className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">Candidatos prontos p/ investidura</p>
                    <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                      {pendingInvestituresCount} plano(s) com 100% dos requisitos cumpridos
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setTrainingReadinessFilter('prontos');
                      setActiveTab('formacao');
                    }}
                    className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Supervisionar
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
                                onClick={() => handleDeleteUnit(tm.unit.id, tm.unit.name)}
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
                    {filteredUnassignedMembers.map((m) => (
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
                              value={assignTargetUnitName || activeSelectedUnit?.unit.name || state.settings.units[0]?.name || ''}
                              onChange={(e) => setAssignTargetUnitName(e.target.value)}
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
                                const target =
                                  assignTargetUnitName ||
                                  activeSelectedUnit?.unit.name ||
                                  state.settings.units[0]?.name;
                                if (target) handleAssignMember(m.id, target);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Alocar</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: OPERAÇÕES DE ATIVIDADES & GESTÃO DE TAREFAS                    */}
      {/* (Estritamente sem sub-aba ou listagem nominal de presenças)           */}
      {/* ===================================================================== */}
      {activeTab === 'operacoes' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Supervisão de Fases & Atas de Atividades */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Monitorização de Atividades & Reuniões</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Controlo de etapas e conformidade de atas (sem chamada nominal)</p>
                </div>
                <select
                  value={activityStageFilter}
                  onChange={(e) => setActivityStageFilter(e.target.value as 'todas' | ActivityStage)}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
                >
                  <option value="todas">Todas as fases</option>
                  {Object.entries(STAGE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {filteredActivities.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Nenhuma atividade corresponde ao filtro selecionado.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredActivities.map((act) => {
                    const totalT = act.tasks?.length || 0;
                    const doneT = act.tasks?.filter((t) => t.status === 'concluido').length || 0;
                    const pctT = totalT > 0 ? Math.round((doneT / totalT) * 100) : 0;

                    return (
                      <div key={act.id} className="p-4 space-y-2.5 hover:bg-slate-50/70">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold text-slate-900 truncate">{act.title}</h3>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {ACTIVITY_TYPE_LABELS[act.type]} · {formatDateAO(act.startDate)} · {act.location}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[11px] font-semibold ${act.minute ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {act.minute ? 'Ata OK' : 'Sem Ata'}
                            </span>
                            {(canEdit || can('activities', 'EDIT')) ? (
                              <select
                                value={act.stage}
                                onChange={(e) => {
                                  const res = updateActivityStage(act.id, e.target.value as ActivityStage);
                                  if (res.success) showFeedback('success', `Fase da atividade "${act.title}" atualizada.`);
                                  else showFeedback('error', res.error || 'Erro ao atualizar fase.');
                                }}
                                className="px-2 py-1 text-[11px] font-semibold border border-slate-200 rounded bg-white text-slate-800"
                              >
                                {Object.entries(STAGE_LABELS).map(([k, v]) => (
                                  <option key={k} value={k}>{v}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[11px] font-semibold text-slate-700">
                                {STAGE_LABELS[act.stage]}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-blue-900 h-full rounded-full" style={{ width: `${pctT}%` }} />
                          </div>
                          <span className="text-[11px] font-mono tabular-nums text-slate-600 shrink-0">
                            {doneT}/{totalT} tarefas ({pctT}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Matriz Unificada de Tarefas Operacionais */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Painel Unificado de Tarefas</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Delegação e acompanhamento operacional por responsável</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={taskStatusFilter}
                    onChange={(e) => setTaskStatusFilter(e.target.value as any)}
                    className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
                  >
                    <option value="todas">Todos estados</option>
                    <option value="pendente">Pendentes</option>
                    <option value="em_progresso">Em Progresso</option>
                    <option value="concluido">Concluídas</option>
                  </select>
                  {(canEdit || can('activities', 'EDIT')) && state.activities.length > 0 && (
                    <button
                      onClick={() => {
                        setTaskForm((prev) => ({
                          ...prev,
                          activityId: prev.activityId || state.activities[0]?.id || '',
                        }));
                        setTaskModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Atribuir Tarefa</span>
                    </button>
                  )}
                </div>
              </div>

              {filteredTasks.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Nenhuma tarefa registada para os critérios atuais.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredTasks.map((task) => (
                    <div key={`${task.activityId}-${task.id}`} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/70">
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold truncate ${task.status === 'concluido' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {task.title}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {task.activityTitle} · Resp.: {task.assigneeName} · Prazo: {formatDateAO(task.dueDate)} · Prioridade: {task.priority}
                        </p>
                      </div>

                      {(canEdit || can('activities', 'EDIT')) ? (
                        <select
                          value={task.status}
                          onChange={(e) => {
                            updateTaskStatus(
                              task.activityId,
                              task.id,
                              e.target.value as 'pendente' | 'em_progresso' | 'concluido'
                            );
                            showFeedback('success', `Estado da tarefa "${task.title}" atualizado.`);
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold border border-slate-200 rounded-lg bg-white text-slate-800 shrink-0"
                        >
                          <option value="pendente">Pendente</option>
                          <option value="em_progresso">Em Progresso</option>
                          <option value="concluido">Concluído</option>
                        </select>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-600 shrink-0">{task.status}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: SUPERVISÃO FORMATIVA & PRONTIDÃO DE INVESTIDURA                */}
      {/* ===================================================================== */}
      {activeTab === 'formacao' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Supervisão Formativa & Prontidão de Investidura ({filteredTraining.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Acompanhamento de requisitos cumpridos por membro e por equipa para coordenação com instrutores e direção
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
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
                onChange={(e) => setTrainingTypeFilter(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
              >
                <option value="todos">Classes & Especialidades</option>
                <option value="classe">Apenas Classes</option>
                <option value="especialidade">Apenas Especialidades</option>
              </select>

              <select
                value={trainingReadinessFilter}
                onChange={(e) => setTrainingReadinessFilter(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
              >
                <option value="todos">Todos os estágios</option>
                <option value="prontos">Prontos p/ Investidura (100%)</option>
                <option value="em_curso">Em Progresso (&lt; 100%)</option>
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
                    <th className="py-3 px-3">Classe / Especialidade</th>
                    <th className="py-3 px-3">Instrutor</th>
                    <th className="py-3 px-3 text-right">Requisitos</th>
                    <th className="py-3 px-4 text-right">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTraining.map(({ progress, member, pct }) => (
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
                        <div className="text-[11px] text-slate-500 capitalize">{progress.type}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{progress.instructorName}</td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-800">
                        {progress.completedRequirements.length}/{progress.totalRequirements} ({pct}%)
                      </td>
                      <td className="py-3 px-4 text-right">
                        {progress.finalAuthorizedApproval ? (
                          <span className="text-xs font-semibold text-emerald-700">Investidura Aprovada</span>
                        ) : pct >= 100 ? (
                          <span className="text-xs font-semibold text-amber-700">Pronto p/ Validação</span>
                        ) : (
                          <span className="text-xs text-slate-500">Em Formação</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                            onClick={() => {
                              const res = deleteAssociateDirective(dir.id);
                              if (res.success) showFeedback('success', 'Diretiva removida do histórico.');
                              else showFeedback('error', res.error || 'Erro ao remover.');
                            }}
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
                            onClick={() => {
                              const res = deleteTeamEvaluation(ev.id);
                              if (res.success) showFeedback('success', 'Avaliação removida.');
                              else showFeedback('error', res.error || 'Erro ao remover.');
                            }}
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
            <label className="block font-semibold text-slate-700 mb-1">Líder / Conselheiro Responsável</label>
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

      {/* Modal Atribuir Tarefa Operacional */}
      <Modal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        title="Atribuir Nova Tarefa Operacional"
        description="Adicione uma tarefa diretamente ao plano de trabalho de uma atividade."
      >
        <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Atividade / Reunião *</label>
            <select
              value={taskForm.activityId}
              onChange={(e) => setTaskForm({ ...taskForm, activityId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              {state.activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({formatDateAO(a.startDate)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Descrição da Tarefa *</label>
            <input
              type="text"
              required
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              placeholder="Ex.: Preparar material de instrução para a Unidade"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Responsável *</label>
              <input
                type="text"
                required
                value={taskForm.assigneeName}
                onChange={(e) => setTaskForm({ ...taskForm, assigneeName: e.target.value })}
                placeholder="Nome do responsável"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Data Limite *</label>
              <input
                type="date"
                required
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Prioridade</label>
            <select
              value={taskForm.priority}
              onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
            >
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setTaskModalOpen(false)}
              className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg cursor-pointer"
            >
              Registar Tarefa
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
              placeholder="Ex.: Conclusão dos requisitos de Classe até ao encerramento do trimestre"
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
                  <span className="text-slate-500 block">Execução Tarefas</span>
                  <strong className="text-base">{taskCompletionPct}%</strong>
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
    </div>
  );
};
