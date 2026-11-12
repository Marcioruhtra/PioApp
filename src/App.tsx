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

const MainAppContent: React.FC = () => {
  const { can, currentUser, isQuotaExceeded, toasts, dismissToast } = useClub();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(
      localStorage.getItem('pioapp_authenticated_session') ||
      sessionStorage.getItem('pioapp_authenticated_session') ||
      localStorage.getItem('pioapp_current_user') ||
      sessionStorage.getItem('pioapp_current_user')
    );
  });
  const [activeModule, setActiveModule] = useState<ModuleName>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  React.useEffect(() => {
    if (isAuthenticated) {
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
  }, [isAuthenticated, currentUser.id]);

  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  const handleLogout = async () => {
    await logOutUser();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pioapp_authenticated_session');
      localStorage.removeItem('pioapp_current_user');
      sessionStorage.removeItem('pioapp_authenticated_session');
      sessionStorage.removeItem('pioapp_current_user');
    }
    setIsAuthenticated(false);
  };

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
            <strong>Armazenamento Local Ativo:</strong> A cota diária gratuita de escritas do Firebase foi atingida. Todas as operações continuam gravadas em segurança no dispositivo e a sincronização em nuvem reinicia no próximo ciclo.
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
