/**
 * Serviço de Gestão de Solicitações de Inscrição de Novos Membros
 * Permite que candidatos/membros preencham a ficha oficial de inscrição diretamente no sistema
 * e que responsáveis autorizados na Grelha de Permissões (ex.: Secretário) autorizem ou recusem.
 */

import {
  AuditLogEntry,
  DeletionRequest,
  EnrollmentDocumentDeliveryMethod,
  EnrollmentScheduleConfig,
  Member,
  MemberAttachedDocument,
  MemberCategory,
  MemberDocumentationStatus,
  MemberEnrollmentRequest,
  RoleType,
  UserAccount,
} from '../types';
import { generateManualNumber, getNowISOString, getTodayISODate } from '../utils/date';
import { isMemberNumberUnique, findPotentialDuplicateMember } from './storageService';
import { sanitizeMemberIntegrity } from './memberIntegrityService';
import { syncMemberChangesToUsers, isPendingMemberAccountConfirmation } from './accountSyncService';

export interface MemberRegistrationFormData {
  manualNumber: string;
  fullName: string;
  birthDate: string;
  gender: 'M' | 'F';
  identityCardNumber: string;
  phone: string;
  email: string;
  address: string;
  category: MemberCategory;
  unitOrTeam: string;
  guardianName: string;
  guardianPhone: string;
  emergencyName?: string;
  emergencyRelationship?: string;
  emergencyPhone?: string;
  bloodType: string;
  allergiesOrMedicalNotes: string;
  investitureDate: string;
  professionalCourse: string;
  joinedDate: string;
  documentDeliveryMethod?: EnrollmentDocumentDeliveryMethod | '';
  biDocumentFileName?: string;
  biDocumentBase64?: string;
  photoDocumentFileName?: string;
  photoDocumentBase64?: string;
}

export function generateNextMemberId(members: Member[]): string {
  let maxSeq = 0;
  for (const m of members) {
    const match = String(m.id || '').match(/^CDA-MEM-(\d+)$/);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }
  const nextSeq = Math.max(maxSeq + 1, members.length + 1);
  return `CDA-MEM-${nextSeq.toString().padStart(3, '0')}`;
}

export function generateNextEnrollmentProtocol(
  year: number,
  existingRequests: MemberEnrollmentRequest[]
): string {
  const pattern = new RegExp(`^INS-${year}-(\\d+)$`);
  let maxSeq = 0;
  for (const req of existingRequests) {
    const match = String(req.protocolNumber || req.id || '').match(pattern);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }
  return `INS-${year}-${(maxSeq + 1).toString().padStart(4, '0')}`;
}

/**
 * Valida todos os campos obrigatórios do formulário de inscrição e registo de membro.
 * Regra institucional:
 * - Todos os campos visíveis são obrigatórios, EXCEPTO "Grupo Sanguíneo" (bloodType) e "Curso Profissional / Área Académica" (professionalCourse).
 * - Em modo "self_enrollment" (inscrição no clube), os campos "Nº de Matrícula" (preenchimento automático final), "Equipa" e "Data Pretendida de Admissão" não são preenchidos pelo candidato.
 * - Em modo "secretary" (registo de membro) com categoria "aspirante", "Data de Admissão" não aparece e fica isenta.
 * - Para categorias "embaixador" e "lider", "Data Oficial de Investidura" é obrigatória.
 */
export function validateRegistrationFields(
  data: MemberRegistrationFormData,
  mode: 'secretary' | 'self_enrollment' = 'self_enrollment'
): { valid: boolean; error?: string; resolvedManualNumber?: string } {
  const cleanName = (data.fullName || '').trim();
  const cleanBI = (data.identityCardNumber || '').trim().toUpperCase();
  const cleanBirth = (data.birthDate || '').trim();
  const cleanPhone = (data.phone || '').trim();
  const cleanEmail = (data.email || '').trim().toLowerCase();
  const cleanAddress = (data.address || '').trim();
  const cleanUnit = (data.unitOrTeam || '').trim();
  const cleanJoined = (data.joinedDate || '').trim();
  const cleanInvestiture = (data.investitureDate || '').trim();
  const cleanGuardianName = (data.guardianName || '').trim();
  const cleanGuardianPhone = (data.guardianPhone || '').trim();
  const cleanMedical = (data.allergiesOrMedicalNotes || '').trim();

  const manualNum =
    (data.manualNumber || '').trim() || generateManualNumber(cleanBI, cleanBirth);

  if (!manualNum) {
    return { valid: false, error: 'O Número de Matrícula é obrigatório (ex: EBX-0410105).' };
  }
  if (cleanName.length < 3) {
    return { valid: false, error: 'O Nome Completo institucional é obrigatório (mínimo 3 caracteres).' };
  }
  if (!cleanBirth) {
    return { valid: false, error: 'A Data de Nascimento é obrigatória.' };
  }
  if (data.gender !== 'M' && data.gender !== 'F') {
    return { valid: false, error: 'O Sexo é obrigatório.' };
  }
  if (!cleanBI) {
    return { valid: false, error: 'O Número do Bilhete de Identidade (B.I.) angolano é obrigatório.' };
  }
  if (!cleanPhone) {
    return { valid: false, error: 'O Telefone Principal é obrigatório.' };
  }
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { valid: false, error: 'O endereço de E-mail válido é obrigatório.' };
  }
  if (!cleanAddress) {
    return { valid: false, error: 'O Município / Bairro de residência é obrigatório.' };
  }
  if (!data.category) {
    return { valid: false, error: 'A Categoria do membro é obrigatória.' };
  }
  if (mode === 'secretary' && !cleanUnit) {
    return { valid: false, error: 'A Equipa / Unidade é obrigatória no registo da Secretaria.' };
  }

  const requiresJoinedDate = mode === 'secretary' && data.category !== 'aspirante';
  if (requiresJoinedDate && !cleanJoined) {
    return {
      valid: false,
      error: 'A Data de Admissão é obrigatória.',
    };
  }

  if ((data.category === 'embaixador' || data.category === 'lider') && !cleanInvestiture) {
    return {
      valid: false,
      error: `A Data Oficial de Investidura é obrigatória para a categoria ${data.category === 'lider' ? 'Líder' : 'Embaixador'}.`,
    };
  }

  if (mode === 'secretary') {
    if (!cleanGuardianName) {
      return { valid: false, error: 'O Nome do Encarregado de Educação é obrigatório.' };
    }
    if (!cleanGuardianPhone) {
      return { valid: false, error: 'O Telefone do Encarregado de Educação é obrigatório.' };
    }
  }
  if (!cleanMedical) {
    return {
      valid: false,
      error: 'O campo Alergias ou Cuidados Médicos é obrigatório (caso não possua, indique "Nenhuma").',
    };
  }

  if (mode === 'self_enrollment') {
    if (data.documentDeliveryMethod !== 'anexar_digital' && data.documentDeliveryMethod !== 'presencial') {
      return {
        valid: false,
        error: 'Indique se vai anexar os documentos (B.I. e Fotografia) ou entregá-los de forma presencial.',
      };
    }

    if (data.documentDeliveryMethod === 'anexar_digital') {
      const hasBiDoc = Boolean((data.biDocumentBase64 || '').trim() && (data.biDocumentFileName || '').trim());
      const hasPhotoDoc = Boolean((data.photoDocumentBase64 || '').trim() && (data.photoDocumentFileName || '').trim());
      if (!hasBiDoc && !hasPhotoDoc) {
        return {
          valid: false,
          error: 'Anexe o seu PDF, imagem ou outro documento contendo o B.I. e a Fotografia.',
        };
      }
      if (!hasBiDoc) {
        return {
          valid: false,
          error: 'Anexe o ficheiro do Bilhete de Identidade (ou um PDF/documento único contendo o B.I. e a Fotografia).',
        };
      }
    }
  }

  // Nota: bloodType (Grupo Sanguíneo) e professionalCourse (Curso Profissional / Área Académica) são opcionais.
  return { valid: true, resolvedManualNumber: manualNum };
}

export function normalizeIdentityCardNumber(bi?: string): string {
  return String(bi || '').replace(/[\s.-]+/g, '').trim().toUpperCase();
}

/**
 * Compara o nº de Bilhete de Identidade usado na inscrição com todos os nºs de B.I.
 * dos membros já registados e dos já inscritos (pendentes, em análise ou validados/aprovados).
 */
export function findDuplicateEnrollmentByBI(
  identityCardNumber: string,
  existingMembers: Member[],
  existingRequests: MemberEnrollmentRequest[]
):
  | { duplicate: false }
  | { duplicate: true; source: 'member'; member: Member; error: string }
  | { duplicate: true; source: 'request'; request: MemberEnrollmentRequest; error: string } {
  const cleanBI = normalizeIdentityCardNumber(identityCardNumber);
  if (!cleanBI) {
    return { duplicate: false };
  }

  // 1. Comparar com todos os membros já registados no cadastro
  const existingMemberWithBI = existingMembers.find(
    (m) => normalizeIdentityCardNumber(m.identityCardNumber) === cleanBI
  );
  if (existingMemberWithBI) {
    return {
      duplicate: true,
      source: 'member',
      member: existingMemberWithBI,
      error: `Inscrição não aceite: O nº de Bilhete de Identidade "${identityCardNumber.trim().toUpperCase()}" já pertence a um membro registado (${existingMemberWithBI.fullName} · Matrícula: ${existingMemberWithBI.manualNumber}). Inscrições duplicadas com o mesmo B.I. não são permitidas.`,
    };
  }

  // 2. Comparar com todos os inscritos / solicitações submetidas ou validadas (exclui recusadas e fichas já eliminadas)
  const existingRequestWithBI = existingRequests.find(
    (r) =>
      !r.memberDeletedAt &&
      (r.status === 'pendente' || r.status === 'em_analise' || r.status === 'aprovado') &&
      normalizeIdentityCardNumber(r.identityCardNumber) === cleanBI
  );
  if (existingRequestWithBI) {
    const statusDesc =
      existingRequestWithBI.status === 'aprovado'
        ? 'já inscrito e validado no clube'
        : existingRequestWithBI.status === 'em_analise'
        ? 'com inscrição em análise pela Secretaria'
        : 'com solicitação de inscrição pendente';
    return {
      duplicate: true,
      source: 'request',
      request: existingRequestWithBI,
      error: `Inscrição não aceite: O nº de Bilhete de Identidade "${identityCardNumber.trim().toUpperCase()}" já consta ${statusDesc} (Protocolo: ${existingRequestWithBI.protocolNumber} · ${existingRequestWithBI.fullName}). Inscrições duplas com o mesmo B.I. não são permitidas.`,
    };
  }

  return { duplicate: false };
}

export function validateEnrollmentSubmission(
  data: MemberRegistrationFormData,
  existingMembers: Member[],
  existingRequests: MemberEnrollmentRequest[]
): { valid: boolean; error?: string; resolvedManualNumber?: string } {
  const fieldsCheck = validateRegistrationFields(data, 'self_enrollment');
  if (!fieldsCheck.valid || !fieldsCheck.resolvedManualNumber) {
    return fieldsCheck;
  }

  const manualNum = fieldsCheck.resolvedManualNumber;
  const cleanName = data.fullName.trim();
  const cleanBI = normalizeIdentityCardNumber(data.identityCardNumber);
  const cleanBirth = data.birthDate.trim();
  const cleanPhone = data.phone.trim();
  const cleanEmail = data.email.trim().toLowerCase();

  // Comparação prioritária de B.I. contra todos os membros registados e inscritos
  const biCheck = findDuplicateEnrollmentByBI(data.identityCardNumber, existingMembers, existingRequests);
  if (biCheck.duplicate) {
    return {
      valid: false,
      error: biCheck.error,
    };
  }

  if (!isMemberNumberUnique(manualNum, existingMembers)) {
    return {
      valid: false,
      error: `O número de matrícula "${manualNum}" já pertence a um membro registado no clube.`,
    };
  }

  const dupMember = findPotentialDuplicateMember(
    cleanBI,
    cleanName,
    cleanBirth,
    existingMembers,
    cleanEmail || undefined,
    cleanPhone
  );
  if (dupMember) {
    return {
      valid: false,
      error: `Já existe um membro registado com estes dados (${dupMember.fullName} · Nº ${dupMember.manualNumber}). Caso precise de atualização, contacte a Secretaria.`,
    };
  }

  const enrolledOrPendingRequests = existingRequests.filter(
    (r) =>
      !r.memberDeletedAt &&
      (r.status === 'pendente' || r.status === 'em_analise' || r.status === 'aprovado')
  );
  const dupRequest = enrolledOrPendingRequests.find((r) => {
    const rBI = normalizeIdentityCardNumber(r.identityCardNumber);
    const rName = String(r.fullName || '').trim().toLowerCase();
    const rManual = String(r.manualNumber || '').trim().toLowerCase();
    const rEmail = String(r.email || '').trim().toLowerCase();
    const rPhone = String(r.phone || '').trim().replace(/\s+/g, '');
    const cleanPhoneCompact = cleanPhone.replace(/\s+/g, '');

    if (rBI && rBI === cleanBI) return true;
    if (rManual && rManual === manualNum.toLowerCase()) return true;
    if (rName === cleanName.toLowerCase() && r.birthDate === cleanBirth) return true;
    if (cleanEmail && rEmail && rEmail === cleanEmail) return true;
    if (cleanPhoneCompact && rPhone && rPhone === cleanPhoneCompact) return true;
    return false;
  });

  if (dupRequest) {
    const faseTexto =
      dupRequest.status === 'aprovado'
        ? 'já validada no clube'
        : dupRequest.status === 'em_analise'
        ? 'em análise pela Secretaria'
        : 'pendente de visualização';
    return {
      valid: false,
      error: `Já existe uma inscrição ${faseTexto} para estes dados (Protocolo: ${dupRequest.protocolNumber}). Inscrições duplicadas não são aceites.`,
    };
  }

  return { valid: true, resolvedManualNumber: manualNum };
}

export function getEnrollmentPhaseInfo(status: MemberEnrollmentRequest['status']): {
  phaseNumber: 1 | 2 | 3;
  label: string;
  shortLabel: string;
  description: string;
} {
  switch (status) {
    case 'pendente':
      return {
        phaseNumber: 1,
        label: 'Pendente',
        shortLabel: 'Pendente',
        description: 'Inscrição submetida, aguardando a visualização da Secretaria.',
      };
    case 'em_analise':
      return {
        phaseNumber: 2,
        label: 'Em análise',
        shortLabel: 'Em análise',
        description: 'A inscrição está a ser analisada pela Secretaria para decidir se é válida ou não.',
      };
    case 'aprovado':
      return {
        phaseNumber: 3,
        label: 'Inscrição validada',
        shortLabel: 'Inscrição validada',
        description: 'Inscrição validada oficialmente. O candidato já consta como membro ativo do clube.',
      };
    case 'rejeitado':
      return {
        phaseNumber: 3,
        label: 'Inscrição Recusada',
        shortLabel: 'Inscrição Recusada',
        description: 'Inscrição recusada após análise. Consulte abaixo o motivo e o responsável pela decisão.',
      };
  }
}

export function startEnrollmentReview(
  req: MemberEnrollmentRequest,
  reviewer: Pick<UserAccount, 'id' | 'name' | 'role'>
): MemberEnrollmentRequest {
  if (req.status !== 'pendente') return req;
  return {
    ...req,
    status: 'em_analise',
    underReviewStartedByUserId: reviewer.id,
    underReviewStartedByName: reviewer.name,
    underReviewStartedByRole: reviewer.role as RoleType,
    underReviewStartedAt: getNowISOString(),
  };
}

export function buildEnrollmentRequest(
  data: MemberRegistrationFormData,
  resolvedManualNumber: string,
  currentYear: number,
  existingRequests: MemberEnrollmentRequest[],
  submittedByUserId?: string
): MemberEnrollmentRequest {
  const protocol = generateNextEnrollmentProtocol(currentYear, existingRequests);
  const now = getNowISOString();
  const guardianName = (data.guardianName || '').trim();
  const guardianPhone = (data.guardianPhone || '').trim();
  const cleanName = data.fullName.trim();
  const cleanPhone = data.phone.trim();

  return {
    id: protocol,
    protocolNumber: protocol,
    manualNumber: resolvedManualNumber,
    fullName: cleanName,
    birthDate: data.birthDate,
    gender: data.gender,
    identityCardNumber: normalizeIdentityCardNumber(data.identityCardNumber),
    phone: cleanPhone,
    email: data.email.trim(),
    address: data.address.trim(),
    category: data.category,
    // Na inscrição direta no clube, candidatos não escolhem equipa (definida na autorização pela Secretaria)
    unitOrTeam: undefined,
    guardianName: guardianName || undefined,
    guardianPhone: guardianPhone || undefined,
    emergencyContact: {
      name: (data.emergencyName || '').trim() || guardianName || cleanName,
      relationship:
        (data.emergencyRelationship || '').trim() ||
        (guardianName ? 'Encarregado de Educação' : 'Contacto Próprio'),
      phone: (data.emergencyPhone || '').trim() || guardianPhone || cleanPhone,
      phoneVerified: false,
    },
    bloodType: (data.bloodType || '').trim() || undefined,
    allergiesOrMedicalNotes: data.allergiesOrMedicalNotes.trim(),
    investitureDate:
      data.category === 'embaixador' || data.category === 'lider'
        ? (data.investitureDate || '').trim() || undefined
        : undefined,
    professionalCourse: (data.professionalCourse || '').trim() || undefined,
    joinedDate: undefined,
    documentDeliveryMethod:
      data.documentDeliveryMethod === 'anexar_digital' ? 'anexar_digital' : 'presencial',
    biDocumentFileName:
      data.documentDeliveryMethod === 'anexar_digital'
        ? (data.biDocumentFileName || '').trim() || undefined
        : undefined,
    biDocumentBase64:
      data.documentDeliveryMethod === 'anexar_digital'
        ? (data.biDocumentBase64 || '').trim() || undefined
        : undefined,
    photoDocumentFileName:
      data.documentDeliveryMethod === 'anexar_digital'
        ? (data.photoDocumentFileName || '').trim() || undefined
        : undefined,
    photoDocumentBase64:
      data.documentDeliveryMethod === 'anexar_digital'
        ? (data.photoDocumentBase64 || '').trim() || undefined
        : undefined,
    status: 'pendente',
    submittedAt: now,
    submittedByUserId,
  };
}

export function resolveMemberDocumentationStatus(
  member?: Pick<Member, 'documentationStatus'>
): MemberDocumentationStatus {
  return member?.documentationStatus === 'falta_documento' ? 'falta_documento' : 'regularizado';
}

export function buildApprovedMemberFromEnrollment(
  req: MemberEnrollmentRequest,
  existingMembers: Member[],
  currentYear: number,
  overrides?: {
    manualNumber?: string;
    category?: MemberCategory;
    unitOrTeam?: string;
    documentationStatus?: MemberDocumentationStatus;
    missingDocumentsNote?: string;
    updatedByName?: string;
    updatedByRole?: RoleType;
  }
): { success: boolean; member?: Member; error?: string } {
  const finalManualNumber = (overrides?.manualNumber ?? req.manualNumber).trim();
  const finalCategory = overrides?.category ?? req.category;
  const finalUnit =
    overrides?.unitOrTeam !== undefined ? overrides.unitOrTeam.trim() || undefined : req.unitOrTeam;

  if (!finalManualNumber) {
    return { success: false, error: 'O Número de Matrícula do membro é obrigatório.' };
  }

  if (!isMemberNumberUnique(finalManualNumber, existingMembers)) {
    return {
      success: false,
      error: `O número de matrícula "${finalManualNumber}" já existe no cadastro de membros.`,
    };
  }

  const dup = findPotentialDuplicateMember(
    req.identityCardNumber,
    req.fullName,
    req.birthDate,
    existingMembers,
    req.email,
    req.phone
  );
  if (dup) {
    return {
      success: false,
      error: `Detetado membro já existente com os mesmos dados (${dup.fullName} · ID: ${dup.id}).`,
    };
  }

  const now = getNowISOString();
  const newId = generateNextMemberId(existingMembers);

  const defaultDocStatus: MemberDocumentationStatus =
    overrides?.documentationStatus ??
    (req.documentDeliveryMethod === 'presencial' ? 'falta_documento' : 'regularizado');
  const resolvedMissingNote =
    defaultDocStatus === 'falta_documento'
      ? (overrides?.missingDocumentsNote || '').trim() ||
        'Entrega presencial de documentos (B.I. e Fotografia) pendente na Secretaria'
      : undefined;

  const rawMember: Member = {
    id: newId,
    manualNumber: finalManualNumber,
    fullName: req.fullName,
    birthDate: req.birthDate,
    gender: req.gender,
    identityCardNumber: req.identityCardNumber,
    phone: req.phone,
    email: req.email,
    address: req.address,
    category: finalCategory,
    unitOrTeam: finalUnit,
    guardianName: (req.guardianName || '').trim() || undefined,
    guardianPhone: (req.guardianPhone || '').trim() || undefined,
    guardianValidated: Boolean((req.guardianName || '').trim()),
    emergencyContact: req.emergencyContact,
    bloodType: (req.bloodType || '').trim() || undefined,
    allergiesOrMedicalNotes: req.allergiesOrMedicalNotes,
    joinedDate: req.joinedDate || getTodayISODate(),
    annualRenewalYear: currentYear,
    status: 'ativo',
    investitureDate:
      finalCategory === 'embaixador' || finalCategory === 'lider' ? req.investitureDate : undefined,
    professionalCourse: req.professionalCourse,
    photoUrl: req.photoDocumentBase64?.startsWith('data:image/') ? req.photoDocumentBase64 : undefined,
    biDocumentFileName: req.biDocumentFileName,
    biDocumentBase64: req.biDocumentBase64,
    photoDocumentFileName: req.photoDocumentFileName,
    photoDocumentBase64: req.photoDocumentBase64,
    documentationStatus: defaultDocStatus,
    missingDocumentsNote: resolvedMissingNote,
    documentationUpdatedAt: overrides?.updatedByName ? now : req.reviewedAt || now,
    documentationUpdatedByName: overrides?.updatedByName || req.reviewedByName,
    documentationUpdatedByRole: overrides?.updatedByRole || req.reviewedByRole,
    enrollmentProtocol: req.protocolNumber,
    createdAt: now,
    updatedAt: now,
  };

  const { sanitized } = sanitizeMemberIntegrity(rawMember);
  return { success: true, member: sanitized };
}

/**
 * Elimina definitivamente as fichas/solicitações de inscrição associadas a um membro eliminado,
 * garantindo que não permaneçam no histórico de inscrições nem impeçam uma nova inscrição ou registo futuro.
 */
export function removeEnrollmentRequestsForDeletedMember(
  enrollmentRequests: MemberEnrollmentRequest[] | undefined,
  deletedMember: Pick<
    Member,
    'id' | 'manualNumber' | 'identityCardNumber' | 'enrollmentProtocol' | 'email' | 'fullName' | 'birthDate'
  >
): {
  updatedEnrollmentRequests: MemberEnrollmentRequest[];
  removedRequests: MemberEnrollmentRequest[];
} {
  if (!Array.isArray(enrollmentRequests) || enrollmentRequests.length === 0) {
    return { updatedEnrollmentRequests: [], removedRequests: [] };
  }

  const cleanDeletedId = String(deletedMember.id || '').trim();
  const cleanDeletedProtocol = String(deletedMember.enrollmentProtocol || '').trim();
  const cleanDeletedBI = normalizeIdentityCardNumber(deletedMember.identityCardNumber);
  const cleanDeletedManual = String(deletedMember.manualNumber || '').trim().toLowerCase();
  const cleanDeletedEmail = String(deletedMember.email || '').trim().toLowerCase();
  const cleanDeletedName = String(deletedMember.fullName || '').trim().toLowerCase();
  const cleanDeletedBirth = String(deletedMember.birthDate || '').trim();

  const updatedEnrollmentRequests: MemberEnrollmentRequest[] = [];
  const removedRequests: MemberEnrollmentRequest[] = [];

  for (const req of enrollmentRequests) {
    if (!req) continue;

    const matchesCreatedId = Boolean(cleanDeletedId && req.createdMemberId === cleanDeletedId);
    const matchesProtocol = Boolean(cleanDeletedProtocol && req.protocolNumber === cleanDeletedProtocol);
    const matchesBI = Boolean(
      cleanDeletedBI && normalizeIdentityCardNumber(req.identityCardNumber) === cleanDeletedBI
    );
    const matchesManual = Boolean(
      cleanDeletedManual && String(req.manualNumber || '').trim().toLowerCase() === cleanDeletedManual
    );
    const matchesEmail = Boolean(
      cleanDeletedEmail && String(req.email || '').trim().toLowerCase() === cleanDeletedEmail
    );
    const matchesNameAndBirth = Boolean(
      cleanDeletedName &&
        cleanDeletedBirth &&
        String(req.fullName || '').trim().toLowerCase() === cleanDeletedName &&
        String(req.birthDate || '').trim() === cleanDeletedBirth
    );

    if (
      matchesCreatedId ||
      matchesProtocol ||
      matchesBI ||
      matchesManual ||
      matchesEmail ||
      matchesNameAndBirth
    ) {
      removedRequests.push(req);
    } else {
      updatedEnrollmentRequests.push(req);
    }
  }

  return { updatedEnrollmentRequests, removedRequests };
}

/**
 * Assinala nas solicitações de inscrição associadas que a respetiva ficha de membro
 * foi definitivamente eliminada, impedindo que futuras reconciliações na nuvem a recriem.
 */
export function markDeletedMemberInEnrollments(
  enrollmentRequests: MemberEnrollmentRequest[] | undefined,
  deletedMember: Pick<Member, 'id' | 'manualNumber' | 'identityCardNumber' | 'enrollmentProtocol'>,
  actor: Pick<UserAccount, 'id' | 'name'>,
  deletedAt: string = getNowISOString()
): MemberEnrollmentRequest[] {
  if (!Array.isArray(enrollmentRequests) || enrollmentRequests.length === 0) {
    return [];
  }

  const cleanDeletedId = String(deletedMember.id || '').trim();
  const cleanDeletedProtocol = String(deletedMember.enrollmentProtocol || '').trim();
  const cleanDeletedBI = normalizeIdentityCardNumber(deletedMember.identityCardNumber);
  const cleanDeletedManual = String(deletedMember.manualNumber || '').trim().toLowerCase();

  return enrollmentRequests.map((req) => {
    if (!req) return req;
    const matchesCreatedId = Boolean(cleanDeletedId && req.createdMemberId === cleanDeletedId);
    const matchesProtocol = Boolean(cleanDeletedProtocol && req.protocolNumber === cleanDeletedProtocol);
    const matchesApprovedIdentity =
      req.status === 'aprovado' &&
      !req.memberDeletedAt &&
      ((Boolean(cleanDeletedBI) && normalizeIdentityCardNumber(req.identityCardNumber) === cleanDeletedBI) ||
        (Boolean(cleanDeletedManual) && String(req.manualNumber || '').trim().toLowerCase() === cleanDeletedManual));

    if (!matchesCreatedId && !matchesProtocol && !matchesApprovedIdentity) {
      return req;
    }

    return {
      ...req,
      memberDeletedAt: deletedAt,
      memberDeletedByUserId: actor.id,
      memberDeletedByName: actor.name,
    };
  });
}

/**
 * Reconcilia automaticamente todas as inscrições já validadas/aceites ("aprovado")
 * garantindo que estejam registadas na Secretaria ("Fichas de Membros") sem duplicação
 * e NUNCA ressuscitando fichas que já foram eliminadas (diretamente ou por autorização).
 */
export function reconcileApprovedEnrollmentsWithMembers(
  members: Member[],
  enrollmentRequests: MemberEnrollmentRequest[],
  currentYear: number,
  deletionRequests: DeletionRequest[] = [],
  auditLogs: AuditLogEntry[] = []
): {
  members: Member[];
  enrollmentRequests: MemberEnrollmentRequest[];
  autoRegisteredCount: number;
  hasChanges: boolean;
} {
  if (!Array.isArray(enrollmentRequests) || enrollmentRequests.length === 0) {
    return {
      members,
      enrollmentRequests: [],
      autoRegisteredCount: 0,
      hasChanges: false,
    };
  }

  const executedDeletions = (deletionRequests || []).filter(
    (d) => d.status === 'executado' && d.operationType === 'eliminacao'
  );

  const deletionAuditEntries = (auditLogs || []).filter(
    (a) => a && (a.action === 'ELIMINACAO_MEMBRO' || a.action === 'ELIMINACAO_MEMBRO_EXECUTADA')
  );

  let nextMembers = [...members];
  let autoRegisteredCount = 0;
  let hasChanges = false;

  const nextRequests = enrollmentRequests.map((req) => {
    if (!req || req.status !== 'aprovado') return req;

    // Nunca ressuscita uma inscrição cuja ficha de membro já foi assinalada como eliminada
    if (req.memberDeletedAt) {
      return req;
    }

    const reqRefTime = String(req.reviewedAt || req.submittedAt || '');
    const cleanReqBI = normalizeIdentityCardNumber(req.identityCardNumber);
    const cleanReqManual = String(req.manualNumber || '').trim().toLowerCase();

    const matchedMember = nextMembers.find(
      (m) =>
        (req.createdMemberId && m.id === req.createdMemberId) ||
        (cleanReqBI && normalizeIdentityCardNumber(m.identityCardNumber) === cleanReqBI) ||
        (cleanReqManual && String(m.manualNumber || '').trim().toLowerCase() === cleanReqManual)
    );

    if (matchedMember) {
      if (req.createdMemberId !== matchedMember.id) {
        hasChanges = true;
        return { ...req, createdMemberId: matchedMember.id };
      }
      return req;
    }

    // Se a inscrição já tinha criado previamente uma ficha (createdMemberId preenchido)
    // e essa ficha deixou de existir em `members`, significa que o membro foi eliminado — nunca recriar.
    if (req.createdMemberId && req.createdMemberId.trim()) {
      return req;
    }

    // Verifica pedidos formais de eliminação executados após esta aprovação
    const deletedInDeletionRequests = executedDeletions.some((d) => {
      const delTime = String(d.executedAt || d.decidedAt || d.requestedAt || '');
      if (reqRefTime && delTime && delTime < reqRefTime) {
        return false;
      }
      const delManual = String(d.targetMemberManualNumber || '').trim().toLowerCase();
      return Boolean(cleanReqManual && delManual && delManual === cleanReqManual);
    });
    if (deletedInDeletionRequests) {
      return req;
    }

    // Salvaguarda adicional para dados legados: verifica auditoria de eliminação posterior à aprovação
    const reqNameLower = String(req.fullName || '').trim().toLowerCase();
    const deletedInAuditAfterApproval = deletionAuditEntries.some((entry) => {
      if (reqRefTime && entry.timestamp && entry.timestamp < reqRefTime) {
        return false;
      }
      const entityNameLower = String(entry.entityName || '').trim().toLowerCase();
      return Boolean(reqNameLower && entityNameLower && entityNameLower === reqNameLower);
    });
    if (deletedInAuditAfterApproval) {
      return req;
    }

    let candidateManual = (req.manualNumber || '').trim() || generateManualNumber(req.identityCardNumber, req.birthDate);
    if (!isMemberNumberUnique(candidateManual, nextMembers)) {
      let suffix = 2;
      while (!isMemberNumberUnique(`${candidateManual}-${suffix}`, nextMembers)) {
        suffix++;
      }
      candidateManual = `${candidateManual}-${suffix}`;
    }

    const built = buildApprovedMemberFromEnrollment(req, nextMembers, currentYear, {
      manualNumber: candidateManual,
    });
    if (built.success && built.member) {
      nextMembers = [built.member, ...nextMembers];
      autoRegisteredCount++;
      hasChanges = true;
      return {
        ...req,
        createdMemberId: built.member.id,
        manualNumber: built.member.manualNumber,
      };
    }

    return req;
  });

  return {
    members: nextMembers,
    enrollmentRequests: nextRequests,
    autoRegisteredCount,
    hasChanges,
  };
}

export function markEnrollmentReviewed(
  req: MemberEnrollmentRequest,
  status: 'aprovado' | 'rejeitado',
  reviewer: Pick<UserAccount, 'id' | 'name' | 'role'>,
  options?: {
    reason?: string;
    createdMemberId?: string;
    manualNumber?: string;
    category?: MemberCategory;
    unitOrTeam?: string;
  }
): MemberEnrollmentRequest {
  return {
    ...req,
    manualNumber: options?.manualNumber ?? req.manualNumber,
    category: options?.category ?? req.category,
    unitOrTeam: options?.unitOrTeam !== undefined ? options.unitOrTeam || undefined : req.unitOrTeam,
    status,
    underReviewStartedByUserId: req.underReviewStartedByUserId || reviewer.id,
    underReviewStartedByName: req.underReviewStartedByName || reviewer.name,
    underReviewStartedByRole: req.underReviewStartedByRole || (reviewer.role as RoleType),
    underReviewStartedAt: req.underReviewStartedAt || getNowISOString(),
    reviewedByUserId: reviewer.id,
    reviewedByName: reviewer.name,
    reviewedByRole: reviewer.role as RoleType,
    reviewedAt: getNowISOString(),
    decisionReason: options?.reason?.trim() || undefined,
    createdMemberId: options?.createdMemberId,
  };
}

export function lookupEnrollmentStatusByIdentity(
  requests: MemberEnrollmentRequest[],
  identityCardNumber: string,
  birthDate: string
): MemberEnrollmentRequest | undefined {
  const cleanBI = normalizeIdentityCardNumber(identityCardNumber);
  const cleanBirth = (birthDate || '').trim();
  if (!cleanBI || !cleanBirth) return undefined;

  const matches = requests.filter(
    (r) =>
      normalizeIdentityCardNumber(r.identityCardNumber) === cleanBI &&
      String(r.birthDate || '').trim() === cleanBirth
  );
  if (matches.length === 0) return undefined;

  return [...matches].sort((a, b) =>
    String(b.submittedAt || '').localeCompare(String(a.submittedAt || ''))
  )[0];
}

export interface UnifiedEnrollmentLookupResult {
  kind: 'registered_member' | 'enrollment_request';
  member?: Member;
  request?: MemberEnrollmentRequest;
  documentationStatus?: MemberDocumentationStatus;
  missingDocumentsNote?: string;
}

/**
 * Consulta unificada do Estado de Inscrição e Situação Documental:
 * - Para membros já registados (inscrição validada automaticamente ou registo direto da Secretaria),
 *   mostra o estado oficial de registo e se está Regularizado ou em Falta de Documento.
 * - Para candidatos com inscrição em curso ou recusada, mostra as 3 fases da solicitação.
 */
export function lookupMemberOrEnrollmentStatus(
  members: Member[],
  requests: MemberEnrollmentRequest[],
  identityCardOrManualNumber: string,
  birthDate: string
): UnifiedEnrollmentLookupResult | undefined {
  const rawIdentifier = String(identityCardOrManualNumber || '').trim();
  const cleanBI = normalizeIdentityCardNumber(rawIdentifier);
  const cleanManual = rawIdentifier.toUpperCase();
  const cleanBirth = (birthDate || '').trim();
  if (!cleanBI || !cleanBirth) return undefined;

  const matchedRequest = lookupEnrollmentStatusByIdentity(requests || [], cleanBI, cleanBirth);

  const matchedMember = (members || []).find((m) => {
    if (!m) return false;
    const sameBirth = String(m.birthDate || '').trim() === cleanBirth;
    if (!sameBirth) return false;
    const mBI = normalizeIdentityCardNumber(m.identityCardNumber);
    const mManual = String(m.manualNumber || '').trim().toUpperCase();
    return (mBI && mBI === cleanBI) || (mManual && mManual === cleanManual);
  });

  if (matchedMember) {
    return {
      kind: 'registered_member',
      member: matchedMember,
      request: matchedRequest,
      documentationStatus: resolveMemberDocumentationStatus(matchedMember),
      missingDocumentsNote: matchedMember.missingDocumentsNote,
    };
  }

  if (matchedRequest) {
    return {
      kind: 'enrollment_request',
      request: matchedRequest,
    };
  }

  return undefined;
}

export function getLocalTodayDateString(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getLocalCurrentTimeString(now: Date = new Date()): string {
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

export function parseEnrollmentLocalDateTime(
  dateStr?: string,
  timeStr?: string,
  defaultTime: string = '00:00',
  defaultSeconds: number = 0
): Date | null {
  const cleanDate = String(dateStr || '').trim();
  if (!cleanDate) return null;

  const dateMatch = cleanDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const cleanTime = String(timeStr || '').trim() || defaultTime;
  const timeMatch = cleanTime.match(/^(\d{2}):(\d{2})$/);
  if (!timeMatch) return null;

  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  const parsed = new Date(year, month - 1, day, hours, minutes, defaultSeconds, 0);
  if (
    isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function formatScheduleDateTimeLabel(
  dateStr?: string,
  timeStr?: string,
  fallbackTime: string = '00:00'
): string {
  const cleanDate = String(dateStr || '').trim();
  if (!cleanDate) return '-';
  const parts = cleanDate.split('-');
  const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : cleanDate;
  const formattedTime = String(timeStr || '').trim() || fallbackTime;
  return `${formattedDate} às ${formattedTime}`;
}

export function validateEnrollmentScheduleInput(
  input: {
    openDate?: string;
    openTime?: string;
    closeDate?: string;
    closeTime?: string;
  },
  now: Date = new Date()
): {
  valid: boolean;
  error?: string;
  normalized?: {
    openDate?: string;
    openTime?: string;
    closeDate?: string;
    closeTime?: string;
  };
} {
  const cleanOpenDate = String(input.openDate || '').trim();
  const cleanOpenTime = String(input.openTime || '').trim();
  const cleanCloseDate = String(input.closeDate || '').trim();
  const cleanCloseTime = String(input.closeTime || '').trim();

  if (cleanOpenTime && !cleanOpenDate) {
    return { valid: false, error: 'Indique a data de abertura para o horário de abertura estipulado.' };
  }
  if (cleanCloseTime && !cleanCloseDate) {
    return { valid: false, error: 'Indique a data de encerramento para o horário de encerramento estipulado.' };
  }

  let openAt: Date | null = null;
  let closeAt: Date | null = null;

  if (cleanOpenDate) {
    openAt = parseEnrollmentLocalDateTime(cleanOpenDate, cleanOpenTime || '00:00', '00:00', 0);
    if (!openAt) {
      return { valid: false, error: 'Data ou horário de abertura inválido.' };
    }
  }

  if (cleanCloseDate) {
    closeAt = parseEnrollmentLocalDateTime(
      cleanCloseDate,
      cleanCloseTime || '23:59',
      '23:59',
      cleanCloseTime ? 0 : 59
    );
    if (!closeAt) {
      return { valid: false, error: 'Data ou horário de encerramento inválido.' };
    }
    if (closeAt.getTime() <= now.getTime()) {
      return {
        valid: false,
        error: 'A data e o horário de encerramento estipulados devem ser futuros.',
      };
    }
  }

  if (openAt && closeAt && closeAt.getTime() <= openAt.getTime()) {
    return {
      valid: false,
      error: 'A data e o horário de encerramento devem ser posteriores à abertura.',
    };
  }

  return {
    valid: true,
    normalized: {
      openDate: cleanOpenDate || undefined,
      openTime: cleanOpenDate ? cleanOpenTime || '00:00' : undefined,
      closeDate: cleanCloseDate || undefined,
      closeTime: cleanCloseDate ? cleanCloseTime || '23:59' : undefined,
    },
  };
}

export interface EnrollmentAvailabilityStatus {
  isCurrentlyOpen: boolean;
  status: 'abertas' | 'agendadas' | 'encerradas';
  statusLabel: string;
  reasonLabel: string;
  openLabel?: string;
  closeLabel?: string;
  enableReconfirmation: boolean;
  isReconfirmationOpen: boolean;
  periodId?: string;
  finalizedAt?: string;
  finalizationSummary?: EnrollmentScheduleConfig['finalizationSummary'];
}

export function evaluateEnrollmentAvailability(
  config?: EnrollmentScheduleConfig,
  now: Date = new Date()
): EnrollmentAvailabilityStatus {
  if (!config) {
    return {
      isCurrentlyOpen: true,
      status: 'abertas',
      statusLabel: 'Inscrições Abertas',
      reasonLabel: 'As inscrições no clube estão atualmente abertas.',
      enableReconfirmation: false,
      isReconfirmationOpen: false,
    };
  }

  const enableReconfirmation = Boolean(config.enableReconfirmation);
  const periodLabel = enableReconfirmation ? 'Inscrições e Reconfirmação' : 'Inscrições';

  const openLabel = config.openDate
    ? formatScheduleDateTimeLabel(config.openDate, config.openTime, '00:00')
    : undefined;
  const closeLabel = config.closeDate
    ? formatScheduleDateTimeLabel(config.closeDate, config.closeTime, '23:59')
    : undefined;

  if (!config.isOpen) {
    return {
      isCurrentlyOpen: false,
      status: 'encerradas',
      statusLabel: `${periodLabel} Encerradas`,
      reasonLabel: `As ${enableReconfirmation ? 'inscrições e reconfirmações' : 'inscrições'} foram encerradas pela Direção do Clube.`,
      openLabel,
      closeLabel,
      enableReconfirmation,
      isReconfirmationOpen: false,
      periodId: config.periodId,
      finalizedAt: config.finalizedAt,
      finalizationSummary: config.finalizationSummary,
    };
  }

  const openAt = config.openDate
    ? parseEnrollmentLocalDateTime(config.openDate, config.openTime, '00:00', 0)
    : null;
  const closeAt = config.closeDate
    ? parseEnrollmentLocalDateTime(
        config.closeDate,
        config.closeTime,
        '23:59',
        config.closeTime ? 0 : 59
      )
    : null;

  if (openAt && now.getTime() < openAt.getTime()) {
    return {
      isCurrentlyOpen: false,
      status: 'agendadas',
      statusLabel: 'Abertura Agendada',
      reasonLabel: `${periodLabel} abrirão em ${openLabel}${closeLabel ? ` e encerram em ${closeLabel}` : ''}.`,
      openLabel,
      closeLabel,
      enableReconfirmation,
      isReconfirmationOpen: false,
      periodId: config.periodId,
      finalizedAt: config.finalizedAt,
      finalizationSummary: config.finalizationSummary,
    };
  }

  if (closeAt && now.getTime() >= closeAt.getTime()) {
    return {
      isCurrentlyOpen: false,
      status: 'encerradas',
      statusLabel: `${periodLabel} Encerradas`,
      reasonLabel: `O período estipulado de ${enableReconfirmation ? 'inscrições e reconfirmação' : 'inscrições'} encerrou em ${closeLabel}.`,
      openLabel,
      closeLabel,
      enableReconfirmation,
      isReconfirmationOpen: false,
      periodId: config.periodId,
      finalizedAt: config.finalizedAt,
      finalizationSummary: config.finalizationSummary,
    };
  }

  return {
    isCurrentlyOpen: true,
    status: 'abertas',
    statusLabel: `${periodLabel} Abertas`,
    reasonLabel: closeLabel
      ? `${periodLabel} abertas até ${closeLabel}.`
      : `As ${enableReconfirmation ? 'inscrições e reconfirmações de dados' : 'inscrições'} no clube estão atualmente abertas.`,
    openLabel,
    closeLabel,
    enableReconfirmation,
    isReconfirmationOpen: enableReconfirmation,
    periodId: config.periodId,
    finalizedAt: config.finalizedAt,
    finalizationSummary: config.finalizationSummary,
  };
}

export interface MemberReconfirmationInput {
  fullName: string;
  birthDate: string;
  gender: 'M' | 'F';
  identityCardNumber: string;
  phone: string;
  email: string;
  address: string;
  guardianName?: string;
  guardianPhone?: string;
  emergencyName?: string;
  emergencyRelationship?: string;
  emergencyPhone?: string;
  bloodType?: string;
  allergiesOrMedicalNotes: string;
  investitureDate?: string;
  professionalCourse?: string;
  biDocumentFileName?: string;
  biDocumentBase64?: string;
  photoDocumentFileName?: string;
  photoDocumentBase64?: string;
  newAttachedDocuments?: Array<{
    title: string;
    fileName: string;
    base64: string;
  }>;
}

export function findMemberForReconfirmation(
  members: Member[],
  identityCardOrManualNumber: string,
  birthDate: string
):
  | { found: true; member: Member }
  | { found: false; archived?: boolean; error: string } {
  const rawIdentifier = String(identityCardOrManualNumber || '').trim();
  const cleanBI = normalizeIdentityCardNumber(rawIdentifier);
  const cleanManual = rawIdentifier.toUpperCase();
  const cleanBirth = String(birthDate || '').trim();

  if (!cleanBI || !cleanBirth) {
    return {
      found: false,
      error: 'Informe o Número do B.I. (ou Nº de Matrícula) e a Data de Nascimento para localizar o seu registo.',
    };
  }

  const matched = (members || []).find((m) => {
    if (!m) return false;
    if (String(m.birthDate || '').trim() !== cleanBirth) return false;
    const mBI = normalizeIdentityCardNumber(m.identityCardNumber);
    const mManual = String(m.manualNumber || '').trim().toUpperCase();
    return (Boolean(mBI) && mBI === cleanBI) || (Boolean(mManual) && mManual === cleanManual);
  });

  if (!matched) {
    return {
      found: false,
      error: 'Nenhum membro registado foi encontrado com este B.I./Matrícula e Data de Nascimento.',
    };
  }

  if (matched.status === 'arquivado') {
    return {
      found: false,
      archived: true,
      error: 'A sua ficha de membro encontra-se arquivada. Contacte a Secretaria ou a Direção para regularização antes de reconfirmar.',
    };
  }

  if (matched.status === 'transferido') {
    return {
      found: false,
      error: 'A sua ficha encontra-se com estado Transferido e não está elegível para reconfirmação.',
    };
  }

  return { found: true, member: matched };
}

export function applyMemberReconfirmation(params: {
  member: Member;
  existingMembers: Member[];
  data: MemberReconfirmationInput;
  periodId?: string;
  users: UserAccount[];
  nowISO?: string;
}): {
  success: boolean;
  error?: string;
  updatedMember?: Member;
  updatedUsers?: UserAccount[];
} {
  const { member, existingMembers, data, periodId, users } = params;
  const nowISO = params.nowISO || getNowISOString();

  if (!member || member.status === 'arquivado' || member.status === 'transferido') {
    return {
      success: false,
      error: 'Apenas membros registados ativos ou inativos não arquivados podem realizar reconfirmação.',
    };
  }

  const cleanName = (data.fullName || '').trim();
  const cleanBirth = (data.birthDate || '').trim();
  const cleanBI = normalizeIdentityCardNumber(data.identityCardNumber);
  const cleanPhone = (data.phone || '').trim();
  const cleanEmail = (data.email || '').trim().toLowerCase();
  const cleanAddress = (data.address || '').trim();
  const cleanMedical = (data.allergiesOrMedicalNotes || '').trim();
  const cleanInvestiture = (data.investitureDate || '').trim();
  const cleanGuardianName = (data.guardianName || '').trim();
  const cleanGuardianPhone = (data.guardianPhone || '').trim();

  if (cleanName.length < 3) {
    return { success: false, error: 'O Nome Completo é obrigatório (mínimo 3 caracteres).' };
  }
  if (!cleanBirth) {
    return { success: false, error: 'A Data de Nascimento é obrigatória.' };
  }
  if (data.gender !== 'M' && data.gender !== 'F') {
    return { success: false, error: 'O Sexo é obrigatório.' };
  }
  if (!cleanBI) {
    return { success: false, error: 'O Número do Bilhete de Identidade (B.I.) é obrigatório.' };
  }
  if (!cleanPhone) {
    return { success: false, error: 'O Telefone Principal é obrigatório.' };
  }
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { success: false, error: 'Informe um endereço de E-mail válido.' };
  }
  if (!cleanAddress) {
    return { success: false, error: 'O Município / Bairro é obrigatório.' };
  }
  if (!cleanMedical) {
    return {
      success: false,
      error: 'O campo Alergias ou Cuidados Médicos é obrigatório (caso não possua, indique "Nenhuma").',
    };
  }
  if ((member.category === 'embaixador' || member.category === 'lider') && !cleanInvestiture) {
    return {
      success: false,
      error: `A Data Oficial de Investidura é obrigatória para a categoria ${member.category === 'lider' ? 'Líder' : 'Embaixador'}.`,
    };
  }

  // Garante unicidade do B.I. e do E-mail entre outros membros existentes
  const duplicateBI = (existingMembers || []).find(
    (other) => other.id !== member.id && normalizeIdentityCardNumber(other.identityCardNumber) === cleanBI
  );
  if (duplicateBI) {
    return {
      success: false,
      error: `O B.I. "${cleanBI}" já está associado a outro membro (${duplicateBI.fullName}).`,
    };
  }

  const nextBiBase64 = (data.biDocumentBase64 || '').trim() || member.biDocumentBase64;
  const nextBiFileName = (data.biDocumentBase64 || '').trim()
    ? (data.biDocumentFileName || '').trim() || member.biDocumentFileName
    : member.biDocumentFileName;

  const nextPhotoBase64 = (data.photoDocumentBase64 || '').trim() || member.photoDocumentBase64;
  const nextPhotoFileName = (data.photoDocumentBase64 || '').trim()
    ? (data.photoDocumentFileName || '').trim() || member.photoDocumentFileName
    : member.photoDocumentFileName;

  const nextPhotoUrl = (data.photoDocumentBase64 || '').trim().startsWith('data:image/')
    ? (data.photoDocumentBase64 || '').trim()
    : member.photoUrl || (nextPhotoBase64?.startsWith('data:image/') ? nextPhotoBase64 : undefined);

  const appendedAttachments: MemberAttachedDocument[] = (data.newAttachedDocuments || [])
    .filter((docItem) => Boolean(docItem?.base64?.trim() && docItem?.fileName?.trim()))
    .map((docItem, idx) => ({
      id: `DOC-REC-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      title: (docItem.title || '').trim() || docItem.fileName.trim(),
      fileName: docItem.fileName.trim(),
      base64: docItem.base64.trim(),
      uploadedAt: nowISO,
      uploadedByName: cleanName,
    }));

  const mergedAttachments: MemberAttachedDocument[] | undefined =
    appendedAttachments.length > 0 || (member.attachedDocuments && member.attachedDocuments.length > 0)
      ? [...(member.attachedDocuments || []), ...appendedAttachments]
      : undefined;

  const currentYear = new Date(nowISO).getFullYear();
  const isAlreadyReconfirmedThisPeriod = Boolean(periodId && member.lastReconfirmedPeriodId === periodId);

  const mergedMember: Member = {
    ...member,
    fullName: cleanName,
    birthDate: cleanBirth,
    gender: data.gender,
    identityCardNumber: cleanBI,
    phone: cleanPhone,
    email: cleanEmail,
    address: cleanAddress,
    guardianName: cleanGuardianName || undefined,
    guardianPhone: cleanGuardianPhone || undefined,
    guardianValidated: cleanGuardianName ? Boolean(cleanGuardianPhone) : member.guardianValidated,
    emergencyContact: {
      name: (data.emergencyName || '').trim() || member.emergencyContact?.name || cleanGuardianName || cleanName,
      relationship:
        (data.emergencyRelationship || '').trim() ||
        member.emergencyContact?.relationship ||
        (cleanGuardianName ? 'Encarregado de Educação' : 'Familiar'),
      phone: (data.emergencyPhone || '').trim() || member.emergencyContact?.phone || cleanGuardianPhone || cleanPhone,
      phoneVerified: member.emergencyContact?.phoneVerified || false,
    },
    bloodType: (data.bloodType || '').trim() || undefined,
    allergiesOrMedicalNotes: cleanMedical,
    professionalCourse: (data.professionalCourse || '').trim() || undefined,
    investitureDate:
      member.category === 'embaixador' || member.category === 'lider' ? cleanInvestiture : member.investitureDate,
    biDocumentFileName: nextBiFileName,
    biDocumentBase64: nextBiBase64,
    photoDocumentFileName: nextPhotoFileName,
    photoDocumentBase64: nextPhotoBase64,
    photoUrl: nextPhotoUrl,
    attachedDocuments: mergedAttachments,
    status: 'ativo',
    annualRenewalYear: Math.max(member.annualRenewalYear || 0, Number.isFinite(currentYear) ? currentYear : 2026),
    lastReconfirmedPeriodId: periodId || member.lastReconfirmedPeriodId,
    lastReconfirmedAt: nowISO,
    reconfirmationCount: (member.reconfirmationCount || 0) + (isAlreadyReconfirmedThisPeriod ? 0 : 1),
    updatedAt: nowISO,
  };

  const { sanitized } = sanitizeMemberIntegrity(mergedMember);
  const syncedUsers = syncMemberChangesToUsers(sanitized, users || [], member);
  const updatedUsers = syncedUsers.map((u) => {
    if (
      u.linkedMemberId === sanitized.id &&
      !isPendingMemberAccountConfirmation(u) &&
      u.accountApprovalStatus !== 'rejeitada'
    ) {
      const { deactivatedByArchive: _removed, ...rest } = u;
      return { ...rest, active: true };
    }
    return u;
  });

  return {
    success: true,
    updatedMember: sanitized,
    updatedUsers,
  };
}

export function isValidMemberFichaForActiveStatus(member: Member | undefined | null): boolean {
  if (!member) return false;
  return (
    String(member.id || '').trim().length > 0 &&
    String(member.manualNumber || '').trim().length > 0 &&
    String(member.fullName || '').trim().length >= 2 &&
    String(member.identityCardNumber || '').trim().length > 0 &&
    String(member.birthDate || '').trim().length > 0
  );
}

export interface PeriodFinalizationResult {
  hasChanges: boolean;
  members: Member[];
  config?: EnrollmentScheduleConfig;
  summary?: {
    activatedCount: number;
    archivedCount: number;
    keptActiveCount: number;
    exemptedCount: number;
  };
}

/**
 * Liquidação automática após o fim do período de inscrições e reconfirmação:
 * - Mantém ou define como 'ativo':
 *   1) Membros com ficha válida que passaram na inscrição neste período; ou
 *   2) Membros registados que realizaram a reconfirmação de dados neste período.
 * - Define como 'inativo':
 *   Membros registados (ativos/inativos) com ficha anterior que NÃO realizaram a reconfirmação no período.
 * - Preserva membros 'arquivado' e 'transferido' sem alteração.
 */
export function finalizeEndedEnrollmentPeriod(params: {
  members: Member[];
  enrollmentRequests?: MemberEnrollmentRequest[];
  config?: EnrollmentScheduleConfig;
  now?: Date;
}): PeriodFinalizationResult {
  const { members, enrollmentRequests = [], config } = params;
  const now = params.now || new Date();

  if (!config || !config.enableReconfirmation || !config.periodId) {
    return { hasChanges: false, members, config };
  }

  if (config.finalizedPeriodId === config.periodId) {
    return { hasChanges: false, members, config };
  }

  const availability = evaluateEnrollmentAvailability(config, now);
  if (availability.status !== 'encerradas') {
    return { hasChanges: false, members, config };
  }

  const nowISO = now.toISOString();
  const openedAtMs = config.openedAt ? Date.parse(config.openedAt) : NaN;

  const approvedInPeriodMemberIds = new Set<string>();
  const approvedInPeriodProtocols = new Set<string>();

  for (const req of enrollmentRequests) {
    if (!req || req.status !== 'aprovado' || req.memberDeletedAt) continue;
    const reviewedMs = req.reviewedAt ? Date.parse(req.reviewedAt) : NaN;
    if (Number.isFinite(openedAtMs) && Number.isFinite(reviewedMs) && reviewedMs >= openedAtMs) {
      if (req.createdMemberId) approvedInPeriodMemberIds.add(req.createdMemberId);
      if (req.protocolNumber) approvedInPeriodProtocols.add(req.protocolNumber);
    }
  }

  let activatedCount = 0;
  let archivedCount = 0;
  let keptActiveCount = 0;
  let exemptedCount = 0;

  const nextMembers = (members || []).map((m) => {
    if (m.status === 'arquivado' || m.status === 'transferido') {
      exemptedCount++;
      return m;
    }

    const validFicha = isValidMemberFichaForActiveStatus(m);
    const createdMs = m.createdAt ? Date.parse(m.createdAt) : NaN;
    const enrolledInThisPeriod =
      m.enrolledPeriodId === config.periodId ||
      approvedInPeriodMemberIds.has(m.id) ||
      (Boolean(m.enrollmentProtocol) && approvedInPeriodProtocols.has(m.enrollmentProtocol!)) ||
      (Number.isFinite(openedAtMs) && Number.isFinite(createdMs) && createdMs >= openedAtMs);

    const reconfirmedInThisPeriod = m.lastReconfirmedPeriodId === config.periodId;

    if (validFicha && (reconfirmedInThisPeriod || enrolledInThisPeriod)) {
      if (m.status !== 'ativo') {
        activatedCount++;
        return { ...m, status: 'ativo' as const, updatedAt: nowISO };
      }
      keptActiveCount++;
      return m;
    }

    archivedCount++;
    return {
      ...m,
      status: 'arquivado' as const,
      archiveReason: 'Não efetuou a reconfirmação obrigatória de dados no período estipulado',
      archivedAt: nowISO,
      updatedAt: nowISO,
    };
    return m;
  });

  const summary = {
    activatedCount,
    archivedCount,
    keptActiveCount,
    exemptedCount,
  };

  const nextConfig: EnrollmentScheduleConfig = {
    ...config,
    isOpen: false,
    finalizedPeriodId: config.periodId,
    finalizedAt: nowISO,
    finalizationSummary: summary,
  };

  return {
    hasChanges: true,
    members: nextMembers,
    config: nextConfig,
    summary,
  };
}

export function buildResubmittedEnrollmentRequest(
  rejectedReq: MemberEnrollmentRequest,
  data: MemberRegistrationFormData,
  resolvedManualNumber: string,
  currentYear: number,
  existingRequests: MemberEnrollmentRequest[],
  submittedByUserId?: string
): MemberEnrollmentRequest {
  const newProtocol = generateNextEnrollmentProtocol(currentYear, existingRequests);
  const now = getNowISOString();
  const guardianName = (data.guardianName || '').trim();
  const guardianPhone = (data.guardianPhone || '').trim();
  const cleanName = data.fullName.trim();
  const cleanPhone = data.phone.trim();

  const hasNewBiDoc = Boolean((data.biDocumentBase64 || '').trim() && (data.biDocumentFileName || '').trim());
  const hasNewPhotoDoc = Boolean((data.photoDocumentBase64 || '').trim() && (data.photoDocumentFileName || '').trim());

  return {
    id: newProtocol,
    protocolNumber: newProtocol,
    manualNumber: resolvedManualNumber,
    fullName: cleanName,
    birthDate: data.birthDate,
    gender: data.gender,
    identityCardNumber: normalizeIdentityCardNumber(data.identityCardNumber),
    phone: cleanPhone,
    email: data.email.trim(),
    address: data.address.trim(),
    category: data.category,
    unitOrTeam: undefined,
    guardianName: guardianName || undefined,
    guardianPhone: guardianPhone || undefined,
    emergencyContact: {
      name: (data.emergencyName || '').trim() || guardianName || cleanName,
      relationship:
        (data.emergencyRelationship || '').trim() ||
        (guardianName ? 'Encarregado de Educação' : 'Contacto Próprio'),
      phone: (data.emergencyPhone || '').trim() || guardianPhone || cleanPhone,
      phoneVerified: false,
    },
    bloodType: (data.bloodType || '').trim() || undefined,
    allergiesOrMedicalNotes: data.allergiesOrMedicalNotes.trim(),
    investitureDate:
      data.category === 'embaixador' || data.category === 'lider'
        ? (data.investitureDate || '').trim() || undefined
        : undefined,
    professionalCourse: (data.professionalCourse || '').trim() || undefined,
    joinedDate: undefined,
    documentDeliveryMethod:
      data.documentDeliveryMethod === 'anexar_digital' ? 'anexar_digital' : 'presencial',
    biDocumentFileName:
      data.documentDeliveryMethod === 'anexar_digital'
        ? hasNewBiDoc
          ? data.biDocumentFileName!.trim()
          : rejectedReq.biDocumentFileName
        : undefined,
    biDocumentBase64:
      data.documentDeliveryMethod === 'anexar_digital'
        ? hasNewBiDoc
          ? data.biDocumentBase64!.trim()
          : rejectedReq.biDocumentBase64
        : undefined,
    photoDocumentFileName:
      data.documentDeliveryMethod === 'anexar_digital'
        ? hasNewPhotoDoc
          ? data.photoDocumentFileName!.trim()
          : rejectedReq.photoDocumentFileName
        : undefined,
    photoDocumentBase64:
      data.documentDeliveryMethod === 'anexar_digital'
        ? hasNewPhotoDoc
          ? data.photoDocumentBase64!.trim()
          : rejectedReq.photoDocumentBase64
        : undefined,
    status: 'pendente',
    submittedAt: now,
    submittedByUserId: submittedByUserId || rejectedReq.submittedByUserId,
  };
}


