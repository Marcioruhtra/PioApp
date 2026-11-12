import React, { useState } from 'react';
import {
  FileText,
  Printer,
  XCircle,
  Plus,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  Save,
  Settings,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { OfficialDocument, DocumentType } from '../../types';
import { formatDateAO } from '../../utils/date';
import { Modal } from '../common/Modal';
import { PrintDocumentModal } from '../common/PrintDocumentModal';

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  recibo: 'Recibo de Quotas / Pagamento',
  mapa_financeiro: 'Mapa Financeiro',
  folha_presenca: 'Folha de Presença',
  ata: 'Ata de Reunião Oficial',
  declaracao_membro: 'Declaração de Membro Ativo',
  certificado: 'Certificado de Investidura / Formação',
  relatorio_anual: 'Relatório Anual',
};

export const DocumentsModule: React.FC = () => {
  const { state, can, currentUser, createOfficialDoc, cancelOfficialDoc, updateSettings } = useClub();
  const isDirectorOrAdmin = currentUser?.role === 'diretor' || currentUser?.role === 'admin_tecnico' || can('settings', 'EDIT');

  const [activeTab, setActiveTab] = useState<'documents' | 'templates'>('documents');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('todos');
  const [printedDoc, setPrintedDoc] = useState<OfficialDocument | null>(null);
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedDocToCancel, setSelectedDocToCancel] = useState<OfficialDocument | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Editable Document Templates State
  const [editableTemplates, setEditableTemplates] = useState<Record<DocumentType, string>>(
    state.settings.documentTemplates || {
      recibo: 'Certifica-se para os devidos efeitos que o Clube D\'Alvorada recebeu de {nome} a quantia referente a {mes}, liquidada através de {metodo} no valor de {valor}.',
      mapa_financeiro: 'Mapa financeiro oficial do Clube D\'Alvorada referente ao período ativo.',
      folha_presenca: 'Folha de presença oficial das atividades e reuniões do Clube D\'Alvorada.',
      ata: 'Ata da reunião oficial do Clube D\'Alvorada realizada na sede com os membros presentes.',
      declaracao_membro: 'A Direção do Clube D\'Alvorada declara, para os efeitos convenientes junto das entidades a quem interessar, que {nome} é membro ativo e em pleno gozo dos seus direitos associativos neste clube para o ano de {ano}. Finalidade declarada: {finalidade}.',
      certificado: 'Confere-se o presente certificado a {nome} pela conclusão satisfatória dos requisitos oficiais no ano de {ano}.',
      relatorio_anual: 'Relatório anual de atividades e contas do Clube D\'Alvorada.',
    }
  );

  // Formulário de Nova Declaração / Certificado
  const [newDocForm, setNewDocForm] = useState({
    type: 'declaracao_membro' as DocumentType,
    title: 'Declaração de Membro Ativo',
    issuedToMemberId: state.members[0]?.id || '',
    finalidade: 'Apresentação escolar para justificação de ausência em acampamento',
  });

  const filteredDocs = state.documents.filter((doc) => {
    const matchSearch =
      doc.documentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.issuedToName && doc.issuedToName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchType = typeFilter === 'todos' || doc.documentType === typeFilter;
    return matchSearch && matchType;
  });

  const [newDocError, setNewDocError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault();
    setNewDocError(null);
    const member = state.members.find((m) => m.id === newDocForm.issuedToMemberId);
    if (!member) return;

    const res = createOfficialDoc(
      newDocForm.type,
      newDocForm.title,
      {
        finalidade: newDocForm.finalidade,
        anoAtivo: state.settings.currentYear,
      },
      member.fullName,
      member.id
    );

    if (res.success) {
      setIsNewDocModalOpen(false);
      setNewDocError(null);
    } else {
      setNewDocError(res.error || 'Erro ao emitir documento.');
    }
  };

  const handleCancelConfirm = () => {
    if (!selectedDocToCancel) return;
    setCancelError(null);
    const res = cancelOfficialDoc(selectedDocToCancel.id, cancelReason);
    if (res.success) {
      setIsCancelModalOpen(false);
      setSelectedDocToCancel(null);
      setCancelReason('');
      setCancelError(null);
    } else {
      setCancelError(res.error || 'Erro ao anular documento.');
    }
  };

  const [templateFeedback, setTemplateFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSaveTemplates = (e: React.FormEvent) => {
    e.preventDefault();
    setTemplateFeedback(null);
    if (!isDirectorOrAdmin) {
      setTemplateFeedback({ type: 'error', message: 'Apenas o Diretor e o Administrador Técnico podem alterar os modelos de documentos do sistema.' });
      return;
    }
    updateSettings({ documentTemplates: editableTemplates });
    setTemplateFeedback({ type: 'success', message: 'Modelos e textos padrão de todos os documentos atualizados com sucesso para o sistema.' });
    setTimeout(() => setTemplateFeedback(null), 3500);
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {/* Topo do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs w-full max-w-full min-w-0">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-900 shrink-0" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Arquivo Geral e Modelos de Documentos Oficiais
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Numeração sequencial por tipo e ano (REC, ATA, DEC, CRT). O Diretor e o Administrador podem editar os modelos padrão de todos os documentos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {can('documents', 'CREATE') && (
            <button
              onClick={() => setIsNewDocModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Emitir Novo Documento</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs de Navegação */}
      {isDirectorOrAdmin && (
        <div className="flex items-center gap-2 border-b border-slate-200 text-xs overflow-x-auto whitespace-nowrap pb-px w-full max-w-full min-w-0">
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === 'documents'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Arquivo de Documentos Emitidos ({state.documents.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === 'templates'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Modelos e Textos Padrão (Direção / Admin)</span>
          </button>
        </div>
      )}

      {/* CONTEÚDO 1: Arquivo de Documentos */}
      {activeTab === 'documents' && (
        <>
          {/* Filtros */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-3 justify-between w-full max-w-full min-w-0">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Pesquisar documento por código ou titular..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white w-full md:w-auto"
            >
              <option value="todos">Todos os Tipos de Documento</option>
              <option value="recibo">Recibos de Quotas</option>
              <option value="ata">Atas de Reunião</option>
              <option value="declaracao_membro">Declarações de Membro</option>
              <option value="certificado">Certificados</option>
            </select>
          </div>

          {/* Tabela de Documentos */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden w-full max-w-full min-w-0">
            <div className="overflow-x-auto w-full max-w-full min-w-0">
              <table className="w-full min-w-[750px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Registo / Código</th>
                    <th className="py-3 px-4">Título do Documento</th>
                    <th className="py-3 px-4">Titular / Beneficiário</th>
                    <th className="py-3 px-4">Data Emissão</th>
                    <th className="py-3 px-4">Emitente</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {doc.documentNumber}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {doc.title}
                      </td>
                      <td className="py-3 px-4">
                        {doc.issuedToName || '-'}
                      </td>
                      <td className="py-3 px-4 text-[11px]">
                        {formatDateAO(doc.issuedAt)}
                      </td>
                      <td className="py-3 px-4 text-[11px]">
                        {doc.issuedByName}
                      </td>
                      <td className="py-3 px-4">
                        {doc.isCancelled ? (
                          <span className="text-[10px] font-bold text-rose-700 uppercase">Anulado</span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 uppercase">Válido</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => setPrintedDoc(doc)}
                            className="p-1.5 text-slate-500 hover:text-blue-900 rounded"
                            title="Imprimir / Exportar Documento"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {can('documents', 'ARCHIVE') && !doc.isCancelled && (
                            <button
                              onClick={() => {
                                setSelectedDocToCancel(doc);
                                setIsCancelModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-rose-700 rounded"
                              title="Anular Documento Oficial (Exige motivo obrigatório)"
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
        </>
      )}

      {/* CONTEÚDO 2: Editor de Modelos e Textos Padrão */}
      {activeTab === 'templates' && isDirectorOrAdmin && (
        <form onSubmit={handleSaveTemplates} className="space-y-6 w-full max-w-full min-w-0">
          <div className="bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-slate-800 p-4 rounded-xl text-blue-900 dark:text-blue-200 text-xs flex items-start gap-3 w-full max-w-full">
            <AlertTriangle className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-bold text-sm">Painel de Edição de Modelos Oficiais (Diretor e Administrador)</p>
              <p className="text-blue-800 dark:text-blue-300">
                Pode alterar a redação e os textos padrão de todos os documentos emitidos no sistema. Utilize as seguintes variáveis dinâmicas para enriquecer o detalhe dos documentos:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;nome&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;id_membro&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;bi&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;categoria&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;unidade&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;telefone&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;email&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;morada&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;ano&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;mes&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;valor&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;metodo&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;finalidade&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;deliberacao&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;nome_clube&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;morada_clube&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;telefone_clube&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;email_clube&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;diretor&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;data_atual&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;numero_documento&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;tipo_documento&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;cargo_diretor&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;secretario&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;tesoureiro&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;capelao&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;total_membros&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;data_emissao&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;ano_fundacao&#125;</span>
                <span className="bg-blue-100 dark:bg-slate-800 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono text-[11px]">&#123;lema_clube&#125;</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full max-w-full">
            {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((type) => (
              <div key={type} className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs space-y-3 w-full max-w-full min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    {DOCUMENT_TYPE_LABELS[type]}
                  </h3>
                  <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    {type}
                  </span>
                </div>
                <div>
                  <textarea
                    rows={4}
                    value={editableTemplates[type] || ''}
                    onChange={(e) =>
                      setEditableTemplates({
                        ...editableTemplates,
                        [type]: e.target.value,
                      })
                    }
                    className="w-full p-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 font-serif leading-relaxed"
                    required
                  />
                </div>
              </div>
            ))}
          </div>

          {templateFeedback && (
            <div
              className={`p-3 rounded-lg border text-xs font-semibold ${
                templateFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {templateFeedback.message}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs w-full max-w-full">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors w-full sm:w-auto justify-center"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Alterações em Todos os Modelos</span>
            </button>
          </div>
        </form>
      )}

      {/* Modal de Impressão / Visualização */}
      <PrintDocumentModal
        document={printedDoc}
        onClose={() => setPrintedDoc(null)}
      />

      {/* Modal de Emissão de Novo Documento */}
      <Modal
        isOpen={isNewDocModalOpen}
        onClose={() => setIsNewDocModalOpen(false)}
        title="Emitir Novo Documento Oficial"
      >
        <form onSubmit={handleCreateDocument} className="space-y-4 text-xs">
          {newDocError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-between">
              <span>{newDocError}</span>
              <button
                type="button"
                onClick={() => setNewDocError(null)}
                className="text-rose-500 hover:text-rose-800 font-bold ml-2 text-sm"
              >
                ×
              </button>
            </div>
          )}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Tipo de Documento</label>
            <select
              value={newDocForm.type}
              onChange={(e) => {
                const val = e.target.value as DocumentType;
                let defTitle = 'Declaração de Membro Ativo';
                if (val === 'certificado') defTitle = 'Certificado de Formação e Mérito';
                if (val === 'relatorio_anual') defTitle = 'Relatório Oficial Anual';
                setNewDocForm({ ...newDocForm, type: val, title: defTitle });
              }}
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-white"
            >
              <option value="declaracao_membro">Declaração de Membro Ativo</option>
              <option value="certificado">Certificado de Mérito / Investidura</option>
              <option value="relatorio_anual">Relatório Oficial Anual</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Título do Documento</label>
            <input
              type="text"
              value={newDocForm.title}
              onChange={(e) => setNewDocForm({ ...newDocForm, title: e.target.value })}
              className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-900 font-semibold"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Membro Titular / Beneficiário</label>
            <select
              value={newDocForm.issuedToMemberId}
              onChange={(e) => setNewDocForm({ ...newDocForm, issuedToMemberId: e.target.value })}
              className="w-full p-2.5 border border-slate-200 rounded-lg bg-white"
              required
            >
              {state.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} ({m.manualNumber})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Finalidade ou Notas do Documento</label>
            <textarea
              rows={3}
              value={newDocForm.finalidade}
              onChange={(e) => setNewDocForm({ ...newDocForm, finalidade: e.target.value })}
              className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-900"
              required
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsNewDocModalOpen(false)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded shadow-xs"
            >
              Emitir e Registar
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Anulação */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Anular Documento Oficial"
      >
        <div className="space-y-4 text-xs">
          {cancelError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-between">
              <span>{cancelError}</span>
              <button
                type="button"
                onClick={() => setCancelError(null)}
                className="text-rose-500 hover:text-rose-800 font-bold ml-2 text-sm"
              >
                ×
              </button>
            </div>
          )}
          <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800">
            <strong>Atenção:</strong> A anulação de documentos é irreversível e ficará permanentemente registada na auditoria do clube. O número de registo não poderá ser reutilizado.
          </div>
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Motivo da Anulação (Obrigatório)</label>
            <textarea
              rows={3}
              placeholder="Descreva o motivo pelo qual este documento está a ser anulado..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              required
            />
          </div>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsCancelModalOpen(false)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handleCancelConfirm}
              className="px-4 py-1.5 font-semibold text-white bg-rose-700 hover:bg-rose-600 rounded shadow-xs"
            >
              Confirmar Anulação Oficial
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
