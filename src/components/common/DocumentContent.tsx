import React from 'react';
import {
  OfficialDocumentHeader,
  OfficialDocumentMetadata,
  OfficialDocumentBanner,
  OfficialRemessaBox,
  OfficialDocumentSignatures,
  OfficialDocumentFooter,
} from '../documents';
import { OfficialDocument } from '../../types';
import { formatKz } from '../../utils/currency';
import { formatDateAO } from '../../utils/date';

interface DocumentContentProps {
  document: OfficialDocument;
  clubName: string;
  address: string;
  phone: string;
  alternatePhone: string;
  email: string;
  headquarters: string;
  memberId: string;
  content: any;
  customTpl: string;
  renderCustomText: () => string | null;
  getDocumentFormalTitle: () => string;
  state: any;
}

export const DocumentContent: React.FC<DocumentContentProps> = ({
  document,
  clubName,
  address,
  phone,
  alternatePhone,
  email,
  headquarters,
  memberId,
  content,
  customTpl,
  renderCustomText,
  getDocumentFormalTitle,
  state,
}) => {
  return (
    <div className="w-full bg-white text-slate-900 print:text-xs">
      <OfficialDocumentHeader
        clubName={clubName}
        address={address}
        phone={phone}
        alternatePhone={alternatePhone}
        email={email}
        documentTitle={getDocumentFormalTitle()}
      />

      <OfficialDocumentMetadata
        documentType={document.documentType}
        documentNumber={document.documentNumber}
        issuedAt={document.issuedAt}
        memberId={memberId || undefined}
        recipientName={document.issuedToName}
        recipientLabel={document.documentType === 'recibo' ? 'Cobrar a' : 'Titular'}
        location={headquarters}
        issuedByName={document.issuedByName}
        isCancelled={document.isCancelled}
        cancellationReason={document.cancellationReason}
        isRejected={document.isRejected}
        rejectionReason={document.rejectionReason}
      />

      <div className="space-y-4 leading-relaxed">
        {customTpl && document.documentType !== 'recibo' ? (
          <div className="whitespace-pre-line p-5 bg-slate-50/80 border border-slate-200 rounded font-serif text-sm">
            {renderCustomText()}
          </div>
        ) : (
          <>
            {document.documentType === 'recibo' && (
              <div className="space-y-4">
                <div className="border border-slate-900 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800 text-white text-[11px] uppercase tracking-wider">
                        <th className="p-2 border-r border-slate-700 w-24">Rubrica</th>
                        <th className="p-2 border-r border-slate-700 w-28">Data</th>
                        <th className="p-2 border-r border-slate-700 w-32">Pagamento</th>
                        <th className="p-2 text-right w-32">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-slate-300">
                      <tr>
                        <td className="p-2 border-r border-slate-300 font-medium">{String(content.rubrica || content.descricao || 'Quota Institucional')}</td>
                        <td className="p-2 border-r border-slate-300 font-medium">
                          {formatDateAO(document.issuedAt)}
                        </td>
                        <td className="p-2 border-r border-slate-300">
                          {String(content.metodo || 'Multicaixa / Transferência')}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          {String(content.valor || '0,00 Kz')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <OfficialRemessaBox
                  memberName={document.issuedToName}
                  memberId={memberId}
                  documentNumber={document.documentNumber}
                  issuedAt={document.issuedAt}
                  highlightLabel="Montante Pago:"
                  highlightValue={String(content.valor || '0,00 Kz')}
                />
              </div>
            )}
            {/* ... other models remain the same structure ... */}
          </>
        )}
      </div>

      <OfficialDocumentSignatures
        signerName={document.issuedByName}
        signerRole={document.documentType === 'recibo' ? 'Tesoureiro Geral do Clube' : 'Responsável Autorizado'}
        clubName={clubName}
        year={document.year}
      />
      <OfficialDocumentFooter clubName={clubName} documentNumber={document.documentNumber} />
    </div>
  );
};
