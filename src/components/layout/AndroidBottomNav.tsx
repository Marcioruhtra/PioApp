import React from 'react';
import { LayoutDashboard, Users, Wallet, UserCheck, Menu } from 'lucide-react';
import { ModuleName } from '../../types';
import { useClub } from '../../context/ClubContext';

interface AndroidBottomNavProps {
  activeModule: ModuleName;
  onSelectModule: (module: ModuleName) => void;
  onOpenDrawer: () => void;
}

export const AndroidBottomNav: React.FC<AndroidBottomNavProps> = ({
  activeModule,
  onSelectModule,
  onOpenDrawer,
}) => {
  const { can, state } = useClub();
  const pendingProofs = state.paymentProofs.filter((p) => p.status === 'submetido').length;

  return (
    <nav className="bg-slate-900 border-t border-slate-800 text-slate-300 flex items-center justify-around h-16 px-2 shrink-0 z-40 select-none shadow-lg">
      <button
        onClick={() => onSelectModule('dashboard')}
        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] transition-colors group"
      >
        <div
          className={`flex items-center justify-center w-12 h-6 rounded-full transition-all ${
            activeModule === 'dashboard'
              ? 'bg-blue-600 text-white font-bold shadow-sm'
              : 'text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-800'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
        </div>
        <span className={`mt-0.5 truncate ${activeModule === 'dashboard' ? 'text-blue-400 font-semibold' : 'text-slate-400'}`}>
          Início
        </span>
      </button>

      {can('members', 'VIEW') && (
        <button
          onClick={() => onSelectModule('members')}
          className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] transition-colors group"
        >
          <div
            className={`flex items-center justify-center w-12 h-6 rounded-full transition-all ${
              activeModule === 'members'
                ? 'bg-blue-600 text-white font-bold shadow-sm'
                : 'text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
          </div>
          <span className={`mt-0.5 truncate ${activeModule === 'members' ? 'text-blue-400 font-semibold' : 'text-slate-400'}`}>
            Membros
          </span>
        </button>
      )}

      {can('treasury', 'VIEW') && (
        <button
          onClick={() => onSelectModule('treasury')}
          className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] transition-colors group relative"
        >
          <div
            className={`flex items-center justify-center w-12 h-6 rounded-full transition-all ${
              activeModule === 'treasury'
                ? 'bg-blue-600 text-white font-bold shadow-sm'
                : 'text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-800'
            }`}
          >
            <Wallet className="w-4 h-4" />
            {pendingProofs > 0 && (
              <span className="absolute top-0 right-3 w-2 h-2 bg-rose-500 rounded-full ring-1 ring-slate-900"></span>
            )}
          </div>
          <span className={`mt-0.5 truncate ${activeModule === 'treasury' ? 'text-blue-400 font-semibold' : 'text-slate-400'}`}>
            Tesouraria
          </span>
        </button>
      )}

      <button
        onClick={() => onSelectModule('member_portal')}
        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] transition-colors group"
      >
        <div
          className={`flex items-center justify-center w-12 h-6 rounded-full transition-all ${
            activeModule === 'member_portal'
              ? 'bg-blue-600 text-white font-bold shadow-sm'
              : 'text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
        </div>
        <span className={`mt-0.5 truncate ${activeModule === 'member_portal' ? 'text-blue-400 font-semibold' : 'text-slate-400'}`}>
          Portal
        </span>
      </button>

      <button
        onClick={onOpenDrawer}
        className="flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors group relative"
      >
        <div className="flex items-center justify-center w-12 h-6 rounded-full group-hover:bg-slate-800 transition-all">
          <Menu className="w-4 h-4" />
        </div>
        <span className="mt-0.5 truncate">Mais</span>
      </button>
    </nav>
  );
};
