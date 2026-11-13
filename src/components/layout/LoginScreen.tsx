import React, { useState } from 'react';
import { AlertCircle, Loader2, CheckSquare, Square } from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { doc, getDoc, getDocFromServer } from 'firebase/firestore';
import { db, auth, setPersistence, browserLocalPersistence, browserSessionPersistence } from '../../firebase';

interface LoginScreenProps {
  onLogin: () => void;
  sessionExpiredMessage?: string | null;
  onClearSessionExpiredMessage?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  sessionExpiredMessage,
  onClearSessionExpiredMessage,
}) => {
  const { state, setCurrentUser, requestPasswordReset, syncFromCloud } = useClub();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotPwd, setShowForgotPwd] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const GENERIC_LOGIN_ERROR = 'Não foi possível iniciar sessão. Verifique as credenciais ou contacte o administrador.';

  // Pré-carregamento inicial dos dados do clube diretamente do servidor da nuvem (sem cache)
  React.useEffect(() => {
    getDocFromServer(doc(db, 'club_data', 'main_state'))
      .catch(() => getDoc(doc(db, 'club_data', 'main_state')))
      .then((snap) => {
        if (snap && snap.exists()) {
          const cloudData = snap.data();
          if (cloudData && Array.isArray(cloudData.users) && cloudData.users.length > 0) {
            syncFromCloud(cloudData);
          }
        }
      })
      .catch((err) => {
        console.warn('Pré-carregamento de utilizadores da nuvem:', err);
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    onClearSessionExpiredMessage?.();
    
    try {
      if (auth) {
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence).catch(() => {});
      }
    } catch {
      // Ignorado em ambientes restritos
    }

    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      setErrorMessage(GENERIC_LOGIN_ERROR);
      return;
    }

    // 1. Conta Institucional Técnica de Salvaguarda
    if (cleanId === '123456789001' && password === 'EBXPIONEIROSDAALVORADA') {
      setCurrentUser({
        id: 'INST-001',
        name: 'Conta Institucional',
        email: 'institucional@clubedalvorada.ao',
        role: 'admin_tecnico',
        active: true,
        createdAt: new Date().toISOString(),
      });
      onLogin();
      return;
    }

    try {
      setIsLoading(true);

      // 2. Consulta estritamente direta ao servidor da NUVEM (Cloud Firestore), forçando leitura atualizada
      let cloudData: any = null;
      let docSnap: any = null;

      try {
        // Tenta obter o documento mais recente diretamente do servidor sem cache
        docSnap = await getDocFromServer(doc(db, 'club_data', 'main_state'));
      } catch (_serverErr) {
        try {
          docSnap = await getDoc(doc(db, 'club_data', 'main_state'));
        } catch (_docErr) {
          docSnap = null;
        }
      }

      if (docSnap && docSnap.exists()) {
        cloudData = docSnap.data();
        // Unificação imediata: sincroniza o estado global da nuvem antes da validação
        if (cloudData && Array.isArray(cloudData.users)) {
          syncFromCloud(cloudData);
        }
      }

      // Utilizadores e membros para pesquisa (prioridade total para os dados lidos da nuvem)
      const usersToSearch = (cloudData && Array.isArray(cloudData.users) && cloudData.users.length > 0)
        ? cloudData.users
        : state.users;

      const membersToSearch = (cloudData && Array.isArray(cloudData.members) && cloudData.members.length > 0)
        ? cloudData.members
        : state.members;

      const cleanLower = cleanId.toLowerCase();

      // 3. Resolução do membro ESTRITAMENTE por E-mail ou Nº de Matrícula definido pelo secretário
      const matchingMember = membersToSearch.find((m: any) => {
        if (!m) return false;
        if (m.manualNumber && String(m.manualNumber).trim().toLowerCase() === cleanLower) return true;
        if (m.email && String(m.email).trim().toLowerCase() === cleanLower) return true;
        return false;
      });

      const targetMemberId = matchingMember ? matchingMember.id : null;
      const targetMemberEmail = matchingMember ? matchingMember.email : null;

      // 4. Pesquisa de conta de utilizador ESTRITAMENTE por E-mail ou ligação direta ao membro resolvido pelo Nº de Matrícula/E-mail
      const user = usersToSearch.find((u: any) => {
        if (!u) return false;
        if (u.email && u.email.toLowerCase() === cleanLower) return true;
        if (targetMemberId && u.linkedMemberId && u.linkedMemberId === targetMemberId) return true;
        if (targetMemberEmail && u.email && u.email.toLowerCase() === targetMemberEmail.toLowerCase()) return true;
        return false;
      });

      // 5. Se a conta não for encontrada na nuvem, rejeita o acesso
      if (!user) {
        setErrorMessage(GENERIC_LOGIN_ERROR);
        return;
      }

      // 6. Verificação de conta ativa na nuvem
      if (user.active === false) {
        setErrorMessage(GENERIC_LOGIN_ERROR);
        return;
      }

      // 7. Validação de palavra-passe com o registo da nuvem
      if (user.password && user.password !== password) {
        setErrorMessage(GENERIC_LOGIN_ERROR);
        return;
      }

      setCurrentUser(user, rememberMe);
      onLogin();
    } catch (err) {
      console.warn('Erro durante autenticação na nuvem:', err);
      setErrorMessage(GENERIC_LOGIN_ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  const [resetFeedback, setResetFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleRequestPasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    setResetFeedback(null);

    if (identifier.trim() === '123456789001') {
      setResetFeedback({ type: 'error', message: 'A conta institucional não requer redefinição de palavra-passe.' });
      return;
    }

    const res = requestPasswordReset(identifier.trim());
    if (res.success) {
      setResetFeedback({ type: 'success', message: 'Solicitação de redefinição de palavra-passe enviada com sucesso ao Administrador.' });
      setIdentifier('');
    } else {
      setResetFeedback({ type: 'error', message: res.error || 'Não foi possível processar o pedido. Contacte o Administrador.' });
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-900 p-4 safe-area-pt safe-area-pb">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-8 my-auto">
        <div className="flex justify-center mb-3 sm:mb-4">
          <img src="/assets/aistudio/logo.png" alt="Logo" className="w-20 h-20 sm:w-24 sm:h-24 object-contain" />
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 mb-1 text-center leading-tight">
          PioApp
        </h1>
        <p className="text-xs text-slate-500 mb-5 sm:mb-6 text-center">Sistema de Gestão Oficial</p>

        {!showForgotPwd ? (
          <form onSubmit={handleLogin} className="space-y-4">
            {sessionExpiredMessage && !errorMessage && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>{sessionExpiredMessage}</span>
              </div>
            )}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">E-mail ou Nº de Matrícula</label>
              <input
                type="text"
                placeholder="ex: e-mail ou nº de matrícula"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setErrorMessage(null);
                }}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Palavra-passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMessage(null);
                }}
                className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-900 focus:outline-none"
                required
              />
            </div>

            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
              {rememberMe ? <CheckSquare className="w-4 h-4 text-blue-900" /> : <Square className="w-4 h-4 text-slate-400" />}
              <span className="text-xs text-slate-600 font-medium">Lembrar credenciais no dispositivo</span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-md"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>A consultar credenciais na nuvem...</span>
                </>
              ) : (
                'Entrar'
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowForgotPwd(true)}
              className="w-full text-xs text-slate-500 hover:text-blue-900 transition-colors"
            >
              Esqueci-me da senha
            </button>
          </form>
        ) : (
          <form onSubmit={handleRequestPasswordReset} className="space-y-4">
            {resetFeedback && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                  resetFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{resetFeedback.message}</span>
              </div>
            )}
            <p className="text-xs text-slate-600">
              Introduza o seu E-mail ou Nº Membro para solicitar a redefinição de senha ao Administrador.
            </p>
            <input
              type="text"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setResetFeedback(null);
              }}
              className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-900 focus:outline-none"
              required
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg font-bold text-sm transition-colors shadow-md"
            >
              Solicitar Redefinição
            </button>
            <button
              type="button"
              onClick={() => setShowForgotPwd(false)}
              className="w-full text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              Voltar
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
