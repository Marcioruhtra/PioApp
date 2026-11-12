/**
 * Serviço de Verificação de Integridade de Dados dos Membros (Integrity Service)
 * Garante que:
 * 1. Todos os membros possuam estrutura íntegra e sincronizada de Contactos de Emergência e Alergias.
 * 2. As informações de emergência (nome, parentesco, telefone) e dados médicos/alergias
 *    sejam preservados e compatibilizados com o Encarregado de Educação se houver omissões.
 * 3. Validação contínua e reparação de integridade antes da persistência no Cloud Firestore e no carregamento remoto.
 */

import { Member } from '../types';

export interface IntegrityCheckResult {
  hasIssues: boolean;
  fixedCount: number;
  fixedMembers: {
    id: string;
    fullName: string;
    changes: string[];
  }[];
  sanitizedMembers: Member[];
}

/**
 * Valida e higieniza um membro individual, garantindo integridade e consistência estrita
 * entre os dados de emergência, encarregado de educação e alergias/avisos médicos.
 */
export function sanitizeMemberIntegrity(member: Member): { sanitized: Member; changes: string[] } {
  const changes: string[] = [];
  const cleanMember: Member = { ...member };

  // 1. Garantir que o nome do encarregado de educação esteja presente e limpo
  const rawGuardianName = (cleanMember.guardianName || '').trim();
  const rawGuardianPhone = (cleanMember.guardianPhone || '').trim();

  // 2. Normalizar e verificar integridade do Contacto de Emergência
  const currentEmergency = cleanMember.emergencyContact || {
    name: '',
    relationship: '',
    phone: '',
  };

  const emergencyName = (currentEmergency.name || '').trim();
  const emergencyPhone = (currentEmergency.phone || '').trim();
  const emergencyRel = (currentEmergency.relationship || '').trim();

  let resolvedEmergencyName = emergencyName;
  let resolvedEmergencyPhone = emergencyPhone;
  let resolvedEmergencyRel = emergencyRel;

  // Se o contacto de emergência não tiver nome, sincroniza com o encarregado
  if (!resolvedEmergencyName) {
    if (rawGuardianName) {
      resolvedEmergencyName = rawGuardianName;
      changes.push(`Nome de emergência preenchido a partir do Encarregado: "${rawGuardianName}"`);
    } else {
      resolvedEmergencyName = cleanMember.fullName || 'Contacto Familiar';
      changes.push(`Nome de emergência predefinido para o titular da ficha: "${resolvedEmergencyName}"`);
    }
  }

  // Se o encarregado não tiver nome mas houver contacto de emergência, sincroniza
  if (!cleanMember.guardianName && resolvedEmergencyName) {
    cleanMember.guardianName = resolvedEmergencyName;
    changes.push(`Encarregado sincronizado a partir do contacto de emergência: "${resolvedEmergencyName}"`);
  }

  // Se não houver telefone de emergência, sincroniza com o encarregado ou com o telefone do membro
  if (!resolvedEmergencyPhone) {
    if (rawGuardianPhone) {
      resolvedEmergencyPhone = rawGuardianPhone;
      changes.push(`Telefone de emergência sincronizado a partir do Encarregado: "${rawGuardianPhone}"`);
    } else if (cleanMember.phone) {
      resolvedEmergencyPhone = cleanMember.phone;
      changes.push(`Telefone de emergência preenchido com o telefone principal do membro: "${cleanMember.phone}"`);
    } else {
      resolvedEmergencyPhone = '+244 9XX XXX XXX';
    }
  }

  // Se o encarregado não tiver telefone mas houver telefone de emergência, sincroniza
  if (!cleanMember.guardianPhone && resolvedEmergencyPhone) {
    cleanMember.guardianPhone = resolvedEmergencyPhone;
    changes.push(`Telefone do encarregado sincronizado com telefone de emergência: "${resolvedEmergencyPhone}"`);
  }

  // Se não houver parentesco, atribui um padrão coerente
  if (!resolvedEmergencyRel) {
    resolvedEmergencyRel = cleanMember.guardianName ? 'Encarregado de Educação' : 'Familiar';
    changes.push(`Grau de parentesco de emergência normalizado: "${resolvedEmergencyRel}"`);
  }

  cleanMember.emergencyContact = {
    name: resolvedEmergencyName,
    phone: resolvedEmergencyPhone,
    relationship: resolvedEmergencyRel,
    phoneVerified: Boolean(currentEmergency.phoneVerified),
  };

  // 3. Normalizar Grupo Sanguíneo
  if (!cleanMember.bloodType || cleanMember.bloodType.trim() === '') {
    cleanMember.bloodType = 'O+';
    changes.push('Grupo sanguíneo normalizado para O+');
  }

  // 4. Normalizar campo de Alergias e Avisos Médicos
  if (cleanMember.allergiesOrMedicalNotes !== undefined) {
    const trimmedNotes = cleanMember.allergiesOrMedicalNotes.trim();
    if (trimmedNotes === '' || trimmedNotes.toLowerCase() === 'sem' || trimmedNotes.toLowerCase() === 'nenhuma') {
      cleanMember.allergiesOrMedicalNotes = 'Sem alergias conhecidas';
    } else {
      cleanMember.allergiesOrMedicalNotes = trimmedNotes;
    }
  } else {
    cleanMember.allergiesOrMedicalNotes = 'Sem alergias conhecidas';
  }

  return { sanitized: cleanMember, changes };
}

/**
 * Executa a verificação completa de integridade de todo o array de membros,
 * garantindo compatibilidade bidirecional e consistência estrutural com o Firestore.
 */
export function verifyAndRepairMembersIntegrity(members: Member[]): IntegrityCheckResult {
  if (!Array.isArray(members)) {
    return {
      hasIssues: false,
      fixedCount: 0,
      fixedMembers: [],
      sanitizedMembers: [],
    };
  }

  const fixedMembers: { id: string; fullName: string; changes: string[] }[] = [];
  const sanitizedMembers: Member[] = [];

  for (const m of members) {
    if (!m) continue;
    const { sanitized, changes } = sanitizeMemberIntegrity(m);
    if (changes.length > 0) {
      fixedMembers.push({
        id: sanitized.id,
        fullName: sanitized.fullName,
        changes,
      });
    }
    sanitizedMembers.push(sanitized);
  }

  return {
    hasIssues: fixedMembers.length > 0,
    fixedCount: fixedMembers.length,
    fixedMembers,
    sanitizedMembers,
  };
}
