import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Printer,
  X,
  ShieldCheck,
  QrCode,
  User,
  Heart,
  Phone,
  BadgeCheck,
  Camera,
  Trash2,
  Upload,
  AlertTriangle,
  Loader2,
  CheckCircle,
  Award,
} from 'lucide-react';
import QRCode from 'qrcode';
import { Member } from '../../types';
import { useClub } from '../../context/ClubContext';
import { processProfilePhoto } from '../../utils/fileUpload';
import { formatDateAO } from '../../utils/date';

interface MemberDigitalCardModalProps {
  member: Member | null;
  onClose: () => void;
}

export const MemberDigitalCardModal: React.FC<MemberDigitalCardModalProps> = ({
  member,
  onClose,
}) => {
  const { state, currentUser, can, uploadMemberPhoto, deleteMemberPhoto } = useClub();
  const settings = state.settings;
  const clubName = settings.clubName || "Clube de Embaixadores Pioneiros D'Alvorada";
  const headquarters = settings.city || settings.headquarters || "Luanda, Angola";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Mantém a versão mais recente do membro diretamente a partir do estado global em tempo real
  const liveMember = member
    ? state.members.find(
        (m) =>
          m.id === member.id ||
          (Boolean(member.manualNumber) && m.manualNumber === member.manualNumber)
      ) || member
    : null;

  const rawGuardian = liveMember?.guardianName?.trim();
  const rawEmergency = liveMember?.emergencyContact?.name?.trim();
  const cleanEmergencyName = rawEmergency ? rawEmergency.replace(/\s*\([^)]*\)/g, '').trim() : '';

  const guardianDisplayName =
    rawGuardian ||
    cleanEmergencyName ||
    rawEmergency ||
    'Não registado';

  const showsInvestiture = liveMember ? (liveMember.category === 'embaixador' || liveMember.category === 'lider') : false;

  useEffect(() => {
    if (!liveMember) return;

    const payload = JSON.stringify({
      id: liveMember.id,
      manualNumber: liveMember.manualNumber,
      fullName: liveMember.fullName,
      category: liveMember.category,
      unitOrTeam: liveMember.unitOrTeam || 'Sem Equipa',
      guardian: guardianDisplayName,
      guardianPhone: liveMember.guardianPhone || liveMember.emergencyContact?.phone || 'N/A',
      investitureDate: liveMember.investitureDate || (showsInvestiture ? 'Sim' : 'N/A'),
      bi: liveMember.identityCardNumber,
      status: liveMember.status,
      validYear: settings.currentYear || new Date().getFullYear(),
      org: "EBX Pioneiros D'Alvorada",
    });

    QRCode.toDataURL(payload, {
      width: 250,
      margin: 1,
      color: {
        dark: '#1e3a8a', // Azul Imperial
        light: '#ffffff',
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Erro ao gerar QR Code:', err));
  }, [liveMember, settings.currentYear, guardianDisplayName, showsInvestiture]);

  if (!liveMember) return null;

  // Regra de exclusão: estritamente Direção (Diretor e Secretário com permissão da matriz de Permissões, além de Admin Técnico)
  const isLeadershipAllowedToDelete =
    currentUser.role === 'admin_tecnico' ||
    ((currentUser.role === 'diretor' || currentUser.role === 'secretario') && can('members', 'EDIT'));

  // Regra de upload: cada usuário pode fazer upload da foto para o seu próprio cartão
  const isOwnCard =
    (Boolean(currentUser.linkedMemberId) &&
      (currentUser.linkedMemberId === liveMember.id ||
        (Boolean(liveMember.manualNumber) && currentUser.linkedMemberId === liveMember.manualNumber))) ||
    (currentUser.email && liveMember.email && currentUser.email.toLowerCase() === liveMember.email.toLowerCase()) ||
    (currentUser.name && liveMember.fullName && currentUser.name.toLowerCase() === liveMember.fullName.toLowerCase());

  // A Direção também pode carregar/atualizar a foto de qualquer membro
  const canUploadPhoto = isOwnCard || isLeadershipAllowedToDelete;

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      setFeedback(null);
      const base64 = await processProfilePhoto(file);
      const res = uploadMemberPhoto(liveMember.id, base64);
      if (res.success) {
        setFeedback({ type: 'success', message: 'Fotografia atualizada com sucesso no cartão digital.' });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erro ao carregar fotografia.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Falha ao processar a imagem.' });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmDeletePhoto = () => {
    setIsProcessing(true);
    setFeedback(null);
    const res = deleteMemberPhoto(liveMember.id);
    if (res.success) {
      setFeedback({ type: 'success', message: 'Fotografia excluída com sucesso pela Direção.' });
      setIsConfirmingDelete(false);
    } else {
      setFeedback({ type: 'error', message: res.error || 'Erro ao excluir fotografia.' });
    }
    setIsProcessing(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const categoryColorClass = {
    aspirante: 'bg-amber-500 text-white border-amber-300',
    embaixador: 'bg-blue-600 text-white border-blue-400',
    lider: 'bg-purple-700 text-white border-purple-400',
  }[liveMember.category] || 'bg-blue-600 text-white border-blue-400';

  const categoryLabel = {
    aspirante: 'Aspirante',
    embaixador: 'Embaixador',
    lider: 'Líder',
  }[liveMember.category] || (liveMember.category === 'aspirante' ? 'Aspirante' : liveMember.category === 'lider' ? 'Líder' : 'Embaixador');

  // Investidura: aplicável se for Embaixador (membro investido) ou Líder
  const investitureDateFormatted = liveMember.investitureDate
    ? formatDateAO(liveMember.investitureDate)
    : (showsInvestiture ? 'Registada' : null);

  const allergiesNotes =
    liveMember.allergiesOrMedicalNotes?.trim() ||
    'Sem registo de alergias';

  const modalContent = (
    <div className="print-modal-wrapper fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:z-auto print:overflow-visible print:block print:flex-none">
      <div className="printable-document-modal relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-4 print:border-none print:shadow-none print:m-0 print:rounded-none print:max-w-none print:w-full print:bg-white">
        {/* Barra de Ações Superior (Oculta na Impressão) */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                Cartão Digital Oficial & Credencial de Membro
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Matrícula: {liveMember.manualNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Credencial</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conteúdo Principal do Cartão Digital */}
        <div className="p-4 sm:p-8 bg-slate-100 dark:bg-slate-950 print:bg-white print:p-2">
          {/* Cabeçalho visível apenas na impressão */}
          <div className="hidden print:flex items-center justify-between border-b border-slate-300 pb-2 mb-4 text-slate-900">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider">{clubName}</h2>
              <p className="text-[10px] text-slate-600">Credencial Oficial de Membro — Frente e Verso</p>
            </div>
            <div className="text-right text-[10px] font-mono text-slate-600">
              <div>Matrícula: {liveMember.manualNumber}</div>
              <div>Ano Fiscal {settings.currentYear || new Date().getFullYear()}</div>
            </div>
          </div>

          <div className="text-center mb-6 print:hidden">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Apresente esta credencial no telemóvel para validação rápida de presença em reuniões, acampamentos e eventos oficiais.
            </p>
          </div>

          {/* Grelha do Cartão (Frente e Verso com dimensões exatamente idênticas) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch justify-center max-w-4xl mx-auto print:grid-cols-2 print:gap-4 print:max-w-none">
            
            {/* LADO FRENTE DO CARTÃO */}
            <div className="print-break-inside-avoid relative bg-slate-900 bg-gradient-to-br from-blue-950 via-slate-900 to-blue-900 text-white rounded-2xl shadow-xl border-2 border-amber-400/50 overflow-hidden flex flex-col justify-between w-full max-w-[420px] h-[262px] sm:h-[268px] print:h-[224px] print:max-w-none mx-auto print:shadow-none print:border-slate-500">
              
              {/* Marca de Água de Fundo */}
              <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
                <img src="/assets/aistudio/logo.png" alt="" className="w-60 h-60 object-contain" />
              </div>

              {/* Cabeçalho da Credencial */}
              <div className="bg-slate-950/90 print:bg-slate-950 px-3.5 py-2 border-b border-amber-400/30 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <img src="/assets/aistudio/logo.png" alt="Logo" className="w-7 h-7 sm:w-8 sm:h-8 print:w-7 print:h-7 object-contain drop-shadow-md shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider text-amber-400 leading-tight truncate">
                      {clubName}
                    </h4>
                    <p className="text-[7.5px] text-slate-300 tracking-wider font-mono uppercase truncate">
                      Credencial Oficial · {headquarters}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider shadow-xs ${categoryColorClass}`}>
                    {categoryLabel}
                  </span>
                </div>
              </div>

              {/* Corpo Principal: Foto, Dados e Nº de Embaixador / Matrícula */}
              <div className="px-3.5 py-2 flex items-center gap-3 z-10 flex-1 min-h-0">
                {/* Foto do Membro com Overlay de Upload e Ações */}
                <div className="relative shrink-0 group">
                  <div className="w-[74px] h-[94px] sm:w-[82px] sm:h-[104px] print:w-[68px] print:h-[86px] rounded-xl bg-slate-800 border-2 border-amber-400/80 shadow-lg overflow-hidden flex items-center justify-center relative">
                    {liveMember.photoUrl ? (
                      <img src={liveMember.photoUrl} alt={liveMember.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 p-1.5 text-center">
                        <User className="w-8 h-8 stroke-1" />
                        <span className="text-[7px] uppercase tracking-wider mt-0.5 text-slate-400 font-semibold">Sem Foto</span>
                      </div>
                    )}

                    {/* Botão de Upload Rápido no Hover da Foto (Oculto na Impressão) */}
                    {canUploadPhoto && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessing}
                        className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer print:hidden"
                        title="Carregar ou alterar foto de perfil"
                      >
                        <Camera className="w-5 h-5 text-amber-400 mb-0.5" />
                        <span className="text-[7px] uppercase font-bold tracking-tight">Alterar</span>
                      </button>
                    )}
                  </div>

                  {/* Badge de Ativo */}
                  <div className="absolute -bottom-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-slate-900 shadow-xs" title="Membro Ativo">
                    <BadgeCheck className="w-3 h-3" />
                  </div>

                  {/* Botão Flutuante de Exclusão Direta (Exclusivo da Direção com Permissão) */}
                  {liveMember.photoUrl && isLeadershipAllowedToDelete && (
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(true)}
                      className="absolute -top-1.5 -right-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-full p-1 border-2 border-slate-900 shadow-md transition-transform hover:scale-110 cursor-pointer print:hidden"
                      title="Excluir Foto Oficial (Função da Direção)"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Detalhes Nominais e Nº de Embaixador */}
                <div className="min-w-0 flex-1 flex flex-col justify-center gap-1.5">
                  <div>
                    <span className="text-[7px] uppercase tracking-widest text-slate-300 font-bold block leading-none mb-0.5">
                      Nome do Titular
                    </span>
                    <h2 className="text-xs sm:text-[13px] print:text-[11px] font-black text-white leading-tight line-clamp-2 uppercase tracking-tight">
                      {liveMember.fullName}
                    </h2>
                  </div>

                  {/* Nº de Embaixador / Matrícula Registado pela Secretária (Destaque Principal) */}
                  <div className="flex items-center justify-between gap-2 bg-slate-950/80 print:bg-slate-950 border border-amber-400/50 rounded-md px-2 py-1">
                    <span className="text-[7px] sm:text-[7.5px] uppercase tracking-wider text-amber-300 font-bold shrink-0">
                      Nº Embaixador / Matrícula:
                    </span>
                    <span className="font-mono font-black text-amber-300 text-[11px] print:text-[10px] tracking-wider truncate">
                      {liveMember.manualNumber || 'S/N'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="min-w-0">
                      <span className="text-[7px] uppercase tracking-widest text-slate-300 block font-semibold leading-none mb-0.5">
                        Equipa
                      </span>
                      <p className="text-[9.5px] sm:text-[10px] font-bold text-amber-300 truncate leading-tight">
                        {liveMember.unitOrTeam?.trim() || 'Sem Equipa'}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[7px] uppercase tracking-widest text-slate-300 block font-semibold leading-none mb-0.5">
                        B.I. (Angola)
                      </span>
                      <p className="text-[9.5px] sm:text-[10px] font-mono font-bold text-slate-100 truncate leading-tight">
                        {liveMember.identityCardNumber || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Investidura (para Membro/Embaixador ou Líder) */}
                  {showsInvestiture && (
                    <div>
                      <div className="inline-flex items-center gap-1 bg-amber-400/15 border border-amber-400/40 px-1.5 py-0.5 rounded text-[8px] text-amber-200 leading-none">
                        <Award className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                        <span>
                          Investidura: <strong>{investitureDateFormatted}</strong>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Rodapé da Frente */}
              <div className="bg-slate-950/95 print:bg-slate-950 px-3.5 py-1.5 border-t border-slate-800 flex items-center justify-between text-[7.5px] text-slate-300 shrink-0">
                <div className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>Documento Oficial de Identificação</span>
                </div>
                <div className="font-mono text-amber-400 font-bold shrink-0">
                  Ano Fiscal {settings.currentYear || new Date().getFullYear()}
                </div>
              </div>
            </div>


            {/* LADO VERSO DO CARTÃO */}
            <div className="print-break-inside-avoid relative bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl shadow-xl border-2 border-slate-300 dark:border-slate-800 overflow-hidden flex flex-col justify-between w-full max-w-[420px] h-[262px] sm:h-[268px] print:h-[224px] print:max-w-none mx-auto print:shadow-none print:border-slate-500 print:bg-white print:text-slate-900">
              
              {/* Cabeçalho do Verso */}
              <div className="bg-slate-900 text-white px-3.5 py-2 flex items-center justify-between border-b border-amber-400/30 shrink-0">
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 shrink-0" />
                  Validação Digital & Segurança
                </span>
                <span className="text-[8px] font-mono text-slate-300">
                  ID: {liveMember.id}
                </span>
              </div>

              {/* Corpo do Verso: QR Code e Dados Médicos/Emergência */}
              <div className="px-3.5 py-2 flex items-center gap-3 flex-1 min-h-0">
                {/* QR Code gerado em tempo real */}
                <div className="shrink-0 flex flex-col items-center">
                  <div className="p-1 bg-white rounded-xl border-2 border-blue-900 shadow-md print:shadow-none">
                    {qrCodeDataUrl ? (
                      <img src={qrCodeDataUrl} alt="QR Code de Validação" className="w-20 h-20 sm:w-[88px] sm:h-[88px] print:w-[74px] print:h-[74px] object-contain" />
                    ) : (
                      <div className="w-20 h-20 sm:w-[88px] sm:h-[88px] print:w-[74px] print:h-[74px] bg-slate-100 flex items-center justify-center">
                        <QrCode className="w-8 h-8 text-slate-400 animate-pulse" />
                      </div>
                    )}
                  </div>
                  <span className="text-[7px] font-mono text-slate-500 dark:text-slate-400 print:text-slate-600 mt-1 uppercase font-bold">
                    Scan p/ Verificar
                  </span>
                </div>

                {/* Informações de Saúde e Emergência */}
                <div className="min-w-0 flex-1 space-y-1.5 text-[8.5px]">
                  <div className="bg-slate-50 dark:bg-slate-800 print:bg-slate-50 p-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 print:border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400 print:text-slate-600 font-bold flex items-center gap-1">
                        <Heart className="w-3 h-3 text-rose-500 fill-rose-500 shrink-0" /> Grupo Sanguíneo:
                      </span>
                      <strong className="font-bold font-mono text-rose-600 dark:text-rose-400 print:text-rose-600 text-[11px]">
                        {liveMember.bloodType || 'N/I'}
                      </strong>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 print:bg-slate-50 p-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 print:border-slate-200">
                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 print:text-slate-600 font-bold text-[7.5px] uppercase">
                      <Phone className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                      <span>Emergência / Encarregado</span>
                    </div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100 print:text-slate-900 truncate text-[8.5px]">
                      {guardianDisplayName}
                    </p>
                    {(liveMember.guardianPhone || liveMember.emergencyContact?.phone) && (
                      <p className="font-mono text-[8px] text-slate-600 dark:text-slate-300 print:text-slate-700 truncate">
                        {liveMember.guardianPhone || liveMember.emergencyContact?.phone}
                      </p>
                    )}
                  </div>

                  <div className="text-[7.5px] text-slate-500 dark:text-slate-400 print:text-slate-600 leading-tight border-t border-slate-200 dark:border-slate-700 print:border-slate-200 pt-1">
                    <p className={`line-clamp-2 ${liveMember.allergiesOrMedicalNotes ? "text-rose-600 dark:text-rose-400 print:text-rose-700 font-semibold" : "text-slate-500 dark:text-slate-400 print:text-slate-600"}`}>
                      <strong>Alergias/Avisos:</strong> {allergiesNotes}
                    </p>
                  </div>
                </div>
              </div>

              {/* Assinatura e Carimbo Oficial do Verso */}
              <div className="bg-slate-50 dark:bg-slate-950 print:bg-slate-50 px-3.5 py-1.5 border-t border-slate-200 dark:border-slate-800 print:border-slate-200 flex items-center justify-between text-[7.5px] text-slate-500 print:text-slate-600 shrink-0">
                <div className="text-center">
                  <div className="border-b border-slate-400 w-24 mb-0.5 font-serif italic text-[7px]">
                    Secretaria Geral
                  </div>
                  <span className="text-[6.5px] uppercase font-bold text-slate-400 print:text-slate-500 block">Assinatura Autorizada</span>
                </div>
                <div className="text-right font-mono text-[7px] text-slate-500 print:text-slate-600 leading-tight">
                  <span>Conferência Geral EBX</span><br />
                  <span>Nº Embaixador: {liveMember.manualNumber || 'S/N'}</span>
                </div>
              </div>
            </div>

          </div>

          {/* PAINEL DE GESTÃO DA FOTO DO CARTÃO (Oculto na Impressão) */}
          <div className="mt-6 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs print:hidden">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoFileChange}
              className="hidden"
            />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Fotografia do Cartão Digital
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Cada usuário pode fazer o upload da foto para o seu cartão. A exclusão dessa foto é de competência exclusiva da Direção (Diretor e Secretário com permissão).
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {canUploadPhoto && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-900 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>{liveMember.photoUrl ? 'Substituir Fotografia' : 'Carregar Fotografia'}</span>
                  </button>
                )}

                {liveMember.photoUrl && isLeadershipAllowedToDelete && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    title="Excluir foto do cartão (Apenas Direção com Permissão)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir Foto (Direção)</span>
                  </button>
                )}

                {liveMember.photoUrl && !isLeadershipAllowedToDelete && (
                  <span className="text-[10px] text-slate-400 font-medium italic">
                    (Exclusão reservada à Direção)
                  </span>
                )}
              </div>
            </div>

            {/* Confirmação de Exclusão pela Direção */}
            {isConfirmingDelete && (
              <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs space-y-2">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Confirmar Exclusão de Fotografia pela Direção</span>
                </div>
                <p className="text-[11px] text-rose-700 dark:text-rose-300">
                  Tem a certeza de que deseja excluir a fotografia deste cartão de membro? Esta operação remove a foto do cadastro na nuvem e será registada na auditoria institucional.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleConfirmDeletePhoto}
                    disabled={isProcessing}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isProcessing ? 'A excluir...' : 'Confirmar e Excluir Foto'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    disabled={isProcessing}
                    className="px-3 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded text-xs transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Mensagem de Feedback */}
            {feedback && (
              <div className={`mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
              }`}>
                {feedback.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
                <span>{feedback.message}</span>
              </div>
            )}
          </div>

          {/* Instruções de Impressão (Apenas visível na tela, oculto no print) */}
          <div className="mt-4 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between flex-wrap gap-3 print:hidden">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0" />
              <span>
                <strong>Selo de Autenticidade Digital:</strong> Este cartão possui validade oficial em todas as atividades locais e regionais do clube.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / Gerar PDF</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold rounded-lg text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer sm:hidden"
              >
                <X className="w-4 h-4" />
                <span>Voltar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
