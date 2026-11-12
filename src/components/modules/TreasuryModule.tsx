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
} from '../../types';
import { formatKz, parseKzToCents } from '../../utils/currency';
import { formatDateAO, getMonthNamePT } from '../../utils/date';
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
    deleteFeeDefinition,
    createTreasuryAccount,
    deleteTreasuryAccount,
    verifyPaymentProof,
  } = useClub();

  // Separadores da Tesouraria
  const [activeTab, setActiveTab] = useState<
    'overview' | 'receipts' | 'expenses' | 'closings' | 'proofs' | 'rubrics'
  >('overview');

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
          {can('treasury', 'CREATE') && (
            <button
              onClick={() => setIsReceiptModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Emitir Recibo Manual</span>
            </button>
          )}

          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Pedir Despesa</span>
          </button>
        </div>
      </div>

      {/* Cartões de Indicadores Financeiros em Kwanza */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Disponibilidade Geral</span>
            <Wallet className="w-4 h-4 text-blue-900" />
          </div>
          <div className="text-2xl font-black text-slate-900">{formatKz(totalBalanceCents)}</div>
          <div className="text-[11px] text-slate-500 mt-1">Saldo somado de todas as contas ativas</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Receitas Confirmadas</span>
            <ArrowDownRight className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{formatKz(totalIncomeCents)}</div>
          <div className="text-[11px] text-slate-500 mt-1">{state.receipts.filter((r) => !r.isCancelled).length} recibos válidos</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Despesas Executadas</span>
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700">{formatKz(totalExpenseCents)}</div>
          <div className="text-[11px] text-slate-500 mt-1">{state.expenses.filter((e) => e.status === 'pago').length} despesas pagas</div>
        </div>
      </div>

      {/* Separadores Funcionais da Tesouraria */}
      <div className="flex items-center gap-1 border-b border-slate-200 text-xs overflow-x-auto whitespace-nowrap pb-px w-full max-w-full min-w-0">
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
    </div>
  );
};
