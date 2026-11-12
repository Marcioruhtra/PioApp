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
  
  // Membros
  { module: 'members', action: 'VIEW', description: 'Consultar catálogo de membros' },
  { module: 'members', action: 'CREATE', description: 'Registar novos membros (Secretário)' },
  { module: 'members', action: 'EDIT', description: 'Editar dados de membros' },
  { module: 'members', action: 'ARCHIVE', description: 'Arquivar membros mantendo histórico' },
  { module: 'members', action: 'DELETE', description: 'Eliminar definitivamente membros' },
  { module: 'members', action: 'APPROVE', description: 'Aprovar eliminações de membros' },
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
  { module: 'treasury', action: 'ADMIN', description: 'Configurar contas bancárias, caixa e quotas' },

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

  // Pedidos e Avisos
  { module: 'requests', action: 'VIEW', description: 'Consultar avisos e pedidos pendentes' },
  { module: 'requests', action: 'CREATE', description: 'Publicar aviso ou submeter solicitação' },
  { module: 'requests', action: 'APPROVE', description: 'Decidir sobre pedidos institucionais' },

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
];

// Matriz de permissões por papel institucional (Gerenciada pelo Admin)
export const ROLE_PERMISSIONS_MATRIX: Record<RoleType, Record<ModuleName, PermissionAction[]>> = {
  admin_tecnico: {
    dashboard: ['VIEW'],
    members: ['VIEW', 'CREATE', 'EDIT', 'EXPORT', 'PRINT', 'ARCHIVE', 'ADMIN'],
    treasury: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT', 'PRINT', 'REOPEN', 'ARCHIVE', 'ADMIN', 'CREATE_ACCOUNT', 'DELETE_ACCOUNT', 'CREATE_RUBRIC', 'DELETE_RUBRIC'],
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
  },
  diretor: {
    dashboard: ['VIEW'],
    members: ['VIEW', 'EDIT', 'EXPORT', 'PRINT', 'ARCHIVE', 'ADMIN'],
    treasury: ['VIEW', 'CREATE', 'APPROVE', 'EXPORT', 'PRINT', 'REOPEN', 'CREATE_ACCOUNT', 'DELETE_ACCOUNT', 'CREATE_RUBRIC', 'DELETE_RUBRIC'],
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
  },
  secretario: {
    dashboard: ['VIEW'],
    members: ['VIEW', 'CREATE', 'EDIT', 'EXPORT', 'PRINT', 'ARCHIVE', 'APPROVE'],
    treasury: ['VIEW'],
    activities: ['VIEW', 'CREATE', 'EDIT', 'EXPORT', 'PRINT'],
    training: ['VIEW'],
    documents: ['VIEW', 'CREATE', 'PRINT', 'EXPORT'],
    member_portal: ['VIEW'],
    requests: ['VIEW', 'CREATE', 'APPROVE'],
    reports: ['VIEW', 'PRINT'],
    settings: ['VIEW', 'EDIT'],
    audit: ['VIEW'],
    chaplaincy: ['VIEW'],
    suggestions: [],
    messaging: ['VIEW', 'CREATE'],
  },
  tesoureiro: {
    dashboard: ['VIEW'],
    members: ['VIEW'],
    treasury: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT', 'PRINT', 'ARCHIVE', 'ADMIN', 'CREATE_ACCOUNT', 'DELETE_ACCOUNT', 'CREATE_RUBRIC', 'DELETE_RUBRIC'],
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
  },
  instrutor: {
    dashboard: ['VIEW'],
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
  },
  membro: {
    dashboard: ['VIEW'],
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
  },
  capelao: {
    dashboard: ['VIEW'],
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
  if (add) {
    if (!ROLE_PERMISSIONS_MATRIX[role][module].includes(action)) {
      ROLE_PERMISSIONS_MATRIX[role][module].push(action);
    }
  } else {
    ROLE_PERMISSIONS_MATRIX[role][module] = ROLE_PERMISSIONS_MATRIX[role][module].filter(a => a !== action);
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
};

/**
 * Garante que a matriz de permissões salva em localStorage incorpore novas permissões do sistema
 */
export const syncPermissionsMatrix = (
  existingMatrix?: Record<RoleType, Record<ModuleName, PermissionAction[]>>
): Record<RoleType, Record<ModuleName, PermissionAction[]>> => {
  const base: Record<RoleType, Record<ModuleName, PermissionAction[]>> = JSON.parse(JSON.stringify(ROLE_PERMISSIONS_MATRIX));
  if (!existingMatrix) return base;

  const roles = Object.keys(base) as RoleType[];
  const newActions: PermissionAction[] = ['CREATE_ACCOUNT', 'DELETE_ACCOUNT', 'CREATE_RUBRIC', 'DELETE_RUBRIC'];
  const isLegacy = !newActions.some(act => existingMatrix.admin_tecnico?.treasury?.includes(act));

  for (const role of roles) {
    if (!existingMatrix[role]) {
      existingMatrix[role] = base[role];
      continue;
    }
    const modules = Object.keys(base[role]) as ModuleName[];
    for (const mod of modules) {
      if (!existingMatrix[role][mod]) {
        existingMatrix[role][mod] = [...base[role][mod]];
      } else if (mod === 'activities') {
        for (const act of base[role].activities) {
          if (!existingMatrix[role].activities.includes(act)) {
            existingMatrix[role].activities.push(act);
          }
        }
      } else if (mod === 'treasury' && isLegacy) {
        for (const newAct of newActions) {
          if (base[role].treasury.includes(newAct) && !existingMatrix[role].treasury.includes(newAct)) {
            existingMatrix[role].treasury.push(newAct);
          }
        }
      }
    }
  }

  return existingMatrix;
};

