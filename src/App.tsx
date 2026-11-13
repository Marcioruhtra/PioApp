/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ClubProvider, useClub } from './context/ClubContext';
import { ModuleName } from './types';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { LoginScreen } from './components/layout/LoginScreen';
import { NotificationCenterModal } from './components/common/NotificationCenterModal';
import { ToastContainer, ToastMessage } from './components/common/ToastContainer';
import { logOutUser } from './firebase';
import {
  INACTIVITY_TIMEOUT_MS,
  INACTIVITY_WARNING_MS,
  isSessionInactive,
} from './utils/inactivity';

// Módulos
import { DashboardModule } from './components/modules/DashboardModule';
import { MembersModule } from './components/modules/MembersModule';
import { TreasuryModule } from './components/modules/TreasuryModule';
import { ActivitiesModule } from './components/modules/ActivitiesModule';
import { TrainingModule } from './components/modules/TrainingModule';
import { DocumentsModule } from './components/modules/DocumentsModule';
import { MemberPortalModule } from './components/modules/MemberPortalModule';
import { CircularsModule } from './components/modules/CircularsModule';
import { ReportsModule } from './components/modules/ReportsModule';
import { SettingsModule } from './components/modules/SettingsModule';
import { AuditAndAdminModule } from './components/modules/AuditAndAdminModule';
import { ChaplaincyModule } from './components/modules/ChaplaincyModule';
import { SuggestionsModule } from './components/modules/SuggestionsModule';
import { MessagingModule } from './components/modules/MessagingModule';

const LAST_ACTIVITY_STORAGE_KEY = 'pioapp_last_activity_at';
const INACTIVITY_LOGOUT_MESSAGE =
  'A sua sessão foi encerrada automaticamente após 5 minutos de inatividade por motivos de segurança.';

const MainAppContent: React.FC = () => {
  const { state, can, currentUser, isQuotaExceeded, isCloudLoading, toasts, dismissToast, addToast } = useClub();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(
      sessionStorage.getItem('pioapp_authenticated_session') ||
      sessionStorage.getItem('pioapp_current_user') ||
      localStorage.getItem('pioapp_authenticated_session') ||
      localStorage.getItem('pioapp_current_user')
    );
  });
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleName>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const lastActivityRef = React.useRef<number>(Date.now());
  const lastThrottleRef = React.useRef<number>(0);
  const inactivityWarningShownRef = React.useRef<boolean>(false);

  const performLogout = React.useCallback(async (expiredReason?: string) => {
    await logOutUser();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pioapp_authenticated_session');
      localStorage.removeItem('pioapp_current_user');
      localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
      sessionStorage.removeItem('pioapp_authenticated_session');
      sessionStorage.removeItem('pioapp_current_user');
      sessionStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
    }
    inactivityWarningShownRef.current = false;
    setSessionExpiredMessage(expiredReason || null);
    setIsAuthenticated(false);
  }, []);

  // Garante que uma sessão guardada é validada em tempo real contra os utilizadores vivos da nuvem
  React.useEffect(() => {
    if (!isCloudLoading && isAuthenticated && currentUser && currentUser.id !== 'INST-001' && state.users.length > 0) {
      const liveUser = state.users.find(
        (u) =>
          u.id === currentUser.id ||
          (u.email && currentUser.email && u.email.toLowerCase() === currentUser.email.toLowerCase())
      );
      if (!liveUser || liveUser.active === false) {
        performLogout();
      }
    }
  }, [isCloudLoading, isAuthenticated, currentUser, state.users, performLogout]);

  // Função global de encerramento automático por inatividade (5 minutos)
  React.useEffect(() => {
    if (!isAuthenticated || isCloudLoading || typeof window === 'undefined') {
      return;
    }

    const now = Date.now();
    const storedLastRaw = sessionStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
    const storedLast = storedLastRaw ? Number(storedLastRaw) : NaN;

    if (Number.isFinite(storedLast) && isSessionInactive(storedLast, now, INACTIVITY_TIMEOUT_MS)) {
      performLogout(INACTIVITY_LOGOUT_MESSAGE);
      return;
    }

    lastActivityRef.current = now;
    lastThrottleRef.current = now;
    inactivityWarningShownRef.current = false;
    sessionStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));

    const registerActivity = () => {
      const currentNow = Date.now();
      // Se já expirou antes deste evento (ex: separador em suspensão), encerra imediatamente
      if (isSessionInactive(lastActivityRef.current, currentNow, INACTIVITY_TIMEOUT_MS)) {
        performLogout(INACTIVITY_LOGOUT_MESSAGE);
        return;
      }
      if (currentNow - lastThrottleRef.current < 1000) {
        return;
      }
      lastThrottleRef.current = currentNow;
      lastActivityRef.current = currentNow;
      inactivityWarningShownRef.current = false;
      try {
        sessionStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(currentNow));
      } catch {
        // Ignorado em ambientes restritos
      }
    };

    const checkInactivity = () => {
      const currentNow = Date.now();
      const elapsed = currentNow - lastActivityRef.current;

      if (isSessionInactive(lastActivityRef.current, currentNow, INACTIVITY_TIMEOUT_MS)) {
        performLogout(INACTIVITY_LOGOUT_MESSAGE);
        return;
      }

      if (elapsed >= INACTIVITY_WARNING_MS && !inactivityWarningShownRef.current) {
        inactivityWarningShownRef.current = true;
        addToast(
          'Aviso de Segurança da Sessão',
          'Sessão prestes a encerrar por inatividade (menos de 1 minuto restante). Interaja para continuar autenticado.',
          'warning'
        );
      }
    };

    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      checkInactivity();
    };

    const activityEvents: (keyof WindowEventMap)[] = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'pointerdown',
      'click',
    ];

    activityEvents.forEach((evt) => {
      window.addEventListener(evt, registerActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    const intervalId = window.setInterval(checkInactivity, 10000);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, registerActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, isCloudLoading, performLogout, addToast]);

  React.useEffect(() => {
    if (isAuthenticated && !isCloudLoading && currentUser) {
      setActiveModule('member_portal');
      // Apenas regista subscrição de push se o utilizador já tiver concedido permissão expressa no navegador
      try {
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          import('./services/pushService').then(({ requestPushPermission }) => {
            requestPushPermission(currentUser.id).catch(() => {});
          });
        }
      } catch {
        // Ignorado em caso de iframe restrito
      }
    }
  }, [isAuthenticated, isCloudLoading, currentUser?.id]);

  if (isCloudLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-slate-900 text-white p-6">
        <img src="/assets/aistudio/logo.png" alt="PioApp" className="w-20 h-20 object-contain mb-4 animate-pulse" />
        <h1 className="text-xl font-black tracking-tight mb-1">PioApp</h1>
        <p className="text-xs text-slate-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>A sincronizar dados em tempo real com a nuvem...</span>
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen
        sessionExpiredMessage={sessionExpiredMessage}
        onClearSessionExpiredMessage={() => setSessionExpiredMessage(null)}
        onLogin={() => {
          const now = Date.now();
          lastActivityRef.current = now;
          lastThrottleRef.current = now;
          inactivityWarningShownRef.current = false;
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
          }
          setSessionExpiredMessage(null);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  const handleLogout = () => performLogout();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans selection:bg-blue-900 selection:text-white w-full max-w-full overflow-x-hidden min-w-0">
      {/* Topo Institucional */}
      <Navbar
        onToggleSidebar={() => setIsMobileOpen(!isMobileOpen)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
      />

      {/* Notificação informativa de cota diária do Firebase */}
      {isQuotaExceeded && (
        <div className="bg-sky-50 border-b border-sky-200 px-4 py-1.5 text-xs text-sky-900 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-500"></span>
            <strong>Limite Temporário de Escritas:</strong> A cota diária gratuita de escritas do Firebase foi atingida. As alterações desta sessão aguardam o próximo ciclo de sincronização.
          </span>
        </div>
      )}

      {/* Layout com Sidebar e Área de Conteúdo */}
      <div className="flex-1 flex w-full max-w-full min-w-0 overflow-x-hidden">
        {/* Barra Lateral de Navegação */}
        <Sidebar
          activeModule={activeModule}
          onSelectModule={(mod) => setActiveModule(mod)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          isMobileOpen={isMobileOpen}
          onCloseMobile={() => setIsMobileOpen(false)}
          onLogout={handleLogout}
        />

        {/* Área Principal de Trabalho */}
        <main
          className={`flex-1 min-w-0 w-full max-w-full overflow-x-hidden transition-all duration-200 p-3 sm:p-6 lg:p-8 pb-20 lg:pb-8 ${
            sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
          }`}
        >
          <div className="w-full max-w-7xl mx-auto min-w-0">
            {activeModule === 'dashboard' && (
              <DashboardModule onNavigate={(mod) => setActiveModule(mod)} />
            )}
            {activeModule === 'members' && <MembersModule />}
            {activeModule === 'treasury' && <TreasuryModule />}
            {activeModule === 'activities' && <ActivitiesModule />}
            {activeModule === 'training' && <TrainingModule />}
            {activeModule === 'documents' && <DocumentsModule />}
            {activeModule === 'member_portal' && <MemberPortalModule />}
            {activeModule === 'requests' && <CircularsModule />}
            {activeModule === 'reports' && <ReportsModule />}
            {activeModule === 'settings' && <SettingsModule />}
            {activeModule === 'audit' && <AuditAndAdminModule />}
            {activeModule === 'chaplaincy' && <ChaplaincyModule />}
            {activeModule === 'suggestions' && <SuggestionsModule />}
            {activeModule === 'messaging' && <MessagingModule />}
          </div>
        </main>
      </div>

      {/* Navegação Inferior Móvel para Telemóveis */}
      <MobileNav
        activeModule={activeModule}
        onSelectModule={(mod) => setActiveModule(mod)}
        onOpenSidebar={() => setIsMobileOpen(true)}
      />

      {/* Centro de Notificações Modal */}
      <NotificationCenterModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onNavigate={(mod) => setActiveModule(mod)}
      />

      {/* Contentor de Toasts Flutuantes */}
      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
      />
    </div>
  );
};

export default function App() {
  return (
    <ClubProvider>
      <MainAppContent />
    </ClubProvider>
  );
}
