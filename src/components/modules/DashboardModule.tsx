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
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { formatKz } from '../../utils/currency';
import { formatDateAO } from '../../utils/date';
import { ROLE_LABELS } from '../../services/permissionService';
import { ModuleName } from '../../types';

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

  // Tesouraria
  const totalBalanceCents = state.accounts.reduce((acc, curr) => acc + curr.currentBalanceInCents, 0);
  const totalIncomeCents = state.receipts.filter((r) => !r.isCancelled).reduce((acc, r) => acc + r.amountPaidInCents, 0);
  const totalExpenseCents = state.expenses.filter((e) => e.status === 'pago').reduce((acc, e) => acc + e.amountInCents, 0);

  const pendingExpensesCount = state.expenses.filter((e) => e.status === 'solicitado').length;
  const pendingProofsCount = state.paymentProofs.filter((p) => p.status === 'submetido').length;

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
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Registar Membro</span>
              </button>
            )}
            {can('treasury', 'CREATE') && (
              <button
                onClick={() => onNavigate('treasury')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg transition-colors"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Emitir Recibo</span>
              </button>
            )}
            {currentUser.role === 'membro' && (
              <button
                onClick={() => onNavigate('member_portal')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-xs"
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

        {/* KPI: Tesouraria (Kz) - Apenas se autorizado */}
        {can('treasury', 'VIEW') ? (
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
        ) : (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs w-full max-w-full min-w-0">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Minhas Quotas</span>
              <Wallet className="w-4 h-4 text-blue-900 shrink-0" />
            </div>
            <div className="text-lg font-bold text-slate-900">Em Dia</div>
            <div className="text-xs text-slate-500 mt-2">Ano 2026 regularizado</div>
          </div>
        )}

        {/* KPI: Atividades e Reuniões */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs w-full max-w-full min-w-0">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Atividades em Curso</span>
            <Calendar className="w-4 h-4 text-blue-900 shrink-0" />
          </div>
          <div className="text-2xl font-black text-slate-900">{state.activities.length}</div>
          <div className="text-xs text-slate-500 mt-2">
            Próxima: Reunião Geral de Unidades
          </div>
        </div>

        {/* KPI: Pendências e Verificações */}
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
      </div>

      {/* Novo Painel: Análise Gráfica Executiva e Proporção de Efetivo - Apenas para Direção e Secretaria/Tesouraria */}
      {currentUser.role !== 'membro' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-full min-w-0">
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

          {/* Resumo Consolidado de Tesouraria */}
          <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 w-full max-w-full min-w-0">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-700" />
                <span>Balanço Financeiro Consolidado (Kz)</span>
              </h2>
              <button
                onClick={() => onNavigate('treasury')}
                className="text-xs text-blue-900 font-semibold hover:underline"
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
