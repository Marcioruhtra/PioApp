import React from 'react';

interface OfficialDocumentFooterProps {
  clubName: string;
  documentNumber: string;
  verificationHash?: string;
}

export const OfficialDocumentFooter: React.FC<OfficialDocumentFooterProps> = ({
  clubName,
  documentNumber,
  verificationHash,
}) => {
  const hash = verificationHash || `AO-${documentNumber.replace(/[^A-Za-z0-9]/g, '')}-${Date.now().toString(36).toUpperCase()}`;

  return (
    <div className="mt-8 pt-4 border-t border-slate-200 text-slate-500 text-[10px] space-y-1.5 print:mt-2 print:pt-1 print:block">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-500 font-mono">
        <span>Código de Verificação: <strong className="text-slate-800">{hash}</strong></span>
        <span>Registo Informático: {documentNumber}</span>
      </div>
      <p className="text-center text-slate-400">
        Documento oficial emitido eletronicamente pelo Sistema de Gestão do {clubName} · Luanda, Angola.
      </p>
      <p className="text-center text-slate-400 italic">
        Válido como comprovativo oficial para todos os efeitos legais e estatutários. Qualquer rasura ou emenda invalida este documento.
      </p>
    </div>
  );
};
