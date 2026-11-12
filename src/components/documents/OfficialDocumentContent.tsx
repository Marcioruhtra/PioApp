import React from 'react';
import {
  OfficialDocumentHeader,
  OfficialDocumentMetadata,
  OfficialDocumentBanner,
  OfficialRemessaBox,
  OfficialDocumentSignatures,
  OfficialDocumentFooter,
} from '.';
import { OfficialDocument } from '../../types';
import { formatKz } from '../../utils/currency';
import { formatDateAO } from '../../utils/date';

interface OfficialDocumentContentProps {
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
}

export const OfficialDocumentContent: React.FC<OfficialDocumentContentProps> = ({
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
}) => {
  return (
    <div className="bg-white text-slate-900 w-full p-6 print:p-0">
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

      {/* Render content logic remains consistent with PrintDocumentModal */}
      {/* ... (Logic moved to PrintDocumentModal to ensure DRY) */}
    </div>
  );
};
