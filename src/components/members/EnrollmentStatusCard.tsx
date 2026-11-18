import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileSearch,
  KeyRound,
  Lock,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { Modal } from '../common/Modal';
import { MemberRegistrationForm } from './MemberRegistrationForm';
import { Member, MemberEnrollmentRequest, UserAccount } from '../../types';
import { formatDateAO, formatDateTimeAO } from '../../utils/date';
import {
  getEnrollmentPhaseInfo,
  resolveMemberDocumentationStatus,
} from '../../services/enrollmentService';
import { ROLE_LABELS } from '../../services/permissionService';
import { canMemberCreateSelfServiceAccount } from '../../services/accountSyncService';

interface EnrollmentStatusCardProps {
  request?: MemberEnrollmentRequest;
  registeredMember?: Member;
  compact?: boolean;
  reconfirmationInfo?: {
    isReconfirmationOpen: boolean;
    periodId?: string;
    onStartReconfirmation?: (member: Member) => void;
  };
  selfServiceAccount?: {
    users: UserAccount[];
    onCreateAccount: (
      memberId: string,
      password: string,
      confirmPassword: string
    ) => Promise<{ success: boolean; account?: UserAccount; error?: string }>;
  };
}

const CATEGORY_LABELS: Record<Member['category'], string> = {
  embaixador: 'Embaixador',
  lider: 'Líder',
  aspirante: 'Aspirante',
};

export const EnrollmentStatusCard: React.FC<EnrollmentStatusCardProps> = ({
  request,
  registeredMember,
  compact = false,
  reconfirmationInfo,
  selfServiceAccount,
}) => {
  const { resubmitEnrollmentRequest } = useClub();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSubmittingAccount, setIsSubmittingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [justCreatedAccount, setJustCreatedAccount] = useState<UserAccount | null>(null);
  const [isResubmitModalOpen, setIsResubmitModalOpen] = useState(false);

  const docStatus = registeredMember ? resolveMemberDocumentationStatus(registeredMember) : null;
  const docUpdaterRole = registeredMember?.documentationUpdatedByRole
    ? ROLE_LABELS[registeredMember.documentationUpdatedByRole]?.label ||
      registeredMember.documentationUpdatedByRole
    : undefined;

  const phaseInfo = request ? getEnrollmentPhaseInfo(request.status) : null;
  const currentPhase = phaseInfo?.phaseNumber ?? 3;
  const reviewerRoleLabel = request?.reviewedByRole
    ? ROLE_LABELS[request.reviewedByRole]?.label || request.reviewedByRole
    : undefined;
  const underReviewRoleLabel = request?.underReviewStartedByRole
    ? ROLE_LABELS[request.underReviewStartedByRole]?.label || request.underReviewStartedByRole
    : undefined;

  const accountEligibility =
    selfServiceAccount && registeredMember
      ? canMemberCreateSelfServiceAccount(registeredMember, selfServiceAccount.users, request)
      : null;

  const handleSelfServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selfServiceAccount || !registeredMember) return;
    setAccountError(null);
    setIsSubmittingAccount(true);
    try {
      const res = await selfServiceAccount.onCreateAccount(
        registeredMember.id,
        password,
        confirmPassword
      );
      if (res.success && res.account) {
        setJustCreatedAccount(res.account);
        setShowCreateForm(false);
        setPassword('');
        setConfirmPassword('');
      } else {
        setAccountError(res.error || 'Não foi possível criar a sua conta de login.');
      }
    } finally {
      setIsSubmittingAccount(false);
    }
  };

  return (
    <div className="space-y-3 text-xs">
      {/* BLOCO PARA MEMBROS JÁ REGISTADOS NA SECRETARIA (Regularizado vs Falta de Documento) */}
      {registeredMember && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Membro Registado na Secretaria</span>
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">{registeredMember.fullName}</h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                Matrícula: <strong className="font-mono text-slate-900 dark:text-white">{registeredMember.manualNumber}</strong>
                {' · '}
                {CATEGORY_LABELS[registeredMember.category]}
                {' · '}
                {registeredMember.unitOrTeam?.trim() || 'Sem Equipa'}
              </p>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                docStatus === 'falta_documento'
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
              }`}
            >
              {docStatus === 'falta_documento' ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span>Em Falta de Documento</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  <span>Regularizado</span>
                </>
              )}
            </span>
          </div>

          {docStatus === 'falta_documento' ? (
            <div className="p-3.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 space-y-1.5">
              <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                <span>Situação na Secretaria: Falta de Documento</span>
              </div>
              <p>
                <strong>Documento(s) em falta:</strong>{' '}
                {registeredMember.missingDocumentsNote?.trim() ||
                  'Regularização documental pendente na Secretaria.'}
              </p>
              <p className="text-[11px] text-amber-900/90 dark:text-amber-300">
                Compareça na Secretaria do Clube para entregar o(s) documento(s) em falta e regularizar o seu cadastro.
              </p>
              {registeredMember.documentationUpdatedByName && (
                <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 pt-1 border-t border-amber-200 dark:border-amber-800">
                  Registado por: <strong>{registeredMember.documentationUpdatedByName}</strong>
                  {docUpdaterRole ? ` (${docUpdaterRole})` : ''}
                  {registeredMember.documentationUpdatedAt
                    ? ` em ${formatDateTimeAO(registeredMember.documentationUpdatedAt)}`
                    : ''}
                </p>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 space-y-1">
              <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>Situação na Secretaria: Regularizado</span>
              </div>
              <p>
                A sua inscrição e documentação encontram-se devidamente regularizadas no cadastro oficial da Secretaria.
              </p>
              {registeredMember.documentationUpdatedByName && (
                <p className="text-[11px] text-emerald-900/80 dark:text-emerald-300/80 pt-1 border-t border-emerald-200 dark:border-emerald-800">
                  Verificado por: <strong>{registeredMember.documentationUpdatedByName}</strong>
                  {docUpdaterRole ? ` (${docUpdaterRole})` : ''}
                  {registeredMember.documentationUpdatedAt
                    ? ` em ${formatDateTimeAO(registeredMember.documentationUpdatedAt)}`
                    : ''}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
            <div>
              Identificador Oficial: <strong className="font-mono text-slate-900 dark:text-white">{registeredMember.id}</strong>
            </div>
            <div>
              Data de Admissão: <strong className="text-slate-900 dark:text-white">{formatDateAO(registeredMember.joinedDate)}</strong>
            </div>
            <div>
              Estado Cadastral:{' '}
              <strong
                className={
                  registeredMember.status === 'ativo'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : registeredMember.status === 'inativo'
                    ? 'text-rose-700 dark:text-rose-400'
                    : 'text-slate-700 dark:text-slate-300'
                }
              >
                {registeredMember.status === 'ativo'
                  ? 'Ativo'
                  : registeredMember.status === 'inativo'
                  ? 'Inativo (Sem Reconfirmação)'
                  : registeredMember.status === 'arquivado'
                  ? 'Arquivado'
                  : 'Transferido'}
              </strong>
            </div>
            {registeredMember.lastReconfirmedAt && (
              <div>
                Última Reconfirmação:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {formatDateTimeAO(registeredMember.lastReconfirmedAt)}
                </strong>
              </div>
            )}
            {registeredMember.enrollmentProtocol && (
              <div className="sm:col-span-2">
                Origem: Registo automático da inscrição{' '}
                <strong className="font-mono text-blue-900 dark:text-blue-300">{registeredMember.enrollmentProtocol}</strong>
              </div>
            )}
          </div>

          {reconfirmationInfo?.isReconfirmationOpen &&
            registeredMember.status !== 'arquivado' &&
            registeredMember.status !== 'transferido' && (
              <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-blue-800 dark:text-blue-400" />
                    <span>
                      {reconfirmationInfo.periodId &&
                      registeredMember.lastReconfirmedPeriodId === reconfirmationInfo.periodId
                        ? 'Reconfirmação já concluída neste período'
                        : 'Reconfirmação de Dados Aberta'}
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-900/90 dark:text-blue-300">
                    {reconfirmationInfo.periodId &&
                    registeredMember.lastReconfirmedPeriodId === reconfirmationInfo.periodId
                      ? 'Pode atualizar novamente os seus dados e documentos enquanto o período estiver aberto.'
                      : 'Confirme e atualize os seus dados e documentos para manter o seu estado Ativo após o encerramento.'}
                  </p>
                </div>
                {reconfirmationInfo.onStartReconfirmation && (
                  <button
                    type="button"
                    onClick={() => reconfirmationInfo.onStartReconfirmation?.(registeredMember)}
                    className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>
                      {reconfirmationInfo.periodId &&
                      registeredMember.lastReconfirmedPeriodId === reconfirmationInfo.periodId
                        ? 'Atualizar Dados'
                        : 'Fazer Reconfirmação'}
                    </span>
                  </button>
                )}
              </div>
            )}
        </div>
      )}

      {/* BLOCO DE CRIAÇÃO E ESTADO DE CONTA DE LOGIN DO MEMBRO (AUTO-SERVIÇO PÓS-VALIDAÇÃO) */}
      {registeredMember && selfServiceAccount && accountEligibility && (
        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30 space-y-3">
          {justCreatedAccount || accountEligibility.pendingConfirmation ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h5 className="font-bold text-slate-900 dark:text-white text-xs">
                    {justCreatedAccount
                      ? 'Credenciais de Login Criadas com Sucesso!'
                      : 'Conta de Login Criada · Aguardando Confirmação do Diretor'}
                  </h5>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                    A sua conta foi automaticamente vinculada à sua ficha de membro (Matrícula:{' '}
                    <strong className="font-mono text-slate-900 dark:text-white">
                      {justCreatedAccount?.manualNumber ||
                        accountEligibility.existingAccount?.manualNumber ||
                        registeredMember.manualNumber}
                    </strong>{' '}
                    · E-mail:{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {justCreatedAccount?.email ||
                        accountEligibility.existingAccount?.email ||
                        registeredMember.email}
                    </strong>
                    ).
                  </p>
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-950 dark:text-amber-200 font-medium">
                    A conta encontra-se <strong>pendente de confirmação pelo Diretor</strong>. Assim que for confirmada, poderá iniciar sessão normalmente com o seu Nº de Matrícula ou E-mail e a senha definida.
                  </div>
                </div>
              </div>
            </div>
          ) : accountEligibility.alreadyLinkedActive ? (
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h5 className="font-bold text-emerald-950 dark:text-emerald-200 text-xs">
                  Conta de Login já vinculada e ativa
                </h5>
                <p className="text-[11px] text-emerald-900/90 dark:text-emerald-300">
                  Este registo já possui uma conta de acesso vinculada (
                  <strong className="font-mono">
                    {accountEligibility.existingAccount?.manualNumber || registeredMember.manualNumber}
                  </strong>{' '}
                  · <strong>{accountEligibility.existingAccount?.email}</strong>). Utilize o ecrã principal para iniciar sessão.
                </p>
              </div>
            </div>
          ) : accountEligibility.alreadyLinkedInactive ? (
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h5 className="font-bold text-slate-900 dark:text-white text-xs">
                  Conta de Login vinculada (Desativada)
                </h5>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  {accountEligibility.reason}
                </p>
              </div>
            </div>
          ) : accountEligibility.missingEmail ? (
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h5 className="font-bold text-amber-950 dark:text-amber-200 text-xs">
                  E-mail em falta para criação de conta
                </h5>
                <p className="text-[11px] text-amber-900 dark:text-amber-300">
                  {accountEligibility.reason}
                </p>
              </div>
            </div>
          ) : accountEligibility.allowed ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-start gap-2">
                  <KeyRound className="w-4 h-4 text-blue-900 dark:text-blue-300 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-blue-950 dark:text-blue-200 text-xs">
                      Acesso ao Sistema · Sem Conta de Login Vinculada
                    </h5>
                    <p className="text-[11px] text-blue-900/90 dark:text-blue-300 mt-0.5">
                      A sua inscrição já foi validada. Pode criar agora as suas credenciais definindo apenas a sua senha (requer confirmação posterior do Diretor).
                    </p>
                  </div>
                </div>

                {!showCreateForm && (
                  <button
                    type="button"
                    onClick={() => {
                      setAccountError(null);
                      setShowCreateForm(true);
                    }}
                    className="px-3.5 py-2 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg text-[11px] inline-flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Criar Conta de Login</span>
                  </button>
                )}
              </div>

              {showCreateForm && (
                <form
                  onSubmit={handleSelfServiceSubmit}
                  className="bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg p-3.5 space-y-3"
                >
                  {accountError && (
                    <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-[11px] font-semibold">
                      {accountError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                        Nº de Matrícula (Sincronizado)
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                        {registeredMember.manualNumber}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">
                        E-mail Registado (Sincronizado)
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white text-xs break-all">
                        {registeredMember.email}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Definir Senha (mín. 6 caracteres)
                      </label>
                      <div className="relative">
                        <input
                          type={showPasswords ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setAccountError(null);
                          }}
                          minLength={6}
                          required
                          placeholder="Introduza a sua senha"
                          className="w-full p-2 pr-8 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          title={showPasswords ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                          {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Confirmar Senha
                      </label>
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setAccountError(null);
                        }}
                        minLength={6}
                        required
                        placeholder="Repita a senha"
                        className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    A vinculação à sua ficha ({registeredMember.id}) é automática. Após a criação, a conta aguardará a confirmação do Diretor para ser ativada.
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setAccountError(null);
                      }}
                      className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingAccount}
                      className="px-4 py-1.5 text-[11px] font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      {isSubmittingAccount ? 'A registar credenciais...' : 'Confirmar e Criar Conta'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* BLOCO DE FASES DA SOLICITAÇÃO DE INSCRIÇÃO (se houver solicitação associada) */}
      {request && phaseInfo && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-mono font-bold text-blue-900 dark:text-blue-300">{request.protocolNumber}</span>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">{request.fullName}</h4>
            </div>

            {request.status === 'pendente' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <Clock className="w-3.5 h-3.5" />
                <span>Pendente</span>
              </span>
            )}
            {request.status === 'em_analise' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <FileSearch className="w-3.5 h-3.5" />
                <span>Em análise</span>
              </span>
            )}
            {request.status === 'aprovado' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Inscrição validada</span>
              </span>
            )}
            {request.status === 'rejeitado' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                <XCircle className="w-3.5 h-3.5" />
                <span>Inscrição Recusada</span>
              </span>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div
                className={`p-2 rounded-lg border text-[11px] transition-colors ${
                  currentPhase === 1
                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 font-bold'
                    : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 font-semibold'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span>1. Pendente</span>
                </div>
                {!compact && (
                  <p className="text-[10px] font-normal opacity-80 mt-0.5 leading-tight">
                    Aguardando visualização da Secretaria
                  </p>
                )}
              </div>

              <div
                className={`p-2 rounded-lg border text-[11px] transition-colors ${
                  currentPhase === 2
                    ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-blue-950 dark:text-blue-200 font-bold'
                    : currentPhase > 2
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                }`}
              >
                <div className="flex items-center gap-1">
                  <FileSearch className="w-3 h-3 shrink-0" />
                  <span>2. Em análise</span>
                </div>
                {!compact && (
                  <p className="text-[10px] font-normal opacity-80 mt-0.5 leading-tight">
                    Em avaliação para decisão
                  </p>
                )}
              </div>

              <div
                className={`p-2 rounded-lg border text-[11px] transition-colors ${
                  request.status === 'aprovado'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200 font-bold'
                    : request.status === 'rejeitado'
                    ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700 text-rose-950 dark:text-rose-200 font-bold'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                }`}
              >
                <div className="flex items-center gap-1">
                  {request.status === 'rejeitado' ? (
                    <XCircle className="w-3 h-3 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                  )}
                  <span>
                    3.{' '}
                    {request.status === 'rejeitado'
                      ? 'Inscrição Recusada'
                      : request.status === 'aprovado'
                      ? 'Inscrição validada'
                      : 'Decisão Final'}
                  </span>
                </div>
                {!compact && (
                  <p className="text-[10px] font-normal opacity-80 mt-0.5 leading-tight">
                    {request.status === 'rejeitado'
                      ? 'Recusada após análise'
                      : request.status === 'aprovado'
                      ? 'Registado automaticamente na Secretaria'
                      : 'Validada ou Recusada'}
                  </p>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              <strong>Estado atual:</strong> {phaseInfo.description}
            </p>
          </div>

          {request.reviewMessage && (
            <div className="p-3.5 rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 space-y-1">
              <div className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
                <span>Mensagem da Secretaria / Análise</span>
              </div>
              <p className="font-semibold text-slate-900 dark:text-white">
                "{request.reviewMessage}"
              </p>
              <p className="text-[10px] text-blue-900/80 dark:text-blue-300/80">
                Enviada pelo responsável pela análise da Secretaria.
              </p>
            </div>
          )}

          {request.status === 'rejeitado' && (
            <div className="p-3.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 space-y-3">
              <div className="space-y-1">
                <div className="font-bold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0" />
                  <span>Inscrição Recusada</span>
                </div>
                <p>
                  <strong>Motivo da recusa:</strong>{' '}
                  {request.decisionReason || 'Não especificado pela Secretaria.'}
                </p>
                <p>
                  <strong>Recusada por:</strong>{' '}
                  {request.reviewedByName || 'Secretaria do Clube'}
                  {reviewerRoleLabel ? ` (${reviewerRoleLabel})` : ''}
                  {request.reviewedAt ? ` em ${formatDateTimeAO(request.reviewedAt)}` : ''}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h5 className="font-bold text-slate-900 dark:text-white text-xs">
                    Pretende refazer a sua inscrição?
                  </h5>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    Pode reutilizar os seus dados atuais, editar o que for necessário e substituir ou manter os seus documentos anexados.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsResubmitModalOpen(true)}
                  className="px-3.5 py-2 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg text-[11px] inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refazer Inscrição</span>
                </button>
              </div>

              {isResubmitModalOpen && (
                <Modal
                  isOpen={isResubmitModalOpen}
                  onClose={() => setIsResubmitModalOpen(false)}
                  title="Refazer Inscrição · Reutilizar Dados"
                  maxWidth="2xl"
                >
                  <MemberRegistrationForm
                    mode="self_enrollment"
                    units={[]}
                    isResubmission={true}
                    initialData={{
                      fullName: request.fullName,
                      birthDate: request.birthDate,
                      gender: request.gender,
                      identityCardNumber: request.identityCardNumber,
                      phone: request.phone,
                      email: request.email,
                      address: request.address,
                      category: request.category,
                      guardianName: request.guardianName,
                      guardianPhone: request.guardianPhone,
                      emergencyName: request.emergencyContact?.name,
                      emergencyRelationship: request.emergencyContact?.relationship,
                      emergencyPhone: request.emergencyContact?.phone,
                      bloodType: request.bloodType,
                      allergiesOrMedicalNotes: request.allergiesOrMedicalNotes,
                      investitureDate: request.investitureDate,
                      professionalCourse: request.professionalCourse,
                      documentDeliveryMethod: request.documentDeliveryMethod || 'anexar_digital',
                      biDocumentFileName: request.biDocumentFileName,
                      biDocumentBase64: request.biDocumentBase64,
                      photoDocumentFileName: request.photoDocumentFileName,
                      photoDocumentBase64: request.photoDocumentBase64,
                    }}
                    onSubmit={async (data) => {
                      const res = await resubmitEnrollmentRequest(request.protocolNumber, data);
                      if (res.success) {
                        setIsResubmitModalOpen(false);
                        return { success: true };
                      }
                      return { success: false, error: res.error || 'Erro ao refazer inscrição.' };
                    }}
                    onCancel={() => setIsResubmitModalOpen(false)}
                  />
                </Modal>
              )}
            </div>
          )}

          {request.status === 'aprovado' && request.memberDeletedAt && !registeredMember && (
            <div className="p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                <XCircle className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0" />
                <span>Ficha de membro posteriormente eliminada do clube</span>
              </p>
              <p>
                Esta inscrição foi validada anteriormente, mas o registo de membro foi eliminado em{' '}
                <strong>{formatDateTimeAO(request.memberDeletedAt)}</strong>
                {request.memberDeletedByName ? ` por ${request.memberDeletedByName}` : ''}.
              </p>
            </div>
          )}

          {request.status === 'aprovado' && (!request.memberDeletedAt || Boolean(registeredMember)) && (
            <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>Inscrição validada e registada automaticamente na Secretaria</span>
              </p>
              <p>
                <strong>Validada por:</strong> {request.reviewedByName || 'Secretaria do Clube'}
                {reviewerRoleLabel ? ` (${reviewerRoleLabel})` : ''}
                {request.reviewedAt ? ` em ${formatDateTimeAO(request.reviewedAt)}` : ''}
              </p>
              {request.decisionReason && (
                <p>
                  <strong>Observação:</strong> {request.decisionReason}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
            <div>
              Nº de Matrícula: <strong className="font-mono text-slate-900 dark:text-white">{request.manualNumber}</strong>
            </div>
            <div>
              Submetida em: <strong className="text-slate-900 dark:text-white">{formatDateAO(request.submittedAt)}</strong>
            </div>
            {request.documentDeliveryMethod && (
              <div className="sm:col-span-2">
                Documentos (B.I. e Fotografia):{' '}
                <strong className="text-slate-900 dark:text-white">
                  {request.documentDeliveryMethod === 'anexar_digital'
                    ? `Anexados digitalmente (${[request.biDocumentFileName, request.photoDocumentFileName]
                        .filter(Boolean)
                        .join(' · ') || 'Ficheiro enviado'})`
                    : 'Entrega presencial na Secretaria'}
                </strong>
              </div>
            )}
            {request.underReviewStartedByName && (
              <div className="sm:col-span-2">
                Análise iniciada por: <strong className="text-slate-900 dark:text-white">{request.underReviewStartedByName}</strong>
                {underReviewRoleLabel ? ` (${underReviewRoleLabel})` : ''}
                {request.underReviewStartedAt ? ` em ${formatDateTimeAO(request.underReviewStartedAt)}` : ''}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

