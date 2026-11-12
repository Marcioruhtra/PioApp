import React from 'react';

interface OfficialDocumentBannerProps {
  label: string;
  value: string;
  isMono?: boolean;
  accentColorClass?: string;
}

export const OfficialDocumentBanner: React.FC<OfficialDocumentBannerProps> = ({
  label,
  value,
  isMono = true,
  accentColorClass = "bg-slate-900 text-white",
}) => {
  return (
    <div className={`${accentColorClass} px-4 py-2 rounded-xs flex justify-between items-center text-xs sm:text-sm font-bold uppercase tracking-wide mb-4`}>
      <span className="text-slate-200">{label}</span>
      <span className={`${isMono ? 'font-mono' : ''} text-white text-sm sm:text-base`}>
        {value}
      </span>
    </div>
  );
};
