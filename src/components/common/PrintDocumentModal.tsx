import React from 'react';
import { Printer, X } from 'lucide-react';
import { OfficialDocument } from '../../types';
import { formatDateAO } from '../../utils/date';
import { useClub } from '../../context/ClubContext';
import { formatKz } from '../../utils/currency';
import {
  OfficialDocumentHeader,
  OfficialDocumentMetadata,
  OfficialDocumentBanner,
  OfficialRemessaBox,
  OfficialDocumentSignatures,
  OfficialDocumentFooter,
} from '../documents';

interface PrintDocumentModalProps {
  document: OfficialDocument | null;
  onClose: () => void;
}

export const PrintDocumentModal: React.FC<PrintDocumentModalProps> = ({
  document,
  onClose,
}) => {
  const { state } = useClub();

  const settings = state.settings;
  const clubName = settings.clubName || "Clube de Embaixadores Pioneiros D'Alvorada";
  const address = settings.address || "Rua do Grupo Desportivo da Banca, Maianga, Luanda, Angola";
  const phone = settings.phone || "931793101";
  const alternatePhone = settings.alternatePhone || "927705324";
  const email = settings.email || "ebxpioneirosdalvorada2019@hotmail.com";
  const headquarters = settings.city || settings.headquarters || "Luanda, Município de Talatona";

  const templates = settings.documentTemplates || {};
  const customTpl = document ? templates[document.documentType] : '';
  const content = document ? (document.contentData || {}) : {};

  // REGRA: O Id do Membro mostrado nos documentos será SEMPRE o mesmo que Id de matrícula definido no registro pelo secretário (manualNumber)
  const resolvedMember = React.useMemo(() => {
    if (!document) return null;
    // 1. Procurar pelo issuedToMemberId
    if (document.issuedToMemberId) {
      const found = state.members.find(
        (m) => m.id === document.issuedToMemberId || m.manualNumber === document.issuedToMemberId
      );
      if (found) return found;
    }
    // 2. Procurar pelo content.memberId
    if (content.memberId) {
      const found = state.members.find(
        (m) => m.id === String(content.memberId) || m.manualNumber === String(content.memberId)
      );
      if (found) return found;
    }
    // 3. Procurar pelo nome do titular
    if (document.issuedToName) {
      const cleanName = document.issuedToName.trim().toLowerCase();
      const found = state.members.find(
        (m) => m.fullName.trim().toLowerCase() === cleanName
      );
      if (found) return found;
    }
    return null;
  }, [state.members, document?.issuedToMemberId, document?.issuedToName, content.memberId]);

  const memberId = resolvedMember
    ? resolvedMember.manualNumber
    : String(content.memberId || document?.issuedToMemberId || '');

  if (!document) return null;

  const handlePrint = () => {
    window.print();
  };

  const renderCustomText = () => {
    if (!customTpl) return null;
    let text = customTpl;
    text = text.replace(/\{nome\}/g, document.issuedToName || resolvedMember?.fullName || 'Titular');
    text = text.replace(/\{id_membro\}/g, memberId || 'N/A');
    text = text.replace(/\{bi\}/g, resolvedMember?.identityCardNumber || 'N/A');
    text = text.replace(/\{categoria\}/g, resolvedMember?.category ? resolvedMember.category.toUpperCase() : 'Membro');
    text = text.replace(/\{unidade\}/g, resolvedMember?.unitOrTeam || 'Geral');
    text = text.replace(/\{telefone\}/g, resolvedMember?.phone || 'N/A');
    text = text.replace(/\{email\}/g, resolvedMember?.email || 'N/A');
    text = text.replace(/\{morada\}/g, resolvedMember?.address || 'N/A');
    text = text.replace(/\{ano\}/g, String(document.year));
    text = text.replace(/\{mes\}/g, String(content.mes || 'Mês Atual'));
    text = text.replace(/\{metodo\}/g, String(content.metodo || 'Multicaixa'));
    text = text.replace(/\{valor\}/g, String(content.valor || '0,00 Kz'));
    text = text.replace(/\{finalidade\}/g, String(content.finalidade || 'Fins institucionais'));
    text = text.replace(/\{deliberacao\}/g, String(content.deliberacao || content.deliberations || 'Deliberações gerais'));
    text = text.replace(/\{nome_clube\}/g, clubName);
    text = text.replace(/\{morada_clube\}/g, address);
    text = text.replace(/\{telefone_clube\}/g, `${phone} / ${alternatePhone}`);
    text = text.replace(/\{email_clube\}/g, email);
    text = text.replace(/\{diretor\}/g, document.issuedByName || 'Direção Executiva');
    text = text.replace(/\{data_atual\}/g, formatDateAO(new Date().toISOString()));
    text = text.replace(/\{numero_documento\}/g, document.documentNumber);
    text = text.replace(/\{tipo_documento\}/g, document.documentType);
    text = text.replace(/\{cargo_diretor\}/g, 'Diretor do Clube');
    text = text.replace(/\{secretario\}/g, 'Secretaria Geral');
    text = text.replace(/\{tesoureiro\}/g, 'Tesouraria Geral');
    text = text.replace(/\{capelao\}/g, 'Capelania');
    text = text.replace(/\{total_membros\}/g, String(state.members.length));
    text = text.replace(/\{data_emissao\}/g, formatDateAO(document.issuedAt));
    text = text.replace(/\{ano_fundacao\}/g, '2019');
    text = text.replace(/\{lema_clube\}/g, 'Salvar do pecado e guiar no serviço');
    text = text.replace(/Conferência Geral dos Embaixadores/gi, '');
    text = text.replace(/República de Angola/gi, '');
    return text;
  };

  // Determinar Título Formal conforme o Modelo de Documento
  const getDocumentFormalTitle = () => {
    switch (document.documentType) {
      case 'recibo':
        return 'Comprovativo de Pagamento';
      case 'declaracao_membro':
        return 'Declaração Institucional de Membro Ativo';
      case 'certificado':
        return 'Certificado de Mérito e Formação';
      case 'ata':
        return 'Ata Oficial de Reunião Diretiva';
      case 'mapa_financeiro':
        return 'Mapa Financeiro e Balancete Oficial';
      case 'folha_presenca':
        return 'Folha Oficial de Presença e Chamada';
      case 'relatorio_anual':
        return 'Relatório Oficial de Atividades e Contas';
      default:
        return document.title || 'Documento Oficial';
    }
  };

  return (
    <div className="print-modal-wrapper fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:z-auto print:overflow-visible print:block print:flex-none print:justify-start print:items-start">
      <div className="printable-document-modal relative w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-4 sm:my-6 print:border-none print:shadow-none print:m-0 print:rounded-none print:max-w-none print:w-full print:h-auto print:overflow-visible">
        {/* Barra de Ações Superior (Oculta na Impressão) */}
        <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-mono font-bold">
              {document.documentNumber}
            </span>
            <span className="text-xs text-slate-300">· Visualização e Impressão Oficial</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / Gerar PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Folha do Documento Oficial (Formato Padronizado da Organização) */}
        <div className="p-6 sm:p-10 text-slate-900 bg-white print:p-4">
          {/* 1. Cabeçalho Oficial Extraído do Comprovativo Modelo */}
          <OfficialDocumentHeader
            clubName={clubName}
            address={address}
            phone={phone}
            alternatePhone={alternatePhone}
            email={email}
            documentTitle={getDocumentFormalTitle()}
          />

          {/* 2. Metadados do Registo (2 Colunas Alinhadas) */}
          <OfficialDocumentMetadata
            documentType={document.documentType}
            documentNumber={document.documentNumber}
            issuedAt={document.issuedAt}
            memberId={memberId || undefined}
            recipientName={document.issuedToName}
            recipientLabel={document.documentType === 'recibo' ? 'Cobrar a' : 'Titular'}
            location={headquarters}
            issuedByName={document.issuedByName}
            isCancelled={document.isCancelled}
            cancellationReason={document.cancellationReason}
            isRejected={document.isRejected}
            rejectionReason={document.rejectionReason}
          />

          {/* 3. Banner Escuro de Destaque Oficial */}
          {document.documentType === 'recibo' && (
            <OfficialDocumentBanner
              label="Montante Pago:"
              value={String(content.valor || content.amount || '0,00 Kz')}
            />
          )}

          {document.documentType === 'declaracao_membro' && (
            <OfficialDocumentBanner
              label="Estatuto Institucional:"
              value="Membro Ativo e em Situação Regular"
              isMono={false}
            />
          )}

          {document.documentType === 'certificado' && (
            <OfficialDocumentBanner
              label="Habilitação Oficial:"
              value={`Conclusão Aprovada · Ano ${document.year}`}
              isMono={false}
            />
          )}

          {document.documentType === 'ata' && (
            <OfficialDocumentBanner
              label="Órgão Colegial:"
              value="Direção Geral e Secretaria Executiva"
              isMono={false}
            />
          )}

          {document.documentType === 'mapa_financeiro' && (
            <OfficialDocumentBanner
              label="Saldo Consolidado do Clube:"
              value={formatKz(state.accounts.reduce((sum, a) => sum + a.currentBalanceInCents, 0))}
            />
          )}

          {document.documentType === 'folha_presenca' && (
            <OfficialDocumentBanner
              label="Registo de Assiduidade:"
              value={`Sessão Oficial · ${formatDateAO(document.issuedAt)}`}
              isMono={false}
            />
          )}

          {document.documentType === 'relatorio_anual' && (
            <OfficialDocumentBanner
              label="Exercício Fiscal e Associativo:"
              value={`Ano Social de ${document.year}`}
              isMono={false}
            />
          )}

          {/* 4. Corpo Central Específico do Documento */}
          <div className="print-document-body space-y-4 text-xs text-slate-800 leading-relaxed min-h-[140px] print:space-y-2">
            {customTpl && document.documentType !== 'recibo' ? (
              <div className="whitespace-pre-line p-5 bg-slate-50/80 border border-slate-200 rounded text-slate-800 leading-relaxed font-serif text-sm">
                {renderCustomText()}
              </div>
            ) : (
              <>
                {/* A. MODELO: RECIBO / COMPROVATIVO DE PAGAMENTO */}
                {document.documentType === 'recibo' && (
                  <div className="space-y-4">
                    {/* Tabela de Itens / Descrição do Pagamento */}
                    <div className="border border-slate-900 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-white text-[11px] uppercase tracking-wider">
                            <th className="p-2 border-r border-slate-700 w-24">Rubrica</th>
                            <th className="p-2 border-r border-slate-700 w-28">Data</th>
                            <th className="p-2 border-r border-slate-700 w-32">Pagamento</th>
                            <th className="p-2 text-right w-32">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs divide-y divide-slate-300">
                          <tr>
                            <td className="p-2 border-r border-slate-300 font-medium">{String(content.rubrica || content.descricao || 'Quota Institucional')}</td>
                            <td className="p-2 border-r border-slate-300 font-medium">
                              {formatDateAO(document.issuedAt)}
                            </td>
                            <td className="p-2 border-r border-slate-300">
                              {String(content.metodo || 'Multicaixa / Transferência')}
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-slate-900">
                              {String(content.valor || '0,00 Kz')}
                            </td>
                          </tr>
                          <tr className="bg-slate-100 font-bold">
                            <td colSpan={3} className="p-2 text-right border-r border-slate-300 uppercase tracking-wider text-slate-900">
                              TOTAL LIQUIDADO
                            </td>
                            <td className="p-2 text-right font-mono text-blue-950 font-black">
                              {String(content.valor || '0,00 Kz')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Bloco REMESSA Oficial */}
                    <OfficialRemessaBox
                      memberName={document.issuedToName}
                      memberId={memberId}
                      documentNumber={document.documentNumber}
                      issuedAt={document.issuedAt}
                      highlightLabel="Montante Pago:"
                      highlightValue={String(content.valor || '0,00 Kz')}
                    />
                  </div>
                )}

                {/* B. MODELO: DECLARAÇÃO DE MEMBRO ATIVO */}
                {document.documentType === 'declaracao_membro' && (
                  <div className="space-y-4">
                    <p className="text-sm leading-relaxed text-slate-800 text-justify font-serif">
                      A Direção do <strong>{clubName}</strong>, sita em {address}, declara para os devidos efeitos convenientes junto das entidades públicas, civis ou escolares a quem interessar, que <strong>{document.issuedToName}</strong> (Matrícula N.º {memberId || 'N/A'}) é membro efetivo, devidamente matriculado e em pleno gozo dos seus direitos estatutários no ano de <strong>{document.year}</strong>.
                    </p>

                    <div className="border border-slate-900 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-white text-[11px] uppercase tracking-wider">
                            <th className="p-2 border-r border-slate-700">Identificação</th>
                            <th className="p-2 border-r border-slate-700">Situação de Quotas</th>
                            <th className="p-2 border-r border-slate-700">Finalidade Declarada</th>
                            <th className="p-2 text-right">Validade</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs divide-y divide-slate-300">
                          <tr>
                            <td className="p-2 border-r border-slate-300 font-bold text-slate-900">
                              {document.issuedToName}
                            </td>
                            <td className="p-2 border-r border-slate-300 text-emerald-800 font-semibold">
                              Regularizada
                            </td>
                            <td className="p-2 border-r border-slate-300 italic">
                              {String(content.finalidade || 'Fins institucionais e escolares')}
                            </td>
                            <td className="p-2 text-right font-medium">
                              Exercício de {document.year}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Bloco REMESSA Oficial */}
                    <OfficialRemessaBox
                      title="REMESSA"
                      subTitle="CONTROLO DE DECLARAÇÃO OFICIAL"
                      memberName={document.issuedToName}
                      memberId={memberId}
                      documentNumber={document.documentNumber}
                      issuedAt={document.issuedAt}
                      highlightLabel="Situação Estatutária:"
                      highlightValue="Regularizada e Ativa"
                    />
                  </div>
                )}

                {/* C. MODELO: CERTIFICADO DE MÉRITO / FORMAÇÃO */}
                {document.documentType === 'certificado' && (
                  <div className="space-y-4">
                    <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded text-center space-y-3">
                      <p className="text-xs uppercase tracking-widest text-slate-500 font-bold">
                        Pelo presente instrumento de investidura
                      </p>
                      <h3 className="text-lg font-black text-slate-900 uppercase">
                        {document.issuedToName}
                      </h3>
                      <p className="text-xs text-slate-700 max-w-xl mx-auto leading-relaxed">
                        Concluiu com aproveitamento meritório todos os requisitos de formação técnica, cívica e de liderança estabelecidos no regulamento do {clubName} no ano de <strong>{document.year}</strong>.
                      </p>
                    </div>

                    <div className="border border-slate-900 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-white text-[11px] uppercase tracking-wider">
                            <th className="p-2 border-r border-slate-700">Requisito Oficial</th>
                            <th className="p-2 border-r border-slate-700">Departamento Responsável</th>
                            <th className="p-2 border-r border-slate-700">Classificação</th>
                            <th className="p-2 text-right">Resultado</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs divide-y divide-slate-300">
                          <tr>
                            <td className="p-2 border-r border-slate-300 font-semibold">Investidura e Especialidades</td>
                            <td className="p-2 border-r border-slate-300">Instrução e Formação</td>
                            <td className="p-2 border-r border-slate-300">Satisfatória / Excelente</td>
                            <td className="p-2 text-right font-bold text-emerald-800">Aprovado</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Bloco REMESSA Oficial */}
                    <OfficialRemessaBox
                      title="REMESSA"
                      subTitle="CONTROLO DE CERTIFICAÇÃO"
                      memberName={document.issuedToName}
                      memberId={memberId}
                      documentNumber={document.documentNumber}
                      issuedAt={document.issuedAt}
                      highlightLabel="Grau Conferido:"
                      highlightValue="Certificado Válido"
                    />
                  </div>
                )}

                {/* D. MODELO: ATA DE REUNIÃO */}
                {document.documentType === 'ata' && (
                  <div className="space-y-4">
                    <div className="border border-slate-900 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-white text-[11px] uppercase tracking-wider">
                            <th className="p-2 border-r border-slate-700 w-32">Local da Sessão</th>
                            <th className="p-2 border-r border-slate-700 w-28">Participantes</th>
                            <th className="p-2">Ordem de Trabalhos / Deliberações</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs divide-y divide-slate-300">
                          <tr>
                            <td className="p-2 border-r border-slate-300 font-medium">
                              {String(content.local || address)}
                            </td>
                            <td className="p-2 border-r border-slate-300 font-semibold">
                              {String(content.presentes ? `${content.presentes} Membros Presentes` : 'Diretoria Completa')}
                            </td>
                            <td className="p-2 whitespace-pre-line text-slate-800 leading-relaxed font-serif">
                              {String(content.deliberacao || content.deliberations || 'Deliberações oficiais aprovadas por unanimidade dos presentes em sessão ordinária.')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Bloco REMESSA Oficial */}
                    <OfficialRemessaBox
                      title="REMESSA"
                      subTitle="CONTROLO DO LIVRO DE ATAS"
                      memberName="Diretoria Geral do Clube"
                      memberId="DIR-GERAL"
                      documentNumber={document.documentNumber}
                      issuedAt={document.issuedAt}
                      highlightLabel="Decisão Colegial:"
                      highlightValue="Aprovada em Reunião"
                    />
                  </div>
                )}

                {/* E. MODELO: MAPA FINANCEIRO */}
                {document.documentType === 'mapa_financeiro' && (
                  <div className="space-y-4">
                    <div className="border border-slate-900 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-white text-[11px] uppercase tracking-wider">
                            <th className="p-2 border-r border-slate-700">Conta Institucional</th>
                            <th className="p-2 border-r border-slate-700">Tipo de Conta</th>
                            <th className="p-2 border-r border-slate-700">Titularidade</th>
                            <th className="p-2 text-right">Saldo Atual</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs divide-y divide-slate-300">
                          {state.accounts.map((acc) => (
                            <tr key={acc.id}>
                              <td className="p-2 border-r border-slate-300 font-semibold">{acc.name}</td>
                              <td className="p-2 border-r border-slate-300 capitalize">{acc.type}</td>
                              <td className="p-2 border-r border-slate-300">{acc.accountNumber || clubName}</td>
                              <td className="p-2 text-right font-mono font-bold text-slate-900">
                                {formatKz(acc.currentBalanceInCents)}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-slate-100 font-bold">
                            <td colSpan={3} className="p-2 text-right border-r border-slate-300 uppercase tracking-wider text-slate-900">
                              SALDO DISPONÍVEL TOTAL
                            </td>
                            <td className="p-2 text-right font-mono text-blue-950 font-black">
                              {formatKz(state.accounts.reduce((sum, a) => sum + a.currentBalanceInCents, 0))}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Bloco REMESSA Oficial */}
                    <OfficialRemessaBox
                      title="REMESSA"
                      subTitle="CONTROLO CONTABILÍSTICO"
                      memberName="Departamento de Tesouraria"
                      memberId="DEP-TESOURARIA"
                      documentNumber={document.documentNumber}
                      issuedAt={document.issuedAt}
                      highlightLabel="Auditoria da Tesouraria:"
                      highlightValue="Conferido e Balanceado"
                    />
                  </div>
                )}

                {/* F. MODELO: FOLHA DE PRESENÇA */}
                {document.documentType === 'folha_presenca' && (
                  <div className="space-y-4">
                    <div className="border border-slate-900 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-white text-[11px] uppercase tracking-wider">
                            <th className="p-2 border-r border-slate-700 w-12 text-center">N.º</th>
                            <th className="p-2 border-r border-slate-700">Nome do Membro</th>
                            <th className="p-2 border-r border-slate-700 w-28">ID / Categoria</th>
                            <th className="p-2 w-40 text-center">Assinatura / Rubrica</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs divide-y divide-slate-300">
                          {state.members.slice(0, 10).map((m, idx) => (
                            <tr key={m.id}>
                              <td className="p-2 border-r border-slate-300 text-center font-mono">{idx + 1}</td>
                              <td className="p-2 border-r border-slate-300 font-medium">{m.fullName}</td>
                              <td className="p-2 border-r border-slate-300 font-mono text-[11px] font-bold">{m.manualNumber || m.id}</td>
                              <td className="p-2 border-b border-dashed border-slate-300"></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Bloco REMESSA Oficial */}
                    <OfficialRemessaBox
                      title="REMESSA"
                      subTitle="CONTROLO DE SESSÃO"
                      memberName="Secretaria Executiva"
                      memberId="DEP-SECRETARIA"
                      documentNumber={document.documentNumber}
                      issuedAt={document.issuedAt}
                      highlightLabel="Presença Verificada:"
                      highlightValue="Conferido em Chamada"
                    />
                  </div>
                )}

                {/* G. MODELO: RELATÓRIO ANUAL OU DOCUMENTO GERAL */}
                {document.documentType === 'relatorio_anual' && (
                  <div className="space-y-4">
                    <p className="text-sm leading-relaxed text-slate-800 text-justify font-serif">
                      O presente relatório consagra o resumo operacional, estatutário e financeiro do <strong>{clubName}</strong> respeitante ao exercício associativo de <strong>{document.year}</strong>, submetido para apreciação e homologação pela Direção e órgãos competentes.
                    </p>

                    <div className="border border-slate-900 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-white text-[11px] uppercase tracking-wider">
                            <th className="p-2 border-r border-slate-700">Indicador Institucional</th>
                            <th className="p-2 border-r border-slate-700">Membros Registados</th>
                            <th className="p-2 border-r border-slate-700">Atividades Realizadas</th>
                            <th className="p-2 text-right">Saldo em Caixa</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs divide-y divide-slate-300">
                          <tr>
                            <td className="p-2 border-r border-slate-300 font-semibold">Exercício {document.year}</td>
                            <td className="p-2 border-r border-slate-300 font-mono">{state.members.length} Membros</td>
                            <td className="p-2 border-r border-slate-300 font-mono">{state.activities.length} Atividades</td>
                            <td className="p-2 text-right font-mono font-bold text-slate-900">
                              {formatKz(state.accounts.reduce((sum, a) => sum + a.currentBalanceInCents, 0))}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Bloco REMESSA Oficial */}
                    <OfficialRemessaBox
                      title="REMESSA"
                      subTitle="ARQUIVO INSTITUCIONAL"
                      memberName="Diretoria Geral do Clube"
                      memberId="DIR-GERAL"
                      documentNumber={document.documentNumber}
                      issuedAt={document.issuedAt}
                      highlightLabel="Estado de Homologação:"
                      highlightValue="Concluído e Arquivado"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* 5. Linha de Assinatura Única com Carimbo Institucional do Clube */}
          <OfficialDocumentSignatures
            signerName={document.issuedByName}
            signerRole={
              document.documentType === 'recibo'
                ? 'Tesoureiro Geral do Clube'
                : document.documentType === 'declaracao_membro'
                ? 'Diretor do Clube'
                : document.documentType === 'ata'
                ? 'Secretário Geral da Sessão'
                : 'Responsável Autorizado'
            }
            secondSignerName={
              document.documentType === 'ata' || document.documentType === 'certificado' || document.documentType === 'mapa_financeiro'
                ? (state.users.find(u => u.role === 'diretor')?.name || 'Carlos Mutamba')
                : undefined
            }
            secondSignerRole={
              document.documentType === 'ata'
                ? 'Presidente da Mesa Diretiva'
                : 'Visto da Direção Geral'
            }
            clubName={clubName}
            year={document.year}
          />

          {/* 6. Rodapé Legal e Código de Validação */}
          <OfficialDocumentFooter
            clubName={clubName}
            documentNumber={document.documentNumber}
          />
        </div>

        {/* Barra de Ações Inferior (Oculta na Impressão) */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-center gap-3 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-blue-900 hover:bg-blue-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir / Gerar PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
