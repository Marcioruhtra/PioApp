/**
 * Utilitário para processamento e compressão de comprovativos (Imagens e PDFs)
 * Evita sobrecarga de memória, erros de quota do LocalStorage e do Firestore.
 * Limite máximo atualizado para 2 MB por ficheiro.
 */

export const MAX_UPLOAD_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

export function validateUploadFileSize(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_UPLOAD_FILE_BYTES) {
    return {
      valid: false,
      error: 'O ficheiro excede o limite máximo de 2 MB. Por favor selecione um ficheiro mais leve.',
    };
  }
  return { valid: true };
}

export interface ProcessedFile {
  fileName: string;
  base64: string;
  sizeInKB: number;
  isImage: boolean;
}

export async function processProofFile(file: File): Promise<ProcessedFile> {
  if (file.size > MAX_UPLOAD_FILE_BYTES) {
    throw new Error('O ficheiro excede o limite máximo de 2 MB. Por favor selecione um ficheiro mais leve.');
  }

  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (isImage) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Falha ao processar o formato da imagem.'));
        img.onload = () => {
          try {
            // Redimensionar para tamanho máximo otimizado (max 900px)
            const MAX_DIM = 900;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_DIM) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              }
            } else {
              if (height > MAX_DIM) {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve({
                fileName: file.name,
                base64: e.target?.result as string,
                sizeInKB: Math.round(file.size / 1024),
                isImage: true,
              });
              return;
            }

            // Fundo branco caso haja transparência
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            // Compressão em JPEG a 72% de qualidade (ótimo para comprovativos bancários e recibos)
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.72);
            const sizeInKB = Math.round((compressedBase64.length * 0.75) / 1024);

            resolve({
              fileName: file.name.replace(/\.[^/.]+$/, '') + '.jpg',
              base64: compressedBase64,
              sizeInKB,
              isImage: true,
            });
          } catch (err) {
            reject(err);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  if (isPdf) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Falha ao ler o ficheiro PDF.'));
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        resolve({
          fileName: file.name,
          base64,
          sizeInKB: Math.round(file.size / 1024),
          isImage: false,
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // Outros formatos
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o ficheiro.'));
    reader.onload = (e) => {
      resolve({
        fileName: file.name,
        base64: e.target?.result as string,
        sizeInKB: Math.round(file.size / 1024),
        isImage: false,
      });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Processamento e compressão de foto de perfil para o Cartão Digital de Membro.
 * Redimensiona para formato padrão 400x480 (proporção 3x4 de cartão/passe),
 * comprimindo para JPEG (~25-45KB) para preservar o armazenamento e sincronização no Firestore.
 */
export async function processProfilePhoto(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_FILE_BYTES) {
    throw new Error('A imagem excede o limite máximo de 2 MB. Por favor selecione um ficheiro mais leve.');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Por favor selecione um ficheiro de imagem válido (JPEG, PNG ou WebP).');
  }



  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o ficheiro de imagem.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem inválido ou corrompido.'));
      img.onload = () => {
        try {
          const TARGET_WIDTH = 400;
          const TARGET_HEIGHT = 480;

          const canvas = document.createElement('canvas');
          canvas.width = TARGET_WIDTH;
          canvas.height = TARGET_HEIGHT;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          // Fundo branco caso haja transparência
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);

          // Cortar proporcionalmente ao centro (object-fit: cover)
          const imgAspect = img.width / img.height;
          const targetAspect = TARGET_WIDTH / TARGET_HEIGHT;

          let sWidth = img.width;
          let sHeight = img.height;
          let sx = 0;
          let sy = 0;

          if (imgAspect > targetAspect) {
            sWidth = Math.round(img.height * targetAspect);
            sx = Math.round((img.width - sWidth) / 2);
          } else {
            sHeight = Math.round(img.width / targetAspect);
            sy = Math.round((img.height - sHeight) / 2);
          }

          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);

          // Compressão em JPEG a 82% (excelente nitidez e ficheiro leve)
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          resolve(compressed);
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export type DocumentPreviewKind = 'image' | 'pdf' | 'text' | 'other';

export function getDocumentPreviewKind(base64OrUrl: string, fileName?: string): DocumentPreviewKind {
  const lowerSrc = String(base64OrUrl || '').trim().toLowerCase();
  const lowerName = String(fileName || '').trim().toLowerCase();

  if (
    lowerSrc.startsWith('data:image/') ||
    /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/.test(lowerName)
  ) {
    return 'image';
  }

  if (lowerSrc.startsWith('data:application/pdf') || lowerName.endsWith('.pdf')) {
    return 'pdf';
  }

  if (
    lowerSrc.startsWith('data:text/plain') ||
    lowerName.endsWith('.txt')
  ) {
    return 'text';
  }

  return 'other';
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const trimmed = String(dataUrl || '').trim();
    if (!trimmed.startsWith('data:')) return null;
    const commaIndex = trimmed.indexOf(',');
    if (commaIndex === -1) return null;

    const header = trimmed.slice(5, commaIndex);
    const body = trimmed.slice(commaIndex + 1);
    const mimeMatch = header.match(/^([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const isBase64 = header.includes(';base64');

    if (!isBase64) {
      return new Blob([decodeURIComponent(body)], { type: mimeType });
    }

    const byteString = atob(body);
    const byteArray = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      byteArray[i] = byteString.charCodeAt(i);
    }
    return new Blob([byteArray], { type: mimeType });
  } catch {
    return null;
  }
}

export function decodeDataUrlText(dataUrl: string): string {
  try {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex === -1) return '';
    const header = dataUrl.slice(5, commaIndex);
    const body = dataUrl.slice(commaIndex + 1);
    if (!header.includes(';base64')) {
      return decodeURIComponent(body);
    }
    const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return '';
  }
}

export function downloadDocumentFile(base64OrUrl: string, fileName: string): boolean {
  if (!base64OrUrl) return false;
  const safeName = (fileName || 'documento').trim();
  const blob = dataUrlToBlob(base64OrUrl);
  const link = document.createElement('a');

  if (blob) {
    const blobUrl = URL.createObjectURL(blob);
    link.href = blobUrl;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
    return true;
  }

  link.href = base64OrUrl;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}

export function triggerCsvDownload(csvContent: string, filename: string): boolean {
  if (!csvContent) return false;
  const safeName = (filename || 'lista.csv').trim();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
  return true;
}

export function triggerPdfDownload(pdfBytes: ArrayBuffer | Uint8Array, filename: string): boolean {
  if (!pdfBytes) return false;
  const safeName = (filename || 'lista.pdf').trim();
  const source = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const exactBuffer = new ArrayBuffer(source.byteLength);
  new Uint8Array(exactBuffer).set(source);
  const blob = new Blob([exactBuffer], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
  return true;
}
