import React, { useState } from 'react';
import { useClub } from '../../context/ClubContext';
import { formatDateAO } from '../../utils/date';
import { SuggestionStatus } from '../../types';

const STATUS_BADGE: Record<SuggestionStatus, { label: string; cls: string }> = {
  pendente: { label: 'Pendente', cls: 'bg-amber-50 text-amber-800' },
  visualizado: { label: 'Visualizado', cls: 'bg-blue-50 text-blue-800' },
  respondido: { label: 'Respondido', cls: 'bg-emerald-50 text-emerald-800' },
};

export const SuggestionsModule: React.FC = () => {
  const { state, respondToSuggestion, markSuggestionAsViewed, can, currentUser } = useClub();
  const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);

  // Diretor tem acesso total, Admin técnico também por segurança
  const isAuthorized = can('suggestions', 'VIEW') || currentUser.role === 'diretor' || currentUser.role === 'admin_tecnico';
  
  if (!isAuthorized) {
    return <div className="p-8 text-center text-slate-500">Acesso negado.</div>;
  }

  const suggestions = state.suggestions || [];

  const handleRespond = (id: string) => {
    setReplyError(null);
    if (!response.trim()) {
      setReplyError('Escreva uma resposta antes de enviar.');
      return;
    }
    const res = respondToSuggestion(id, response.trim());
    if (res.success) {
      setActiveSuggestion(null);
      setResponse('');
    } else {
      setReplyError(res.error || 'Erro ao enviar resposta.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-xl font-black text-slate-900">Sugestões dos Membros</h1>
        <p className="text-xs text-slate-500 mt-1">Gestão de sugestões confidenciais enviadas pelos membros.</p>
      </div>

      <div className="grid gap-4">
        {suggestions.length === 0 && <p className="text-xs text-slate-500 p-4">Nenhuma sugestão enviada.</p>}
        {suggestions.map(s => {
          const badge = STATUS_BADGE[s.status] || { label: s.status, cls: 'bg-slate-100 text-slate-700' };
          return (
            <div key={s.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{s.subject}</span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${badge.cls}`}>
                  {badge.label}
                </span>
              </div>
              <p className="text-xs text-slate-600">{s.content}</p>
              <div className="text-[10px] text-slate-400">
                De: {s.isAnonymous ? 'Anónimo' : s.memberName} em {formatDateAO(s.createdAt)}
              </div>
              
              <div className="flex items-center gap-3 pt-2">
                {s.status === 'pendente' && (
                  <button
                    onClick={() => markSuggestionAsViewed(s.id)}
                    className="text-[11px] font-semibold text-blue-900 underline cursor-pointer"
                  >
                    Marcar como Visualizado
                  </button>
                )}
                {s.status !== 'respondido' && (
                  <button
                    onClick={() => {
                      setActiveSuggestion(s.id);
                      setReplyError(null);
                    }}
                    className="text-[11px] font-semibold text-indigo-900 underline cursor-pointer"
                  >
                    Responder
                  </button>
                )}
              </div>

              {s.responseContent && (
                <div className="bg-emerald-50 p-3 rounded-lg text-xs text-emerald-900">
                  <p className="font-bold">Resposta do Diretor:</p>
                  {s.responseContent}
                </div>
              )}

              {activeSuggestion === s.id && (
                <div className="space-y-2 pt-2">
                  {replyError && (
                    <p className="text-[11px] font-semibold text-rose-700">{replyError}</p>
                  )}
                  <textarea 
                    value={response} 
                    onChange={e => setResponse(e.target.value)} 
                    className="w-full p-2 border border-slate-300 rounded text-xs"
                    placeholder="Escreva a sua resposta..."
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRespond(s.id)}
                      className="px-3 py-1 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold rounded cursor-pointer"
                    >
                      Enviar Resposta
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSuggestion(null);
                        setResponse('');
                        setReplyError(null);
                      }}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
