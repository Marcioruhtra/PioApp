/**
 * Utilitário para processamento e compressão de comprovativos (Imagens e PDFs)
 * Evita sobrecarga de memória, erros de quota do LocalStorage e do Firestore.
 */

export interface ProcessedFile {
  fileName: string;
  base64: string;
  sizeInKB: number;
  isImage: boolean;
}

export async function processProofFile(file: File): Promise<ProcessedFile> {
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
    if (file.size > 500 * 1024) {
      throw new Error(
        'O ficheiro PDF é superior a 500 KB. Para evitar lentidão, utilize uma captura de ecrã/foto do comprovativo ou um PDF mais leve.'
      );
    }

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
  if (file.size > 400 * 1024) {
    throw new Error('O ficheiro é demasiado pesado (máximo 400 KB).');
  }

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

