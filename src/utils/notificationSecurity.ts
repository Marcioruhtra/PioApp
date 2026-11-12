import { ClubNotification, UserAccount } from '../types';

/**
 * Motor de Segurança e Confidencialidade de Notificações
 * Garante que notificações sejam únicas, exclusivas e confidenciais:
 * - Operações da Secretaria -> apenas Secretaria (e Admin Técnico)
 * - Operações da Tesouraria -> apenas Tesouraria (e Admin Técnico)
 * - Operações da Capelania -> apenas Capelão e Diretor (e Admin Técnico)
 * - Sugestões à Direção -> apenas Diretor (e Admin Técnico)
 * - Notificações para um Membro específico -> apenas aquele Membro
 * Nunca difusão global desnecessária.
 */
export function isNotificationAuthorizedForUser(
  notif: ClubNotification,
  user: UserAccount | null | undefined
): boolean {
  if (!user) return false;

  // 1. Destinatário Individual Específico (Privado ao Utilizador / Membro)
  if (notif.recipientUserId) {
    const isDirectUser = notif.recipientUserId === user.id;
    const isDirectMember = Boolean(user.linkedMemberId && notif.recipientUserId === user.linkedMemberId);
    if (isDirectUser || isDirectMember) return true;
    
    // Apenas Admin Técnico pode ver notificações com destinatário específico se for de categoria 'system'
    if (user.role === 'admin_tecnico' && notif.category === 'system') return true;
    return false;
  }

  // 2. Membro alvo específico
  if (notif.targetMemberId) {
    if (user.linkedMemberId === notif.targetMemberId) return true;
  }

  // 3. Papel Único Exclusivo (recipientRole)
  if (notif.recipientRole) {
    if (user.role === notif.recipientRole) return true;
    if (user.role === 'admin_tecnico') return true;
    return false;
  }

  // 4. Múltiplos Papéis Exclusivos (recipientRoles)
  if (notif.recipientRoles && notif.recipientRoles.length > 0) {
    if (notif.recipientRoles.includes(user.role)) return true;
    if (user.role === 'admin_tecnico') return true;
    return false;
  }

  // 5. Isolamento por Módulo Funcional (Roteamento Confidencial Automático)
  // Operações de Tesouraria são estritamente da Tesouraria
  if (notif.category === 'financial' || notif.targetModule === 'treasury') {
    return user.role === 'tesoureiro' || user.role === 'admin_tecnico';
  }

  // Operações de Capelania são estritamente da Capelania e Direção
  if (notif.targetModule === 'chaplaincy') {
    return user.role === 'capelao' || user.role === 'diretor' || user.role === 'admin_tecnico';
  }

  // Operações de Secretaria / Gestão de Membros são estritamente da Secretaria
  if (notif.targetModule === 'members') {
    return user.role === 'secretario' || user.role === 'admin_tecnico';
  }

  // Operações de Formação / Instrutoria
  if (notif.category === 'training' || notif.targetModule === 'training') {
    return user.role === 'instrutor' || user.role === 'diretor' || user.role === 'admin_tecnico';
  }

  // Operações de Auditoria e Sistema Técnico
  if (notif.targetModule === 'audit' || notif.targetModule === 'settings') {
    return user.role === 'admin_tecnico' || user.role === 'diretor';
  }

  // Anúncios públicos oficiais: visíveis para todos
  if (notif.category === 'announcement') {
    return true;
  }

  // Por padrão seguro (Zero-Trust): não divulga globalmente
  // Se for notificação não-classificada, apenas Diretor e Admin Técnico
  return user.role === 'diretor' || user.role === 'admin_tecnico';
}
