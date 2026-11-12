/**
 * Sanitizador Oficial de Textos para Documentos Oficiais
 * Remove rigorosamente e exclusivamente:
 * - «Conferência Geral dos Embaixadores»
 * - «República de Angola»
 * Sem acrescentar qualquer texto, designação ou elemento no seu lugar.
 */
export function sanitizeOfficialDocumentText(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/Conferência Geral dos Embaixadores/gi, '')
    .replace(/República de Angola/gi, '');
}
