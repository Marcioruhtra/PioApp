import { Member, MemberEnrollmentRequest, ModuleName, PermissionAction, RoleType, UserAccount } from '../types';
import { hasApproveMemberAccountPermission, sanitizeRoleType } from './permissionService';

export const DIRECTION_ROLES: readonly RoleType[] = ['diretor', 'diretor_associado', 'secretario'];
export const DIRECTION_TEAM_LABEL = 'Direção';

export const isDirectionRole = (role?: RoleType | null): boolean =>
  Boolean(role && DIRECTION_ROLES.includes(role));

/**
 * Identifica contas institucionais independentes (que nunca devem ser vinculadas a fichas individuais de membros).
 */
export const isInstitutionalAccountRecord = (
  u: Pick<UserAccount, 'id' | 'email' | 'name' | 'role'>
): boolean => {
  const emailLower = (u.email || '').trim().toLowerCase();
  const nameLower = (u.name || '').trim().toLowerCase();
  return (
    u.id === 'INST-001' ||
    u.id === 'USR-ADMIN' ||
    u.role === 'admin_tecnico' ||
    emailLower === 'institucional@clubedalvorada.ao' ||
    nameLower.includes('institucional')
  );
};

/**
 * Verifica estritamente se o utilizador autenticado está vinculado a uma ficha de membro real existente.
 * Utilizadores sem vinculação ou contas institucionais/administrativas sem ficha não têm acesso ao Portal do Membro.
 */
export const getStrictLinkedMember = (
  user: UserAccount | null | undefined,
  members: Member[]
): Member | undefined => {
  if (!user || isInstitutionalAccountRecord(user)) return undefined;
  if (!user.linkedMemberId || !user.linkedMemberId.trim()) return undefined;
  const cleanLink = user.linkedMemberId.trim();
  return members.find((m) => m.id === cleanLink || m.manualNumber === cleanLink);
};

/**
 * Indica se o utilizador tem permissão estrutural de entrada no Portal do Membro (exige vinculação ativa a um membro).
 */
export const hasMemberPortalAccess = (
  user: UserAccount | null | undefined,
  members: Member[]
): boolean => {
  return Boolean(getStrictLinkedMember(user, members));
};

/**
 * Localiza todas as contas de acesso não-institucionais vinculadas a uma ficha de membro
 * (por linkedMemberId, Nº de Membro ou e-mail). Contas institucionais e do Administrador Técnico
 * nunca são selecionadas para remoção automática.
 */
export const findLinkedUserAccountsForMember = (
  users: UserAccount[],
  member: Pick<Member, 'id' | 'manualNumber' | 'email'>
): UserAccount[] => {
  const memberIdClean = (member.id || '').trim();
  const memberManualClean = (member.manualNumber || '').trim().toLowerCase();
  const memberEmailClean = (member.email || '').trim().toLowerCase();

  return users.filter((u) => {
    if (isInstitutionalAccountRecord(u)) return false;

    const uLinked = (u.linkedMemberId || '').trim();
    const uManual = (u.manualNumber || '').trim().toLowerCase();
    const uEmail = (u.email || '').trim().toLowerCase();

    const isLinkedById =
      Boolean(uLinked) &&
      ((Boolean(memberIdClean) && uLinked === memberIdClean) ||
        (Boolean(memberManualClean) && uLinked.toLowerCase() === memberManualClean));

    const isLinkedByManual =
      Boolean(uManual) && Boolean(memberManualClean) && uManual === memberManualClean;

    const isLinkedByEmail =
      Boolean(uEmail) && Boolean(memberEmailClean) && uEmail === memberEmailClean;

    return isLinkedById || isLinkedByManual || isLinkedByEmail;
  });
};

/**
 * Remove automaticamente todas as contas de utilizador vinculadas ao membro eliminado,
 * sem exigir autorização prévia do Administrador Técnico (audit: ADMIN), preservando
 * integralmente contas institucionais/técnicas e outras contas não vinculadas.
 */
export const removeLinkedAccountsForMember = (
  users: UserAccount[],
  member: Pick<Member, 'id' | 'manualNumber' | 'email'>
): { updatedUsers: UserAccount[]; removedUsers: UserAccount[] } => {
  const linked = findLinkedUserAccountsForMember(users, member);
  if (linked.length === 0) {
    return { updatedUsers: users, removedUsers: [] };
  }
  const linkedIds = new Set(linked.map((u) => u.id));
  return {
    updatedUsers: users.filter((u) => !linkedIds.has(u.id)),
    removedUsers: linked,
  };
};

/**
 * Indica se o membro pertence à Direção (Diretor, Diretor-associado ou Secretário)
 * pela sua conta vinculada. Por definição, membros da Direção não pertencem a equipas.
 */
export const isDirectionMember = (
  member: Pick<Member, 'id' | 'manualNumber' | 'email'>,
  users: UserAccount[]
): boolean => {
  const linked = findLinkedUserAccountsForMember(users, member);
  return (
    linked.some((u) => u.active !== false && isDirectionRole(u.role)) ||
    linked.some((u) => isDirectionRole(u.role))
  );
};

/**
 * Devolve o rótulo de equipa a apresentar na ficha do membro:
 * - Para Diretor, Diretor-associado e Secretário: devolve sempre "Direção" (nunca "Sem Equipa").
 * - Para os restantes membros: devolve a equipa atribuída ou "Sem Equipa".
 */
export const getMemberTeamLabel = (
  member: Pick<Member, 'id' | 'manualNumber' | 'email' | 'unitOrTeam'>,
  users: UserAccount[],
  emptyFallback: string = 'Sem Equipa'
): string => {
  if (isDirectionMember(member, users)) {
    return DIRECTION_TEAM_LABEL;
  }
  const trimmed = member.unitOrTeam?.trim();
  return trimmed || emptyFallback;
};

/**
 * Resolve o membro correspondente a uma conta de utilizador por ID vinculado ou Nº de Membro.
 */
export const resolveLinkedMember = (
  user: UserAccount,
  members: Member[]
): Member | undefined => {
  if (isInstitutionalAccountRecord(user)) return undefined;

  if (user.linkedMemberId) {
    const cleanLink = user.linkedMemberId.trim();
    const byId = members.find(
      (m) => m.id === cleanLink || m.manualNumber === cleanLink
    );
    if (byId) return byId;
  }

  if (user.manualNumber && user.manualNumber.trim()) {
    const cleanNum = user.manualNumber.trim().toLowerCase();
    const byNum = members.find(
      (m) => m.manualNumber && m.manualNumber.trim().toLowerCase() === cleanNum
    );
    if (byNum) return byNum;
  }

  if (user.email && user.email.trim()) {
    const cleanEmail = user.email.trim().toLowerCase();
    const byEmail = members.find(
      (m) => m.email && m.email.trim().toLowerCase() === cleanEmail
    );
    if (byEmail) return byEmail;
  }

  return undefined;
};

/**
 * Propaga automaticamente alterações feitas na ficha do membro (nome, e-mail, Nº de Membro, telefone)
 * para todas as contas de login vinculadas.
 */
export const syncMemberChangesToUsers = (
  updatedMember: Member,
  users: UserAccount[],
  previousMember?: Member
): UserAccount[] => {
  const prevEmailLower = previousMember?.email?.trim().toLowerCase();
  const nextEmailTrimmed = updatedMember.email?.trim();
  const nextEmailLower = nextEmailTrimmed?.toLowerCase();
  const nextPhoneTrimmed = updatedMember.phone?.trim();
  const nextManualNumber = updatedMember.manualNumber?.trim() || updatedMember.manualNumber;

  return users.map((u) => {
    if (isInstitutionalAccountRecord(u)) return u;

    const uEmailLower = (u.email || '').trim().toLowerCase();
    const isLinkedById = u.linkedMemberId === updatedMember.id || (previousMember && u.linkedMemberId === previousMember.manualNumber);
    const isLinkedByPrevEmail = Boolean(prevEmailLower && uEmailLower === prevEmailLower);
    const isLinkedByCurrentEmail = Boolean(!u.linkedMemberId && nextEmailLower && uEmailLower === nextEmailLower);

    if (!isLinkedById && !isLinkedByPrevEmail && !isLinkedByCurrentEmail) {
      return u;
    }

    return {
      ...u,
      linkedMemberId: updatedMember.id,
      name: updatedMember.fullName || u.name,
      email: nextEmailTrimmed || u.email,
      phone: nextPhoneTrimmed || u.phone,
      manualNumber: nextManualNumber || u.manualNumber,
    };
  });
};

export interface UserSyncOverrides {
  name?: string;
  email?: string;
  phone?: string;
  manualNumber?: string;
  linkedMemberChanged?: boolean;
}

/**
 * Sincroniza bidireccionalmente uma conta de login criada ou editada com o membro vinculado.
 * - Se uma nova vinculação foi feita sem edição explícita de nome/e-mail/telefone, herda do membro.
 * - Se dados da conta (nome, e-mail, telefone, Nº de Membro) foram editados, propaga automaticamente para a ficha do membro.
 */
export const syncUserWithLinkedMember = (
  user: UserAccount,
  members: Member[],
  nowISO: string,
  overrides: UserSyncOverrides = {}
): { syncedUser: UserAccount; updatedMembers: Member[] } => {
  if (isInstitutionalAccountRecord(user) || !user.linkedMemberId) {
    const cleanUser: UserAccount = { ...user };
    if (isInstitutionalAccountRecord(user) || !user.linkedMemberId) {
      delete cleanUser.linkedMemberId;
      delete cleanUser.manualNumber;
    }
    return { syncedUser: cleanUser, updatedMembers: members };
  }

  const targetMember = members.find(
    (m) => m.id === user.linkedMemberId || m.manualNumber === user.linkedMemberId
  );

  if (!targetMember) {
    return { syncedUser: user, updatedMembers: members };
  }

  const preferMemberProfile = Boolean(overrides.linkedMemberChanged);

  const resolvedName =
    (!preferMemberProfile && overrides.name !== undefined && overrides.name.trim())
      ? overrides.name.trim()
      : (targetMember.fullName || user.name).trim();

  const resolvedEmail =
    (!preferMemberProfile && overrides.email !== undefined && overrides.email.trim())
      ? overrides.email.trim()
      : (targetMember.email?.trim() || user.email.trim());

  const resolvedPhone =
    (!preferMemberProfile && overrides.phone !== undefined && overrides.phone.trim())
      ? overrides.phone.trim()
      : (targetMember.phone?.trim() || user.phone?.trim() || '');

  const resolvedManualNumber =
    (overrides.manualNumber !== undefined && overrides.manualNumber.trim())
      ? overrides.manualNumber.trim()
      : (targetMember.manualNumber || user.manualNumber || '').trim();

  const syncedUser: UserAccount = {
    ...user,
    linkedMemberId: targetMember.id,
    name: resolvedName,
    email: resolvedEmail,
    ...(resolvedPhone ? { phone: resolvedPhone } : {}),
    ...(resolvedManualNumber ? { manualNumber: resolvedManualNumber } : {}),
  };

  const shouldClearTeamForDirection = isDirectionRole(user.role) && Boolean(targetMember.unitOrTeam);

  const memberChanged =
    targetMember.fullName !== resolvedName ||
    (resolvedEmail && targetMember.email !== resolvedEmail) ||
    (resolvedPhone && targetMember.phone !== resolvedPhone) ||
    (resolvedManualNumber && targetMember.manualNumber !== resolvedManualNumber) ||
    shouldClearTeamForDirection;

  const updatedMembers = memberChanged
    ? members.map((m) =>
        m.id === targetMember.id
          ? {
              ...m,
              fullName: resolvedName,
              email: resolvedEmail || m.email,
              phone: resolvedPhone || m.phone,
              manualNumber: resolvedManualNumber || m.manualNumber,
              ...(isDirectionRole(user.role) ? { unitOrTeam: undefined } : {}),
              updatedAt: nowISO,
            }
          : m
      )
    : members;

  return { syncedUser, updatedMembers };
};

/**
 * Reconcilia continuamente todas as contas de acesso com as respetivas fichas de membro.
 * Garante que mesmo em carregamentos da nuvem (onSnapshot) ou dados herdados, nome, e-mail,
 * Nº de Membro e telefone estejam sempre sincronizados entre conta e ficha.
 */
export const reconcileUsersAndMembers = (
  users: UserAccount[],
  members: Member[]
): { users: UserAccount[]; members: Member[]; changed: boolean } => {
  let changed = false;
  const nextMembers = members.map((m) => ({ ...m }));
  const memberIndexById = new Map<string, number>();
  nextMembers.forEach((m, idx) => memberIndexById.set(m.id, idx));

  const nextUsers = users.map((rawUser) => {
    const normalizedRole = sanitizeRoleType(rawUser.role);
    const u: UserAccount = rawUser.role !== normalizedRole ? { ...rawUser, role: normalizedRole } : rawUser;
    if (rawUser.role !== normalizedRole) {
      changed = true;
    }

    if (isInstitutionalAccountRecord(u)) {
      if (u.linkedMemberId || u.manualNumber) {
        changed = true;
        const clean = { ...u };
        delete clean.linkedMemberId;
        delete clean.manualNumber;
        return clean;
      }
      return u;
    }

    const linked = u.linkedMemberId ? getStrictLinkedMember(u, nextMembers) : undefined;
    if (!linked) {
      if (u.linkedMemberId || u.manualNumber) {
        changed = true;
        const unlinkedUser = { ...u };
        delete unlinkedUser.linkedMemberId;
        delete unlinkedUser.manualNumber;
        return unlinkedUser;
      }
      return u;
    }

    const memberIdx = memberIndexById.get(linked.id);
    if (memberIdx !== undefined) {
      const m = nextMembers[memberIdx];
      let mModified = false;
      if (!m.email && u.email && u.email.trim()) {
        m.email = u.email.trim();
        mModified = true;
      }
      if (!m.phone && u.phone && u.phone.trim()) {
        m.phone = u.phone.trim();
        mModified = true;
      }
      if (isDirectionRole(u.role) && m.unitOrTeam) {
        m.unitOrTeam = undefined;
        mModified = true;
      }
      if (mModified) {
        changed = true;
      }
    }

    const currentMember = memberIdx !== undefined ? nextMembers[memberIdx] : linked;
    const expectedName = currentMember.fullName || u.name;
    const expectedEmail = currentMember.email?.trim() || u.email;
    const expectedPhone = currentMember.phone?.trim() || u.phone;
    const expectedManualNumber = currentMember.manualNumber || u.manualNumber;

    if (
      u.linkedMemberId !== currentMember.id ||
      u.name !== expectedName ||
      u.email !== expectedEmail ||
      (expectedPhone && u.phone !== expectedPhone) ||
      (expectedManualNumber && u.manualNumber !== expectedManualNumber)
    ) {
      changed = true;
      return {
        ...u,
        linkedMemberId: currentMember.id,
        name: expectedName,
        email: expectedEmail,
        ...(expectedPhone ? { phone: expectedPhone } : {}),
        ...(expectedManualNumber ? { manualNumber: expectedManualNumber } : {}),
      };
    }

    return u;
  });

  return { users: nextUsers, members: nextMembers, changed };
};

/**
 * Identifica contas de login criadas por membros após inscrição validada que ainda
 * aguardam confirmação do Diretor (ou cargo autorizado pelo Administrador).
 */
export const isPendingMemberAccountConfirmation = (
  user: Pick<UserAccount, 'active' | 'accountApprovalStatus' | 'accountCreatedViaSelfService'>
): boolean => {
  if (user.active !== false) return false;
  if (user.accountApprovalStatus === 'pendente_confirmacao') return true;
  return Boolean(
    user.accountCreatedViaSelfService &&
      user.accountApprovalStatus !== 'aprovada' &&
      user.accountApprovalStatus !== 'rejeitada'
  );
};

export interface SelfServiceAccountEligibility {
  allowed: boolean;
  reason?: string;
  existingAccount?: UserAccount;
  pendingConfirmation?: boolean;
  alreadyLinkedActive?: boolean;
  alreadyLinkedInactive?: boolean;
  missingEmail?: boolean;
}

/**
 * Avalia se um membro com inscrição validada pode criar as suas próprias credenciais de acesso:
 * - Exige ficha de membro oficial ativa (inscrição já validada/registada na Secretaria).
 * - Exige que o registo NÃO esteja vinculado a nenhuma conta de login (ativa ou pendente).
 * - Exige e-mail e Nº de Matrícula já registados na ficha (para sincronização automática).
 */
export const canMemberCreateSelfServiceAccount = (
  member: Member | undefined,
  users: UserAccount[],
  request?: MemberEnrollmentRequest
): SelfServiceAccountEligibility => {
  if (!member) {
    return {
      allowed: false,
      reason: 'A criação da conta de login só é possível após a inscrição ser validada pela Secretaria.',
    };
  }

  if (request && request.status !== 'aprovado') {
    return {
      allowed: false,
      reason: 'A sua inscrição ainda não foi validada pela Secretaria.',
    };
  }

  if (member.status === 'arquivado' || member.status === 'inativo' || member.status === 'transferido') {
    return {
      allowed: false,
      reason: 'Apenas membros com ficha ativa podem criar credenciais de login.',
    };
  }

  const linkedAccounts = findLinkedUserAccountsForMember(users, member);
  const existing = linkedAccounts.find((u) => u.accountApprovalStatus !== 'rejeitada');
  if (existing) {
    if (isPendingMemberAccountConfirmation(existing)) {
      return {
        allowed: false,
        existingAccount: existing,
        pendingConfirmation: true,
        reason: 'Já foi criada uma conta de login para este registo e encontra-se a aguardar confirmação do Diretor para ativação.',
      };
    }
    if (existing.active) {
      return {
        allowed: false,
        existingAccount: existing,
        alreadyLinkedActive: true,
        reason: 'Este registo de membro já se encontra vinculado a uma conta de login ativa.',
      };
    }
    return {
      allowed: false,
      existingAccount: existing,
      alreadyLinkedInactive: true,
      reason: 'Este registo já possui uma conta de login vinculada (atualmente desativada). Contacte a Administração.',
    };
  }

  const cleanEmail = (member.email || '').trim();
  const cleanManual = (member.manualNumber || '').trim();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return {
      allowed: false,
      missingEmail: true,
      reason: 'A sua ficha de membro não possui um e-mail registado. Solicite à Secretaria a atualização do e-mail para poder criar a sua conta de login.',
    };
  }

  if (!cleanManual) {
    return {
      allowed: false,
      reason: 'A sua ficha de membro ainda não possui Nº de Matrícula atribuído pela Secretaria.',
    };
  }

  return { allowed: true };
};

/**
 * Constrói uma conta de login para membro a partir da sua ficha validada, definindo apenas a senha.
 * O Nº de Matrícula, E-mail e vínculo à ficha (linkedMemberId) são sincronizados automaticamente.
 * A conta nasce desativada (active: false, accountApprovalStatus: 'pendente_confirmacao') até confirmação do Diretor.
 */
export const buildSelfServiceMemberAccount = (params: {
  member: Member;
  password: string;
  confirmPassword: string;
  existingUsers: UserAccount[];
  request?: MemberEnrollmentRequest;
  nowISO?: string;
}): { success: boolean; account?: UserAccount; error?: string } => {
  const { member, password, confirmPassword, existingUsers, request, nowISO } = params;

  const eligibility = canMemberCreateSelfServiceAccount(member, existingUsers, request);
  if (!eligibility.allowed) {
    return {
      success: false,
      error: eligibility.reason || 'Este registo não está elegível para criação de conta de login.',
    };
  }

  const cleanPwd = (password || '').trim();
  const cleanConfirm = (confirmPassword || '').trim();

  if (cleanPwd.length < 6) {
    return {
      success: false,
      error: 'A senha deve ter pelo menos 6 caracteres.',
    };
  }

  if (cleanPwd !== cleanConfirm) {
    return {
      success: false,
      error: 'A confirmação da senha não coincide com a senha introduzida.',
    };
  }

  const cleanEmail = member.email!.trim();
  const cleanEmailLower = cleanEmail.toLowerCase();
  const cleanManual = member.manualNumber.trim();
  const cleanManualLower = cleanManual.toLowerCase();

  const conflictingUser = existingUsers.find(
    (u) =>
      u.accountApprovalStatus !== 'rejeitada' &&
      ((u.email && u.email.trim().toLowerCase() === cleanEmailLower) ||
        (u.manualNumber && u.manualNumber.trim().toLowerCase() === cleanManualLower))
  );

  if (conflictingUser) {
    return {
      success: false,
      error: 'Já existe uma conta de acesso registada com este e-mail ou Nº de Matrícula.',
    };
  }

  const timestamp = nowISO || new Date().toISOString();
  const account: UserAccount = {
    id: `USR-MEM-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    name: member.fullName.trim(),
    email: cleanEmail,
    role: 'membro',
    linkedMemberId: member.id,
    manualNumber: cleanManual,
    phone: member.phone?.trim() || undefined,
    password: cleanPwd,
    active: false,
    accountApprovalStatus: 'pendente_confirmacao',
    accountCreatedViaSelfService: true,
    createdAt: timestamp,
  };

  return { success: true, account };
};

/**
 * Confirma e ativa uma conta de login criada pelo membro após inscrição validada.
 * Requer permissão APPROVE_MEMBER_ACCOUNT concedida pelo Administrador Técnico na Grelha de Permissões.
 */
export const confirmPendingMemberAccount = (params: {
  userId: string;
  users: UserAccount[];
  members: Member[];
  actor: Pick<UserAccount, 'id' | 'name' | 'role'>;
  permissionsMatrix?: Record<RoleType, Record<ModuleName, PermissionAction[]>>;
  nowISO?: string;
}): { success: boolean; confirmedUser?: UserAccount; updatedUsers?: UserAccount[]; error?: string } => {
  const { userId, users, members, actor, permissionsMatrix, nowISO } = params;

  if (!hasApproveMemberAccountPermission(actor.role, permissionsMatrix)) {
    return {
      success: false,
      error: 'Sem permissão na Grelha de Permissões (Confirmar Contas de Login) para validar esta conta.',
    };
  }

  const targetUser = users.find((u) => u.id === userId);
  if (!targetUser) {
    return { success: false, error: 'Conta de utilizador não encontrada.' };
  }

  if (targetUser.active && targetUser.accountApprovalStatus !== 'pendente_confirmacao') {
    return { success: false, error: 'Esta conta de login já se encontra ativa e validada.' };
  }

  const timestamp = nowISO || new Date().toISOString();
  const linkedMember = resolveLinkedMember(targetUser, members);

  const confirmedDraft: UserAccount = {
    ...targetUser,
    ...(linkedMember
      ? {
          linkedMemberId: linkedMember.id,
          name: linkedMember.fullName || targetUser.name,
          email: linkedMember.email?.trim() || targetUser.email,
          phone: linkedMember.phone?.trim() || targetUser.phone,
          manualNumber: linkedMember.manualNumber || targetUser.manualNumber,
        }
      : {}),
    active: true,
    accountApprovalStatus: 'aprovada',
    accountApprovedByUserId: actor.id,
    accountApprovedByName: actor.name,
    accountApprovedAt: timestamp,
  };

  const updatedUsers = users.map((u) => (u.id === userId ? confirmedDraft : u));
  return { success: true, confirmedUser: confirmedDraft, updatedUsers };
};

/**
 * Recusa e remove uma solicitação pendente de conta self-service, mantendo a ficha do membro desvinculada.
 */
export const rejectPendingMemberAccount = (params: {
  userId: string;
  users: UserAccount[];
  actor: Pick<UserAccount, 'id' | 'name' | 'role'>;
  permissionsMatrix?: Record<RoleType, Record<ModuleName, PermissionAction[]>>;
}): { success: boolean; rejectedUser?: UserAccount; updatedUsers?: UserAccount[]; error?: string } => {
  const { userId, users, actor, permissionsMatrix } = params;

  if (!hasApproveMemberAccountPermission(actor.role, permissionsMatrix)) {
    return {
      success: false,
      error: 'Sem permissão na Grelha de Permissões (Confirmar Contas de Login) para recusar esta conta.',
    };
  }

  const targetUser = users.find((u) => u.id === userId);
  if (!targetUser) {
    return { success: false, error: 'Conta pendente não encontrada.' };
  }

  if (!isPendingMemberAccountConfirmation(targetUser)) {
    return {
      success: false,
      error: 'Apenas contas criadas por membros pendentes de confirmação podem ser recusadas por esta ação.',
    };
  }

  const updatedUsers = users.filter((u) => u.id !== userId);
  return { success: true, rejectedUser: targetUser, updatedUsers };
};

