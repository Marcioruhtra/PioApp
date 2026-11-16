import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSearch,
  MessageSquare,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { Member, MemberEnrollmentRequest } from '../../types';
import { formatDateAO, formatDateTimeAO } from '../../utils/date';
import {
  getEnrollmentPhaseInfo,
  resolveMemberDocumentationStatus,
} from '../../services/enrollmentService';
import { ROLE_LABELS } from '../../services/permissionService';

interface EnrollmentStatusCardProps {
  request?: MemberEnrollmentRequest;
  registeredMember?: Member;
  compact?: boolean;
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
}) => {
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
            {registeredMember.enrollmentProtocol && (
              <div className="sm:col-span-2">
                Origem: Registo automático da inscrição{' '}
                <strong className="font-mono text-blue-900 dark:text-blue-300">{registeredMember.enrollmentProtocol}</strong>
              </div>
            )}
          </div>
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
            <div className="p-3.5 rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 space-y-1.5">
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
          )}

          {request.status === 'aprovado' && (
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
