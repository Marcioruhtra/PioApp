import {
  ClubSettings,
  ExpenseRequest,
  FeeDefinition,
  Member,
  ModuleName,
  PaymentReceipt,
  PermissionAction,
  QuotaConfig,
  QuotaDebtWaiver,
  RoleType,
  TreasuryAccount,
} from '../types';
import { ROLE_PERMISSIONS_MATRIX, hasPermission } from './permissionService';

export type MemberQuotaStatus = 'regularizado' | 'parcial' | 'em_atraso' | 'antecipado';

export interface MemberQuotaSummary {
  member: Member;
  unitQuotaInCents: number;
  frequency: QuotaConfig['frequency'];
  effectiveStartDate: string;
  periodsCharged: number;
  grossDueInCents: number;
  totalWaivedInCents: number;
  totalDueInCents: number;
  totalPaidInCents: number;
  balanceDueInCents: number;
  creditInCents: number;
  paidPeriodsEquivalent: number;
  remainingPeriods: number;
  progressPercent: number;
  status: MemberQuotaStatus;
  quotaReceipts: PaymentReceipt[];
  quotaWaivers: QuotaDebtWaiver[];
  lastPaymentDate?: string;
  lastWaiverDate?: string;
}

export interface ClubQuotaTotals {
  totalMembers: number;
  totalGrossDueInCents: number;
  totalWaivedInCents: number;
  totalDueInCents: number;
  totalPaidInCents: number;
  totalBalanceDueInCents: number;
  totalCreditInCents: number;
  regularizedCount: number;
  partialCount: number;
  overdueCount: number;
  inDebtCount: number;
  complianceRatePercent: number;
}

const MS_PER_DAY = 86_400_000;
export const DEFAULT_SUNDAY_QUOTA_CENTS = 50_000; // 500,00 Kz por domingo
export const DEFAULT_QUOTA_FEE_ID = 'FEE-QUOTA-DOMINGO';

/**
 * Analisa uma data ISO (YYYY-MM-DD ou timestamp ISO) como data de calendário UTC pura,
 * evitando desvios de fuso horário local.
 */
export function parseISOCalendarDateUTC(dateStr?: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

export function formatCalendarDateISO(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addCalendarDaysISO(dateStr: string, days: number): string {
  const parsed = parseISOCalendarDateUTC(dateStr);
  if (!parsed) return dateStr;
  return formatCalendarDateISO(new Date(parsed.getTime() + days * MS_PER_DAY));
}

export function getFirstDayOfNextMonthISO(dateStr: string): string {
  const parsed = parseISOCalendarDateUTC(dateStr);
  if (!parsed) return dateStr;
  const nextMonth = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 1));
  return formatCalendarDateISO(nextMonth);
}

/**
 * Calcula a nova data de início de contagem de quotas após uma limpeza da nuvem,
 * garantindo que os períodos já liquidados/transportados até à data da limpeza não voltem a ser cobrados.
 */
export function advanceCycleStartDateAfterCleanup(
  config: QuotaConfig,
  cleanupDateStr: string = getTodayISODate()
): string {
  const nextStart =
    config.frequency === 'mensal'
      ? getFirstDayOfNextMonthISO(cleanupDateStr)
      : addCalendarDaysISO(cleanupDateStr, 1);

  const currentStartParsed = parseISOCalendarDateUTC(config.cycleStartDate);
  const nextStartParsed = parseISOCalendarDateUTC(nextStart);
  if (currentStartParsed && nextStartParsed && currentStartParsed.getTime() > nextStartParsed.getTime()) {
    return formatCalendarDateISO(currentStartParsed);
  }
  return nextStart;
}

/**
 * Conta exatamente quantos domingos existem entre startDateStr e endDateStr (ambos inclusivos).
 * Cada domingo representa um dia regular de atividade onde a Quota do clube é cobrada.
 */
export function countChargeableSundays(startDateStr: string, endDateStr: string): number {
  const start = parseISOCalendarDateUTC(startDateStr);
  const end = parseISOCalendarDateUTC(endDateStr);
  if (!start || !end) return 0;

  const startMs = start.getTime();
  const endMs = end.getTime();
  if (startMs > endMs) return 0;

  const dayOfWeek = start.getUTCDay(); // 0 = Domingo
  const daysToFirstSunday = (7 - dayOfWeek) % 7;
  const firstSundayMs = startMs + daysToFirstSunday * MS_PER_DAY;
  if (firstSundayMs > endMs) return 0;

  return Math.floor((endMs - firstSundayMs) / (7 * MS_PER_DAY)) + 1;
}

/**
 * Lista todas as datas de domingos cobráveis (YYYY-MM-DD) num intervalo.
 */
export function listChargeableSundays(startDateStr: string, endDateStr: string): string[] {
  const start = parseISOCalendarDateUTC(startDateStr);
  const end = parseISOCalendarDateUTC(endDateStr);
  if (!start || !end) return [];

  const startMs = start.getTime();
  const endMs = end.getTime();
  if (startMs > endMs) return [];

  const daysToFirstSunday = (7 - start.getUTCDay()) % 7;
  let currentMs = startMs + daysToFirstSunday * MS_PER_DAY;
  const result: string[] = [];
  while (currentMs <= endMs) {
    result.push(formatCalendarDateISO(new Date(currentMs)));
    currentMs += 7 * MS_PER_DAY;
  }
  return result;
}

/**
 * Conta meses inclusivos entre duas datas no mesmo ciclo.
 */
export function countChargeableMonths(startDateStr: string, endDateStr: string): number {
  const start = parseISOCalendarDateUTC(startDateStr);
  const end = parseISOCalendarDateUTC(endDateStr);
  if (!start || !end) return 0;
  if (start.getTime() > end.getTime()) return 0;

  const monthsDiff =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1;
  return Math.max(0, monthsDiff);
}

/**
 * Verifica pela Grelha de Permissões (ou matriz institucional) se o papel pode definir/alterar o valor das quotas.
 */
export function hasConfigureQuotaPermission(
  role: RoleType,
  permissionsMatrix?: Record<RoleType, Record<ModuleName, PermissionAction[]>>
): boolean {
  if (role === 'admin_tecnico') return true;
  if (permissionsMatrix && permissionsMatrix[role] && Array.isArray(permissionsMatrix[role].treasury)) {
    return permissionsMatrix[role].treasury.includes('CONFIGURE_QUOTAS');
  }
  return (
    hasPermission(role, 'treasury', 'CONFIGURE_QUOTAS') ||
    Boolean(ROLE_PERMISSIONS_MATRIX[role]?.treasury?.includes('CONFIGURE_QUOTAS'))
  );
}

/**
 * Verifica pela Grelha de Permissões (definida pelo Administrador) se o papel pode zerar dívidas de quotas.
 */
export function hasWaiveQuotaDebtPermission(
  role: RoleType,
  permissionsMatrix?: Record<RoleType, Record<ModuleName, PermissionAction[]>>
): boolean {
  if (role === 'admin_tecnico') return true;
  if (permissionsMatrix && permissionsMatrix[role] && Array.isArray(permissionsMatrix[role].treasury)) {
    return permissionsMatrix[role].treasury.includes('WAIVE_QUOTA_DEBT');
  }
  return (
    hasPermission(role, 'treasury', 'WAIVE_QUOTA_DEBT') ||
    Boolean(ROLE_PERMISSIONS_MATRIX[role]?.treasury?.includes('WAIVE_QUOTA_DEBT'))
  );
}

/**
 * Obtém a configuração efetiva das Quotas com fallback seguro para bases legadas.
 */
export function resolveQuotaConfig(
  settings?: Partial<ClubSettings>,
  fees: FeeDefinition[] = []
): QuotaConfig {
  const year = settings?.currentYear || new Date().getFullYear();
  const configured = settings?.quotaConfig;

  const dailyQuotaFee =
    fees.find((f) => f.id === configured?.activeQuotaFeeId) ||
    fees.find((f) => f.id === DEFAULT_QUOTA_FEE_ID) ||
    fees.find((f) => f.active && f.category === 'quota_diaria') ||
    fees.find((f) => f.active && f.category === 'quota_mensal');

  const fallbackAmount = dailyQuotaFee?.amountInCents && dailyQuotaFee.amountInCents > 0
    ? Math.round(dailyQuotaFee.amountInCents)
    : DEFAULT_SUNDAY_QUOTA_CENTS;

  return {
    amountInCents:
      typeof configured?.amountInCents === 'number' && configured.amountInCents >= 0
        ? Math.round(configured.amountInCents)
        : fallbackAmount,
    categoryAmountsInCents: configured?.categoryAmountsInCents,
    frequency: configured?.frequency === 'mensal' ? 'mensal' : 'domingo',
    cycleStartDate: configured?.cycleStartDate || `${year}-01-01`,
    respectMemberJoinDate: configured?.respectMemberJoinDate ?? true,
    activeQuotaFeeId: configured?.activeQuotaFeeId || dailyQuotaFee?.id || DEFAULT_QUOTA_FEE_ID,
    updatedAt: configured?.updatedAt,
    updatedByUserId: configured?.updatedByUserId,
    updatedByName: configured?.updatedByName,
  };
}

/**
 * Retorna o valor unitário de Quota aplicável ao membro (suporta diferenciação opcional por categoria).
 */
export function resolveUnitQuotaForMember(member: Member, config: QuotaConfig): number {
  const override = config.categoryAmountsInCents?.[member.category];
  if (typeof override === 'number' && !Number.isNaN(override) && override >= 0) {
    return Math.round(override);
  }
  return Math.max(0, Math.round(config.amountInCents || 0));
}

/**
 * Determina se um recibo pertence a pagamento válido de Quota dentro do ciclo ativo.
 */
export function isQuotaReceiptForCycle(
  receipt: PaymentReceipt,
  config: QuotaConfig,
  fees: FeeDefinition[]
): boolean {
  if (!receipt || receipt.isCancelled || receipt.status === 'anulado') return false;

  const fee = fees.find((f) => f.id === receipt.feeDefinitionId);
  const titleLower = (receipt.feeTitle || '').toLowerCase();
  const isQuotaCategory =
    receipt.feeDefinitionId === config.activeQuotaFeeId ||
    receipt.feeDefinitionId === DEFAULT_QUOTA_FEE_ID ||
    fee?.category === 'quota_diaria' ||
    fee?.category === 'quota_mensal' ||
    titleLower.includes('quota');

  if (!isQuotaCategory) return false;

  // Considera recibos do mesmo ano fiscal (ou posterior) para preservar pagamentos antecipados no ano corrente
  const cycleYear = Number((config.cycleStartDate || '').slice(0, 4));
  const receiptYear = Number((receipt.paidAt || '').slice(0, 4));
  if (cycleYear > 0 && receiptYear > 0 && receiptYear < cycleYear) {
    return false;
  }

  return true;
}

export function doesReceiptBelongToMember(receipt: PaymentReceipt, member: Member): boolean {
  if (!receipt || !member) return false;
  if (receipt.memberId && receipt.memberId === member.id) return true;
  if (member.manualNumber && receipt.memberId && receipt.memberId === member.manualNumber) return true;
  if (
    receipt.memberName &&
    member.fullName &&
    receipt.memberName.trim().toLowerCase() === member.fullName.trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

export function doesWaiverBelongToMember(waiver: QuotaDebtWaiver, member: Member): boolean {
  if (!waiver || !member) return false;
  if (waiver.memberId && waiver.memberId === member.id) return true;
  if (member.manualNumber && waiver.memberId && waiver.memberId === member.manualNumber) return true;
  if (
    waiver.memberName &&
    member.fullName &&
    waiver.memberName.trim().toLowerCase() === member.fullName.trim().toLowerCase()
  ) {
    return true;
  }
  return false;
}

/**
 * Calcula e recalcula em tempo real quanto o membro deve de Quota, quanto já pagou,
 * eventuais dívidas zeradas/perdoadas, saldo devedor ou crédito antecipado, com precisão em cêntimos inteiros.
 */
export function calculateMemberQuotaSummary(
  member: Member,
  config: QuotaConfig,
  fees: FeeDefinition[],
  receipts: PaymentReceipt[],
  referenceDateStr: string = getTodayISODate(),
  quotaWaivers: QuotaDebtWaiver[] = []
): MemberQuotaSummary {
  const unitQuotaInCents = resolveUnitQuotaForMember(member, config);

  const cycleStartParsed = parseISOCalendarDateUTC(config.cycleStartDate);
  const refParsed = parseISOCalendarDateUTC(referenceDateStr) || parseISOCalendarDateUTC(getTodayISODate())!;

  let effectiveStartDate = cycleStartParsed
    ? formatCalendarDateISO(cycleStartParsed)
    : `${new Date().getUTCFullYear()}-01-01`;

  if (config.respectMemberJoinDate) {
    const memberJoinParsed =
      parseISOCalendarDateUTC(member.joinedDate) || parseISOCalendarDateUTC(member.createdAt);
    if (memberJoinParsed && cycleStartParsed && memberJoinParsed.getTime() > cycleStartParsed.getTime()) {
      effectiveStartDate = formatCalendarDateISO(memberJoinParsed);
    }
  }

  const refDateISO = formatCalendarDateISO(refParsed);
  const periodsCharged =
    config.frequency === 'mensal'
      ? countChargeableMonths(effectiveStartDate, refDateISO)
      : countChargeableSundays(effectiveStartDate, refDateISO);

  const carryDebt = Math.max(0, Math.round(member.quotaCarryOver?.debtInCents || 0));
  const carryCredit = Math.max(0, Math.round(member.quotaCarryOver?.creditInCents || 0));
  const carryWaived = Math.max(0, Math.round(member.quotaCarryOver?.waivedInCents || 0));

  const newPeriodsGrossDueInCents = Math.max(0, periodsCharged * unitQuotaInCents);
  const grossDueInCents = newPeriodsGrossDueInCents + carryDebt + carryWaived;

  const cycleYear = Number((config.cycleStartDate || '').slice(0, 4)) || new Date().getUTCFullYear();
  const memberWaivers = (quotaWaivers || [])
    .filter(
      (w) =>
        w &&
        !w.isReversed &&
        doesWaiverBelongToMember(w, member) &&
        (!w.cycleYear || w.cycleYear >= cycleYear)
    )
    .sort((a, b) => (b.waivedAt || '').localeCompare(a.waivedAt || ''));

  const activeWaivedInCents = memberWaivers.reduce(
    (sum, w) => sum + Math.max(0, Math.round(w.amountWaivedInCents || 0)),
    0
  );
  const totalWaivedInCents = carryWaived + activeWaivedInCents;

  const totalDueInCents = Math.max(0, grossDueInCents - totalWaivedInCents);

  const quotaReceipts = receipts
    .filter((r) => isQuotaReceiptForCycle(r, config, fees) && doesReceiptBelongToMember(r, member))
    .sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''));

  const receiptsPaidInCents = quotaReceipts.reduce(
    (sum, r) => sum + Math.max(0, Math.round(r.amountPaidInCents || 0)),
    0
  );
  const totalPaidInCents = receiptsPaidInCents + carryCredit;

  const balanceDueInCents = Math.max(0, totalDueInCents - totalPaidInCents);
  const creditInCents = Math.max(0, totalPaidInCents - totalDueInCents);

  const paidPeriodsEquivalent =
    unitQuotaInCents > 0 ? Math.floor(totalPaidInCents / unitQuotaInCents) : 0;
  const remainingPeriods =
    unitQuotaInCents > 0 ? Math.ceil(balanceDueInCents / unitQuotaInCents) : 0;

  const progressPercent =
    totalDueInCents > 0
      ? Math.min(100, Math.round((totalPaidInCents / totalDueInCents) * 100))
      : 100;

  let status: MemberQuotaStatus = 'regularizado';
  if (balanceDueInCents === 0 && creditInCents > 0) {
    status = 'antecipado';
  } else if (balanceDueInCents === 0) {
    status = 'regularizado';
  } else if (totalPaidInCents > 0) {
    status = 'parcial';
  } else {
    status = 'em_atraso';
  }

  return {
    member,
    unitQuotaInCents,
    frequency: config.frequency,
    effectiveStartDate,
    periodsCharged,
    grossDueInCents,
    totalWaivedInCents,
    totalDueInCents,
    totalPaidInCents,
    balanceDueInCents,
    creditInCents,
    paidPeriodsEquivalent,
    remainingPeriods,
    progressPercent,
    status,
    quotaReceipts,
    quotaWaivers: memberWaivers,
    lastPaymentDate: quotaReceipts[0]?.paidAt,
    lastWaiverDate: memberWaivers[0]?.waivedAt,
  };
}

/**
 * Totais agregados de Quotas do Clube a partir dos resumos individuais.
 */
export function calculateClubQuotaTotals(summaries: MemberQuotaSummary[]): ClubQuotaTotals {
  let totalGrossDueInCents = 0;
  let totalWaivedInCents = 0;
  let totalDueInCents = 0;
  let totalPaidInCents = 0;
  let totalPaidCappedInCents = 0;
  let totalBalanceDueInCents = 0;
  let totalCreditInCents = 0;
  let regularizedCount = 0;
  let partialCount = 0;
  let overdueCount = 0;
  let inDebtCount = 0;

  for (const s of summaries) {
    totalGrossDueInCents += s.grossDueInCents;
    totalWaivedInCents += s.totalWaivedInCents;
    totalDueInCents += s.totalDueInCents;
    totalPaidInCents += s.totalPaidInCents;
    totalPaidCappedInCents += Math.min(s.totalPaidInCents, s.totalDueInCents);
    totalBalanceDueInCents += s.balanceDueInCents;
    totalCreditInCents += s.creditInCents;

    if (s.status === 'regularizado' || s.status === 'antecipado') {
      regularizedCount++;
    } else if (s.status === 'parcial') {
      partialCount++;
      inDebtCount++;
    } else {
      overdueCount++;
      inDebtCount++;
    }
  }

  const complianceRatePercent =
    totalDueInCents > 0
      ? Math.min(100, Math.round((totalPaidCappedInCents / totalDueInCents) * 100))
      : 100;

  return {
    totalMembers: summaries.length,
    totalGrossDueInCents,
    totalWaivedInCents,
    totalDueInCents,
    totalPaidInCents,
    totalBalanceDueInCents,
    totalCreditInCents,
    regularizedCount,
    partialCount,
    overdueCount,
    inDebtCount,
    complianceRatePercent,
  };
}

/**
 * Identifica se uma definição de taxa corresponde à Quota Regular fixa (gerida exclusivamente na aba Quotas),
 * não devendo aparecer na gestão geral de "Rubricas Financeiras".
 */
export function isFixedQuotaRubric(
  fee?: Partial<FeeDefinition> | null,
  settings?: Partial<ClubSettings>,
  fees: FeeDefinition[] = []
): boolean {
  if (!fee) return false;
  if (fee.id === DEFAULT_QUOTA_FEE_ID) return true;

  const activeQuotaFeeId = settings?.quotaConfig?.activeQuotaFeeId;
  if (activeQuotaFeeId && fee.id === activeQuotaFeeId) return true;

  const titleLower = (fee.title || '').trim().toLowerCase();
  if (
    titleLower === 'quota regular (cada domingo)' ||
    titleLower === 'quota regular (mensal)'
  ) {
    return true;
  }

  const resolvedConfig = resolveQuotaConfig(settings, fees);
  if (resolvedConfig.activeQuotaFeeId && fee.id === resolvedConfig.activeQuotaFeeId) {
    return true;
  }

  return false;
}

/**
 * Constrói a opção fixa da Quota Regular ("Quota Regular (Cada Domingo)" / "Quota Regular (Mensal)")
 * com o valor oficial definido na configuração de Quotas, mesmo em bases limpas onde a rubrica
 * não tenha sido gravada em `state.fees`.
 */
export function buildFixedQuotaFeeDefinition(
  settings?: Partial<ClubSettings>,
  fees: FeeDefinition[] = []
): FeeDefinition {
  const quotaConfig = resolveQuotaConfig(settings, fees);
  const feeId = quotaConfig.activeQuotaFeeId || DEFAULT_QUOTA_FEE_ID;
  const existingFixed = (fees || []).find(
    (f) => f && (f.id === feeId || f.id === DEFAULT_QUOTA_FEE_ID)
  );
  const isMonthly = quotaConfig.frequency === 'mensal';
  const defaultTitle = isMonthly
    ? 'Quota Regular (Mensal)'
    : 'Quota Regular (Cada Domingo)';

  return {
    id: existingFixed?.id || feeId,
    title:
      !existingFixed || existingFixed.id === DEFAULT_QUOTA_FEE_ID
        ? defaultTitle
        : existingFixed.title,
    category: isMonthly ? 'quota_mensal' : 'quota_diaria',
    periodicity: isMonthly ? 'mensal' : 'diaria',
    amountInCents: quotaConfig.amountInCents,
    targetCategory: existingFixed?.targetCategory || 'todas',
    active: true,
    year: settings?.currentYear || new Date().getFullYear(),
  };
}

/**
 * Retorna apenas as rubricas geridas na aba "Rubricas Financeiras",
 * omitindo a quota fixa ("Quota Regular (Cada Domingo)") que possui aba própria.
 */
export function getRubricsCatalogFees(
  fees: FeeDefinition[] = [],
  settings?: Partial<ClubSettings>
): FeeDefinition[] {
  return (fees || []).filter((fee) => !isFixedQuotaRubric(fee, settings, fees));
}

/**
 * Retorna a lista completa de opções para "Taxa / Quota Institucional" (e Portal do Membro),
 * garantindo que a Quota Regular fixa ("Quota Regular (Cada Domingo)") esteja SEMPRE presente
 * sem duplicações, seguida das demais rubricas configuradas.
 */
export function getSelectableInstitutionalFees(
  fees: FeeDefinition[] = [],
  settings?: Partial<ClubSettings>
): FeeDefinition[] {
  const fixedQuota = buildFixedQuotaFeeDefinition(settings, fees);
  const regularRubrics = getRubricsCatalogFees(fees, settings).filter(
    (fee) => fee.id !== fixedQuota.id
  );
  return [fixedQuota, ...regularRubrics];
}

/**
 * Resolve a conta institucional exata associada a um recibo:
 * 1) `receipt.accountId` salvo na emissão/regularização/aprovação;
 * 2) `receipt.accountName` ou menção de conta nas notas;
 * 3) Fallback por método de pagamento respeitando IDs reais (inclusive bases limpas como ACC-1).
 */
export function resolveReceiptTargetAccountId(
  receipt: Pick<PaymentReceipt, 'accountId' | 'accountName' | 'paymentMethod' | 'notes'>,
  accounts: TreasuryAccount[] = []
): string | undefined {
  if (!Array.isArray(accounts) || accounts.length === 0) return undefined;

  if (receipt.accountId) {
    const exactById = accounts.find((acc) => acc.id === receipt.accountId);
    if (exactById) return exactById.id;
  }

  if (receipt.accountName) {
    const cleanName = receipt.accountName.trim().toLowerCase();
    const exactByName = accounts.find((acc) => acc.name.trim().toLowerCase() === cleanName);
    if (exactByName) return exactByName.id;
  }

  if (receipt.notes) {
    const noteLower = receipt.notes.toLowerCase();
    const matchedInNotes = accounts.find((acc) =>
      noteLower.includes(acc.name.trim().toLowerCase())
    );
    if (matchedInNotes) return matchedInNotes.id;
  }

  if (receipt.paymentMethod === 'numerario') {
    return (
      accounts.find((acc) => acc.id === 'ACC-01')?.id ||
      accounts.find((acc) => acc.type === 'caixa' && acc.active)?.id ||
      accounts.find((acc) => acc.type === 'caixa')?.id ||
      accounts.find((acc) => acc.active)?.id ||
      accounts[0]?.id
    );
  }

  return (
    accounts.find((acc) => acc.id === 'ACC-02')?.id ||
    accounts.find((acc) => acc.type === 'banco' && acc.active)?.id ||
    accounts.find((acc) => acc.type === 'banco')?.id ||
    accounts.find((acc) => acc.active)?.id ||
    accounts[0]?.id
  );
}

/**
 * Estorna o valor de um recibo anulado da conta exata em que foi lançado
 * (deduzindo automaticamente do saldo da conta selecionada e da Disponibilidade Geral).
 */
export function reverseReceiptFromTreasuryAccounts(
  receipt: Pick<PaymentReceipt, 'accountId' | 'accountName' | 'paymentMethod' | 'notes' | 'amountPaidInCents'>,
  accounts: TreasuryAccount[] = []
): {
  updatedAccounts: TreasuryAccount[];
  targetAccountId?: string;
  targetAccountName?: string;
} {
  const targetAccountId = resolveReceiptTargetAccountId(receipt, accounts);
  if (!targetAccountId) {
    return { updatedAccounts: accounts };
  }

  let targetAccountName: string | undefined;
  const updatedAccounts = accounts.map((acc) => {
    if (acc.id === targetAccountId) {
      targetAccountName = acc.name;
      return {
        ...acc,
        currentBalanceInCents: acc.currentBalanceInCents - receipt.amountPaidInCents,
      };
    }
    return acc;
  });

  return { updatedAccounts, targetAccountId, targetAccountName };
}

/**
 * Verifica se uma data ISO pertence exatamente ao ano e mês (1-12) do fecho fiscal.
 */
export function isIsoDateInFiscalMonth(
  dateStr: string | undefined,
  year: number,
  month: number
): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) {
    return Number(isoMatch[1]) === year && Number(isoMatch[2]) === month;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() + 1 === month;
}

/**
 * Calcula receitas, despesas pagas e saldo apurado estritamente para o mês/ano fiscal alvo,
 * excluindo recibos anulados e despesas não liquidadas.
 */
export function calculateMonthlyFiscalSummary(
  receipts: PaymentReceipt[] = [],
  expenses: ExpenseRequest[] = [],
  year: number,
  month: number
): {
  totalIncomeInCents: number;
  totalExpenseInCents: number;
  closingBalanceInCents: number;
} {
  const totalIncomeInCents = (receipts || [])
    .filter(
      (r) =>
        r &&
        !r.isCancelled &&
        r.status !== 'anulado' &&
        isIsoDateInFiscalMonth(r.paidAt, year, month)
    )
    .reduce((acc, curr) => acc + Math.max(0, Math.round(curr.amountPaidInCents || 0)), 0);

  const totalExpenseInCents = (expenses || [])
    .filter(
      (e) =>
        e &&
        e.status === 'pago' &&
        isIsoDateInFiscalMonth(e.paidAt || e.createdAt, year, month)
    )
    .reduce((acc, curr) => acc + Math.max(0, Math.round(curr.amountInCents || 0)), 0);

  return {
    totalIncomeInCents,
    totalExpenseInCents,
    closingBalanceInCents: totalIncomeInCents - totalExpenseInCents,
  };
}
