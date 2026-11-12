import React, { useState } from 'react';
import {
  Bell,
  Menu,
  Shield,
  UserCheck,
  ChevronDown,
  Info,
  CheckCircle2,
  ExternalLink,
  Save,
  Moon,
  Sun,
  CreditCard,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { ROLE_LABELS } from '../../services/permissionService';
import { RoleType } from '../../types';
import { isNotificationAuthorizedForUser } from '../../utils/notificationSecurity';
import { MemberDigitalCardModal } from '../common/MemberDigitalCardModal';

interface NavbarProps {
  onToggleSidebar: () => void;
  onOpenAuditInfo?: () => void;
  onOpenNotifications: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, onOpenNotifications }) => {
  const { currentUser, state, forceSyncCloud, markNotificationAsRead, theme, toggleTheme } = useClub();
  const [isSaving, setIsSaving] = useState(false);
  const [isMyCardOpen, setIsMyCardOpen] = useState(false);

  const myMemberRecord = React.useMemo(() => {
    if (!currentUser) return null;
    const cleanUserEmail = (currentUser.email || '').trim().toLowerCase();
    const cleanUserName = (currentUser.name || '').trim().toLowerCase();

    if (currentUser.linkedMemberId) {
      const found = state.members.find(
        (m) =>
          m.id === currentUser.linkedMemberId ||
          m.manualNumber === currentUser.linkedMemberId ||
          (m.manualNumber && m.manualNumber.toLowerCase() === currentUser.linkedMemberId?.toLowerCase())
      );
      if (found) return found;
    }

    if (cleanUserEmail) {
      const found = state.members.find(
        (m) => m.email && m.email.trim().toLowerCase() === cleanUserEmail
      );
      if (found) return found;
    }

    if (cleanUserName) {
      const found = state.members.find(
        (m) => m.fullName && m.fullName.trim().toLowerCase() === cleanUserName
      );
      if (found) return found;
    }
    return {
      id: currentUser.id,
      manualNumber: 'EBX-0010126',
      fullName: currentUser.name,
      birthDate: '1998-01-01',
      gender: 'M' as const,
      identityCardNumber: '007849312LA041',
      phone: '923000000',
      email: currentUser.email,
      address: 'Luanda, Angola',
      category: 'embaixador' as const,
      status: 'ativo' as const,
      annualRenewalYear: state.settings.currentYear || 2026,
      joinedDate: '2026-01-01',
      guardianName: 'Secretaria Executiva',
      emergencyContact: {
        name: 'Secretaria Executiva',
        relationship: 'Direção do Clube',
        phone: '931793101',
      },
      createdAt: currentUser.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [currentUser, state.members, state.settings.currentYear]);

  // Notificações estritamente autorizadas e confidenciais para o utilizador ativo
  const authorizedNotifications = (state.notifications || []).filter((n) =>
    isNotificationAuthorizedForUser(n, currentUser)
  );
  const unreadNotifications = authorizedNotifications.filter((n) => !n.read);

  // Alertas de tarefas operacionais exclusivas do departamento
  const pendingRequestsCount =
    currentUser.role === 'secretario' || currentUser.role === 'diretor' || currentUser.role === 'admin_tecnico'
      ? state.requests.filter((r) => r.status === 'pendente' && (currentUser.role !== 'secretario' || r.assignedRole === 'secretario')).length
      : 0;

  const pendingProofsCount =
    currentUser.role === 'tesoureiro' || currentUser.role === 'diretor' || currentUser.role === 'admin_tecnico'
      ? state.paymentProofs.filter((p) => p.status === 'submetido').length
      : 0;

  const totalAlerts = unreadNotifications.length;

  const handleSave = async () => {
    setIsSaving(true);
    await forceSyncCloud();
    setIsSaving(false);
  };

  const handleNotificationClick = (id: string) => {
    markNotificationAsRead(id);
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white w-full max-w-full overflow-x-hidden">
      <div className="px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4 max-w-full">
        {/* Lado Esquerdo: Menu Mobile + Nome Institucional */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="p-2 -ml-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Abrir ou recolher menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img src="/assets/aistudio/IMG_3033_9ef579ca.PNG" alt="Logo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] sm:text-xs uppercase tracking-wider text-blue-400 font-semibold font-mono truncate max-w-[150px] xs:max-w-[220px] sm:max-w-none">
                CLUBE DE EMBAIXADORES PIONEIROS D'ALVORADA
              </span>
              <span className="text-sm font-bold text-slate-100 hidden sm:inline">
                Sistema de Gestão Oficial
              </span>
            </div>
          </div>
        </div>

        {/* Lado Direito: Perfil do Utilizador + Botão Salvar + Notificações + Terminar Sessão */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Botão de Alternância de Tema */}
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Alternar entre modo claro e escuro"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          {/* Botão de Guardar e Sincronizar */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 border border-blue-500 rounded-lg text-xs text-white font-bold transition-all shadow-md disabled:opacity-50 cursor-pointer"
            title="Guardar e sincronizar alterações na nuvem"
          >
            <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-bounce' : ''}`} />
            <span className="hidden md:inline">{isSaving ? 'A guardar...' : 'Guardar Alterações'}</span>
          </button>

          {/* Perfil do Utilizador Ativo */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <div className="text-left hidden md:block">
              <div className="text-[10px] text-slate-400 uppercase leading-none font-medium">{currentUser.name}</div>
              <div className="font-semibold text-slate-200 mt-0.5">
                {ROLE_LABELS[currentUser.role]?.label || currentUser.role}
              </div>
            </div>
          </div>

          {/* Notificações / Centro de Alertas */}
          <div className="relative">
            <button
              onClick={onOpenNotifications}
              className="relative p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer group"
              aria-label="Abrir centro de notificações"
              title={totalAlerts > 0 ? `${totalAlerts} alertas/notificações pendentes` : "Centro de Notificações"}
            >
              <Bell className="w-5 h-5 transition-transform group-hover:scale-110" />
              {totalAlerts > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-blue-600 border-2 border-slate-900 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg animate-pulse">
                  {totalAlerts > 99 ? '99+' : totalAlerts}
                </span>
              )}
            </button>
          </div>

          {/* Cartão Digital do Utilizador */}
          <button
            onClick={() => setIsMyCardOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-800 border border-slate-700 rounded-lg text-xs text-amber-400 font-bold transition-all cursor-pointer shadow-xs"
            title="Visualizar o meu Cartão Digital com QR Code"
          >
            <CreditCard className="w-4 h-4 text-amber-400" />
            <span className="hidden xl:inline">O Meu Cartão</span>
          </button>

          {/* Utilizador Ativo */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="w-8 h-8 rounded-full bg-blue-800 text-white flex items-center justify-center font-bold text-xs ring-1 ring-blue-400/30">
              {currentUser.name.charAt(0)}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-semibold text-slate-200 leading-tight">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {currentUser.email}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal do Cartão Digital do Próprio Utilizador */}
      <MemberDigitalCardModal
        member={isMyCardOpen ? myMemberRecord : null}
        onClose={() => setIsMyCardOpen(false)}
      />
    </header>
  );
};
