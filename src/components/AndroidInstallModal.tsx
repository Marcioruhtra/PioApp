import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const AndroidInstallModal: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled || (!isInstallable && !isIOS)) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-xl font-bold text-slate-900">Instalar PioApp</h3>
        <p className="mt-2 text-slate-600">
          {isIOS ? '1. Toque em Partilhar.\n2. Toque em Adicionar ao Ecrã Principal.' : 'Instale a aplicação para uma experiência rápida e nativa no seu Android.'}
        </p>
        <div className="mt-6 flex gap-3">
          {isInstallable && (
            <button onClick={install} className="flex-1 rounded-xl bg-blue-600 py-3 text-white font-semibold">
              Instalar
            </button>
          )}
          <button onClick={() => setShowGuide(false)} className="flex-1 rounded-xl bg-slate-100 py-3 text-slate-900 font-semibold">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
