import React from 'react';
import { formatDateAO } from '../../utils/date';

export interface RemessaRow {
  label: string;
  value: React.ReactNode;
  isMono?: boolean;
  isHighlighted?: boolean;
}

interface OfficialRemessaBoxProps {
  title?: string;
  subTitle?: string;
  memberName?: string;
  memberId?: string;
  documentNumber: string;
  issuedAt: string;
  highlightLabel?: string;
  highlightValue?: string;
  extraRows?: RemessaRow[];
}

export const OfficialRemessaBox: React.FC<OfficialRemessaBoxProps> = ({
  title = "REMESSA",
  subTitle = "CONTROLO E VALIDAÇÃO OFICIAL",
  memberName,
  memberId,
  documentNumber,
  issuedAt,
  highlightLabel = "Montante Pago:",
  highlightValue,
  extraRows = [],
}) => {
  return (
    <div className="mt-6 border border-slate-900 overflow-hidden text-xs print-break-inside-avoid">
      {/* Cabeçalho do Bloco REMESSA */}
      <div className="bg-slate-800 text-white font-bold px-3 py-1.5 flex items-center justify-between uppercase tracking-wider">
        <span>{title}</span>
        {subTitle && (
          <span className="text-[10px] text-slate-300 font-normal">
            {subTitle}
          </span>
        )}
      </div>

      {/* Tabela de Campos */}
      <div className="divide-y divide-slate-300 bg-white">
        {memberName && (
          <div className="grid grid-cols-3 px-3 py-1.5">
            <span className="font-medium text-slate-600">Nome do Membro / Titular</span>
            <span className="col-span-2 font-bold text-slate-950">{memberName}</span>
          </div>
        )}

        {memberId && (
          <div className="grid grid-cols-3 px-3 py-1.5">
            <span className="font-medium text-slate-600">ID de Matrícula (Membro)</span>
            <span className="col-span-2 font-mono font-bold text-slate-900">{memberId}</span>
          </div>
        )}

        <div className="grid grid-cols-3 px-3 py-1.5">
          <span className="font-medium text-slate-600">N.º do Comprovativo / Documento</span>
          <span className="col-span-2 font-mono font-bold text-slate-900">{documentNumber}</span>
        </div>

        <div className="grid grid-cols-3 px-3 py-1.5">
          <span className="font-medium text-slate-600">Data de Registo</span>
          <span className="col-span-2 font-medium text-slate-900">{formatDateAO(issuedAt)}</span>
        </div>

        {extraRows.map((row, idx) => (
          <div
            key={idx}
            className={`grid grid-cols-3 px-3 py-1.5 ${row.isHighlighted ? 'bg-slate-50 font-bold' : ''}`}
          >
            <span className="font-medium text-slate-600">{row.label}</span>
            <span className={`col-span-2 ${row.isMono ? 'font-mono' : ''} text-slate-900`}>
              {row.value}
            </span>
          </div>
        ))}

        {highlightValue && (
          <div className="grid grid-cols-3 px-3 py-2 bg-slate-50 border-t border-slate-300">
            <span className="font-bold text-slate-900">{highlightLabel}</span>
            <span className="col-span-2 font-mono font-black text-slate-950 text-sm">
              {highlightValue}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
