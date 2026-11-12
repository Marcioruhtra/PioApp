import React, { useState } from 'react';
import { useClub } from '../../context/ClubContext';
import { MessageSquare, CheckCircle, Clock, Eye } from 'lucide-react';
import { ROLE_LABELS } from '../../services/permissionService';

export const SuggestionsModule: React.FC = () => {
  const { state, respondToSuggestion, markSuggestionAsViewed, can, currentUser } = useClub();
  const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null);
  const [response, setResponse] = useState('');

  // Diretor tem acesso total, Admin técnico também por segurança
  const isAuthorized = can('suggestions', 'VIEW') || currentUser.role === 'diretor' || currentUser.role === 'admin_tecnico';
  
  if (!isAuthorized) {
    return <div className="p-8 text-center text-slate-500">Acesso negado.</div>;
  }

  const suggestions = state.suggestions || [];

  const handleRespond = (id: string) => {
    respondToSuggestion(id, response);
    setActiveSuggestion(null);
    setResponse('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-xl font-black text-slate-900">Sugestões dos Membros</h1>
        <p className="text-xs text-slate-500 mt-1">Gestão de sugestões confidenciais enviadas pelos membros.</p>
      </div>

      <div className="grid gap-4">
        {suggestions.length === 0 && <p className="text-xs text-slate-500 p-4">Nenhuma sugestão enviada.</p>}
        {suggestions.map(s => (
          <div key={s.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">{s.subject}</span>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${s.status === 'respondido' ? 'bg-emerald-50 text-emerald-800' : s.status === 'visualizado' ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800'}`}>
                {s.status}
              </span>
            </div>
            <p className="text-xs text-slate-600">{s.content}</p>
            <div className="text-[10px] text-slate-400">De: {s.isAnonymous ? 'Anónimo' : s.memberName} em {new Date(s.createdAt).toLocaleDateString()}</div>
            
            <div className="flex items-center gap-2 pt-2">
              {s.status === 'pendente' && (
                <button onClick={() => markSuggestionAsViewed(s.id)} className="text-[11px] font-semibold text-blue-900 underline">Marcar como Visualizado</button>
              )}
              {s.status !== 'respondido' && (
                <button onClick={() => setActiveSuggestion(s.id)} className="text-[11px] font-semibold text-indigo-900 underline">Responder</button>
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
                <textarea 
                  value={response} 
                  onChange={e => setResponse(e.target.value)} 
                  className="w-full p-2 border border-slate-300 rounded text-xs"
                  placeholder="Escreva a sua resposta..."
                />
                <button onClick={() => handleRespond(s.id)} className="px-3 py-1 bg-indigo-700 text-white text-xs font-semibold rounded">Enviar Resposta</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
