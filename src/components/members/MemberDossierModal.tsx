import React, { useMemo, useState } from 'react';
import {
  User,
  Heart,
  GraduationCap,
  Calendar,
  Wallet,
  Clock,
  Lock,
  CreditCard,
  Edit2,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  UserCheck,
  FileText,
  Printer,
  Briefcase,
  Award,
  Eye,
  Download,
  Upload,
  Paperclip,
  Trash2,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { Member, MemberAttachedDocument, MemberCategory, OfficialDocument } from '../../types';
import { useClub } from '../../context/ClubContext';
import { Modal } from '../common/Modal';
import { DocumentViewerModal, ViewingDocumentPayload } from '../common/DocumentViewerModal';
import {
  evaluateIdentityCardValidity,
  formatDateAO,
  formatDateTimeAO,
  getNowISOString,
  getTodayISODate,
} from '../../utils/date';
import { formatKz } from '../../utils/currency';
import { downloadDocumentFile, processProofFile } from '../../utils/fileUpload';
import { buildMemberDossierData } from '../../utils/memberDossier';
import { getMemberTeamLabel, isDirectionMember } from '../../services/accountSyncService';
import {
  hasApproveMemberAccountPermission,
  hasDeleteMemberUploadsPermission,
} from '../../services/permissionService';
import { getActivityTypeLabel } from '../../utils/activityUtils';

interface MemberDossierModalProps {
  member: Member | null;
  canEdit: boolean;
  canEditCategory: boolean;
  onClose: () => void;
  onOpenCard: (member: Member) => void;
  onOpenEdit: (member: Member) => void;
  onPrintDocument: (doc: OfficialDocument) => void;
  onFeedback: (type: 'success' | 'error', message: string) => void;
}

type DossierTab = 'dados_saude' | 'formacao' | 'assiduidade' | 'quotas_historico';

const CATEGORY_DISPLAY: Record<MemberCategory, string> = {
  embaixador: 'Embaixador',
  lider: 'Líder',
  aspirante: 'Aspirante',
};

export const MemberDossierModal: React.FC<MemberDossierModalProps> = ({
  member,
  canEdit,
  canEditCategory,
  onClose,
  onOpenCard,
  onOpenEdit,
  onPrintDocument,
  onFeedback,
}) => {
  const {
    state,
    can,
    currentUser,
    approvePendingMemberAccount,
    updateMemberCategory,
    assignMemberToUnit,
    unarchiveMember,
    updateMember,
  } = useClub();

  const [activeTab, setActiveTab] = useState<DossierTab>('dados_saude');
  const [viewingDoc, setViewingDoc] = useState<ViewingDocumentPayload | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState<'bi' | 'photo' | 'extra' | null>(null);
  const [extraDocTitle, setExtraDocTitle] = useState('');

  const dossier = useMemo(() => {
    if (!member) return null;
    return buildMemberDossierData(member, state, getTodayISODate());
  }, [member, state]);

  if (!member || !dossier) return null;

  const isOwnMemberProfile =
    currentUser.linkedMemberId === member.id ||
    currentUser.linkedMemberId === member.manualNumber ||
    (currentUser.email &&
      member.email &&
      currentUser.email.trim().toLowerCase() === member.email.trim().toLowerCase());

  const canViewDossier360 = can('members', 'VIEW_DOSSIER_360');
  const effectiveTab: DossierTab = canViewDossier360 ? activeTab : 'dados_saude';

  const canViewSensitiveMemberData = can('members', 'VIEW') || isOwnMemberProfile;
  const canManageMemberDocuments = canEdit || can('members', 'CREATE');
  const canDeleteMemberUploads = hasDeleteMemberUploadsPermission(
    currentUser.role,
    state.settings.permissionsMatrix
  );
  const canViewTrainingData = can('training', 'VIEW') || isOwnMemberProfile;
  const canViewFinancialData = can('treasury', 'VIEW') || isOwnMemberProfile;
  const canViewDocumentsData = can('documents', 'VIEW') || isOwnMemberProfile;

  const handleAttachSlotDocument = async (
    slot: 'bi' | 'photo',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingDoc(slot);
    try {
      const processed = await processProofFile(file);
      const updates: Partial<Member> =
        slot === 'bi'
          ? {
              biDocumentFileName: processed.fileName,
              biDocumentBase64: processed.base64,
            }
          : {
              photoDocumentFileName: processed.fileName,
              photoDocumentBase64: processed.base64,
              ...(processed.base64.startsWith('data:image/') && !member.photoUrl
                ? { photoUrl: processed.base64 }
                : {}),
            };
      const res = updateMember(member.id, updates);
      if (res.success) {
        onFeedback(
          'success',
          slot === 'bi'
            ? `Documento de B.I. "${processed.fileName}" anexado à ficha de ${member.fullName}.`
            : `Fotografia "${processed.fileName}" anexada à ficha de ${member.fullName}.`
        );
      } else {
        onFeedback('error', res.error || 'Erro ao guardar documento na ficha.');
      }
    } catch (err: any) {
      onFeedback('error', err?.message || 'Erro ao processar o ficheiro selecionado.');
    } finally {
      setIsUploadingDoc(null);
      e.target.value = '';
    }
  };

  const handleAttachExtraDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingDoc('extra');
    try {
      const processed = await processProofFile(file);
      const docTitle =
        extraDocTitle.trim() ||
        processed.fileName.replace(/\.[^/.]+$/, '') ||
        'Documento Anexado';
      const newDoc: MemberAttachedDocument = {
        id: `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        title: docTitle,
        fileName: processed.fileName,
        base64: processed.base64,
        uploadedAt: getNowISOString(),
        uploadedByName: currentUser.name,
      };
      const nextDocs = [...(member.attachedDocuments || []), newDoc];
      const res = updateMember(member.id, { attachedDocuments: nextDocs });
      if (res.success) {
        setExtraDocTitle('');
        onFeedback('success', `Documento "${docTitle}" anexado com sucesso à ficha do membro.`);
      } else {
        onFeedback('error', res.error || 'Erro ao anexar documento na ficha.');
      }
    } catch (err: any) {
      onFeedback('error', err?.message || 'Erro ao processar o ficheiro selecionado.');
    } finally {
      setIsUploadingDoc(null);
      e.target.value = '';
    }
  };

  const handleRemoveMemberDocument = (target: 'bi' | 'photo' | string) => {
    if (!canDeleteMemberUploads) {
      onFeedback(
        'error',
        'Apenas o Diretor ou Secretário com permissão atribuída pelo Administrador na grelha de permissões pode apagar uploads das fichas dos membros.'
      );
      return;
    }
    if (target === 'bi') {
      const res = updateMember(member.id, {
        biDocumentFileName: undefined,
        biDocumentBase64: undefined,
      });
      if (res.success) onFeedback('success', 'Anexo do B.I. removido da ficha.');
      else onFeedback('error', res.error || 'Erro ao remover anexo.');
      return;
    }
    if (target === 'photo') {
      const shouldClearPhotoUrl =
        member.photoUrl && member.photoDocumentBase64 && member.photoUrl === member.photoDocumentBase64;
      const res = updateMember(member.id, {
        photoDocumentFileName: undefined,
        photoDocumentBase64: undefined,
        ...(shouldClearPhotoUrl ? { photoUrl: undefined } : {}),
      });
      if (res.success) onFeedback('success', 'Anexo de fotografia removido da ficha.');
      else onFeedback('error', res.error || 'Erro ao remover anexo.');
      return;
    }
    const nextDocs = (member.attachedDocuments || []).filter((d) => d.id !== target);
    const res = updateMember(member.id, { attachedDocuments: nextDocs });
    if (res.success) onFeedback('success', 'Documento removido da ficha do membro.');
    else onFeedback('error', res.error || 'Erro ao remover documento.');
  };

  const quotaStatusLabel =
    dossier.quotas.summary.status === 'regularizado'
      ? 'Regularizado'
      : dossier.quotas.summary.status === 'parcial'
      ? 'Parcial'
      : 'Em Dívida';

  const quotaStatusColor =
    dossier.quotas.summary.status === 'regularizado'
      ? 'text-emerald-700 dark:text-emerald-400'
      : dossier.quotas.summary.status === 'parcial'
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-rose-700 dark:text-rose-400';

  return (
    <>
    <Modal
      isOpen={Boolean(member)}
      onClose={onClose}
      title={canViewDossier360 ? `Dossiê 360º · ${member.fullName}` : `Ficha Cadastral · ${member.fullName}`}
      description={`Matrícula: ${member.manualNumber} · Identificador: ${member.id}`}
      maxWidth="4xl"
    >
      <div className="space-y-5 text-xs text-slate-800 dark:text-slate-200">
        {/* Cabeçalho Resumo do Membro */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-300 dark:border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
              {member.photoUrl ? (
                <img
                  src={member.photoUrl}
                  alt={member.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-6 h-6 text-slate-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                {member.fullName}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                <span className="font-semibold text-blue-900 dark:text-blue-300">
                  {CATEGORY_DISPLAY[member.category]}
                </span>
                <span aria-hidden="true">·</span>
                <span>{getMemberTeamLabel(member, state.users)}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {dossier.ageYears !== null
                    ? `${dossier.ageYears} anos (${dossier.isMinor ? 'Menor de Idade' : 'Maior de Idade'})`
                    : 'Idade não definida'}
                </span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    member.status === 'ativo'
                      ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                      : 'text-slate-500 font-semibold'
                  }
                >
                  {member.status === 'ativo' ? 'Ativo' : member.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEdit(member);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Editar Ficha</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenCard(member)}
              className="px-3.5 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg font-semibold text-xs inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Cartão & Foto</span>
            </button>
          </div>
        </div>

        {canViewDossier360 && (
          <>
            {/* Faixa de Métricas 360º */}
            <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-200 dark:border-slate-800 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
              <div className="p-3.5">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Renovação</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                  Ano {member.annualRenewalYear}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {member.annualRenewalYear >= state.settings.currentYear
                    ? 'Matrícula atualizada'
                    : 'Renovação pendente'}
                </div>
              </div>

              <div className="p-3.5">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Formação</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                  {canViewTrainingData
                    ? `${dossier.training.completedCount}/${dossier.training.items.length} concluídas`
                    : 'Restrito'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  {canViewTrainingData
                    ? `Média: ${dossier.training.averageProgressPercent}%`
                    : 'Sem acesso à Formação'}
                </div>
              </div>

              <div className="p-3.5">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Assiduidade</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                  {dossier.attendance.totalRecorded > 0
                    ? `${dossier.attendance.attendanceRatePercent}%`
                    : 'Sem registos'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                  {dossier.attendance.presentCount} presenças de {dossier.attendance.totalRecorded}
                </div>
              </div>

              <div className="p-3.5">
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Situação de Quotas</div>
                <div className={`text-sm font-bold mt-0.5 tabular-nums ${canViewFinancialData ? quotaStatusColor : 'text-slate-500'}`}>
                  {canViewFinancialData
                    ? dossier.quotas.summary.balanceDueInCents === 0
                      ? 'Em dia (0,00 Kz)'
                      : formatKz(dossier.quotas.summary.balanceDueInCents)
                    : 'Restrito'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {canViewFinancialData ? quotaStatusLabel : 'Acesso da Tesouraria'}
                </div>
              </div>
            </div>

            {/* Navegação de Separadores do Dossiê */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg overflow-x-auto whitespace-nowrap">
              {(
                [
                  { id: 'dados_saude', label: 'Dados & Saúde', icon: Heart },
                  { id: 'formacao', label: `Formação (${canViewTrainingData ? dossier.training.items.length : 'Restrito'})`, icon: GraduationCap },
                  { id: 'assiduidade', label: `Assiduidade (${dossier.attendance.totalRecorded})`, icon: Calendar },
                  { id: 'quotas_historico', label: 'Quotas & Histórico', icon: Clock },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const isActive = effectiveTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-white dark:bg-slate-900 text-blue-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* SEPARADOR 1: DADOS & SAÚDE */}
        {effectiveTab === 'dados_saude' && (() => {
          const biValidity = evaluateIdentityCardValidity(member.identityCardExpiryDate);
          return (
          <div className="space-y-5">
            {biValidity.isExpired && (
              <div className="p-3 rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-800 text-rose-900 dark:text-rose-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Bilhete de Identidade (B.I.) Expirado:</span>{' '}
                  O B.I. deste membro expirou em <strong>{formatDateAO(member.identityCardExpiryDate)}</strong>. Recomenda-se solicitar o documento renovado e atualizar a data de validade.
                </div>
              </div>
            )}

            {dossier.missingGuardianInfo && (
              <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Atenção — Menor sem Encarregado completo:</span>{' '}
                  Este membro tem {dossier.ageYears} anos e ainda não possui nome ou telefone do Encarregado de Educação preenchido na ficha.
                </div>
              </div>
            )}

            {/* Identificação & Contactos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 py-1">
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Data de Nascimento</span>
                <p className="font-semibold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                  {formatDateAO(member.birthDate)}
                  {dossier.ageYears !== null && ` (${dossier.ageYears} anos)`}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">B.I. (Angola)</span>
                <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                  {member.identityCardNumber}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Validade do B.I.</span>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`font-semibold tabular-nums ${
                      biValidity.isExpired
                        ? 'text-rose-700 dark:text-rose-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {member.identityCardExpiryDate ? formatDateAO(member.identityCardExpiryDate) : 'Não informada'}
                  </span>
                  {biValidity.isExpired && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-700">
                      B.I. Expirado
                    </span>
                  )}
                  {biValidity.isExpiringSoon && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700">
                      {biValidity.label}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Género</span>
                <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                  {member.gender === 'F' ? 'Feminino' : 'Masculino'}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Telefone</span>
                <p className="font-semibold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                  {member.phone}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">E-mail</span>
                <p className="font-semibold text-slate-900 dark:text-white mt-0.5 truncate">
                  {member.email || 'Não registado'}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Residência</span>
                <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                  {member.address || 'Não especificada'}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Data de Admissão</span>
                <p className="font-semibold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                  {formatDateAO(member.joinedDate)}
                </p>
              </div>
              {(member.category === 'embaixador' || member.category === 'lider') && (
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Data de Investidura</span>
                  <p className="font-bold text-amber-700 dark:text-amber-400 mt-0.5 tabular-nums">
                    {member.investitureDate ? formatDateAO(member.investitureDate) : 'Sem data registada'}
                  </p>
                </div>
              )}
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                  <Briefcase className="w-3 h-3" />
                  <span>Curso Profissional / Área</span>
                </span>
                <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                  {member.professionalCourse?.trim() || 'Não informado'}
                </p>
              </div>
            </div>

            {/* Encarregado, Emergência & Saúde */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold">
                <Lock className="w-3.5 h-3.5 text-blue-900 dark:text-blue-400" />
                <span>Saúde, Emergência e Encarregado de Educação</span>
              </div>

              {canViewSensitiveMemberData ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Encarregado de Educação</span>
                    <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                      {member.guardianName || 'Não especificado'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Telefone do Encarregado</span>
                    <p className="font-semibold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {member.guardianPhone || 'Não especificado'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Contacto de Emergência</span>
                    <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                      {member.emergencyContact?.name || 'Não especificado'}
                      {member.emergencyContact?.relationship && ` (${member.emergencyContact.relationship})`}
                      {member.emergencyContact?.phone && ` · ${member.emergencyContact.phone}`}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Grupo Sanguíneo</span>
                    <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                      {member.bloodType || 'Não testado'}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Alergias e Observações Médicas</span>
                    <p
                      className={`mt-0.5 font-semibold ${
                        member.allergiesOrMedicalNotes?.trim()
                          ? 'text-rose-700 dark:text-rose-400'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {member.allergiesOrMedicalNotes?.trim() || 'Nenhuma restrição ou alergia registada'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 italic">
                  O acesso aos dados de encarregados e saúde está reservado à Secretaria e Direção.
                </p>
              )}
            </div>

            {/* Documentos Anexados na Ficha do Membro */}
            {canViewSensitiveMemberData && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold">
                    <Paperclip className="w-3.5 h-3.5 text-blue-900 dark:text-blue-400" />
                    <span>Documentos Anexados na Ficha (B.I., Fotografia e Comprovativos)</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                      member.documentationStatus === 'falta_documento'
                        ? 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                        : 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    }`}
                  >
                    {member.documentationStatus === 'falta_documento' ? 'Falta de Documento' : 'Regularizado'}
                  </span>
                </div>

                {member.documentationStatus === 'falta_documento' && member.missingDocumentsNote && (
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[11px]">
                    <strong>Observação documental:</strong> {member.missingDocumentsNote}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Slot 1: B.I. */}
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                        Bilhete de Identidade (B.I.)
                      </span>
                      {member.biDocumentBase64 ? (
                        <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          Anexado
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Não anexado</span>
                      )}
                    </div>

                    {member.biDocumentBase64 ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-900 dark:text-slate-100 truncate">
                          <FileText className="w-3.5 h-3.5 text-blue-800 dark:text-blue-400 shrink-0" />
                          <span className="truncate">{member.biDocumentFileName || 'Documento B.I.'}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setViewingDoc({
                                title: `Documento B.I. · ${member.fullName}`,
                                fileName: member.biDocumentFileName || `BI-${member.manualNumber}`,
                                base64: member.biDocumentBase64 || '',
                                subtitle: `Matrícula ${member.manualNumber}`,
                              })
                            }
                            className="px-2.5 py-1 text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Visualizar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadDocumentFile(
                                member.biDocumentBase64 || '',
                                member.biDocumentFileName || `BI-${member.manualNumber}`
                              )
                            }
                            className="px-2.5 py-1 text-[11px] font-bold bg-blue-900 hover:bg-blue-800 text-white rounded inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>Baixar</span>
                          </button>
                          {canDeleteMemberUploads && (
                            <>
                              <label className="px-2 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded cursor-pointer inline-flex items-center gap-1">
                                <Upload className="w-3 h-3" />
                                <span>Substituir</span>
                                <input
                                  type="file"
                                  accept=".pdf,image/*,.doc,.docx,.odt,.rtf,.txt"
                                  onChange={(e) => handleAttachSlotDocument('bi', e)}
                                  className="hidden"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => handleRemoveMemberDocument('bi')}
                                className="p-1 text-rose-600 hover:text-rose-800 dark:text-rose-400 rounded"
                                title="Remover B.I. anexado"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ) : canManageMemberDocuments ? (
                      <label className="flex items-center justify-center gap-1.5 p-2.5 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg hover:bg-white dark:hover:bg-slate-800 cursor-pointer text-[11px] font-semibold text-blue-900 dark:text-blue-300">
                        {isUploadingDoc === 'bi' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>{isUploadingDoc === 'bi' ? 'A anexar...' : 'Anexar B.I. (PDF, Imagem, DOC)'}</span>
                        <input
                          type="file"
                          accept=".pdf,image/*,.doc,.docx,.odt,.rtf,.txt"
                          onChange={(e) => handleAttachSlotDocument('bi', e)}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">Nenhum documento B.I. anexado.</p>
                    )}
                  </div>

                  {/* Slot 2: Fotografia */}
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                        Fotografia do Membro
                      </span>
                      {member.photoDocumentBase64 || member.photoUrl ? (
                        <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                          Anexada
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Não anexada</span>
                      )}
                    </div>

                    {member.photoDocumentBase64 || member.photoUrl ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-900 dark:text-slate-100 truncate">
                          {(member.photoDocumentBase64 || member.photoUrl || '').startsWith('data:image/') ? (
                            <img
                              src={member.photoDocumentBase64 || member.photoUrl}
                              alt={member.fullName}
                              className="w-7 h-7 rounded object-cover border border-slate-300 dark:border-slate-700 shrink-0"
                            />
                          ) : (
                            <ImageIcon className="w-3.5 h-3.5 text-blue-800 dark:text-blue-400 shrink-0" />
                          )}
                          <span className="truncate">
                            {member.photoDocumentFileName || `Fotografia-${member.manualNumber}.jpg`}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setViewingDoc({
                                title: `Fotografia · ${member.fullName}`,
                                fileName: member.photoDocumentFileName || `Foto-${member.manualNumber}.jpg`,
                                base64: member.photoDocumentBase64 || member.photoUrl || '',
                                subtitle: `Matrícula ${member.manualNumber}`,
                              })
                            }
                            className="px-2.5 py-1 text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Visualizar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadDocumentFile(
                                member.photoDocumentBase64 || member.photoUrl || '',
                                member.photoDocumentFileName || `Foto-${member.manualNumber}.jpg`
                              )
                            }
                            className="px-2.5 py-1 text-[11px] font-bold bg-blue-900 hover:bg-blue-800 text-white rounded inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>Baixar</span>
                          </button>
                          {canDeleteMemberUploads && (
                            <>
                              <label className="px-2 py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded cursor-pointer inline-flex items-center gap-1">
                                <Upload className="w-3 h-3" />
                                <span>Substituir</span>
                                <input
                                  type="file"
                                  accept="image/*,.pdf,.doc,.docx,.odt,.rtf,.txt"
                                  onChange={(e) => handleAttachSlotDocument('photo', e)}
                                  className="hidden"
                                />
                              </label>
                              {member.photoDocumentBase64 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMemberDocument('photo')}
                                  className="p-1 text-rose-600 hover:text-rose-800 dark:text-rose-400 rounded"
                                  title="Remover anexo de fotografia"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ) : canManageMemberDocuments ? (
                      <label className="flex items-center justify-center gap-1.5 p-2.5 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg hover:bg-white dark:hover:bg-slate-800 cursor-pointer text-[11px] font-semibold text-blue-900 dark:text-blue-300">
                        {isUploadingDoc === 'photo' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ImageIcon className="w-3.5 h-3.5" />
                        )}
                        <span>{isUploadingDoc === 'photo' ? 'A anexar...' : 'Anexar Fotografia (Imagem / PDF)'}</span>
                        <input
                          type="file"
                          accept="image/*,.pdf,.doc,.docx,.odt,.rtf,.txt"
                          onChange={(e) => handleAttachSlotDocument('photo', e)}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">Nenhuma fotografia anexada.</p>
                    )}
                  </div>
                </div>

                {/* Lista de Outros Documentos Anexados na Ficha */}
                {(member.attachedDocuments || []).length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block">
                      Outros Documentos Anexados ({member.attachedDocuments!.length})
                    </span>
                    <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                      {member.attachedDocuments!.map((docItem) => (
                        <div
                          key={docItem.id}
                          className="p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate">{docItem.title}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {docItem.fileName} · Anexado em {formatDateAO(docItem.uploadedAt)}
                              {docItem.uploadedByName ? ` por ${docItem.uploadedByName}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setViewingDoc({
                                  title: `${docItem.title} · ${member.fullName}`,
                                  fileName: docItem.fileName,
                                  base64: docItem.base64,
                                  subtitle: `Matrícula ${member.manualNumber}`,
                                })
                              }
                              className="px-2.5 py-1 text-[11px] font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Visualizar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadDocumentFile(docItem.base64, docItem.fileName)}
                              className="px-2.5 py-1 text-[11px] font-bold bg-blue-900 hover:bg-blue-800 text-white rounded inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>Baixar</span>
                            </button>
                            {canDeleteMemberUploads && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMemberDocument(docItem.id)}
                                className="p-1 text-rose-600 hover:text-rose-800 dark:text-rose-400 rounded"
                                title="Remover documento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Adicionar Outro Documento Diretamente na Ficha */}
                {canManageMemberDocuments && (
                  <div className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/40 space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Anexar documento adicional:
                      </span>
                      {['Autorização do Encarregado', 'Comprovativo de Residência', 'Declaração / Certificado'].map(
                        (preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setExtraDocTitle(preset)}
                            className="px-2 py-0.5 text-[10px] font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:border-blue-400 text-slate-700 dark:text-slate-300 cursor-pointer"
                          >
                            + {preset}
                          </button>
                        )
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Título do documento (ex: Declaração Escolar)"
                        value={extraDocTitle}
                        onChange={(e) => setExtraDocTitle(e.target.value)}
                        className="flex-1 p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                      />
                      <label className="px-3.5 py-2 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0">
                        {isUploadingDoc === 'extra' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {isUploadingDoc === 'extra' ? 'A anexar...' : 'Anexar Documento'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,image/*,.doc,.docx,.odt,.rtf,.txt"
                          onChange={handleAttachExtraDocument}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}
                {!canDeleteMemberUploads &&
                  canManageMemberDocuments &&
                  Boolean(
                    member.biDocumentBase64 ||
                      member.photoDocumentBase64 ||
                      member.photoUrl ||
                      (member.attachedDocuments || []).length > 0
                  ) && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Lock className="w-3 h-3 shrink-0" />
                      <span>
                        A exclusão de uploads anexados na ficha está reservada apenas ao Diretor e Secretário com permissão na grelha do Administrador.
                      </span>
                    </p>
                  )}
              </div>
            )}

            {/* Enquadramento Rápido (Categoria e Equipa) */}
            {canEditCategory && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-blue-900 dark:text-blue-400" />
                  <span>Enquadramento Rápido (Categoria e Equipa)</span>
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-600 dark:text-slate-400 mr-1">Categoria:</span>
                    {(['embaixador', 'lider', 'aspirante'] as MemberCategory[]).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          const res = updateMemberCategory(member.id, cat);
                          if (res.success) {
                            onFeedback('success', `Categoria alterada para ${CATEGORY_DISPLAY[cat]}.`);
                          } else {
                            onFeedback('error', res.error || 'Sem autorização para alterar categoria.');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border whitespace-nowrap shrink-0 cursor-pointer ${
                          member.category === cat
                            ? 'bg-blue-900 text-white border-blue-900'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {CATEGORY_DISPLAY[cat]}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 dark:text-slate-400 whitespace-nowrap">Equipa:</span>
                    {isDirectionMember(member, state.users) ? (
                      <span
                        className="px-2.5 py-1 rounded-lg bg-blue-900/10 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800 text-xs font-bold"
                        title="Membros da Direção (Diretor, Diretor-associado e Secretário) não pertencem a equipas."
                      >
                        Direção
                      </span>
                    ) : (
                      <select
                        value={member.unitOrTeam || ''}
                        onChange={(e) => {
                          const newTeam = e.target.value || undefined;
                          const res = assignMemberToUnit(member.id, newTeam);
                          if (res.success) {
                            onFeedback('success', `Equipa atualizada para ${newTeam || 'Sem Equipa'}.`);
                          } else {
                            onFeedback('error', res.error || 'Erro ao alocar equipa.');
                          }
                        }}
                        className="p-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs font-medium focus:ring-1 focus:ring-blue-900"
                      >
                        <option value="">Sem Equipa</option>
                        {state.settings.units.map((u) => (
                          <option key={u.id} value={u.name}>
                            {u.name} ({u.category})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Conta de Acesso Sincronizada */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Conta de Acesso ao Sistema</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {dossier.linkedUser
                    ? `Vinculada a ${dossier.linkedUser.email} · Estado: ${
                        dossier.linkedUser.active ? 'Ativa' : 'Aguardando Confirmação do Diretor'
                      }`
                    : 'Sem conta de login associada. Pode ser criada após validação da inscrição ou pela administração.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {dossier.linkedUser && !dossier.linkedUser.active && hasApproveMemberAccountPermission(currentUser.role, state.settings.permissionsMatrix) && (
                  <button
                    type="button"
                    onClick={() => {
                      const res = approvePendingMemberAccount(dossier.linkedUser!.id);
                      if (res.success) {
                        onFeedback('success', `Conta de acesso de ${member.fullName} confirmada e ativada com sucesso!`);
                      } else {
                        onFeedback('error', res.error || 'Erro ao validar conta.');
                      }
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Confirmar Conta</span>
                  </button>
                )}
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 tabular-nums shrink-0">
                  {dossier.linkedUser
                    ? dossier.linkedUser.active
                      ? 'Conta Ativa'
                      : 'Aguardando Diretor'
                    : 'Sem Conta'}
                </span>
              </div>
            </div>
            {!canViewDossier360 && (
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-[11px] text-slate-500 dark:text-slate-400">
                O acesso completo ao Dossiê 360º (Situação Financeira, Formação, Assiduidade e Histórico) é concedido exclusivamente através da Grelha de Permissões.
              </div>
            )}
          </div>
          );
        })()}

        {/* SEPARADOR 2: FORMAÇÃO & INVESTIDURA */}
        {canViewDossier360 && effectiveTab === 'formacao' && (
          <div className="space-y-4">
            {!canViewTrainingData ? (
              <div className="p-6 text-center text-slate-500 border border-slate-200 dark:border-slate-800 rounded-xl">
                Não tem permissão para consultar o histórico de formação deste membro.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                  <div>
                    <span className="text-[11px] text-slate-500">Módulos Registados</span>
                    <p className="font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {dossier.training.classesCount}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500">Medalhas Registadas</span>
                    <p className="font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                      {dossier.training.honorsCount}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500">Investidura Oficial</span>
                    <p className="font-bold text-amber-700 dark:text-amber-400 mt-0.5 tabular-nums">
                      {member.investitureDate ? formatDateAO(member.investitureDate) : 'Não registada'}
                    </p>
                  </div>
                </div>

                {dossier.training.items.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 border border-slate-200 dark:border-slate-800 rounded-xl">
                    Nenhum módulo ou medalha atribuída a este membro até ao momento.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    {dossier.training.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 bg-white dark:bg-slate-900 space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Award className="w-3.5 h-3.5 text-blue-900 dark:text-blue-400 shrink-0" />
                              <span>{item.targetTitle}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              <span>{item.type === 'classe' ? 'Módulo Formativo' : 'Medalha'}</span>
                              <span aria-hidden="true"> · </span>
                              <span>Instrutor: {item.instructorName}</span>
                              <span aria-hidden="true"> · </span>
                              <span className="tabular-nums">
                                Atualizado em {formatDateAO(item.updatedAt)}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span
                              className={`font-bold text-xs ${
                                item.finalAuthorizedApproval
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : item.instructorValidated
                                  ? 'text-blue-800 dark:text-blue-400'
                                  : 'text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              {item.finalAuthorizedApproval
                                ? 'Investidura Aprovada'
                                : item.instructorValidated
                                ? 'Validada pelo Instrutor'
                                : 'Em Curso'}
                            </span>
                            <div className="text-[11px] text-slate-500 tabular-nums">
                              {item.completedRequirements.length}/{item.totalRequirements} requisitos ({item.progressPercent}%)
                            </div>
                          </div>
                        </div>

                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              item.finalAuthorizedApproval ? 'bg-emerald-600' : 'bg-blue-900 dark:bg-blue-500'
                            }`}
                            style={{ width: `${item.progressPercent}%` }}
                          />
                        </div>

                        {item.observations && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            Observação: {item.observations}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* SEPARADOR 3: ASSIDUIDADE & ATIVIDADES */}
        {canViewDossier360 && effectiveTab === 'assiduidade' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
              <div>
                <span className="text-[11px] text-slate-500">Registos Totais</span>
                <p className="font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                  {dossier.attendance.totalRecorded}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slate-500">Presenças</span>
                <p className="font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 tabular-nums">
                  {dossier.attendance.presentCount}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slate-500">Justificadas</span>
                <p className="font-bold text-amber-700 dark:text-amber-400 mt-0.5 tabular-nums">
                  {dossier.attendance.justifiedCount}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-slate-500">Ausências</span>
                <p className="font-bold text-rose-700 dark:text-rose-400 mt-0.5 tabular-nums">
                  {dossier.attendance.absentCount}
                </p>
              </div>
            </div>

            {dossier.attendance.entries.length === 0 ? (
              <div className="p-8 text-center text-slate-500 border border-slate-200 dark:border-slate-800 rounded-xl">
                Ainda não existem chamadas de presença registadas para este membro em reuniões ou atividades.
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold text-[11px]">
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Atividade / Reunião</th>
                        <th className="py-2.5 px-3">Local</th>
                        <th className="py-2.5 px-3 text-right">Registo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {dossier.attendance.entries.map((att) => (
                        <tr key={att.activityId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 tabular-nums whitespace-nowrap text-slate-600 dark:text-slate-400">
                            {formatDateAO(att.date)}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900 dark:text-white">{att.title}</div>
                            <div className="text-[11px] text-slate-500">
                              {getActivityTypeLabel(att.type)}
                              {att.notes ? ` · ${att.notes}` : ''}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{att.location}</td>
                          <td className="py-2.5 px-3 text-right font-semibold whitespace-nowrap">
                            {att.status === 'presente' && (
                              <span className="text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Presente</span>
                              </span>
                            )}
                            {att.status === 'justificado' && (
                              <span className="text-amber-700 dark:text-amber-400">Justificado</span>
                            )}
                            {att.status === 'ausente' && (
                              <span className="text-rose-700 dark:text-rose-400">Ausente</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SEPARADOR 4: QUOTAS & HISTÓRICO */}
        {canViewDossier360 && effectiveTab === 'quotas_historico' && (
          <div className="space-y-6">
            {/* Secção A: Situação Financeira de Quotas */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <Wallet className="w-4 h-4 text-blue-900 dark:text-blue-400" />
                <span>Resumo de Quotas e Recibos</span>
              </div>

              {!canViewFinancialData ? (
                <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500">
                  Os detalhes financeiros de quotas estão restritos a perfis com acesso à Tesouraria ou ao próprio membro.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60">
                    <div>
                      <span className="text-[11px] text-slate-500">Total Devido ({dossier.quotas.summary.periodsCharged} períodos)</span>
                      <p className="font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                        {formatKz(dossier.quotas.summary.grossDueInCents)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500">Total Pago</span>
                      <p className="font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 tabular-nums">
                        {formatKz(dossier.quotas.summary.totalPaidInCents)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500">Zerado / Isenções</span>
                      <p className="font-bold text-blue-900 dark:text-blue-300 mt-0.5 tabular-nums">
                        {formatKz(dossier.quotas.summary.totalWaivedInCents)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500">Saldo em Dívida</span>
                      <p className={`font-bold mt-0.5 tabular-nums ${quotaStatusColor}`}>
                        {formatKz(dossier.quotas.summary.balanceDueInCents)}
                      </p>
                    </div>
                  </div>

                  {dossier.quotas.receipts.length > 0 && (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold text-[11px]">
                            <th className="py-2 px-3">Recibo</th>
                            <th className="py-2 px-3">Rubrica / Período</th>
                            <th className="py-2 px-3">Data</th>
                            <th className="py-2 px-3 text-right">Valor</th>
                            <th className="py-2 px-3 text-right">Imprimir</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {dossier.quotas.receipts.slice(0, 6).map((r) => (
                            <tr key={r.id}>
                              <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white">
                                {r.receiptNumber}
                              </td>
                              <td className="py-2 px-3">
                                <div className="font-medium text-slate-900 dark:text-white">{r.feeTitle}</div>
                                <div className="text-[11px] text-slate-500">{r.periodLabel}</div>
                              </td>
                              <td className="py-2 px-3 tabular-nums text-slate-600 dark:text-slate-400">
                                {formatDateAO(r.paidAt)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums font-bold">
                                {r.isCancelled ? (
                                  <span className="line-through text-rose-600">{formatKz(r.amountPaidInCents)}</span>
                                ) : (
                                  formatKz(r.amountPaidInCents)
                                )}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onPrintDocument({
                                      id: r.id,
                                      documentNumber: r.receiptNumber,
                                      documentType: 'recibo',
                                      title: `Recibo Oficial - ${r.memberName}`,
                                      year: state.settings.currentYear,
                                      issuedToName: r.memberName,
                                      issuedToMemberId: member.manualNumber || r.memberId,
                                      issuedByUserId: r.treasurerUserId,
                                      issuedByName: r.treasurerName,
                                      issuedByRole: r.treasurerRole,
                                      issuedAt: r.paidAt,
                                      contentData: {
                                        valor: formatKz(r.amountPaidInCents),
                                        mes: r.periodLabel,
                                        metodo: r.paymentMethod,
                                        memberId: member.manualNumber || r.memberId,
                                        rubrica: r.feeTitle,
                                      },
                                      isCancelled: r.isCancelled || false,
                                      cancellationReason: r.cancellationReason,
                                    })
                                  }
                                  className="p-1 text-slate-500 hover:text-blue-900 rounded cursor-pointer"
                                  title="Imprimir Recibo"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Secção B: Documentos Oficiais Emitidos ao Membro */}
            {canViewDocumentsData && dossier.quotas.documents.length > 0 && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <FileText className="w-4 h-4 text-blue-900 dark:text-blue-400" />
                  <span>Documentos Oficiais Emitidos ({dossier.quotas.documents.length})</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  {dossier.quotas.documents.slice(0, 5).map((doc) => (
                    <div key={doc.id} className="p-2.5 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">
                          {doc.documentNumber} · {doc.title}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          Emitido em {formatDateAO(doc.issuedAt)} por {doc.issuedByName}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onPrintDocument(doc)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-blue-900 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg inline-flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Printer className="w-3 h-3" />
                        <span>Ver / PDF</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Secção C: Histórico Associativo e Linha do Tempo */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <Clock className="w-4 h-4 text-blue-900 dark:text-blue-400" />
                <span>Histórico Associativo e Movimentações ({dossier.timeline.length})</span>
              </div>

              {dossier.timeline.length === 0 ? (
                <div className="p-6 text-center text-slate-500 border border-slate-200 dark:border-slate-800 rounded-xl">
                  Ainda não existem movimentações registadas para este membro.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  {dossier.timeline.slice(0, 15).map((ev) => (
                    <div key={ev.id} className="p-3 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">{ev.title}</div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                          {ev.description}
                        </p>
                      </div>
                      <div className="sm:text-right text-[11px] text-slate-500 shrink-0 tabular-nums">
                        <div>{ev.date.includes('T') ? formatDateTimeAO(ev.date) : formatDateAO(ev.date)}</div>
                        {ev.actorName && <div>Por {ev.actorName}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          {can('members', 'ARCHIVE') && member.status === 'arquivado' && (
            <button
              type="button"
              onClick={() => {
                const res = unarchiveMember(member.id);
                if (res.success) {
                  onFeedback('success', 'Membro desarquivado com sucesso.');
                } else {
                  onFeedback('error', res.error || 'Erro ao desarquivar');
                }
              }}
              className="px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Desarquivar Membro</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Fechar Dossiê
          </button>
        </div>
      </div>
    </Modal>

    <DocumentViewerModal
      documentItem={viewingDoc}
      onClose={() => setViewingDoc(null)}
    />
    </>
  );
};
