import React, { useState } from 'react';
import {
  AlertTriangle,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { EnrollmentDocumentDeliveryMethod, MemberCategory } from '../../types';
import { generateManualNumber, getTodayISODate } from '../../utils/date';
import { downloadDocumentFile, processProofFile } from '../../utils/fileUpload';
import { DocumentViewerModal, ViewingDocumentPayload } from '../common/DocumentViewerModal';
import {
  MemberRegistrationFormData,
  validateRegistrationFields,
} from '../../services/enrollmentService';

interface UnitOption {
  id: string;
  name: string;
  category: MemberCategory | 'mista';
  leaderUserId?: string;
  active: boolean;
}

interface MemberRegistrationFormProps {
  mode: 'secretary' | 'self_enrollment';
  units: UnitOption[];
  onSubmit: (
    data: MemberRegistrationFormData
  ) =>
    | Promise<{ success: boolean; error?: string }>
    | { success: boolean; error?: string };
  onCancel: () => void;
  initialCategory?: MemberCategory;
  initialData?: Partial<MemberRegistrationFormData>;
  isResubmission?: boolean;
}

const createEmptyFormData = (
  defaultCategory: MemberCategory,
  mode: 'secretary' | 'self_enrollment'
): MemberRegistrationFormData => ({
  manualNumber: '',
  fullName: '',
  birthDate: '',
  gender: 'M',
  identityCardNumber: '',
  phone: '',
  email: '',
  address: '',
  category: defaultCategory,
  unitOrTeam: '',
  guardianName: '',
  guardianPhone: '',
  emergencyName: '',
  emergencyRelationship: '',
  emergencyPhone: '',
  bloodType: '',
  allergiesOrMedicalNotes: '',
  investitureDate: '',
  professionalCourse: '',
  joinedDate:
    mode === 'secretary' && defaultCategory !== 'aspirante'
      ? getTodayISODate()
      : '',
  documentDeliveryMethod: mode === 'self_enrollment' ? '' : 'presencial',
  biDocumentFileName: '',
  biDocumentBase64: '',
  photoDocumentFileName: '',
  photoDocumentBase64: '',
});

export const MemberRegistrationForm: React.FC<MemberRegistrationFormProps> = ({
  mode,
  units,
  onSubmit,
  onCancel,
  initialCategory,
  initialData,
  isResubmission = false,
}) => {
  const defaultCategory: MemberCategory =
    initialCategory || initialData?.category || (mode === 'self_enrollment' ? 'aspirante' : 'embaixador');

  const [formData, setFormData] = useState<MemberRegistrationFormData>(() => {
    const empty = createEmptyFormData(defaultCategory, mode);
    if (!initialData) return empty;
    return {
      ...empty,
      ...initialData,
      category: initialData.category || empty.category,
      gender: initialData.gender || empty.gender,
      documentDeliveryMethod: initialData.documentDeliveryMethod || empty.documentDeliveryMethod,
    };
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingAttachment, setIsProcessingAttachment] = useState<'bi' | 'photo' | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ViewingDocumentPayload | null>(null);

  const showJoinedDateField = mode === 'secretary' && formData.category !== 'aspirante';

  const handleRegBirthDateChange = (dateVal: string) => {
    const autoNumber = generateManualNumber(formData.identityCardNumber, dateVal);
    setFormData((prev) => ({
      ...prev,
      birthDate: dateVal,
      manualNumber: autoNumber,
    }));
  };

  const handleRegBIChange = (biVal: string) => {
    const autoNumber = generateManualNumber(biVal, formData.birthDate);
    setFormData((prev) => ({
      ...prev,
      identityCardNumber: biVal,
      manualNumber: autoNumber,
    }));
  };

  const handleCategoryChange = (nextCategory: MemberCategory) => {
    setFormData((prev) => ({
      ...prev,
      category: nextCategory,
      investitureDate: nextCategory === 'aspirante' ? '' : prev.investitureDate,
      joinedDate:
        mode === 'secretary' && nextCategory !== 'aspirante'
          ? prev.joinedDate || getTodayISODate()
          : '',
    }));
  };

  const handleAttachmentUpload = async (
    target: 'bi' | 'photo',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachmentError(null);
    setFormError(null);
    setIsProcessingAttachment(target);
    try {
      const processed = await processProofFile(file);
      if (target === 'bi') {
        setFormData((prev) => ({
          ...prev,
          biDocumentFileName: processed.fileName,
          biDocumentBase64: processed.base64,
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          photoDocumentFileName: processed.fileName,
          photoDocumentBase64: processed.base64,
        }));
      }
    } catch (err: any) {
      setAttachmentError(err?.message || 'Erro ao processar o ficheiro selecionado.');
      e.target.value = '';
    } finally {
      setIsProcessingAttachment(null);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const autoManualNumber = generateManualNumber(formData.identityCardNumber, formData.birthDate);
    const normalizedPayload: MemberRegistrationFormData = {
      ...formData,
      manualNumber: mode === 'self_enrollment' ? autoManualNumber : formData.manualNumber,
      unitOrTeam: mode === 'self_enrollment' ? '' : formData.unitOrTeam,
      joinedDate: showJoinedDateField ? formData.joinedDate : '',
      investitureDate:
        formData.category === 'embaixador' || formData.category === 'lider'
          ? formData.investitureDate
          : '',
    };

    const validation = validateRegistrationFields(normalizedPayload, mode);
    if (!validation.valid) {
      setFormError(validation.error || 'Preencha todos os campos obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onSubmit(normalizedPayload);
      if (result.success) {
        setFormData(createEmptyFormData(defaultCategory, mode));
      } else {
        setFormError(
          result.error ||
            (mode === 'self_enrollment'
              ? 'Erro ao submeter solicitação de inscrição.'
              : 'Erro ao registar membro.')
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {isResubmission && (
        <div className="p-3.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-950 dark:text-blue-200 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4 text-blue-800 dark:text-blue-400" />
            <span>Refazer Inscrição · Reutilizar Dados e Atualizar Uploads</span>
          </div>
          <p>
            Os seus dados anteriores foram carregados automaticamente. Pode alterá-los e, se desejar, substituir os documentos anexados (B.I. e Fotografia) antes de submeter novamente para a Secretaria.
          </p>
        </div>
      )}

      {formError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-lg text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{formError}</span>
        </div>
      )}

      {/* Secção 1: Identificação */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-1">
          1. Identificação Pessoal
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {mode === 'secretary' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 dark:text-slate-200 font-semibold">
                  Nº de Matrícula <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-blue-900 dark:text-blue-300 font-mono font-bold bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                  Automático: EBX-XXXMMAA
                </span>
              </div>
              <input
                type="text"
                placeholder="Gerado automático (EBX-XXXMMAA)"
                value={formData.manualNumber}
                onChange={(e) => setFormData({ ...formData, manualNumber: e.target.value })}
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded font-mono font-bold bg-slate-50 dark:bg-slate-800 text-blue-900 dark:text-white focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
                required
              />
            </div>
          )}

          <div className={mode === 'secretary' ? 'sm:col-span-2' : 'sm:col-span-3'}>
            <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
              Nome Completo <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Nome completo de registo civil"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
              Data de Nascimento <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={formData.birthDate}
              onChange={(e) => handleRegBirthDateChange(e.target.value)}
              className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
              Sexo <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'M' | 'F' })}
              className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
              required
            >
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
              B.I. (Angola) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="007849312LA041"
              value={formData.identityCardNumber}
              onChange={(e) => handleRegBIChange(e.target.value)}
              className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded font-mono uppercase bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
              required
            />
          </div>
        </div>
      </div>

      {/* Secção 2: Contactos e Localização */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-1">
          2. Contactos e Residência
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
              Telefone Principal <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              placeholder="+244 9XX XXX XXX"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
              E-mail <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              placeholder="exemplo@dominio.ao"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
              required
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
              Município / Bairro <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Talatona, Benfica"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
              required
            />
          </div>
        </div>
      </div>

      {/* Secção 3: Informação do Clube */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-1">
          3. Enquadramento Institucional
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
              Categoria <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.category}
              onChange={(e) => handleCategoryChange(e.target.value as MemberCategory)}
              className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              required
            >
              <option value="embaixador">Embaixador</option>
              <option value="lider">Líder</option>
              <option value="aspirante">Aspirante</option>
            </select>
          </div>

          {mode === 'secretary' && (
            <div>
              <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                Equipa <span className="text-rose-500">*</span>
              </label>
              {units.length > 0 ? (
                <select
                  value={formData.unitOrTeam}
                  onChange={(e) => setFormData({ ...formData, unitOrTeam: e.target.value })}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                >
                  <option value="">Selecione a equipa...</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.name}>
                      {u.name} ({u.category})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Nome da Equipa / Unidade (ex: Águias)"
                  value={formData.unitOrTeam}
                  onChange={(e) => setFormData({ ...formData, unitOrTeam: e.target.value })}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  required
                />
              )}
            </div>
          )}

          {showJoinedDateField && (
            <div>
              <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                Data de Admissão <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formData.joinedDate}
                onChange={(e) => setFormData({ ...formData, joinedDate: e.target.value })}
                className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
                required
              />
            </div>
          )}

          {(formData.category === 'embaixador' || formData.category === 'lider') && (
            <div className="sm:col-span-3 bg-amber-50/70 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800/60">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-amber-900 dark:text-amber-200 font-bold">
                  Data Oficial de Investidura ({formData.category === 'lider' ? 'Líder' : 'Embaixador'}){' '}
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-amber-800 dark:text-amber-300 font-medium">Exibida no Cartão Digital</span>
              </div>
              <input
                type="date"
                value={formData.investitureDate}
                onChange={(e) => setFormData({ ...formData, investitureDate: e.target.value })}
                className="w-full p-2 border border-amber-300 dark:border-amber-700 rounded focus:ring-1 focus:ring-amber-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold"
                required
              />
              <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">
                Indique a data da cerimónia oficial em que o membro/líder foi investido com o lenço/insígnia oficial.
              </p>
            </div>
          )}

          <div className="sm:col-span-3">
            <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
              Curso Profissional / Área Académica <span className="text-slate-400 dark:text-slate-500 font-normal">(Opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Informática de Gestão, Enfermagem, Mecânica..."
              value={formData.professionalCourse}
              onChange={(e) => setFormData({ ...formData, professionalCourse: e.target.value })}
              className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
            />
          </div>
        </div>
      </div>

      {/* Secção 4: Encarregado de Educação e Emergência */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-1">
          4. Encarregado de Educação e Emergência (Acesso Restrito)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
              Nome do Encarregado{' '}
              {mode === 'self_enrollment' ? (
                <span className="text-slate-400 dark:text-slate-500 font-normal">(Opcional)</span>
              ) : (
                <span className="text-rose-500">*</span>
              )}
            </label>
            <input
              type="text"
              placeholder="Nome do Pai/Mãe/Tutor"
              value={formData.guardianName}
              onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
              className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
              required={mode === 'secretary'}
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
              Telefone do Encarregado{' '}
              {mode === 'self_enrollment' ? (
                <span className="text-slate-400 dark:text-slate-500 font-normal">(Opcional)</span>
              ) : (
                <span className="text-rose-500">*</span>
              )}
            </label>
            <input
              type="tel"
              placeholder="+244 9XX XXX XXX"
              value={formData.guardianPhone}
              onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
              className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
              required={mode === 'secretary'}
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
              Grupo Sanguíneo <span className="text-slate-400 dark:text-slate-500 font-normal">(Opcional)</span>
            </label>
            <select
              value={formData.bloodType}
              onChange={(e) => setFormData({ ...formData, bloodType: e.target.value })}
              className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
            >
              <option value="">Não informado (Opcional)</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
              Alergias ou Cuidados Médicos <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Nenhuma alergia conhecida, ou indicar alergias/cuidados médicos"
              value={formData.allergiesOrMedicalNotes}
              onChange={(e) => setFormData({ ...formData, allergiesOrMedicalNotes: e.target.value })}
              className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400"
              required
            />
          </div>
        </div>
      </div>

      {/* Secção 5: Entrega / Anexo de Documentos (B.I. e Fotografia) */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-1">
          {mode === 'self_enrollment'
            ? '5. Documentação Obrigatória (B.I. e Fotografia)'
            : '5. Documentação do Membro (B.I. e Fotografia - Opcional)'}
        </h4>

        <div className="space-y-3 text-xs">
          {mode === 'self_enrollment' && (
            <div>
              <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                Como pretende entregar o B.I. e a Fotografia? <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.documentDeliveryMethod || ''}
                onChange={(e) => {
                  const nextMethod = e.target.value as EnrollmentDocumentDeliveryMethod | '';
                  setAttachmentError(null);
                  setFormData((prev) => ({
                    ...prev,
                    documentDeliveryMethod: nextMethod,
                    ...(nextMethod !== 'anexar_digital'
                      ? {
                          biDocumentFileName: '',
                          biDocumentBase64: '',
                          photoDocumentFileName: '',
                          photoDocumentBase64: '',
                        }
                      : {}),
                  }));
                }}
                className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-blue-900 dark:focus:ring-blue-400 bg-white dark:bg-slate-800 font-medium text-slate-800 dark:text-white"
                required
              >
                <option value="">Selecione uma opção de entrega...</option>
                <option value="anexar_digital">Vou anexar os documentos agora (PDF, Imagem ou Documento)</option>
                <option value="presencial">Entregarei de forma presencial na Secretaria do Clube</option>
              </select>
            </div>
          )}

          {(mode === 'secretary' || formData.documentDeliveryMethod === 'anexar_digital') && (
            <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-slate-800/80 space-y-3">
              <div className="flex items-start gap-2 text-blue-950 dark:text-blue-200">
                <Paperclip className="w-4 h-4 shrink-0 mt-0.5 text-blue-800 dark:text-blue-400" />
                <p className="text-[11px] leading-relaxed">
                  {mode === 'self_enrollment' ? (
                    <>
                      <strong>Anexar Documentos (B.I. e Fotografia):</strong> Pode enviar um{' '}
                      <strong>PDF ou outro documento</strong> único com o B.I. e a Fotografia juntos, ou anexar o B.I. e a
                      Fotografia em ficheiros separados (PDF, JPG, PNG, Word/DOCX, etc.).
                    </>
                  ) : (
                    <>
                      <strong>Anexar Documentos na Ficha (Opcional):</strong> Pode anexar já o Bilhete de Identidade e/ou
                      Fotografia do membro, ou anexar posteriormente diretamente na ficha cadastral.
                    </>
                  )}
                </p>
              </div>

              {attachmentError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-lg text-[11px] flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{attachmentError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Anexo 1: B.I. ou Documento Único */}
                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                  <label className="block font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                    {mode === 'self_enrollment' ? (
                      <>
                        Anexo do B.I. ou PDF Único (B.I. + Fotografia) <span className="text-rose-500">*</span>
                      </>
                    ) : (
                      <>
                        Bilhete de Identidade / Documento{' '}
                        <span className="text-slate-400 dark:text-slate-500 font-normal">(Opcional)</span>
                      </>
                    )}
                  </label>
                  {formData.biDocumentBase64 ? (
                    <div className="flex items-center justify-between gap-1.5 p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded text-[11px] text-emerald-900 dark:text-emerald-200">
                      <span className="flex items-center gap-1.5 truncate font-medium min-w-0">
                        <FileText className="w-3.5 h-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                        <span className="truncate">{formData.biDocumentFileName}</span>
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewDoc({
                              title: 'Documento de Identificação (B.I.)',
                              fileName: formData.biDocumentFileName || 'documento-bi',
                              base64: formData.biDocumentBase64 || '',
                            })
                          }
                          className="p-1 text-blue-800 hover:text-blue-950 dark:text-blue-300 dark:hover:text-blue-100"
                          title="Visualizar ficheiro"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadDocumentFile(
                              formData.biDocumentBase64 || '',
                              formData.biDocumentFileName || 'documento-bi'
                            )
                          }
                          className="p-1 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                          title="Baixar ficheiro"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              biDocumentFileName: '',
                              biDocumentBase64: '',
                            }))
                          }
                          className="p-1 text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300"
                          title="Remover ficheiro"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-3 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer text-center gap-1">
                      {isProcessingAttachment === 'bi' ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-800 dark:text-blue-400" />
                      ) : (
                        <Upload className="w-4 h-4 text-blue-800 dark:text-blue-400" />
                      )}
                      <span className="text-[11px] font-semibold text-blue-900 dark:text-blue-300">
                        {isProcessingAttachment === 'bi'
                          ? 'A processar ficheiro...'
                          : 'Selecionar PDF, Documento ou Imagem'}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">PDF, JPG, PNG, DOC/DOCX</span>
                      <input
                        type="file"
                        accept=".pdf,image/*,.doc,.docx,.odt,.rtf,.txt"
                        onChange={(e) => handleAttachmentUpload('bi', e)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Anexo 2: Fotografia */}
                <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                  <label className="block font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                    Anexo da Fotografia{' '}
                    <span className="text-slate-400 dark:text-slate-500 font-normal">
                      {mode === 'self_enrollment' ? '(separada ou adicional)' : '(Opcional)'}
                    </span>
                  </label>
                  {formData.photoDocumentBase64 ? (
                    <div className="flex items-center justify-between gap-1.5 p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded text-[11px] text-emerald-900 dark:text-emerald-200">
                      <span className="flex items-center gap-1.5 truncate font-medium min-w-0">
                        {formData.photoDocumentBase64.startsWith('data:image/') ? (
                          <img
                            src={formData.photoDocumentBase64}
                            alt="Fotografia"
                            className="w-6 h-6 rounded object-cover border border-emerald-300 dark:border-emerald-700 shrink-0"
                          />
                        ) : (
                          <ImageIcon className="w-3.5 h-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                        )}
                        <span className="truncate">{formData.photoDocumentFileName}</span>
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewDoc({
                              title: 'Fotografia Anexada',
                              fileName: formData.photoDocumentFileName || 'fotografia',
                              base64: formData.photoDocumentBase64 || '',
                            })
                          }
                          className="p-1 text-blue-800 hover:text-blue-950 dark:text-blue-300 dark:hover:text-blue-100"
                          title="Visualizar fotografia"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadDocumentFile(
                              formData.photoDocumentBase64 || '',
                              formData.photoDocumentFileName || 'fotografia'
                            )
                          }
                          className="p-1 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                          title="Baixar fotografia"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              photoDocumentFileName: '',
                              photoDocumentBase64: '',
                            }))
                          }
                          className="p-1 text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300"
                          title="Remover fotografia"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-3 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer text-center gap-1">
                      {isProcessingAttachment === 'photo' ? (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-800 dark:text-blue-400" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-blue-800 dark:text-blue-400" />
                      )}
                      <span className="text-[11px] font-semibold text-blue-900 dark:text-blue-300">
                        {isProcessingAttachment === 'photo'
                          ? 'A processar fotografia...'
                          : 'Anexar Fotografia (Imagem ou PDF)'}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {mode === 'self_enrollment'
                          ? 'Opcional se já incluída no documento ao lado'
                          : 'Opcional — exibe também no Cartão Digital'}
                      </span>
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx,.odt,.rtf,.txt"
                        onChange={(e) => handleAttachmentUpload('photo', e)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <DocumentViewerModal
        documentItem={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting || isProcessingAttachment !== null}
          className="px-5 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-sm disabled:opacity-50"
        >
          {isSubmitting
            ? mode === 'self_enrollment'
              ? 'A submeter inscrição...'
              : 'A registar...'
            : mode === 'self_enrollment'
            ? 'Submeter Solicitação de Inscrição'
            : 'Concluir Registo Oficial'}
        </button>
      </div>
    </form>
  );
};
