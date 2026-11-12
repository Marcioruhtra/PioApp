import React, { useState } from 'react';
import { Smartphone, Download, CheckCircle, X, Shield } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface InstallAndroidModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAndroidModal: React.FC<InstallAndroidModalProps> = ({ isOpen, onClose }) => {
  const { install, isInstalled } = usePWAInstall();
  const [installing, setInstalling] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    setInstalling(true);
    const result = await install();
    setInstalling(false);
    if (result) {
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl text-slate-100">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Smartphone className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Instalar PioApp Android (WebAPK)
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs text-slate-300">
          {success ? (
            <div className="py-6 text-center space-y-2">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
              <p className="font-bold text-sm text-white">App Instalada com Sucesso!</p>
              <p className="text-slate-400">O ícone do PioApp foi adicionado ao ecrã inicial do seu telemóvel Android.</p>
            </div>
          ) : isInstalled ? (
            <div className="py-6 text-center space-y-2">
              <CheckCircle className="w-12 h-12 text-blue-400 mx-auto" />
              <p className="font-bold text-sm text-white">Aplicação Já Instalada</p>
              <p className="text-slate-400">O PioApp já está a correr como aplicação nativa WebAPK no seu dispositivo.</p>
            </div>
          ) : (
            <>
              <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 space-y-2">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-blue-400" />
                  Vantagens da Instalação Direta:
                </p>
                <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">
                  <li>Funcionamento offline e sincronização na nuvem</li>
                  <li>Ecrã completo (fullscreen) sem barras do navegador</li>
                  <li>Acesso rápido direto a partir do ecrã inicial</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-slate-200">Como instalar no Google Chrome (Android):</p>
                <ol className="space-y-1.5 text-[11px] text-slate-400 list-decimal list-inside bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                  <li>Toque no botão de instalação abaixo ou no menu (3 pontos) do Chrome.</li>
                  <li>Selecione <strong>"Adicionar ao ecrã inicial"</strong> ou <strong>"Instalar aplicação"</strong>.</li>
                  <li>Confirme para criar o WebAPK nativo no seu telemóvel.</li>
                </ol>
              </div>

              <button
                onClick={handleInstallClick}
                disabled={installing}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{installing ? 'A iniciar assistente...' : 'Instalar PioApp no Android'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
