import React from 'react';
import { formatDateAO } from '../../utils/date';

interface OfficialDocumentMetadataProps {
  documentType: string;
  documentNumber: string;
  issuedAt: string;
  memberId?: string;
  recipientName?: string;
  recipientLabel?: string;
  location?: string;
  issuedByName?: string;
  isCancelled?: boolean;
  cancellationReason?: string;
  isRejected?: boolean;
  rejectionReason?: string;
}

export const OfficialDocumentMetadata: React.FC<OfficialDocumentMetadataProps> = ({
  documentType,
  documentNumber,
  issuedAt,
  memberId,
  recipientName,
  recipientLabel = "Cobrar a",
  location = "Luanda, Município de Talatona",
  issuedByName,
  isCancelled,
  cancellationReason,
  isRejected,
  rejectionReason,
}) => {
  const isReceipt = documentType === 'recibo';
  return (
    <div className="space-y-3 mb-5 print:space-y-1 print:mb-2">
      {/* Dados do Registo em 2 Colunas */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 text-xs border-b border-slate-200 pb-3">
        <div className="space-y-1">
          {isReceipt && (
            <>
              <div>
                <span className="text-slate-600">N.º do Documento: </span>
                <span className="font-bold font-mono text-slate-950">{documentNumber}</span>
              </div>
              <div>
                <span className="text-slate-600">Data de Emissão: </span>
                <span className="font-semibold text-slate-900">{formatDateAO(issuedAt)}</span>
              </div>
            </>
          )}
          {memberId && isReceipt && (
            <div>
              <span className="text-slate-600">ID de Matrícula: </span>
              <span className="font-mono font-bold text-slate-900">{memberId}</span>
            </div>
          )}
        </div>

        <div className="sm:text-right space-y-1">
          {recipientName && (
            <div>
              <span className="text-slate-600">{recipientLabel}: </span>
              <span className="font-bold text-slate-950">{recipientName}</span>
            </div>
          )}
          {isReceipt && (
            <div className="text-slate-600">
              <span>Igreja Adventista do Sétimo Dia: </span>
              <span className="text-slate-800 font-semibold">{location}</span>
            </div>
          )}
          {issuedByName && isReceipt && (
            <div className="text-slate-600">
              <span>Registado por: </span>
              <span className="font-medium text-slate-800">{issuedByName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Alerta de Documento Anulado se aplicável */}
      {isCancelled && (
        <div className="p-2.5 bg-rose-50 border-2 border-rose-600 text-rose-900 rounded text-xs font-bold flex items-center justify-between">
          <span>DOCUMENTO ANULADO NO SISTEMA</span>
          <span className="font-normal text-[11px] italic">
            Motivo: {cancellationReason || 'Anulado administrativamente pela Tesouraria/Direção.'}
          </span>
        </div>
      )}

      {/* Alerta de Documento Rejeitado se aplicável */}
      {isRejected && (
        <div className="p-2.5 bg-amber-50 border-2 border-amber-600 text-amber-900 rounded text-xs font-bold flex items-center justify-between">
          <span>COMPROVATIVO REJEITADO</span>
          <span className="font-normal text-[11px] italic">
            Motivo: {rejectionReason || 'Rejeitado administrativamente.'}
          </span>
        </div>
      )}
    </div>
  );
};
