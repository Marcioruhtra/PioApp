import React from 'react';
import { Home, Users, Wallet, LayoutGrid, Menu } from 'lucide-react';
import { ModuleName } from '../../types';

interface Props {
  activeModule: ModuleName;
  onSelectModule: (mod: ModuleName) => void;
  onOpenDrawer: () => void;
}

export const AndroidBottomNav: React.FC<Props> = ({ activeModule, onSelectModule, onOpenDrawer }) => {
  const tabs = [
    { id: 'dashboard', name: 'Início', icon: Home },
    { id: 'members', name: 'Membros', icon: Users },
    { id: 'treasury', name: 'Tesouraria', icon: Wallet },
    { id: 'member_portal', name: 'Portal', icon: LayoutGrid },
    { id: 'more', name: 'Mais', icon: Menu },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around py-2 px-1 z-40 md:hidden">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => tab.id === 'more' ? onOpenDrawer() : onSelectModule(tab.id as ModuleName)}
          className={`flex flex-col items-center p-2 text-xs ${activeModule === tab.id ? 'text-blue-900' : 'text-slate-500'}`}
        >
          <tab.icon className="w-6 h-6 mb-1" />
          {tab.name}
        </button>
      ))}
    </div>
  );
};
