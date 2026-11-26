import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Award,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Eye,
  Flag,
  GraduationCap,
  Megaphone,
  MessageSquare,
  PlusCircle,
  Send,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { getStrictLinkedMember } from '../../services/accountSyncService';
import { ROLE_LABELS } from '../../services/permissionService';
import { formatDateAO } from '../../utils/date';
import {
  TEAM_CATEGORY_LABELS,
  buildTeamOverviewData,
  canDeleteTeamChatMessage,
  canPostInTeamChat,
  getAccessibleTeamsForUser,
  isAssignedTeamLeader,
  isDirectionChatMonitor,
} from '../../utils/teamUtils';
import { Modal } from '../common/Modal';
import { TeamChatMessage } from '../../types';

function formatChatTime(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const time = date.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' });
    const day = formatDateAO(iso);
    return `${time} · ${day}`;
  } catch {
    return '';
  }
}

export const MyTeamModule: React.FC = () => {
  const {
    state,
    currentUser,
    can,
    sendTeamChatMessage,
    deleteTeamChatMessage,
    createTeamTask,
    updateTeamTaskStatus,
    deleteTeamTask,
  } = useClub();

  const linkedMember = useMemo(
    () => getStrictLinkedMember(currentUser, state.members),
    [currentUser, state.members]
  );

  const isMonitor = isDirectionChatMonitor(currentUser.role);

  const accessibleTeams = useMemo(
    () => getAccessibleTeamsForUser(state.settings.units || [], linkedMember, currentUser),
    [state.settings.units, linkedMember, currentUser]
  );

  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'chat' | 'overview' | 'tasks'>('chat');
  const [messageInput, setMessageInput] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [messagePendingDelete, setMessagePendingDelete] = useState<TeamChatMessage | null>(null);

  // Modal de Tarefas
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assignedMemberName: '', dueDate: new Date().toISOString().slice(0, 10) });

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (accessibleTeams.length === 0) {
      setSelectedUnitId('');
      return;
    }
    const stillValid = accessibleTeams.some((u) => u.id === selectedUnitId);
    if (!stillValid) {
      setSelectedUnitId(accessibleTeams[0].id);
    }
  }, [accessibleTeams, selectedUnitId]);

  const selectedUnit = useMemo(
    () => accessibleTeams.find((u) => u.id === selectedUnitId) || accessibleTeams[0] || null,
    [accessibleTeams, selectedUnitId]
  );

  const teamOverview = useMemo(() => {
    if (!selectedUnit) return null;
    return buildTeamOverviewData({
      unit: selectedUnit,
      allUnits: state.settings.units || [],
      members: state.members || [],
      users: state.users || [],
      activities: state.activities || [],
      trainingProgress: state.trainingProgress || [],
      teamEvaluations: state.teamEvaluations || [],
      associateDirectives: state.associateDirectives || [],
      messages: state.messages || [],
      teamTasks: state.teamTasks || [],
      teamNotes: state.teamNotes || [],
      teamAwards: state.teamAwards || [],
    });
  }, [
    selectedUnit,
    state.settings.units,
    state.members,
    state.users,
    state.activities,
    state.trainingProgress,
    state.teamEvaluations,
    state.associateDirectives,
    state.messages,
    state.teamTasks,
    state.teamNotes,
    state.teamAwards,
  ]);

  const chatMessages = useMemo(() => {
    if (!selectedUnit) return [];
    return (state.teamChatMessages || [])
      .filter((m) => m.unitId === selectedUnit.id)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }, [state.teamChatMessages, selectedUnit]);

  const messageCountByUnitId = useMemo(() => {
    const map = new Map<string, number>();
    for (const msg of state.teamChatMessages || []) {
      map.set(msg.unitId, (map.get(msg.unitId) || 0) + 1);
    }
    return map;
  }, [state.teamChatMessages]);

  useEffect(() => {
    if (activeTab === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [chatMessages.length, selectedUnit?.id, activeTab]);

  if (!can('my_team', 'VIEW')) {
    return (
      <div className="p-6 text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        Sem permissão na grelha para aceder ao módulo Minha Equipa.
      </div>
    );
  }

  if (accessibleTeams.length === 0 || !selectedUnit || !teamOverview) {
    return (
      <div className="space-y-6 w-full max-w-full min-w-0">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2.5 mb-2">
            <Flag className="w-5 h-5 text-blue-900 dark:text-blue-400" />
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Minha Equipa
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Espaço dedicado aos membros, líderes de equipa e monitorização da Direção.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 text-center max-w-xl mx-auto">
          <Users className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
            Nenhuma equipa atribuída de momento
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {isMonitor
              ? 'Ainda não existem equipas ativas criadas pela Secretaria ou pelo Gabinete do Diretor-associado.'
              : 'A sua ficha ainda não foi alocada a nenhuma equipa ativa pela Secretaria ou pelo Diretor-associado. Assim que for atribuído a uma equipa, os dados dos colegas e o chat interno ficarão disponíveis aqui.'}
          </p>
        </div>
      </div>
    );
  }

  const canManageTeamExtras = isMonitor || isAssignedTeamLeader(selectedUnit, currentUser);
  const canPost = canPostInTeamChat(selectedUnit, linkedMember, currentUser) && can('my_team', 'CREATE');
  const canDelete = canDeleteTeamChatMessage(selectedUnit, currentUser);
  const isLeaderOfSelected = isAssignedTeamLeader(selectedUnit, currentUser);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;
    const res = sendTeamChatMessage({
      unitId: selectedUnit.id,
      content: messageInput,
    });
    if (res.success) {
      setMessageInput('');
      setFeedback(null);
    } else {
      setFeedback({ type: 'error', message: res.error || 'Não foi possível enviar a mensagem.' });
    }
  };

  const handleConfirmDelete = () => {
    if (!messagePendingDelete) return;
    const res = deleteTeamChatMessage(messagePendingDelete.id);
    if (res.success) {
      setFeedback({ type: 'success', message: 'Mensagem excluída para todos os participantes do chat.' });
    } else {
      setFeedback({ type: 'error', message: res.error || 'Sem permissão para excluir a mensagem.' });
    }
    setMessagePendingDelete(null);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;
    const res = createTeamTask({
      unitId: selectedUnit.id,
      title: taskForm.title,
      description: taskForm.description,
      assignedMemberName: taskForm.assignedMemberName,
      dueDate: taskForm.dueDate,
    });
    if (res.success) {
      setIsTaskModalOpen(false);
      setTaskForm({ title: '', description: '', assignedMemberName: '', dueDate: new Date().toISOString().slice(0, 10) });
      setFeedback({ type: 'success', message: 'Tarefa interna da equipa criada com sucesso!' });
    } else {
      setFeedback({ type: 'error', message: res.error || 'Erro ao criar tarefa.' });
    }
  };

  const categoryLabel =
    TEAM_CATEGORY_LABELS[selectedUnit.category] || selectedUnit.category;

  return (
    <div className="space-y-5 w-full max-w-full min-w-0">
      {/* Cabeçalho Institucional do Módulo */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Flag className="w-5 h-5 text-blue-900 dark:text-blue-400 shrink-0" />
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {isMonitor ? 'Equipas & Gestão (Direção)' : 'Minha Equipa'}
            </h1>
            {isMonitor && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md">
                <Eye className="w-3.5 h-3.5" />
                Monitorização Geral
              </span>
            )}
            {isLeaderOfSelected && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-md">
                <ShieldCheck className="w-3.5 h-3.5" />
                Líder da Equipa
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {selectedUnit.name} · {categoryLabel} · Líder: <strong className="text-slate-700 dark:text-slate-200">{teamOverview.leaderName}</strong>
          </p>
        </div>

        {/* Seletor de Equipa (para Direção ou utilizadores com múltiplas equipas) */}
        {accessibleTeams.length > 1 && (
          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="team-selector" className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
              Equipa ativa:
            </label>
            <select
              id="team-selector"
              value={selectedUnit.id}
              onChange={(e) => {
                setSelectedUnitId(e.target.value);
                setFeedback(null);
              }}
              className="px-3 py-2 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-900"
            >
              {accessibleTeams.map((unit) => {
                const count = messageCountByUnitId.get(unit.id) || 0;
                return (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({count} {count === 1 ? 'msg' : 'msgs'})
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* Faixa de Métricas da Equipa */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Classificação no Clube</span>
            <Award className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900 dark:text-white tabular-nums">
            {teamOverview.rankingPosition ? `#${teamOverview.rankingPosition}` : '—'}
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 ml-1">
              de {teamOverview.totalRankedTeams}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Membros Ativos</span>
            <Users className="w-4 h-4 text-blue-700 dark:text-blue-400" />
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900 dark:text-white tabular-nums">
            {teamOverview.teammates.length}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Assiduidade da Equipa</span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900 dark:text-white tabular-nums">
            {teamOverview.attendanceStats.recordedActivitiesCount > 0
              ? `${teamOverview.attendanceStats.participationPct}%`
              : '—'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>Progresso Formativo</span>
            <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="mt-1.5 text-xl font-black text-slate-900 dark:text-white tabular-nums">
            {teamOverview.trainingStats.totalEnrollments > 0
              ? `${teamOverview.trainingStats.avgProgressPct}%`
              : '—'}
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-bold px-2 py-0.5 hover:opacity-75"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navegação por Abas */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeTab === 'chat'
              ? 'bg-blue-900 text-white'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Chat Interno ({chatMessages.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeTab === 'overview'
              ? 'bg-blue-900 text-white'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Colegas & Desempenho</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors ${
            activeTab === 'tasks'
              ? 'bg-blue-900 text-white'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Tarefas ({teamOverview.teamTasks.length})</span>
        </button>
      </div>

      {/* ABA 1: CHAT INTERNO DA EQUIPA */}
      {activeTab === 'chat' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
          {/* Sub-cabeçalho do Chat */}
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Canal Privado · {selectedUnit.name}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Interação entre membros da equipa, líderes e Direção · Moderação ativa
              </p>
            </div>
            {canDelete && (
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-md self-start sm:self-auto">
                Pode excluir mensagens para todos
              </span>
            )}
          </div>

          {/* Lista de Mensagens */}
          <div className="p-4 sm:p-5 space-y-3 min-h-[320px] max-h-[480px] overflow-y-auto bg-slate-50/40 dark:bg-slate-950/30">
            {chatMessages.length === 0 ? (
              <div className="py-16 text-center">
                <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Ainda não existem mensagens no chat da equipa {selectedUnit.name}.
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  {canPost
                    ? 'Envie a primeira mensagem para iniciar a conversa com os seus colegas.'
                    : 'As mensagens trocadas aparecerão aqui em tempo real.'}
                </p>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isOwn = msg.senderUserId === currentUser.id;
                const roleLabel = msg.isTeamLeader
                  ? 'Líder da Equipa'
                  : isDirectionChatMonitor(msg.senderRole)
                  ? ROLE_LABELS[msg.senderRole]?.label || 'Direção'
                  : ROLE_LABELS[msg.senderRole]?.label || 'Membro';

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[72%] rounded-xl px-4 py-3 border ${
                        isOwn
                          ? 'bg-blue-900 text-white border-blue-900'
                          : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold truncate">
                            {msg.senderName}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              isOwn
                                ? 'bg-blue-800 text-blue-100'
                                : msg.isTeamLeader
                                ? 'bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {roleLabel}
                          </span>
                        </div>

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setMessagePendingDelete(msg)}
                            title="Excluir mensagem para todos"
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded transition-colors shrink-0 ${
                              isOwn
                                ? 'text-blue-200 hover:text-white hover:bg-blue-800'
                                : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Excluir</span>
                          </button>
                        )}
                      </div>

                      <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>

                      <div
                        className={`mt-1.5 text-[10px] tabular-nums ${
                          isOwn ? 'text-blue-200 text-right' : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {formatChatTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Caixa de Envio */}
          {canPost && (
            <form
              onSubmit={handleSendMessage}
              className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row gap-2.5"
            >
              <textarea
                rows={2}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (messageInput.trim()) {
                      handleSendMessage(e);
                    }
                  }
                }}
                maxLength={1000}
                placeholder={`Escrever mensagem para ${selectedUnit.name}...`}
                className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-900 resize-none"
              />
              <button
                type="submit"
                disabled={!messageInput.trim()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-900 text-white text-xs font-bold rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>Enviar</span>
              </button>
            </form>
          )}
        </div>
      )}

      {/* ABA 2: VISÃO GERAL, COLEGAS & DESEMPENHO */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Colegas de Equipa (Protegido por Privacidade) */}
          <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-900 dark:text-blue-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Integrantes da Equipa ({teamOverview.teammates.length})
                </h2>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Dados protegidos
              </span>
            </div>

            {teamOverview.teammates.length === 0 ? (
              <div className="p-6 text-xs text-slate-500 dark:text-slate-400 text-center">
                Nenhum membro ativo alocado a esta equipa de momento.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {teamOverview.teammates.map((tm) => (
                  <div
                    key={tm.id}
                    className="px-5 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {tm.photoUrl ? (
                        <img
                          src={tm.photoUrl}
                          alt={tm.fullName}
                          className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center shrink-0">
                          {tm.fullName
                            .split(' ')
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((p) => p[0])
                            .join('')
                            .toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {tm.fullName}
                          </span>
                          {tm.isLeader && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                              Líder
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          Nº {tm.manualNumber || '—'} ·{' '}
                          {TEAM_CATEGORY_LABELS[tm.category] || tm.category}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Avaliações, Diretivas & Comunicados */}
          <div className="lg:col-span-6 space-y-5">
            {/* Avaliações do Diretor-associado */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Avaliações de Desempenho
                  </h2>
                </div>
                {teamOverview.averageOverallScore !== null && (
                  <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                    Média: {teamOverview.averageOverallScore} pts
                  </span>
                )}
              </div>

              {teamOverview.evaluations.length === 0 ? (
                <div className="p-5 text-xs text-slate-500 dark:text-slate-400">
                  Ainda não foram registadas avaliações para esta equipa.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {teamOverview.evaluations.slice(0, 4).map((ev) => (
                    <div key={ev.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {ev.periodLabel}
                        </span>
                        <span className="text-xs font-black text-blue-900 dark:text-blue-400 tabular-nums">
                          {ev.overallScore} / 100
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                        <div>Disciplina: <strong>{ev.disciplineScore}</strong></div>
                        <div>Espírito: <strong>{ev.teamworkScore}</strong></div>
                        <div>Pontualidade: <strong>{ev.punctualityScore}</strong></div>
                        <div>Formação: <strong>{ev.trainingCommitmentScore}</strong></div>
                      </div>
                      {ev.observations && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {ev.observations}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Diretivas & Comunicados */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <Flag className="w-4 h-4 text-blue-900 dark:text-blue-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Diretivas & Comunicados
                </h2>
              </div>

              {teamOverview.directives.length === 0 && teamOverview.unitMessages.length === 0 ? (
                <div className="p-5 text-xs text-slate-500 dark:text-slate-400">
                  Sem diretivas ou comunicados direcionados a esta equipa.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {teamOverview.directives.slice(0, 4).map((dir) => (
                    <div key={dir.id} className="p-4 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {dir.title}
                        </span>
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {dir.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        {dir.description}
                      </p>
                      <div className="text-[10px] text-slate-400 tabular-nums">
                        Prazo: {formatDateAO(dir.dueDate)}
                      </div>
                    </div>
                  ))}
                  {teamOverview.unitMessages.slice(0, 3).map((msg) => (
                    <div key={msg.id} className="p-4 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                        <Megaphone className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
                        <span>{msg.subject}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        {msg.content}
                      </p>
                      <div className="text-[10px] text-slate-400 tabular-nums">
                        Por {msg.senderName} · {formatDateAO(msg.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: TAREFAS & DESAFIOS DA EQUIPA */}
      {activeTab === 'tasks' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Tarefas e Desafios Internos · {selectedUnit.name}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Acompanhe o cumprimento de metas e missões atribuídas à equipa.
              </p>
            </div>
            {canManageTeamExtras && (
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-900 text-white text-xs font-bold rounded-lg hover:bg-blue-800 transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nova Tarefa</span>
              </button>
            )}
          </div>

          {teamOverview.teamTasks.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500 dark:text-slate-400">
              <CheckSquare className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              Nenhuma tarefa registada para esta equipa.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {teamOverview.teamTasks.map((t) => (
                <div key={t.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        t.status === 'concluido'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                      }`}>
                        {t.status === 'concluido' ? 'Concluída' : 'Pendente'}
                      </span>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                        {t.title}
                      </h3>
                    </div>
                    {t.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {t.description}
                      </p>
                    )}
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-3 tabular-nums">
                      {t.assignedMemberName && <span>Atribuído a: <strong>{t.assignedMemberName}</strong></span>}
                      <span>Prazo: <strong>{formatDateAO(t.dueDate)}</strong></span>
                      <span>Criado por: {t.createdByName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {canManageTeamExtras && (
                      <>
                        <button
                          type="button"
                          onClick={() => updateTeamTaskStatus(t.id, t.status === 'concluido' ? 'pendente' : 'concluido')}
                          className="px-3 py-1.5 text-xs font-bold border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          {t.status === 'concluido' ? 'Marcar Pendente' : 'Concluir'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTeamTask(t.id)}
                          className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                          title="Eliminar Tarefa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Confirmação para Excluir Mensagem para Todos */}
      <Modal
        isOpen={Boolean(messagePendingDelete)}
        onClose={() => setMessagePendingDelete(null)}
        title="Excluir Mensagem para Todos"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            Tem a certeza de que deseja excluir permanentemente esta mensagem de{' '}
            <strong>{messagePendingDelete?.senderName}</strong> para todos os participantes do chat?
          </p>
          {messagePendingDelete && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 italic">
              “{messagePendingDelete.content}”
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setMessagePendingDelete(null)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="px-4 py-2 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700"
            >
              Excluir para Todos
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Nova Tarefa da Equipa */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        title="Criar Nova Tarefa / Desafio Interno"
      >
        <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Título da Tarefa *</label>
            <input
              type="text"
              required
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              placeholder="Ex.: Limpeza do acampamento / Ensaio de marcha"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Descrição / Instruções</label>
            <textarea
              rows={3}
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              placeholder="Detalhes ou passos para concluir o desafio..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Membro Responsável (Opcional)</label>
              <input
                type="text"
                value={taskForm.assignedMemberName}
                onChange={(e) => setTaskForm({ ...taskForm, assignedMemberName: e.target.value })}
                placeholder="Ex.: João Águia"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Prazo Limite *</label>
              <input
                type="date"
                required
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsTaskModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-900 text-white font-bold hover:bg-blue-800"
            >
              Criar Tarefa
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
