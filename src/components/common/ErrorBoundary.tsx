import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary apanhou um erro não tratado:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 mx-auto mb-4 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-white mb-2">
              Ocorreu uma falha temporária ao carregar o sistema
            </h2>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              Ocorreu um erro inesperado na inicialização da aplicação no navegador. Clique no botão abaixo para reiniciar a sessão em segurança.
            </p>
            <button
              onClick={() => {
                try {
                  window.location.reload();
                } catch {
                  window.location.href = '/';
                }
              }}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Recarregar Sistema</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
