import React from 'react';
import { Member } from '../../types';
import { MemberReconfirmationInput, MemberRegistrationFormData } from '../../services/enrollmentService';
import { MemberRegistrationForm } from './MemberRegistrationForm';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { evaluateIdentityCardValidity, formatDateAO, formatDateTimeAO } from '../../utils/date';

interface MemberReconfirmationFormProps {
  member: Member;
  currentPeriodId?: string;
  onSubmit: (
    data: MemberReconfirmationInput
  ) => Promise<{ success: boolean; error?: string }> | { success: boolean; error?: string };
  onCancel: () => void;
}

const CATEGORY_LABELS: Record<Member['category'], string> = {
  embaixador: 'Embaixador',
  lider: 'Líder',
  aspirante: 'Aspirante',
};

export const MemberReconfirmationForm: React.FC<MemberReconfirmationFormProps> = ({
  member,
  currentPeriodId,
  onSubmit,
  onCancel,
}) => {
  const alreadyReconfirmedThisPeriod = Boolean(
    currentPeriodId && member.lastReconfirmedPeriodId === currentPeriodId
  );
  const biValidity = evaluateIdentityCardValidity(member.identityCardExpiryDate);

  const initialData: Partial<MemberRegistrationFormData> = {
    manualNumber: member.manualNumber,
    fullName: member.fullName,
    birthDate: member.birthDate,
    gender: member.gender,
    identityCardNumber: member.identityCardNumber,
    identityCardExpiryDate: member.identityCardExpiryDate || '',
    phone: member.phone,
    email: member.email,
    address: member.address,
    category: member.category,
    unitOrTeam: member.unitOrTeam,
    guardianName: member.guardianName,
    guardianPhone: member.guardianPhone,
    emergencyName: member.emergencyContact?.name,
    emergencyRelationship: member.emergencyContact?.relationship,
    emergencyPhone: member.emergencyContact?.phone,
    bloodType: member.bloodType,
    allergiesOrMedicalNotes: member.allergiesOrMedicalNotes,
    investitureDate: member.investitureDate,
    professionalCourse: member.professionalCourse,
    joinedDate: member.joinedDate,
    biDocumentFileName: member.biDocumentFileName,
    biDocumentBase64: member.biDocumentBase64,
    photoDocumentFileName: member.photoDocumentFileName,
    photoDocumentBase64: member.photoDocumentBase64,
    documentDeliveryMethod: 'anexar_digital',
  };

  const handleFormSubmit = async (data: MemberRegistrationFormData) => {
    const reconfInput: MemberReconfirmationInput = {
      fullName: data.fullName,
      birthDate: data.birthDate,
      gender: data.gender,
      identityCardNumber: data.identityCardNumber,
      identityCardExpiryDate: data.identityCardExpiryDate,
      phone: data.phone,
      email: data.email,
      address: data.address,
      guardianName: data.guardianName,
      guardianPhone: data.guardianPhone,
      emergencyName: data.emergencyName,
      emergencyRelationship: data.emergencyRelationship,
      emergencyPhone: data.emergencyPhone,
      bloodType: data.bloodType,
      allergiesOrMedicalNotes: data.allergiesOrMedicalNotes,
      investitureDate: data.investitureDate,
      professionalCourse: data.professionalCourse,
      biDocumentFileName: data.biDocumentFileName,
      biDocumentBase64: data.biDocumentBase64,
      photoDocumentFileName: data.photoDocumentFileName,
      photoDocumentBase64: data.photoDocumentBase64,
      newAttachedDocuments: [],
    };
    return await onSubmit(reconfInput);
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho informativo oficial */}
      <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 block">
              Reconfirmação de Membro Registado
            </span>
            <h4 className="text-sm font-black text-slate-900 dark:text-white">{member.fullName}</h4>
            <p className="text-[11px] text-slate-700 dark:text-slate-300 mt-0.5">
              Matrícula: <strong className="font-mono">{member.manualNumber}</strong> · Categoria:{' '}
              <strong>{CATEGORY_LABELS[member.category]}</strong> · Equipa:{' '}
              <strong>{member.unitOrTeam?.trim() || 'Sem Equipa'}</strong>
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                member.status === 'ativo'
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700'
              }`}
            >
              Estado atual: {member.status === 'ativo' ? 'Ativo' : 'Inativo'}
            </span>
            {alreadyReconfirmedThisPeriod && member.lastReconfirmedAt && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-3 h-3" />
                <span>Reconfirmado em {formatDateTimeAO(member.lastReconfirmedAt)}</span>
              </span>
            )}
          </div>
        </div>
        <p className="text-[11px] text-blue-950/90 dark:text-blue-200/90 leading-relaxed">
          Utilize o formulário oficial abaixo para revisar e atualizar os seus dados e documentos. Este é o mesmo formulário de inscrição do clube.
        </p>
      </div>

      {biValidity.isExpired && (
        <div className="p-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">B.I. Expirado:</span> O seu Bilhete de Identidade expirou em{' '}
            <strong>{formatDateAO(member.identityCardExpiryDate)}</strong>. Atualize a data de validade e anexe o documento renovado se já tiver tratado.
          </div>
        </div>
      )}

      <MemberRegistrationForm
        mode="self_enrollment"
        units={[]}
        initialData={initialData}
        initialCategory={member.category}
        onSubmit={handleFormSubmit}
        onCancel={onCancel}
      />
    </div>
  );
};
