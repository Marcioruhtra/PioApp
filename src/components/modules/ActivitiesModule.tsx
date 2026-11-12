import React, { useState } from 'react';
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
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { ClubActivity, ActivityStage, OfficialDocument, MemberCategory, PaymentMethod } from '../../types';
import { formatKz } from '../../utils/currency';
import { formatDateAO } from '../../utils/date';
import { Modal } from '../common/Modal';
import { PrintDocumentModal } from '../common/PrintDocumentModal';
import { signInWithGoogleCalendar, getCalendarAccessToken, syncActivityToGoogleCalendar } from '../../services/googleCalendarService';

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
    updateActivityStage,
    deleteActivity,
    toggleAttendance,
    addTaskToActivity,
    updateTaskStatus,
    saveMinuteToActivity,
    createFeeDefinition,
    createReceipt,
  } = useClub();

  // Navegação Principal de Abas
  const [mainTab, setMainTab] = useState<'atividades' | 'presencas'>('atividades');

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
  const [isMinuteModalOpen, setIsMinuteModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [printedDoc, setPrintedDoc] = useState<OfficialDocument | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  // Formulário Nova Atividade
  const [activityForm, setActivityForm] = useState({
    title: '',
    type: 'reuniao_regular' as ClubActivity['type'],
    department: 'Instrução Geral',
    location: "Sede do Clube de Embaixadores Pioneiros D'Alvorada, Talatona",
    startDate: new Date().toISOString().split('T')[0],
    stage: 'planeamento' as ActivityStage,
    requiresDirectorApproval: false,
    costEstimatedInCents: 0,
    hasCost: false,
    costEstimatedStr: '',
    costApprovedInCents: 0,
    costPaidInCents: 0,
    hasMemberContribution: false,
    contributionTitle: '',
    contributionAmountStr: '',
    contributionTargetCategory: 'todos' as MemberCategory | 'todos',
  });

  // Formulário Ata Estruturada
  const [minuteForm, setMinuteForm] = useState({
    date: new Date().toISOString().split('T')[0],
    location: "Sede do Clube de Embaixadores Pioneiros D'Alvorada, Talatona",
    chairPerson: 'Carlos Mutamba (Diretor)',
    secretary: 'Esperança Neto (Secretária)',
    attendeesCount: 20,
    agendaText: 'Abertura\nPlano de Atividades\nAssuntos Gerais',
    deliberations: '',
  });

  // Formulário Tarefa
  const [taskForm, setTaskForm] = useState({
    title: '',
    assigneeName: state.members[0]?.fullName || 'Membro Responsável',
    dueDate: new Date().toISOString().split('T')[0],
    priority: 'media' as 'baixa' | 'media' | 'alta' | 'urgente',
    status: 'pendente' as const,
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
      memberId: contribForm.memberId,
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

  const handleCreateActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityForm.title.trim()) return;

    let feeDefId: string | undefined = undefined;
    if (activityForm.hasMemberContribution && activityForm.contributionAmountStr) {
      const contribAmount = Number(activityForm.contributionAmountStr) * 100;
      if (contribAmount > 0) {
        const feeRes = createFeeDefinition({
          title: activityForm.contributionTitle.trim() || `Contribuição: ${activityForm.title.trim()}`,
          category: 'contribuicao_atividade',
          targetCategory: activityForm.contributionTargetCategory === 'todos' ? undefined : activityForm.contributionTargetCategory,
          periodicity: 'unica',
          year: new Date().getFullYear(),
          amountInCents: contribAmount,
          active: true,
        });
        if (feeRes.success && feeRes.id) {
          feeDefId = feeRes.id;
        }
      }
    }

    const costInCents = activityForm.hasCost && activityForm.costEstimatedStr ? Number(activityForm.costEstimatedStr) * 100 : 0;
    const res = createActivity({
      title: activityForm.title.trim(),
      type: activityForm.type,
      department: activityForm.department,
      location: activityForm.location.trim(),
      startDate: activityForm.startDate,
      stage: activityForm.stage,
      requiresDirectorApproval: activityForm.requiresDirectorApproval,
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
      setActivityForm({
        title: '',
        type: 'reuniao_regular',
        department: 'Instrução Geral',
        location: "Sede do Clube de Embaixadores Pioneiros D'Alvorada, Talatona",
        startDate: new Date().toISOString().split('T')[0],
        stage: 'planeamento',
        requiresDirectorApproval: false,
        costEstimatedInCents: 0,
        hasCost: false,
        costEstimatedStr: '',
        costApprovedInCents: 0,
        costPaidInCents: 0,
        hasMemberContribution: false,
        contributionTitle: '',
        contributionAmountStr: '',
        contributionTargetCategory: 'todos',
      });
    } else {
      setActivityError(res.error || 'Erro ao criar atividade.');
    }
  };

  const handleSaveMinute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity) return;

    const agenda = minuteForm.agendaText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    const res = saveMinuteToActivity(selectedActivity.id, {
      date: minuteForm.date,
      location: minuteForm.location,
      chairPerson: minuteForm.chairPerson,
      secretary: minuteForm.secretary,
      attendeesCount: minuteForm.attendeesCount,
      agenda,
      deliberations: minuteForm.deliberations,
    });

    if (res.success) {
      setIsMinuteModalOpen(false);
      setMinuteForm({
        date: new Date().toISOString().split('T')[0],
        location: 'Sede do Clube D\'Alvorada, Talatona',
        chairPerson: 'Comissão Diretiva',
        secretary: 'Secretaria Geral',
        attendeesCount: 20,
        agendaText: 'Abertura e oração\nLeitura da ata anterior\nOrdens de trabalho e instruções\nEncerramento',
        deliberations: '',
      });
    }
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity || !taskForm.title.trim()) return;

    addTaskToActivity(selectedActivity.id, {
      title: taskForm.title.trim(),
      assigneeName: taskForm.assigneeName,
      dueDate: taskForm.dueDate,
      priority: taskForm.priority,
      status: taskForm.status,
    });

    setIsTaskModalOpen(false);
    setTaskForm({
      title: '',
      assigneeName: state.members[0]?.fullName || 'Membro Responsável',
      dueDate: new Date().toISOString().split('T')[0],
      priority: 'media',
      status: 'pendente',
    });
  };

  // Atividade ativa sincronizada
  const currentActivity = state.activities.find((a) => a.id === selectedActivity?.id) || state.activities[0];

  // Atividade selecionada no Sub-módulo de Presenças
  const attendanceActivity =
    state.activities.find((a) => a.id === attendanceSelectedActivityId) || currentActivity || state.activities[0];

  // Membros ativos para presenças
  const activeMembers = state.members.filter((m) => m.status === 'ativo');

  // Unidades/Equipas para filtros
  const availableUnits = Array.from(
    new Set(activeMembers.map((m) => m.unitOrTeam || 'Sem Equipa').filter(Boolean))
  );

  // Membros filtrados para a chamada
  const filteredAttendanceMembers = activeMembers.filter((m) => {
    const searchLower = attendanceSearchTerm.toLowerCase();
    const matchesSearch =
      !attendanceSearchTerm ||
      m.fullName.toLowerCase().includes(searchLower) ||
      m.manualNumber.toLowerCase().includes(searchLower) ||
      (m.unitOrTeam && m.unitOrTeam.toLowerCase().includes(searchLower));

    const matchesUnit =
      attendanceUnitFilter === 'todas' ||
      (attendanceUnitFilter === 'Sem Equipa' ? !m.unitOrTeam || m.unitOrTeam === 'Sem Equipa' : m.unitOrTeam === attendanceUnitFilter);

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

  // Ações em Lote para Presenças
  const handleBatchAttendance = (present: boolean) => {
    if (!attendanceActivity) return;
    filteredAttendanceMembers.forEach((m) => {
      toggleAttendance(attendanceActivity.id, m.id, present);
    });
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
    const unitMembers = activeMembers.filter((m) =>
      unitName === 'Sem Equipa' ? !m.unitOrTeam || m.unitOrTeam === 'Sem Equipa' : m.unitOrTeam === unitName
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
              Planeamento de eventos, chamada de presenças com controlo sem duplicados, tarefas e atas oficiais.
            </p>
          </div>

          {can('activities', 'CREATE') && (
            <button
              onClick={() => setIsNewActivityOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agendar Nova Atividade</span>
            </button>
          )}
        </div>

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
        </div>
      </div>

      {/* CONTEÚDO DA ABA 1: CALENDÁRIO & ATIVIDADES */}
      {mainTab === 'atividades' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna da Esquerda: Lista de Atividades */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden h-fit">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Calendário de Atividades ({state.activities.length})
              </h3>
            </div>

            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {state.activities.map((act) => (
                <button
                  key={act.id}
                  onClick={() => setSelectedActivity(act)}
                  className={`w-full text-left p-4 transition-colors flex items-start justify-between cursor-pointer ${
                    currentActivity?.id === act.id
                      ? 'bg-blue-50/70 border-l-4 border-blue-900'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{act.title}</h4>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                      <span>{formatDateAO(act.startDate)}</span>
                      <span>·</span>
                      <span className="capitalize">{act.stage}</span>
                      {act.costEstimatedInCents > 0 && (
                        <span className="font-mono text-slate-600 font-medium">· Est: {formatKz(act.costEstimatedInCents)}</span>
                      )}
                      {act.costApprovedInCents > 0 && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-900 rounded font-semibold text-[10px]">
                          Aprovado: {formatKz(act.costApprovedInCents)}
                        </span>
                      )}
                      {act.costPaidInCents > 0 && (
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-900 rounded font-semibold text-[10px]">
                          Total Pago: {formatKz(act.costPaidInCents)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Coluna da Direita: Painel Completo da Atividade Selecionada */}
          {currentActivity ? (
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-900 tracking-wider">
                      {currentActivity.department} · {currentActivity.type.replace('_', ' ')}
                    </span>
                    <h2 className="text-lg font-black text-slate-900 mt-0.5">
                      {currentActivity.title}
                    </h2>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDateAO(currentActivity.startDate)}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {currentActivity.location}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSyncToCalendar}
                        disabled={isSyncingCalendar}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                        title="Sincronizar esta atividade diretamente com o seu Google Calendar"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{isSyncingCalendar ? 'A sincronizar...' : 'Sincronizar Google Calendar'}</span>
                      </button>

                      {/* Seletor de Fase da Atividade */}
                      {can('activities', 'EDIT') && (
                        <select
                          value={currentActivity.stage}
                          onChange={(e) => updateActivityStage(currentActivity.id, e.target.value as ActivityStage)}
                          className="px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded bg-white text-slate-800"
                        >
                          <option value="planeamento">Fase: Planeamento</option>
                          <option value="aprovacao">Fase: Aprovação</option>
                          <option value="preparacao">Fase: Preparação</option>
                          <option value="execucao">Fase: Execução</option>
                          <option value="relatorio">Fase: Relatório</option>
                          <option value="encerrado">Fase: Encerrado</option>
                        </select>
                      )}

                      {/* Botão de Excluir Atividade */}
                      {(can('activities', 'ARCHIVE') || can('activities', 'EDIT') || currentUser.role === 'diretor' || currentUser.role === 'admin_tecnico') && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Tem a certeza que deseja eliminar a atividade "${currentActivity.title}"?`)) {
                              const res = deleteActivity(currentActivity.id);
                              if (res.success) {
                                setSelectedActivity(null);
                              } else {
                                console.error("[DEBUG] Error deleting activity:", res.error);
                                setActivityError(res.error || 'Erro ao eliminar atividade.');
                              }
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar atividade"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {calendarSyncMsg && (
                      <span className={`text-[11px] font-medium ${calendarSyncMsg.includes('sucesso') ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {calendarSyncMsg}
                      </span>
                    )}
                  </div>
                </div>

                {/* Custos da Atividade & Tramitação na Tesouraria */}
                {(() => {
                  const linkedExp = state.expenses.find(
                    (e) => e.activityId === currentActivity.id || e.id === currentActivity.expenseRequestId
                  );
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
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            linkedExp.status === 'pago'
                              ? 'bg-emerald-100 text-emerald-800'
                              : linkedExp.status === 'aprovado'
                              ? 'bg-blue-100 text-blue-800'
                              : linkedExp.status === 'rejeitado'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
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

                {/* Secção de Contribuições e Doações da Atividade */}
                {(() => {
                  const activityReceipts = state.receipts.filter(
                    (r) => !r.isCancelled && (r.activityId === currentActivity.id || (currentActivity.feeDefinitionId && r.feeDefinitionId === currentActivity.feeDefinitionId))
                  );
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

                {/* Bloco de Tarefas da Atividade */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-blue-900" />
                      <span>Tarefas Operacionais ({currentActivity.tasks.length})</span>
                    </h3>
                    {can('activities', 'EDIT') && (
                      <button
                        onClick={() => setIsTaskModalOpen(true)}
                        className="text-xs text-blue-900 hover:underline font-semibold cursor-pointer"
                      >
                        + Adicionar Tarefa
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {currentActivity.tasks.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">Nenhuma tarefa atribuída.</div>
                    ) : (
                      currentActivity.tasks.map((task) => (
                        <div key={task.id} className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs">
                          <div>
                            <p className={`font-semibold ${task.status === 'concluido' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                              {task.title}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Responsável: {task.assigneeName} · Prazo: {formatDateAO(task.dueDate)}
                            </p>
                          </div>
                          {can('activities', 'EDIT') && (
                            <button
                              onClick={() =>
                                updateTaskStatus(
                                  currentActivity.id,
                                  task.id,
                                  task.status === 'concluido' ? 'em_progresso' : 'concluido'
                                )
                              }
                              className={`px-2 py-1 text-[10px] font-bold uppercase rounded cursor-pointer ${
                                task.status === 'concluido'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {task.status === 'concluido' ? 'Concluída' : 'Marcar Feita'}
                            </button>
                          )}
                        </div>
                      ))
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
                                  isPresent
                                    ? 'bg-blue-900 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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

                {/* Bloco de Ata Estruturada */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Ata Oficial da Reunião</h3>
                    <p className="text-[11px] text-slate-500">
                      {currentActivity.minute
                        ? `Ata numerada: ${currentActivity.minute.minuteNumber}`
                        : 'Nenhuma ata redigida para esta atividade.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentActivity.minute && (
                      <button
                        onClick={() => {
                          setPrintedDoc({
                            id: currentActivity.minute!.id,
                            documentNumber: currentActivity.minute!.minuteNumber,
                            documentType: 'ata',
                            title: `Ata da Reunião - ${currentActivity.title}`,
                            year: state.settings.currentYear,
                            issuedByUserId: currentUser.id,
                            issuedByName: currentUser.name,
                            issuedAt: currentActivity.minute!.date,
                            contentData: {
                              chairPerson: currentActivity.minute!.chairPerson,
                              secretary: currentActivity.minute!.secretary,
                              local: currentActivity.minute!.location,
                              deliberacao: currentActivity.minute!.deliberations,
                            },
                            isCancelled: false,
                          });
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimir Ata</span>
                      </button>
                    )}

                    {can('activities', 'CREATE') && (
                      <button
                        onClick={() => setIsMinuteModalOpen(true)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded shadow-xs cursor-pointer"
                      >
                        {currentActivity.minute ? 'Editar Ata' : 'Redigir Ata'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: SUB-MÓDULO DE PRESENÇAS & FREQUÊNCIA */}
      {mainTab === 'presencas' && (
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
                      {attendanceActivity.department} · {attendanceActivity.type.replace('_', ' ')}
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
                                <span>Equipa: {m.unitOrTeam || 'Sem Equipa'}</span>
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
                            <td className="p-3 text-slate-600">{item.member.unitOrTeam || 'Sem Equipa'}</td>
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

      {/* MODAL 1: Nova Atividade */}
      <Modal
        isOpen={isNewActivityOpen}
        onClose={() => setIsNewActivityOpen(false)}
        title="Agendar Nova Atividade / Reunião"
        description="Defina os parâmetros do evento para o calendário oficial do clube."
        maxWidth="md"
      >
        <form onSubmit={handleCreateActivity} className="space-y-4 text-xs">
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


          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Tipo de Evento</label>
              <select
                value={activityForm.type}
                onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value as ClubActivity['type'] })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              >
                <option value="reuniao_regular">Reunião Regular</option>
                <option value="acampamento">Acampamento / Bivaque</option>
                <option value="civica">Atividade Cívica</option>
                <option value="formacao">Formação e Classes</option>
                <option value="diretoria">Reunião de Diretoria</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Data Prevista</label>
              <input
                type="date"
                value={activityForm.startDate}
                onChange={(e) => setActivityForm({ ...activityForm, startDate: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Local / Município</label>
            <input
              type="text"
              value={activityForm.location}
              onChange={(e) => setActivityForm({ ...activityForm, location: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              required
            />
          </div>

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
                <label className="block text-slate-700 font-semibold mb-1">Custo Estimado a Solicitar à Tesouraria (Kz)</label>
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

          {/* Opção para os Secretários criarem contribuição para os membros */}
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
                      activityForm.contributionTitle || (activityForm.title ? `Contribuição: ${activityForm.title}` : ''),
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
                      onChange={(e) => setActivityForm({ ...activityForm, contributionTargetCategory: e.target.value as any })}
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
              onClick={() => setIsNewActivityOpen(false)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded shadow-xs cursor-pointer"
            >
              Agendar
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Redigir Ata Estruturada */}
      <Modal
        isOpen={isMinuteModalOpen}
        onClose={() => setIsMinuteModalOpen(false)}
        title="Redigir Ata Estruturada Oficial"
        description="A ata receberá número sequencial automático (ex: ATA-2026-xxxx) e entrará no arquivo documental do clube."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveMinute} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Presidente da Mesa</label>
              <input
                type="text"
                value={minuteForm.chairPerson}
                onChange={(e) => setMinuteForm({ ...minuteForm, chairPerson: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Secretário(a)</label>
              <input
                type="text"
                value={minuteForm.secretary}
                onChange={(e) => setMinuteForm({ ...minuteForm, secretary: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
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
            <label className="block text-slate-700 font-semibold mb-1">Deliberações e Decisões Aprovadas</label>
            <textarea
              rows={4}
              placeholder="Registo fiel das decisões institucionais tomadas..."
              value={minuteForm.deliberations}
              onChange={(e) => setMinuteForm({ ...minuteForm, deliberations: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              required
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

      {/* MODAL 3: Adicionar Tarefa */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title="Atribuir Tarefa Operacional"
        description="Associe um membro e prazo para execução de atividades do evento."
        maxWidth="md"
      >
        <form onSubmit={handleAddTask} className="space-y-4 text-xs">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Responsável</label>
              <input
                type="text"
                value={taskForm.assigneeName}
                onChange={(e) => setTaskForm({ ...taskForm, assigneeName: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
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

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsTaskModalOpen(false)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded shadow-xs cursor-pointer"
            >
              Adicionar Tarefa
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
    </div>
  );
};

