import React from 'react';

interface OfficialDocumentSignaturesProps {
  signerName: string;
  signerRole?: string;
  secondSignerName?: string;
  secondSignerRole?: string;
  clubName?: string;
  year?: number;
}

export const OfficialDocumentSignatures: React.FC<OfficialDocumentSignaturesProps> = ({
  signerName,
  signerRole = "Assinatura do Responsável da Operação",
  secondSignerName,
  secondSignerRole = "Visto da Direção",
}) => {
  return (
    <div className="print-signature-section mt-12 pt-6 border-t border-slate-200 print-break-inside-avoid">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-10 sm:gap-16">
        {secondSignerName && (
          <div className="text-center flex flex-col items-center">
            <div className="h-12 flex items-end justify-center">
              <div className="w-56 sm:w-64 border-b border-slate-900 pb-1" />
            </div>
            <p className="text-xs font-bold text-slate-950 mt-1.5">{secondSignerName}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{secondSignerRole}</p>
          </div>
        )}

        <div className="text-center flex flex-col items-center">
          <div className="h-12 flex items-end justify-center">
            <div className="w-56 sm:w-64 border-b border-slate-900 pb-1" />
          </div>
          <p className="text-xs font-bold text-slate-950 mt-1.5">{signerName}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">{signerRole}</p>
        </div>
      </div>
    </div>
  );
};
