import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  X,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Clock,
  ShieldCheck,
  CreditCard,
  Building,
} from 'lucide-react';
import { PaymentProofReport } from '../../types';
import { formatDateAO } from '../../utils/date';
import { formatKz } from '../../utils/currency';
import { useClub } from '../../context/ClubContext';

interface ProofDocumentViewerModalProps {
  proof: PaymentProofReport | null;
  onClose: () => void;
  onApprove?: (proofId: string) => void;
  onReject?: (proof: PaymentProofReport) => void;
}

export const ProofDocumentViewerModal: React.FC<ProofDocumentViewerModalProps> = ({
  proof,
  onClose,
  onApprove,
  onReject,
}) => {
  const { state, can } = useClub();
  const [imageZoom, setImageZoom] = useState(false);

  if (!proof) return null;

  const member = state.members.find(
    (m) => m.id === proof.memberId || m.manualNumber === proof.memberId || m.fullName.toLowerCase() === proof.memberName.toLowerCase()
  );
  const memberRegistrationId = member?.manualNumber || proof.memberId;

  const isImage = Boolean(
    proof.attachmentBase64?.startsWith('data:image/') ||
    proof.attachmentFileName?.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/)
  );

  const isPdf = Boolean(
    proof.attachmentBase64?.startsWith('data:application/pdf') ||
    proof.attachmentFileName?.toLowerCase().endsWith('.pdf')
  );

  const handleDownload = () => {
    if (proof.attachmentBase64) {
      const link = document.createElement('a');
      link.href = proof.attachmentBase64;
      link.download = proof.attachmentFileName || `Comprovativo-${proof.id}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Criação de ficheiro de texto descritivo se não houver base64
      const content = `COMPROVATIVO DE PAGAMENTO - CLUBE D'ALVORADA\n` +
        `ID: ${proof.id}\n` +
        `Membro: ${proof.memberName} (Matrícula: ${memberRegistrationId})\n` +
        `Taxa: ${proof.feeTitle}\n` +
        `Montante: ${formatKz(proof.amountInCents)}\n` +
        `Referência: ${proof.referenceCode}\n` +
        `Data: ${formatDateAO(proof.paymentDate)}\n` +
        `Ficheiro: ${proof.attachmentFileName}\n`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${proof.attachmentFileName || proof.id}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const isPending = proof.status === 'submetido';
  const isTreasurerApprover = can('treasury', 'APPROVE');

  return (
    <div className="print-modal-wrapper fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:z-auto print:overflow-visible">
      <div className="printable-document-modal relative w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-4 sm:my-6 flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:m-0 print:rounded-none">
        
        {/* Barra Superior de Ações */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-amber-300">{proof.id}</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {proof.status === 'confirmado' ? 'Confirmado' : proof.status === 'rejeitado' ? 'Rejeitado' : 'Pendente de Conferência'}
                </span>
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-white">
                Comprovativo de Pagamento — {proof.memberName}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors cursor-pointer"
              title="Descarregar Comprovativo"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Descarregar</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white rounded-lg transition-colors cursor-pointer"
              title="Imprimir"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer ml-1"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Ficha Resumo do Pagamento Reportado */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Membro Titular</span>
              <strong className="text-slate-900 block truncate">{proof.memberName}</strong>
              <span className="text-[10px] text-slate-500 font-mono">
                Matrícula: <strong className="text-blue-900">{memberRegistrationId}</strong>
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">Rubrica / Taxa</span>
              <strong className="text-slate-900 block truncate">{proof.feeTitle}</strong>
              <span className="text-[10px] text-slate-500">
                Data: {formatDateAO(proof.paymentDate)}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">Montante Declarado</span>
              <strong className="text-blue-950 font-black text-sm block font-mono">
                {formatKz(proof.amountInCents)}
              </strong>
              <span className="text-[10px] text-slate-500 capitalize">
                Via: {proof.paymentMethod.replace('_', ' ')}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">Ref. Bancária</span>
              <strong className="text-slate-900 font-mono block truncate text-[11px]">
                {proof.referenceCode}
              </strong>
              <span className="text-[10px] text-slate-500 block truncate">
                Conta: {proof.accountName || 'Conta Geral'}
              </span>
            </div>
          </div>

          {proof.attachmentFileName && (
            <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-600">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-900" />
                <span>Ficheiro Original Anexado: <strong>{proof.attachmentFileName}</strong></span>
              </span>
              {proof.expiresAt && (
                <span className="flex items-center gap-1 text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <Clock className="w-3 h-3" />
                  <span>Validade para conferência: até {formatDateAO(proof.expiresAt)}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Visualizador do Conteúdo do Documento */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100 flex flex-col items-center justify-center min-h-[350px]">
          {proof.attachmentBase64 ? (
            <div className="w-full h-full flex flex-col items-center justify-center">
              {isImage && (
                <div className="relative group max-w-full">
                  <div className="mb-2 flex justify-end print:hidden">
                    <button
                      onClick={() => setImageZoom(!imageZoom)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-white border border-slate-300 rounded-md text-slate-700 shadow-xs hover:bg-slate-50"
                    >
                      {imageZoom ? <ZoomOut className="w-3 h-3" /> : <ZoomIn className="w-3 h-3" />}
                      <span>{imageZoom ? 'Tamanho Normal' : 'Ampliar Imagem'}</span>
                    </button>
                  </div>
                  <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-md p-2 max-w-full">
                    <img
                      src={proof.attachmentBase64}
                      alt={`Comprovativo de ${proof.memberName}`}
                      className={`mx-auto rounded transition-all duration-200 object-contain ${
                        imageZoom ? 'max-h-none w-auto' : 'max-h-[500px] w-auto'
                      }`}
                    />
                  </div>
                </div>
              )}

              {isPdf && (
                <div className="w-full flex flex-col items-center">
                  <iframe
                    src={proof.attachmentBase64}
                    className="w-full h-[520px] rounded-lg border border-slate-300 shadow-md bg-white"
                    title={`Comprovativo PDF - ${proof.id}`}
                  />
                </div>
              )}

              {!isImage && !isPdf && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-md text-center max-w-md">
                  <FileText className="w-12 h-12 text-blue-900 mx-auto mb-3" />
                  <h4 className="font-bold text-slate-900 text-sm mb-1">
                    {proof.attachmentFileName}
                  </h4>
                  <p className="text-xs text-slate-500 mb-4">
                    O ficheiro foi codificado com sucesso. Pode descarregá-lo ou visualizá-lo diretamente.
                  </p>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-blue-900 hover:bg-blue-800 text-white rounded-lg shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Abrir / Descarregar Ficheiro</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Simulação Fiel de Extrato / Talão Bancário Digital caso não haja base64 (dados semente ou mock) */
            <div className="w-full max-w-xl bg-white border border-slate-300 rounded-xl shadow-lg p-6 sm:p-8 text-slate-900 font-mono text-xs space-y-4">
              <div className="text-center border-b-2 border-dashed border-slate-300 pb-4">
                <div className="flex items-center justify-center gap-2 text-blue-950 font-sans font-black text-base uppercase">
                  <CreditCard className="w-5 h-5 text-blue-900" />
                  <span>Comprovante de Operação Bancária</span>
                </div>
                <p className="text-[10px] text-slate-500 font-sans mt-0.5">
                  Rede Multicaixa / Transferência Eletrónica Interbancária
                </p>
              </div>

              <div className="space-y-2 py-2 divide-y divide-slate-100">
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Beneficiário:</span>
                  <span className="font-bold text-slate-900">{state.settings.clubName}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Conta de Crédito:</span>
                  <span className="font-bold">{proof.accountName || 'Conta Geral PioApp'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Ordenante / Membro:</span>
                  <span className="font-bold text-slate-900">{proof.memberName}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">N.º de Matrícula:</span>
                  <span className="font-bold text-blue-900">{memberRegistrationId}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Data e Hora:</span>
                  <span>{formatDateAO(proof.paymentDate)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Código de Referência:</span>
                  <span className="font-bold text-slate-900">{proof.referenceCode}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Canal de Pagamento:</span>
                  <span className="capitalize">{proof.paymentMethod.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Rubrica / Finalidade:</span>
                  <span>{proof.feeTitle}</span>
                </div>
                <div className="flex justify-between py-2 bg-slate-50 px-2 rounded font-sans">
                  <span className="font-bold text-slate-900">Montante Liquidado:</span>
                  <span className="font-mono font-black text-base text-blue-950">
                    {formatKz(proof.amountInCents)}
                  </span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-3 text-center text-[10px] text-slate-500 font-sans">
                <p>Registo associado ao ficheiro: <strong>{proof.attachmentFileName}</strong></p>
                <p className="mt-0.5">Operação registada no Portal do Membro para validação pela Tesouraria.</p>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé de Ações de Decisão para a Tesouraria */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-900" />
            <span>Validação da Tesouraria: Confirme o montante e a referência no extrato antes de aprovar.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              Fechar
            </button>

            {isPending && isTreasurerApprover && onReject && (
              <button
                onClick={() => onReject(proof)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Rejeitar</span>
              </button>
            )}

            {isPending && isTreasurerApprover && onApprove && (
              <button
                onClick={() => onApprove(proof.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Aprovar e Emitir Recibo</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
