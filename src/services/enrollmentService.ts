/**
 * Serviço de Gestão de Solicitações de Inscrição de Novos Membros
 * Permite que candidatos/membros preencham a ficha oficial de inscrição diretamente no sistema
 * e que responsáveis autorizados na Grelha de Permissões (ex.: Secretário) autorizem ou recusem.
 */

import {
  DeletionRequest,
  EnrollmentDocumentDeliveryMethod,
  EnrollmentScheduleConfig,
  Member,
  MemberCategory,
  MemberDocumentationStatus,
  MemberEnrollmentRequest,
  RoleType,
  UserAccount,
} from '../types';
import { generateManualNumber, getNowISOString, getTodayISODate } from '../utils/date';
import { isMemberNumberUnique, findPotentialDuplicateMember } from './storageService';
import { sanitizeMemberIntegrity } from './memberIntegrityService';

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

  if (!cleanGuardianName) {
    return { valid: false, error: 'O Nome do Encarregado de Educação é obrigatório.' };
  }
  if (!cleanGuardianPhone) {
    return { valid: false, error: 'O Telefone do Encarregado de Educação é obrigatório.' };
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

  // 2. Comparar com todos os inscritos / solicitações submetidas ou validadas (exclui apenas recusadas para permitir correção documental)
  const existingRequestWithBI = existingRequests.find(
    (r) =>
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
    (r) => r.status === 'pendente' || r.status === 'em_analise' || r.status === 'aprovado'
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
  const guardianName = data.guardianName.trim();
  const guardianPhone = data.guardianPhone.trim();
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
    guardianName,
    guardianPhone,
    emergencyContact: {
      name: (data.emergencyName || '').trim() || guardianName,
      relationship: (data.emergencyRelationship || '').trim() || 'Encarregado de Educação',
      phone: (data.emergencyPhone || '').trim() || guardianPhone,
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
    guardianName: req.guardianName,
    guardianPhone: req.guardianPhone,
    guardianValidated: Boolean(req.guardianName),
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
 * Reconcilia automaticamente todas as inscrições já validadas/aceites ("aprovado")
 * garantindo que estejam registadas na Secretaria ("Fichas de Membros") sem duplicação.
 */
export function reconcileApprovedEnrollmentsWithMembers(
  members: Member[],
  enrollmentRequests: MemberEnrollmentRequest[],
  currentYear: number,
  deletionRequests: DeletionRequest[] = []
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

  const deletedMemberIds = new Set(
    (deletionRequests || [])
      .filter((d) => d.status === 'executado' && d.operationType === 'eliminacao')
      .map((d) => d.targetId)
  );

  let nextMembers = [...members];
  let autoRegisteredCount = 0;
  let hasChanges = false;

  const nextRequests = enrollmentRequests.map((req) => {
    if (!req || req.status !== 'aprovado') return req;

    if (req.createdMemberId && deletedMemberIds.has(req.createdMemberId)) {
      return req;
    }

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
    };
  }

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
      statusLabel: 'Inscrições Encerradas',
      reasonLabel: 'As inscrições foram encerradas pela Direção do Clube.',
      openLabel,
      closeLabel,
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
      reasonLabel: `As inscrições abrirão em ${openLabel}${closeLabel ? ` e encerram em ${closeLabel}` : ''}.`,
      openLabel,
      closeLabel,
    };
  }

  if (closeAt && now.getTime() >= closeAt.getTime()) {
    return {
      isCurrentlyOpen: false,
      status: 'encerradas',
      statusLabel: 'Inscrições Encerradas',
      reasonLabel: `O período estipulado de inscrições encerrou em ${closeLabel}.`,
      openLabel,
      closeLabel,
    };
  }

  return {
    isCurrentlyOpen: true,
    status: 'abertas',
    statusLabel: 'Inscrições Abertas',
    reasonLabel: closeLabel
      ? `Inscrições abertas até ${closeLabel}.`
      : 'As inscrições no clube estão atualmente abertas.',
    openLabel,
    closeLabel,
  };
}
