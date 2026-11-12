import React, { useState, useMemo } from 'react';
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  AlertTriangle,
  Info,
  DollarSign,
  Users,
  GraduationCap,
  Megaphone,
  Plus,
  Clock,
  Volume2,
  VolumeX,
  Search,
  ArrowRight,
  Sparkles,
  Calendar,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { useClub } from '../../context/ClubContext';
import { ClubNotification, ModuleName } from '../../types';
import { playNotificationSound } from '../../utils/notificationSound';
import { getPushPermissionStatus, requestPushPermission, showNativeNotification } from '../../services/pushService';
import { isNotificationAuthorizedForUser } from '../../utils/notificationSecurity';
import { ROLE_LABELS } from '../../services/permissionService';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (module: ModuleName) => void;
}

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Painel Principal',
  members: 'Membros',
  treasury: 'Tesouraria',
  activities: 'Atividades',
  training: 'Formação',
  documents: 'Documentos',
  member_portal: 'Portal do Membro',
  requests: 'Solicitações',
  reports: 'Relatórios',
  settings: 'Configurações',
  audit: 'Auditoria',
};

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins < 60) return `Há ${diffMins} min`;
    if (diffHours < 24 && date.getDate() === now.getDate()) {
      return `Hoje às ${date.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (diffDays === 1 || (diffHours < 48 && date.getDate() === now.getDate() - 1)) {
      return `Ontem às ${date.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('pt-AO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const {
    state,
    currentUser,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    clearAllNotifications,
    addAnnouncement,
    soundEnabled,
    toggleSoundEnabled,
  } = useClub();

  const [pushStatus, setPushStatus] = useState<'granted' | 'denied' | 'default' | 'unsupported'>(() => getPushPermissionStatus());
  const [isRequestingPush, setIsRequestingPush] = useState(false);
  const [pushFeedback, setPushFeedback] = useState<string | null>(null);

  const handleEnablePush = async () => {
    setIsRequestingPush(true);
    setPushFeedback(null);
    const res = await requestPushPermission(currentUser.id);
    setPushStatus(getPushPermissionStatus());
    setIsRequestingPush(false);
    if (res.success) {
      setPushFeedback('Notificações no dispositivo ativadas com sucesso!');
      showNativeNotification("Clube Pioneiros D'Alvorada", 'As notificações nativas no seu dispositivo estão ativas e operacionais!');
    } else {
      setPushFeedback(res.error || 'Falha ao ativar notificações.');
    }
    setTimeout(() => setPushFeedback(null), 4000);
  };

  const handleTestNativePush = () => {
    showNativeNotification("Notificação de Teste - Clube Pioneiros D'Alvorada", 'Este é um teste de notificação push no seu sistema operativo / telemóvel.');
    setPushFeedback('Notificação de teste enviada para o dispositivo!');
    setTimeout(() => setPushFeedback(null), 3000);
  };

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddReminderModal, setShowAddReminderModal] = useState(false);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [reminderUrgency, setReminderUrgency] = useState<'normal' | 'importante' | 'urgente'>('normal');



  // Notificações estritamente autorizadas e confidenciais para o utilizador atual
  const authorizedNotifications = useMemo(() => {
    return (state.notifications || []).filter((notif) =>
      isNotificationAuthorizedForUser(notif, currentUser)
    );
  }, [state.notifications, currentUser]);

  const filteredNotifications = useMemo(() => {
    return authorizedNotifications.filter((notif) => {
      if (showOnlyUnread && notif.read) return false;
      if (selectedCategory === 'unread' && notif.read) return false;
      if (
        selectedCategory !== 'all' &&
        selectedCategory !== 'unread' &&
        notif.category !== selectedCategory
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = notif.title.toLowerCase().includes(query);
        const matchesMsg = notif.message.toLowerCase().includes(query);
        return matchesTitle || matchesMsg;
      }
      return true;
    });
  }, [authorizedNotifications, showOnlyUnread, selectedCategory, searchQuery]);

  const unreadCount = authorizedNotifications.filter((n) => !n.read).length;

  if (!isOpen) return null;

  const handleCreateCustomReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderTitle.trim() || !reminderMessage.trim()) return;

    addAnnouncement(
      reminderTitle.trim(),
      reminderMessage.trim(),
      reminderUrgency,
      'todos'
    );

    setReminderTitle('');
    setReminderMessage('');
    setShowAddReminderModal(false);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'financial':
        return <DollarSign className="w-4 h-4 text-emerald-400" />;
      case 'member':
        return <Users className="w-4 h-4 text-blue-400" />;
      case 'training':
        return <GraduationCap className="w-4 h-4 text-amber-400" />;
      case 'request':
        return <FileText className="w-4 h-4 text-purple-400" />;
      case 'announcement':
        return <Megaphone className="w-4 h-4 text-sky-400" />;
      case 'system':
        return <ShieldAlert className="w-4 h-4 text-rose-400" />;
      default:
        return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100">
        {/* Cabeçalho Superior */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Centro de Notificações & Alertas
                </h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-xs font-black bg-blue-600 text-white rounded-full shadow-xs animate-pulse">
                    {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-slate-400">
                  Central oficial de avisos e comunicações
                </span>
                <span className="text-[10px] font-semibold text-amber-300 bg-amber-950/80 border border-amber-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span>🔒 Canal Restrito & Confidencial:</span>
                  <span className="text-white font-bold">{ROLE_LABELS[currentUser.role]?.label || currentUser.role}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Controlo de Som */}
            <button
              onClick={() => {
                toggleSoundEnabled();
                if (!soundEnabled) playNotificationSound();
              }}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                soundEnabled
                  ? 'bg-blue-950/50 border-blue-500/40 text-blue-400 hover:bg-blue-900/60'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title={soundEnabled ? 'Sons ativados (clique para silenciar)' : 'Sons silenciados (clique para ativar)'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Criar Alerta Manual */}
            <button
              onClick={() => setShowAddReminderModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
              title="Publicar novo alerta ou lembrete para todos"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Criar Alerta</span>
            </button>

            {/* Fechar */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Fechar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de Pesquisa e Filtros Rápidos */}
        <div className="px-5 sm:px-6 py-3 border-b border-slate-800 bg-slate-950/40 space-y-2.5">
          {/* Caixa de Pesquisa */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Pesquisar notificações por palavra-chave ou assunto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Abas de Categorias */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs scrollbar-none">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors shrink-0 ${
                  selectedCategory === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Todas ({authorizedNotifications.length})
              </button>
              <button
                onClick={() => setSelectedCategory('unread')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors shrink-0 ${
                  selectedCategory === 'unread'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Não Lidas {unreadCount > 0 && `(${unreadCount})`}
              </button>
              <button
                onClick={() => setSelectedCategory('financial')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors shrink-0 ${
                  selectedCategory === 'financial'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Financeiro
              </button>
              <button
                onClick={() => setSelectedCategory('member')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors shrink-0 ${
                  selectedCategory === 'member'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Membros
              </button>
              <button
                onClick={() => setSelectedCategory('training')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors shrink-0 ${
                  selectedCategory === 'training'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Formação
              </button>
              <button
                onClick={() => setSelectedCategory('request')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors shrink-0 ${
                  selectedCategory === 'request'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Solicitações
              </button>
              <button
                onClick={() => setSelectedCategory('announcement')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors shrink-0 ${
                  selectedCategory === 'announcement'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Avisos
              </button>
            </div>

            {/* Ações em Lote */}
            <div className="flex items-center gap-2 shrink-0 text-xs">
              {unreadCount > 0 && (
                <button
                  onClick={markAllNotificationsAsRead}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Marcar Todas</span>
                </button>
              )}
              {authorizedNotifications.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('Deseja eliminar todas as notificações do centro de alertas?')) {
                      clearAllNotifications();
                    }
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-transparent hover:border-rose-900/40"
                  title="Eliminar todas as notificações"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Limpar Tudo</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Banner de Notificações Push no Dispositivo */}
        {pushStatus !== 'granted' ? (
          <div className="mx-4 sm:mx-6 mt-3 p-3 bg-blue-950/40 border border-blue-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 shrink-0 mt-0.5">
                <Bell className="w-4 h-4 animate-bounce" />
              </div>
              <div>
                <p className="font-bold text-white">Ativar Notificações no Dispositivo (Push)</p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Receba alertas diretamente no ecrã do seu computador ou telemóvel mesmo com a aplicação em segundo plano.
                </p>
                {pushFeedback && (
                  <p className="text-[11px] text-blue-300 font-semibold mt-1">{pushFeedback}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleEnablePush}
              disabled={isRequestingPush}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-lg shrink-0 transition-all shadow-md cursor-pointer text-xs disabled:opacity-50"
            >
              {isRequestingPush ? 'A ativar...' : 'Ativar no Dispositivo'}
            </button>
          </div>
        ) : (
          <div className="mx-4 sm:mx-6 mt-3 px-3.5 py-2 bg-emerald-950/20 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Notificações no dispositivo ativas (alertas nativos no ecrã e telemóvel)
            </span>
            <button
              onClick={handleTestNativePush}
              className="text-[11px] font-bold text-emerald-300 hover:text-emerald-200 underline cursor-pointer"
            >
              Testar Notificação Push
            </button>
          </div>
        )}

        {/* Lista de Notificações */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-600">
                <Bell className="w-7 h-7 opacity-40" />
              </div>
              <p className="text-sm font-bold text-slate-400">Nenhuma notificação encontrada</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? 'Nenhum resultado corresponde aos termos da pesquisa.'
                  : 'Os novos alertas de pagamentos, atividades, atas e solicitações aparecerão aqui automaticamente.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const isUrgent = notif.priority === 'urgente';
              const isHigh = notif.priority === 'alta';

              return (
                <div
                  key={notif.id}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all flex items-start gap-3.5 group relative ${
                    notif.read
                      ? 'bg-slate-900/60 border-slate-800/80 opacity-75 hover:opacity-100 hover:bg-slate-900'
                      : isUrgent
                      ? 'bg-rose-950/20 border-rose-500/40 shadow-md shadow-rose-950/30'
                      : isHigh
                      ? 'bg-amber-950/20 border-amber-500/40 shadow-md shadow-amber-950/30'
                      : 'bg-slate-800/80 border-blue-500/30 shadow-md shadow-blue-950/20'
                  }`}
                >
                  {/* Ícone de Categoria */}
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                    {getCategoryIcon(notif.category)}
                  </div>

                  {/* Conteúdo Principal */}
                  <div
                    onClick={() => {
                      if (!notif.read) markNotificationAsRead(notif.id);
                      if (onNavigate && notif.targetModule) {
                        onNavigate(notif.targetModule);
                        onClose();
                      }
                    }}
                    className="flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`text-xs font-bold leading-snug ${notif.read ? 'text-slate-300' : 'text-white'}`}>
                          {notif.title}
                        </h3>

                        {/* Tag de Urgência */}
                        {isUrgent && (
                          <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded">
                            Urgente
                          </span>
                        )}
                        {isHigh && (
                          <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                            Importante
                          </span>
                        )}

                        {/* Módulo Alvo */}
                        {notif.targetModule && (
                          <span className="px-1.5 py-0.2 text-[9px] font-mono text-slate-400 bg-slate-950 border border-slate-800 rounded">
                            {MODULE_LABELS[notif.targetModule] || notif.targetModule}
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-500 shrink-0 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(notif.timestamp)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed break-words">
                      {notif.message}
                    </p>

                    {/* Botão de Navegação Direta */}
                    {notif.targetModule && (
                      <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-blue-400 group-hover:text-blue-300 transition-colors">
                        <span>Aceder ao módulo ({MODULE_LABELS[notif.targetModule] || notif.targetModule})</span>
                        <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                      </div>
                    )}
                  </div>

                  {/* Ações Individuais */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!notif.read ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markNotificationAsRead(notif.id);
                        }}
                        className="p-1.5 text-blue-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Marcar como lida"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="p-1.5 text-slate-600">
                        <Check className="w-3.5 h-3.5 opacity-50" />
                      </span>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notif.id);
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                      title="Eliminar notificação"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé Informativo */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>Total: <strong>{authorizedNotifications.length}</strong></span>
            <span>·</span>
            <span>Não lidas: <strong className={unreadCount > 0 ? 'text-blue-400' : 'text-slate-400'}>{unreadCount}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => playNotificationSound()}
              className="px-2.5 py-1 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg font-medium transition-colors cursor-pointer text-[11px] flex items-center gap-1"
              title="Testar o toque de notificação"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Testar Toque</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition-colors cursor-pointer text-xs"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* Modal para Criar Alerta ou Lembrete Manual */}
      {showAddReminderModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 text-slate-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-blue-400" />
                Criar Alerta Institucional
              </h3>
              <button
                onClick={() => setShowAddReminderModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Este aviso será publicado como anúncio oficial, transmitido com toque sonoro e guardado para todos os utilizadores.
            </p>

            <form onSubmit={handleCreateCustomReminder} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Título do Alerta</label>
                <input
                  type="text"
                  required
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  placeholder="Ex: Reunião extraordinária de diretoria"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Mensagem Detalhada</label>
                <textarea
                  required
                  rows={3}
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                  placeholder="Descreva as instruções, horários e detalhes do aviso..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Nível de Prioridade / Urgência</label>
                <select
                  value={reminderUrgency}
                  onChange={(e) => setReminderUrgency(e.target.value as 'normal' | 'importante' | 'urgente')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="normal">Informativo / Normal</option>
                  <option value="importante">Importante</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddReminderModal(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors shadow-md flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Publicar e Notificar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
