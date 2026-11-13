import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  Users,
  Wallet,
  Calendar,
  GraduationCap,
  Filter,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { formatKz } from '../../utils/currency';
import { formatDateAO } from '../../utils/date';

export const ReportsModule: React.FC = () => {
  const { state, can } = useClub();
  const [reportType, setReportType] = useState<
    'members' | 'treasury' | 'activities' | 'training'
  >('members');

  // Exportação Real de Dados em formato CSV
  const handleExportCsv = () => {
    if (!can('reports', 'EXPORT')) {
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';

    if (reportType === 'members') {
      csvContent += 'ID;Numero_Manual;Nome_Completo;Categoria;Equipa;BI;Telefone;Renovacao;Estado\n';
      state.members.forEach((m) => {
        csvContent += `${m.id};${m.manualNumber};"${m.fullName}";${m.category};"${m.unitOrTeam?.trim() || 'Sem Equipa'}";${m.identityCardNumber};${m.phone};${m.annualRenewalYear};${m.status}\n`;
      });
    } else if (reportType === 'treasury') {
      csvContent += 'Recibo;Membro;Conceito;Periodo;Valor_Kz;Metodo;Data;Estado\n';
      state.receipts.forEach((r) => {
        csvContent += `${r.receiptNumber};"${r.memberName}";"${r.feeTitle}";"${r.periodLabel}";${r.amountPaidInCents / 100};${r.paymentMethod};${r.paidAt};${r.status}\n`;
      });
    } else if (reportType === 'activities') {
      csvContent += 'ID;Titulo;Tipo;Data;Local;Fase;Custo_Estimado_Kz;Custo_Aprovado_Kz\n';
      state.activities.forEach((a) => {
        csvContent += `${a.id};"${a.title}";${a.type};${a.startDate};"${a.location}";${a.stage};${a.costEstimatedInCents / 100};${a.costApprovedInCents / 100}\n`;
      });
    } else {
      csvContent += 'ID;Membro;Tipo;Titulo;Requisitos_Concluidos;Total_Requisitos;Investidura_Aprovada\n';
      state.trainingProgress.forEach((t) => {
        const mem = state.members.find((m) => m.id === t.memberId);
        csvContent += `${t.id};"${mem?.fullName || t.memberId}";${t.type};"${t.targetTitle}";${t.completedRequirements.length};${t.totalRequirements};${t.finalAuthorizedApproval}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Relatorio_Clube_DAlvorada_${reportType}_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!can('reports', 'PRINT')) {
      return;
    }
    window.print();
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {/* Topo do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs print:hidden w-full max-w-full min-w-0">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-900 shrink-0" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Relatórios e Mapas Estatísticos Oficiais
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Geração de relatórios auditáveis com filtragem e exportação em formato padrão CSV e impressão.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {can('reports', 'PRINT') && (
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Relatório</span>
            </button>
          )}

          {can('reports', 'EXPORT') && (
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Dados (CSV)</span>
            </button>
          )}
        </div>
      </div>

      {/* Seletor de Tipo de Relatório */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs print:hidden overflow-x-auto whitespace-nowrap pb-px w-full max-w-full min-w-0">
        <button
          onClick={() => setReportType('members')}
          className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            reportType === 'members'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Efetivo de Membros</span>
        </button>
        <button
          onClick={() => setReportType('treasury')}
          className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            reportType === 'treasury'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Mapa Financeiro</span>
        </button>
        <button
          onClick={() => setReportType('activities')}
          className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            reportType === 'activities'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Execução de Atividades</span>
        </button>
        <button
          onClick={() => setReportType('training')}
          className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            reportType === 'training'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Quadro de Formação</span>
        </button>
      </div>

      {/* Visualização do Relatório Oficial */}
      <div className="bg-white p-4 sm:p-8 rounded-xl border border-slate-200 shadow-xs print:p-0 print:border-none w-full max-w-full min-w-0">
        {/* Cabeçalho do Relatório */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 text-center">
          <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">
            CLUBE D'ALVORADA
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight mt-1">
            {reportType === 'members' && 'Relatório Oficial de Efetivo e Matrículas'}
            {reportType === 'treasury' && 'Mapa Geral de Arrecadação e Execução Financeira'}
            {reportType === 'activities' && 'Relatório de Atividades, Presenças e Custos'}
            {reportType === 'training' && 'Mapa Geral de Classes, Especialidades e Investidura'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ano Fiscal: {state.settings.currentYear} · Emitido em: {formatDateAO(new Date().toISOString())}
          </p>
        </div>

        {/* Tabelas de Conteúdo Conforme o Tipo */}
        {reportType === 'members' && (
          <div className="overflow-x-auto w-full max-w-full min-w-0">
            <table className="w-full min-w-[750px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Matrícula</th>
                  <th className="py-2.5 px-3">Nome do Membro</th>
                  <th className="py-2.5 px-3">Categoria</th>
                  <th className="py-2.5 px-3">Equipa</th>
                  <th className="py-2.5 px-3">B.I.</th>
                  <th className="py-2.5 px-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {state.members.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{m.id}</td>
                    <td className="py-2.5 px-3">{m.manualNumber}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{m.fullName}</td>
                    <td className="py-2.5 px-3 capitalize">{m.category}</td>
                    <td className="py-2.5 px-3">{m.unitOrTeam?.trim() || 'Sem Equipa'}</td>
                    <td className="py-2.5 px-3 font-mono">{m.identityCardNumber}</td>
                    <td className="py-2.5 px-3 capitalize">{m.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'treasury' && (
          <div className="overflow-x-auto w-full max-w-full min-w-0">
            <table className="w-full min-w-[750px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                  <th className="py-2.5 px-3">Nº Recibo</th>
                  <th className="py-2.5 px-3">Membro</th>
                  <th className="py-2.5 px-3">Conceito</th>
                  <th className="py-2.5 px-3">Período</th>
                  <th className="py-2.5 px-3">Valor Kz</th>
                  <th className="py-2.5 px-3">Método</th>
                  <th className="py-2.5 px-3">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {state.receipts.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 px-3 font-mono font-bold">{r.receiptNumber}</td>
                    <td className="py-2.5 px-3 font-semibold">{r.memberName}</td>
                    <td className="py-2.5 px-3">{r.feeTitle}</td>
                    <td className="py-2.5 px-3">{r.periodLabel}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{formatKz(r.amountPaidInCents)}</td>
                    <td className="py-2.5 px-3 capitalize">{r.paymentMethod.replace('_', ' ')}</td>
                    <td className="py-2.5 px-3">{formatDateAO(r.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'activities' && (
          <div className="overflow-x-auto w-full max-w-full min-w-0">
            <table className="w-full min-w-[750px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                  <th className="py-2.5 px-3">Código</th>
                  <th className="py-2.5 px-3">Título</th>
                  <th className="py-2.5 px-3">Data</th>
                  <th className="py-2.5 px-3">Local</th>
                  <th className="py-2.5 px-3">Fase</th>
                  <th className="py-2.5 px-3">Custo Estimado</th>
                  <th className="py-2.5 px-3">Custo Aprovado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {state.activities.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2.5 px-3 font-mono font-bold">{a.id}</td>
                    <td className="py-2.5 px-3 font-semibold">{a.title}</td>
                    <td className="py-2.5 px-3">{formatDateAO(a.startDate)}</td>
                    <td className="py-2.5 px-3">{a.location}</td>
                    <td className="py-2.5 px-3 capitalize">{a.stage}</td>
                    <td className="py-2.5 px-3">{formatKz(a.costEstimatedInCents)}</td>
                    <td className="py-2.5 px-3 font-bold">{formatKz(a.costApprovedInCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportType === 'training' && (
          <div className="overflow-x-auto w-full max-w-full min-w-0">
            <table className="w-full min-w-[750px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                  <th className="py-2.5 px-3">Membro</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Classe / Especialidade</th>
                  <th className="py-2.5 px-3">Progresso</th>
                  <th className="py-2.5 px-3">Instrutor</th>
                  <th className="py-2.5 px-3">Investidura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {state.trainingProgress.map((tp) => {
                  const mem = state.members.find((m) => m.id === tp.memberId);
                  const pct = Math.round((tp.completedRequirements.length / tp.totalRequirements) * 100);

                  return (
                    <tr key={tp.id}>
                      <td className="py-2.5 px-3 font-semibold">{mem?.fullName || tp.memberId}</td>
                      <td className="py-2.5 px-3 capitalize">{tp.type}</td>
                      <td className="py-2.5 px-3 font-bold">{tp.targetTitle}</td>
                      <td className="py-2.5 px-3 font-bold text-blue-900">{pct}% ({tp.completedRequirements.length}/{tp.totalRequirements})</td>
                      <td className="py-2.5 px-3">{tp.instructorName}</td>
                      <td className="py-2.5 px-3 font-bold">
                        {tp.finalAuthorizedApproval ? (
                          <span className="text-emerald-700">Aprovada</span>
                        ) : (
                          <span className="text-amber-700">Pendente</span>
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
  );
};
