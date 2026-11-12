import React, { useState } from 'react';
import { Send, User, MessageSquare, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { formatDateAO } from '../../utils/date';
import { Modal } from '../common/Modal';

export const MessagingModule: React.FC = () => {
  const { state, sendMessage, deleteMessage, can, currentUser } = useClub();
  
  const [recipientType, setRecipientType] = useState<'member' | 'unit' | 'category' | 'all'>('member');
  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const units = state.settings.units || [];
  const categories = [
    { id: 'embaixador', label: 'Embaixadores' },
    { id: 'lider', label: 'Liderança' },
    { id: 'aspirante', label: 'Aspirantes' },
  ];

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !content.trim()) {
      setFeedback({ type: 'error', message: 'Por favor, preencha o assunto e o conteúdo da mensagem.' });
      return;
    }

    if (recipientType !== 'all' && !recipientId) {
      setFeedback({ type: 'error', message: 'Por favor, selecione o destinatário (membro, unidade ou categoria).' });
      return;
    }

    setIsSubmitting(true);
    const finalRecipientId = recipientType === 'all' ? 'all' : recipientId;

    const res = sendMessage({
      senderId: currentUser.id,
      senderName: currentUser.name,
      recipientType,
      recipientId: finalRecipientId,
      subject: subject.trim(),
      content: content.trim(),
    });

    setIsSubmitting(false);
    if (res.success) {
      setFeedback({ type: 'success', message: 'Mensagem enviada com sucesso!' });
      setSubject('');
      setContent('');
      setRecipientId('');
    } else {
      setFeedback({ type: 'error', message: res.error || 'Erro ao enviar mensagem.' });
    }
  };

  if (!can('messaging', 'VIEW')) {
    return <div className="p-6 text-xs text-slate-600">Sem permissão para aceder ao módulo de mensagens.</div>;
  }

  const sentMessages = (state.messages || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {/* Topo */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-900 shrink-0" />
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Central de Mensagens e Comunicados
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Envie mensagens individuais ou em massa (por Unidade, Categoria ou para Todo o Clube) e acompanhe o histórico.
          </p>
        </div>
      </div>

      {feedback && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-xs ${
          feedback.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold px-2 py-0.5">✕</button>
        </div>
      )}

      {/* Formulário de Envio (Apenas se tiver permissão de criação) */}
      {can('messaging', 'CREATE') && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Send className="w-4 h-4 text-blue-900" />
            <span>Nova Mensagem / Comunicado Oficial</span>
          </h2>

          <form onSubmit={handleSendMessage} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Tipo de Destinatário</label>
                <select
                  value={recipientType}
                  onChange={(e) => {
                    setRecipientType(e.target.value as any);
                    setRecipientId('');
                  }}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white font-medium focus:ring-1 focus:ring-blue-900"
                >
                  <option value="member">Membro Específico</option>
                  <option value="unit">Unidade / Patrulha Inteira</option>
                  <option value="category">Categoria (Embaixador, Líder, Aspirante)</option>
                  <option value="all">Todo o Clube (Broadcast Geral)</option>
                </select>
              </div>

              {recipientType === 'member' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Selecionar Membro *</label>
                  <select
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-white font-medium focus:ring-1 focus:ring-blue-900"
                    required={recipientType === 'member'}
                  >
                    <option value="">-- Selecione o membro --</option>
                    {state.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} — {m.manualNumber} ({m.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {recipientType === 'unit' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Selecionar Unidade *</label>
                  <select
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-white font-medium focus:ring-1 focus:ring-blue-900"
                    required={recipientType === 'unit'}
                  >
                    <option value="">-- Selecione a unidade --</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name} ({u.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {recipientType === 'category' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Selecionar Categoria *</label>
                  <select
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg bg-white font-medium focus:ring-1 focus:ring-blue-900"
                    required={recipientType === 'category'}
                  >
                    <option value="">-- Selecione a categoria --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Assunto da Mensagem *</label>
              <input
                type="text"
                placeholder="Ex: Convocação para Reunião Especial de Sábado"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Conteúdo da Mensagem *</label>
              <textarea
                rows={4}
                placeholder="Escreva aqui a mensagem ou instrução oficial a transmitir..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-900"
                required
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'A enviar...' : 'Enviar Mensagem / Comunicado'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Histórico de Mensagens Enviadas */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-900" />
          <span>Histórico de Mensagens Enviadas ({sentMessages.length})</span>
        </h2>

        {sentMessages.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Nenhuma mensagem enviada até o momento.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {sentMessages.map((msg) => {
              let recipientDisplay = msg.recipientId;
              if (msg.recipientType === 'all') recipientDisplay = 'Todo o Clube (Broadcast)';
              else if (msg.recipientType === 'unit') recipientDisplay = `Unidade: ${msg.recipientId}`;
              else if (msg.recipientType === 'category') recipientDisplay = `Categoria: ${msg.recipientId.toUpperCase()}`;
              else if (msg.recipientType === 'member') {
                const mem = state.members.find(m => m.id === msg.recipientId);
                recipientDisplay = mem ? `Membro: ${mem.fullName}` : `Membro ID: ${msg.recipientId}`;
              }

              return (
                <div key={msg.id} className="p-4 hover:bg-slate-50 transition-colors space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 text-sm">{msg.subject}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          {recipientDisplay}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Enviado por <strong>{msg.senderName}</strong> em {formatDateAO(msg.createdAt)}
                      </div>
                    </div>

                    {can('messaging', 'ADMIN') && (
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Eliminar mensagem"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                    {msg.content}
                  </p>

                  {/* Respostas / Fio de Conversação */}
                  {msg.replies && msg.replies.length > 0 && (
                    <div className="mt-3 pl-4 border-l-2 border-blue-900 space-y-2">
                      <div className="font-bold text-[11px] text-blue-900">Respostas ({msg.replies.length}):</div>
                      {msg.replies.map(rep => (
                        <div key={rep.id} className="p-2.5 bg-blue-50/50 rounded-lg border border-blue-100 text-[11px]">
                          <div className="flex justify-between font-semibold text-slate-800">
                            <span>{rep.senderName}</span>
                            <span className="text-[10px] text-slate-400">{formatDateAO(rep.createdAt)}</span>
                          </div>
                          <p className="text-slate-700 mt-0.5">{rep.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
