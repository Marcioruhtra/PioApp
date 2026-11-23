import { DocumentType, OfficialDocument, PaymentReceipt, RoleType, UserAccount } from '../types';
import { ROLE_LABELS } from '../services/permissionService';

export interface ResolvedDocumentSigner {
  userId?: string;
  name: string;
  role: RoleType;
  roleLabel: string;
}

const GENERIC_PLACEHOLDER_NAMES = new Set([
  'responsável',
  'responsavel',
  'responsável autorizado',
  'responsavel autorizado',
  'responsável da operação',
  'responsavel da operacao',
  'sistema',
  'administração',
  'administracao',
]);

/**
 * Remove eventuais sufixos legados entre parênteses (ex.: "Daniel Kissange (Tesoureiro)")
 * para evitar duplicação entre o nome do autor e o seu cargo.
 */
export function cleanOperatorDisplayName(rawName?: string): string {
  if (!rawName) return '';
  return rawName
    .replace(/\s*\((?:tesoureir[oa]|secretári[oa](?:\(a\))?|secretari[oa](?:\(a\))?|diretor(?:-associado)?|administrador(?:\s+técnico)?|instrutor(?:\s*\/\s*guia)?|capel[aã]o|membro(?:\s*\/\s*encarregado)?)\)\s*$/i, '')
    .trim();
}

function inferRoleFromLegacyTag(rawName?: string): RoleType | undefined {
  if (!rawName) return undefined;
  const lower = rawName.toLowerCase();
  if (lower.includes('diretor-associado') || lower.includes('diretor associado')) return 'diretor_associado';
  if (lower.includes('administrador')) return 'admin_tecnico';
  if (lower.includes('tesoureir')) return 'tesoureiro';
  if (lower.includes('secretári') || lower.includes('secretari')) return 'secretario';
  if (lower.includes('instrutor')) return 'instrutor';
  if (lower.includes('capel')) return 'capelao';
  if (lower.includes('diretor')) return 'diretor';
  return undefined;
}

function inferDefaultRoleByDocumentType(documentType?: DocumentType): RoleType {
  switch (documentType) {
    case 'recibo':
    case 'mapa_financeiro':
      return 'tesoureiro';
    case 'ata':
    case 'folha_presenca':
      return 'secretario';
    case 'declaracao_membro':
    case 'certificado':
    case 'relatorio_anual':
    default:
      return 'diretor';
  }
}

/**
 * Resolve sempre o nome completo e o cargo oficial da pessoa que realizou a operação,
 * evitando a exibição genérica de "Responsável" nos recibos e documentos.
 */
export function resolveDocumentOperatorSigner(
  doc: Pick<OfficialDocument, 'issuedByUserId' | 'issuedByName' | 'issuedByRole' | 'documentType'>,
  users: UserAccount[] = []
): ResolvedDocumentSigner {
  const cleanedName = cleanOperatorDisplayName(doc.issuedByName);
  const normalizedCleanedName = cleanedName.toLowerCase();

  const matchedById = doc.issuedByUserId
    ? users.find((u) => u.id === doc.issuedByUserId)
    : undefined;

  const matchedByName =
    !matchedById && cleanedName
      ? users.find((u) => cleanOperatorDisplayName(u.name).toLowerCase() === normalizedCleanedName)
      : undefined;

  const matchedUser = matchedById || matchedByName;

  const resolvedRole: RoleType =
    (doc.issuedByRole && ROLE_LABELS[doc.issuedByRole] ? doc.issuedByRole : undefined) ||
    (matchedUser?.role && ROLE_LABELS[matchedUser.role] ? matchedUser.role : undefined) ||
    inferRoleFromLegacyTag(doc.issuedByName) ||
    inferDefaultRoleByDocumentType(doc.documentType);

  const isPlaceholder = !cleanedName || GENERIC_PLACEHOLDER_NAMES.has(normalizedCleanedName);

  const resolvedName =
    (matchedById?.name?.trim()) ||
    (!isPlaceholder ? cleanedName : '') ||
    matchedUser?.name?.trim() ||
    users.find((u) => u.role === resolvedRole)?.name?.trim() ||
    ROLE_LABELS[resolvedRole]?.label ||
    'Diretor do Clube';

  return {
    userId: matchedUser?.id || doc.issuedByUserId,
    name: resolvedName,
    role: resolvedRole,
    roleLabel: ROLE_LABELS[resolvedRole]?.label || 'Diretor do Clube',
  };
}

export function resolveReceiptOperatorSigner(
  receipt: Pick<PaymentReceipt, 'treasurerUserId' | 'treasurerName' | 'treasurerRole'>,
  users: UserAccount[] = []
): ResolvedDocumentSigner {
  return resolveDocumentOperatorSigner(
    {
      issuedByUserId: receipt.treasurerUserId,
      issuedByName: receipt.treasurerName,
      issuedByRole: receipt.treasurerRole,
      documentType: 'recibo',
    },
    users
  );
}

export interface ResolvedMinuteOfficers {
  chairPersonUserId?: string;
  chairPersonName: string;
  chairPerson: string;
  secretaryUserId?: string;
  secretaryName: string;
  secretary: string;
}

/**
 * Regra institucional da Ata:
 * - O Presidente da Mesa é sempre o Diretor do Clube.
 * - O Secretário é sempre o secretário (utilizador autenticado) que está a redigir a ata.
 */
export function resolveMinuteOfficers(
  users: UserAccount[] = [],
  draftingUser?: { id?: string; name: string; role: RoleType } | null
): ResolvedMinuteOfficers {
  const directorUser =
    users.find((u) => u.role === 'diretor' && u.active !== false) ||
    users.find((u) => u.role === 'diretor');

  const chairPersonName =
    cleanOperatorDisplayName(directorUser?.name) || 'Diretor do Clube';
  const chairPerson = directorUser
    ? `${chairPersonName} (Diretor)`
    : 'Diretor do Clube';

  const fallbackSecretary =
    users.find((u) => u.role === 'secretario' && u.active !== false) ||
    users.find((u) => u.role === 'secretario');

  const resolvedDrafter = draftingUser || fallbackSecretary;
  const secretaryName =
    cleanOperatorDisplayName(resolvedDrafter?.name) || 'Secretário do Clube';
  const secretary = resolvedDrafter
    ? `${secretaryName} (Secretário)`
    : 'Secretário do Clube';

  return {
    chairPersonUserId: directorUser?.id,
    chairPersonName,
    chairPerson,
    secretaryUserId: resolvedDrafter?.id,
    secretaryName,
    secretary,
  };
}
