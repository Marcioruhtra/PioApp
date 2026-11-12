import React from 'react';
import {
  LayoutDashboard,
  Users,
  Wallet,
  Calendar,
  GraduationCap,
  FileText,
  UserCheck,
  MessageSquare,
  BarChart3,
  Settings,
  ShieldAlert,
  Shield,
  LogOut,
  X,
} from 'lucide-react';
import { ModuleName } from '../../types';
import { useClub } from '../../context/ClubContext';
import { ROLE_LABELS } from '../../services/permissionService';

interface AndroidDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeModule: ModuleName;
  onSelectModule: (module: ModuleName) => void;
  onLogout: () => void;
}

interface NavItem {
  id: ModuleName;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const AndroidDrawer: React.FC<AndroidDrawerProps> = ({
  isOpen,
  onClose,
  activeModule,
  onSelectModule,
  onLogout,
}) => {
  const { currentUser, can, state } = useClub();
  const pendingRequests = state.requests.filter((r) => r.status === 'pendente').length;
  const pendingProofs = state.paymentProofs.filter((p) => p.status === 'submetido').length;

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Painel Principal', icon: LayoutDashboard },
    { id: 'members', label: 'Gestão de Membros', icon: Users, badge: state.members.filter((m) => m.status === 'ativo').length },
    { id: 'treasury', label: 'Tesouraria (Kz)', icon: Wallet, badge: pendingProofs > 0 ? pendingProofs : undefined },
    { id: 'activities', label: 'Atividades e Reuniões', icon: Calendar },
    { id: 'training', label: 'Classes e Formação', icon: GraduationCap },
    { id: 'documents', label: 'Documentos Oficiais', icon: FileText },
    { id: 'member_portal', label: 'Portal do Membro', icon: UserCheck },
    { id: 'requests', label: currentUser.role === 'membro' ? 'Avisos e Editais' : 'Pedidos e Avisos', icon: MessageSquare, badge: currentUser.role === 'membro' ? undefined : (pendingRequests > 0 ? pendingRequests : undefined) },
    { id: 'reports', label: 'Relatórios Oficiais', icon: BarChart3 },
    { id: 'settings', label: 'Configurações', icon: Settings },
    { id: 'audit', label: 'Auditoria e Acessos', icon: ShieldAlert },
  ];

  const visibleItems = navItems.filter((item) => can(item.id, 'VIEW'));

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex">
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-80 max-w-[85%] bg-slate-900 border-r border-slate-800 text-slate-100 flex flex-col h-full z-10 shadow-2xl animate-in slide-in-from-left duration-200">
        {/* Cabeçalho do Perfil na Gaveta */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-800 text-white flex items-center justify-center font-bold text-sm ring-2 ring-blue-400/30">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <div className="text-xs font-bold text-slate-100 truncate max-w-[170px]">{currentUser.name}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Shield className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] text-slate-400 font-medium">
                  {ROLE_LABELS[currentUser.role]?.label || currentUser.role}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de Módulos */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-3 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Navegação Institucional
            </span>
          </div>

          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectModule(item.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-800 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="flex-1 text-left truncate">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-300 rounded border border-blue-400/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Rodapé da Gaveta com Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium text-rose-300 hover:text-white hover:bg-rose-950/60 transition-colors border border-rose-900/40 cursor-pointer"
          >
            <LogOut className="w-5 h-5 text-rose-400" />
            <span className="flex-1 text-left">Terminar Sessão</span>
          </button>
        </div>
      </div>
    </div>
  );
};
