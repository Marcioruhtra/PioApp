import React from 'react';
import { X, User, LogOut } from 'lucide-react';
import { ModuleName } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectModule: (mod: ModuleName) => void;
  onLogout: () => void;
}

export const AndroidDrawer: React.FC<Props> = ({ isOpen, onClose, onSelectModule, onLogout }) => {
  const modules: { id: ModuleName; name: string }[] = [
    { id: 'dashboard', name: 'Dashboard' },
    { id: 'members', name: 'Membros' },
    { id: 'treasury', name: 'Tesouraria' },
    { id: 'activities', name: 'Atividades' },
    { id: 'training', name: 'Formação' },
    { id: 'documents', name: 'Documentos' },
    { id: 'member_portal', name: 'Portal' },
    { id: 'requests', name: 'Pedidos' },
    { id: 'reports', name: 'Relatórios' },
    { id: 'settings', name: 'Configurações' },
    { id: 'audit', name: 'Auditoria' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute left-0 top-0 bottom-0 w-3/4 bg-white shadow-2xl p-6">
        <button onClick={onClose} className="mb-6"><X /></button>
        <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center"><User /></div>
            <span className="font-bold">Perfil</span>
        </div>
        <div className="space-y-4">
          {modules.map((mod) => (
            <button key={mod.id} onClick={() => { onSelectModule(mod.id); onClose(); }} className="block text-lg font-medium">{mod.name}</button>
          ))}
          <button onClick={onLogout} className="flex items-center gap-2 text-red-600 font-bold pt-6"><LogOut size={20} /> Sair</button>
        </div>
      </div>
    </div>
  );
};
