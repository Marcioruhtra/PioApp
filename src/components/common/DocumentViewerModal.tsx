import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { Modal } from './Modal';
import {
  dataUrlToBlob,
  decodeDataUrlText,
  downloadDocumentFile,
  getDocumentPreviewKind,
} from '../../utils/fileUpload';

export interface ViewingDocumentPayload {
  title: string;
  fileName: string;
  base64: string;
  subtitle?: string;
}

interface DocumentViewerModalProps {
  documentItem: ViewingDocumentPayload | null;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  documentItem,
  onClose,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  const previewKind = useMemo(() => {
    if (!documentItem) return 'other';
    return getDocumentPreviewKind(documentItem.base64, documentItem.fileName);
  }, [documentItem]);

  useEffect(() => {
    setZoom(1);
    setRotation(0);

    if (!documentItem || previewKind !== 'pdf') {
      setPdfBlobUrl(null);
      return;
    }

    const blob = dataUrlToBlob(documentItem.base64);
    if (!blob) {
      setPdfBlobUrl(documentItem.base64);
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    setPdfBlobUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [documentItem, previewKind]);

  const textPreviewContent = useMemo(() => {
    if (!documentItem || previewKind !== 'text') return '';
    return decodeDataUrlText(documentItem.base64);
  }, [documentItem, previewKind]);

  if (!documentItem) return null;

  const handleDownload = () => {
    downloadDocumentFile(documentItem.base64, documentItem.fileName);
  };

  return (
    <Modal
      isOpen={Boolean(documentItem)}
      onClose={onClose}
      title={documentItem.title}
      description={
        documentItem.subtitle
          ? `${documentItem.subtitle} · Ficheiro: ${documentItem.fileName}`
          : `Ficheiro: ${documentItem.fileName}`
      }
      maxWidth="3xl"
    >
      <div className="space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-blue-900 dark:text-blue-400 shrink-0" />
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
              {documentItem.fileName}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {previewKind === 'image' && (
              <>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  title="Reduzir zoom"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 text-[11px] font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  title="Aumentar zoom"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  title="Rodar 90º"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar Documento</span>
            </button>
          </div>
        </div>

        {previewKind === 'image' && (
          <div className="bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-center min-h-[320px] max-h-[62vh] overflow-auto">
            <img
              src={documentItem.base64}
              alt={documentItem.fileName}
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
              }}
              className="max-w-full max-h-[55vh] object-contain rounded shadow-sm transition-transform duration-150"
            />
          </div>
        )}

        {previewKind === 'pdf' && (
          <div className="space-y-2">
            {pdfBlobUrl ? (
              <iframe
                src={pdfBlobUrl}
                title={documentItem.fileName}
                className="w-full h-[60vh] rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
              />
            ) : (
              <div className="p-8 text-center text-slate-500 border border-slate-200 dark:border-slate-800 rounded-xl">
                A preparar pré-visualização do documento PDF...
              </div>
            )}
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Caso o navegador não exiba o PDF diretamente nesta janela, utilize o botão &ldquo;Baixar Documento&rdquo; acima para abrir no dispositivo.
            </p>
          </div>
        )}

        {previewKind === 'text' && (
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 max-h-[55vh] overflow-auto">
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-slate-800 dark:text-slate-200">
              {textPreviewContent || '(Ficheiro de texto vazio)'}
            </pre>
          </div>
        )}

        {previewKind === 'other' && (
          <div className="p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-center space-y-3">
            <FileText className="w-10 h-10 text-blue-900 dark:text-blue-400 mx-auto" />
            <div className="space-y-1">
              <p className="font-bold text-slate-900 dark:text-white text-sm">
                {documentItem.fileName}
              </p>
              <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                Este formato de documento não permite pré-visualização embutida no navegador. Faça o download para visualizar o conteúdo completo no seu dispositivo.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Ficheiro Agora</span>
            </button>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            Fechar Visualização
          </button>
        </div>
      </div>
    </Modal>
  );
};
