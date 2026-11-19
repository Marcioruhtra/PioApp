/**
 * Utilitários de Data e Hora adaptados para Angola (DD/MM/AAAA)
 */

export function formatDateAO(dateStringOrTimestamp?: string | number | Date | null): string {
  if (!dateStringOrTimestamp) return '-';

  try {
    const d = new Date(dateStringOrTimestamp);
    if (isNaN(d.getTime())) return String(dateStringOrTimestamp);

    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();

    return `${day}/${month}/${year}`;
  } catch {
    return String(dateStringOrTimestamp);
  }
}

export function formatDateTimeAO(dateStringOrTimestamp?: string | number | Date | null): string {
  if (!dateStringOrTimestamp) return '-';

  try {
    const d = new Date(dateStringOrTimestamp);
    if (isNaN(d.getTime())) return String(dateStringOrTimestamp);

    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');

    return `${day}/${month}/${year} às ${hours}:${minutes}`;
  } catch {
    return String(dateStringOrTimestamp);
  }
}

export function getTodayISODate(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

export function getNowISOString(): string {
  return new Date().toISOString();
}

export function getMonthNamePT(monthNumber: number): string {
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return months[monthNumber - 1] || `Mês ${monthNumber}`;
}

/**
 * Gera automaticamente o Número de Matrícula do membro segundo o padrão oficial:
 * EBX-XXXMMAA
 * Onde:
 * - EBX-: Prefixo oficial do clube
 * - XXX: Os 3 últimos carateres do Bilhete de Identidade (B.I.)
 * - MM: 2 dígitos do mês de nascimento
 * - AA: 2 últimos dígitos do ano de nascimento
 */
export function generateManualNumber(identityCardNumber: string, birthDate: string): string {
  const cleanBI = (identityCardNumber || '').trim().replace(/\s+/g, '').toUpperCase();
  const last3BI = cleanBI.length >= 3 ? cleanBI.slice(-3) : cleanBI.padEnd(3, '0').slice(-3);

  let mm = '01';
  let aa = '00';

  if (birthDate) {
    const parts = birthDate.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1];
      mm = month.padStart(2, '0');
      aa = year.length >= 2 ? year.slice(-2) : '00';
    }
  }

  return `EBX-${last3BI}${mm}${aa}`;
}

/**
 * Calcula a idade exata em anos a partir de uma data ISO (AAAA-MM-DD).
 */
export function calculateAgeYears(birthDateStr?: string, referenceDate: Date = new Date()): number | null {
  if (!birthDateStr) return null;
  const parts = birthDateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => isNaN(n))) return null;

  const [birthYear, birthMonth, birthDay] = parts;
  if (birthYear < 1900 || birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) {
    return null;
  }

  let age = referenceDate.getFullYear() - birthYear;
  const currentMonth = referenceDate.getMonth() + 1;
  const currentDay = referenceDate.getDate();

  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export type IdentityCardValidityStatus = 'valido' | 'a_expirar' | 'expirado' | 'nao_informada';

export interface IdentityCardValidityResult {
  status: IdentityCardValidityStatus;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number | null;
  label: string;
}

function parseISODateParts(dateStr?: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const match = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * Avalia o estado de validade do Bilhete de Identidade (B.I.) comparando com a data atual local.
 * - expirado: data de validade estritamente anterior ao dia de hoje
 * - a_expirar: expira hoje ou nos próximos 30 dias
 * - valido: mais de 30 dias restantes
 * - nao_informada: sem data registada (registos legados)
 */
export function evaluateIdentityCardValidity(
  expiryDate?: string,
  referenceDate: Date = new Date()
): IdentityCardValidityResult {
  const parts = parseISODateParts(expiryDate);
  if (!parts) {
    return {
      status: 'nao_informada',
      isExpired: false,
      isExpiringSoon: false,
      daysRemaining: null,
      label: 'Não informada',
    };
  }

  const expiryUTC = Date.UTC(parts.year, parts.month - 1, parts.day);
  const todayUTC = Date.UTC(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const daysRemaining = Math.round((expiryUTC - todayUTC) / 86400000);

  if (daysRemaining < 0) {
    return {
      status: 'expirado',
      isExpired: true,
      isExpiringSoon: false,
      daysRemaining,
      label: 'B.I. Expirado',
    };
  }

  if (daysRemaining === 0) {
    return {
      status: 'a_expirar',
      isExpired: false,
      isExpiringSoon: true,
      daysRemaining: 0,
      label: 'Expira hoje',
    };
  }

  if (daysRemaining <= 30) {
    return {
      status: 'a_expirar',
      isExpired: false,
      isExpiringSoon: true,
      daysRemaining,
      label: daysRemaining === 1 ? 'Expira amanhã' : `Expira em ${daysRemaining} dias`,
    };
  }

  return {
    status: 'valido',
    isExpired: false,
    isExpiringSoon: false,
    daysRemaining,
    label: 'Válido',
  };
}

const WEEKDAY_NAMES_PT = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo',
];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export interface WeeklyBirthdayEntry<T extends { birthDate: string; fullName: string }> {
  member: T;
  birthdayDateISO: string;
  dayOfWeekIndex: number; // 0 = Segunda .. 6 = Domingo
  weekdayLabel: string;
  dayMonthLabel: string;
  isToday: boolean;
  turningAge: number | null;
}

export function getCurrentWeekWindow(referenceDate: Date = new Date()): {
  start: Date;
  end: Date;
  startLabel: string;
  endLabel: string;
  days: Array<{ date: Date; iso: string; month: number; day: number; dayOfWeekIndex: number; weekdayLabel: string; dayMonthLabel: string; isToday: boolean }>;
} {
  const refLocal = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  // 0 (Dom) -> 6, 1 (Seg) -> 0, ...
  const offsetFromMonday = (refLocal.getDay() + 6) % 7;
  const start = new Date(refLocal);
  start.setDate(refLocal.getDate() - offsetFromMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const todayYear = refLocal.getFullYear();
  const todayMonth = refLocal.getMonth() + 1;
  const todayDay = refLocal.getDate();

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayMonthLabel = `${String(day).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
    return {
      date: d,
      iso,
      month: m,
      day,
      dayOfWeekIndex: i,
      weekdayLabel: WEEKDAY_NAMES_PT[i],
      dayMonthLabel,
      isToday: y === todayYear && m === todayMonth && day === todayDay,
    };
  });

  return {
    start,
    end,
    startLabel: days[0].dayMonthLabel,
    endLabel: days[6].dayMonthLabel,
    days,
  };
}

/**
 * Retorna os membros (ativos/inativos, excluindo arquivados e transferidos) que fazem aniversário na semana atual (Segunda a Domingo).
 */
export function getWeeklyBirthdayMembers<
  T extends { birthDate: string; fullName: string; status?: string }
>(members: T[], referenceDate: Date = new Date()): WeeklyBirthdayEntry<T>[] {
  const week = getCurrentWeekWindow(referenceDate);
  const results: WeeklyBirthdayEntry<T>[] = [];

  for (const member of members || []) {
    if (!member) continue;
    if (member.status === 'arquivado' || member.status === 'transferido') continue;

    const birth = parseISODateParts(member.birthDate);
    if (!birth) continue;

    const matchedDay = week.days.find((wd) => {
      if (wd.month === birth.month && wd.day === birth.day) return true;
      // Aniversário em 29/02 em ano não bissexto celebra-se no dia 28/02
      if (birth.month === 2 && birth.day === 29 && !isLeapYear(wd.date.getFullYear())) {
        return wd.month === 2 && wd.day === 28;
      }
      return false;
    });

    if (matchedDay) {
      const turningAge = matchedDay.date.getFullYear() - birth.year;
      results.push({
        member,
        birthdayDateISO: matchedDay.iso,
        dayOfWeekIndex: matchedDay.dayOfWeekIndex,
        weekdayLabel: matchedDay.weekdayLabel,
        dayMonthLabel: matchedDay.dayMonthLabel,
        isToday: matchedDay.isToday,
        turningAge: turningAge >= 0 ? turningAge : null,
      });
    }
  }

  return results.sort((a, b) => {
    if (a.dayOfWeekIndex !== b.dayOfWeekIndex) {
      return a.dayOfWeekIndex - b.dayOfWeekIndex;
    }
    return String(a.member.fullName || '').localeCompare(String(b.member.fullName || ''), 'pt');
  });
}

/**
 * Retorna os membros (não arquivados nem transferidos) cujo Bilhete de Identidade (B.I.) já expirou.
 */
export function getExpiredIdentityCardMembers<
  T extends { identityCardExpiryDate?: string; fullName: string; status?: string }
>(members: T[], referenceDate: Date = new Date()): Array<{ member: T; validity: IdentityCardValidityResult }> {
  const expired: Array<{ member: T; validity: IdentityCardValidityResult }> = [];
  for (const member of members || []) {
    if (!member) continue;
    if (member.status === 'arquivado' || member.status === 'transferido') continue;
    const validity = evaluateIdentityCardValidity(member.identityCardExpiryDate, referenceDate);
    if (validity.isExpired) {
      expired.push({ member, validity });
    }
  }
  return expired.sort((a, b) => {
    const da = a.validity.daysRemaining ?? 0;
    const db = b.validity.daysRemaining ?? 0;
    if (da !== db) return da - db; // Mais expirado primeiro
    return String(a.member.fullName || '').localeCompare(String(b.member.fullName || ''), 'pt');
  });
}

