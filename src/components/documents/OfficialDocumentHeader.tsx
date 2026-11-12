import React from 'react';

interface OfficialDocumentHeaderProps {
  clubName: string;
  address?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  documentTitle: string;
}

export const OfficialDocumentHeader: React.FC<OfficialDocumentHeaderProps> = ({
  clubName,
  address = "Rua do Grupo Desportivo da Banca, Maianga, Luanda, Angola",
  phone = "931793101",
  alternatePhone = "927705324",
  email = "ebxpioneirosdalvorada2019@hotmail.com",
  documentTitle,
}) => {
  const sanitizeOfficialText = (text: string) => {
    return text
      .replace(/Conferência Geral dos Embaixadores/gi, '')
      .replace(/República de Angola/gi, '')
      .trim();
  };

  const cleanClubName = sanitizeOfficialText(clubName);
  const cleanTitle = sanitizeOfficialText(documentTitle);

  return (
    <div className="border-b-2 border-slate-900 pb-4 mb-5 print:pb-1 print:mb-2">
      {/* Nome da Instituição e Insígnia */}
      <div className="text-center mb-3">
        <img src="/assets/aistudio/logo.png" alt="Logótipo do Clube" className="w-20 h-20 mx-auto mb-2 object-contain" />
        <h1 className="text-lg sm:text-xl font-black text-slate-950 uppercase tracking-tight">
          {cleanClubName}
        </h1>
      </div>

      {/* Grid de Contactos Institucionais (Extraído do Comprovativo Modelo) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-700 pt-2 border-t border-slate-200">
        <div className="space-y-0.5">
          <p className="leading-snug">
            <span className="font-bold text-slate-900">Endereço:</span> {address}
          </p>
        </div>
        <div className="sm:text-right space-y-0.5 text-slate-700">
          <p>
            <span className="font-bold text-slate-900">Telefone:</span> {phone}
            {alternatePhone && (
              <span className="ml-2">
                <span className="font-bold text-slate-900">Alternativo:</span> {alternatePhone}
              </span>
            )}
          </p>
          <p>
            <span className="font-bold text-slate-900">E-mail:</span> {email}
          </p>
        </div>
      </div>

      {/* Título Oficial Destacado */}
      <div className="text-center mt-4">
        <h2 className="text-sm sm:text-base font-black underline underline-offset-4 tracking-wider text-slate-950 uppercase inline-block">
          {cleanTitle}
        </h2>
      </div>
    </div>
  );
};
