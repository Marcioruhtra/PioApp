import React, { useState, useMemo } from 'react';
import {
  Wallet,
  Receipt,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  FileText,
  Printer,
  Lock,
  Unlock,
  ShieldAlert,
  CreditCard,
  Building2,
  HelpCircle,
  Trash2,
  Eye,
  SlidersHorizontal,
  Edit3,
  Calendar,
  TrendingUp,
  Eraser,
  RotateCcw,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import {
  ExpenseRequest,
  PaymentReceipt,
  TreasuryAccount,
  PaymentMethod,
  OfficialDocument,
  FeeDefinition,
  PaymentProofReport,
  QuotaBillingFrequency,
  MemberCategory,
} from '../../types';
import { formatKz, parseKzToCents } from '../../utils/currency';
import { formatDateAO, getMonthNamePT } from '../../utils/date';
import { getMemberTeamLabel, isDirectionMember } from '../../services/accountSyncService';
import {
  calculateClubQuotaTotals,
  calculateMemberQuotaSummary,
  getTodayISODate,
  MemberQuotaSummary,
  resolveQuotaConfig,
} from '../../services/quotaService';
import { Modal } from '../common/Modal';
import { EmptyState } from '../common/EmptyState';
import { PrintDocumentModal } from '../common/PrintDocumentModal';
import { ProofDocumentViewerModal } from '../common/ProofDocumentViewerModal';

export const TreasuryModule: React.FC = () => {
  const {
    state,
    can,
    currentUser,
    createReceipt,
    cancelReceipt,
    createExpense,
    approveExpense,
    rejectExpense,
    payExpense,
    closeFiscalMonth,
    reopenFiscalMonth,
    createFeeDefinition,
    updateFeeDefinition,
    deleteFeeDefinition,
    createTreasuryAccount,
    deleteTreasuryAccount,
    verifyPaymentProof,
    updateQuotaConfig,
    regularizeMemberQuota,
    waiveMemberQuotaDebt,
    waiveAllPendingQuotaDebts,
    reverseQuotaDebtWaiver,
  } = useClub();

  const hasFullTreasuryView = can('treasury', 'VIEW');

  // Separadores da Tesouraria
  const [activeTab, setActiveTab] = useState<
    'overview' | 'quotas' | 'receipts' | 'expenses' | 'closings' | 'proofs' | 'rubrics'
  >(hasFullTreasuryView ? 'overview' : 'quotas');

  // Estados dos Modais
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isCreateFeeModalOpen, setIsCreateFeeModalOpen] = useState(false);
  const [isCreateAccountModalOpen, setIsCreateAccountModalOpen] = useState(false);
  const [isCloseMonthModalOpen, setIsCloseMonthModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [selectedClosingId, setSelectedClosingId] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [selectedReceiptToCancel, setSelectedReceiptToCancel] = useState<PaymentReceipt | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [printedDocument, setPrintedDocument] = useState<OfficialDocument | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<TreasuryAccount | null>(null);
  const [feeToDelete, setFeeToDelete] = useState<FeeDefinition | null>(null);
  const [paymentModalData, setPaymentModalData] = useState<{
    expenseId: string;
    accountId: string;
  } | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [rejectModalData, setRejectModalData] = useState<{
    expenseId: string;
    title: string;
    amountInCents: number;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [selectedProofToReject, setSelectedProofToReject] = useState<PaymentProofReport | null>(null);
  const [selectedProofToView, setSelectedProofToView] = useState<PaymentProofReport | null>(null);
  const [proofRejectReason, setProofRejectReason] = useState('');
  const [proofRejectError, setProofRejectError] = useState<string | null>(null);
  const [receiptFormError, setReceiptFormError] = useState<string | null>(null);
  const [expenseFormError, setExpenseFormError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estados da Regularização e Configuração de Quotas
  const [quotaSearch, setQuotaSearch] = useState('');
  const [quotaStatusFilter, setQuotaStatusFilter] = useState<'all' | 'in_debt' | 'em_atraso' | 'parcial' | 'regularizado'>('all');
  const [quotaUnitFilter, setQuotaUnitFilter] = useState<string>('all');
  const [includeInactiveMembersInQuotas, setIncludeInactiveMembersInQuotas] = useState(false);

  const [isQuotaConfigModalOpen, setIsQuotaConfigModalOpen] = useState(false);
  const [quotaConfigError, setQuotaConfigError] = useState<string | null>(null);
  const [quotaConfigForm, setQuotaConfigForm] = useState<{
    amountStr: string;
    frequency: QuotaBillingFrequency;
    cycleStartDate: string;
    respectMemberJoinDate: boolean;
    useCategoryOverrides: boolean;
    embaixadorStr: string;
    liderStr: string;
    aspiranteStr: string;
  }>({
    amountStr: '500',
    frequency: 'domingo',
    cycleStartDate: `${state.settings.currentYear}-01-01`,
    respectMemberJoinDate: true,
    useCategoryOverrides: false,
    embaixadorStr: '',
    liderStr: '',
    aspiranteStr: '',
  });

  const [regularizeTarget, setRegularizeTarget] = useState<MemberQuotaSummary | null>(null);
  const [regularizeForm, setRegularizeForm] = useState<{
    amountStr: string;
    paymentMethod: PaymentMethod;
    accountId: string;
    periodLabel: string;
    referenceOrProof: string;
    notes: string;
  }>({
    amountStr: '',
    paymentMethod: 'numerario',
    accountId: state.accounts[0]?.id || '',
    periodLabel: '',
    referenceOrProof: '',
    notes: '',
  });
  const [regularizeError, setRegularizeError] = useState<string | null>(null);
  const [statementTarget, setStatementTarget] = useState<MemberQuotaSummary | null>(null);

  // Estados para Zerar Dívida de Quotas
  const [waiveTarget, setWaiveTarget] = useState<MemberQuotaSummary | null>(null);
  const [waiveMode, setWaiveMode] = useState<'full' | 'partial'>('full');
  const [waiveCustomAmountStr, setWaiveCustomAmountStr] = useState('');
  const [waiveReason, setWaiveReason] = useState('');
  const [waiveError, setWaiveError] = useState<string | null>(null);

  const [isBulkWaiveModalOpen, setIsBulkWaiveModalOpen] = useState(false);
  const [bulkWaiveReason, setBulkWaiveReason] = useState('');
  const [bulkWaiveError, setBulkWaiveError] = useState<string | null>(null);

  const [reversingWaiverId, setReversingWaiverId] = useState<string | null>(null);
  const [reverseWaiverReason, setReverseWaiverReason] = useState('');
  const [reverseWaiverError, setReverseWaiverError] = useState<string | null>(null);

  // Edição de Rubricas Financeiras
  const [editingFee, setEditingFee] = useState<FeeDefinition | null>(null);
  const [editFeeForm, setEditFeeForm] = useState({
    title: '',
    amountStr: '',
    active: true,
  });

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setActionFeedback({ type, message });
    setTimeout(() => setActionFeedback(null), 4000);
  };

  // Formulário de Emissão de Recibo Manual
  const [receiptForm, setReceiptForm] = useState({
    memberId: state.members[0]?.id || '',
    feeDefinitionId: state.fees[0]?.id || '',
    periodLabel: 'Março 2026',
    amountStr: '2500',
    paymentMethod: 'multicaixa_express' as PaymentMethod,
    notes: '',
    customDonorName: '',
    accountId: state.accounts[0]?.id || '',
  });

  // Formulário de Solicitação de Despesa
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    description: '',
    category: 'Material de Instrução',
    amountStr: '',
    accountId: 'ACC-01',
  });

  // Fecho Mensal
  const [closingMonth, setClosingMonth] = useState(3);
  const [closingYear, setClosingYear] = useState(state.settings.currentYear);

  // Cálculos Gerais em Inteiros (Cêntimos)
  const totalBalanceCents = useMemo(
    () => state.accounts.reduce((acc, curr) => acc + curr.currentBalanceInCents, 0),
    [state.accounts]
  );

  const totalIncomeCents = useMemo(
    () =>
      state.receipts
        .filter((r) => !r.isCancelled)
        .reduce((acc, curr) => acc + curr.amountPaidInCents, 0),
    [state.receipts]
  );

  const totalExpenseCents = useMemo(
    () =>
      state.expenses
        .filter((e) => e.status === 'pago')
        .reduce((acc, curr) => acc + curr.amountInCents, 0),
    [state.expenses]
  );

  // Motor de Recálculo Automático de Quotas por Membro
  const activeQuotaConfig = useMemo(
    () => resolveQuotaConfig(state.settings, state.fees),
    [state.settings, state.fees]
  );

  const todayISO = getTodayISODate();

  const quotaEligibleMembers = useMemo(
    () =>
      state.members.filter((m) =>
        includeInactiveMembersInQuotas ? true : m.status === 'ativo'
      ),
    [state.members, includeInactiveMembersInQuotas]
  );

  const memberQuotaSummaries = useMemo(
    () =>
      quotaEligibleMembers.map((member) =>
        calculateMemberQuotaSummary(
          member,
          activeQuotaConfig,
          state.fees,
          state.receipts,
          todayISO,
          state.quotaWaivers || []
        )
      ),
    [quotaEligibleMembers, activeQuotaConfig, state.fees, state.receipts, todayISO, state.quotaWaivers]
  );

  const clubQuotaTotals = useMemo(
    () => calculateClubQuotaTotals(memberQuotaSummaries),
    [memberQuotaSummaries]
  );

  const quotaAvailableTeams = useMemo(() => {
    const teams = new Set<string>();
    state.members.forEach((m) => {
      if (isDirectionMember(m, state.users)) {
        teams.add('Direção');
      } else if (m.unitOrTeam?.trim()) {
        teams.add(m.unitOrTeam.trim());
      }
    });
    return Array.from(teams).sort((a, b) => a.localeCompare(b));
  }, [state.members, state.users]);

  const filteredQuotaSummaries = useMemo(() => {
    const q = quotaSearch.trim().toLowerCase();
    return memberQuotaSummaries
      .filter((s) => {
        if (quotaStatusFilter === 'in_debt' && s.balanceDueInCents <= 0) return false;
        if (quotaStatusFilter === 'em_atraso' && s.status !== 'em_atraso') return false;
        if (quotaStatusFilter === 'parcial' && s.status !== 'parcial') return false;
        if (
          quotaStatusFilter === 'regularizado' &&
          s.status !== 'regularizado' &&
          s.status !== 'antecipado'
        ) {
          return false;
        }

        const memberTeamLabel = getMemberTeamLabel(s.member, state.users);
        if (quotaUnitFilter === '__sem_equipa__' && (s.member.unitOrTeam?.trim() || isDirectionMember(s.member, state.users))) {
          return false;
        }
        if (
          quotaUnitFilter !== 'all' &&
          quotaUnitFilter !== '__sem_equipa__' &&
          memberTeamLabel.toLowerCase() !== quotaUnitFilter.toLowerCase()
        ) {
          return false;
        }

        if (q) {
          const matchName = s.member.fullName.toLowerCase().includes(q);
          const matchNum = (s.member.manualNumber || '').toLowerCase().includes(q);
          const matchTeam = memberTeamLabel.toLowerCase().includes(q);
          if (!matchName && !matchNum && !matchTeam) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (b.balanceDueInCents !== a.balanceDueInCents) {
          return b.balanceDueInCents - a.balanceDueInCents;
        }
        return a.member.fullName.localeCompare(b.member.fullName);
      });
  }, [memberQuotaSummaries, quotaSearch, quotaStatusFilter, quotaUnitFilter]);

  const openQuotaConfigModal = () => {
    const overrides = activeQuotaConfig.categoryAmountsInCents || {};
    const hasOverrides =
      typeof overrides.embaixador === 'number' ||
      typeof overrides.lider === 'number' ||
      typeof overrides.aspirante === 'number';

    setQuotaConfigForm({
      amountStr: String(Math.round(activeQuotaConfig.amountInCents / 100)),
      frequency: activeQuotaConfig.frequency,
      cycleStartDate: activeQuotaConfig.cycleStartDate,
      respectMemberJoinDate: activeQuotaConfig.respectMemberJoinDate,
      useCategoryOverrides: hasOverrides,
      embaixadorStr:
        typeof overrides.embaixador === 'number' ? String(Math.round(overrides.embaixador / 100)) : '',
      liderStr: typeof overrides.lider === 'number' ? String(Math.round(overrides.lider / 100)) : '',
      aspiranteStr:
        typeof overrides.aspirante === 'number' ? String(Math.round(overrides.aspirante / 100)) : '',
    });
    setQuotaConfigError(null);
    setIsQuotaConfigModalOpen(true);
  };

  const openRegularizeModal = (summary: MemberQuotaSummary) => {
    const suggestedCents =
      summary.balanceDueInCents > 0 ? summary.balanceDueInCents : summary.unitQuotaInCents;
    const defaultCashAcc =
      state.accounts.find((a) => a.type === 'caixa' && a.active)?.id ||
      state.accounts.find((a) => a.active)?.id ||
      state.accounts[0]?.id ||
      '';

    setRegularizeTarget(summary);
    setRegularizeForm({
      amountStr: String(Math.round(suggestedCents / 100)),
      paymentMethod: 'numerario',
      accountId: defaultCashAcc,
      periodLabel:
        summary.balanceDueInCents > 0
          ? `Regularização de ${summary.remainingPeriods} ${
              summary.frequency === 'domingo'
                ? summary.remainingPeriods === 1
                  ? 'domingo'
                  : 'domingos'
                : summary.remainingPeriods === 1
                ? 'mês'
                : 'meses'
            } (${state.settings.currentYear})`
          : `Quota Adiantada (${state.settings.currentYear})`,
      referenceOrProof: '',
      notes: '',
    });
    setRegularizeError(null);
  };

  const openWaiveModal = (summary: MemberQuotaSummary) => {
    setWaiveTarget(summary);
    setWaiveMode('full');
    setWaiveCustomAmountStr(String(Math.round(summary.balanceDueInCents / 100)));
    setWaiveReason('Isenção autorizada pela Direção');
    setWaiveError(null);
  };

  const filteredInDebtSummaries = useMemo(
    () => filteredQuotaSummaries.filter((s) => s.balanceDueInCents > 0),
    [filteredQuotaSummaries]
  );

  const filteredInDebtTotalCents = useMemo(
    () => filteredInDebtSummaries.reduce((acc, s) => acc + s.balanceDueInCents, 0),
    [filteredInDebtSummaries]
  );

  const liveStatementTarget = useMemo(() => {
    if (!statementTarget) return null;
    return memberQuotaSummaries.find((s) => s.member.id === statementTarget.member.id) || statementTarget;
  }, [statementTarget, memberQuotaSummaries]);

  const selectedFee = state.fees.find((f) => f.id === receiptForm.feeDefinitionId);
  const isDonation = selectedFee?.category === 'doacao' || selectedFee?.title.toLowerCase().includes('doaç') || selectedFee?.title.toLowerCase().includes('doacao');

  // Emissão de Recibo
  const handleReceiptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReceiptFormError(null);
    const cents = parseKzToCents(receiptForm.amountStr);
    if (cents <= 0) {
      setReceiptFormError('O valor em Kz deve ser superior a zero.');
      return;
    }

    const targetAccountId = receiptForm.accountId || state.accounts.find(a => a.active)?.id || state.accounts[0]?.id;

    const res = createReceipt({
      memberId: receiptForm.memberId === 'CUSTOM' ? '' : receiptForm.memberId,
      feeDefinitionId: receiptForm.feeDefinitionId,
      periodLabel: receiptForm.periodLabel,
      amountPaidInCents: cents,
      paymentMethod: receiptForm.paymentMethod,
      notes: receiptForm.notes || undefined,
      customDonorName: receiptForm.memberId === 'CUSTOM' || isDonation ? receiptForm.customDonorName || undefined : undefined,
      accountId: targetAccountId,
    });

    if (res.success) {
      // Fecha o modal e limpa o formulário imediatamente
      setIsReceiptModalOpen(false);
      setReceiptFormError(null);
      setReceiptForm({
        memberId: state.members[0]?.id || '',
        feeDefinitionId: state.fees[0]?.id || '',
        periodLabel: 'Março 2026',
        amountStr: '2500',
        paymentMethod: 'multicaixa_express',
        notes: '',
        customDonorName: '',
        accountId: state.accounts[0]?.id || '',
      });
    } else {
      setReceiptFormError(res.error || 'Erro ao emitir recibo.');
    }
  };

  // Solicitação de Despesa
  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseFormError(null);
    const cents = parseKzToCents(expenseForm.amountStr);
    if (cents <= 0) {
      setExpenseFormError('Introduza um montante válido superior a zero.');
      return;
    }
    if (!expenseForm.title.trim()) {
      setExpenseFormError('O título da despesa é obrigatório.');
      return;
    }

    const res = createExpense({
      title: expenseForm.title.trim(),
      description: expenseForm.description.trim(),
      category: expenseForm.category,
      amountInCents: cents,
      accountId: expenseForm.accountId,
    });

    if (res.success) {
      setIsExpenseModalOpen(false);
      setExpenseFormError(null);
      setExpenseForm({
        title: '',
        description: '',
        category: 'Material de Instrução',
        amountStr: '',
        accountId: 'ACC-01',
      });
    } else {
      setExpenseFormError(res.error || 'Erro ao solicitar despesa.');
    }
  };

  // Anulação de Recibo
  const handleCancelReceiptConfirm = () => {
    if (!selectedReceiptToCancel) return;
    const res = cancelReceipt(selectedReceiptToCancel.id, cancelReason);
    if (res.success) {
      setSelectedReceiptToCancel(null);
      setCancelReason('');
      showFeedback('success', 'Recibo anulado com sucesso.');
    } else {
      showFeedback('error', res.error || 'Erro ao anular recibo.');
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {actionFeedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-xs transition-all ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span>{actionFeedback.message}</span>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="font-bold ml-2 text-sm hover:opacity-75"
          >
            ×
          </button>
        </div>
      )}

      {/* Topo do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs w-full max-w-full min-w-0">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-blue-900 shrink-0" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Tesouraria e Gestão Financeira (Kz)
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controlo de quotas, contas bancárias/caixa, emissão de recibos, pedidos de despesa e fecho fiscal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasFullTreasuryView && can('treasury', 'CREATE') && (
            <button
              onClick={() => setIsReceiptModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Emitir Recibo Manual</span>
            </button>
          )}

          {hasFullTreasuryView && (
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Pedir Despesa</span>
            </button>
          )}
        </div>
      </div>

      {/* Cartões de Indicadores Financeiros em Kwanza (Apenas para perfis com leitura financeira geral) */}
      {hasFullTreasuryView && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Disponibilidade Geral</span>
              <Wallet className="w-4 h-4 text-blue-900" />
            </div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">{formatKz(totalBalanceCents)}</div>
            <div className="text-[11px] text-slate-500 mt-1">Saldo somado de todas as contas ativas</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Receitas Confirmadas</span>
              <ArrowDownRight className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700 tabular-nums">{formatKz(totalIncomeCents)}</div>
            <div className="text-[11px] text-slate-500 mt-1">{state.receipts.filter((r) => !r.isCancelled).length} recibos válidos</div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Despesas Executadas</span>
              <ArrowUpRight className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-black text-rose-700 tabular-nums">{formatKz(totalExpenseCents)}</div>
            <div className="text-[11px] text-slate-500 mt-1">{state.expenses.filter((e) => e.status === 'pago').length} despesas pagas</div>
          </div>
        </div>
      )}

      {/* Separadores Funcionais da Tesouraria */}
      <div className="flex items-center gap-1 border-b border-slate-200 text-xs overflow-x-auto whitespace-nowrap pb-px w-full max-w-full min-w-0">
        {hasFullTreasuryView && (
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === 'overview'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Contas e Balanço
          </button>
        )}
        <button
          onClick={() => setActiveTab('quotas')}
          className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
            activeTab === 'quotas'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Regularização de Quotas</span>
          {clubQuotaTotals.inDebtCount > 0 ? (
            <span className="px-1.5 py-0.5 text-[10px] bg-amber-500 text-white rounded-full font-bold tabular-nums">
              {clubQuotaTotals.inDebtCount}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 text-[10px] bg-emerald-600 text-white rounded-full font-bold tabular-nums">
              100%
            </span>
          )}
        </button>
        {hasFullTreasuryView && (
          <>
            <button
              onClick={() => setActiveTab('receipts')}
              className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === 'receipts'
                  ? 'border-blue-900 text-blue-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Recibos Oficiais ({state.receipts.length})
            </button>
            <button
              onClick={() => setActiveTab('proofs')}
              className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
                activeTab === 'proofs'
                  ? 'border-blue-900 text-blue-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>Comprovativos Reportados</span>
              {state.paymentProofs.filter((p) => p.status === 'submetido').length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-amber-500 text-white rounded-full font-bold">
                  {state.paymentProofs.filter((p) => p.status === 'submetido').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === 'expenses'
                  ? 'border-blue-900 text-blue-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Despesas e Aprovações ({state.expenses.length})
            </button>
            <button
              onClick={() => setActiveTab('rubrics')}
              className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === 'rubrics'
                  ? 'border-blue-900 text-blue-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Rubricas Financeiras
            </button>
            <button
              onClick={() => setActiveTab('closings')}
              className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === 'closings'
                  ? 'border-blue-900 text-blue-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Fecho Mensal e Reconciliação
            </button>
          </>
        )}
      </div>

      {/* CONTEÚDO 1: Visão Geral de Contas */}
      {activeTab === 'overview' && (
        <div className="space-y-4 w-full max-w-full min-w-0">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden w-full max-w-full min-w-0">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Contas Institucionais do Clube de Embaixadores Pioneiros D'Alvorada
              </h2>
              {can('treasury', 'CREATE_ACCOUNT') && (
                <button
                  onClick={() => setIsCreateAccountModalOpen(true)}
                  className="px-3 py-1.5 text-[10px] font-bold bg-blue-900 text-white rounded shadow-sm hover:bg-blue-800 flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Plus size={12} />
                  Criar Conta
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              {state.accounts.map((acc) => (
                <div key={acc.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                      {acc.type === 'banco' ? (
                        <Building2 className="w-5 h-5 text-blue-900" />
                      ) : (
                        <Wallet className="w-5 h-5 text-slate-700" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">{acc.name}</h3>
                      {acc.accountNumber && (
                        <p className="text-[11px] font-mono text-slate-500 mt-0.5">{acc.accountNumber}</p>
                      )}
                    </div>
                  </div>

                  <div className="text-left sm:text-right flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto">
                    <div>
                      <div className="text-sm font-black text-slate-900">{formatKz(acc.currentBalanceInCents)}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Saldo Atual</div>
                    </div>
                    {can('treasury', 'DELETE_ACCOUNT') && (
                      <button
                        onClick={() => setAccountToDelete(acc)}
                        className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 rounded-md transition-colors border border-rose-200 flex items-center gap-1 shadow-2xs"
                        title="Remover Conta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO 1.5: Regularização de Quotas (Recálculo Automático por Domingo / Ciclo) */}
      {activeTab === 'quotas' && (
        <div className="space-y-4 w-full max-w-full min-w-0">
          {/* Painel da Regra Ativa de Quota */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-950 text-xs font-extrabold">
                  <Calendar className="w-3.5 h-3.5 text-blue-800" />
                  <span>
                    Quota Atual: {formatKz(activeQuotaConfig.amountInCents)} /{' '}
                    {activeQuotaConfig.frequency === 'domingo' ? 'Cada Domingo' : 'Mês'}
                  </span>
                </span>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  Início do Ciclo: {formatDateAO(activeQuotaConfig.cycleStartDate)}
                </span>
                {activeQuotaConfig.respectMemberJoinDate && (
                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    Respeita data de admissão
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600">
                Cada {activeQuotaConfig.frequency === 'domingo' ? 'domingo' : 'mês'} decorrido no ciclo é automaticamente somado ao valor devido por membro e confrontado com os recibos confirmados de quotas.
                {activeQuotaConfig.updatedByName && activeQuotaConfig.updatedAt && (
                  <span className="text-slate-500">
                    {' '}
                    · Definida por <strong>{activeQuotaConfig.updatedByName}</strong> em{' '}
                    {formatDateAO(activeQuotaConfig.updatedAt)}.
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {can('treasury', 'WAIVE_QUOTA_DEBT') && filteredInDebtSummaries.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setBulkWaiveReason('Isenção / regularização global autorizada pela Direção');
                    setBulkWaiveError(null);
                    setIsBulkWaiveModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg shadow-2xs transition-colors whitespace-nowrap shrink-0"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Zerar Dívidas ({filteredInDebtSummaries.length})</span>
                </button>
              )}

              {can('treasury', 'CONFIGURE_QUOTAS') ? (
                <button
                  type="button"
                  onClick={openQuotaConfigModal}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Definir / Alterar Valor da Quota</span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg whitespace-nowrap shrink-0">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Valor definido pela Tesouraria / Direção</span>
                </div>
              )}
            </div>
          </div>

          {/* Indicadores de Recálculo Global de Quotas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Esperado ({clubQuotaTotals.totalMembers} membros)
              </div>
              <div className="text-lg font-black text-slate-900 mt-1 tabular-nums">
                {formatKz(clubQuotaTotals.totalDueInCents)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                {clubQuotaTotals.totalWaivedInCents > 0
                  ? `Dívidas zeradas: ${formatKz(clubQuotaTotals.totalWaivedInCents)}`
                  : `Recalculado até hoje (${formatDateAO(todayISO)})`}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Já Pago em Quotas
              </div>
              <div className="text-lg font-black text-emerald-700 mt-1 tabular-nums">
                {formatKz(clubQuotaTotals.totalPaidInCents)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Soma de recibos válidos de quota
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Saldo por Regularizar
              </div>
              <div className="text-lg font-black text-rose-700 mt-1 tabular-nums">
                {formatKz(clubQuotaTotals.totalBalanceDueInCents)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                {clubQuotaTotals.inDebtCount} {clubQuotaTotals.inDebtCount === 1 ? 'membro pendente' : 'membros pendentes'}
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <span>Taxa de Conformidade</span>
                <TrendingUp className="w-3.5 h-3.5 text-blue-900" />
              </div>
              <div className="text-lg font-black text-blue-900 mt-1 tabular-nums">
                {clubQuotaTotals.complianceRatePercent}%
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                {clubQuotaTotals.regularizedCount} de {clubQuotaTotals.totalMembers} em dia
              </div>
            </div>
          </div>

          {/* Filtros e Pesquisa */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={quotaSearch}
                  onChange={(e) => setQuotaSearch(e.target.value)}
                  placeholder="Pesquisar membro, nº ou equipa..."
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-900"
                />
              </div>

              <select
                value={quotaStatusFilter}
                onChange={(e) => setQuotaStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-900"
              >
                <option value="all">Todas as Situações ({memberQuotaSummaries.length})</option>
                <option value="in_debt">Com Saldo em Dívida ({clubQuotaTotals.inDebtCount})</option>
                <option value="em_atraso">Em Atraso - Sem Pagamentos ({clubQuotaTotals.overdueCount})</option>
                <option value="parcial">Pagamento Parcial ({clubQuotaTotals.partialCount})</option>
                <option value="regularizado">Regularizados / Antecipados ({clubQuotaTotals.regularizedCount})</option>
              </select>

              <select
                value={quotaUnitFilter}
                onChange={(e) => setQuotaUnitFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-900"
              >
                <option value="all">Todas as Equipas</option>
                <option value="__sem_equipa__">Sem Equipa</option>
                {quotaAvailableTeams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2 text-xs text-slate-700 px-2 py-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeInactiveMembersInQuotas}
                  onChange={(e) => setIncludeInactiveMembersInQuotas(e.target.checked)}
                  className="rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                />
                <span>Incluir inativos/arquivados</span>
              </label>
            </div>

            {/* Tabela de Quotas por Membro */}
            {filteredQuotaSummaries.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Nenhum membro encontrado"
                description="Ajuste os filtros de pesquisa ou cadastre membros ativos para calcular as quotas."
              />
            ) : (
              <div className="overflow-x-auto w-full max-w-full min-w-0 border-t border-slate-100 pt-2">
                <table className="w-full min-w-[880px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3">Membro / Equipa</th>
                      <th className="py-3 px-3">Regime / Períodos</th>
                      <th className="py-3 px-3">Total Devido</th>
                      <th className="py-3 px-3">Já Pago & Progresso</th>
                      <th className="py-3 px-3">Saldo / Crédito</th>
                      <th className="py-3 px-3">Situação</th>
                      <th className="py-3 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredQuotaSummaries.map((s) => {
                      const periodNoun =
                        s.frequency === 'domingo'
                          ? s.periodsCharged === 1
                            ? 'domingo'
                            : 'domingos'
                          : s.periodsCharged === 1
                          ? 'mês'
                          : 'meses';

                      return (
                        <tr key={s.member.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{s.member.fullName}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-semibold text-slate-700">
                                {s.member.manualNumber}
                              </span>
                              <span>·</span>
                              <span>{getMemberTeamLabel(s.member, state.users)}</span>
                              <span>·</span>
                              <span className="capitalize">{s.member.category}</span>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-semibold text-slate-800">
                              {s.periodsCharged} {periodNoun}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {formatKz(s.unitQuotaInCents)} /{' '}
                              {s.frequency === 'domingo' ? 'domingo' : 'mês'}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 tabular-nums">
                              {formatKz(s.totalDueInCents)}
                            </div>
                            {s.totalWaivedInCents > 0 && (
                              <div className="text-[10px] text-amber-800 mt-0.5 tabular-nums">
                                Bruto {formatKz(s.grossDueInCents)} · Zerado -{formatKz(s.totalWaivedInCents)}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3 min-w-[180px]">
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-bold text-emerald-700">
                                {formatKz(s.totalPaidInCents)}
                              </span>
                              <span className="text-slate-500 font-medium">{s.progressPercent}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  s.status === 'regularizado' || s.status === 'antecipado'
                                    ? 'bg-emerald-600'
                                    : s.status === 'parcial'
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${s.progressPercent}%` }}
                              />
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Equiv. {s.paidPeriodsEquivalent} de {s.periodsCharged}{' '}
                              {s.frequency === 'domingo' ? 'dom.' : 'm.'}
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            {s.balanceDueInCents > 0 ? (
                              <div>
                                <div className="font-black text-rose-700">
                                  -{formatKz(s.balanceDueInCents)}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Falta(m) {s.remainingPeriods}{' '}
                                  {s.frequency === 'domingo'
                                    ? s.remainingPeriods === 1
                                      ? 'domingo'
                                      : 'domingos'
                                    : s.remainingPeriods === 1
                                    ? 'mês'
                                    : 'meses'}
                                </div>
                              </div>
                            ) : s.creditInCents > 0 ? (
                              <div>
                                <div className="font-black text-blue-800">
                                  +{formatKz(s.creditInCents)}
                                </div>
                                <div className="text-[10px] text-blue-700">Crédito antecipado</div>
                              </div>
                            ) : (
                              <span className="font-bold text-emerald-700">0,00 Kz</span>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            {s.status === 'antecipado' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-800 border border-blue-200">
                                <CheckCircle2 className="w-3 h-3" />
                                Antecipado
                              </span>
                            )}
                            {s.status === 'regularizado' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                Regularizado
                              </span>
                            )}
                            {s.status === 'parcial' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3" />
                                Parcial
                              </span>
                            )}
                            {s.status === 'em_atraso' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-50 text-rose-800 border border-rose-200">
                                <AlertTriangle className="w-3 h-3" />
                                Em Atraso
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end flex-nowrap">
                              <button
                                type="button"
                                onClick={() => setStatementTarget(s)}
                                className="p-1.5 text-slate-500 hover:text-blue-900 bg-slate-100 hover:bg-blue-50 rounded-md transition-colors shrink-0"
                                title="Ver Extrato de Quotas"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {can('treasury', 'CREATE') && (
                                <button
                                  type="button"
                                  onClick={() => openRegularizeModal(s)}
                                  className={`px-2.5 py-1.5 text-[11px] font-bold rounded-md shadow-2xs transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                                    s.balanceDueInCents > 0
                                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{s.balanceDueInCents > 0 ? 'Regularizar' : 'Adiantar'}</span>
                                </button>
                              )}
                              {can('treasury', 'WAIVE_QUOTA_DEBT') && s.balanceDueInCents > 0 && (
                                <button
                                  type="button"
                                  onClick={() => openWaiveModal(s)}
                                  className="px-2.5 py-1.5 text-[11px] font-bold rounded-md border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                                  title="Zerar dívida de quotas deste membro"
                                >
                                  <Eraser className="w-3.5 h-3.5" />
                                  <span>Zerar Dívida</span>
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

      {/* CONTEÚDO 2: Recibos Emitidos */}
      {activeTab === 'receipts' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden w-full max-w-full min-w-0">
          <div className="overflow-x-auto w-full max-w-full min-w-0">
            <table className="w-full min-w-[750px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Número do Recibo</th>
                  <th className="py-3 px-4">Membro</th>
                  <th className="py-3 px-4">Conceito / Período</th>
                  <th className="py-3 px-4">Método</th>
                  <th className="py-3 px-4">Valor em Kz</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {state.receipts.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {r.receiptNumber}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {r.memberName}
                    </td>
                    <td className="py-3 px-4">
                      <div>{r.feeTitle}</div>
                      <div className="text-[10px] text-slate-500">{r.periodLabel}</div>
                    </td>
                    <td className="py-3 px-4 capitalize text-[11px]">
                      {r.paymentMethod.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {formatKz(r.amountPaidInCents)}
                    </td>
                    <td className="py-3 px-4">
                      {r.isCancelled ? (
                        <span className="text-[10px] font-bold text-rose-700 uppercase">Anulado</span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700 uppercase">Confirmado</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        {(() => {
                          const matchingProof = state.paymentProofs.find(
                            (p) => (r.referenceOrProof && (p.referenceCode === r.referenceOrProof || p.id === r.referenceOrProof)) ||
                                   (p.memberId === r.memberId && p.amountInCents === r.amountPaidInCents && p.feeDefinitionId === r.feeDefinitionId)
                          );
                          if (!matchingProof) return null;
                          return (
                            <button
                              onClick={() => setSelectedProofToView(matchingProof)}
                              className="p-1.5 text-slate-500 hover:text-blue-900 rounded cursor-pointer"
                              title={`Ver Comprovativo do Membro (${matchingProof.attachmentFileName})`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          );
                        })()}
                        <button
                          onClick={() => {
                            const member = state.members.find(m => m.id === r.memberId || m.manualNumber === r.memberId || m.fullName === r.memberName);
                            setPrintedDocument({
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
                              cancellationReason: r.cancellationReason,
                            });
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-900 rounded"
                          title="Imprimir Recibo"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {can('treasury', 'EDIT') && !r.isCancelled && (
                          <button
                            onClick={() => setSelectedReceiptToCancel(r)}
                            className="p-1.5 text-slate-500 hover:text-rose-700 rounded"
                            title="Anular Recibo (Exige motivo obrigatório)"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTEÚDO: Comprovativos Reportados */}
      {activeTab === 'proofs' && (
        <div className="space-y-4 w-full max-w-full min-w-0">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden w-full max-w-full min-w-0">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Comprovativos de Pagamento Reportados por Membros
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Verifique os comprovativos enviados e aprove para creditar automaticamente a conta escolhida e gerar o recibo oficial.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full self-start sm:self-auto shrink-0">
                {state.paymentProofs.length} submissões
              </span>
            </div>

            {state.paymentProofs.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Nenhum comprovativo reportado"
                description="Os membros ainda não submeteram comprovativos de pagamento online."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {state.paymentProofs.map((p) => {
                  const isPending = p.status === 'submetido';
                  const isConfirmed = p.status === 'confirmado';
                  return (
                    <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs">{p.memberName}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                            {p.id}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                            isConfirmed ? 'bg-emerald-100 text-emerald-800' : p.status === 'rejeitado' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isConfirmed ? 'Confirmado' : p.status === 'rejeitado' ? 'Rejeitado' : 'Pendente de Verificação'}
                          </span>
                        </div>

                        <div className="text-xs text-slate-700 font-semibold flex items-center gap-2 flex-wrap">
                          <span>Taxa: {p.feeTitle}</span>
                          <span>·</span>
                          <span className="text-blue-900">Montante: {formatKz(p.amountInCents)}</span>
                        </div>

                        <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
                          <span>Ref: <strong className="font-mono text-slate-700">{p.referenceCode}</strong></span>
                          <span>·</span>
                          <span>Método: {p.paymentMethod.replace('_', ' ')}</span>
                          <span>·</span>
                          <span>Data: {formatDateAO(p.paymentDate)}</span>
                          <span>·</span>
                          <span className="text-blue-800 font-semibold">Conta de Destino: {p.accountName || 'Conta Geral'}</span>
                        </div>

                        {p.rejectionReason && (
                          <div className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded border border-rose-200 mt-1">
                            Motivo da Rejeição: {p.rejectionReason}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {/* Botão Oficial: Tesoureiro Visualizar Documento Anexado */}
                        <button
                          onClick={() => setSelectedProofToView(p)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-xs transition-colors cursor-pointer"
                          title="Visualizar documento / comprovativo anexado pelo membro"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Comprovativo</span>
                        </button>

                        {isPending && can('treasury', 'APPROVE') && (
                          <>
                            <button
                              onClick={() => {
                                const res = verifyPaymentProof(p.id, true);
                                if (!res.success) {
                                  showFeedback('error', res.error || 'Erro ao aprovar comprovativo.');
                                } else {
                                  showFeedback('success', 'Comprovativo aprovado e recibo emitido com sucesso.');
                                }
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Aprovar e Gerar Recibo</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedProofToReject(p);
                                setProofRejectReason('');
                                setProofRejectError(null);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Rejeitar</span>
                            </button>
                          </>
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

      {/* CONTEÚDO 3: Despesas e Aprovações */}
      {activeTab === 'expenses' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden w-full max-w-full min-w-0">
          <div className="divide-y divide-slate-100">
            {state.expenses.map((exp) => (
              <div key={exp.id} className="p-4 hover:bg-slate-50/80 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-slate-400 font-bold">{exp.id}</span>
                      <h3 className="text-xs font-bold text-slate-900">{exp.title}</h3>
                      <span className="text-[10px] uppercase font-bold text-slate-500">· {exp.category}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{exp.description}</p>
                    <div className="text-[11px] text-slate-500 mt-2 flex flex-wrap items-center gap-3">
                      <span>Solicitado por: <strong>{exp.requestedByName}</strong></span>
                      <span>·</span>
                      <span>Data: {formatDateAO(exp.createdAt)}</span>
                      {exp.approvedByName && (
                        <>
                          <span>·</span>
                          <span className="text-blue-900">Aprovador: <strong>{exp.approvedByName}</strong></span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <div className="text-base font-black text-slate-900">{formatKz(exp.amountInCents)}</div>

                    <div className="flex items-center gap-2">
                      {exp.status === 'solicitado' && can('treasury', 'APPROVE') && (
                        <>
                          <button
                            onClick={() => {
                              const res = approveExpense(exp.id, 'Despesa conferida e autorizada para pagamento.');
                              if (!res.success) {
                                showFeedback('error', res.error || 'Erro ao aprovar despesa.');
                              } else {
                                showFeedback('success', 'Despesa aprovada com sucesso.');
                              }
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-blue-900 hover:bg-blue-800 text-white rounded transition-colors shadow-2xs"
                          >
                            Aprovar
                          </button>
                          <button
                            onClick={() => {
                              setRejectModalData({
                                expenseId: exp.id,
                                title: exp.title,
                                amountInCents: exp.amountInCents,
                              });
                              setRejectReason('Despesa não autorizada pela Direção.');
                              setRejectError(null);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-rose-700 hover:bg-rose-800 text-white rounded transition-colors shadow-2xs"
                          >
                            Não Aprovar
                          </button>
                        </>
                      )}

                      {exp.status === 'aprovado' && (can('treasury', 'CREATE') || can('treasury', 'APPROVE') || currentUser.role === 'admin_tecnico' || currentUser.role === 'diretor' || currentUser.role === 'tesoureiro') && (
                        <button
                          onClick={() => {
                            const preferredAccount = state.accounts.find(a => a.active && a.currentBalanceInCents >= exp.amountInCents) 
                              || state.accounts.find(a => a.active) 
                              || state.accounts[0];
                            setPaymentModalData({
                              expenseId: exp.id,
                              accountId: preferredAccount?.id || 'ACC-01',
                            });
                            setPaymentError(null);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded transition-colors shadow-2xs"
                        >
                          Efetuar Pagamento
                        </button>
                      )}

                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        exp.status === 'pago'
                          ? 'bg-emerald-50 text-emerald-800'
                          : exp.status === 'aprovado'
                          ? 'bg-blue-50 text-blue-800'
                          : 'bg-amber-50 text-amber-800'
                      }`}>
                        {exp.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTEÚDO 4: Rubricas Financeiras */}
      {activeTab === 'rubrics' && (
        <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs w-full max-w-full min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Gestão de Rubricas Financeiras</h2>
            {can('treasury', 'CREATE_RUBRIC') && (
              <button
                onClick={() => setIsCreateFeeModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 bg-blue-950 hover:bg-blue-900 text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm transition-all self-start sm:self-auto"
              >
                <Plus size={16} />
                <span>Criar Rubrica</span>
              </button>
            )}
          </div>
          <div className="overflow-x-auto w-full max-w-full min-w-0">
            <table className="w-full min-w-[750px] text-xs text-left text-slate-600">
              <thead className="text-[10px] text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="p-3">Nome da Rubrica</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Periodicidade</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.fees.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-900">{f.title}</td>
                    <td className="p-3">{f.category}</td>
                    <td className="p-3">{f.periodicity}</td>
                    <td className="p-3">{formatKz(f.amountInCents)}</td>
                    <td className="p-3">{f.active ? 'Ativo' : 'Inativo'}</td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {(can('treasury', 'CREATE_RUBRIC') || can('treasury', 'EDIT') || can('treasury', 'CONFIGURE_QUOTAS')) && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFee(f);
                              setEditFeeForm({
                                title: f.title,
                                amountStr: String(Math.round(f.amountInCents / 100)),
                                active: f.active,
                              });
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors border border-blue-200 inline-flex items-center gap-1 shadow-2xs"
                            title="Editar Valor ou Estado da Rubrica"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>
                        )}
                        {can('treasury', 'DELETE_RUBRIC') && (
                          <button
                            onClick={() => setFeeToDelete(f)}
                            className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 rounded-md transition-colors border border-rose-200 inline-flex items-center gap-1 shadow-2xs"
                            title="Remover Rubrica"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remover</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 5: Criar Rubrica */}
      {isCreateFeeModalOpen && (
        <Modal
          isOpen={isCreateFeeModalOpen}
          onClose={() => setIsCreateFeeModalOpen(false)}
          title="Nova Rubrica Financeira"
          description="Defina uma nova taxa ou quota para o clube."
          maxWidth="sm"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const title = formData.get('title') as string;
              const category = formData.get('category') as any;
              const periodicity = formData.get('periodicity') as any;
              const amountStr = formData.get('amount') as string;
              const amount = parseKzToCents(amountStr);
              
// Formato limpo

              createFeeDefinition({
                title,
                category,
                periodicity,
                amountInCents: amount,
                targetCategory: 'todas',
                active: true,
                year: new Date().getFullYear(),
              });
              setIsCreateFeeModalOpen(false);
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Título da Rubrica</label>
              <input name="title" className="w-full p-2 border border-slate-200 rounded" required />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Categoria</label>
              <select name="category" className="w-full p-2 border border-slate-200 rounded" required>
                <option value="quota_diaria">Quota Diária</option>
                <option value="quota_mensal">Quota Mensal</option>
                <option value="contribuicao_atividade">Contribuição Atividade</option>
                <option value="doacao">Doação</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Periodicidade</label>
              <select name="periodicity" className="w-full p-2 border border-slate-200 rounded" required>
                <option value="diaria">Diária</option>
                <option value="mensal">Mensal</option>
                <option value="unica">Única</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Valor (Kz)</label>
              <input name="amount" type="number" className="w-full p-2 border border-slate-200 rounded" required />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsCreateFeeModalOpen(false)} className="px-3 py-1.5 text-slate-600">Cancelar</button>
              <button type="submit" className="px-4 py-1.5 bg-blue-900 text-white rounded">Criar Rubrica</button>
            </div>
          </form>
        </Modal>
      )}

      {/* CONTEÚDO 5: Fecho Mensal e Reconciliação */}
      {activeTab === 'closings' && (
        <div className="space-y-4 w-full max-w-full min-w-0">
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full max-w-full min-w-0">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Histórico de Fechos Fiscais Mensais
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                O fecho mensal congela os lançamentos do período. A reabertura é uma operação crítica que exige autorização da Direção.
              </p>
            </div>

            {can('treasury', 'ARCHIVE') && (
              <button
                onClick={() => setIsCloseMonthModalOpen(true)}
                className="px-3 py-2 text-xs font-semibold bg-blue-900 hover:bg-blue-800 text-white rounded-lg transition-colors self-start sm:self-auto shrink-0"
              >
                Executar Fecho Mensal
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden w-full max-w-full min-w-0">
            <div className="divide-y divide-slate-100">
              {state.monthlyClosings.map((closing, index) => (
                <div key={`${closing.id}-${index}`} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">{closing.id}</span>
                      <h4 className="text-xs font-bold text-slate-800">
                        {getMonthNamePT(closing.month)} de {closing.year}
                      </h4>
                      {closing.isReopened && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                          Reaberto
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-2 sm:gap-3">
                      <span>Receitas: {formatKz(closing.totalIncomeInCents)}</span>
                      <span>·</span>
                      <span>Despesas: {formatKz(closing.totalExpenseInCents)}</span>
                      <span>·</span>
                      <span>Encerrado por: {closing.closedByName}</span>
                    </div>
                    {closing.reopenReason && (
                      <p className="text-[11px] text-amber-900 mt-1">
                        Motivo da reabertura: {closing.reopenReason}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                    <div className="text-left sm:text-right">
                      <div className="text-sm font-black text-slate-900">{formatKz(closing.closingBalanceInCents)}</div>
                      <div className="text-[10px] text-slate-500">Saldo Apurado</div>
                    </div>

                    {!closing.isReopened && can('treasury', 'REOPEN') && (
                      <button
                        onClick={() => {
                          setSelectedClosingId(closing.id);
                          setIsReopenModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded transition-colors shrink-0"
                        title="Reabrir Mês Fiscal (Apenas Direção)"
                      >
                        Reabrir Mês
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Emissão de Recibo Oficial */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        title="Emitir Recibo / Fatura Oficial do Clube de Embaixadores Pioneiros D'Alvorada"
        description="Registo formal de pagamento em Kz com geração automática de documento numerado (REC-2026-xxxx). Ao concluir a emissão, a operação é registada e o formulário é fechado imediatamente."
        maxWidth="lg"
      >
        <form onSubmit={handleReceiptSubmit} className="space-y-4 text-xs">
          {receiptFormError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-between">
              <span>{receiptFormError}</span>
              <button
                type="button"
                onClick={() => setReceiptFormError(null)}
                className="text-rose-500 hover:text-rose-800 font-bold ml-2 text-sm"
              >
                ×
              </button>
            </div>
          )}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Membro Titular / Doador {isDonation && <span className="text-blue-900 font-bold">(Doação: Membro registado ou nome personalizado)</span>}
            </label>
            <select
              value={receiptForm.memberId}
              onChange={(e) => setReceiptForm({ ...receiptForm, memberId: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900 mb-2"
            >
              <option value="CUSTOM">-- Outro Titular / Doador Externo (Personalizado) --</option>
              {state.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} ({m.manualNumber})
                </option>
              ))}
            </select>

            {(receiptForm.memberId === 'CUSTOM' || isDonation) && (
              <input
                type="text"
                placeholder={isDonation ? "Nome do Doador / Titular (Opcional se selecionado membro acima)" : "Nome do Titular / Doador"}
                value={receiptForm.customDonorName}
                onChange={(e) => setReceiptForm({ ...receiptForm, customDonorName: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required={receiptForm.memberId === 'CUSTOM'}
              />
            )}
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Taxa / Quota Institucional</label>
            <select
              value={receiptForm.feeDefinitionId}
              onChange={(e) => setReceiptForm({ ...receiptForm, feeDefinitionId: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
            >
              {state.fees.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} ({formatKz(f.amountInCents)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Conta Financeira Institucional de Destino</label>
            <select
              value={receiptForm.accountId}
              onChange={(e) => setReceiptForm({ ...receiptForm, accountId: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900 bg-white"
              required
            >
              {state.accounts.filter(a => a.active).map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({formatKz(acc.currentBalanceInCents)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Período de Referência</label>
              <input
                type="text"
                placeholder="Ex: Março 2026"
                value={receiptForm.periodLabel}
                onChange={(e) => setReceiptForm({ ...receiptForm, periodLabel: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Valor em Kz</label>
              <input
                type="text"
                placeholder="Ex: 2500"
                value={receiptForm.amountStr}
                onChange={(e) => setReceiptForm({ ...receiptForm, amountStr: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Método de Liquidação</label>
              <select
                value={receiptForm.paymentMethod}
                onChange={(e) => setReceiptForm({ ...receiptForm, paymentMethod: e.target.value as PaymentMethod })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              >
                <option value="multicaixa_express">Multicaixa Express</option>
                <option value="transferencia_bancaria">Transferência Bancária</option>
                <option value="deposito_bancario">Depósito Bancário</option>
                <option value="numerario">Numerário (Dinheiro Físico)</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsReceiptModalOpen(false)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded shadow-xs"
            >
              Emitir Recibo / Fatura Oficial
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Solicitação de Despesa */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title="Novo Pedido de Despesa Institucional"
        description="Todas as despesas requerem aprovação orçamental prévia da Direção antes do pagamento efetivo."
        maxWidth="md"
      >
        <form onSubmit={handleExpenseSubmit} className="space-y-4 text-xs">
          {expenseFormError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-between">
              <span>{expenseFormError}</span>
              <button
                type="button"
                onClick={() => setExpenseFormError(null)}
                className="text-rose-500 hover:text-rose-800 font-bold ml-2 text-sm"
              >
                ×
              </button>
            </div>
          )}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Título da Despesa</label>
            <input
              type="text"
              placeholder="Ex: Aquisição de botijas de gás para acampamento"
              value={expenseForm.title}
              onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Montante Estimado em Kz</label>
              <input
                type="text"
                placeholder="Ex: 35000"
                value={expenseForm.amountStr}
                onChange={(e) => setExpenseForm({ ...expenseForm, amountStr: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Rubrica Orçamental</label>
              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              >
                <option value="Material de Instrução">Material de Instrução</option>
                <option value="Saúde e Primeiros Socorros">Saúde e Primeiros Socorros</option>
                <option value="Logística e Transporte">Logística e Transporte</option>
                <option value="Alimentação">Alimentação</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Justificação e Detalhes</label>
            <textarea
              rows={3}
              placeholder="Explique a finalidade da despesa para avaliação da Direção..."
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              required
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsExpenseModalOpen(false)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded shadow-xs"
            >
              Submeter Pedido
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Reabertura de Mês Fiscal */}
      {isReopenModalOpen && (
        <Modal
          isOpen={isReopenModalOpen}
          onClose={() => setIsReopenModalOpen(false)}
          title="Reabertura Autorizada de Mês Fiscal"
          description="Operação crítica: a reabertura exige autorização da Direção e fundamentação gravada em auditoria."
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900">
              Esta ação destranca o período fiscal para retificação de lançamentos. O evento será integralmente auditado.
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Motivo e Justificação da Reabertura <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Regularização de comprovativo bancário pendente referente a Março..."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsReopenModalOpen(false)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedClosingId) {
                    const res = reopenFiscalMonth(selectedClosingId, reopenReason);
                    if (res.success) {
                      setIsReopenModalOpen(false);
                      setReopenReason('');
                      setSelectedClosingId(null);
                      showFeedback('success', 'Mês fiscal reaberto com sucesso.');
                    } else {
                      showFeedback('error', res.error || 'Erro ao reabrir fecho fiscal.');
                    }
                  }
                }}
                className="px-4 py-1.5 font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded shadow-xs"
              >
                Autorizar Reabertura
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 4: Anulação de Recibo */}
      {selectedReceiptToCancel && (
        <Modal
          isOpen={Boolean(selectedReceiptToCancel)}
          onClose={() => setSelectedReceiptToCancel(null)}
          title={`Anular Recibo ${selectedReceiptToCancel.receiptNumber}`}
          description="A anulação preserva o registo histórico e estorna o saldo na conta financeira correspondente."
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-900">
              O número {selectedReceiptToCancel.receiptNumber} ficará gravado como cancelado e nunca poderá ser reutilizado.
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Motivo obrigatório da anulação <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Emissão com montante duplicado por erro de digitação..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedReceiptToCancel(null)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleCancelReceiptConfirm}
                className="px-4 py-1.5 font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded shadow-xs"
              >
                Confirmar Anulação
              </button>
            </div>
          </div>
        </Modal>
      )}

      {isCreateAccountModalOpen && (
        <Modal
          isOpen={isCreateAccountModalOpen}
          onClose={() => setIsCreateAccountModalOpen(false)}
          title="Nova Conta Financeira"
          description="Crie uma nova conta (Caixa, Banco ou Fundo) para gestão de numerário."
          maxWidth="sm"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const name = formData.get('name') as string;
              const type = formData.get('type') as any;
              const accountNumber = formData.get('accountNumber') as string;
              const initialBalance = parseKzToCents(formData.get('initialBalance') as string);
              
              createTreasuryAccount({
                name,
                type,
                accountNumber: accountNumber || undefined,
                initialBalanceInCents: initialBalance,
              });
              setIsCreateAccountModalOpen(false);
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Nome da Conta</label>
              <input name="name" className="w-full p-2 border border-slate-200 rounded" required />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Tipo de Conta</label>
              <select name="type" className="w-full p-2 border border-slate-200 rounded" required>
                <option value="caixa">Caixa</option>
                <option value="banco">Banco</option>
                <option value="fundo">Fundo</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Número de Conta (Opcional)</label>
              <input name="accountNumber" className="w-full p-2 border border-slate-200 rounded" />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Saldo Inicial (Kz)</label>
              <input name="initialBalance" type="number" defaultValue="0" className="w-full p-2 border border-slate-200 rounded" required />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsCreateAccountModalOpen(false)} className="px-3 py-1.5 text-slate-600">Cancelar</button>
              <button type="submit" className="px-4 py-1.5 bg-blue-900 text-white rounded">Criar Conta</button>
            </div>
          </form>
        </Modal>
      )}

      {accountToDelete && (
        <Modal
          isOpen={Boolean(accountToDelete)}
          onClose={() => setAccountToDelete(null)}
          title={`Remover Conta "${accountToDelete.name}"`}
          description="A remoção desta conta financeira é definitiva."
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-900">
              Tem certeza que deseja remover a conta <strong>{accountToDelete.name}</strong>?
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = deleteTreasuryAccount(accountToDelete.id);
                  if (!res.success) {
                    showFeedback('error', res.error || 'Erro ao remover conta.');
                  } else {
                    showFeedback('success', 'Conta financeira removida com sucesso.');
                  }
                  setAccountToDelete(null);
                }}
                className="px-4 py-1.5 font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded shadow-xs"
              >
                Sim, Remover Conta
              </button>
            </div>
          </div>
        </Modal>
      )}

      {feeToDelete && (
        <Modal
          isOpen={Boolean(feeToDelete)}
          onClose={() => setFeeToDelete(null)}
          title={`Remover Rubrica "${feeToDelete.title}"`}
          description="A remoção desta rubrica financeira é definitiva."
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-900">
              Tem certeza que deseja remover a rubrica <strong>{feeToDelete.title}</strong>?
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFeeToDelete(null)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = deleteFeeDefinition(feeToDelete.id);
                  if (!res.success) {
                    showFeedback('error', res.error || 'Erro ao remover rubrica.');
                  } else {
                    showFeedback('success', 'Rubrica financeira removida com sucesso.');
                  }
                  setFeeToDelete(null);
                }}
                className="px-4 py-1.5 font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded shadow-xs"
              >
                Sim, Remover Rubrica
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de Impressão de Documento */}
      <PrintDocumentModal
        document={printedDocument}
        onClose={() => setPrintedDocument(null)}
      />

      {/* Modal Oficial de Visualização de Comprovativo Anexado pelo Membro */}
      <ProofDocumentViewerModal
        proof={selectedProofToView}
        onClose={() => setSelectedProofToView(null)}
        onApprove={(proofId) => {
          const res = verifyPaymentProof(proofId, true);
          if (!res.success) {
            showFeedback('error', res.error || 'Erro ao aprovar comprovativo.');
          } else {
            showFeedback('success', 'Comprovativo aprovado com sucesso.');
            setSelectedProofToView(null);
          }
        }}
        onReject={(proof) => {
          setSelectedProofToView(null);
          setSelectedProofToReject(proof);
          setProofRejectReason('');
          setProofRejectError(null);
        }}
      />
      {/* MODAL: Fecho Mensal */}
      {isCloseMonthModalOpen && (
        <Modal
          isOpen={isCloseMonthModalOpen}
          onClose={() => setIsCloseMonthModalOpen(false)}
          title="Executar Fecho Mensal"
          description={`Encerrar operações financeiras de ${getMonthNamePT(closingMonth)} de ${closingYear}.`}
          maxWidth="sm"
        >
          <div className="space-y-4 text-xs">
            <p>Tem certeza que deseja encerrar o fecho mensal? Esta ação não pode ser revertida facilmente.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsCloseMonthModalOpen(false)} className="px-3 py-1.5 text-slate-600">Cancelar</button>
              <button
                onClick={() => {
                  const res = closeFiscalMonth(closingYear, closingMonth);
                  if (res.success) {
                    setIsCloseMonthModalOpen(false);
                    showFeedback('success', 'Fecho mensal concluído com sucesso.');
                  } else {
                    showFeedback('error', res.error || 'Erro ao executar fecho mensal.');
                  }
                }}
                className="px-4 py-1.5 bg-blue-900 text-white rounded"
              >
                Confirmar Fecho
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Seleção de Conta para Pagamento */}
      {paymentModalData && (() => {
        const targetExp = state.expenses.find((e) => e.id === paymentModalData.expenseId);
        const selectedAcc = state.accounts.find((a) => a.id === paymentModalData.accountId);
        const hasSufficient = selectedAcc && targetExp ? selectedAcc.currentBalanceInCents >= targetExp.amountInCents : false;

        return (
          <Modal
            isOpen={Boolean(paymentModalData)}
            onClose={() => {
              setPaymentModalData(null);
              setPaymentError(null);
            }}
            title="Efetuar Pagamento de Despesa"
            description="Selecione a conta institucional de onde será debitado o montante desta despesa."
            maxWidth="md"
          >
            <div className="space-y-4 text-xs">
              {targetExp && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <div className="text-slate-500 font-semibold text-[11px]">Despesa a Pagar:</div>
                  <div className="font-bold text-sm text-slate-900">{targetExp.title}</div>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-600">Categoria: <strong className="text-slate-800">{targetExp.category}</strong></span>
                    <span className="text-sm font-black text-blue-900">{formatKz(targetExp.amountInCents)}</span>
                  </div>
                </div>
              )}

              {paymentError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
                  {paymentError}
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Conta Financeira Institucional para Débito</label>
                <select
                  value={paymentModalData.accountId}
                  onChange={(e) => {
                    setPaymentModalData({ ...paymentModalData, accountId: e.target.value });
                    setPaymentError(null);
                  }}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-900 bg-white font-medium"
                >
                  {state.accounts.filter(a => a.active).map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} — Saldo: {formatKz(acc.currentBalanceInCents)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedAcc && targetExp && !hasSufficient && (
                <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Saldo Insuficiente na Conta Selecionada</div>
                    <div>
                      A conta <strong>{selectedAcc.name}</strong> possui apenas <strong>{formatKz(selectedAcc.currentBalanceInCents)}</strong> disponíveis, mas a despesa é de <strong>{formatKz(targetExp.amountInCents)}</strong>.
                    </div>
                    <div className="mt-1 text-slate-700">
                      Por favor selecione outra conta institucional com saldo suficiente para concluir o pagamento.
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentModalData(null);
                    setPaymentError(null);
                  }}
                  className="px-3.5 py-2 text-slate-600 hover:text-slate-900 font-semibold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!hasSufficient}
                  onClick={() => {
                    setPaymentError(null);
                    const res = payExpense(paymentModalData.expenseId, paymentModalData.accountId);
                    if (res.success) {
                      setPaymentModalData(null);
                      setPaymentError(null);
                    } else {
                      setPaymentError(res.error || 'Erro ao processar pagamento.');
                    }
                  }}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 disabled:hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
                >
                  Confirmar Pagamento
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* MODAL: Rejeitar / Não Aprovar Despesa */}
      {rejectModalData && (
        <Modal
          isOpen={Boolean(rejectModalData)}
          onClose={() => {
            setRejectModalData(null);
            setRejectReason('');
            setRejectError(null);
          }}
          title="Não Aprovar / Rejeitar Despesa"
          description="Indique o motivo pelo qual esta despesa não é aprovada para efeitos de auditoria."
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <div className="text-slate-500 font-semibold text-[11px]">Despesa a Rejeitar:</div>
              <div className="font-bold text-sm text-slate-900">{rejectModalData.title}</div>
              <div className="text-xs text-rose-800 font-bold">Valor: {formatKz(rejectModalData.amountInCents)}</div>
            </div>

            {rejectError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
                {rejectError}
              </div>
            )}

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Motivo da Não Aprovação *</label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  setRejectError(null);
                }}
                placeholder="Ex: Despesa fora do orçamento aprovado para este mês."
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-700"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setRejectModalData(null);
                  setRejectReason('');
                  setRejectError(null);
                }}
                className="px-3.5 py-2 text-slate-600 hover:text-slate-900 font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!rejectReason.trim()) {
                    setRejectError('Por favor introduza o motivo da não aprovação.');
                    return;
                  }
                  const res = rejectExpense(rejectModalData.expenseId, rejectReason.trim());
                  if (res.success) {
                    setRejectModalData(null);
                    setRejectReason('');
                    setRejectError(null);
                  } else {
                    setRejectError(res.error || 'Erro ao rejeitar despesa.');
                  }
                }}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-semibold rounded-lg shadow-xs transition-colors"
              >
                Confirmar Não Aprovação
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedProofToReject && (
        <Modal
          isOpen={Boolean(selectedProofToReject)}
          onClose={() => setSelectedProofToReject(null)}
          title={`Rejeitar Comprovativo "${selectedProofToReject.id}"`}
          description="Informe o motivo pelo qual este comprovativo de pagamento está a ser rejeitado."
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
              <div className="text-slate-500 font-semibold text-[11px]">Membro: {selectedProofToReject.memberName}</div>
              <div className="font-bold text-sm text-slate-900">Taxa: {selectedProofToReject.feeTitle}</div>
              <div className="text-xs text-rose-800 font-bold">Valor: {formatKz(selectedProofToReject.amountInCents)}</div>
            </div>

            {proofRejectError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
                {proofRejectError}
              </div>
            )}

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Motivo da Rejeição *</label>
              <textarea
                rows={3}
                value={proofRejectReason}
                onChange={(e) => {
                  setProofRejectReason(e.target.value);
                  setProofRejectError(null);
                }}
                placeholder="Ex: Talão ilegível, valor divergente ou referência bancária inválida."
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-700"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedProofToReject(null)}
                className="px-3.5 py-2 text-slate-600 hover:text-slate-900 font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!proofRejectReason.trim()) {
                    setProofRejectError('Por favor introduza o motivo da rejeição.');
                    return;
                  }
                  const res = verifyPaymentProof(selectedProofToReject.id, false, proofRejectReason.trim());
                  if (res.success) {
                    setSelectedProofToReject(null);
                    setProofRejectReason('');
                    setProofRejectError(null);
                  } else {
                    setProofRejectError(res.error || 'Erro ao rejeitar comprovativo.');
                  }
                }}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-semibold rounded-lg shadow-xs transition-colors"
              >
                Confirmar Rejeição
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Definir / Alterar Valor das Quotas (Gated por Grelha de Permissões) */}
      {isQuotaConfigModalOpen && (
        <Modal
          isOpen={isQuotaConfigModalOpen}
          onClose={() => setIsQuotaConfigModalOpen(false)}
          title="Configuração e Valor das Quotas"
          description="Defina o valor da quota cobrada por domingo (ou mês). Ao guardar, todo o sistema recalcula automaticamente os saldos devidos."
          maxWidth="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setQuotaConfigError(null);
              const amountCents = parseKzToCents(quotaConfigForm.amountStr);
              if (amountCents < 0 || Number.isNaN(amountCents)) {
                setQuotaConfigError('Introduza um valor válido em Kwanzas (Kz).');
                return;
              }
              let categoryAmountsInCents: Partial<Record<MemberCategory, number>> | undefined = undefined;
              if (quotaConfigForm.useCategoryOverrides) {
                const overrides: Partial<Record<MemberCategory, number>> = {};
                if (quotaConfigForm.embaixadorStr.trim()) {
                  overrides.embaixador = parseKzToCents(quotaConfigForm.embaixadorStr);
                }
                if (quotaConfigForm.liderStr.trim()) {
                  overrides.lider = parseKzToCents(quotaConfigForm.liderStr);
                }
                if (quotaConfigForm.aspiranteStr.trim()) {
                  overrides.aspirante = parseKzToCents(quotaConfigForm.aspiranteStr);
                }
                if (Object.keys(overrides).length > 0) {
                  categoryAmountsInCents = overrides;
                }
              }

              const res = updateQuotaConfig({
                amountInCents: amountCents,
                frequency: quotaConfigForm.frequency,
                cycleStartDate: quotaConfigForm.cycleStartDate,
                respectMemberJoinDate: quotaConfigForm.respectMemberJoinDate,
                categoryAmountsInCents,
              });

              if (res.success) {
                setIsQuotaConfigModalOpen(false);
                showFeedback(
                  'success',
                  `Valor da quota atualizado para ${formatKz(amountCents)}. Todos os saldos foram recalculados.`
                );
              } else {
                setQuotaConfigError(res.error || 'Erro ao atualizar configuração de quotas.');
              }
            }}
            className="space-y-4 text-xs"
          >
            {quotaConfigError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg">
                {quotaConfigError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Valor Padrão da Quota (Kz) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={quotaConfigForm.amountStr}
                  onChange={(e) => setQuotaConfigForm({ ...quotaConfigForm, amountStr: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-900 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Regime de Cobrança
                </label>
                <select
                  value={quotaConfigForm.frequency}
                  onChange={(e) =>
                    setQuotaConfigForm({
                      ...quotaConfigForm,
                      frequency: e.target.value as QuotaBillingFrequency,
                    })
                  }
                  className="w-full p-2 border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-900"
                >
                  <option value="domingo">Cada Domingo (Semanal)</option>
                  <option value="mensal">Mensal</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Data de Início da Contagem no Ciclo
              </label>
              <input
                type="date"
                value={quotaConfigForm.cycleStartDate}
                onChange={(e) =>
                  setQuotaConfigForm({ ...quotaConfigForm, cycleStartDate: e.target.value })
                }
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>

            <label className="flex items-start gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={quotaConfigForm.respectMemberJoinDate}
                onChange={(e) =>
                  setQuotaConfigForm({ ...quotaConfigForm, respectMemberJoinDate: e.target.checked })
                }
                className="mt-0.5 rounded border-slate-300 text-blue-900"
              />
              <div>
                <span className="font-semibold text-slate-800 block">
                  Respeitar data de admissão de novos membros
                </span>
                <span className="text-[11px] text-slate-500">
                  Membros inscritos após o início do ciclo pagam apenas pelos{' '}
                  {quotaConfigForm.frequency === 'domingo' ? 'domingos' : 'meses'} a partir da entrada no clube.
                </span>
              </div>
            </label>

            <div className="border-t border-slate-100 pt-2">
              <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={quotaConfigForm.useCategoryOverrides}
                  onChange={(e) =>
                    setQuotaConfigForm({ ...quotaConfigForm, useCategoryOverrides: e.target.checked })
                  }
                  className="rounded border-slate-300 text-blue-900"
                />
                <span>Definir valores diferenciados por categoria (opcional)</span>
              </label>

              {quotaConfigForm.useCategoryOverrides && (
                <div className="grid grid-cols-3 gap-2 mt-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Embaixador (Kz)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder={quotaConfigForm.amountStr}
                      value={quotaConfigForm.embaixadorStr}
                      onChange={(e) =>
                        setQuotaConfigForm({ ...quotaConfigForm, embaixadorStr: e.target.value })
                      }
                      className="w-full p-1.5 border border-slate-200 rounded bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Líder (Kz)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder={quotaConfigForm.amountStr}
                      value={quotaConfigForm.liderStr}
                      onChange={(e) =>
                        setQuotaConfigForm({ ...quotaConfigForm, liderStr: e.target.value })
                      }
                      className="w-full p-1.5 border border-slate-200 rounded bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Aspirante (Kz)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder={quotaConfigForm.amountStr}
                      value={quotaConfigForm.aspiranteStr}
                      onChange={(e) =>
                        setQuotaConfigForm({ ...quotaConfigForm, aspiranteStr: e.target.value })
                      }
                      className="w-full p-1.5 border border-slate-200 rounded bg-white text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsQuotaConfigModalOpen(false)}
                className="px-3.5 py-2 text-slate-600 hover:text-slate-900 font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white font-semibold rounded-lg shadow-xs"
              >
                Guardar e Recalcular Quotas
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Regularizar Quota do Membro */}
      {regularizeTarget && (
        <Modal
          isOpen={Boolean(regularizeTarget)}
          onClose={() => setRegularizeTarget(null)}
          title={`Regularizar Quota · ${regularizeTarget.member.fullName}`}
          description={`Registo de pagamento de quota com emissão imediata de recibo oficial (${regularizeTarget.member.manualNumber}).`}
          maxWidth="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setRegularizeError(null);
              const cents = parseKzToCents(regularizeForm.amountStr);
              if (cents <= 0) {
                setRegularizeError('O montante a regularizar deve ser superior a zero.');
                return;
              }
              const res = regularizeMemberQuota({
                memberId: regularizeTarget.member.id,
                amountPaidInCents: cents,
                paymentMethod: regularizeForm.paymentMethod,
                accountId: regularizeForm.accountId,
                periodLabel: regularizeForm.periodLabel,
                referenceOrProof: regularizeForm.referenceOrProof,
                notes: regularizeForm.notes,
              });
              if (res.success) {
                setRegularizeTarget(null);
                showFeedback(
                  'success',
                  `Quota de ${regularizeTarget.member.fullName} regularizada! Recibo ${res.receiptNumber} emitido.`
                );
              } else {
                setRegularizeError(res.error || 'Erro ao regularizar quota.');
              }
            }}
            className="space-y-4 text-xs"
          >
            {regularizeError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg">
                {regularizeError}
              </div>
            )}

            {/* Resumo instantâneo do membro */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Total Devido</div>
                <div className="font-black text-slate-900 text-sm">
                  {formatKz(regularizeTarget.totalDueInCents)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Já Pago</div>
                <div className="font-black text-emerald-700 text-sm">
                  {formatKz(regularizeTarget.totalPaidInCents)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Em Dívida</div>
                <div
                  className={`font-black text-sm ${
                    regularizeTarget.balanceDueInCents > 0 ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {formatKz(regularizeTarget.balanceDueInCents)}
                </div>
              </div>
            </div>

            {/* Atalhos de preenchimento rápido */}
            <div className="flex flex-wrap gap-1.5">
              {regularizeTarget.balanceDueInCents > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setRegularizeForm({
                      ...regularizeForm,
                      amountStr: String(Math.round(regularizeTarget.balanceDueInCents / 100)),
                    })
                  }
                  className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md"
                >
                  Total em Dívida ({formatKz(regularizeTarget.balanceDueInCents)})
                </button>
              )}
              {[1, 2, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    setRegularizeForm({
                      ...regularizeForm,
                      amountStr: String(
                        Math.round((regularizeTarget.unitQuotaInCents * n) / 100)
                      ),
                    })
                  }
                  className="px-2.5 py-1 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-md"
                >
                  {n}{' '}
                  {regularizeTarget.frequency === 'domingo'
                    ? n === 1
                      ? 'Domingo'
                      : 'Domingos'
                    : n === 1
                    ? 'Mês'
                    : 'Meses'}{' '}
                  ({formatKz(regularizeTarget.unitQuotaInCents * n)})
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Montante a Pagar (Kz) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={regularizeForm.amountStr}
                  onChange={(e) =>
                    setRegularizeForm({ ...regularizeForm, amountStr: e.target.value })
                  }
                  className="w-full p-2 border border-slate-200 rounded-lg font-bold focus:ring-1 focus:ring-blue-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Método de Pagamento</label>
                <select
                  value={regularizeForm.paymentMethod}
                  onChange={(e) => {
                    const method = e.target.value as PaymentMethod;
                    const preferred =
                      method === 'numerario'
                        ? state.accounts.find((a) => a.type === 'caixa' && a.active)?.id
                        : state.accounts.find((a) => a.type === 'banco' && a.active)?.id;
                    setRegularizeForm({
                      ...regularizeForm,
                      paymentMethod: method,
                      accountId: preferred || regularizeForm.accountId,
                    });
                  }}
                  className="w-full p-2 border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-900"
                >
                  <option value="numerario">Numerário (Caixa)</option>
                  <option value="multicaixa_express">Multicaixa Express</option>
                  <option value="transferencia_bancaria">Transferência Bancária</option>
                  <option value="deposito_bancario">Depósito Bancário</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Conta de Destino</label>
              <select
                value={regularizeForm.accountId}
                onChange={(e) =>
                  setRegularizeForm({ ...regularizeForm, accountId: e.target.value })
                }
                className="w-full p-2 border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-blue-900"
                required
              >
                {state.accounts
                  .filter((a) => a.active)
                  .map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} — Saldo: {formatKz(acc.currentBalanceInCents)}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Descrição / Período</label>
              <input
                type="text"
                value={regularizeForm.periodLabel}
                onChange={(e) =>
                  setRegularizeForm({ ...regularizeForm, periodLabel: e.target.value })
                }
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Referência / Talão (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: MCX-849201"
                  value={regularizeForm.referenceOrProof}
                  onChange={(e) =>
                    setRegularizeForm({ ...regularizeForm, referenceOrProof: e.target.value })
                  }
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-900"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Observações (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Notas do tesoureiro..."
                  value={regularizeForm.notes}
                  onChange={(e) => setRegularizeForm({ ...regularizeForm, notes: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRegularizeTarget(null)}
                className="px-3.5 py-2 text-slate-600 hover:text-slate-900 font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg shadow-xs"
              >
                Confirmar Regularização & Emitir Recibo
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Extrato Detalhado de Quotas do Membro */}
      {liveStatementTarget && (
        <Modal
          isOpen={Boolean(liveStatementTarget)}
          onClose={() => {
            setStatementTarget(null);
            setReversingWaiverId(null);
            setReverseWaiverReason('');
            setReverseWaiverError(null);
          }}
          title={`Extrato de Quotas · ${liveStatementTarget.member.fullName}`}
          description={`Matrícula ${liveStatementTarget.member.manualNumber} · Início de cobrança neste ciclo: ${formatDateAO(liveStatementTarget.effectiveStartDate)}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-600">Valor unitário aplicável:</span>
                <strong className="text-slate-900 tabular-nums">
                  {formatKz(liveStatementTarget.unitQuotaInCents)} /{' '}
                  {liveStatementTarget.frequency === 'domingo' ? 'Domingo' : 'Mês'}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">
                  Total de {liveStatementTarget.frequency === 'domingo' ? 'domingos' : 'meses'} cobrados:
                </span>
                <strong className="text-slate-900 tabular-nums">{liveStatementTarget.periodsCharged}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Bruto Calculado:</span>
                <strong className="text-slate-900 tabular-nums">{formatKz(liveStatementTarget.grossDueInCents)}</strong>
              </div>
              {liveStatementTarget.totalWaivedInCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-amber-800">Dívidas Zeradas / Isenções:</span>
                  <strong className="text-amber-800 tabular-nums">
                    -{formatKz(liveStatementTarget.totalWaivedInCents)}
                  </strong>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">Total Devido Líquido no Ciclo:</span>
                <strong className="text-slate-900 tabular-nums">{formatKz(liveStatementTarget.totalDueInCents)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Já Pago (Recibos Válidos):</span>
                <strong className="text-emerald-700 tabular-nums">
                  {formatKz(liveStatementTarget.totalPaidInCents)}
                </strong>
              </div>
              <div className="border-t border-slate-200 pt-1.5 flex justify-between">
                <span className="font-bold text-slate-800">
                  {liveStatementTarget.creditInCents > 0 ? 'Crédito Antecipado:' : 'Saldo Restante a Pagar:'}
                </span>
                <strong
                  className={`tabular-nums ${
                    liveStatementTarget.balanceDueInCents > 0
                      ? 'text-rose-700 font-black'
                      : liveStatementTarget.creditInCents > 0
                      ? 'text-blue-800 font-black'
                      : 'text-emerald-700 font-black'
                  }`}
                >
                  {liveStatementTarget.creditInCents > 0
                    ? `+${formatKz(liveStatementTarget.creditInCents)}`
                    : formatKz(liveStatementTarget.balanceDueInCents)}
                </strong>
              </div>
            </div>

            {liveStatementTarget.member.quotaCarryOver &&
              (liveStatementTarget.member.quotaCarryOver.debtInCents > 0 ||
                liveStatementTarget.member.quotaCarryOver.creditInCents > 0) && (
                <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-[11px] text-blue-950 space-y-1">
                  <div className="font-bold">
                    Saldo Consolidado após Limpeza na Nuvem ({formatDateAO(liveStatementTarget.member.quotaCarryOver.snapshotDate)})
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 tabular-nums">
                    {liveStatementTarget.member.quotaCarryOver.creditInCents > 0 && (
                      <span>
                        Crédito adiantado: <strong>+{formatKz(liveStatementTarget.member.quotaCarryOver.creditInCents)}</strong>
                      </span>
                    )}
                    {liveStatementTarget.member.quotaCarryOver.debtInCents > 0 && (
                      <span>
                        Dívida em atraso transportada: <strong>{formatKz(liveStatementTarget.member.quotaCarryOver.debtInCents)}</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}

            {liveStatementTarget.quotaWaivers.length > 0 && (
              <div>
                <h4 className="font-bold text-slate-800 mb-2">
                  Dívidas Zeradas / Acertos Autorizados ({liveStatementTarget.quotaWaivers.length})
                </h4>
                <div className="divide-y divide-amber-100 border border-amber-200 bg-amber-50/40 rounded-lg max-h-48 overflow-y-auto">
                  {liveStatementTarget.quotaWaivers.map((w) => (
                    <div key={w.id} className="p-2.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-mono font-bold text-amber-950">{w.id}</div>
                          <div className="text-[11px] text-slate-700 mt-0.5">{w.reason}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Por {w.waivedByName} · {formatDateAO(w.waivedAt)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-amber-900 tabular-nums">
                            -{formatKz(w.amountWaivedInCents)}
                          </div>
                          {can('treasury', 'WAIVE_QUOTA_DEBT') && reversingWaiverId !== w.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setReversingWaiverId(w.id);
                                setReverseWaiverReason('');
                                setReverseWaiverError(null);
                              }}
                              className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 hover:text-rose-900"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reverter</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {reversingWaiverId === w.id && (
                        <div className="p-2 bg-white border border-rose-200 rounded-md space-y-2">
                          {reverseWaiverError && (
                            <p className="text-[11px] text-rose-700 font-semibold">{reverseWaiverError}</p>
                          )}
                          <input
                            type="text"
                            placeholder="Motivo da reversão..."
                            value={reverseWaiverReason}
                            onChange={(e) => setReverseWaiverReason(e.target.value)}
                            className="w-full p-1.5 border border-slate-200 rounded text-xs"
                          />
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setReversingWaiverId(null);
                                setReverseWaiverReason('');
                                setReverseWaiverError(null);
                              }}
                              className="px-2 py-1 text-[11px] text-slate-600"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const res = reverseQuotaDebtWaiver(w.id, reverseWaiverReason);
                                if (res.success) {
                                  setReversingWaiverId(null);
                                  setReverseWaiverReason('');
                                  showFeedback('success', `Acerto ${w.id} revertido e saldo recalculado.`);
                                } else {
                                  setReverseWaiverError(res.error || 'Erro ao reverter acerto.');
                                }
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold bg-rose-700 text-white rounded hover:bg-rose-800"
                            >
                              Confirmar Reversão
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="font-bold text-slate-800 mb-2">
                Recibos de Quota Registados ({liveStatementTarget.quotaReceipts.length})
              </h4>
              {liveStatementTarget.quotaReceipts.length === 0 ? (
                <p className="text-slate-500 italic p-3 bg-slate-50 rounded-lg border border-slate-100">
                  Nenhum recibo de quota confirmado neste ciclo até ao momento.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-60 overflow-y-auto">
                  {liveStatementTarget.quotaReceipts.map((r) => (
                    <div key={r.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <div className="font-mono font-bold text-slate-900">{r.receiptNumber}</div>
                        <div className="text-[11px] text-slate-500">
                          {r.periodLabel} · {formatDateAO(r.paidAt)}
                        </div>
                      </div>
                      <div className="font-bold text-emerald-700 tabular-nums">
                        {formatKz(r.amountPaidInCents)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100">
              {can('treasury', 'WAIVE_QUOTA_DEBT') && liveStatementTarget.balanceDueInCents > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const target = liveStatementTarget;
                    setStatementTarget(null);
                    openWaiveModal(target);
                  }}
                  className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold rounded-lg inline-flex items-center gap-1.5"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Zerar Dívida</span>
                </button>
              )}
              {can('treasury', 'CREATE') && (
                <button
                  type="button"
                  onClick={() => {
                    const target = liveStatementTarget;
                    setStatementTarget(null);
                    openRegularizeModal(target);
                  }}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg"
                >
                  Regularizar Agora
                </button>
              )}
              <button
                type="button"
                onClick={() => setStatementTarget(null)}
                className="px-3.5 py-2 text-slate-600 hover:text-slate-900 font-semibold rounded-lg"
              >
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Zerar Dívida de Quota do Membro */}
      {waiveTarget && (
        <Modal
          isOpen={Boolean(waiveTarget)}
          onClose={() => setWaiveTarget(null)}
          title={`Zerar Dívida de Quotas · ${waiveTarget.member.fullName}`}
          description={`Perdão, isenção ou acerto administrativo de dívida (${waiveTarget.member.manualNumber}).`}
          maxWidth="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setWaiveError(null);
              let customAmountInCents: number | undefined = undefined;
              if (waiveMode === 'partial') {
                const parsed = parseKzToCents(waiveCustomAmountStr);
                if (parsed <= 0 || Number.isNaN(parsed)) {
                  setWaiveError('Introduza um valor em Kz superior a zero para abatimento.');
                  return;
                }
                if (parsed > waiveTarget.balanceDueInCents) {
                  setWaiveError('O valor a abater não pode ultrapassar a dívida atual.');
                  return;
                }
                customAmountInCents = parsed;
              }

              const res = waiveMemberQuotaDebt({
                memberId: waiveTarget.member.id,
                reason: waiveReason,
                customAmountInCents,
              });
              if (res.success) {
                setWaiveTarget(null);
                showFeedback(
                  'success',
                  waiveMode === 'full'
                    ? `Dívida de ${waiveTarget.member.fullName} zerada para 0,00 Kz (${res.waiver?.id}).`
                    : `Abatimento registado para ${waiveTarget.member.fullName} (${res.waiver?.id}).`
                );
              } else {
                setWaiveError(res.error || 'Erro ao zerar dívida de quotas.');
              }
            }}
            className="space-y-4 text-xs"
          >
            {waiveError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg">
                {waiveError}
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Total Devido</div>
                <div className="font-black text-slate-900 text-sm tabular-nums">
                  {formatKz(waiveTarget.totalDueInCents)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Já Pago</div>
                <div className="font-black text-emerald-700 text-sm tabular-nums">
                  {formatKz(waiveTarget.totalPaidInCents)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Dívida Atual</div>
                <div className="font-black text-rose-700 text-sm tabular-nums">
                  {formatKz(waiveTarget.balanceDueInCents)}
                </div>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-[11px] leading-relaxed">
              Esta operação <strong>não movimenta nem altera o saldo físico do Caixa/Banco</strong>, pois trata-se de perdão/acerto da dívida pendente. O registo fica gravado em auditoria e o saldo do membro passa imediatamente para 0,00 Kz (ou valor abatido).
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setWaiveMode('full')}
                className={`py-2 px-3 rounded-md font-bold text-xs transition-colors ${
                  waiveMode === 'full'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Zerar 100% ({formatKz(waiveTarget.balanceDueInCents)})
              </button>
              <button
                type="button"
                onClick={() => setWaiveMode('partial')}
                className={`py-2 px-3 rounded-md font-bold text-xs transition-colors ${
                  waiveMode === 'partial'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Abatimento Parcial (Kz)
              </button>
            </div>

            {waiveMode === 'partial' && (
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Montante a Abater (Kz) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={Math.round(waiveTarget.balanceDueInCents / 100)}
                  step="1"
                  value={waiveCustomAmountStr}
                  onChange={(e) => setWaiveCustomAmountStr(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg font-bold focus:ring-1 focus:ring-blue-900 tabular-nums"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-slate-700 font-semibold mb-1.5">
                Motivo / Justificação Institucional <span className="text-rose-500">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[
                  'Isenção autorizada pela Direção',
                  'Acerto administrativo de saldo',
                  'Apoio social / Dificuldade económica',
                  'Ausência justificada no período',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setWaiveReason(preset)}
                    className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                      waiveReason === preset
                        ? 'bg-blue-900 text-white border-blue-900 font-semibold'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
                placeholder="Descreva o motivo para zerar esta dívida..."
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setWaiveTarget(null)}
                className="px-3.5 py-2 text-slate-600 hover:text-slate-900 font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-xs inline-flex items-center gap-1.5"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Confirmar e Zerar Dívida</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Zerar Dívidas em Lote (Filtrados) */}
      {isBulkWaiveModalOpen && (
        <Modal
          isOpen={isBulkWaiveModalOpen}
          onClose={() => setIsBulkWaiveModalOpen(false)}
          title="Zerar Dívidas de Quotas em Lote"
          description="Regularização administrativa simultânea dos membros filtrados com saldo em dívida."
          maxWidth="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setBulkWaiveError(null);
              const res = waiveAllPendingQuotaDebts({
                memberIds: filteredInDebtSummaries.map((s) => s.member.id),
                reason: bulkWaiveReason,
              });
              if (res.success) {
                setIsBulkWaiveModalOpen(false);
                showFeedback(
                  'success',
                  `Dívida zerada com sucesso para ${res.count} membro(s), totalizando ${formatKz(res.totalWaivedInCents)}.`
                );
              } else {
                setBulkWaiveError(res.error || 'Erro ao zerar dívidas em lote.');
              }
            }}
            className="space-y-4 text-xs"
          >
            {bulkWaiveError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg">
                {bulkWaiveError}
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-500">Membros Abrangidos</div>
                <div className="text-base font-black text-slate-900 tabular-nums">
                  {filteredInDebtSummaries.length} {filteredInDebtSummaries.length === 1 ? 'membro' : 'membros'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase text-slate-500">Dívida Total a Zerar</div>
                <div className="text-base font-black text-rose-700 tabular-nums">
                  {formatKz(filteredInDebtTotalCents)}
                </div>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-[11px] leading-relaxed">
              Todos os {filteredInDebtSummaries.length} membro(s) exibidos com dívida na lista atual passarão para o estado <strong>Regularizado (0,00 Kz em dívida)</strong> sem afetar o saldo de Caixa/Banco.
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Motivo / Justificação Institucional <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                value={bulkWaiveReason}
                onChange={(e) => setBulkWaiveReason(e.target.value)}
                placeholder="Ex: Amnistia / isenção aprovada pela Direção do Clube..."
                className="w-full p-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBulkWaiveModalOpen(false)}
                className="px-3.5 py-2 text-slate-600 hover:text-slate-900 font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-xs inline-flex items-center gap-1.5"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Zerar Todas ({filteredInDebtSummaries.length})</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Editar Rubrica Financeira */}
      {editingFee && (
        <Modal
          isOpen={Boolean(editingFee)}
          onClose={() => setEditingFee(null)}
          title={`Editar Rubrica · ${editingFee.title}`}
          description="Atualize a designação, o montante em Kz ou o estado ativo desta rubrica."
          maxWidth="sm"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const cents = parseKzToCents(editFeeForm.amountStr);
              const res = updateFeeDefinition(editingFee.id, {
                title: editFeeForm.title.trim(),
                amountInCents: cents,
                active: editFeeForm.active,
              });
              if (res.success) {
                setEditingFee(null);
                showFeedback('success', 'Rubrica atualizada e valores sincronizados com sucesso.');
              } else {
                showFeedback('error', res.error || 'Erro ao atualizar rubrica.');
              }
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Título da Rubrica</label>
              <input
                type="text"
                value={editFeeForm.title}
                onChange={(e) => setEditFeeForm({ ...editFeeForm, title: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded"
                required
              />
            </div>
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Valor (Kz)</label>
              <input
                type="number"
                min={0}
                value={editFeeForm.amountStr}
                onChange={(e) => setEditFeeForm({ ...editFeeForm, amountStr: e.target.value })}
                className="w-full p-2 border border-slate-200 rounded font-bold"
                required
              />
            </div>
            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={editFeeForm.active}
                onChange={(e) => setEditFeeForm({ ...editFeeForm, active: e.target.checked })}
                className="rounded border-slate-300 text-blue-900"
              />
              <span>Rubrica ativa no sistema</span>
            </label>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingFee(null)}
                className="px-3 py-1.5 text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-900 hover:bg-blue-800 text-white font-semibold rounded"
              >
                Guardar Alterações
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
