import React, { useState } from 'react';
import {
  AlertCircle,
  Loader2,
  CheckSquare,
  Square,
  UserPlus,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { doc, getDoc, getDocFromServer } from 'firebase/firestore';
import { db, auth, setPersistence, browserLocalPersistence, browserSessionPersistence } from '../../firebase';
import { Modal } from '../common/Modal';
import { MemberRegistrationForm } from '../members/MemberRegistrationForm';
import { MemberReconfirmationForm } from '../members/MemberReconfirmationForm';
import { EnrollmentStatusCard } from '../members/EnrollmentStatusCard';
import { Member, MemberEnrollmentRequest } from '../../types';
import { formatDateTimeAO } from '../../utils/date';
import {
  evaluateEnrollmentAvailability,
  findMemberForReconfirmation,
  lookupMemberOrEnrollmentStatus,
  reconcileApprovedEnrollmentsWithMembers,
  UnifiedEnrollmentLookupResult,
} from '../../services/enrollmentService';
import { isPendingMemberAccountConfirmation } from '../../services/accountSyncService';

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
  const {
    state,
    setCurrentUser,
    requestPasswordReset,
    syncFromCloud,
    refreshFromCloud,
    isCloudLoading,
    submitEnrollmentRequest,
    submitMemberReconfirmation,
    createSelfServiceMemberAccount,
  } = useClub();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotPwd, setShowForgotPwd] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estados de Inscrição Direta no Clube (Ecrã de Login)
  const [isEnrollmentModalOpen, setIsEnrollmentModalOpen] = useState(false);
  const [enrollmentModalTab, setEnrollmentModalTab] = useState<'form' | 'reconfirmation' | 'status'>('form');
  const [submittedRequest, setSubmittedRequest] = useState<MemberEnrollmentRequest | null>(null);
  const [statusLookupBI, setStatusLookupBI] = useState('');
  const [statusLookupBirth, setStatusLookupBirth] = useState('');
  const [lookupResult, setLookupResult] = useState<UnifiedEnrollmentLookupResult | null | 'not_found'>(null);

  // Estados de Reconfirmação de Dados dos Membros (Ecrã de Login)
  const [reconfLookupId, setReconfLookupId] = useState('');
  const [reconfLookupBirth, setReconfLookupBirth] = useState('');
  const [reconfLookupError, setReconfLookupError] = useState<string | null>(null);
  const [reconfTargetMember, setReconfTargetMember] = useState<Member | null>(null);
  const [reconfirmedMember, setReconfirmedMember] = useState<Member | null>(null);
  const [isSearchingReconf, setIsSearchingReconf] = useState(false);

  const [nowTick, setNowTick] = useState<Date>(() => new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setNowTick(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const enrollmentAvailability = React.useMemo(
    () => evaluateEnrollmentAvailability(state.settings.enrollmentConfig, nowTick),
    [state.settings.enrollmentConfig, nowTick]
  );

  React.useEffect(() => {
    if (!enrollmentAvailability.isEnrollmentsOpen && enrollmentModalTab === 'form' && !submittedRequest) {
      setEnrollmentModalTab(enrollmentAvailability.isReconfirmationOpen ? 'reconfirmation' : 'status');
    }
    if (!enrollmentAvailability.isReconfirmationOpen && enrollmentModalTab === 'reconfirmation' && !reconfirmedMember) {
      setEnrollmentModalTab('status');
    }
  }, [
    enrollmentAvailability.isEnrollmentsOpen,
    enrollmentAvailability.isReconfirmationOpen,
    enrollmentModalTab,
    submittedRequest,
    reconfirmedMember,
  ]);

  const GENERIC_LOGIN_ERROR = 'Não foi possível iniciar sessão. Verifique as credenciais ou contacte o administrador.';

  // Caso a lista de utilizadores ainda não tenha chegado após o carregamento inicial, tenta sincronizar sem duplicar pedidos simultâneos
  React.useEffect(() => {
    if (isCloudLoading || state.users.length > 0 || !db || !(db as any).app) return;
    getDoc(doc(db, 'club_data', 'main_state'))
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
  }, [isCloudLoading, state.users.length]);

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

      // Utilizadores e membros para pesquisa (prioridade total para os dados lidos da nuvem, incluindo listas vazias)
      const usersToSearch =
        cloudData && Array.isArray(cloudData.users) ? cloudData.users : state.users;

      const membersToSearch =
        cloudData && Array.isArray(cloudData.members) ? cloudData.members : state.members;

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

      // 4. Pesquisa de conta de utilizador ESTRITAMENTE por E-mail, Nº de Membro sincronizado ou ligação direta ao membro resolvido
      const user = usersToSearch.find((u: any) => {
        if (!u) return false;
        if (u.email && u.email.trim().toLowerCase() === cleanLower) return true;
        if (u.manualNumber && String(u.manualNumber).trim().toLowerCase() === cleanLower) return true;
        if (targetMemberId && u.linkedMemberId && u.linkedMemberId === targetMemberId) return true;
        if (targetMemberEmail && u.email && u.email.trim().toLowerCase() === targetMemberEmail.toLowerCase()) return true;
        return false;
      });

      // 5. Se a conta não for encontrada na nuvem, rejeita o acesso
      if (!user) {
        setErrorMessage(GENERIC_LOGIN_ERROR);
        return;
      }

      // 6. Validação de palavra-passe com o registo da nuvem
      if (user.password && user.password !== password) {
        setErrorMessage(GENERIC_LOGIN_ERROR);
        return;
      }

      const resolvedMember =
        user.linkedMemberId
          ? membersToSearch.find((m: any) => m && (m.id === user.linkedMemberId || m.manualNumber === user.linkedMemberId))
          : matchingMember;

      // 7. Verificação de conta ativa, arquivamento da ficha e confirmação do Diretor na nuvem
      if (user.active === false) {
        if (isPendingMemberAccountConfirmation(user)) {
          setErrorMessage('A sua conta de login foi criada e aguarda confirmação do Diretor para ser ativada.');
        } else if (user.deactivatedByArchive || resolvedMember?.status === 'arquivado') {
          setErrorMessage('A sua ficha de membro encontra-se arquivada e a sua conta de login foi desativada. Contacte a Direção ou Secretaria.');
        } else {
          setErrorMessage(GENERIC_LOGIN_ERROR);
        }
        return;
      }

      if (resolvedMember?.status === 'arquivado' && user.role !== 'admin_tecnico' && user.id !== 'INST-001' && user.id !== 'USR-ADMIN') {
        setErrorMessage('A sua ficha de membro encontra-se arquivada e a sua conta de login foi desativada. Contacte a Direção ou Secretaria.');
        return;
      }

      const syncedLoginUser =
        resolvedMember && user.role !== 'admin_tecnico' && user.id !== 'INST-001' && user.id !== 'USR-ADMIN'
          ? {
              ...user,
              linkedMemberId: resolvedMember.id,
              name: resolvedMember.fullName || user.name,
              email: (resolvedMember.email && resolvedMember.email.trim()) || user.email,
              phone: (resolvedMember.phone && resolvedMember.phone.trim()) || user.phone,
              manualNumber: resolvedMember.manualNumber || user.manualNumber,
            }
          : user;

      setCurrentUser(syncedLoginUser, rememberMe);
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

  const handleLookupEnrollmentStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    let requests = state.enrollmentRequests || [];
    let members = state.members || [];
    let currentYear = state.settings.currentYear || new Date().getFullYear();
    let deletions = state.deletionRequests || [];
    let auditLogs = state.auditLogs || [];

    if (db && (db as any).app) {
      try {
        const snap = await getDocFromServer(doc(db, 'club_data', 'main_state')).catch(() =>
          getDoc(doc(db, 'club_data', 'main_state'))
        );
        if (snap && snap.exists()) {
          const cloudData = snap.data();
          if (cloudData) {
            if (Array.isArray(cloudData.enrollmentRequests)) {
              requests = cloudData.enrollmentRequests;
            }
            if (Array.isArray(cloudData.members)) {
              members = cloudData.members;
            }
            if (Array.isArray(cloudData.deletionRequests)) {
              deletions = cloudData.deletionRequests;
            }
            if (Array.isArray(cloudData.auditLogs)) {
              auditLogs = cloudData.auditLogs;
            }
            if (cloudData.settings?.currentYear) {
              currentYear = cloudData.settings.currentYear;
            }
            syncFromCloud(cloudData);
          }
        }
      } catch {
        // Usa estado atual em cache em caso de falha de rede
      }
    }

    const reconciled = reconcileApprovedEnrollmentsWithMembers(members, requests, currentYear, deletions, auditLogs);
    const match = lookupMemberOrEnrollmentStatus(
      reconciled.members,
      reconciled.enrollmentRequests,
      statusLookupBI,
      statusLookupBirth
    );
    setLookupResult(match || 'not_found');
  };

  const handleLookupMemberForReconfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    setReconfLookupError(null);
    setIsSearchingReconf(true);
    let members = state.members || [];
    let requests = state.enrollmentRequests || [];
    let currentYear = state.settings.currentYear || new Date().getFullYear();
    let deletions = state.deletionRequests || [];
    let auditLogs = state.auditLogs || [];

    try {
      if (db && (db as any).app) {
        try {
          const snap = await getDocFromServer(doc(db, 'club_data', 'main_state')).catch(() =>
            getDoc(doc(db, 'club_data', 'main_state'))
          );
          if (snap && snap.exists()) {
            const cloudData = snap.data();
            if (cloudData) {
              if (Array.isArray(cloudData.members)) members = cloudData.members;
              if (Array.isArray(cloudData.enrollmentRequests)) requests = cloudData.enrollmentRequests;
              if (Array.isArray(cloudData.deletionRequests)) deletions = cloudData.deletionRequests;
              if (Array.isArray(cloudData.auditLogs)) auditLogs = cloudData.auditLogs;
              if (cloudData.settings?.currentYear) currentYear = cloudData.settings.currentYear;
              syncFromCloud(cloudData);
            }
          }
        } catch {
          // Usa estado local em cache
        }
      }

      const reconciled = reconcileApprovedEnrollmentsWithMembers(
        members,
        requests,
        currentYear,
        deletions,
        auditLogs
      );
      const res = findMemberForReconfirmation(reconciled.members, reconfLookupId, reconfLookupBirth);
      if (res.found) {
        setReconfTargetMember(res.member);
        setReconfirmedMember(null);
      } else {
        setReconfTargetMember(null);
        setReconfLookupError(res.error);
      }
    } finally {
      setIsSearchingReconf(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-900 p-4 safe-area-pt safe-area-pb">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 my-auto">
        <div className="flex justify-center mb-3 sm:mb-4">
          <img src="/assets/aistudio/logo.png" alt="Logo" className="w-20 h-20 sm:w-24 sm:h-24 object-contain" />
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-1 text-center leading-tight">
          PioApp
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 sm:mb-6 text-center">Sistema de Gestão Oficial</p>

        {!showForgotPwd ? (
          <div className="space-y-4">
            <form onSubmit={handleLogin} className="space-y-4">
              {sessionExpiredMessage && !errorMessage && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-lg text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <span>{sessionExpiredMessage}</span>
                </div>
              )}
              {errorMessage && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">E-mail ou Nº de Matrícula</label>
                <input
                  type="text"
                  placeholder="ex: e-mail ou nº de matrícula"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 dark:focus:ring-blue-400 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">Palavra-passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-900 dark:focus:ring-blue-400 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
                {rememberMe ? <CheckSquare className="w-4 h-4 text-blue-900 dark:text-blue-400" /> : <Square className="w-4 h-4 text-slate-400" />}
                <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">Lembrar credenciais no dispositivo</span>
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

            {/* Secção de Inscrição e Reconfirmação Direta no Clube (Exclusiva do Ecrã de Login) */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
              {enrollmentAvailability.isEnrollmentsOpen && (
                <button
                  type="button"
                  onClick={() => {
                    void refreshFromCloud();
                    setSubmittedRequest(null);
                    setEnrollmentModalTab('form');
                    setIsEnrollmentModalOpen(true);
                  }}
                  className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-emerald-700" />
                  <span>Fazer Inscrição no Clube</span>
                </button>
              )}
              {enrollmentAvailability.isReconfirmationOpen && (
                <button
                  type="button"
                  onClick={() => {
                    void refreshFromCloud();
                    setReconfLookupError(null);
                    setReconfTargetMember(null);
                    setReconfirmedMember(null);
                    setEnrollmentModalTab('reconfirmation');
                    setIsEnrollmentModalOpen(true);
                  }}
                  className="w-full py-2.5 px-4 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 text-blue-800" />
                  <span>Fazer Reconfirmação de Dados</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  void refreshFromCloud();
                  setSubmittedRequest(null);
                  setLookupResult(null);
                  setEnrollmentModalTab('status');
                  setIsEnrollmentModalOpen(true);
                }}
                className="w-full text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-900 dark:hover:text-blue-400 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <Search className="w-3 h-3" />
                <span>Consultar estado de inscrição</span>
              </button>
            </div>
          </div>
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
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Introduza o seu E-mail ou Nº Membro para solicitar a redefinição de senha ao Administrador.
            </p>
            <input
              type="text"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setResetFeedback(null);
              }}
              className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 dark:focus:ring-blue-400 focus:outline-none"
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
              className="w-full text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
            >
              Voltar
            </button>
          </form>
        )}
      </div>

      {/* Modal: Inscrição, Reconfirmação e Consulta de Estado (Ecrã de Login) */}
      <Modal
        isOpen={isEnrollmentModalOpen}
        onClose={() => {
          setIsEnrollmentModalOpen(false);
          setSubmittedRequest(null);
          setReconfirmedMember(null);
        }}
        title={
          enrollmentAvailability.isEnrollmentsOpen && enrollmentAvailability.isReconfirmationOpen
            ? 'Inscrição & Reconfirmação no Clube'
            : enrollmentAvailability.isReconfirmationOpen
            ? 'Reconfirmação de Dados no Clube'
            : 'Inscrição Direta no Clube'
        }
        description={
          enrollmentAvailability.isEnrollmentsOpen && enrollmentAvailability.isReconfirmationOpen
            ? 'Submeta uma nova inscrição, reconfirme/atualize os dados da sua ficha de membro ou consulte o seu estado.'
            : enrollmentAvailability.isReconfirmationOpen
            ? 'Reconfirme e atualize os dados e documentos da sua ficha de membro ou consulte o seu estado.'
            : 'Preencha a ficha oficial de inscrição para avaliação e autorização da Secretaria do Clube.'
        }
        maxWidth="3xl"
      >
        <div className="space-y-5">
          {/* Alternador entre Inscrição, Reconfirmação e Consulta de Estado */}
          <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-700 gap-4">
            {enrollmentAvailability.isEnrollmentsOpen && (
              <button
                type="button"
                onClick={() => setEnrollmentModalTab('form')}
                className={`pb-2.5 px-1 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  enrollmentModalTab === 'form'
                    ? 'border-blue-900 text-blue-900 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Formulário de Inscrição</span>
              </button>
            )}
            {enrollmentAvailability.isReconfirmationOpen && (
              <button
                type="button"
                onClick={() => setEnrollmentModalTab('reconfirmation')}
                className={`pb-2.5 px-1 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                  enrollmentModalTab === 'reconfirmation'
                    ? 'border-blue-900 text-blue-900 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reconfirmação de Dados</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setEnrollmentModalTab('status')}
              className={`pb-2.5 px-1 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                enrollmentModalTab === 'status'
                  ? 'border-blue-900 text-blue-900 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Consultar Estado da Inscrição</span>
            </button>
          </div>

          {enrollmentModalTab === 'form' && (enrollmentAvailability.isEnrollmentsOpen || submittedRequest) ? (
            submittedRequest ? (
              <div className="p-5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-black text-emerald-950 dark:text-emerald-200">
                      Solicitação de Inscrição Submetida com Sucesso!
                    </h3>
                    <p className="text-emerald-900 dark:text-emerald-300 mt-1 leading-relaxed">
                      A sua ficha foi enviada para a aba <strong>Solicitação de Inscrição</strong> e aguarda a autorização da Secretaria do Clube.
                    </p>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Protocolo da Solicitação</span>
                    <span className="font-mono font-black text-blue-900 dark:text-blue-300 text-sm">{submittedRequest.protocolNumber}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Nº de Matrícula Gerado Automaticamente</span>
                    <span className="font-mono font-black text-blue-900 dark:text-blue-300 text-sm">{submittedRequest.manualNumber}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Nome Completo</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{submittedRequest.fullName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Estado Atual</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold text-[10px]">
                      <Clock className="w-3 h-3" />
                      Pendente · Aguardando visualização da Secretaria
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Entrega de Documentos (B.I. e Fotografia)</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {submittedRequest.documentDeliveryMethod === 'anexar_digital'
                        ? `Anexados digitalmente (${[submittedRequest.biDocumentFileName, submittedRequest.photoDocumentFileName]
                            .filter(Boolean)
                            .join(' · ')})`
                        : 'Entrega presencial na Secretaria do Clube'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSubmittedRequest(null)}
                    className="px-4 py-2 text-xs font-semibold text-emerald-900 dark:text-emerald-300 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Fazer Outra Inscrição
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEnrollmentModalOpen(false);
                      setSubmittedRequest(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg transition-colors"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ) : (
              <MemberRegistrationForm
                mode="self_enrollment"
                units={state.settings.units}
                onSubmit={async (formData) => {
                  const res = await submitEnrollmentRequest(formData);
                  if (res.success && res.request) {
                    setSubmittedRequest(res.request);
                  }
                  return res;
                }}
                onCancel={() => {
                  setIsEnrollmentModalOpen(false);
                  setSubmittedRequest(null);
                }}
              />
            )
          ) : enrollmentModalTab === 'reconfirmation' && (enrollmentAvailability.isReconfirmationOpen || reconfirmedMember) ? (
            reconfirmedMember ? (
              <div className="p-5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-4 text-xs">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-black text-emerald-950 dark:text-emerald-200">
                      Reconfirmação de Dados Concluída com Sucesso!
                    </h3>
                    <p className="text-emerald-900 dark:text-emerald-300 mt-1 leading-relaxed">
                      Os seus dados cadastrais e documentos foram atualizados e confirmados na Secretaria. O seu estado permanecerá <strong>Ativo</strong> após o encerramento do período.
                    </p>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Nome Completo</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{reconfirmedMember.fullName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Nº de Matrícula</span>
                    <span className="font-mono font-black text-blue-900 dark:text-blue-300">{reconfirmedMember.manualNumber}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Estado Atual</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-[10px]">
                      Ativo · Reconfirmado
                    </span>
                  </div>
                  {reconfirmedMember.lastReconfirmedAt && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Data da Reconfirmação</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {formatDateTimeAO(reconfirmedMember.lastReconfirmedAt)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReconfirmedMember(null);
                      setReconfTargetMember(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-emerald-900 dark:text-emerald-300 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Reconfirmar Outro Membro
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEnrollmentModalOpen(false);
                      setReconfirmedMember(null);
                      setReconfTargetMember(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg transition-colors"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ) : reconfTargetMember ? (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setReconfTargetMember(null);
                      setReconfLookupError(null);
                    }}
                    className="text-[11px] font-semibold text-blue-900 dark:text-blue-300 hover:underline"
                  >
                    ← Localizar outro registo
                  </button>
                </div>
                <MemberReconfirmationForm
                  member={reconfTargetMember}
                  currentPeriodId={enrollmentAvailability.periodId}
                  onSubmit={async (formData) => {
                    const res = await submitMemberReconfirmation(reconfTargetMember.id, formData);
                    if (res.success && res.member) {
                      setReconfirmedMember(res.member);
                      setReconfTargetMember(res.member);
                    }
                    return res;
                  }}
                  onCancel={() => {
                    setReconfTargetMember(null);
                    setIsEnrollmentModalOpen(false);
                  }}
                />
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  Membros já registados ou com inscrição validada: introduza o seu{' '}
                  <strong className="text-slate-900 dark:text-white">Número do B.I. (ou Nº de Matrícula)</strong> e a sua{' '}
                  <strong className="text-slate-900 dark:text-white">Data de Nascimento</strong> para confirmar e atualizar os seus dados e documentos.
                </p>

                {reconfLookupError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{reconfLookupError}</span>
                  </div>
                )}

                <form onSubmit={handleLookupMemberForReconfirmation} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Nº do B.I. ou Matrícula</label>
                    <input
                      type="text"
                      placeholder="007849312LA041 ou EBX-..."
                      value={reconfLookupId}
                      onChange={(e) => {
                        setReconfLookupId(e.target.value);
                        setReconfLookupError(null);
                      }}
                      className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded font-mono uppercase focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Data de Nascimento</label>
                    <input
                      type="date"
                      value={reconfLookupBirth}
                      onChange={(e) => {
                        setReconfLookupBirth(e.target.value);
                        setReconfLookupError(null);
                      }}
                      className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchingReconf}
                    className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isSearchingReconf ? 'A localizar...' : 'Localizar Registo'}
                  </button>
                </form>
              </div>
            )
          ) : (
            <div className="space-y-4 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                Candidatos com inscrição submetida ou membros já registados na Secretaria: introduza o seu{' '}
                <strong className="text-slate-900 dark:text-white">Número do B.I. (ou Nº de Matrícula)</strong> e a sua{' '}
                <strong className="text-slate-900 dark:text-white">Data de Nascimento</strong> para consultar o estado da inscrição e verificar se está{' '}
                <strong className="text-emerald-700 dark:text-emerald-400">Regularizado</strong> ou com <strong className="text-amber-700 dark:text-amber-400">Falta de Documento</strong>.
              </p>

              <form onSubmit={handleLookupEnrollmentStatus} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Nº do B.I. ou Matrícula</label>
                  <input
                    type="text"
                    placeholder="007849312LA041 ou EBX-..."
                    value={statusLookupBI}
                    onChange={(e) => {
                      setStatusLookupBI(e.target.value);
                      setLookupResult(null);
                    }}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded font-mono uppercase focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Data de Nascimento</label>
                  <input
                    type="date"
                    value={statusLookupBirth}
                    onChange={(e) => {
                      setStatusLookupBirth(e.target.value);
                      setLookupResult(null);
                    }}
                    className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg transition-colors"
                >
                  Consultar Estado
                </button>
              </form>

              {lookupResult === 'not_found' && (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300">
                  Nenhum registo de membro ou solicitação de inscrição encontrado com estes dados.
                </div>
              )}

              {lookupResult && lookupResult !== 'not_found' && (
                <EnrollmentStatusCard
                  registeredMember={lookupResult.member}
                  request={lookupResult.request}
                  reconfirmationInfo={{
                    isReconfirmationOpen: enrollmentAvailability.isReconfirmationOpen,
                    periodId: enrollmentAvailability.periodId,
                    onStartReconfirmation: (m) => {
                      setReconfTargetMember(m);
                      setReconfirmedMember(null);
                      setReconfLookupError(null);
                      setEnrollmentModalTab('reconfirmation');
                    },
                  }}
                  selfServiceAccount={{
                    users: state.users,
                    onCreateAccount: createSelfServiceMemberAccount,
                  }}
                />
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

