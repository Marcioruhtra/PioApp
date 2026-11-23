import React from 'react';
import {
  Users,
  Wallet,
  Calendar,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  FileCheck,
  Shield,
  PlusCircle,
  Receipt,
  UserPlus,
  BarChart3,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Award,
  CheckSquare,
  Layers,
  Briefcase,
  Gift,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { formatKz } from '../../utils/currency';
import {
  formatDateAO,
  getCurrentWeekWindow,
  getExpiredIdentityCardMembers,
  getWeeklyBirthdayMembers,
} from '../../utils/date';
import { ROLE_LABELS } from '../../services/permissionService';
import { calculateTeamAttendanceStats } from '../../utils/activityUtils';
import { ModuleName } from '../../types';
import { isDirectionMember } from '../../services/accountSyncService';
import {
  evaluateEnrollmentAvailability,
  getPendingReconfirmationMembers,
} from '../../services/enrollmentService';

interface DashboardModuleProps {
  onNavigate: (module: ModuleName) => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({ onNavigate }) => {
  const { state, currentUser, can } = useClub();

  const totalMembers = state.members.filter((m) => m.status === 'ativo').length;
  const embaixadoresCount = state.members.filter((m) => m.category === 'embaixador' && m.status === 'ativo').length;
  const lideresCount = state.members.filter((m) => m.category === 'lider' && m.status === 'ativo').length;
  const aspirantesCount = state.members.filter((m) => m.category === 'aspirante' && m.status === 'ativo').length;

  const embPct = totalMembers > 0 ? Math.round((embaixadoresCount / totalMembers) * 100) : 0;
  const lidPct = totalMembers > 0 ? Math.round((lideresCount / totalMembers) * 100) : 0;
  const aspPct = totalMembers > 0 ? Math.round((aspirantesCount / totalMembers) * 100) : 0;

  // Tesouraria (visível apenas para papéis com permissão treasury:VIEW)
  const canViewTreasury = can('treasury', 'VIEW');
  const totalBalanceCents = state.accounts.reduce((acc, curr) => acc + curr.currentBalanceInCents, 0);
  const totalIncomeCents = state.receipts
    .filter((r) => !r.isCancelled && r.status !== 'anulado')
    .reduce((acc, r) => acc + r.amountPaidInCents, 0);
  const totalExpenseCents = state.expenses.filter((e) => e.status === 'pago').reduce((acc, e) => acc + e.amountInCents, 0);

  const pendingExpensesCount = state.expenses.filter((e) => e.status === 'solicitado').length;
  const pendingProofsCount = state.paymentProofs.filter((p) => p.status === 'submetido').length;

  // Supervisão de Equipas & Atividades (sem exposição da sub-aba sensível de presenças)
  const canSuperviseTeams =
    currentUser.role === 'diretor_associado' ||
    currentUser.role === 'diretor' ||
    currentUser.role === 'secretario' ||
    currentUser.role === 'instrutor' ||
    currentUser.role === 'admin_tecnico';

  const activeMembers = state.members.filter((m) => m.status === 'ativo');

  const teamProgressMetrics = state.settings.units.map((unit) => {
    const teamMembers = activeMembers.filter((m) => m.unitOrTeam === unit.name);
    const teamMemberIds = new Set(teamMembers.map((m) => m.id));
    const leaderUser = state.users.find((u) => u.id === unit.leaderUserId);

    // Progresso formativo dos membros da equipa
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

    // Taxa agregada da equipa nas reuniões/atividades (considera apenas atividades com lista de presenças registada)
    const { totalSlots: totalActivitySlots, participationPct: aggregateParticipationPct } =
      calculateTeamAttendanceStats(teamMemberIds, state.activities);

    // Progresso global combinado da equipa
    const hasTraining = teamTraining.length > 0;
    const hasActivities = totalActivitySlots > 0;
    const overallProgressPct =
      hasTraining && hasActivities
        ? Math.round((avgTrainingPct + aggregateParticipationPct) / 2)
        : hasTraining
        ? avgTrainingPct
        : hasActivities
        ? aggregateParticipationPct
        : 0;

    return {
      unit,
      leaderName: leaderUser?.name || 'Sem líder vinculado',
      memberCount: teamMembers.length,
      embaixadores: teamMembers.filter((m) => m.category === 'embaixador').length,
      lideres: teamMembers.filter((m) => m.category === 'lider').length,
      aspirantes: teamMembers.filter((m) => m.category === 'aspirante').length,
      avgTrainingPct,
      investedCount,
      aggregateParticipationPct,
      overallProgressPct,
    };
  });

  const membersWithoutTeamCount = activeMembers.filter(
    (m) => !m.unitOrTeam?.trim() && !isDirectionMember(m, state.users)
  ).length;

  // Métricas de execução de Atividades & Reuniões (tarefas, fases e atas sem aceder à sub-aba de presenças)
  const totalTasksCount = state.activities.reduce((sum, act) => sum + (act.tasks?.length || 0), 0);
  const completedTasksCount = state.activities.reduce(
    (sum, act) => sum + (act.tasks?.filter((t) => t.status === 'concluido').length || 0),
    0
  );
  const taskCompletionPct = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
  const activitiesWithMinuteCount = state.activities.filter((act) => Boolean(act.minute)).length;
  const ongoingActivitiesCount = state.activities.filter((act) => act.stage !== 'encerrado').length;
  const closedActivitiesCount = state.activities.filter((act) => act.stage === 'encerrado').length;

  const canViewMembers = can('members', 'VIEW');
  const nowRef = new Date();
  const weekWindow = getCurrentWeekWindow(nowRef);
  const weeklyBirthdays = canViewMembers ? getWeeklyBirthdayMembers(state.members, nowRef) : [];
  const expiredBiMembers = canViewMembers ? getExpiredIdentityCardMembers(state.members, nowRef) : [];
  const enrollmentAvailability = evaluateEnrollmentAvailability(state.settings.enrollmentConfig, nowRef);
  const pendingReconfirmationMembers =
    canViewMembers && enrollmentAvailability.enableReconfirmation && state.settings.enrollmentConfig?.periodId
      ? getPendingReconfirmationMembers(state.members, state.settings.enrollmentConfig)
      : [];

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {/* Cabeçalho de Boas-vindas e Contexto Operacional */}
      <div className="bg-slate-900 text-white rounded-xl p-6 sm:p-8 shadow-sm border border-slate-800 w-full max-w-full min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-widest">
              <span>Sessão Ativa</span>
              <span>·</span>
              <span>{ROLE_LABELS[currentUser.role]?.label}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight mt-1">
              Olá, {currentUser.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Bem-vindo ao Sistema Integrado de Gestão do <strong>Clube de Embaixadores</strong> (Luanda, Angola).
              Os seus privilégios operacionais estão ativos conforme a política institucional do clube.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {can('members', 'CREATE') && (
              <button
                onClick={() => onNavigate('members')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Registar Membro</span>
              </button>
            )}
            {can('associate_director', 'VIEW') && (
              <button
                onClick={() => onNavigate('associate_director')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Gabinete Diretor-associado</span>
              </button>
            )}
            {currentUser.role === 'diretor_associado' && (
              <button
                onClick={() => onNavigate('reports')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Relatórios Oficiais</span>
              </button>
            )}
            {can('treasury', 'CREATE') && (
              <button
                onClick={() => onNavigate('treasury')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Emitir Recibo</span>
              </button>
            )}
            {currentUser.role === 'membro' && (
              <button
                onClick={() => onNavigate('member_portal')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                <span>Aceder ao Meu Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cartões de Indicadores Gerais (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-full">
        {/* KPI: Membros Ativos */}
        {can('members', 'VIEW') && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs w-full max-w-full min-w-0">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Membros Ativos</span>
              <Users className="w-4 h-4 text-blue-900 shrink-0" />
            </div>
            <div className="text-2xl font-black text-slate-900">{totalMembers}</div>
            <div className="text-xs text-slate-500 mt-2 flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-indigo-700">{embaixadoresCount} Embaixadores</span>
              <span>·</span>
              <span className="font-medium text-purple-700">{lideresCount} Líderes</span>
              <span>·</span>
              <span className="font-medium text-amber-700">{aspirantesCount} Aspirantes</span>
            </div>
          </div>
        )}

        {/* KPI: Tesouraria (Kz) - Apenas para perfis com responsabilidade financeira */}
        {canViewTreasury ? (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs w-full max-w-full min-w-0">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Disponibilidade Total</span>
              <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>
            <div className="text-2xl font-black text-slate-900">{formatKz(totalBalanceCents)}</div>
            <div className="text-xs text-slate-500 mt-2">
              <span>{state.accounts.length} contas ativas (Bancos & Caixa)</span>
            </div>
          </div>
        ) : currentUser.role === 'membro' ? (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs w-full max-w-full min-w-0">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Minhas Quotas</span>
              <Wallet className="w-4 h-4 text-blue-900 shrink-0" />
            </div>
            <div className="text-lg font-bold text-slate-900">Em Dia</div>
            <div className="text-xs text-slate-500 mt-2">Ano {state.settings.currentYear} regularizado</div>
          </div>
        ) : (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs w-full max-w-full min-w-0">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Equipas Ativas</span>
              <Layers className="w-4 h-4 text-blue-900 shrink-0" />
            </div>
            <div className="text-2xl font-black text-slate-900">{state.settings.units.length}</div>
            <div className="text-xs text-slate-500 mt-2">
              <span>{membersWithoutTeamCount > 0 ? `${membersWithoutTeamCount} membros sem equipa` : 'Todas as equipas monitorizadas'}</span>
            </div>
          </div>
        )}

        {/* KPI: Atividades e Reuniões */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs w-full max-w-full min-w-0">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Atividades & Reuniões</span>
            <Calendar className="w-4 h-4 text-blue-900 shrink-0" />
          </div>
          <div className="text-2xl font-black text-slate-900">{state.activities.length}</div>
          <div className="text-xs text-slate-500 mt-2">
            <span>{ongoingActivitiesCount} em curso · {closedActivitiesCount} encerradas</span>
          </div>
        </div>

        {/* KPI: Execução de Tarefas ou Pendências Financeiras */}
        {canViewTreasury ? (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs w-full max-w-full min-w-0">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Ações Pendentes</span>
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {pendingExpensesCount + pendingProofsCount}
            </div>
            <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
              <span>{pendingProofsCount} Comprovativos</span>
              <span>·</span>
              <span>{pendingExpensesCount} Despesas</span>
            </div>
          </div>
        ) : (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs w-full max-w-full min-w-0">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Execução Operacional</span>
              <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>
            <div className="text-2xl font-black text-slate-900">{taskCompletionPct}%</div>
            <div className="text-xs text-slate-500 mt-2">
              <span>{completedTasksCount}/{totalTasksCount} tarefas · {activitiesWithMinuteCount} atas lavradas</span>
            </div>
          </div>
        )}
      </div>

      {/* Acompanhamento Rápido de Membros: Aniversariantes da Semana, Sem Reconfirmação e B.I. Expirados */}
      {canViewMembers && (
        <div
          className={`grid grid-cols-1 ${
            expiredBiMembers.length > 0 && pendingReconfirmationMembers.length > 0
              ? 'lg:grid-cols-3'
              : expiredBiMembers.length > 0 || pendingReconfirmationMembers.length > 0
              ? 'lg:grid-cols-2'
              : ''
          } gap-4 w-full max-w-full min-w-0`}
        >
          {/* Cartão: Aniversariantes da Semana */}
          <div className="bg-white rounded-xl border border-indigo-200 shadow-xs overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-indigo-100 bg-indigo-50/70 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Gift className="w-4 h-4 text-indigo-700 shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-950 truncate">
                    Aniversariantes da Semana ({weeklyBirthdays.length})
                  </h2>
                  <p className="text-[10px] text-indigo-800/80">
                    {weekWindow.startLabel} a {weekWindow.endLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('members')}
                className="text-[11px] font-bold text-indigo-900 hover:underline shrink-0 cursor-pointer"
              >
                Abrir Membros
              </button>
            </div>
            <div className="p-3 divide-y divide-slate-100 text-xs flex-1">
              {weeklyBirthdays.length === 0 ? (
                <p className="text-slate-400 italic py-2 text-center">
                  Sem aniversariantes registados nesta semana.
                </p>
              ) : (
                weeklyBirthdays.slice(0, 5).map((entry) => (
                  <div key={entry.member.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                        <span className="truncate">{entry.member.fullName}</span>
                        {entry.isToday && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-700 text-white shrink-0">
                            Hoje!
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {entry.weekdayLabel} ({entry.dayMonthLabel})
                        {entry.turningAge !== null ? ` · ${entry.turningAge} anos` : ''}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      {entry.member.manualNumber}
                    </span>
                  </div>
                ))
              )}
              {weeklyBirthdays.length > 5 && (
                <p className="pt-2 text-[10px] text-indigo-800 font-semibold">
                  +{weeklyBirthdays.length - 5} outro(s) aniversariante(s) esta semana
                </p>
              )}
            </div>
          </div>

          {/* Cartão: Pendentes de Reconfirmação */}
          {pendingReconfirmationMembers.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 shadow-xs overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-amber-100 bg-amber-50/70 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <RefreshCw className="w-4 h-4 text-amber-700 shrink-0" />
                  <div className="min-w-0">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-amber-950 truncate">
                      Sem Reconfirmação ({pendingReconfirmationMembers.length})
                    </h2>
                    <p className="text-[10px] text-amber-800/80">
                      Aguardam confirmação de dados no período atual
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('members')}
                  className="text-[11px] font-bold text-amber-900 hover:underline shrink-0 cursor-pointer"
                >
                  Ver Lista
                </button>
              </div>
              <div className="p-3 divide-y divide-slate-100 text-xs flex-1">
                {pendingReconfirmationMembers.slice(0, 5).map((m) => (
                  <div key={m.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{m.fullName}</div>
                      <div className="text-[10px] text-slate-500 capitalize">
                        {m.category} · {m.unitOrTeam || 'Sem equipa'}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      {m.manualNumber}
                    </span>
                  </div>
                ))}
                {pendingReconfirmationMembers.length > 5 && (
                  <p className="pt-2 text-[10px] text-amber-800 font-semibold">
                    +{pendingReconfirmationMembers.length - 5} outro(s) membro(s) pendente(s)
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Cartão: B.I. Expirados */}
          {expiredBiMembers.length > 0 && (
            <div className="bg-white rounded-xl border border-rose-200 shadow-xs overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-rose-100 bg-rose-50/70 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                  <div className="min-w-0">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-rose-950 truncate">
                      B.I. Expirados ({expiredBiMembers.length})
                    </h2>
                    <p className="text-[10px] text-rose-800/80">
                      Bilhetes de Identidade com validade ultrapassada
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('members')}
                  className="text-[11px] font-bold text-rose-900 hover:underline shrink-0 cursor-pointer"
                >
                  Regularizar
                </button>
              </div>
              <div className="p-3 divide-y divide-slate-100 text-xs flex-1">
                {expiredBiMembers.slice(0, 5).map(({ member }) => (
                  <div key={member.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{member.fullName}</div>
                      <div className="text-[10px] text-rose-700 font-semibold">
                        Expirado em {formatDateAO(member.identityCardExpiryDate)}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      {member.identityCardNumber}
                    </span>
                  </div>
                ))}
                {expiredBiMembers.length > 5 && (
                  <p className="pt-2 text-[10px] text-rose-800 font-semibold">
                    +{expiredBiMembers.length - 5} outro(s) com B.I. expirado
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Painel Específico de Progresso das Equipas & Monitorização de Atividades (Diretor-associado e Direção) */}
      {canSuperviseTeams && (
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-blue-200 shadow-xs space-y-5 w-full max-w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <TrendingUp className="w-4 h-4 text-blue-900" />
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                  Métricas de Progresso das Equipas & Supervisão de Atividades
                </h2>
                {currentUser.role === 'diretor_associado' && (
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-900 rounded-full border border-blue-200">
                    Painel do Diretor-associado
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Acompanhamento consolidado do desempenho formativo das equipas, evolução das reuniões e execução de tarefas sem exposição da lista sensível de presenças.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => onNavigate('members')}
                className="px-3 py-1.5 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
              >
                Gerir Equipas
              </button>
              <button
                onClick={() => onNavigate('activities')}
                className="px-3 py-1.5 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
              >
                Monitorizar Atividades
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Coluna 1 & 2: Métricas de Progresso por Equipa */}
            <div className="xl:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-600" />
                  <span>Desempenho e Progresso por Equipa ({teamProgressMetrics.length})</span>
                </h3>
                {membersWithoutTeamCount > 0 && (
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    {membersWithoutTeamCount} membro(s) Sem Equipa
                  </span>
                )}
              </div>

              {teamProgressMetrics.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                  Nenhuma equipa criada ainda. Aceda a <strong>Gestão de Membros → Gerir Equipas e Membros</strong> para configurar as equipas do clube.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {teamProgressMetrics.map((tm) => {
                    const statusBadge =
                      tm.memberCount === 0
                        ? { label: 'Sem Membros', cls: 'bg-slate-100 text-slate-600 border-slate-200' }
                        : tm.overallProgressPct >= 80
                        ? { label: 'Excelente', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
                        : tm.overallProgressPct >= 50
                        ? { label: 'Bom Ritmo', cls: 'bg-blue-100 text-blue-800 border-blue-200' }
                        : { label: 'Em Evolução', cls: 'bg-amber-100 text-amber-800 border-amber-200' };

                    return (
                      <div
                        key={tm.unit.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white transition-colors space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs font-black text-slate-900 truncate">{tm.unit.name}</h4>
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700">
                                {tm.unit.category === 'mista' ? 'Mista' : tm.unit.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              Líder: <strong className="text-slate-700">{tm.leaderName}</strong>
                            </p>
                          </div>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border shrink-0 ${statusBadge.cls}`}>
                            {statusBadge.label}
                          </span>
                        </div>

                        {/* Barra de Progresso Geral da Equipa */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 mb-1">
                            <span>Progresso Geral da Equipa</span>
                            <span className="font-mono font-black text-blue-900">{tm.overallProgressPct}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                tm.overallProgressPct >= 80
                                  ? 'bg-emerald-600'
                                  : tm.overallProgressPct >= 50
                                  ? 'bg-blue-700'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${tm.overallProgressPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Sub-métricas da Equipa */}
                        <div className="grid grid-cols-3 gap-2 pt-1 text-[10px]">
                          <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                            <span className="text-slate-500 block">Efetivo</span>
                            <strong className="text-xs font-black text-slate-900">{tm.memberCount}</strong>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                            <span className="text-slate-500 block">Formação</span>
                            <strong className="text-xs font-black text-indigo-800">{tm.avgTrainingPct}%</strong>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-slate-200 text-center">
                            <span className="text-slate-500 block">Reuniões</span>
                            <strong className="text-xs font-black text-emerald-700">{tm.aggregateParticipationPct}%</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Coluna 3: Monitorização de Atividades e Reuniões (Sem Sub-aba de Presenças) */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-900" />
                <span>Monitorização de Reuniões & Tarefas</span>
              </h3>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200">
                  <span className="text-[10px] font-bold uppercase text-blue-800 block">Atividades Ativas</span>
                  <span className="text-lg font-black text-blue-950">{ongoingActivitiesCount}</span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <span className="text-[10px] font-bold uppercase text-emerald-800 block">Atas Registadas</span>
                  <span className="text-lg font-black text-emerald-950">
                    {activitiesWithMinuteCount}/{state.activities.length}
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50 overflow-hidden">
                {state.activities.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 italic">
                    Nenhuma atividade ou reunião agendada até ao momento.
                  </div>
                ) : (
                  state.activities.slice(0, 4).map((act) => {
                    const totalT = act.tasks?.length || 0;
                    const doneT = act.tasks?.filter((t) => t.status === 'concluido').length || 0;
                    const pctT = totalT > 0 ? Math.round((doneT / totalT) * 100) : 0;

                    return (
                      <div key={act.id} className="p-3 bg-white hover:bg-slate-50 transition-colors space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{act.title}</p>
                            <p className="text-[10px] text-slate-500">
                              {formatDateAO(act.startDate)} · <span className="capitalize font-semibold">{act.stage}</span>
                            </p>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 text-[9px] font-bold rounded shrink-0 ${
                              act.minute
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {act.minute ? 'Ata OK' : 'Sem Ata'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-blue-700 h-full rounded-full" style={{ width: `${pctT}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-slate-600 shrink-0">
                            {doneT}/{totalT} tarefas
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Painel: Análise Gráfica Executiva - Distribuição de Efetivo e (apenas se autorizado) Balanço Financeiro */}
      {currentUser.role !== 'membro' && (
        <div className={`grid grid-cols-1 ${canViewTreasury ? 'lg:grid-cols-2' : ''} gap-6 w-full max-w-full min-w-0`}>
          {/* Distribuição de Efetivo */}
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 w-full max-w-full min-w-0">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-900" />
                <span>Distribuição de Efetivo por Categoria</span>
              </h2>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {totalMembers} ativos
              </span>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Embaixadores ({embaixadoresCount})</span>
                  <span>{embPct}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${embPct}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Liderança e Direção ({lideresCount})</span>
                  <span>{lidPct}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-purple-600 h-full rounded-full transition-all duration-500" style={{ width: `${lidPct}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Aspirantes ({aspirantesCount})</span>
                  <span>{aspPct}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${aspPct}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Resumo Consolidado de Tesouraria - Estritamente visível apenas se treasury:VIEW estiver ativo */}
          {canViewTreasury && (
            <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 w-full max-w-full min-w-0">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-700" />
                  <span>Balanço Financeiro Consolidado (Kz)</span>
                </h2>
                <button
                  onClick={() => onNavigate('treasury')}
                  className="text-xs text-blue-900 font-semibold hover:underline cursor-pointer"
                >
                  Ver Tesouraria
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-xl">
                  <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-semibold mb-1">
                    <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Receitas Validadas</span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-emerald-900">{formatKz(totalIncomeCents)}</div>
                </div>

                <div className="bg-rose-50/70 border border-rose-200 p-3.5 rounded-xl">
                  <div className="flex items-center gap-1.5 text-rose-800 text-xs font-semibold mb-1">
                    <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                    <span>Despesas Pagas</span>
                  </div>
                  <div className="text-base sm:text-lg font-black text-rose-900">{formatKz(totalExpenseCents)}</div>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Saldo líquido apurado nas contas bancárias e de caixa</span>
                <span className="font-bold text-slate-900 font-mono">{formatKz(totalBalanceCents)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid Principal: Pendências Operacionais + Próximas Atividades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-full min-w-0">
        {/* Painel: Atividades e Reuniões Próximas */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden w-full max-w-full min-w-0">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-900" />
              <h2 className="text-sm font-bold text-slate-900">Calendário de Atividades do Clube</h2>
            </div>
            <button
              onClick={() => onNavigate('activities')}
              className="text-xs text-blue-900 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
            >
              <span>Ver Todas</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {state.activities.map((act) => (
              <div key={act.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{act.title}</h3>
                    <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                      <span>{formatDateAO(act.startDate)}</span>
                      <span>·</span>
                      <span>{act.location}</span>
                      <span>·</span>
                      <span className="capitalize font-medium text-slate-700">{act.stage}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate('activities')}
                    className="text-xs font-medium text-blue-900 hover:underline shrink-0"
                  >
                    Detalhes
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Painel: Circulares Institucionais Recentes */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden w-full max-w-full min-w-0">
          <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-blue-900" />
              <h2 className="text-sm font-bold text-slate-900">Circulares & Comunicados</h2>
            </div>
            <button
              onClick={() => onNavigate('requests')}
              className="text-xs text-blue-900 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
            >
              <span>Ver Todas</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {(state.circulars || [])
              .filter(c => c.targetRoles.includes(currentUser.role))
              .slice(0, 5)
              .map((circular) => (
              <div key={circular.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${circular.priority === 'urgente' ? 'bg-rose-500 animate-pulse' : circular.priority === 'alta' ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
                    <h3 className="text-xs font-bold text-slate-900">{circular.title}</h3>
                  </div>
                  <span className="text-[10px] text-slate-600 font-mono shrink-0">
                    {formatDateAO(circular.publishedAt)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">{circular.content}</p>
                <div className="text-[10px] text-slate-500 mt-2 flex items-center justify-between">
                  <span>Por: {circular.publishedByName}</span>
                  {currentUser.linkedMemberId && circular.readBy.includes(currentUser.linkedMemberId) && (
                    <span className="flex items-center gap-0.5 text-emerald-600 font-bold uppercase tracking-tighter">
                      <Check className="w-3 h-3" />
                      Lido
                    </span>
                  )}
                </div>
              </div>
            ))}
            {(state.circulars || []).filter(c => c.targetRoles.includes(currentUser.role)).length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                Nenhum comunicado oficial recente.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
