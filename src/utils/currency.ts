/**
 * Utilitários de Aritmética e Formatação Financeira para Kwanza (Kz)
 * REGRA CRÍTICA: Não usar float binário como fonte de verdade.
 * Todos os valores são guardados como inteiros de cêntimos (1 Kz = 100 cêntimos).
 * Exemplo: 2.500,00 Kz = 250000 cêntimos inteiros.
 */

/**
 * Converte valor em cêntimos para string formatada em Kwanza (Angola).
 * Exemplo: 250000 -> "2.500,00 Kz"
 */
export function formatKz(cents: number | undefined | null): string {
  if (cents === undefined || cents === null || isNaN(cents)) {
    return '0,00 Kz';
  }

  const isNegative = cents < 0;
  const absCents = Math.abs(Math.round(cents));
  const kwanzas = Math.floor(absCents / 100);
  const centimos = absCents % 100;

  // Formata os milhares com separador de ponto (.) comum em Angola
  const kwanzasStr = kwanzas.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centimosStr = centimos.toString().padStart(2, '0');

  const formatted = `${kwanzasStr},${centimosStr} Kz`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Converte valor introduzido pelo utilizador em Kwanza para cêntimos inteiros seguros.
 * Suporta formatos: "2500", "2500,50", "2.500,00", "2500.50".
 */
export function parseKzToCents(input: string | number): number {
  if (typeof input === 'number') {
    return Math.round(input * 100);
  }

  if (!input || typeof input !== 'string') return 0;

  // Remove espaços e símbolo Kz
  let cleaned = input.trim().replace(/Kz/gi, '').trim();

  // Se tiver pontos de milhar e vírgula decimal (ex: 2.500,50)
  if (cleaned.includes('.') && cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;

  // Arredondamento explícito para evitar 2499.9999999999995
  return Math.round(num * 100);
}

/**
 * Soma segura de array de cêntimos
 */
export function sumCents(values: number[]): number {
  return values.reduce((acc, curr) => acc + Math.round(curr || 0), 0);
}

/**
 * Subtração segura de cêntimos
 */
export function subtractCents(a: number, b: number): number {
  return Math.round(a || 0) - Math.round(b || 0);
}
