/**
 * Catálogo Central de Permissões e Motor de Autorização (RBAC)
 * Ocultar botões no frontend não é segurança suficiente:
 * Toda a camada de serviços valida as permissões antes de executar qualquer mutação.
 */

import { ModuleName, PermissionAction, RoleType } from '../types';

export interface PermissionDefinition {
  module: ModuleName;
  action: PermissionAction;
  description: string;
}

// Catálogo com todas as permissões do sistema
export const PERMISSION_CATALOG: PermissionDefinition[] = [
  // Painel Geral
  { module: 'dashboard', action: 'VIEW', description: 'Consultar painel e indicadores gerais' },

  // Gabinete Exclusivo do Diretor-associado (Acesso a outros cargos apenas mediante concessão do Administrador)
  { module: 'associate_director', action: 'VIEW', description: 'Aceder ao módulo exclusivo do Diretor-associado' },
  { module: 'associate_director', action: 'CREATE', description: 'Emitir diretivas operacionais e avaliações de equipas' },
  { module: 'associate_director', action: 'EDIT', description: 'Gerir equipas, alocações de membros e tarefas operacionais' },
  { module: 'associate_director', action: 'APPROVE', description: 'Validar cumprimento de diretivas e prontidão de equipas' },
  { module: 'associate_director', action: 'EXPORT', description: 'Exportar mapas executivos de equipas e supervisão' },
  { module: 'associate_director', action: 'PRINT', description: 'Imprimir boletins executivos de supervisão' },
  
  // Membros
  { module: 'members', action: 'VIEW', description: 'Consultar catálogo de membros' },
  { module: 'members', action: 'VIEW_DOSSIER_360', description: 'Consultar Dossiê 360º do Membro (Formação, Assiduidade, Quotas e Histórico)' },
  { module: 'members', action: 'CREATE', description: 'Registar novos membros (Secretário)' },
  { module: 'members', action: 'EDIT', description: 'Editar dados de membros' },
  { module: 'members', action: 'ARCHIVE', description: 'Arquivar membros mantendo histórico' },
  { module: 'members', action: 'DELETE', description: 'Eliminar definitivamente membros' },
  { module: 'members', action: 'APPROVE', description: 'Aprovar eliminações de membros' },
  { module: 'members', action: 'APPROVE_ENROLLMENT', description: 'Analisar, validar ou recusar solicitações de inscrição de novos membros (Concedido pelo Administrador)' },
  { module: 'members', action: 'MANAGE_ENROLLMENT_PERIOD', description: 'Encerrar e reabrir o período de inscrições no clube (Concedido pelo Administrador)' },
  { module: 'members', action: 'EXPORT', description: 'Exportar listas de membros' },
  { module: 'members', action: 'PRINT', description: 'Imprimir fichas e cartões de membros' },
  { module: 'members', action: 'ADMIN', description: 'Gestão institucional e renovação anual' },

  // Tesouraria
  { module: 'treasury', action: 'VIEW', description: 'Consultar receitas, quotas e saldos' },
  { module: 'treasury', action: 'CREATE', description: 'Emitir recibos e lançar despesas' },
  { module: 'treasury', action: 'EDIT', description: 'Retificar lançamentos com motivo e registo' },
  { module: 'treasury', action: 'APPROVE', description: 'Aprovar despesas e validar comprovativos' },
  { module: 'treasury', action: 'EXPORT', description: 'Exportar mapas financeiros' },
  { module: 'treasury', action: 'PRINT', description: 'Imprimir recibos e extratos de contas' },
  { module: 'treasury', action: 'ARCHIVE', description: 'Executar fecho mensal de contas' },
  { module: 'treasury', action: 'REOPEN', description: 'Reabrir mês fiscal encerrado (Apenas Diretor)' },
  { module: 'treasury', action: 'CREATE_ACCOUNT', description: 'Adicionar conta financeira institucional (Bancos e Caixas)' },
  { module: 'treasury', action: 'DELETE_ACCOUNT', description: 'Remover conta financeira institucional' },
  { module: 'treasury', action: 'CREATE_RUBRIC', description: 'Adicionar novas rubricas/taxas financeiras' },
  { module: 'treasury', action: 'DELETE_RUBRIC', description: 'Remover rubricas/taxas financeiras' },
  { module: 'treasury', action: 'CONFIGURE_QUOTAS', description: 'Definir e alterar o valor das quotas do clube' },
  { module: 'treasury', action: 'WAIVE_QUOTA_DEBT', description: 'Zerar dívida de quotas de membros (Concedido pelo Administrador)' },
  { module: 'treasury', action: 'ADMIN', description: 'Configurar contas bancárias, caixa e parâmetros fiscais' },

  // Atividades e Reuniões
  { module: 'activities', action: 'VIEW', description: 'Consultar calendário e atas' },
  { module: 'activities', action: 'CREATE', description: 'Criar reuniões, acampamentos e tarefas' },
  { module: 'activities', action: 'EDIT', description: 'Atualizar planeamento e presenças' },
  { module: 'activities', action: 'APPROVE', description: 'Aprovar atividade oficial e orçamento (Diretor)' },
  { module: 'activities', action: 'EXPORT', description: 'Exportar folhas de presença e atas' },
  { module: 'activities', action: 'PRINT', description: 'Imprimir atas estruturadas e presenças' },
  { module: 'activities', action: 'ARCHIVE', description: 'Encerrar atividades concluídas' },

  // Formação (Classes e Especialidades)
  { module: 'training', action: 'VIEW', description: 'Consultar classes e especialidades' },
  { module: 'training', action: 'CREATE', description: 'Atribuir classe/especialidade a membro' },
  { module: 'training', action: 'EDIT', description: 'Registar progresso e requisitos concluídos' },
  { module: 'training', action: 'APPROVE', description: 'Validação final de investidura (Diretor)' },
  { module: 'training', action: 'EXPORT', description: 'Exportar mapa de formação' },
  { module: 'training', action: 'PRINT', description: 'Imprimir cadernetas e certificados' },

  // Documentos Oficiais
  { module: 'documents', action: 'VIEW', description: 'Consultar arquivo de documentos' },
  { module: 'documents', action: 'CREATE', description: 'Emitir declarações, atas e recibos' },
  { module: 'documents', action: 'ARCHIVE', description: 'Anular documento com histórico gravado' },
  { module: 'documents', action: 'PRINT', description: 'Imprimir documentos oficiais' },
  { module: 'documents', action: 'EXPORT', description: 'Exportar ficheiros em formato de impressão' },

  // Portal do Membro
  { module: 'member_portal', action: 'VIEW', description: 'Consultar os próprios dados autorizados' },
  { module: 'member_portal', action: 'CREATE', description: 'Submeter comprovativo de pagamento e pedidos' },
  { module: 'member_portal', action: 'PRINT', description: 'Imprimir os próprios recibos' },

  // Circulares & Avisos
  { module: 'requests', action: 'VIEW', description: 'Consultar circulares e editais' },
  { module: 'requests', action: 'CREATE', description: 'Publicar circulares oficiais' },
  { module: 'requests', action: 'ADMIN', description: 'Remover circulares e gerir rasto' },

  // Relatórios
  { module: 'reports', action: 'VIEW', description: 'Consultar relatórios estatísticos' },
  { module: 'reports', action: 'EXPORT', description: 'Exportar dados analíticos' },
  { module: 'reports', action: 'PRINT', description: 'Imprimir relatórios oficiais' },

  // Configurações
  { module: 'settings', action: 'VIEW', description: 'Consultar configurações do clube' },
  { module: 'settings', action: 'EDIT', description: 'Alterar departamentos, tabelas e parâmetros' },
  { module: 'settings', action: 'ADMIN', description: 'Administração global' },

  // Auditoria e Administração Técnica
  { module: 'audit', action: 'VIEW', description: 'Consultar registo de auditoria e segurança' },
  { module: 'audit', action: 'ADMIN', description: 'Gestão de cópias de segurança e contas técnicas' },

  // Capelania Digital
  { module: 'chaplaincy', action: 'VIEW', description: 'Consultar pedidos de capelania e oração' },
  { module: 'chaplaincy', action: 'CREATE', description: 'Enviar pedido de capelania e apoio espiritual' },
  { module: 'chaplaincy', action: 'APPROVE', description: 'Atender e responder pedidos de capelania (Diretor/Capelão)' },

  // Sugestões
  { module: 'suggestions', action: 'VIEW', description: 'Consultar sugestões' },
  { module: 'suggestions', action: 'CREATE', description: 'Enviar sugestão' },
  { module: 'suggestions', action: 'APPROVE', description: 'Responder sugestões (Diretor)' },

  // Mensagens
  { module: 'messaging', action: 'VIEW', description: 'Consultar central de mensagens' },
  { module: 'messaging', action: 'CREATE', description: 'Enviar mensagens para membros, equipas ou clube' },
  { module: 'messaging', action: 'ADMIN', description: 'Eliminar mensagens no histórico' },

  // Inventário e Património
  { module: 'inventory', action: 'VIEW', description: 'Consultar stock de material e equipamentos do clube' },
  { module: 'inventory', action: 'CREATE', description: 'Registar novos bens patrimoniais e empréstimos' },
  { module: 'inventory', action: 'EDIT', description: 'Atualizar estado e manutenção de equipamentos' },
  { module: 'inventory', action: 'APPROVE', description: 'Aprovar requisições de material de acampamento' },
  { module: 'inventory', action: 'PRINT', description: 'Imprimir fichas de inventário e termos de responsabilidade' },

  // Condecorações e Mérito
  { module: 'awards', action: 'VIEW', description: 'Consultar menções honrosas, mérito e condecorações' },
  { module: 'awards', action: 'CREATE', description: 'Propor condecoração ou menção honrosa para membros' },
  { module: 'awards', action: 'APPROVE', description: 'Aprovar e homologar condecorações oficiais (Direção)' },

  // Música e Louvor
  { module: 'music', action: 'VIEW', description: 'Consultar repertório, hinos e escalas de louvor' },
  { module: 'music', action: 'CREATE', description: 'Adicionar hinos ao repertório e agendar escalas de louvor' },
  { module: 'music', action: 'EDIT', description: 'Editar letras, cifras e escalas musicais' },
  { module: 'music', action: 'PRINT', description: 'Imprimir cifras, repertório e escalas de louvor' },
];

// Matriz de permissões por papel institucional (Gerenciada pelo Admin)
export const ROLE_PERMISSIONS_MATRIX: Record<RoleType, Record<ModuleName, PermissionAction[]>> = {
  admin_tecnico: {
    dashboard: ['VIEW'],
    associate_director: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT', 'PRINT', 'ADMIN'],
    members: ['VIEW', 'VIEW_DOSSIER_360', 'CREATE', 'EDIT', 'EXPORT', 'PRINT', 'ARCHIVE', 'ADMIN', 'APPROVE_ENROLLMENT', 'MANAGE_ENROLLMENT_PERIOD'],
    treasury: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT', 'PRINT', 'REOPEN', 'ARCHIVE', 'ADMIN', 'CREATE_ACCOUNT', 'DELETE_ACCOUNT', 'CREATE_RUBRIC', 'DELETE_RUBRIC', 'CONFIGURE_QUOTAS', 'WAIVE_QUOTA_DEBT'],
    activities: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT', 'PRINT', 'ARCHIVE', 'ADMIN'],
    training: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT', 'PRINT', 'ADMIN'],
    documents: ['VIEW', 'EXPORT', 'PRINT', 'ADMIN'],
    member_portal: ['VIEW'],
    requests: ['VIEW', 'ADMIN'],
    reports: ['VIEW', 'EXPORT', 'PRINT', 'ADMIN'],
    settings: ['VIEW', 'EDIT', 'ADMIN'],
    audit: ['VIEW', 'ADMIN', 'EXPORT'],
    chaplaincy: ['VIEW', 'CREATE', 'APPROVE'],
    suggestions: ['VIEW', 'ADMIN'],
    messaging: ['VIEW', 'CREATE', 'ADMIN'],
    inventory: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'PRINT', 'ADMIN'],
    awards: ['VIEW', 'CREATE', 'APPROVE', 'ADMIN'],
    music: ['VIEW', 'CREATE', 'EDIT', 'PRINT', 'ADMIN'],
  },
  diretor: {
    dashboard: ['VIEW'],
    associate_director: [],
    members: ['VIEW', 'VIEW_DOSSIER_360', 'EDIT', 'EXPORT', 'PRINT', 'ARCHIVE', 'ADMIN', 'MANAGE_ENROLLMENT_PERIOD'],
    treasury: ['VIEW', 'CREATE', 'APPROVE', 'EXPORT', 'PRINT', 'REOPEN', 'CREATE_ACCOUNT', 'DELETE_ACCOUNT', 'CREATE_RUBRIC', 'DELETE_RUBRIC', 'CONFIGURE_QUOTAS', 'WAIVE_QUOTA_DEBT'],
    activities: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT', 'PRINT', 'ARCHIVE'],
    training: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT', 'PRINT'],
    documents: ['VIEW', 'CREATE', 'ARCHIVE', 'PRINT', 'EXPORT'],
    member_portal: ['VIEW'],
    requests: ['VIEW', 'CREATE', 'APPROVE'],
    reports: ['VIEW', 'EXPORT', 'PRINT'],
    settings: ['VIEW', 'EDIT'],
    audit: ['VIEW'],
    chaplaincy: ['VIEW', 'CREATE', 'APPROVE'],
    suggestions: ['VIEW', 'APPROVE'],
    messaging: ['VIEW', 'CREATE'],
    inventory: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'PRINT'],
    awards: ['VIEW', 'CREATE', 'APPROVE'],
    music: ['VIEW', 'CREATE', 'EDIT', 'PRINT'],
  },
  diretor_associado: {
    dashboard: ['VIEW'],
    associate_director: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT', 'PRINT'],
    members: ['VIEW', 'VIEW_DOSSIER_360', 'EDIT', 'EXPORT', 'PRINT'],
    treasury: [],
    activities: ['VIEW', 'CREATE', 'EDIT', 'EXPORT', 'PRINT'],
    training: ['VIEW', 'CREATE', 'EDIT', 'PRINT'],
    documents: ['VIEW', 'CREATE', 'PRINT', 'EXPORT'],
    member_portal: ['VIEW'],
    requests: ['VIEW', 'CREATE', 'APPROVE'],
    reports: ['VIEW', 'EXPORT', 'PRINT'],
    settings: ['VIEW'],
    audit: ['VIEW'],
    chaplaincy: ['VIEW', 'CREATE'],
    suggestions: [],
    messaging: ['VIEW', 'CREATE'],
    inventory: ['VIEW', 'CREATE', 'APPROVE'],
    awards: ['VIEW', 'CREATE', 'APPROVE'],
    music: ['VIEW', 'CREATE', 'EDIT', 'PRINT'],
  },
  secretario: {
    dashboard: ['VIEW'],
    associate_director: [],
    members: ['VIEW', 'CREATE', 'EDIT', 'EXPORT', 'PRINT', 'ARCHIVE', 'APPROVE', 'APPROVE_ENROLLMENT'],
    treasury: [],
    activities: ['VIEW', 'CREATE', 'EDIT', 'EXPORT', 'PRINT'],
    training: [],
    documents: ['VIEW', 'CREATE', 'PRINT', 'EXPORT'],
    member_portal: ['VIEW'],
    requests: ['VIEW', 'CREATE', 'APPROVE'],
    reports: ['VIEW', 'PRINT'],
    settings: ['VIEW', 'EDIT'],
    audit: ['VIEW'],
    chaplaincy: ['VIEW'],
    suggestions: [],
    messaging: ['VIEW', 'CREATE'],
    inventory: ['VIEW', 'CREATE'],
    awards: ['VIEW', 'CREATE'],
    music: ['VIEW', 'CREATE'],
  },
  tesoureiro: {
    dashboard: ['VIEW'],
    associate_director: [],
    members: ['VIEW'],
    treasury: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT', 'PRINT', 'ARCHIVE', 'ADMIN', 'CREATE_ACCOUNT', 'DELETE_ACCOUNT', 'CREATE_RUBRIC', 'DELETE_RUBRIC', 'CONFIGURE_QUOTAS'],
    activities: ['VIEW'],
    training: ['VIEW'],
    documents: ['VIEW', 'CREATE', 'PRINT', 'EXPORT'],
    member_portal: ['VIEW'],
    requests: ['VIEW', 'APPROVE'],
    reports: ['VIEW', 'EXPORT', 'PRINT'],
    settings: ['VIEW'],
    audit: ['VIEW'],
    chaplaincy: ['VIEW'],
    suggestions: [],
    messaging: ['VIEW', 'CREATE'],
    inventory: ['VIEW'],
    awards: ['VIEW'],
    music: ['VIEW'],
  },
  instrutor: {
    dashboard: ['VIEW'],
    associate_director: [],
    members: ['VIEW'],
    treasury: [],
    activities: ['VIEW', 'EDIT'],
    training: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'PRINT'],
    documents: ['VIEW'],
    member_portal: ['VIEW'],
    requests: ['VIEW', 'CREATE'],
    reports: ['VIEW'],
    settings: [],
    audit: [],
    chaplaincy: ['VIEW', 'CREATE'],
    suggestions: [],
    messaging: ['VIEW'],
    inventory: ['VIEW'],
    awards: ['VIEW', 'CREATE'],
    music: ['VIEW'],
  },
  membro: {
    dashboard: ['VIEW'],
    associate_director: [],
    members: [],
    treasury: [],
    activities: ['VIEW'],
    training: ['VIEW'],
    documents: [],
    member_portal: ['VIEW', 'CREATE', 'PRINT'],
    requests: ['VIEW', 'CREATE'],
    reports: [],
    settings: [],
    audit: [],
    chaplaincy: ['VIEW', 'CREATE'],
    suggestions: ['CREATE'],
    messaging: ['VIEW'],
    inventory: [],
    awards: ['VIEW'],
    music: ['VIEW'],
  },
  capelao: {
    dashboard: ['VIEW'],
    associate_director: [],
    members: ['VIEW'],
    treasury: [],
    activities: ['VIEW'],
    training: ['VIEW'],
    documents: ['VIEW'],
    member_portal: ['VIEW'],
    requests: ['VIEW'],
    reports: ['VIEW'],
    settings: [],
    audit: ['VIEW'],
    chaplaincy: ['VIEW', 'CREATE', 'APPROVE'],
    suggestions: [],
    messaging: ['VIEW'],
    inventory: [],
    awards: [],
    music: ['VIEW'],
  },
  conselheiro: {
    dashboard: ['VIEW'],
    associate_director: [],
    members: ['VIEW'],
    treasury: [],
    activities: ['VIEW', 'CREATE', 'EDIT'],
    training: ['VIEW', 'CREATE', 'EDIT'],
    documents: ['VIEW'],
    member_portal: ['VIEW'],
    requests: ['VIEW', 'CREATE'],
    reports: ['VIEW'],
    settings: [],
    audit: [],
    chaplaincy: ['VIEW', 'CREATE'],
    suggestions: ['CREATE'],
    messaging: ['VIEW', 'CREATE'],
    inventory: ['VIEW', 'CREATE'],
    awards: ['VIEW', 'CREATE'],
    music: ['VIEW', 'CREATE'],
  },
  musica: {
    dashboard: ['VIEW'],
    associate_director: [],
    members: ['VIEW'],
    treasury: [],
    activities: ['VIEW', 'CREATE', 'EDIT'],
    training: ['VIEW'],
    documents: ['VIEW', 'CREATE', 'PRINT'],
    member_portal: ['VIEW'],
    requests: ['VIEW', 'CREATE'],
    reports: ['VIEW'],
    settings: [],
    audit: [],
    chaplaincy: ['VIEW'],
    suggestions: ['CREATE'],
    messaging: ['VIEW', 'CREATE'],
    inventory: ['VIEW'],
    awards: ['VIEW', 'CREATE'],
    music: ['VIEW', 'CREATE', 'EDIT', 'PRINT'],
  },
};

export const getRolePermissions = (role: RoleType) => ROLE_PERMISSIONS_MATRIX[role];

export const hasPermission = (
  role: RoleType,
  module: ModuleName,
  action: PermissionAction
): boolean => {
  return ROLE_PERMISSIONS_MATRIX[role]?.[module]?.includes(action) || false;
};

export const updatePermission = (role: RoleType, module: ModuleName, action: PermissionAction, add: boolean) => {
  if (!ROLE_PERMISSIONS_MATRIX[role]) return;
  const current = ROLE_PERMISSIONS_MATRIX[role][module] || [];
  if (add) {
    if (!current.includes(action)) {
      ROLE_PERMISSIONS_MATRIX[role][module] = [...current, action];
    }
  } else {
    ROLE_PERMISSIONS_MATRIX[role][module] = current.filter(a => a !== action);
  }
};

/**
 * Tradução amigável dos papéis em Português
 */
export const ROLE_LABELS: Record<RoleType, { label: string; description: string }> = {
  admin_tecnico: {
    label: 'Administrador Técnico',
    description: 'Gestão de contas técnicas, infraestrutura, auditoria de segurança e cópias de segurança.',
  },
  diretor: {
    label: 'Diretor do Clube',
    description: 'Acesso operacional amplo, aprovação de despesas e atividades, validação final de formação.',
  },
  diretor_associado: {
    label: 'Diretor-associado',
    description: 'Supervisão administrativa, gestão de equipas, relatórios e acompanhamento de atividades (sem funções financeiras ou espirituais exclusivas).',
  },
  secretario: {
    label: 'Secretário',
    description: 'Registo e validação de membros, atas oficiais, folhas de presenças e declarações.',
  },
  tesoureiro: {
    label: 'Tesoureiro',
    description: 'Cobrança de quotas em Kz, recibos oficiais, conciliação bancária/caixa e fecho mensal.',
  },
  instrutor: {
    label: 'Instrutor / Guia',
    description: 'Acompanhamento de classes, especialidades, cumprimento de requisitos e presenças.',
  },
  membro: {
    label: 'Membro / Encarregado',
    description: 'Acesso exclusivo aos próprios dados, extrato de quotas, envio de comprovativos e pedidos.',
  },
  capelao: {
    label: 'Capelão',
    description: 'Gestão da capelania digital, acompanhamento pastoral e intercessão.',
  },
  conselheiro: {
    label: 'Conselheiro / Líder de Unidade',
    description: 'Acompanhamento direto de unidades e patrulhas, registo de presenças, progresso e requisições de material.',
  },
  musica: {
    label: 'Diretor de Música e Louvor',
    description: 'Gestão do ministério de música, ensaios, hinos do clube e escalas de louvor.',
  },
};

export const ACTION_LABELS: Record<PermissionAction, string> = {
  VIEW: 'Consultar',
  CREATE: 'Criar',
  EDIT: 'Editar',
  APPROVE: 'Aprovar',
  EXPORT: 'Exportar',
  PRINT: 'Imprimir',
  ARCHIVE: 'Arquivar',
  REOPEN: 'Reabrir',
  ADMIN: 'Administrar',
  CREATE_ACCOUNT: 'Adicionar Contas',
  DELETE_ACCOUNT: 'Remover Contas',
  DELETE: 'Eliminar',
  CREATE_RUBRIC: 'Adicionar Rubricas',
  DELETE_RUBRIC: 'Remover Rubricas',
  CONFIGURE_QUOTAS: 'Definir Quotas',
  WAIVE_QUOTA_DEBT: 'Zerar Dívida de Quotas',
  VIEW_DOSSIER_360: 'Dossiê 360º do Membro',
  APPROVE_ENROLLMENT: 'Validar / Recusar Inscrições',
  MANAGE_ENROLLMENT_PERIOD: 'Abrir / Encerrar Inscrições',
};

/**
 * Garante que a matriz de permissões salva em localStorage incorpore novas permissões do sistema
 */
export const syncPermissionsMatrix = (
  existingMatrix?: Record<RoleType, Record<ModuleName, PermissionAction[]>>
): Record<RoleType, Record<ModuleName, PermissionAction[]>> => {
  const base: Record<RoleType, Record<ModuleName, PermissionAction[]>> = JSON.parse(JSON.stringify(ROLE_PERMISSIONS_MATRIX));
  if (!existingMatrix) return base;

  const synced: Record<RoleType, Record<ModuleName, PermissionAction[]>> = JSON.parse(JSON.stringify(existingMatrix));
  const roles = Object.keys(base) as RoleType[];
  const newActions: PermissionAction[] = ['CREATE_ACCOUNT', 'DELETE_ACCOUNT', 'CREATE_RUBRIC', 'DELETE_RUBRIC'];
  const isLegacy = !newActions.some(act => synced.admin_tecnico?.treasury?.includes(act));
  const needsQuotaPermSync = !synced.admin_tecnico?.treasury?.includes('CONFIGURE_QUOTAS');
  const needsWaiveDebtPermSync = !synced.admin_tecnico?.treasury?.includes('WAIVE_QUOTA_DEBT');
  const needsDossier360Sync = !synced.admin_tecnico?.members?.includes('VIEW_DOSSIER_360');
  const needsEnrollmentPermSync = !synced.admin_tecnico?.members?.includes('APPROVE_ENROLLMENT');
  const needsEnrollmentPeriodPermSync = !synced.admin_tecnico?.members?.includes('MANAGE_ENROLLMENT_PERIOD');

  for (const role of roles) {
    if (!synced[role]) {
      synced[role] = JSON.parse(JSON.stringify(base[role]));
      continue;
    }
    const modules = Object.keys(base[role]) as ModuleName[];
    for (const mod of modules) {
      if (!Array.isArray(synced[role][mod])) {
        synced[role][mod] = [...base[role][mod]];
      } else if (mod === 'members') {
        if (needsDossier360Sync && base[role].members.includes('VIEW_DOSSIER_360') && !synced[role].members.includes('VIEW_DOSSIER_360')) {
          synced[role].members.push('VIEW_DOSSIER_360');
        }
        if (needsEnrollmentPermSync && base[role].members.includes('APPROVE_ENROLLMENT') && !synced[role].members.includes('APPROVE_ENROLLMENT')) {
          synced[role].members.push('APPROVE_ENROLLMENT');
        }
        if (needsEnrollmentPeriodPermSync && base[role].members.includes('MANAGE_ENROLLMENT_PERIOD') && !synced[role].members.includes('MANAGE_ENROLLMENT_PERIOD')) {
          synced[role].members.push('MANAGE_ENROLLMENT_PERIOD');
        }
      } else if (mod === 'activities') {
        for (const act of base[role].activities) {
          if (!synced[role].activities.includes(act)) {
            synced[role].activities.push(act);
          }
        }
      } else if (mod === 'treasury') {
        if (isLegacy) {
          for (const newAct of newActions) {
            if (base[role].treasury.includes(newAct) && !synced[role].treasury.includes(newAct)) {
              synced[role].treasury.push(newAct);
            }
          }
        }
        if (needsQuotaPermSync && base[role].treasury.includes('CONFIGURE_QUOTAS') && !synced[role].treasury.includes('CONFIGURE_QUOTAS')) {
          synced[role].treasury.push('CONFIGURE_QUOTAS');
        }
        if (needsWaiveDebtPermSync && base[role].treasury.includes('WAIVE_QUOTA_DEBT') && !synced[role].treasury.includes('WAIVE_QUOTA_DEBT')) {
          synced[role].treasury.push('WAIVE_QUOTA_DEBT');
        }
        if (needsDossier360Sync && role === 'secretario') {
          synced.secretario.treasury = synced.secretario.treasury.filter((a) => a !== 'VIEW');
        }
      } else if (mod === 'training') {
        if (needsDossier360Sync && role === 'secretario') {
          synced.secretario.training = synced.secretario.training.filter((a) => a !== 'VIEW');
        }
      } else if (mod === 'member_portal') {
        if (!synced[role].member_portal.includes('VIEW')) {
          synced[role].member_portal.push('VIEW');
        }
      }
    }
  }

  return synced;
};

/**
 * Em Gestão de Atividades e Reuniões, os papéis membro, capelão, tesoureiro e diretor_associado
 * não visualizam a sub-aba sensível de Presenças e Frequência.
 */
export const canViewActivitiesAttendanceTab = (role: RoleType): boolean => {
  return role !== 'membro' && role !== 'capelao' && role !== 'tesoureiro' && role !== 'diretor_associado';
};

/**
 * Em Auditoria e Acessos -> "Contas de Acesso", apenas Administradores (admin_tecnico) podem
 * visualizar contas de administradores; outros cargos e funções visualizam apenas contas não-administradoras.
 */
export const canViewAccountInAccessList = (
  viewerRole: RoleType,
  targetAccountRole: RoleType
): boolean => {
  if (viewerRole === 'admin_tecnico') return true;
  return targetAccountRole !== 'admin_tecnico';
};

export const filterVisibleAccessAccounts = <T extends { role: RoleType }>(
  accounts: T[],
  viewerRole: RoleType
): T[] => {
  if (viewerRole === 'admin_tecnico') return accounts;
  return accounts.filter((acc) => canViewAccountInAccessList(viewerRole, acc.role));
};

/**
 * Apenas o Administrador Técnico pode conceder ou revogar permissões do módulo exclusivo
 * do Diretor-associado na grelha de permissões.
 */
export const canGrantAssociateDirectorModule = (actorRole: RoleType): boolean => {
  return actorRole === 'admin_tecnico';
};

/**
 * Verifica se um cargo tem acesso ao módulo exclusivo do Diretor-associado segundo a grelha ativa.
 */
export const canAccessAssociateDirectorModule = (
  role: RoleType,
  permissionsMatrix?: Record<RoleType, Record<ModuleName, PermissionAction[]>>
): boolean => {
  if (role === 'admin_tecnico') return true;
  if (permissionsMatrix?.[role] && Array.isArray(permissionsMatrix[role].associate_director)) {
    return permissionsMatrix[role].associate_director.includes('VIEW');
  }
  return hasPermission(role, 'associate_director', 'VIEW');
};

/**
 * Apenas o Administrador Técnico pode conceder ou revogar a permissão de zerar dívidas de quotas
 * na grelha de permissões para outros cargos.
 */
export const canGrantWaiveQuotaDebt = (actorRole: RoleType): boolean => {
  return actorRole === 'admin_tecnico';
};

/**
 * Verifica pela Grelha de Permissões se o cargo pode consultar o Dossiê 360º completo na Ficha do Membro.
 */
export const hasDossier360Permission = (
  role: RoleType,
  permissionsMatrix?: Record<RoleType, Record<ModuleName, PermissionAction[]>>
): boolean => {
  if (role === 'admin_tecnico') return true;
  if (permissionsMatrix?.[role] && Array.isArray(permissionsMatrix[role].members)) {
    return permissionsMatrix[role].members.includes('VIEW_DOSSIER_360');
  }
  return hasPermission(role, 'members', 'VIEW_DOSSIER_360');
};

/**
 * Apenas o Administrador Técnico pode conceder ou revogar a permissão de autorizar/recusar
 * solicitações de inscrição de membros na grelha de permissões.
 */
export const canGrantApproveEnrollment = (actorRole: RoleType): boolean => {
  return actorRole === 'admin_tecnico';
};

/**
 * Verifica pela Grelha de Permissões se o cargo pode autorizar ou recusar solicitações de inscrição.
 */
export const hasApproveEnrollmentPermission = (
  role: RoleType,
  permissionsMatrix?: Record<RoleType, Record<ModuleName, PermissionAction[]>>
): boolean => {
  if (role === 'admin_tecnico') return true;
  if (permissionsMatrix?.[role] && Array.isArray(permissionsMatrix[role].members)) {
    return permissionsMatrix[role].members.includes('APPROVE_ENROLLMENT');
  }
  return hasPermission(role, 'members', 'APPROVE_ENROLLMENT');
};

/**
 * Apenas o Administrador Técnico pode conceder ou revogar a permissão de abrir/encerrar
 * inscrições na grelha de permissões.
 */
export const canGrantManageEnrollmentPeriod = (actorRole: RoleType): boolean => {
  return actorRole === 'admin_tecnico';
};

/**
 * Verifica pela Grelha de Permissões se o cargo pode abrir, agendar ou encerrar inscrições no clube.
 */
export const hasManageEnrollmentPeriodPermission = (
  role: RoleType,
  permissionsMatrix?: Record<RoleType, Record<ModuleName, PermissionAction[]>>
): boolean => {
  if (role === 'admin_tecnico') return true;
  if (permissionsMatrix?.[role] && Array.isArray(permissionsMatrix[role].members)) {
    return permissionsMatrix[role].members.includes('MANAGE_ENROLLMENT_PERIOD');
  }
  return hasPermission(role, 'members', 'MANAGE_ENROLLMENT_PERIOD');
};




