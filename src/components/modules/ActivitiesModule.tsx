import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Plus,
  Users,
  FileText,
  CheckSquare,
  Printer,
  ChevronRight,
  DollarSign,
  UserCheck,
  UserX,
  Search,
  Filter,
  BarChart3,
  TrendingUp,
  History,
  Award,
  XCircle,
  Info,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  Download,
  ChevronLeft,
  ShieldCheck,
  RotateCcw,
  List,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import {
  ClubActivity,
  ActivityStage,
  OfficialDocument,
  MemberCategory,
  PaymentMethod,
  ActivityTask,
} from '../../types';
import { formatKz } from '../../utils/currency';
import { formatDateAO, getMonthNamePT } from '../../utils/date';
import { Modal } from '../common/Modal';
import { PrintDocumentModal } from '../common/PrintDocumentModal';
import { signInWithGoogleCalendar, getCalendarAccessToken, syncActivityToGoogleCalendar } from '../../services/googleCalendarService';
import {
  canViewActivitiesAttendanceTab,
  hasViewActivityFinancialsPermission,
  shouldShowActivityCostsSection,
  shouldShowActivityContributionsSection,
} from '../../services/permissionService';
import { getMemberTeamLabel } from '../../services/accountSyncService';
import { resolveMinuteOfficers } from '../../utils/documentSigner';
import {
  ACTIVITY_TYPE_COLORS,
  canActivityHaveMinute,
  canManageActivityPortalVisibility,
  doesActivityOccurOnDate,
  downloadActivityICS,
  formatRsvpSummary,
  getActivityDateOnly,
  getActivityStageLabel,
  getActivityTimeRangeLabel,
  getActivityTypeLabel,
  getPreviousCommissionMinute,
  normalizeActivityStage,
  normalizeActivityType,
  parseDeliberationsToTaskDrafts,
} from '../../utils/activityUtils';

export const ActivitiesModule: React.FC = () => {
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [calendarSyncMsg, setCalendarSyncMsg] = useState<string | null>(null);

  const handleSyncToCalendar = async () => {
    if (!currentActivity) return;
    setCalendarSyncMsg(null);
    setIsSyncingCalendar(true);
    try {
      let token = await getCalendarAccessToken();
      if (!token) {
        const authRes = await signInWithGoogleCalendar();
        if (!authRes) {
          setCalendarSyncMsg('Autenticação com Google cancelada.');
          setIsSyncingCalendar(false);
          return;
        }
        token = authRes.accessToken;
      }
      await syncActivityToGoogleCalendar(currentActivity, token);
      setCalendarSyncMsg('Atividade sincronizada com sucesso no Google Calendar!');
      setTimeout(() => setCalendarSyncMsg(null), 5000);
    } catch (err: any) {
      setCalendarSyncMsg(err.message || 'Erro ao sincronizar com Google Calendar.');
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const {
    state,
    can,
    currentUser,
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
    createFeeDefinition,
    updateFeeDefinition,
    createReceipt,
  } = useClub();

  // Navegação Principal de Abas e Permissão Financeira de Atividades (Grelha do Administrador)
  const canViewAttendanceTab = canViewActivitiesAttendanceTab(currentUser.role);
  const canViewActivityFinancials = hasViewActivityFinancialsPermission(
    currentUser.role,
    state.settings.permissionsMatrix
  );
  const canManagePortalVisibility = canManageActivityPortalVisibility(
    currentUser.role,
    state.settings.permissionsMatrix
  );
  const [mainTab, setMainTab] = useState<'atividades' | 'presencas'>('atividades');

  // Vista de Calendário & Filtros da Aba Principal
  const [calendarViewMode, setCalendarViewMode] = useState<'lista' | 'mensal'>('lista');
  const [activitySearch, setActivitySearch] = useState('');
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>('todos');
  const [activityStageFilter, setActivityStageFilter] = useState<string>('todas');
  const [activityMonthFilter, setActivityMonthFilter] = useState<string>('todos');
  const [calendarCursorDate, setCalendarCursorDate] = useState<Date>(() => new Date());

  useEffect(() => {
    if (!canViewAttendanceTab && mainTab === 'presencas') {
      setMainTab('atividades');
    }
  }, [canViewAttendanceTab, mainTab]);

  // Estados do Sub-módulo de Presenças
  const [attendanceSubTab, setAttendanceSubTab] = useState<'chamada' | 'historico'>('chamada');
  const [attendanceSelectedActivityId, setAttendanceSelectedActivityId] = useState<string>(
    state.activities[0]?.id || ''
  );
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState('');
  const [attendanceUnitFilter, setAttendanceUnitFilter] = useState<string>('todas');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<'todos' | 'presentes' | 'ausentes'>('todos');
  const [selectedMemberForHistory, setSelectedMemberForHistory] = useState<string | null>(null);

  const [selectedActivity, setSelectedActivity] = useState<ClubActivity | null>(
    state.activities[0] || null
  );
  const [isNewActivityOpen, setIsNewActivityOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [isMinuteModalOpen, setIsMinuteModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskStatusFilter, setTaskStatusFilter] = useState<'todas' | 'pendentes' | 'concluidas'>('todas');
  const [taskToDelete, setTaskToDelete] = useState<ActivityTask | null>(null);
  const [approvalModalState, setApprovalModalState] = useState<{
    decision: 'aprovar' | 'devolver';
    notes: string;
    error: string | null;
  } | null>(null);
  const [printedDoc, setPrintedDoc] = useState<OfficialDocument | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityActionFeedback, setActivityActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<ClubActivity | null>(null);

  // Formulário Nova / Edição de Atividade
  const defaultActivityForm = {
    title: '',
    type: 'actividade_regular' as ClubActivity['type'],
    department: state.settings.departments?.[0]?.name || 'Instrução Geral',
    location: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    startTime: '08:30',
    endTime: '12:00',
    description: '',
    stage: 'preparacao' as ActivityStage,
    requiresDirectorApproval: false,
    visibleInMemberPortal: false,
    costEstimatedInCents: 0,
    hasCost: false,
    costEstimatedStr: '',
    costApprovedInCents: 0,
    costPaidInCents: 0,
    hasMemberContribution: false,
    contributionTitle: '',
    contributionAmountStr: '',
    contributionTargetCategory: 'todos' as MemberCategory | 'todos',
  };
  const [activityForm, setActivityForm] = useState(defaultActivityForm);

  const minuteOfficers = resolveMinuteOfficers(state.users, currentUser);

  // Formulário Ata Estruturada
  const [minuteForm, setMinuteForm] = useState({
    date: new Date().toISOString().split('T')[0],
    location: "Sede do Clube de Embaixadores Pioneiros D'Alvorada, Talatona",
    chairPerson: minuteOfficers.chairPerson,
    secretary: minuteOfficers.secretary,
    attendeesCount: 20,
    presentMemberIds: [] as string[],
    quorumMet: true,
    status: 'aprovada' as 'rascunho' | 'aprovada',
    agendaText: 'Abertura\nPlano de Atividades\nAssuntos Gerais',
    deliberations: '',
    observations: '',
  });
  const [showPreviousMinuteRef, setShowPreviousMinuteRef] = useState(false);
  const [minuteTaskDrafts, setMinuteTaskDrafts] = useState<
    Array<{
      include: boolean;
      title: string;
      assigneeName: string;
      dueDate: string;
      priority: ActivityTask['priority'];
    }>
  >([]);

  // Formulário Tarefa
  const [taskForm, setTaskForm] = useState({
    title: '',
    assigneeName: state.members[0]?.fullName || 'Membro Responsável',
    customAssigneeName: '',
    dueDate: new Date().toISOString().split('T')[0],
    priority: 'media' as ActivityTask['priority'],
    status: 'pendente' as ActivityTask['status'],
  });

  // Modal e Formulário de Contribuição / Doação para a Atividade
  const [isContributionModalOpen, setIsContributionModalOpen] = useState(false);
  const [contribForm, setContribForm] = useState({
    memberId: state.members[0]?.id || '',
    customDonorName: '',
    amountStr: '',
    paymentMethod: 'multicaixa_express' as PaymentMethod,
    notes: '',
  });
  const [contribError, setContribError] = useState<string | null>(null);

  const handleRecordContribution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentActivity) return;
    setContribError(null);

    const amountCents = Number(contribForm.amountStr) * 100;
    if (amountCents <= 0) {
      setContribError('Indique um valor válido superior a zero.');
      return;
    }

    let feeDefId = currentActivity.feeDefinitionId;
    if (!feeDefId) {
      const feeRes = createFeeDefinition({
        title: `Contribuição / Doação: ${currentActivity.title}`,
        category: 'contribuicao_atividade',
        periodicity: 'unica',
        year: new Date().getFullYear(),
        amountInCents: amountCents,
        active: true,
      });
      if (feeRes.success && feeRes.id) {
        feeDefId = feeRes.id;
      } else {
        setContribError('Erro ao criar rubrica de contribuição.');
        return;
      }
    }

    const res = createReceipt({
      memberId: contribForm.memberId || (!contribForm.customDonorName.trim() ? state.members[0]?.id || '' : ''),
      customDonorName: contribForm.customDonorName.trim() || undefined,
      feeDefinitionId: feeDefId,
      periodLabel: `Atividade: ${currentActivity.title}`,
      amountPaidInCents: amountCents,
      paymentMethod: contribForm.paymentMethod,
      notes: contribForm.notes.trim() || `Contributo para atividade: ${currentActivity.title}`,
      activityId: currentActivity.id,
    });

    if (res.success) {
      setIsContributionModalOpen(false);
      setContribForm({
        memberId: state.members[0]?.id || '',
        customDonorName: '',
        amountStr: '',
        paymentMethod: 'multicaixa_express',
        notes: '',
      });
      setContribError(null);
    } else {
      setContribError(res.error || 'Erro ao registar contribuição.');
    }
  };

  const openCreateActivityModal = () => {
    setEditingActivityId(null);
    setActivityError(null);
    setActivityForm({
      ...defaultActivityForm,
      department: state.settings.departments?.[0]?.name || 'Instrução Geral',
      startDate: new Date().toISOString().split('T')[0],
    });
    setIsNewActivityOpen(true);
  };

  const openEditActivityModal = (act: ClubActivity) => {
    const startOnly = getActivityDateOnly(act.startDate);
    const endOnly = getActivityDateOnly(act.endDate);
    const extractTime = (iso?: string, fallback?: string) => {
      if (fallback) return fallback;
      if (iso && iso.includes('T')) {
        const m = iso.match(/T(\d{2}:\d{2})/);
        if (m && m[1] !== '00:00') return m[1];
      }
      return '';
    };
    const linkedFee = act.feeDefinitionId
      ? state.fees.find((f) => f.id === act.feeDefinitionId)
      : undefined;

    setEditingActivityId(act.id);
    setActivityError(null);
    setActivityForm({
      title: act.title,
      type: normalizeActivityType(act.type),
      department: act.department || 'Instrução Geral',
      location: act.location,
      startDate: startOnly || new Date().toISOString().split('T')[0],
      endDate: endOnly && endOnly !== startOnly ? endOnly : '',
      startTime: extractTime(act.startDate, act.startTime) || '08:30',
      endTime: extractTime(act.endDate, act.endTime) || '12:00',
      description: act.description || '',
      stage: normalizeActivityStage(act.stage),
      requiresDirectorApproval: Boolean(act.requiresDirectorApproval),
      visibleInMemberPortal: Boolean(act.visibleInMemberPortal),
      costEstimatedInCents: act.costEstimatedInCents || 0,
      hasCost: Boolean(act.hasCost || act.costEstimatedInCents > 0),
      costEstimatedStr: act.costEstimatedInCents > 0 ? String(Math.round(act.costEstimatedInCents / 100)) : '',
      costApprovedInCents: act.costApprovedInCents || 0,
      costPaidInCents: act.costPaidInCents || 0,
      hasMemberContribution: Boolean(act.hasMemberContribution || act.feeDefinitionId),
      contributionTitle: linkedFee?.title || `Contribuição: ${act.title}`,
      contributionAmountStr: linkedFee ? String(Math.round(linkedFee.amountInCents / 100)) : '',
      contributionTargetCategory:
        linkedFee?.targetCategory && linkedFee.targetCategory !== 'todas'
          ? linkedFee.targetCategory
          : 'todos',
    });
    setIsNewActivityOpen(true);
  };

  const handleSaveActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityForm.title.trim()) {
      setActivityError('Indique o título da atividade.');
      return;
    }
    if (activityForm.endDate && activityForm.endDate < activityForm.startDate) {
      setActivityError('A data de término não pode ser anterior à data de início.');
      return;
    }

    const costInCents =
      activityForm.hasCost && activityForm.costEstimatedStr
        ? Number(activityForm.costEstimatedStr) * 100
        : 0;

    if (editingActivityId) {
      const existingAct = state.activities.find((a) => a.id === editingActivityId);
      let feeDefId = activityForm.hasMemberContribution ? existingAct?.feeDefinitionId : undefined;
      if (activityForm.hasMemberContribution && activityForm.contributionAmountStr) {
        const contribAmount = Number(activityForm.contributionAmountStr) * 100;
        const targetCategoryValue =
          activityForm.contributionTargetCategory === 'todos'
            ? undefined
            : activityForm.contributionTargetCategory;
        const feeTitle =
          activityForm.contributionTitle.trim() || `Contribuição: ${activityForm.title.trim()}`;

        if (contribAmount > 0) {
          if (feeDefId) {
            updateFeeDefinition(feeDefId, {
              title: feeTitle,
              targetCategory: targetCategoryValue,
              amountInCents: contribAmount,
              active: true,
            });
          } else {
            const feeRes = createFeeDefinition({
              title: feeTitle,
              category: 'contribuicao_atividade',
              targetCategory: targetCategoryValue,
              periodicity: 'unica',
              year: state.settings.currentYear || new Date().getFullYear(),
              amountInCents: contribAmount,
              active: true,
            });
            if (feeRes.success && feeRes.id) {
              feeDefId = feeRes.id;
            }
          }
        }
      }

      const res = updateActivity(editingActivityId, {
        title: activityForm.title.trim(),
        type: activityForm.type,
        department: activityForm.department.trim() || 'Instrução Geral',
        location: activityForm.location.trim(),
        startDate: activityForm.startDate,
        endDate: activityForm.endDate || undefined,
        startTime: activityForm.startTime || undefined,
        endTime: activityForm.endTime || undefined,
        description: activityForm.description.trim() || undefined,
        stage: activityForm.stage,
        requiresDirectorApproval: activityForm.requiresDirectorApproval,
        visibleInMemberPortal: canManagePortalVisibility
          ? activityForm.visibleInMemberPortal
          : existingAct?.visibleInMemberPortal,
        hasCost: Boolean(activityForm.hasCost && costInCents > 0),
        costEstimatedInCents: costInCents,
        hasMemberContribution: Boolean(activityForm.hasMemberContribution && feeDefId),
        feeDefinitionId: feeDefId,
      });

      if (res.success) {
        if (res.activity) setSelectedActivity(res.activity);
        setIsNewActivityOpen(false);
        setEditingActivityId(null);
        setActivityError(null);
        setActivityActionFeedback({ type: 'success', message: 'Atividade atualizada com sucesso.' });
        setTimeout(() => setActivityActionFeedback(null), 4000);
      } else {
        setActivityError(res.error || 'Erro ao atualizar atividade.');
      }
      return;
    }

    let feeDefId: string | undefined = undefined;
    if (activityForm.hasMemberContribution && activityForm.contributionAmountStr) {
      const contribAmount = Number(activityForm.contributionAmountStr) * 100;
      if (contribAmount > 0) {
        const feeRes = createFeeDefinition({
          title: activityForm.contributionTitle.trim() || `Contribuição: ${activityForm.title.trim()}`,
          category: 'contribuicao_atividade',
          targetCategory:
            activityForm.contributionTargetCategory === 'todos'
              ? undefined
              : activityForm.contributionTargetCategory,
          periodicity: 'unica',
          year: state.settings.currentYear || new Date().getFullYear(),
          amountInCents: contribAmount,
          active: true,
        });
        if (feeRes.success && feeRes.id) {
          feeDefId = feeRes.id;
        }
      }
    }

    const res = createActivity({
      title: activityForm.title.trim(),
      type: activityForm.type,
      department: activityForm.department.trim() || 'Instrução Geral',
      location: activityForm.location.trim(),
      startDate: activityForm.startDate,
      endDate: activityForm.endDate || undefined,
      startTime: activityForm.startTime || undefined,
      endTime: activityForm.endTime || undefined,
      description: activityForm.description.trim() || undefined,
      stage: activityForm.stage,
      requiresDirectorApproval: activityForm.requiresDirectorApproval,
      visibleInMemberPortal: canManagePortalVisibility ? activityForm.visibleInMemberPortal : false,
      hasCost: Boolean(activityForm.hasCost && costInCents > 0),
      hasMemberContribution: Boolean(activityForm.hasMemberContribution && feeDefId),
      costEstimatedInCents: costInCents,
      costApprovedInCents: 0,
      costPaidInCents: 0,
      feeDefinitionId: feeDefId,
    });

    if (res.success) {
      if (res.activity) {
        setSelectedActivity(res.activity);
        setAttendanceSelectedActivityId(res.activity.id);
      }
      setIsNewActivityOpen(false);
      setActivityError(null);
      setActivityForm(defaultActivityForm);
      setActivityActionFeedback({ type: 'success', message: 'Atividade agendada com sucesso.' });
      setTimeout(() => setActivityActionFeedback(null), 4000);
    } else {
      setActivityError(res.error || 'Erro ao criar atividade.');
    }
  };

  const openMinuteModal = () => {
    const activityRef = currentActivity || selectedActivity;
    if (!activityRef || !canActivityHaveMinute(activityRef.type)) return;
    const existingMinute = activityRef.minute;
    const presentIds =
      activityRef.attendees?.filter((a) => a.present).map((a) => a.memberId) || [];
    const presentCount = presentIds.length;

    setMinuteForm({
      date:
        existingMinute?.date ||
        getActivityDateOnly(activityRef?.startDate) ||
        new Date().toISOString().split('T')[0],
      location:
        existingMinute?.location ||
        activityRef?.location ||
        "Sede do Clube de Embaixadores Pioneiros D'Alvorada, Talatona",
      chairPerson: minuteOfficers.chairPerson,
      secretary: minuteOfficers.secretary,
      attendeesCount:
        existingMinute?.attendeesCount ?? (presentCount > 0 ? presentCount : 12),
      presentMemberIds: existingMinute?.presentMemberIds || presentIds,
      quorumMet: existingMinute?.quorumMet ?? true,
      status: existingMinute?.status || 'aprovada',
      agendaText:
        existingMinute?.agenda && existingMinute.agenda.length > 0
          ? existingMinute.agenda.join('\n')
          : 'Abertura e oração\nLeitura da ata anterior\nOrdens de trabalho e instruções\nEncerramento',
      deliberations: existingMinute?.deliberations || '',
      observations: existingMinute?.observations || '',
    });
    setMinuteTaskDrafts([]);
    setShowPreviousMinuteRef(false);
    setIsMinuteModalOpen(true);
  };

  const handleExtractTasksFromDeliberations = () => {
    const lines = parseDeliberationsToTaskDrafts(minuteForm.deliberations);
    const defaultAssignee = state.members.find((m) => m.status === 'ativo')?.fullName || currentUser.name;
    const defaultDue = minuteForm.date || new Date().toISOString().split('T')[0];
    setMinuteTaskDrafts(
      lines.map((line) => ({
        include: true,
        title: line,
        assigneeName: defaultAssignee,
        dueDate: defaultDue,
        priority: 'media',
      }))
    );
  };

  const handleSaveMinute = (e: React.FormEvent) => {
    e.preventDefault();
    const activityTarget = currentActivity || selectedActivity;
    if (!activityTarget || !canActivityHaveMinute(activityTarget.type)) return;

    const agenda = minuteForm.agendaText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    const tasksToCreate: Omit<ActivityTask, 'id'>[] = minuteTaskDrafts
      .filter((d) => d.include && d.title.trim())
      .map((d) => ({
        title: d.title.trim(),
        assigneeName: d.assigneeName.trim() || currentUser.name,
        dueDate: d.dueDate || minuteForm.date,
        priority: d.priority,
        status: 'pendente',
      }));

    const res = saveMinuteToActivity(
      activityTarget.id,
      {
        date: minuteForm.date,
        location: minuteForm.location,
        chairPerson: minuteOfficers.chairPerson,
        secretary: minuteOfficers.secretary,
        attendeesCount: minuteForm.attendeesCount,
        presentMemberIds: minuteForm.presentMemberIds,
        quorumMet: minuteForm.quorumMet,
        status: minuteForm.status,
        agenda,
        deliberations: minuteForm.deliberations,
        observations: minuteForm.observations.trim() || undefined,
      },
      tasksToCreate
    );

    if (res.success) {
      setIsMinuteModalOpen(false);
      setMinuteTaskDrafts([]);
      setActivityActionFeedback({
        type: 'success',
        message: `Ata ${res.minuteNumber} gravada (${minuteForm.status === 'rascunho' ? 'Rascunho' : 'Aprovada'})${tasksToCreate.length > 0 ? ` e ${tasksToCreate.length} tarefa(s) gerada(s)` : ''}.`,
      });
      setTimeout(() => setActivityActionFeedback(null), 5000);
    }
  };

  const openCreateTaskModal = () => {
    setEditingTaskId(null);
    setTaskForm({
      title: '',
      assigneeName: state.members.find((m) => m.status === 'ativo')?.fullName || currentUser.name,
      customAssigneeName: '',
      dueDate: getActivityDateOnly(currentActivity?.startDate) || new Date().toISOString().split('T')[0],
      priority: 'media',
      status: 'pendente',
    });
    setIsTaskModalOpen(true);
  };

  const openEditTaskModal = (task: ActivityTask) => {
    const memberExists = state.members.some((m) => m.fullName === task.assigneeName);
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      assigneeName: memberExists ? task.assigneeName : 'CUSTOM',
      customAssigneeName: memberExists ? '' : task.assigneeName,
      dueDate: task.dueDate,
      priority: task.priority,
      status: task.status,
    });
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    const targetAct = currentActivity || selectedActivity;
    if (!targetAct || !taskForm.title.trim()) return;

    const finalAssignee =
      taskForm.assigneeName === 'CUSTOM'
        ? taskForm.customAssigneeName.trim() || 'Responsável do Clube'
        : taskForm.assigneeName;
    const matchedMember = state.members.find((m) => m.fullName === finalAssignee);

    if (editingTaskId) {
      updateTaskInActivity(targetAct.id, editingTaskId, {
        title: taskForm.title.trim(),
        assigneeName: finalAssignee,
        assigneeUserId: matchedMember?.id,
        dueDate: taskForm.dueDate,
        priority: taskForm.priority,
        status: taskForm.status,
      });
    } else {
      addTaskToActivity(targetAct.id, {
        title: taskForm.title.trim(),
        assigneeName: finalAssignee,
        assigneeUserId: matchedMember?.id,
        dueDate: taskForm.dueDate,
        priority: taskForm.priority,
        status: taskForm.status,
      });
    }

    setIsTaskModalOpen(false);
    setEditingTaskId(null);
  };

  // Atividade ativa sincronizada
  const currentActivity = state.activities.find((a) => a.id === selectedActivity?.id) || state.activities[0];

  // Lista filtrada de atividades (Calendário & Planeamento)
  const availableActivityMonths = Array.from(
    new Set(
      state.activities
        .map((a) => getActivityDateOnly(a.startDate).slice(0, 7))
        .filter((ym) => /^\d{4}-\d{2}$/.test(ym))
    )
  ).sort((a, b) => b.localeCompare(a));

  const filteredActivities = state.activities.filter((act) => {
    const q = activitySearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      act.title.toLowerCase().includes(q) ||
      act.location.toLowerCase().includes(q) ||
      act.department.toLowerCase().includes(q);
    const matchesType = activityTypeFilter === 'todos' || act.type === activityTypeFilter;
    const matchesStage = activityStageFilter === 'todas' || act.stage === activityStageFilter;
    const actMonth = getActivityDateOnly(act.startDate).slice(0, 7);
    const matchesMonth = activityMonthFilter === 'todos' || actMonth === activityMonthFilter;
    return matchesSearch && matchesType && matchesStage && matchesMonth;
  });

  // Dados auxiliares do Calendário Mensal (Segunda -> Domingo)
  const calendarMonthDays = React.useMemo(() => {
    const year = calendarCursorDate.getFullYear();
    const month = calendarCursorDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const offsetFromMonday = (firstDayOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - offsetFromMonday);
    const todayISO = new Date().toISOString().split('T')[0];

    return Array.from({ length: 42 }, (_, idx) => {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + idx);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const day = d.getDate();
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return {
        date: d,
        iso,
        dayNumber: day,
        isCurrentMonth: d.getMonth() === month,
        isToday: iso === todayISO,
      };
    });
  }, [calendarCursorDate]);

  // Atividade selecionada no Sub-módulo de Presenças
  const attendanceActivity =
    state.activities.find((a) => a.id === attendanceSelectedActivityId) || currentActivity || state.activities[0];

  // Membros ativos para presenças
  const activeMembers = state.members.filter((m) => m.status === 'ativo');

  // Unidades/Equipas para filtros
  const availableUnits = Array.from(
    new Set(activeMembers.map((m) => getMemberTeamLabel(m, state.users)).filter(Boolean))
  );

  // Membros filtrados para a chamada
  const filteredAttendanceMembers = activeMembers.filter((m) => {
    const memberTeamLabel = getMemberTeamLabel(m, state.users);
    const searchLower = attendanceSearchTerm.toLowerCase();
    const matchesSearch =
      !attendanceSearchTerm ||
      m.fullName.toLowerCase().includes(searchLower) ||
      m.manualNumber.toLowerCase().includes(searchLower) ||
      memberTeamLabel.toLowerCase().includes(searchLower);

    const matchesUnit =
      attendanceUnitFilter === 'todas' ||
      memberTeamLabel === attendanceUnitFilter;

    if (!attendanceActivity) return matchesSearch && matchesUnit;

    const record = attendanceActivity.attendees?.find((att) => att.memberId === m.id);
    const isPresent = record?.present || false;

    const matchesStatus =
      attendanceStatusFilter === 'todos' ||
      (attendanceStatusFilter === 'presentes' && isPresent) ||
      (attendanceStatusFilter === 'ausentes' && !isPresent);

    return matchesSearch && matchesUnit && matchesStatus;
  });

  // Estatísticas de Presença da Atividade Selecionada
  const attendancePresentCount = attendanceActivity
    ? activeMembers.filter((m) =>
        attendanceActivity.attendees?.some((att) => att.memberId === m.id && att.present)
      ).length
    : 0;
  const attendanceTotalCount = activeMembers.length;
  const attendanceAbsentCount = attendanceTotalCount - attendancePresentCount;
  const attendanceRate = attendanceTotalCount > 0 ? Math.round((attendancePresentCount / attendanceTotalCount) * 100) : 0;

  // Ações em Lote para Presenças (operação atómica única)
  const handleBatchAttendance = (present: boolean) => {
    if (!attendanceActivity || filteredAttendanceMembers.length === 0) return;
    batchToggleAttendance(
      attendanceActivity.id,
      filteredAttendanceMembers.map((m) => m.id),
      present
    );
  };

  // Estatísticas Globais de Presença dos Membros
  const memberAttendanceStats = activeMembers.map((m) => {
    const totalEvents = state.activities.length;
    const attendedEvents = state.activities.filter((act) =>
      act.attendees?.some((att) => att.memberId === m.id && att.present)
    ).length;
    const rate = totalEvents > 0 ? Math.round((attendedEvents / totalEvents) * 100) : 0;

    let badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    let badgeLabel = 'Excelente';
    if (rate < 50) {
      badgeClass = 'bg-rose-100 text-rose-800 border-rose-300';
      badgeLabel = 'Baixa Assiduidade';
    } else if (rate < 70) {
      badgeClass = 'bg-amber-100 text-amber-800 border-amber-300';
      badgeLabel = 'Regular';
    } else if (rate < 85) {
      badgeClass = 'bg-blue-100 text-blue-800 border-blue-300';
      badgeLabel = 'Boa';
    }

    return {
      member: m,
      totalEvents,
      attendedEvents,
      missedEvents: totalEvents - attendedEvents,
      rate,
      badgeClass,
      badgeLabel,
    };
  });

  // Média Geral do Clube
  const globalClubAttendanceRate =
    memberAttendanceStats.length > 0
      ? Math.round(
          memberAttendanceStats.reduce((acc, curr) => acc + curr.rate, 0) / memberAttendanceStats.length
        )
      : 0;

  // Ranking por Unidade
  const unitStats = availableUnits.map((unitName) => {
    const unitMembers = activeMembers.filter(
      (m) => getMemberTeamLabel(m, state.users) === unitName
    );
    if (unitMembers.length === 0) return { unitName, rate: 0, memberCount: 0 };

    const totalPossibilities = unitMembers.length * state.activities.length;
    if (totalPossibilities === 0) return { unitName, rate: 0, memberCount: unitMembers.length };

    let totalPresents = 0;
    unitMembers.forEach((m) => {
      state.activities.forEach((act) => {
        if (act.attendees?.some((att) => att.memberId === m.id && att.present)) {
          totalPresents++;
        }
      });
    });

    const rate = Math.round((totalPresents / totalPossibilities) * 100);
    return { unitName, rate, memberCount: unitMembers.length };
  }).sort((a, b) => b.rate - a.rate);

  // Membro selecionado para o modal de histórico
  const selectedMemberHistoryData = selectedMemberForHistory
    ? state.members.find((m) => m.id === selectedMemberForHistory)
    : null;

  // Auxiliar para renderizar o Painel Completo da Atividade Selecionada (partilhado entre Lista, Calendário Mensal e Semanal)
  const renderSelectedActivityPanel = () => {
    if (!currentActivity) {
      return (
        <div className="bg-white p-10 rounded-xl border border-slate-200 shadow-xs text-center text-xs text-slate-500">
          Nenhuma atividade encontrada com os filtros atuais.
        </div>
      );
    }

    const todayISO = new Date().toISOString().split('T')[0];
    const timeRangeLabel = getActivityTimeRangeLabel(currentActivity);
    const endDateOnly = getActivityDateOnly(currentActivity.endDate);
    const startDateOnly = getActivityDateOnly(currentActivity.startDate);
    const hasDistinctEndDate = Boolean(endDateOnly && endDateOnly !== startDateOnly);
    const typeStyle = ACTIVITY_TYPE_COLORS[currentActivity.type] || ACTIVITY_TYPE_COLORS.actividade_regular;
    const rsvpSummary = formatRsvpSummary(currentActivity.rsvps);

    const visibleTasks = currentActivity.tasks.filter((task) => {
      if (taskStatusFilter === 'pendentes') return task.status !== 'concluido';
      if (taskStatusFilter === 'concluidas') return task.status === 'concluido';
      return true;
    });

    const priorityStyleMap: Record<ActivityTask['priority'], { label: string; cls: string }> = {
      urgente: { label: 'Urgente', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
      alta: { label: 'Alta', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
      media: { label: 'Média', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
      baixa: { label: 'Baixa', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
    };

    return (
      <div className="space-y-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${typeStyle.badge}`}>
                  {getActivityTypeLabel(currentActivity.type)}
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {currentActivity.department}
                </span>
                <span className="text-[10px] uppercase font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  Fase: {getActivityStageLabel(currentActivity.stage)}
                </span>
                {currentActivity.visibleInMemberPortal ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    <Eye className="w-3 h-3" />
                    <span>Visível no Portal do Membro</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                    <EyeOff className="w-3 h-3" />
                    <span>Uso Interno (Oculto do Portal)</span>
                  </span>
                )}
              </div>

              <h2 className="text-lg font-black text-slate-900">{currentActivity.title}</h2>

              <div className="text-xs text-slate-600 flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-blue-900" />
                  <span>
                    {formatDateAO(currentActivity.startDate)}
                    {hasDistinctEndDate ? ` até ${formatDateAO(currentActivity.endDate)}` : ''}
                  </span>
                </span>
                {timeRangeLabel && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="w-3.5 h-3.5 text-blue-900" />
                      <span>{timeRangeLabel}</span>
                    </span>
                  </>
                )}
                <span className="text-slate-300">·</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{currentActivity.location}</span>
                </span>
              </div>

              {currentActivity.description && (
                <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-3 leading-relaxed mt-2">
                  {currentActivity.description}
                </p>
              )}
            </div>

            <div className="flex flex-col items-start xl:items-end gap-2 shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                {can('activities', 'EDIT') && (
                  <button
                    onClick={() => openEditActivityModal(currentActivity)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
                    title="Editar detalhes desta atividade"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                )}

                {canManagePortalVisibility && (
                  <button
                    onClick={() => {
                      const nextVisible = !currentActivity.visibleInMemberPortal;
                      const res = toggleActivityPortalVisibility(currentActivity.id, nextVisible);
                      if (res.success) {
                        setActivityActionFeedback({
                          type: 'success',
                          message: nextVisible
                            ? 'Atividade autorizada e publicada no Portal do Membro.'
                            : 'Atividade ocultada do Portal do Membro.',
                        });
                        setTimeout(() => setActivityActionFeedback(null), 4000);
                      } else {
                        setActivityActionFeedback({
                          type: 'error',
                          message: res.error || 'Erro ao alterar visibilidade no portal.',
                        });
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                      currentActivity.visibleInMemberPortal
                        ? 'text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border-emerald-300'
                        : 'text-blue-900 bg-blue-50 hover:bg-blue-100 border-blue-300'
                    }`}
                    title="Autorizar ou ocultar visualização desta atividade no Portal do Membro"
                  >
                    {currentActivity.visibleInMemberPortal ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Ocultar do Portal</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Permitir no Portal</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={() => downloadActivityICS(currentActivity)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer"
                  title="Descarregar evento no formato .ics para qualquer calendário"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar .ics</span>
                </button>

                <button
                  onClick={handleSyncToCalendar}
                  disabled={isSyncingCalendar}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  title="Sincronizar esta atividade diretamente com o seu Google Calendar"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{isSyncingCalendar ? 'A sincronizar...' : 'Google Calendar'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {can('activities', 'EDIT') && (
                  <select
                    value={normalizeActivityStage(currentActivity.stage)}
                    onChange={(e) => updateActivityStage(currentActivity.id, e.target.value as ActivityStage)}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-800"
                  >
                    <option value="preparacao">Fase: Preparação</option>
                    <option value="execucao">Fase: Execução</option>
                    <option value="realizado">Fase: Realizado</option>
                  </select>
                )}

                {(can('activities', 'ARCHIVE') ||
                  can('activities', 'EDIT') ||
                  currentUser.role === 'diretor' ||
                  currentUser.role === 'admin_tecnico') && (
                  <button
                    onClick={() => setActivityToDelete(currentActivity)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Eliminar atividade"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {calendarSyncMsg && (
                <span
                  className={`text-[11px] font-medium ${
                    calendarSyncMsg.includes('sucesso') ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {calendarSyncMsg}
                </span>
              )}
            </div>
          </div>

          {/* Aprovação Formal do Diretor */}
          {(currentActivity.requiresDirectorApproval ||
            currentActivity.directorDecisionAt) && (
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                currentActivity.isApprovedByDirector === true
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : currentActivity.isApprovedByDirector === false && currentActivity.directorDecisionAt
                  ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                  : 'bg-amber-50/80 border-amber-200 text-amber-950'
              }`}
            >
              <div className="space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>
                    {currentActivity.isApprovedByDirector === true
                      ? `Atividade Aprovada pelo Diretor${currentActivity.directorDecisionByName ? ` (${currentActivity.directorDecisionByName})` : ''}`
                      : currentActivity.isApprovedByDirector === false && currentActivity.directorDecisionAt
                      ? `Devolvida para Ajustes (${currentActivity.directorDecisionByName || 'Diretor'})`
                      : 'Aguarda Parecer e Aprovação Formal do Diretor'}
                  </span>
                </div>
                {currentActivity.directorDecisionNotes && (
                  <p className="text-[11px] leading-relaxed">
                    <strong>Parecer:</strong> {currentActivity.directorDecisionNotes}
                  </p>
                )}
                {currentActivity.directorDecisionAt && (
                  <p className="text-[10px] opacity-75">
                    Registado em {formatDateAO(currentActivity.directorDecisionAt)}
                  </p>
                )}
              </div>

              {canManagePortalVisibility && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      setApprovalModalState({
                        decision: 'aprovar',
                        notes: currentActivity.directorDecisionNotes || '',
                        error: null,
                      })
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Aprovar Atividade</span>
                  </button>
                  <button
                    onClick={() =>
                      setApprovalModalState({
                        decision: 'devolver',
                        notes: '',
                        error: null,
                      })
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-800 bg-white hover:bg-rose-50 border border-rose-300 rounded-lg cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Devolver com Parecer</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Portal do Membro & Confirmações (RSVP) */}
          {currentActivity.visibleInMemberPortal && (
            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100 pb-2">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-900" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-950">
                    Portal do Membro & Confirmações de Presença (RSVP)
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-bold flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    Vão: {rsvpSummary.vou}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                    Talvez: {rsvpSummary.talvez}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                    Não podem: {rsvpSummary.nao_posso}
                  </span>
                </div>
              </div>

              {!currentActivity.rsvps || currentActivity.rsvps.length === 0 ? (
                <p className="text-[11px] text-slate-600">
                  Esta atividade já está visível para os membros no Portal. Nenhuma confirmação submetida até ao momento.
                </p>
              ) : (
                <div className="max-h-36 overflow-y-auto divide-y divide-blue-100 bg-white border border-blue-100 rounded-lg">
                  {currentActivity.rsvps.map((r) => (
                    <div key={r.memberId} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-900">{r.memberName}</span>
                        {r.note && (
                          <span className="block text-[10px] text-slate-500 truncate">{r.note}</span>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                          r.status === 'vou'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.status === 'talvez'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {r.status === 'vou' ? 'Vou' : r.status === 'talvez' ? 'Talvez' : 'Não Posso'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Custos da Atividade & Tramitação na Tesouraria */}
          {(() => {
            const linkedExp = state.expenses.find(
              (e) => e.activityId === currentActivity.id || e.id === currentActivity.expenseRequestId
            );
            if (
              !shouldShowActivityCostsSection(
                currentActivity,
                Boolean(linkedExp),
                currentUser.role,
                state.settings.permissionsMatrix
              )
            ) {
              return null;
            }
            return (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-blue-900" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      Custos da Atividade & Tramitação na Tesouraria
                    </h3>
                  </div>
                  {linkedExp ? (
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        linkedExp.status === 'pago'
                          ? 'bg-emerald-100 text-emerald-800'
                          : linkedExp.status === 'aprovado'
                          ? 'bg-blue-100 text-blue-800'
                          : linkedExp.status === 'rejeitado'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {linkedExp.status === 'pago' && 'Liquidado / Total Pago pela Tesouraria'}
                      {linkedExp.status === 'aprovado' && 'Custo Aprovado pela Tesouraria'}
                      {linkedExp.status === 'solicitado' && 'Solicitação Pendente na Tesouraria'}
                      {linkedExp.status === 'rejeitado' && 'Não Aprovado pela Tesouraria'}
                    </span>
                  ) : currentActivity.costEstimatedInCents > 0 ? (
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-semibold">
                      Sem Solicitação na Tesouraria
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Atividade sem custo estimado</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-medium block">Custo Estimado:</span>
                    <p className="text-sm font-black text-slate-900 mt-1">{formatKz(currentActivity.costEstimatedInCents)}</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-blue-200">
                    <span className="text-blue-700 font-medium block">Custo Aprovado:</span>
                    <p className="text-sm font-black text-blue-900 mt-1">{formatKz(currentActivity.costApprovedInCents)}</p>
                    {linkedExp?.approvedByName && (
                      <span className="text-[10px] text-slate-500 block mt-1">Aprovado por: {linkedExp.approvedByName}</span>
                    )}
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-emerald-200">
                    <span className="text-emerald-700 font-medium block">Total Pago:</span>
                    <p className="text-sm font-black text-emerald-800 mt-1">{formatKz(currentActivity.costPaidInCents)}</p>
                    {linkedExp?.paidAt && (
                      <span className="text-[10px] text-slate-500 block mt-1">Liquidado a: {formatDateAO(linkedExp.paidAt)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Contribuições e Doações da Atividade */}
          {(() => {
            const activityReceipts = state.receipts.filter(
              (r) =>
                !r.isCancelled &&
                (r.activityId === currentActivity.id ||
                  (currentActivity.feeDefinitionId && r.feeDefinitionId === currentActivity.feeDefinitionId))
            );
            if (
              !shouldShowActivityContributionsSection(
                currentActivity,
                activityReceipts.length,
                currentUser.role,
                state.settings.permissionsMatrix
              )
            ) {
              return null;
            }
            const totalArrecadado = activityReceipts.reduce((sum, r) => sum + r.amountPaidInCents, 0);

            return (
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200 pb-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-800" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                      Contribuições e Doações da Atividade
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-900 bg-emerald-100 px-3 py-1 rounded-lg">
                      Total Arrecadado: {formatKz(totalArrecadado)}
                    </span>
                    {(can('treasury', 'CREATE') || can('activities', 'EDIT')) && (
                      <button
                        onClick={() => setIsContributionModalOpen(true)}
                        className="px-3 py-1 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                      >
                        + Registar Contribuição/Doação
                      </button>
                    )}
                  </div>
                </div>

                {activityReceipts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    Nenhuma contribuição ou doação registada para esta atividade ainda.
                  </div>
                ) : (
                  <div className="divide-y divide-emerald-100 border border-emerald-200 rounded-lg overflow-hidden bg-white">
                    <div className="px-3 py-2 bg-emerald-100/60 text-[11px] font-bold text-emerald-900 grid grid-cols-12 gap-2">
                      <span className="col-span-4">Contribuinte / Doador</span>
                      <span className="col-span-3">Valor</span>
                      <span className="col-span-3">Método / Recibo</span>
                      <span className="col-span-2 text-right">Data</span>
                    </div>
                    {activityReceipts.map((rec) => (
                      <div key={rec.id} className="px-3 py-2.5 text-xs grid grid-cols-12 gap-2 items-center hover:bg-slate-50">
                        <div className="col-span-4 font-semibold text-slate-900 truncate">
                          {rec.memberName}
                          {rec.notes && <span className="block text-[10px] text-slate-500 font-normal truncate">{rec.notes}</span>}
                        </div>
                        <div className="col-span-3 font-mono font-bold text-emerald-800">
                          {formatKz(rec.amountPaidInCents)}
                        </div>
                        <div className="col-span-3 text-slate-600">
                          <span className="capitalize">{rec.paymentMethod.replace('_', ' ')}</span>
                          <span className="block text-[10px] font-mono text-blue-800">{rec.receiptNumber}</span>
                        </div>
                        <div className="col-span-2 text-right text-[11px] text-slate-500 font-mono">
                          {formatDateAO(rec.paidAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Bloco de Tarefas Operacionais */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-blue-900" />
                <span>Tarefas Operacionais ({currentActivity.tasks.length})</span>
              </h3>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-[11px] font-semibold">
                  {(
                    [
                      { id: 'todas', label: 'Todas' },
                      { id: 'pendentes', label: 'Pendentes' },
                      { id: 'concluidas', label: 'Concluídas' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTaskStatusFilter(opt.id)}
                      className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                        taskStatusFilter === opt.id
                          ? 'bg-white text-blue-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {can('activities', 'EDIT') && (
                  <button
                    onClick={openCreateTaskModal}
                    className="text-xs text-blue-900 hover:underline font-semibold cursor-pointer"
                  >
                    + Adicionar Tarefa
                  </button>
                )}
              </div>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {visibleTasks.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  {currentActivity.tasks.length === 0
                    ? 'Nenhuma tarefa atribuída.'
                    : 'Nenhuma tarefa neste filtro.'}
                </div>
              ) : (
                visibleTasks.map((task) => {
                  const isOverdue = task.status !== 'concluido' && Boolean(task.dueDate) && task.dueDate < todayISO;
                  const pStyle = priorityStyleMap[task.priority] || priorityStyleMap.media;
                  return (
                    <div key={task.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className={`font-semibold ${
                              task.status === 'concluido' ? 'line-through text-slate-400' : 'text-slate-900'
                            }`}
                          >
                            {task.title}
                          </p>
                          <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${pStyle.cls}`}>
                            {pStyle.label}
                          </span>
                          {isOverdue && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-rose-100 text-rose-800 border border-rose-200">
                              Em Atraso
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Responsável: <strong>{task.assigneeName}</strong> · Prazo: {formatDateAO(task.dueDate)}
                        </p>
                      </div>

                      {can('activities', 'EDIT') && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() =>
                              updateTaskStatus(
                                currentActivity.id,
                                task.id,
                                task.status === 'concluido' ? 'em_progresso' : 'concluido'
                              )
                            }
                            className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded cursor-pointer ${
                              task.status === 'concluido'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {task.status === 'concluido' ? 'Concluída' : 'Marcar Feita'}
                          </button>
                          <button
                            onClick={() => openEditTaskModal(task)}
                            className="p-1.5 text-slate-400 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                            title="Editar tarefa"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setTaskToDelete(task)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="Eliminar tarefa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Bloco de Presenças sem Duplicados */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-900" />
                <span>Chamada Rápida de Presenças (Anti-Duplicação)</span>
              </h3>
              {canViewAttendanceTab && (
                <button
                  onClick={() => {
                    setMainTab('presencas');
                    setAttendanceSelectedActivityId(currentActivity.id);
                    setAttendanceSubTab('chamada');
                  }}
                  className="text-xs font-bold text-blue-900 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Abrir Sub-módulo Completo de Chamada</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {state.members
                .filter((m) => m.status === 'ativo')
                .map((m) => {
                  const record = currentActivity.attendees.find((att) => att.memberId === m.id);
                  const isPresent = record?.present || false;

                  return (
                    <div key={m.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div>
                        <span className="font-semibold text-slate-900">{m.fullName}</span>
                        <span className="text-slate-500 text-[10px] ml-2 font-mono">({m.manualNumber})</span>
                      </div>

                      {can('activities', 'EDIT') ? (
                        <button
                          onClick={() => toggleAttendance(currentActivity.id, m.id, !isPresent)}
                          className={`px-3 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                            isPresent ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {isPresent ? 'Presente' : 'Ausente'}
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-700">
                          {isPresent ? 'Presente' : 'Ausente'}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Bloco de Ata Estruturada (exclusivo para Reunião da Comissão) */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs font-bold text-slate-900">Ata Oficial da Reunião</h3>
                {currentActivity.minute && (
                  <>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                        currentActivity.minute.status === 'rascunho'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {currentActivity.minute.status === 'rascunho' ? 'Rascunho' : 'Aprovada em Sessão'}
                    </span>
                    {currentActivity.minute.quorumMet !== undefined && (
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                          currentActivity.minute.quorumMet
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {currentActivity.minute.quorumMet ? 'Quórum Verificado' : 'Sem Quórum'}
                      </span>
                    )}
                  </>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {!canActivityHaveMinute(currentActivity.type)
                  ? 'Atas só podem ser redigidas quando o tipo de atividade for "Reunião da Comissão".'
                  : currentActivity.minute
                  ? `Ata numerada: ${currentActivity.minute.minuteNumber} · Presidente: ${currentActivity.minute.chairPerson} · Secretário(a): ${currentActivity.minute.secretary}`
                  : 'Nenhuma ata redigida para esta reunião da comissão.'}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {currentActivity.minute && (
                <button
                  onClick={() => {
                    const existingMinuteDoc = state.documents.find(
                      (d) => d.documentNumber === currentActivity.minute!.minuteNumber
                    );
                    setPrintedDoc(
                      existingMinuteDoc || {
                        id: currentActivity.minute!.id,
                        documentNumber: currentActivity.minute!.minuteNumber,
                        documentType: 'ata',
                        title: `Ata da Reunião - ${currentActivity.title}`,
                        year: state.settings.currentYear,
                        issuedByUserId: currentUser.id,
                        issuedByName: currentUser.name,
                        issuedByRole: currentUser.role,
                        issuedAt: currentActivity.minute!.date,
                        contentData: {
                          chairPerson: currentActivity.minute!.chairPerson,
                          secretary: currentActivity.minute!.secretary,
                          local: currentActivity.minute!.location,
                          presentes: currentActivity.minute!.attendeesCount,
                          quorumMet: currentActivity.minute!.quorumMet,
                          minuteStatus: currentActivity.minute!.status,
                          agenda: currentActivity.minute!.agenda,
                          deliberacao: currentActivity.minute!.deliberations,
                          deliberations: currentActivity.minute!.deliberations,
                          observations: currentActivity.minute!.observations,
                        },
                        isCancelled: false,
                      }
                    );
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Ata</span>
                </button>
              )}

              {can('activities', 'CREATE') && canActivityHaveMinute(currentActivity.type) && (
                <button
                  onClick={openMinuteModal}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded shadow-xs cursor-pointer"
                >
                  {currentActivity.minute ? 'Editar Ata' : 'Redigir Ata'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Topo do Módulo com Título & Navegação de Abas Principal */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-900" />
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Gestão de Atividades, Reuniões & Presenças
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Planeamento de eventos, calendário mensal, atas da comissão, tarefas e controlo do Portal do Membro.
            </p>
          </div>

          {can('activities', 'CREATE') && (
            <button
              onClick={openCreateActivityModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agendar Nova Atividade</span>
            </button>
          )}
        </div>

        {activityActionFeedback && (
          <div
            className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-between ${
              activityActionFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <span>{activityActionFeedback.message}</span>
            <button
              type="button"
              onClick={() => setActivityActionFeedback(null)}
              className="font-bold ml-3 text-sm cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* Abas Principais do Módulo */}
        <div className="flex border-b border-slate-200 gap-2 pt-2">
          <button
            onClick={() => setMainTab('atividades')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              mainTab === 'atividades'
                ? 'border-blue-900 text-blue-900 bg-blue-50/50 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Calendário & Atividades ({state.activities.length})</span>
          </button>

          {canViewAttendanceTab && (
            <button
              onClick={() => setMainTab('presencas')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                mainTab === 'presencas'
                  ? 'border-blue-900 text-blue-900 bg-blue-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Sub-módulo de Presenças & Frequência</span>
              <span className="ml-1 px-2 py-0.5 text-[10px] bg-blue-100 text-blue-900 rounded-full font-bold">
                {globalClubAttendanceRate}% Média
              </span>
            </button>
          )}
        </div>
      </div>

      {/* CONTEÚDO DA ABA 1: CALENDÁRIO & ATIVIDADES */}
      {mainTab === 'atividades' && (
        <div className="space-y-4">
          {/* Barra de Vistas & Filtros */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg self-start">
              <button
                type="button"
                onClick={() => setCalendarViewMode('lista')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  calendarViewMode === 'lista'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Lista & Detalhe</span>
              </button>
              <button
                type="button"
                onClick={() => setCalendarViewMode('mensal')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  calendarViewMode === 'mensal'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Calendário Mensal</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 flex-1 lg:justify-end">
              <div className="relative min-w-[180px] flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Pesquisar título, local, depto..."
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <select
                value={activityTypeFilter}
                onChange={(e) => setActivityTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                <option value="todos">Todos os Tipos</option>
                <option value="actividade_regular">Actividade Regular</option>
                <option value="modulos_medalhas">Módulos e Medalhas (para estudo de Módulos e Medalhas)</option>
                <option value="acampamento">Acampamento</option>
                <option value="actividades_espirituais">Actividades Espirituais</option>
                <option value="actividades_sociais">Actividades Sociais</option>
                <option value="actividades_recreativa">Actividades Recreativa</option>
                <option value="programa_sabado">Programa de Sábado</option>
                <option value="reuniao_comissao">Reunião da Comissão</option>
              </select>

              <select
                value={activityStageFilter}
                onChange={(e) => setActivityStageFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                <option value="todas">Todas as Fases</option>
                <option value="preparacao">Preparação</option>
                <option value="execucao">Execução</option>
                <option value="realizado">Realizado</option>
              </select>

              {calendarViewMode === 'lista' && (
                <select
                  value={activityMonthFilter}
                  onChange={(e) => setActivityMonthFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-800"
                >
                  <option value="todos">Todos os Meses</option>
                  {availableActivityMonths.map((ym) => {
                    const [y, m] = ym.split('-').map(Number);
                    return (
                      <option key={ym} value={ym}>
                        {getMonthNamePT(m)} {y}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          </div>

          {/* VISTA MENSAL */}
          {calendarViewMode === 'mensal' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900">
                    {getMonthNamePT(calendarCursorDate.getMonth() + 1)} de {calendarCursorDate.getFullYear()}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarCursorDate(
                          new Date(calendarCursorDate.getFullYear(), calendarCursorDate.getMonth() - 1, 1)
                        )
                      }
                      className="p-1.5 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
                      title="Mês anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarCursorDate(new Date())}
                      className="px-3 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
                    >
                      Hoje
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCalendarCursorDate(
                          new Date(calendarCursorDate.getFullYear(), calendarCursorDate.getMonth() + 1, 1)
                        )
                      }
                      className="p-1.5 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
                      title="Próximo mês"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-200 text-center text-[11px] font-bold text-slate-600 uppercase">
                  {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((wd) => (
                    <div key={wd} className="py-2">
                      {wd}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
                  {calendarMonthDays.map((cell) => {
                    const dayActs = filteredActivities.filter((a) => doesActivityOccurOnDate(a, cell.iso));
                    return (
                      <div
                        key={cell.iso}
                        className={`min-h-[96px] p-1.5 space-y-1 ${
                          cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/70'
                        } ${cell.isToday ? 'ring-2 ring-inset ring-blue-600' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                              cell.isToday
                                ? 'bg-blue-900 text-white'
                                : cell.isCurrentMonth
                                ? 'text-slate-800'
                                : 'text-slate-400'
                            }`}
                          >
                            {cell.dayNumber}
                          </span>
                          {dayActs.length > 0 && (
                            <span className="text-[9px] font-bold text-slate-400">{dayActs.length}</span>
                          )}
                        </div>

                        <div className="space-y-1">
                          {dayActs.slice(0, 3).map((act) => {
                            const pillCls = (ACTIVITY_TYPE_COLORS[act.type] || ACTIVITY_TYPE_COLORS.actividade_regular).pill;
                            const isSelected = currentActivity?.id === act.id;
                            return (
                              <button
                                key={act.id}
                                type="button"
                                onClick={() => setSelectedActivity(act)}
                                className={`w-full text-left px-1.5 py-1 rounded border text-[10px] font-bold truncate cursor-pointer flex items-center justify-between gap-1 ${pillCls} ${
                                  isSelected ? 'ring-2 ring-blue-900' : ''
                                }`}
                                title={act.title}
                              >
                                <span className="truncate">{act.title}</span>
                                {act.visibleInMemberPortal && <Eye className="w-2.5 h-2.5 shrink-0" />}
                              </button>
                            );
                          })}
                          {dayActs.length > 3 && (
                            <span className="block text-[9px] font-semibold text-slate-500 pl-1">
                              +{dayActs.length - 3} mais
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {renderSelectedActivityPanel()}
            </div>
          )}

          {/* VISTA LISTA & DETALHE */}
          {calendarViewMode === 'lista' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Coluna da Esquerda: Lista de Atividades Filtradas */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden h-fit">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Atividades ({filteredActivities.length})
                  </h3>
                </div>

                <div className="divide-y divide-slate-100 max-h-[650px] overflow-y-auto">
                  {filteredActivities.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      Nenhuma atividade corresponde aos filtros selecionados.
                    </div>
                  ) : (
                    filteredActivities.map((act) => {
                      const typeStyle = ACTIVITY_TYPE_COLORS[act.type] || ACTIVITY_TYPE_COLORS.actividade_regular;
                      return (
                        <button
                          key={act.id}
                          onClick={() => setSelectedActivity(act)}
                          className={`w-full text-left p-4 transition-colors flex items-start justify-between cursor-pointer border-l-4 ${
                            currentActivity?.id === act.id
                              ? 'bg-blue-50/70 border-l-blue-900'
                              : `${typeStyle.border} hover:bg-slate-50`
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs font-bold text-slate-900 truncate">{act.title}</h4>
                              {act.visibleInMemberPortal && (
                                <span title="Visível no Portal do Membro" className="inline-flex shrink-0">
                                  <Eye className="w-3 h-3 text-emerald-700" />
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                              <span>{formatDateAO(act.startDate)}</span>
                              <span>·</span>
                              <span>{getActivityStageLabel(act.stage)}</span>
                              {canViewActivityFinancials && act.costEstimatedInCents > 0 && (
                                <span className="font-mono text-slate-600 font-medium">
                                  · Est: {formatKz(act.costEstimatedInCents)}
                                </span>
                              )}
                              {canViewActivityFinancials && act.costApprovedInCents > 0 && (
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-900 rounded font-semibold text-[10px]">
                                  Aprovado: {formatKz(act.costApprovedInCents)}
                                </span>
                              )}
                              {canViewActivityFinancials && act.costPaidInCents > 0 && (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-900 rounded font-semibold text-[10px]">
                                  Pago: {formatKz(act.costPaidInCents)}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Coluna da Direita: Painel Completo da Atividade Selecionada */}
              <div className="lg:col-span-2">{renderSelectedActivityPanel()}</div>
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: SUB-MÓDULO DE PRESENÇAS & FREQUÊNCIA */}
      {mainTab === 'presencas' && canViewAttendanceTab && (
        <div className="space-y-6">
          {/* Sub-Navegação de Presenças */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex gap-2">
              <button
                onClick={() => setAttendanceSubTab('chamada')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                  attendanceSubTab === 'chamada'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Registo de Chamada por Evento</span>
              </button>

              <button
                onClick={() => setAttendanceSubTab('historico')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                  attendanceSubTab === 'historico'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Histórico & Estatísticas Globais de Participação</span>
              </button>
            </div>

            {attendanceSubTab === 'chamada' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Selecionar Atividade:</span>
                <select
                  value={attendanceSelectedActivityId}
                  onChange={(e) => setAttendanceSelectedActivityId(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg bg-white text-slate-900 max-w-xs truncate focus:ring-2 focus:ring-blue-900"
                >
                  {state.activities.map((act) => (
                    <option key={act.id} value={act.id}>
                      {act.title} ({formatDateAO(act.startDate)})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* VISTA 1: REGISTO DE CHAMADA POR ATIVIDADE */}
          {attendanceSubTab === 'chamada' && attendanceActivity && (
            <div className="space-y-6">
              {/* Header da Atividade Selecionada & Barra de Progresso */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-900 tracking-wider">
                      {attendanceActivity.department} · {getActivityTypeLabel(attendanceActivity.type)}
                    </span>
                    <h2 className="text-lg font-black text-slate-900 mt-0.5">
                      {attendanceActivity.title}
                    </h2>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {formatDateAO(attendanceActivity.startDate)}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {attendanceActivity.location}
                      </span>
                    </div>
                  </div>

                  {/* Cartões de Indicadores da Chamada */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-bold uppercase text-slate-500 block">Elegíveis</span>
                      <span className="text-lg font-black text-slate-900">{attendanceTotalCount}</span>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <span className="text-[10px] font-bold uppercase text-emerald-800 block">Presentes</span>
                      <span className="text-lg font-black text-emerald-800">{attendancePresentCount}</span>
                    </div>
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                      <span className="text-[10px] font-bold uppercase text-rose-800 block">Ausentes</span>
                      <span className="text-lg font-black text-rose-800">{attendanceAbsentCount}</span>
                    </div>
                  </div>
                </div>

                {/* Barra de Progresso da Assiduidade do Evento */}
                <div>
                  <div className="flex justify-between items-center text-xs mb-1.5 font-bold">
                    <span className="text-slate-700">Taxa de Presença do Evento</span>
                    <span className="text-blue-900 font-mono text-sm">{attendanceRate}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className={`h-full transition-all duration-500 ${
                        attendanceRate >= 80 ? 'bg-emerald-600' : attendanceRate >= 50 ? 'bg-amber-500' : 'bg-rose-600'
                      }`}
                      style={{ width: `${attendanceRate}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Barra de Filtros, Pesquisa e Ações em Lote */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  {/* Pesquisa por Nome ou Número */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Pesquisar por nome ou nº de membro..."
                      value={attendanceSearchTerm}
                      onChange={(e) => setAttendanceSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-900"
                    />
                  </div>

                  {/* Filtro de Unidade / Equipa */}
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={attendanceUnitFilter}
                      onChange={(e) => setAttendanceUnitFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-800"
                    >
                      <option value="todas">Todas as Equipas</option>
                      {availableUnits.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro de Estado */}
                  <select
                    value={attendanceStatusFilter}
                    onChange={(e) => setAttendanceStatusFilter(e.target.value as any)}
                    className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-800"
                  >
                    <option value="todos">Todos os Estados</option>
                    <option value="presentes">Apenas Presentes</option>
                    <option value="ausentes">Apenas Ausentes</option>
                  </select>
                </div>

                {/* Botões de Ações em Lote */}
                {can('activities', 'EDIT') && (
                  <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                    <button
                      onClick={() => handleBatchAttendance(true)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors cursor-pointer"
                      title="Marcar presenças para todos os membros visíveis no filtro atual"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Marcar Todos Presentes</span>
                    </button>

                    <button
                      onClick={() => handleBatchAttendance(false)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg shadow-xs transition-colors cursor-pointer"
                      title="Marcar faltas para todos os membros visíveis no filtro atual"
                    >
                      <UserX className="w-3.5 h-3.5 text-slate-500" />
                      <span>Marcar Todos Ausentes</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Grelha / Lista de Membros para Chamada */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden divide-y divide-slate-100">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 flex justify-between items-center">
                  <span>Membros Ativos ({filteredAttendanceMembers.length})</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Clique para alternar o estatuto de presença em tempo real
                  </span>
                </div>

                {filteredAttendanceMembers.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Nenhum membro encontrado com os filtros selecionados.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredAttendanceMembers.map((m) => {
                      const record = attendanceActivity.attendees?.find((att) => att.memberId === m.id);
                      const isPresent = record?.present || false;

                      return (
                        <div
                          key={m.id}
                          className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                            isPresent ? 'bg-emerald-50/30' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shadow-xs ${
                                isPresent ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {m.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-slate-900">{m.fullName}</h4>
                                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                                  {m.manualNumber}
                                </span>
                              </div>

                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                                <span className="capitalize text-blue-900 font-semibold">{m.category}</span>
                                <span>·</span>
                                <span>Equipa: {getMemberTeamLabel(m, state.users)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setSelectedMemberForHistory(m.id)}
                              className="px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors flex items-center gap-1 cursor-pointer"
                              title="Ver histórico acumulado deste membro"
                            >
                              <History className="w-3.5 h-3.5" />
                              <span>Histórico</span>
                            </button>

                            {can('activities', 'EDIT') ? (
                              <button
                                onClick={() => toggleAttendance(attendanceActivity.id, m.id, !isPresent)}
                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                                  isPresent
                                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                                }`}
                              >
                                {isPresent ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 text-white" />
                                    <span>[ ✓ Presente ]</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-4 h-4 text-slate-400" />
                                    <span>[ ✗ Ausente ]</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <span
                                className={`px-3 py-1 rounded text-xs font-bold ${
                                  isPresent ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {isPresent ? 'Presente' : 'Ausente'}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VISTA 2: HISTÓRICO & ESTATÍSTICAS GLOBAIS DE PARTICIPAÇÃO */}
          {attendanceSubTab === 'historico' && (
            <div className="space-y-6">
              {/* Indicadores Globais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Média Geral do Clube</span>
                    <h3 className="text-2xl font-black text-blue-900 mt-1">{globalClubAttendanceRate}%</h3>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Em todos os eventos realizados</span>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 text-blue-900 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total de Eventos</span>
                    <h3 className="text-2xl font-black text-slate-900 mt-1">{state.activities.length}</h3>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">Registados no calendário</span>
                  </div>
                  <div className="w-12 h-12 bg-slate-50 text-slate-700 rounded-xl flex items-center justify-center">
                    <Calendar className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Equipa Líder</span>
                    <h3 className="text-lg font-black text-emerald-800 mt-1 truncate max-w-[140px]">
                      {unitStats[0]?.unitName || 'N/A'}
                    </h3>
                    <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">
                      {unitStats[0] ? `${unitStats[0].rate}% Assiduidade` : ''}
                    </span>
                  </div>
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-800 rounded-xl flex items-center justify-center">
                    <Award className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Alertas de Assiduidade</span>
                    <h3 className="text-2xl font-black text-rose-800 mt-1">
                      {memberAttendanceStats.filter((m) => m.rate < 50).length}
                    </h3>
                    <span className="text-[10px] text-rose-600 font-medium mt-0.5 block">Membros abaixo de 50%</span>
                  </div>
                  <div className="w-12 h-12 bg-rose-50 text-rose-800 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Ranking por Equipas / Unidades */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <Award className="w-4 h-4 text-blue-900" />
                  <span>Ranking de Assiduidade por Equipas / Unidades</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {unitStats.map((u, idx) => (
                    <div
                      key={u.unitName}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center text-[10px]">
                            #{idx + 1}
                          </span>
                          {u.unitName}
                        </span>
                        <span className="text-sm font-black text-blue-900 font-mono">{u.rate}%</span>
                      </div>

                      <p className="text-[11px] text-slate-500">{u.memberCount} Membro(s) Ativo(s)</p>

                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-900 h-full rounded-full transition-all duration-500"
                          style={{ width: `${u.rate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabela Geral de Participação dos Membros */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-3 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-900" />
                    <span>Relatório de Frequência Individual dos Membros</span>
                  </h3>

                  <div className="relative min-w-[240px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filtrar por nome ou número..."
                      value={attendanceSearchTerm}
                      onChange={(e) => setAttendanceSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                        <th className="p-3">Membro</th>
                        <th className="p-3">Equipa</th>
                        <th className="p-3">Categoria</th>
                        <th className="p-3 text-center">Presenças / Eventos</th>
                        <th className="p-3 text-center">Taxa (%)</th>
                        <th className="p-3 text-center">Estatuto</th>
                        <th className="p-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {memberAttendanceStats
                        .filter(
                          (item) =>
                            !attendanceSearchTerm ||
                            item.member.fullName.toLowerCase().includes(attendanceSearchTerm.toLowerCase()) ||
                            item.member.manualNumber.toLowerCase().includes(attendanceSearchTerm.toLowerCase())
                        )
                        .map((item) => (
                          <tr key={item.member.id} className="hover:bg-slate-50">
                            <td className="p-3 font-semibold text-slate-900">
                              {item.member.fullName}
                              <span className="text-[10px] text-slate-500 font-mono block">
                                {item.member.manualNumber}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600">{getMemberTeamLabel(item.member, state.users)}</td>
                            <td className="p-3 capitalize text-blue-900 font-medium">{item.member.category}</td>
                            <td className="p-3 text-center font-mono font-semibold text-slate-800">
                              {item.attendedEvents} / {item.totalEvents}
                            </td>
                            <td className="p-3 text-center font-mono font-black text-blue-900 text-sm">
                              {item.rate}%
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${item.badgeClass}`}
                              >
                                {item.badgeLabel}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => setSelectedMemberForHistory(item.member.id)}
                                className="px-3 py-1 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                              >
                                Ver Histórico
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE HISTÓRICO INDIVIDUAL DE PRESENÇAS DE UM MEMBRO */}
      {selectedMemberHistoryData && (
        <Modal
          isOpen={Boolean(selectedMemberForHistory)}
          onClose={() => setSelectedMemberForHistory(null)}
          title={`Histórico de Presenças: ${selectedMemberHistoryData.fullName}`}
          description={`Estatuto oficial de assiduidade em todas as reuniões e eventos agendados.`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            {(() => {
              const totalEvents = state.activities.length;
              const attendedEvents = state.activities.filter((act) =>
                act.attendees?.some((att) => att.memberId === selectedMemberHistoryData.id && att.present)
              ).length;
              const missedEvents = totalEvents - attendedEvents;
              const rate = totalEvents > 0 ? Math.round((attendedEvents / totalEvents) * 100) : 0;

              return (
                <div className="space-y-4">
                  {/* Resumo no Modal */}
                  <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block uppercase">Total Atividades</span>
                      <span className="text-base font-black text-slate-900">{totalEvents}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-800 font-bold block uppercase">Presenças (✓)</span>
                      <span className="text-base font-black text-emerald-800">{attendedEvents}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-rose-800 font-bold block uppercase">Faltas (✗)</span>
                      <span className="text-base font-black text-rose-800">{missedEvents}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="font-bold text-blue-900">Taxa Geral de Assiduidade:</span>
                    <span className="text-lg font-black text-blue-900 font-mono">{rate}%</span>
                  </div>

                  {/* Lista detalhada de atividades */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider">
                      Detalhamento por Atividade
                    </h4>

                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                      {state.activities.map((act) => {
                        const attRecord = act.attendees?.find((att) => att.memberId === selectedMemberHistoryData.id);
                        const isPresent = attRecord?.present || false;

                        return (
                          <div key={act.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                            <div>
                              <p className="font-bold text-slate-900">{act.title}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {formatDateAO(act.startDate)} · {act.location}
                              </p>
                            </div>

                            <span
                              className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                                isPresent
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isPresent ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Presente</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Ausente</span>
                                </>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedMemberForHistory(null)}
                className="px-4 py-2 font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 1: Nova Atividade / Editar Atividade */}
      <Modal
        isOpen={isNewActivityOpen}
        onClose={() => {
          setIsNewActivityOpen(false);
          setEditingActivityId(null);
        }}
        title={editingActivityId ? 'Editar Atividade / Reunião' : 'Agendar Nova Atividade / Reunião'}
        description={
          editingActivityId
            ? 'Atualize os detalhes, horários, departamento e definições do evento.'
            : 'Defina os parâmetros do evento para o calendário oficial do clube.'
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSaveActivity} className="space-y-4 text-xs">
          {activityError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-between">
              <span>{activityError}</span>
              <button
                type="button"
                onClick={() => setActivityError(null)}
                className="text-rose-500 hover:text-rose-800 font-bold ml-2 text-sm"
              >
                ×
              </button>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Título da Atividade</label>
            <input
              type="text"
              placeholder="Ex: Instrução de Pioneiria no Parque da Cidade"
              value={activityForm.title}
              onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Tipo de Evento</label>
            <select
              value={activityForm.type}
              onChange={(e) =>
                setActivityForm({ ...activityForm, type: e.target.value as ClubActivity['type'] })
              }
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900 bg-white"
            >
              <option value="actividade_regular">Actividade Regular</option>
              <option value="modulos_medalhas">Módulos e Medalhas (para estudo de Módulos e Medalhas)</option>
              <option value="acampamento">Acampamento</option>
              <option value="actividades_espirituais">Actividades Espirituais</option>
              <option value="actividades_sociais">Actividades Sociais</option>
              <option value="actividades_recreativa">Actividades Recreativa</option>
              <option value="programa_sabado">Programa de Sábado</option>
              <option value="reuniao_comissao">Reunião da Comissão</option>
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Data de Início</label>
              <input
                type="date"
                value={activityForm.startDate}
                onChange={(e) => setActivityForm({ ...activityForm, startDate: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Data de Término (Opc.)</label>
              <input
                type="date"
                min={activityForm.startDate}
                value={activityForm.endDate}
                onChange={(e) => setActivityForm({ ...activityForm, endDate: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Hora de Início</label>
              <input
                type="time"
                value={activityForm.startTime}
                onChange={(e) => setActivityForm({ ...activityForm, startTime: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Hora de Término</label>
              <input
                type="time"
                value={activityForm.endTime}
                onChange={(e) => setActivityForm({ ...activityForm, endTime: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Local da atividade</label>
            <input
              type="text"
              placeholder="Escreva o local do evento..."
              value={activityForm.location}
              onChange={(e) => setActivityForm({ ...activityForm, location: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Descrição / Notas Públicas do Evento (Opcional)</label>
            <textarea
              rows={2}
              placeholder="Objetivos, material necessário para os membros, uniforme recomendado..."
              value={activityForm.description}
              onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
            />
          </div>

          {/* Visibilidade no Portal do Membro */}
          {canManagePortalVisibility && (
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activityForm.visibleInMemberPortal}
                  onChange={(e) =>
                    setActivityForm({ ...activityForm, visibleInMemberPortal: e.target.checked })
                  }
                  className="rounded text-blue-900 mt-0.5"
                />
                <div>
                  <span className="text-slate-900 font-bold block">
                    Permitir visualização desta atividade no Portal do Membro
                  </span>
                  <span className="text-[11px] text-slate-600 block">
                    Os membros poderão consultar data, local, confirmar presença (RSVP) e exportar para o seu calendário (orçamentos e atas internas nunca são exibidos).
                  </span>
                </div>
              </label>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="hasCostCheckbox"
                checked={activityForm.hasCost}
                onChange={(e) => setActivityForm({ ...activityForm, hasCost: e.target.checked })}
                className="rounded text-blue-900"
              />
              <label htmlFor="hasCostCheckbox" className="text-slate-800 font-semibold cursor-pointer">
                Requer orçamento / custo operacional da Tesouraria?
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              O montante será tramitado para a Tesouraria como pedido de despesa operacional (não cobra aos membros).
            </p>

            {activityForm.hasCost && (
              <div className="pt-2">
                <label className="block text-slate-700 font-semibold mb-1">
                  Custo Estimado a Solicitar à Tesouraria (Kz)
                </label>
                <input
                  type="number"
                  placeholder="Ex: 15000"
                  value={activityForm.costEstimatedStr}
                  onChange={(e) => setActivityForm({ ...activityForm, costEstimatedStr: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900 bg-white"
                  required={activityForm.hasCost}
                />
              </div>
            )}
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="hasMemberContributionCheckbox"
                checked={activityForm.hasMemberContribution}
                onChange={(e) =>
                  setActivityForm({
                    ...activityForm,
                    hasMemberContribution: e.target.checked,
                    contributionTitle:
                      activityForm.contributionTitle ||
                      (activityForm.title ? `Contribuição: ${activityForm.title}` : ''),
                  })
                }
                className="rounded text-blue-900"
              />
              <label htmlFor="hasMemberContributionCheckbox" className="text-slate-900 font-bold text-xs cursor-pointer">
                Criar rubrica de contribuição/inscrição para os membros?
              </label>
            </div>
            <p className="text-[11px] text-slate-600">
              Cria automaticamente uma rubrica oficial para que os membros possam efetuar o pagamento e anexar o comprovativo no Portal do Membro.
            </p>

            {activityForm.hasMemberContribution && (
              <div className="space-y-3 pt-2 border-t border-blue-100">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Nome da Rubrica / Contribuição</label>
                  <input
                    type="text"
                    placeholder={`Ex: Inscrição Acampamento ou Contribuição: ${activityForm.title || 'Atividade'}`}
                    value={activityForm.contributionTitle}
                    onChange={(e) => setActivityForm({ ...activityForm, contributionTitle: e.target.value })}
                    className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900 bg-white"
                    required={activityForm.hasMemberContribution}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Valor por Membro (Kz)</label>
                    <input
                      type="number"
                      placeholder="Ex: 2500"
                      value={activityForm.contributionAmountStr}
                      onChange={(e) => setActivityForm({ ...activityForm, contributionAmountStr: e.target.value })}
                      className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900 bg-white"
                      required={activityForm.hasMemberContribution}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Membros Elegíveis</label>
                    <select
                      value={activityForm.contributionTargetCategory}
                      onChange={(e) =>
                        setActivityForm({ ...activityForm, contributionTargetCategory: e.target.value as any })
                      }
                      className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900 bg-white"
                    >
                      <option value="todos">Todos os Membros</option>
                      <option value="aspirante">Aspirantes</option>
                      <option value="embaixador">Embaixadores</option>
                      <option value="lider">Líderes</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsNewActivityOpen(false);
                setEditingActivityId(null);
              }}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded shadow-xs cursor-pointer"
            >
              {editingActivityId ? 'Guardar Alterações' : 'Agendar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Redigir / Editar Ata Estruturada */}
      <Modal
        isOpen={isMinuteModalOpen}
        onClose={() => setIsMinuteModalOpen(false)}
        title="Ata Estruturada Oficial — Reunião da Comissão"
        description="A ata recebe número sequencial automático (ex: ATA-2026-xxxx), regista estado e quórum, e permite converter deliberações em tarefas."
        maxWidth="3xl"
      >
        <form onSubmit={handleSaveMinute} className="space-y-4 text-xs">
          {/* Consulta rápida da ata anterior */}
          {(() => {
            const prev = getPreviousCommissionMinute(state.activities, currentActivity?.id);
            if (!prev) return null;
            return (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-blue-900" />
                    <span>Ata Anterior: {prev.minute.minuteNumber} ({prev.activityTitle})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPreviousMinuteRef(!showPreviousMinuteRef)}
                    className="text-[11px] font-bold text-blue-900 hover:underline cursor-pointer"
                  >
                    {showPreviousMinuteRef ? 'Ocultar Resumo' : 'Consultar Deliberações Anteriores'}
                  </button>
                </div>
                {showPreviousMinuteRef && (
                  <div className="bg-white border border-slate-200 rounded-lg p-2.5 text-[11px] text-slate-700 space-y-1">
                    <div>
                      <strong>Data:</strong> {formatDateAO(prev.minute.date)} · <strong>Ordem do Dia:</strong>{' '}
                      {prev.minute.agenda.join(' / ')}
                    </div>
                    <div className="whitespace-pre-wrap">
                      <strong>Deliberações:</strong> {prev.minute.deliberations}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Presidente da Mesa</label>
              <input
                type="text"
                value={minuteOfficers.chairPerson}
                readOnly
                className="w-full p-2 border border-slate-200 rounded bg-slate-50 text-slate-700 font-semibold cursor-not-allowed"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Definido automaticamente: sempre o Diretor do Clube.
              </p>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Secretário(a)</label>
              <input
                type="text"
                value={minuteOfficers.secretary}
                readOnly
                className="w-full p-2 border border-slate-200 rounded bg-slate-50 text-slate-700 font-semibold cursor-not-allowed"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Definido automaticamente: secretário que está a redigir a ata.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Data da Sessão</label>
              <input
                type="date"
                value={minuteForm.date}
                onChange={(e) => setMinuteForm({ ...minuteForm, date: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Estado da Ata</label>
              <select
                value={minuteForm.status}
                onChange={(e) =>
                  setMinuteForm({ ...minuteForm, status: e.target.value as 'rascunho' | 'aprovada' })
                }
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900 bg-white"
              >
                <option value="aprovada">Aprovada em Sessão</option>
                <option value="rascunho">Rascunho (Em Revisão)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Presentes na Sessão</label>
              <input
                type="number"
                min={1}
                value={minuteForm.attendeesCount}
                onChange={(e) =>
                  setMinuteForm({ ...minuteForm, attendeesCount: Math.max(1, Number(e.target.value) || 1) })
                }
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const presentIds =
                    currentActivity?.attendees?.filter((a) => a.present).map((a) => a.memberId) || [];
                  setMinuteForm((prev) => ({
                    ...prev,
                    presentMemberIds: presentIds,
                    attendeesCount: presentIds.length > 0 ? presentIds.length : prev.attendeesCount,
                  }));
                }}
                className="px-2.5 py-2 text-[11px] font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer"
                title="Importar contagem e lista de presenças da chamada da reunião"
              >
                Sincronizar com Chamada
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Local da Sessão</label>
              <input
                type="text"
                value={minuteForm.location}
                onChange={(e) => setMinuteForm({ ...minuteForm, location: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg mt-4 sm:mt-0">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={minuteForm.quorumMet}
                  onChange={(e) => setMinuteForm({ ...minuteForm, quorumMet: e.target.checked })}
                  className="rounded text-blue-900"
                />
                <span className="font-semibold text-slate-800">
                  Quórum regimental verificado para deliberações válidas
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Ordem do Dia (Ponto por linha)</label>
            <textarea
              rows={3}
              value={minuteForm.agendaText}
              onChange={(e) => setMinuteForm({ ...minuteForm, agendaText: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-slate-700 font-semibold">Deliberações e Decisões Aprovadas</label>
              <button
                type="button"
                onClick={handleExtractTasksFromDeliberations}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-900 hover:underline cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Extrair Deliberações para Tarefas</span>
              </button>
            </div>
            <textarea
              rows={4}
              placeholder="Registo fiel das decisões institucionais tomadas (uma deliberação por linha facilita a extração para tarefas)..."
              value={minuteForm.deliberations}
              onChange={(e) => setMinuteForm({ ...minuteForm, deliberations: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              required
            />
          </div>

          {minuteTaskDrafts.length > 0 && (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-950">
                  Tarefas a Criar Automaticamente ao Gravar a Ata ({minuteTaskDrafts.filter((d) => d.include).length})
                </span>
                <button
                  type="button"
                  onClick={() => setMinuteTaskDrafts([])}
                  className="text-[11px] text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  Limpar Lista
                </button>
              </div>
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {minuteTaskDrafts.map((draft, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-white border border-blue-100 rounded-lg grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                  >
                    <label className="sm:col-span-5 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.include}
                        onChange={(e) => {
                          const next = [...minuteTaskDrafts];
                          next[idx] = { ...next[idx], include: e.target.checked };
                          setMinuteTaskDrafts(next);
                        }}
                        className="rounded text-blue-900"
                      />
                      <input
                        type="text"
                        value={draft.title}
                        onChange={(e) => {
                          const next = [...minuteTaskDrafts];
                          next[idx] = { ...next[idx], title: e.target.value };
                          setMinuteTaskDrafts(next);
                        }}
                        className="w-full p-1 border border-slate-200 rounded text-[11px]"
                      />
                    </label>
                    <div className="sm:col-span-3">
                      <select
                        value={draft.assigneeName}
                        onChange={(e) => {
                          const next = [...minuteTaskDrafts];
                          next[idx] = { ...next[idx], assigneeName: e.target.value };
                          setMinuteTaskDrafts(next);
                        }}
                        className="w-full p-1 border border-slate-200 rounded text-[11px] bg-white"
                      >
                        {state.members
                          .filter((m) => m.status === 'ativo')
                          .map((m) => (
                            <option key={m.id} value={m.fullName}>
                              {m.fullName}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="date"
                        value={draft.dueDate}
                        onChange={(e) => {
                          const next = [...minuteTaskDrafts];
                          next[idx] = { ...next[idx], dueDate: e.target.value };
                          setMinuteTaskDrafts(next);
                        }}
                        className="w-full p-1 border border-slate-200 rounded text-[11px]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <select
                        value={draft.priority}
                        onChange={(e) => {
                          const next = [...minuteTaskDrafts];
                          next[idx] = { ...next[idx], priority: e.target.value as ActivityTask['priority'] };
                          setMinuteTaskDrafts(next);
                        }}
                        className="w-full p-1 border border-slate-200 rounded text-[11px] bg-white"
                      >
                        <option value="baixa">Baixa</option>
                        <option value="media">Média</option>
                        <option value="alta">Alta</option>
                        <option value="urgente">Urgente</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Observações Complementares (Opcional)</label>
            <textarea
              rows={2}
              placeholder="Notas finais da mesa, justificações de faltas ou anexos..."
              value={minuteForm.observations}
              onChange={(e) => setMinuteForm({ ...minuteForm, observations: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsMinuteModalOpen(false)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded shadow-xs cursor-pointer"
            >
              Gravar Ata Oficial
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Adicionar / Editar Tarefa */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTaskId(null);
        }}
        title={editingTaskId ? 'Editar Tarefa Operacional' : 'Atribuir Tarefa Operacional'}
        description="Associe um membro responsável, prioridade e prazo para execução de atividades do evento."
        maxWidth="md"
      >
        <form onSubmit={handleSaveTask} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Descrição da Tarefa</label>
            <input
              type="text"
              placeholder="Ex: Alugar gerador de energia e extensões"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Responsável</label>
              <select
                value={taskForm.assigneeName}
                onChange={(e) => setTaskForm({ ...taskForm, assigneeName: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900 bg-white"
              >
                {state.members
                  .filter((m) => m.status === 'ativo')
                  .map((m) => (
                    <option key={m.id} value={m.fullName}>
                      {m.fullName}
                    </option>
                  ))}
                <option value="CUSTOM">Outro Responsável (Digitar nome)</option>
              </select>
              {taskForm.assigneeName === 'CUSTOM' && (
                <input
                  type="text"
                  placeholder="Nome do responsável..."
                  value={taskForm.customAssigneeName}
                  onChange={(e) => setTaskForm({ ...taskForm, customAssigneeName: e.target.value })}
                  className="w-full p-2 mt-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                  required
                />
              )}
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Data Limite</label>
              <input
                type="date"
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Prioridade</label>
              <select
                value={taskForm.priority}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, priority: e.target.value as ActivityTask['priority'] })
                }
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900 bg-white"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Estado</label>
              <select
                value={taskForm.status}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, status: e.target.value as ActivityTask['status'] })
                }
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900 bg-white"
              >
                <option value="pendente">Pendente</option>
                <option value="em_progresso">Em Progresso</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsTaskModalOpen(false);
                setEditingTaskId(null);
              }}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded shadow-xs cursor-pointer"
            >
              {editingTaskId ? 'Guardar Tarefa' : 'Adicionar Tarefa'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Impressão */}
      <PrintDocumentModal
        document={printedDoc}
        onClose={() => setPrintedDoc(null)}
      />

      {/* Modal de Registo de Contribuição / Doação para Atividade */}
      <Modal
        isOpen={isContributionModalOpen}
        onClose={() => setIsContributionModalOpen(false)}
        title={`Registar Contribuição ou Doação: ${currentActivity?.title || ''}`}
      >
        <form onSubmit={handleRecordContribution} className="space-y-4">
          {contribError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
              {contribError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Contribuinte</label>
            <div className="flex gap-4 mb-2 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="donorType"
                  defaultChecked
                  onChange={() => setContribForm({ ...contribForm, memberId: state.members[0]?.id || '', customDonorName: '' })}
                />
                Membro do Clube
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="donorType"
                  onChange={() => setContribForm({ ...contribForm, memberId: 'CUSTOM', customDonorName: '' })}
                />
                Doador Externo / Benfeitor (Nome livre)
              </label>
            </div>

            {contribForm.memberId === 'CUSTOM' ? (
              <input
                type="text"
                placeholder="Nome completo do benfeitor ou doador"
                value={contribForm.customDonorName}
                onChange={(e) => setContribForm({ ...contribForm, customDonorName: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                required
              />
            ) : (
              <select
                value={contribForm.memberId}
                onChange={(e) => setContribForm({ ...contribForm, memberId: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                {state.members.filter(m => m.status === 'ativo').map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName} ({m.manualNumber})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Valor Contribuído (Kz)</label>
              <input
                type="number"
                min="100"
                step="50"
                placeholder="Ex: 5000"
                value={contribForm.amountStr}
                onChange={(e) => setContribForm({ ...contribForm, amountStr: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Método de Pagamento</label>
              <select
                value={contribForm.paymentMethod}
                onChange={(e) => setContribForm({ ...contribForm, paymentMethod: e.target.value as PaymentMethod })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white text-slate-800"
              >
                <option value="multicaixa_express">Multicaixa Express</option>
                <option value="transferencia_bancaria">Transferência Bancária</option>
                <option value="deposito_bancario">Depósito Bancário</option>
                <option value="numerario">Numerário (Caixa)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Observações / Notas (Opcional)</label>
            <input
              type="text"
              placeholder="Ex: Doação especial para alimentação do acampamento"
              value={contribForm.notes}
              onChange={(e) => setContribForm({ ...contribForm, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsContributionModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Emitir Recibo e Registar Contributo
            </button>
          </div>
        </form>
      </Modal>

      {activityToDelete && (
        <Modal
          isOpen={Boolean(activityToDelete)}
          onClose={() => setActivityToDelete(null)}
          title="Eliminar Atividade"
          description="Confirme a remoção definitiva desta atividade do calendário do clube."
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900">
              Tem a certeza que deseja eliminar a atividade <strong>{activityToDelete.title}</strong>?
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActivityToDelete(null)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = deleteActivity(activityToDelete.id);
                  if (res.success) {
                    setSelectedActivity(null);
                  } else {
                    setActivityError(res.error || 'Erro ao eliminar atividade.');
                  }
                  setActivityToDelete(null);
                }}
                className="px-4 py-1.5 font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-xs cursor-pointer"
              >
                Sim, Eliminar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 4: Decisão de Aprovação / Devolução do Diretor */}
      {approvalModalState && currentActivity && (
        <Modal
          isOpen={true}
          onClose={() => setApprovalModalState(null)}
          title={
            approvalModalState.decision === 'aprovar'
              ? `Aprovar Atividade: ${currentActivity.title}`
              : `Devolver Atividade com Parecer: ${currentActivity.title}`
          }
          description="Parecer oficial do Diretor sobre a execução desta atividade no clube."
          maxWidth="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const res = decideActivityApproval(
                currentActivity.id,
                approvalModalState.decision,
                approvalModalState.notes
              );
              if (res.success) {
                setApprovalModalState(null);
                setActivityActionFeedback({
                  type: 'success',
                  message:
                    approvalModalState.decision === 'aprovar'
                      ? 'Atividade aprovada formalmente e encaminhada para Preparação.'
                      : 'Atividade devolvida para Planeamento com o seu parecer.',
                });
                setTimeout(() => setActivityActionFeedback(null), 4000);
              } else {
                setApprovalModalState({
                  ...approvalModalState,
                  error: res.error || 'Erro ao registar decisão.',
                });
              }
            }}
            className="space-y-4 text-xs"
          >
            {approvalModalState.error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg">
                {approvalModalState.error}
              </div>
            )}

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                {approvalModalState.decision === 'aprovar'
                  ? 'Observações de Aprovação (Opcional)'
                  : 'Motivo / Ajustes Solicitados (Obrigatório)'}
              </label>
              <textarea
                rows={4}
                value={approvalModalState.notes}
                onChange={(e) =>
                  setApprovalModalState({ ...approvalModalState, notes: e.target.value, error: null })
                }
                placeholder={
                  approvalModalState.decision === 'aprovar'
                    ? 'Ex: Autorizada execução com acompanhamento dos instrutores.'
                    : 'Indique os ajustes necessários antes de submeter novamente.'
                }
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-900"
                required={approvalModalState.decision === 'devolver'}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setApprovalModalState(null)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`px-4 py-1.5 font-bold text-white rounded-lg shadow-xs cursor-pointer ${
                  approvalModalState.decision === 'aprovar'
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-rose-700 hover:bg-rose-800'
                }`}
              >
                {approvalModalState.decision === 'aprovar' ? 'Confirmar Aprovação' : 'Devolver Atividade'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 5: Eliminar Tarefa */}
      {taskToDelete && currentActivity && (
        <Modal
          isOpen={true}
          onClose={() => setTaskToDelete(null)}
          title="Eliminar Tarefa"
          description="Confirme a remoção desta tarefa operacional."
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900">
              Remover a tarefa <strong>{taskToDelete.title}</strong> ({taskToDelete.assigneeName})?
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteTaskFromActivity(currentActivity.id, taskToDelete.id);
                  setTaskToDelete(null);
                }}
                className="px-4 py-1.5 font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg shadow-xs cursor-pointer"
              >
                Sim, Remover
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

