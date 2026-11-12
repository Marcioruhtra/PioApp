import React, { useState } from 'react';
import {
  Heart,
  Plus,
  Send,
  MessageCircle,
  ShieldCheck,
  Lock,
  Unlock,
  CheckCircle,
  Clock,
  Sparkles,
  User,
  Filter,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { ChaplaincyCategory, ChaplaincyStatus, ChaplaincyRequest } from '../../types';
import { formatDateAO } from '../../utils/date';
import { ROLE_LABELS } from '../../services/permissionService';

const CATEGORY_LABELS: Record<ChaplaincyCategory, { label: string; bg: string; text: string }> = {
  pedido_oracao: { label: 'Pedido de Oração', bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700' },
  aconselhamento: { label: 'Aconselhamento Espiritual', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
  visita_apoio: { label: 'Visita de Apoio', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  outro: { label: 'Outro Assunto', bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700' },
};

const STATUS_BADGES: Record<ChaplaincyStatus, { label: string; bg: string; text: string }> = {
  pendente: { label: 'Pendente', bg: 'bg-amber-100 text-amber-800 border-amber-300', text: 'text-amber-800' },
  em_oracao: { label: 'Em Intercessão', bg: 'bg-indigo-100 text-indigo-800 border-indigo-300', text: 'text-indigo-800' },
  respondido: { label: 'Respondido', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', text: 'text-emerald-800' },
  arquivado: { label: 'Arquivado', bg: 'bg-slate-100 text-slate-700 border-slate-300', text: 'text-slate-700' },
};

export const ChaplaincyModule: React.FC = () => {
  const { state, currentUser, can, submitChaplaincyRequest, respondToChaplaincyRequest } = useClub();

  const [activeTab, setActiveTab] = useState<'meus' | 'novo' | 'gestao'>(
    can('chaplaincy', 'APPROVE') ? 'gestao' : 'meus'
  );

  const [category, setCategory] = useState<ChaplaincyCategory>('pedido_oracao');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [confidential, setConfidential] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{ success: boolean; msg: string } | null>(null);

  // Estado para responder a pedidos na gestão
  const [selectedRequest, setSelectedRequest] = useState<ChaplaincyRequest | null>(null);
  const [responseStatus, setResponseStatus] = useState<ChaplaincyStatus>('respondido');
  const [responseNotes, setResponseNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const memberId = currentUser.linkedMemberId || currentUser.id;
  const allRequests = state.chaplaincyRequests || [];
  
  // Pedidos do próprio membro
  const myRequests = allRequests.filter((r) => r.memberId === memberId || r.memberName === currentUser.name);

  // Pedidos para gestão (diretor/capelão)
  const filteredManagementRequests = allRequests.filter((r) => {
    // Se for confidencial e o user não for diretor ou capelão, esconde
    if (r.confidential && currentUser.role !== 'diretor' && currentUser.role !== 'capelao') return false;

    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterCategory !== 'all' && r.category !== filterCategory) return false;
    return true;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormFeedback(null);
    const res = submitChaplaincyRequest({ category, subject, message, confidential });
    if (res.success) {
      setFormFeedback({ success: true, msg: 'Pedido de capelania enviado com sucesso ao Diretor e Capelão!' });
      setSubject('');
      setMessage('');
      setConfidential(false);
      setTimeout(() => {
        setActiveTab('meus');
        setFormFeedback(null);
      }, 2000);
    } else {
      setFormFeedback({ success: false, msg: res.error || 'Falha ao submeter pedido.' });
    }
  };

  const handleRespondSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    const res = respondToChaplaincyRequest(selectedRequest.id, responseStatus, responseNotes);
    if (res.success) {
      setSelectedRequest(null);
      setResponseNotes('');
    } else {
      alert(res.error || 'Erro ao responder.');
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {/* Cabeçalho */}
      <div className="bg-slate-900 text-white rounded-xl p-6 sm:p-8 shadow-sm border border-slate-800 w-full max-w-full min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 uppercase tracking-widest">
              <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
              <span>Apoio Espiritual e Ministerial</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight mt-1">
              Capelania Digital
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Um espaço seguro de intercessão, aconselhamento e acompanhamento pastoral confidencial do Clube de Embaixadores.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {can('chaplaincy', 'CREATE') && (
              <button
                onClick={() => setActiveTab('novo')}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-lg transition-colors shadow-xs ${
                  activeTab === 'novo' ? 'bg-rose-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Enviar Pedido</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('meus')}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'meus' ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span>Meus Pedidos ({myRequests.length})</span>
            </button>
            {can('chaplaincy', 'APPROVE') && (
              <button
                onClick={() => setActiveTab('gestao')}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === 'gestao' ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Painel da Direção ({allRequests.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo das Abas */}
      {activeTab === 'novo' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 sm:p-8 max-w-3xl mx-auto w-full">
          <div className="border-b border-slate-100 pb-4 mb-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-rose-600" />
              <span>Submeter Pedido de Oração ou Aconselhamento</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              O seu pedido será enviado diretamente para a liderança e capelania do clube com total respeito pela sua privacidade.
            </p>
          </div>

          {formFeedback && (
            <div className={`p-4 rounded-xl text-xs font-medium mb-6 flex items-center gap-2 ${
              formFeedback.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {formFeedback.success ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{formFeedback.msg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Categoria do Pedido
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ChaplaincyCategory)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              >
                <option value="pedido_oracao">Pedido de Oração / Intercessão</option>
                <option value="aconselhamento">Aconselhamento Espiritual / Pastoral</option>
                <option value="visita_apoio">Visita de Apoio Domiciliário ou Hospitalar</option>
                <option value="outro">Outro Assunto Ministerial</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Assunto
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ex: Oração pela saúde da família / Dúvida espiritual"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Mensagem / Detalhes
              </label>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Descreva o seu pedido com tranquilidade..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium leading-relaxed"
              ></textarea>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-4 rounded-xl">
              <input
                type="checkbox"
                id="confidential"
                checked={confidential}
                onChange={(e) => setConfidential(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <label htmlFor="confidential" className="text-xs text-slate-700 cursor-pointer select-none">
                <span className="font-bold block text-slate-900">Marcar como Confidencial</span>
                <span>Apenas o Diretor Geral e o Capelão Principal terão acesso a este pedido.</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab('meus')}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors shadow-xs"
              >
                <Send className="w-4 h-4" />
                <span>Enviar Pedido de Capelania</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'meus' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Os Seus Pedidos Submetidos</h2>
            <span className="text-xs text-slate-500">{myRequests.length} registo(s)</span>
          </div>

          {myRequests.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
              <Heart className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">Ainda não enviou nenhum pedido de capelania.</p>
              <p className="text-xs text-slate-400 mt-1">Clique em "Enviar Pedido" para partilhar o seu pedido de oração ou aconselhamento.</p>
              <button
                onClick={() => setActiveTab('novo')}
                className="mt-4 px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-500 transition-colors"
              >
                Enviar Novo Pedido
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {myRequests.map((req) => {
                const catInfo = CATEGORY_LABELS[req.category] || CATEGORY_LABELS.outro;
                const statusInfo = STATUS_BADGES[req.status] || STATUS_BADGES.pendente;
                return (
                  <div key={req.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border ${catInfo.bg} ${catInfo.text}`}>
                          {catInfo.label}
                        </span>
                        {req.confidential && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded-md">
                            <Lock className="w-3 h-3" /> Confidencial
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${statusInfo.bg}`}>
                          {statusInfo.label}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDateAO(req.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{req.subject}</h3>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                        {req.message}
                      </p>
                    </div>

                    {req.responseNotes && (
                      <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-lg space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                          <span>Resposta da Liderança / Capelania</span>
                          <span className="text-[10px] text-emerald-700 font-mono">
                            {req.respondedAt ? formatDateAO(req.respondedAt) : ''}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-800 leading-relaxed">{req.responseNotes}</p>
                        {req.respondedBy && (
                          <div className="text-[10px] text-emerald-700 font-medium pt-1">
                            Atendido por: {req.respondedBy}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'gestao' && can('chaplaincy', 'APPROVE') && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Filtros</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-medium"
              >
                <option value="all">Todos os Estados</option>
                <option value="pendente">Pendente</option>
                <option value="em_oracao">Em Intercessão</option>
                <option value="respondido">Respondido</option>
                <option value="arquivado">Arquivado</option>
              </select>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-medium"
              >
                <option value="all">Todas as Categorias</option>
                <option value="pedido_oracao">Pedido de Oração</option>
                <option value="aconselhamento">Aconselhamento</option>
                <option value="visita_apoio">Visita de Apoio</option>
                <option value="outro">Outro Assunto</option>
              </select>
            </div>
          </div>

          {filteredManagementRequests.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
              <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">Nenhum pedido de capelania encontrado com os filtros selecionados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredManagementRequests.map((req) => {
                const catInfo = CATEGORY_LABELS[req.category] || CATEGORY_LABELS.outro;
                const statusInfo = STATUS_BADGES[req.status] || STATUS_BADGES.pendente;
                return (
                  <div key={req.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-500">{req.id}</span>
                        <span className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border ${catInfo.bg} ${catInfo.text}`}>
                          {catInfo.label}
                        </span>
                        {req.confidential && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded-md">
                            <Lock className="w-3 h-3" /> Confidencial
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${statusInfo.bg}`}>
                          {statusInfo.label}
                        </span>
                        <button
                          onClick={() => {
                            setSelectedRequest(req);
                            setResponseStatus(req.status === 'pendente' ? 'em_oracao' : req.status);
                            setResponseNotes(req.responseNotes || '');
                          }}
                          className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-xs"
                        >
                          Atender / Responder
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                      <User className="w-3.5 h-3.5 text-blue-900" />
                      <span>{req.memberName}</span>
                      <span className="text-slate-400 font-normal">· {formatDateAO(req.createdAt)}</span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{req.subject}</h3>
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                        {req.message}
                      </p>
                    </div>

                    {req.responseNotes && (
                      <div className="bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-lg space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                          <span>Resposta Registada</span>
                          <span className="text-[10px] text-emerald-700 font-mono">
                            {req.respondedAt ? formatDateAO(req.respondedAt) : ''}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-800 leading-relaxed">{req.responseNotes}</p>
                        {req.respondedBy && (
                          <div className="text-[10px] text-emerald-700 font-medium pt-1">
                            Por: {req.respondedBy}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Resposta da Direção / Capelão */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <Heart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Atender Pedido de Capelania</h3>
                  <p className="text-[11px] text-slate-400">{selectedRequest.id} · {selectedRequest.memberName}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRespondSubmit} className="p-6 space-y-4">
              <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assunto</span>
                <div className="text-xs font-bold text-slate-200">{selectedRequest.subject}</div>
                <p className="text-xs text-slate-300 pt-1 leading-relaxed">{selectedRequest.message}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Atualizar Estado
                </label>
                <select
                  value={responseStatus}
                  onChange={(e) => setResponseStatus(e.target.value as ChaplaincyStatus)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                >
                  <option value="pendente">Pendente</option>
                  <option value="em_oracao">Em Intercessão</option>
                  <option value="respondido">Respondido / Concluído</option>
                  <option value="arquivado">Arquivado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Notas de Resposta / Acompanhamento Pastoral
                </label>
                <textarea
                  required
                  rows={4}
                  value={responseNotes}
                  onChange={(e) => setResponseNotes(e.target.value)}
                  placeholder="Escreva a resposta ou nota de intercessão..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium leading-relaxed"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>Registar Resposta</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
