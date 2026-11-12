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

