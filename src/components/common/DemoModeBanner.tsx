import React from 'react';
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { useClub } from '../../context/ClubContext';

export const DemoModeBanner: React.FC = () => {
  const { resetAllDemoData } = useClub();

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-amber-500 text-slate-950 font-bold text-[10px]">
          DEMO
        </span>
        <span className="font-semibold">MODO DEMONSTRAÇÃO ATIVO:</span>
        <span className="text-amber-800">
          Dados fictícios para validação operacional e testes em Angola (Moeda Kz). Nenhum dado real deve ser introduzido nesta fase.
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (window.confirm('Tem a certeza que deseja repor os dados demonstrativos originais?')) {
              resetAllDemoData();
            }
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-950 bg-amber-200/80 hover:bg-amber-300 rounded transition-colors"
          title="Repor conjunto de dados padrão"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Repor Dados Iniciais</span>
        </button>
      </div>
    </div>
  );
};
