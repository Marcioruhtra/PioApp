import React, { useState } from 'react';
import {
  MessageSquare,
  Bell,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Send,
  AlertTriangle,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { ClubAnnouncement, MemberPortalRequest } from '../../types';
import { formatDateAO } from '../../utils/date';
import { Modal } from '../common/Modal';

export const RequestsModule: React.FC = () => {
  const { state, can, currentUser, addAnnouncement, respondToRequest } = useClub();

  const isMember = currentUser.role === 'membro';
  const [activeTab, setActiveTab] = useState<'requests' | 'announcements'>(isMember ? 'announcements' : 'requests');
  const [isNewAnnModalOpen, setIsNewAnnModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<MemberPortalRequest | null>(null);
  const [responseNotes, setResponseNotes] = useState('');

  // Filtragem estrita por cargo e categoria conforme diretiva institucional
  const filteredRequests = state.requests.filter((req) => {
    // Esconder categorias proibidas
    if (req.category !== 'atualizacao_dados' && req.category !== 'tesouraria') {
      return false;
    }
    
    if (currentUser.role === 'tesoureiro') {
      return req.category === 'tesouraria';
    }
    if (currentUser.role === 'secretario') {
      return req.category === 'atualizacao_dados';
    }
    if (currentUser.role === 'instrutor') {
      return false;
    }
    if (currentUser.role === 'diretor' || currentUser.role === 'admin_tecnico') {
      return true;
    }
    return false;
  });

  // Formulário Aviso
  const [annForm, setAnnForm] = useState({
    title: '',
    content: '',
    urgency: 'normal' as ClubAnnouncement['urgency'],
    targetAudience: 'todos' as ClubAnnouncement['targetAudience'],
  });

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annForm.title.trim()) return;

    addAnnouncement(annForm.title.trim(), annForm.content.trim(), annForm.urgency, annForm.targetAudience);
    setIsNewAnnModalOpen(false);
    setAnnForm({
      title: '',
      content: '',
      urgency: 'normal',
      targetAudience: 'todos',
    });
  };

  const [responseError, setResponseError] = useState<string | null>(null);

  const handleRespond = (status: 'aprovado' | 'rejeitado' | 'concluido') => {
    if (!selectedRequest) return;
    setResponseError(null);
    const res = respondToRequest(selectedRequest.id, status, responseNotes);
    if (res.success) {
      setSelectedRequest(null);
      setResponseNotes('');
      setResponseError(null);
    } else {
      setResponseError(res.error || 'Erro ao processar parecer.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Topo do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-900" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              {isMember ? 'Avisos e Editais Oficiais do Clube' : 'Pedidos Institucionais e Avisos Oficiais'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isMember
              ? 'Consulte editais, convocações e comunicados emitidos pela Direção e Departamentos.'
              : 'Gestão de comunicações internas, solicitações de membros e editais da Direção.'}
          </p>
        </div>

        {can('requests', 'CREATE') && (
          <button
            onClick={() => setIsNewAnnModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Publicar Aviso Geral</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs overflow-x-auto whitespace-nowrap pb-px">
        {!isMember && (
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === 'requests'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>
              Solicitações de Membros ({filteredRequests.length})
              {currentUser.role === 'tesoureiro' && ' · Tesouraria'}
              {currentUser.role === 'secretario' && ' · Secretaria'}
              {currentUser.role === 'instrutor' && ' · Formação'}
            </span>
          </button>
        )}
        <button
          onClick={() => setActiveTab('announcements')}
          className={`px-4 py-2.5 font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === 'announcements' || isMember
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Avisos e Editais ({state.announcements.length})</span>
        </button>
      </div>

      {/* Conteúdo 1: Solicitações dos Membros */}
      {!isMember && activeTab === 'requests' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {filteredRequests.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              Nenhuma solicitação de{' '}
              {currentUser.role === 'tesoureiro'
                ? 'Tesouraria'
                : currentUser.role === 'instrutor'
                ? 'Formação e Classes'
                : 'Secretaria Geral'}{' '}
              pendente no momento.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRequests.map((req) => (
                <div key={req.id} className="p-4 hover:bg-slate-50 text-xs transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-slate-400">{req.id}</span>
                      <h3 className="font-bold text-slate-900">{req.subject}</h3>
                      <span className="text-[10px] uppercase font-bold text-slate-500">· {req.category.replace('_', ' ')}</span>
                    </div>
                    <p className="text-slate-600 mt-1 leading-relaxed">{req.details}</p>
                    <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-3">
                      <span>Membro: <strong>{req.memberName}</strong></span>
                      <span>·</span>
                      <span>Submetido a: {formatDateAO(req.createdAt)}</span>
                      {req.assignedUserName && <span>· Analisado por: <strong>{req.assignedUserName}</strong></span>}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      req.status === 'concluido' || req.status === 'aprovado'
                        ? 'bg-emerald-50 text-emerald-800'
                        : req.status === 'rejeitado'
                        ? 'bg-rose-50 text-rose-800'
                        : 'bg-amber-50 text-amber-800'
                    }`}>
                      {req.status}
                    </span>

                    {can('requests', 'APPROVE') && req.status === 'pendente' && (
                      <button
                        onClick={() => setSelectedRequest(req)}
                        className="px-3 py-1 text-xs font-semibold bg-blue-900 hover:bg-blue-800 text-white rounded shadow-xs"
                      >
                        Decidir Pedido
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}

      {/* Conteúdo 2: Avisos Oficiais */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {state.announcements.map((ann) => (
              <div key={ann.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    ann.urgency === 'urgente'
                      ? 'bg-rose-100 text-rose-800'
                      : ann.urgency === 'importante'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {ann.urgency}
                  </span>
                  <span className="text-[11px] text-slate-400">{formatDateAO(ann.publishedAt)}</span>
                </div>

                <h3 className="text-sm font-bold text-slate-900">{ann.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{ann.content}</p>

                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                  Emitido por: {ann.publishedByName}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: Publicar Aviso */}
      <Modal
        isOpen={isNewAnnModalOpen}
        onClose={() => setIsNewAnnModalOpen(false)}
        title="Publicar Aviso Oficial do Clube"
        description="O aviso ficará imediatamente visível no mural e no portal dos membros."
        maxWidth="md"
      >
        <form onSubmit={handleCreateAnnouncement} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Título do Aviso</label>
            <input
              type="text"
              placeholder="Ex: Convocatória para Marcha Cívica 4 de Abril"
              value={annForm.title}
              onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Grau de Urgência</label>
              <select
                value={annForm.urgency}
                onChange={(e) => setAnnForm({ ...annForm, urgency: e.target.value as any })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              >
                <option value="normal">Normal</option>
                <option value="importante">Importante</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Público-Alvo</label>
              <select
                value={annForm.targetAudience}
                onChange={(e) => setAnnForm({ ...annForm, targetAudience: e.target.value as any })}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              >
                <option value="todos">Todos os Membros</option>
                <option value="embaixadores">Embaixadores</option>
                <option value="aspirantes">Aspirantes</option>
                <option value="pais">Encarregados de Educação</option>
                <option value="lideranca">Liderança Executiva</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Texto do Edital</label>
            <textarea
              rows={4}
              value={annForm.content}
              onChange={(e) => setAnnForm({ ...annForm, content: e.target.value })}
              className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
              required
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsNewAnnModalOpen(false)}
              className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded shadow-xs"
            >
              Publicar Edital
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Decisão sobre Pedido de Membro */}
      {selectedRequest && (
        <Modal
          isOpen={Boolean(selectedRequest)}
          onClose={() => setSelectedRequest(null)}
          title={`Decidir Solicitação: ${selectedRequest.subject}`}
          description={`Membro: ${selectedRequest.memberName} · Registado em ${formatDateAO(selectedRequest.createdAt)}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            {responseError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center justify-between">
                <span>{responseError}</span>
                <button
                  type="button"
                  onClick={() => setResponseError(null)}
                  className="text-rose-500 hover:text-rose-800 font-bold ml-2 text-sm"
                >
                  ×
                </button>
              </div>
            )}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-700">
              {selectedRequest.details}
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Parecer Institucional / Nota de Resposta
              </label>
              <textarea
                rows={3}
                placeholder="Insira a justificação da decisão que será visível para o membro..."
                value={responseNotes}
                onChange={(e) => setResponseNotes(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-3 py-1.5 text-slate-600 hover:text-slate-900"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => handleRespond('rejeitado')}
                className="px-3 py-1.5 font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded shadow-xs"
              >
                Rejeitar Pedido
              </button>
              <button
                type="button"
                onClick={() => handleRespond('aprovado')}
                className="px-4 py-1.5 font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded shadow-xs"
              >
                Aprovar Pedido
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
