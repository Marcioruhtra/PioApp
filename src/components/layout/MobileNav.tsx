import React from 'react';
import { LayoutDashboard, Users, Wallet, UserCheck, Menu } from 'lucide-react';
import { ModuleName } from '../../types';
import { useClub } from '../../context/ClubContext';

interface MobileNavProps {
  activeModule: ModuleName;
  onSelectModule: (module: ModuleName) => void;
  onOpenSidebar: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeModule,
  onSelectModule,
  onOpenSidebar,
}) => {
  const { can, currentUser } = useClub();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-slate-300 flex items-center justify-around h-16 px-1 safe-area-pb shadow-lg">
      <button
        onClick={() => onSelectModule('dashboard')}
        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] transition-colors"
      >
        <div
          className={`flex items-center justify-center px-3 py-1 rounded-full transition-all ${
            activeModule === 'dashboard'
              ? 'bg-blue-600/25 text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
        </div>
        <span className={`mt-0.5 truncate ${activeModule === 'dashboard' ? 'text-blue-400 font-semibold' : ''}`}>
          Painel
        </span>
      </button>

      {can('members', 'VIEW') && (
        <button
          onClick={() => onSelectModule('members')}
          className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] transition-colors"
        >
          <div
            className={`flex items-center justify-center px-3 py-1 rounded-full transition-all ${
              activeModule === 'members'
                ? 'bg-blue-600/25 text-blue-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-5 h-5" />
          </div>
          <span className={`mt-0.5 truncate ${activeModule === 'members' ? 'text-blue-400 font-semibold' : ''}`}>
            Membros
          </span>
        </button>
      )}

      {can('treasury', 'VIEW') && (
        <button
          onClick={() => onSelectModule('treasury')}
          className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] transition-colors"
        >
          <div
            className={`flex items-center justify-center px-3 py-1 rounded-full transition-all ${
              activeModule === 'treasury'
                ? 'bg-blue-600/25 text-blue-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wallet className="w-5 h-5" />
          </div>
          <span className={`mt-0.5 truncate ${activeModule === 'treasury' ? 'text-blue-400 font-semibold' : ''}`}>
            Tesouraria
          </span>
        </button>
      )}

      {currentUser.role === 'membro' && can('member_portal', 'VIEW') && (
        <button
          onClick={() => onSelectModule('member_portal')}
          className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] transition-colors"
        >
          <div
            className={`flex items-center justify-center px-3 py-1 rounded-full transition-all ${
              activeModule === 'member_portal'
                ? 'bg-blue-600/25 text-blue-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-5 h-5" />
          </div>
          <span className={`mt-0.5 truncate ${activeModule === 'member_portal' ? 'text-blue-400 font-semibold' : ''}`}>
            Meu Portal
          </span>
        </button>
      )}

      <button
        onClick={onOpenSidebar}
        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
      >
        <div className="flex items-center justify-center px-3 py-1 rounded-full">
          <Menu className="w-5 h-5" />
        </div>
        <span className="mt-0.5 truncate">Menu</span>
      </button>
    </nav>
  );
};

