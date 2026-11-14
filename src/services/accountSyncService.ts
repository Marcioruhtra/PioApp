import { Member, UserAccount } from '../types';

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
 * Resolve o membro correspondente a uma conta de utilizador por ID vinculado, Nº de Membro ou e-mail.
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

  const memberChanged =
    targetMember.fullName !== resolvedName ||
    (resolvedEmail && targetMember.email !== resolvedEmail) ||
    (resolvedPhone && targetMember.phone !== resolvedPhone) ||
    (resolvedManualNumber && targetMember.manualNumber !== resolvedManualNumber);

  const updatedMembers = memberChanged
    ? members.map((m) =>
        m.id === targetMember.id
          ? {
              ...m,
              fullName: resolvedName,
              email: resolvedEmail || m.email,
              phone: resolvedPhone || m.phone,
              manualNumber: resolvedManualNumber || m.manualNumber,
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

  const nextUsers = users.map((u) => {
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

    const linked = resolveLinkedMember(u, nextMembers);
    if (!linked) {
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
