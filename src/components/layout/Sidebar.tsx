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
  ChevronLeft,
  ChevronRight,
  Shield,
  CheckCircle,
  LogOut,
  Heart,
  Send,
} from 'lucide-react';
import { ModuleName } from '../../types';
import { useClub } from '../../context/ClubContext';
import { ROLE_LABELS } from '../../services/permissionService';

interface SidebarProps {
  activeModule: ModuleName;
  onSelectModule: (module: ModuleName) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
}

interface NavItem {
  id: ModuleName;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  description: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  collapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  onLogout,
}) => {
  const { currentUser, can, state } = useClub();

  const isDirectorOrAdmin = currentUser.role === 'diretor' || currentUser.role === 'admin_tecnico';
  const unviewedSuggestions = isDirectorOrAdmin
    ? (state.suggestions || []).filter((s) => !s.viewedByDirector).length
    : 0;

  // Contagem de comprovativos pendentes para a Tesouraria
  const pendingProofs = state.paymentProofs.filter(p => p.status === 'submetido').length;

  // Conta circulares não lidas pelo membro
  const unreadCirculars = currentUser.linkedMemberId 
    ? (state.circulars || []).filter(c => !c.readBy.includes(currentUser.linkedMemberId!)).length
    : 0;

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Painel Principal',
      icon: LayoutDashboard,
      description: 'Visão geral e indicadores',
    },
    {
      id: 'members',
      label: 'Gestão de Membros',
      icon: Users,
      badge: state.members.filter((m) => m.status === 'ativo').length,
      description: 'Cadastro, matrículas e renovações',
    },
    {
      id: 'treasury',
      label: 'Tesouraria (Kz)',
      icon: Wallet,
      badge: pendingProofs > 0 ? pendingProofs : undefined,
      description: 'Quotas, recibos, despesas e fecho',
    },
    {
      id: 'activities',
      label: 'Atividades e Reuniões',
      icon: Calendar,
      description: 'Calendário, atas, tarefas e presenças',
    },
    {
      id: 'training',
      label: 'Classes e Formação',
      icon: GraduationCap,
      description: 'Classes, especialidades e investidura',
    },
    {
      id: 'documents',
      label: 'Documentos Oficiais',
      icon: FileText,
      description: 'Recibos, declarações e atas numeradas',
    },
    {
      id: 'member_portal',
      label: 'Portal do Membro',
      icon: UserCheck,
      badge: unviewedSuggestions > 0 ? unviewedSuggestions : undefined,
      description: isDirectorOrAdmin ? 'Área do membro & Caixa de Sugestões' : 'Área pessoal do membro / encarregado',
    },
    {
      id: 'requests',
      label: 'Circulares & Avisos',
      icon: MessageSquare,
      badge: unreadCirculars > 0 ? unreadCirculars : undefined,
      description: 'Comunicados oficiais e diretivas institucionais',
    },
    {
      id: 'chaplaincy',
      label: 'Capelania Digital',
      icon: Heart,
      badge: (state.chaplaincyRequests || []).filter(r => r.status === 'pendente').length || undefined,
      description: 'Pedidos de oração e aconselhamento',
    },
    {
      id: 'reports',
      label: 'Relatórios Oficiais',
      icon: BarChart3,
      description: 'Mapas estatísticos e exportação',
    },
    {
      id: 'settings',
      label: 'Configurações',
      icon: Settings,
      description: 'Parâmetros, quotas e unidades',
    },
    {
      id: 'suggestions',
      label: 'Sugestões à Direção',
      icon: MessageSquare,
      badge: unviewedSuggestions > 0 ? unviewedSuggestions : undefined,
      description: 'Envio e acompanhamento de sugestões',
    },
    {
      id: 'messaging',
      label: 'Mensagens',
      icon: Send,
      description: 'Enviar mensagens aos membros',
    },
    {
      id: 'audit',
      label: 'Auditoria e Acessos',
      icon: ShieldAlert,
      description: 'Contas, permissões e trilha de auditoria',
    },
  ];

  // Filtra itens com base nas permissões de visualização
  const visibleItems = navItems.filter((item) => can(item.id, 'VIEW'));

  return (
    <>
      {/* Backdrop Mobile */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 bg-slate-900 border-r border-slate-800 transition-all duration-200 flex flex-col justify-between ${
          collapsed ? 'w-20' : 'w-64'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Lista de Navegação */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <div className={`px-3 mb-2 ${collapsed ? 'hidden' : 'block'}`}>
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
                  onCloseMobile();
                }}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors group relative ${
                  isActive
                    ? 'bg-blue-800 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-colors ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />

                {!collapsed && (
                  <div className="flex-1 text-left truncate flex items-center justify-between">
                    <span className="truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-300 rounded border border-blue-400/30">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}

                {/* Tooltip quando recolhido */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-slate-950 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}

          {/* Botão de Terminar Sessão / Log Out no final da Navegação Institucional */}
          <div className="pt-3 mt-3 border-t border-slate-800">
            <button
              onClick={() => {
                onLogout();
                onCloseMobile();
              }}
              title={collapsed ? 'Terminar Sessão' : undefined}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium text-rose-300 hover:text-white hover:bg-rose-950/50 border border-rose-900/30 transition-colors group relative"
            >
              <LogOut className="w-5 h-5 shrink-0 text-rose-400 group-hover:text-rose-200" />
              {!collapsed && (
                <span className="truncate">Terminar Sessão</span>
              )}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-950 text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                  Terminar Sessão
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Rodapé da Sidebar: Info do Papel e Botão Recolher */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          {!collapsed ? (
            <div className="mb-2 px-2 py-1.5 bg-slate-800/60 rounded border border-slate-700/50">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-200 truncate">
                  {ROLE_LABELS[currentUser.role]?.label}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                {currentUser.name}
              </p>
            </div>
          ) : (
            <div className="flex justify-center mb-2">
              <Shield className="w-4 h-4 text-blue-400" />
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className="w-full hidden lg:flex items-center justify-center gap-2 py-1.5 text-xs text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!collapsed && <span className="text-[11px]">Recolher Menu</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
