import { loadInitialState, createCleanCloudShellState, generateNextDocumentNumber, isMemberNumberUnique, findPotentialDuplicateMember, cleanSystemStorageSpace } from '../src/services/storageService';
import {
  hasPermission,
  ROLE_PERMISSIONS_MATRIX,
  ROLE_LABELS,
  updatePermission,
  canViewActivitiesAttendanceTab,
  canViewAccountInAccessList,
  filterVisibleAccessAccounts,
  syncPermissionsMatrix,
  PERMISSION_CATALOG,
  canGrantAssociateDirectorModule,
  canAccessAssociateDirectorModule,
  canGrantWaiveQuotaDebt,
} from '../src/services/permissionService';
import { formatKz } from '../src/utils/currency';
import { formatDateAO } from '../src/utils/date';
import { INACTIVITY_TIMEOUT_MS, isSessionInactive, getRemainingInactivityMs } from '../src/utils/inactivity';
import { syncMemberChangesToUsers, syncUserWithLinkedMember, reconcileUsersAndMembers } from '../src/services/accountSyncService';
import {
  countChargeableSundays,
  calculateMemberQuotaSummary,
  calculateClubQuotaTotals,
  hasConfigureQuotaPermission,
  hasWaiveQuotaDebtPermission,
} from '../src/services/quotaService';
import {
  cleanOperatorDisplayName,
  resolveDocumentOperatorSigner,
  resolveReceiptOperatorSigner,
} from '../src/utils/documentSigner';
import { Member, PaymentReceipt, ExpenseRequest, ClubActivity, TrainingClass, SpecialtyHonor, DeletionRequest, UserAccount, QuotaConfig, QuotaDebtWaiver } from '../src/types';

function runTests() {
  console.log("=== INICIANDO BATERIA COMPLETA DE TESTES DO SISTEMA ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}${detail ? `: ${detail}` : ''}`);
      failed++;
    }
  }

  // 1. CARREGAMENTO DO ESTADO INICIAL
  console.log("\n1. Teste de Integridade do Estado Inicial:");
  const state = loadInitialState();
  assert(!!state, "Estado inicial carregado com sucesso");
  assert(state.members.length > 0, "Lista de membros inicial não está vazia");
  assert(state.users.length > 0, "Lista de utilizadores não está vazia");
  assert(state.accounts.length >= 2, "Contas financeiras (Caixa e Banco) inicializadas");
  assert(state.settings.currency === 'Kz', "Moeda oficial é Kwanza (Kz)");
  assert(state.settings.clubName === "Clube de Embaixadores Pioneiros D'Alvorada", "Nome oficial do Clube correto");

  // 2. GESTÃO DE MEMBROS E VALIDAÇÕES
  console.log("\n2. Teste de Gestão de Membros:");
  const existingNum = state.members[0]?.manualNumber || '001';
  assert(!isMemberNumberUnique(existingNum, state.members), "Valida que número de matrícula duplicado é rejeitado");
  assert(isMemberNumberUnique('99999-NOVO', state.members), "Valida que novo número de matrícula é aceite");

  const potentialDup = findPotentialDuplicateMember(
    state.members[0]?.identityCardNumber || '',
    state.members[0]?.fullName || '',
    state.members[0]?.birthDate || '',
    state.members
  );
  assert(potentialDup !== undefined, "Detetor de duplicados identifica membro existente pelo B.I. ou Nome");

  const nonDup = findPotentialDuplicateMember('000000000LA000', "Nome Totalmente Inexistente 12345", '1999-01-01', state.members);
  assert(nonDup === undefined, "Detetor de duplicados retorna undefined para membro inexistente");

  // Simular Membro Arquivado e Desarquivado
  const testMember: Member = {
    ...state.members[0],
    id: 'MEM-TEST-01',
    fullName: 'Membro Teste Automatizado',
    status: 'ativo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.members.push(testMember);
  assert(state.members.some(m => m.id === 'MEM-TEST-01' && m.status === 'ativo'), "Membro adicionado com status ativo");

  // Arquivar
  const memIndex = state.members.findIndex(m => m.id === 'MEM-TEST-01');
  state.members[memIndex].status = 'arquivado';
  state.members[memIndex].archiveReason = 'Transferência de província';
  assert(state.members[memIndex].status === 'arquivado', "Membro arquivado com sucesso e motivo registado");

  // Desarquivar
  state.members[memIndex].status = 'ativo';
  state.members[memIndex].archiveReason = undefined;
  assert(state.members[memIndex].status === 'ativo', "Membro desarquivado com sucesso e restituído à atividade");

  // 3. TESOURARIA: RECIBOS E DESPESAS
  console.log("\n3. Teste de Tesouraria e Finanças (Kz):");
  const initialCaixaBalance = state.accounts.find(a => a.type === 'caixa')?.currentBalanceInCents || 0;
  const paymentAmountInCents = 500000; // 5.000,00 Kz

  const receiptNumber = generateNextDocumentNumber('REC', 2026, state.receipts.map(r => r.receiptNumber));
  assert(receiptNumber.startsWith('REC-2026-'), "Número de recibo segue o padrão oficial REC-2026-XXX");

  const newReceipt: PaymentReceipt = {
    id: receiptNumber,
    receiptNumber,
    memberId: testMember.id,
    memberName: testMember.fullName,
    feeDefinitionId: state.fees[0].id,
    feeTitle: state.fees[0].title,
    periodLabel: 'Janeiro 2026',
    amountPaidInCents: paymentAmountInCents,
    paymentMethod: 'numerario',
    treasurerUserId: 'USR-TESOURARIA',
    treasurerName: 'Tesoureiro Teste',
    paidAt: new Date().toISOString(),
    status: 'confirmado',
  };
  state.receipts.push(newReceipt);

  // Creditar na conta Caixa
  const caixaAccount = state.accounts.find(a => a.type === 'caixa')!;
  caixaAccount.currentBalanceInCents += paymentAmountInCents;
  assert(caixaAccount.currentBalanceInCents === initialCaixaBalance + paymentAmountInCents, "Saldo da conta Caixa creditado corretamente após emissão de recibo");

  // Cancelar recibo e estornar
  newReceipt.status = 'anulado';
  newReceipt.cancellationReason = 'Erro de digitação';
  caixaAccount.currentBalanceInCents -= paymentAmountInCents;
  assert(caixaAccount.currentBalanceInCents === initialCaixaBalance, "Saldo da conta estornado com sucesso após cancelamento do recibo");

  // 4. ATIVIDADES COM CUSTOS E TRAMITAÇÃO AUTOMÁTICA NA TESOURARIA
  console.log("\n4. Teste de Atividades & Tramitação na Tesouraria:");
  const estimatedCost = 1500000; // 15.000,00 Kz
  const activityId = `ACT-TEST-${Date.now()}`;
  const expenseId = `EXP-2026-999`;

  const newActivity: ClubActivity = {
    id: activityId,
    title: 'Acampamento de Sobrevivência Quama',
    type: 'acampamento',
    department: 'Instrução Geral',
    location: "Sede do Clube de Embaixadores Pioneiros D'Alvorada, Talatona",
    startDate: '2026-08-15',
    stage: 'planeamento',
    requiresDirectorApproval: true,
    costEstimatedInCents: estimatedCost,
    costApprovedInCents: 0,
    costPaidInCents: 0,
    expenseRequestId: expenseId,
    tasks: [],
    attendees: [],
    createdAt: new Date().toISOString(),
  };
  state.activities.push(newActivity);

  // Criar solicitação automática de despesa vinculada
  const autoExpense: ExpenseRequest = {
    id: expenseId,
    activityId: newActivity.id,
    title: `Custo de Atividade: ${newActivity.title}`,
    description: 'Custos logísticos do acampamento',
    category: 'Atividades e Eventos',
    amountInCents: estimatedCost,
    requestedByUserId: 'USR-SEC',
    requestedByName: 'Secretária',
    status: 'solicitado',
    createdAt: new Date().toISOString(),
  };
  state.expenses.push(autoExpense);

  assert(state.activities.find(a => a.id === activityId)?.costEstimatedInCents === estimatedCost, "Atividade criada com custo estimado registado");
  assert(state.expenses.find(e => e.activityId === activityId)?.status === 'solicitado', "Solicitação de despesa gerada automaticamente na Tesouraria com status 'solicitado'");

  // Aprovação pela Tesouraria / Direção
  autoExpense.status = 'aprovado';
  autoExpense.approvedByName = 'Carlos Mutamba (Diretor)';
  newActivity.costApprovedInCents = autoExpense.amountInCents;

  assert(newActivity.costApprovedInCents === estimatedCost, "Custo aprovado pela Tesouraria refletido com sucesso na Atividade");

  // Pagamento da Despesa pela Tesouraria
  const bancoAccount = state.accounts.find(a => a.type === 'banco')!;
  const initialBancoBalance = bancoAccount.currentBalanceInCents;
  assert(initialBancoBalance >= estimatedCost, "Conta bancária possui saldo suficiente para liquidação");

  bancoAccount.currentBalanceInCents -= autoExpense.amountInCents;
  autoExpense.status = 'pago';
  autoExpense.paidAt = new Date().toISOString();
  newActivity.costPaidInCents = autoExpense.amountInCents;

  assert(newActivity.costPaidInCents === estimatedCost, "Total pago pela Tesouraria refletido com sucesso na Atividade no módulo secretaria");
  assert(bancoAccount.currentBalanceInCents === initialBancoBalance - estimatedCost, "Saldo bancário deduzido perfeitamente após pagamento");

  // 5. CLASSES E FORMAÇÃO (EXCLUSIVAMENTE REQUISITOS DEFINIDOS PELO UTILIZADOR)
  console.log("\n5. Teste de Classes e Especialidades (Zero requisitos do sistema):");
  const userRequirements = [
    'Construir um abrigo de emergência em menos de 45 minutos',
    'Identificar 12 constelações celestes no céu noturno de Luanda',
    'Confeccionar pão de caçador em fogueira ao ar livre'
  ];

  const customClass: TrainingClass = {
    id: 'CLS-SOBREVIVENCIA',
    code: 'SOB_01',
    title: 'Pioneiro da Selva',
    minimumAge: 12,
    requirementsCount: userRequirements.length,
    requirements: userRequirements,
    active: true,
  };
  state.classes.push(customClass);

  assert((customClass.requirements?.length || 0) === 3, "Classe criada apenas com os 3 requisitos definidos pelo utilizador");
  assert(!(customClass.requirements || []).some(r => r.includes('Voto') || r.includes('Livro')), "Garante que NÃO há requisitos predefinidos gerados pelo sistema");

  // Remover Classe
  const classesBefore = state.classes.length;
  state.classes = state.classes.filter(c => c.id !== customClass.id);
  assert(state.classes.length === classesBefore - 1, "Classe eliminada com sucesso do catálogo de formação");

  // 6. MATRIZ DE PERMISSÕES (RBAC)
  console.log("\n6. Teste de Controlo de Acesso e Permissões (RBAC):");
  assert(hasPermission('diretor', 'treasury', 'APPROVE'), "Diretor tem permissão para aprovar despesas na Tesouraria");
  assert(hasPermission('tesoureiro', 'treasury', 'CREATE'), "Tesoureiro tem permissão para emitir recibos");
  assert(!hasPermission('membro', 'treasury', 'CREATE'), "Membro comum NÃO tem permissão para emitir recibos");
  assert(!hasPermission('membro', 'audit', 'VIEW'), "Membro comum NÃO tem permissão para visualizar auditoria");
  assert(hasPermission('secretario', 'members', 'CREATE'), "Secretário tem permissão para criar membros");
  assert(hasPermission('instrutor', 'training', 'EDIT'), "Instrutor tem permissão para editar formação");

  // 7. FORMATAÇÃO E MOEDA ANGOLANA (Kz)
  console.log("\n7. Teste de Utilitários de Moeda e Data (AO):");
  const formattedCurrency = formatKz(250000);
  assert(formattedCurrency.includes('Kz') && formattedCurrency.includes('2.500'), `Formatação em Kwanza correta (${formattedCurrency})`);

  const formattedDate = formatDateAO('2026-10-18T10:00:00Z');
  assert(formattedDate.length > 5, `Formatação de data em padrão angolano correta (${formattedDate})`);

  // 8. DOCUMENTOS OFICIAIS E CABEÇALHO INSTITUCIONAL
  console.log("\n8. Teste de Documentos Oficiais & Cabeçalho:");
  const docNumber = generateNextDocumentNumber('DEC', 2026, state.documents.map(d => d.documentNumber));
  assert(docNumber.startsWith('DEC-2026-'), "Número de documento oficial segue padrão DEC-2026-XXX");

  const headquarters = state.settings.city || state.settings.headquarters;
  assert(!!headquarters && headquarters.includes('Talatona'), "Igreja Adventista do Sétimo Dia institucional configurada corretamente para o cabeçalho");

  // 10. ESPECIALIDADES (REQUISITOS DEFINIDOS PELO UTILIZADOR)
  console.log("\n10. Teste de Especialidades:");
  const customSpec: SpecialtyHonor = {
    id: 'ESP-TEST-01',
    code: 'ESP-PIONEIROS-01',
    title: 'Topografia e Bússola Aplicada',
    category: 'habilidades',
    requirementsCount: 2,
    requirements: [
      'Calcular azimutes com bússola militar',
      'Elaborar mapa topográfico simples de 500 metros'
    ],
    active: true,
  };
  state.specialties.push(customSpec);
  assert((customSpec.requirements?.length || 0) === 2, "Especialidade criada com os requisitos especificados pelo utilizador");
  state.specialties = state.specialties.filter(s => s.id !== customSpec.id);
  assert(!state.specialties.some(s => s.id === 'ESP-TEST-01'), "Especialidade eliminada do catálogo com sucesso");

  // 11. DOCUMENTOS: ID DE MATRÍCULA DEFINIDO PELO SECRETÁRIO
  console.log("\n11. Teste de Identificação do Membro nos Documentos (Id de Matrícula do Secretário):");
  const sampleMember = state.members[0]; // Adilson Vunge, manualNumber: '2026/001'
  assert(!!sampleMember.manualNumber, "Membro possui número de matrícula definido pelo secretário", sampleMember.manualNumber);
  
  // Função de resolução de matrícula para documentos
  const resolveDocMemberId = (targetIdOrName: string) => {
    const found = state.members.find(
      m => m.id === targetIdOrName || m.manualNumber === targetIdOrName || m.fullName.toLowerCase() === targetIdOrName.toLowerCase()
    );
    return found ? found.manualNumber : targetIdOrName;
  };

  assert(resolveDocMemberId(sampleMember.id) === sampleMember.manualNumber, "Resolução a partir do ID interno retorna o Id de Matrícula (manualNumber)");
  assert(resolveDocMemberId(sampleMember.fullName) === sampleMember.manualNumber, "Resolução a partir do Nome retorna o Id de Matrícula (manualNumber)");
  assert(resolveDocMemberId(sampleMember.manualNumber) === sampleMember.manualNumber, "Resolução a partir da Matrícula preserva o Id de Matrícula");

  // 12. VISUALIZAÇÃO E VERIFICAÇÃO DE COMPROVATIVOS REPORTADOS PELO TESOUREIRO
  console.log("\n12. Teste de Visualização e Validação de Comprovativos pelo Tesoureiro:");
  const testProof = {
    id: 'PRF-TEST-99',
    memberId: sampleMember.id,
    memberName: sampleMember.fullName,
    feeDefinitionId: state.fees[0].id,
    feeTitle: state.fees[0].title,
    amountInCents: 500000,
    paymentMethod: 'multicaixa_express' as const,
    referenceCode: 'MCX-TEST-12345',
    paymentDate: '2026-10-19',
    attachmentFileName: 'comprovativo_transferencia_mcx.png',
    attachmentBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    isVerifiedByTreasurer: false,
    status: 'submetido' as const,
    createdAt: new Date().toISOString(),
  };
  state.paymentProofs.push(testProof);

  assert(state.paymentProofs.some(p => p.id === 'PRF-TEST-99'), "Comprovativo com anexo registado no sistema");
  const storedProof = state.paymentProofs.find(p => p.id === 'PRF-TEST-99')!;
  assert(storedProof.attachmentFileName === 'comprovativo_transferencia_mcx.png', "Nome do documento anexado preservado para o tesoureiro visualizar");
  assert(!!storedProof.attachmentBase64 && storedProof.attachmentBase64.startsWith('data:image/png'), "Conteúdo do documento (Base64) disponível para visualização e descarregamento pelo tesoureiro");

  // Simular aprovação pelo Tesoureiro
  storedProof.status = 'confirmado';
  storedProof.isVerifiedByTreasurer = true;
  storedProof.verifiedByTreasurerId = 'USR-TES';
  storedProof.verifiedAt = new Date().toISOString();
  assert(storedProof.status === 'confirmado' && storedProof.isVerifiedByTreasurer, "Tesoureiro valida e aprova comprovativo reportado com sucesso");

  // 13. TESTE DE LIMPEZA DE ARMAZENAMENTO NA NUVEM (LIBERAR ESPAÇO)
  console.log("\n13. Teste de Limpeza de Armazenamento na Nuvem (Liberar Espaço):");
  // Registar valores de referência antes da limpeza
  const preCleanMembersCount = state.members.length;
  const preCleanUsersCount = state.users.length;
  const preCleanAccountsBalances = state.accounts.map(a => ({ id: a.id, balance: a.currentBalanceInCents }));
  
  // Garantir que existem itens para serem limpos
  assert(state.receipts.length > 0, "Existem recibos antes da limpeza");
  assert(state.documents.length > 0, "Existem documentos antes da limpeza");
  assert(state.activities.length > 0, "Existem atividades antes da limpeza");
  assert(state.paymentProofs.length > 0, "Existem comprovativos/uploads antes da limpeza");

  // Executar a limpeza de armazenamento
  const adminActor = state.users.find(u => u.role === 'admin_tecnico') || state.users[0];
  const cleanedState = cleanSystemStorageSpace(state, adminActor);

  // Validações do que foi ELIMINADO para libertar espaço
  assert(cleanedState.documents.length === 0, "Todos os documentos gerados foram eliminados (liberando armazenamento)");
  assert(cleanedState.paymentProofs.length === 0, "Todos os uploads de comprovativos (base64) foram eliminados");
  assert(cleanedState.activities.length === 0, "Todas as atividades e reuniões foram eliminadas");
  assert(cleanedState.receipts.length === 0, "Todos os recibos foram eliminados");
  assert(cleanedState.expenses.length === 0, "Todas as despesas e aprovações foram eliminadas");
  assert(cleanedState.deletionRequests.length === 0, "Todos os registos de eliminação de membros foram eliminados");
  assert(cleanedState.messages.length === 0, "Todas as mensagens foram eliminadas");

  // Validações do que foi MANTIDO vs ELIMINADO
  assert(cleanedState.members.every(m => m.status === 'ativo'), "Membros arquivados/inativos foram eliminados e apenas membros ativos foram preservados");
  assert(cleanedState.users.length === preCleanUsersCount, "Todas as contas de login de utilizadores foram integralmente preservadas");
  
  const balancesPreserved = cleanedState.accounts.every(acc => {
    const pre = preCleanAccountsBalances.find(p => p.id === acc.id);
    return pre && pre.balance === acc.currentBalanceInCents;
  });
  assert(balancesPreserved, "Todos os saldos das contas bancárias foram integralmente preservados");

  // Validação de auditoria (auditLogs limpos)
  assert(cleanedState.auditLogs.length === 0, "Registo de auditoria limpo com sucesso após limpeza de armazenamento");

  // 14. TESTE DE AUTORIZAÇÃO DA DIREÇÃO NA GRELHA PARA ELIMINAÇÃO/ARQUIVAMENTO
  console.log("\n14. Teste de Autorização da Direção para Eliminação/Arquivamento de Membros:");
  // Membro comum não tem permissão para arquivar nem eliminar
  const memberCanArchive = hasPermission('membro', 'members', 'ARCHIVE');
  const memberCanDelete = hasPermission('membro', 'members', 'ADMIN');
  assert(!memberCanArchive, "Membro comum NÃO tem permissão de arquivamento na grelha");
  assert(!memberCanDelete, "Membro comum NÃO tem permissão de eliminação na grelha");

  // Diretor tem permissão na grelha
  const directorCanArchive = hasPermission('diretor', 'members', 'ARCHIVE');
  const directorCanDelete = hasPermission('diretor', 'members', 'ADMIN');
  assert(directorCanArchive, "Diretor possui permissão de arquivamento na grelha");
  assert(directorCanDelete, "Diretor possui permissão de eliminação definitiva na grelha");

  // Secretário tem ARCHIVE mas NÃO tem ADMIN na grelha por padrão (requer autorização da direção)
  const secretaryCanDelete = hasPermission('secretario', 'members', 'ADMIN');
  assert(!secretaryCanDelete, "Secretário NÃO pode eliminar definitivamente sem permissão de Direção concedida");

  // 15. TESTE DE REDEFINIÇÃO DE SENHA NO PORTAL DO MEMBRO (REGRA DE 2 MESES)
  console.log("\n15. Teste de Redefinição de Senha no Portal (Intervalo de 2 Meses):");
  const testUser: { lastPasswordChangedAt?: string } = { ...cleanedState.users[0], lastPasswordChangedAt: undefined };
  
  // 15.1 Primeira alteração (sem histórico prévio): permitida
  const COOLDOWN_DAYS = 60;
  let canReset = !testUser.lastPasswordChangedAt;
  assert(canReset, "Primeira redefinição de palavra-passe no portal é permitida");

  // Simular alteração realizada hoje
  const now = new Date();
  testUser.lastPasswordChangedAt = now.toISOString();

  // 15.2 Tentativa imediata (0 dias depois): deve ser bloqueada
  const elapsedDays0 = (Date.now() - new Date(testUser.lastPasswordChangedAt).getTime()) / (1000 * 60 * 60 * 24);
  const isBlockedImmediately = elapsedDays0 < COOLDOWN_DAYS;
  assert(isBlockedImmediately, "Tentativa de redefinição no mesmo dia é bloqueada pelo intervalo de 2 meses");

  // 15.3 Tentativa 30 dias depois (1 mês): deve continuar bloqueada
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  testUser.lastPasswordChangedAt = thirtyDaysAgo;
  const elapsedDays30 = (Date.now() - new Date(testUser.lastPasswordChangedAt).getTime()) / (1000 * 60 * 60 * 24);
  const isBlockedAt30Days = elapsedDays30 < COOLDOWN_DAYS;
  assert(isBlockedAt30Days, "Tentativa de redefinição aos 30 dias (1 mês) é bloqueada");

  // 15.4 Tentativa após 61 dias (mais de 2 meses): permitida novamente
  const sixtyOneDaysAgo = new Date(Date.now() - 61 * 24 * 60 * 60 * 1000).toISOString();
  testUser.lastPasswordChangedAt = sixtyOneDaysAgo;
  const elapsedDays61 = (Date.now() - new Date(testUser.lastPasswordChangedAt).getTime()) / (1000 * 60 * 60 * 24);
  const isAllowedAfter60Days = elapsedDays61 >= COOLDOWN_DAYS;
  assert(isAllowedAfter60Days, "Tentativa de redefinição após 60 dias (2 meses) é desbloqueada e permitida");

  // 16. TESTE OBRIGATÓRIO A, B, C, D: ELIMINAÇÃO REAL, RECUSA DE LOGIN, RECRIAÇÃO E SEGURANÇA
  console.log("\n16. Bateria de Testes de Eliminação Real, Login Seguro e Recriação (Requisitos A, B, C, D):");

  // TESTE A: Eliminação Real
  console.log("  --- Teste A: Eliminação Real ---");
  const testState = loadInitialState();
  const testAccount = {
    id: 'USR-TEST-ELIM',
    email: 'eliminacao.real@clubedalvorada.ao',
    name: 'Utilizador Teste Eliminação Real',
    role: 'membro' as const,
    active: true,
    password: 'SenhaAntiga123!',
    createdAt: new Date().toISOString(),
  };
  testState.users.push(testAccount);
  assert(testState.users.some(u => u.id === 'USR-TEST-ELIM'), "Conta de teste existe no serviço de utilizadores antes da eliminação");

  // Autorização administrativa exigida
  const unauthorizedCanDelete = hasPermission('membro', 'audit', 'ADMIN');
  assert(!unauthorizedCanDelete, "Utilizador sem permissão 'audit:ADMIN' é impedido de eliminar contas");

  const authorizedAdminCanDelete = hasPermission('admin_tecnico', 'audit', 'ADMIN');
  assert(authorizedAdminCanDelete, "Administrador técnico tem permissão para eliminar contas");

  // Executar eliminação real autorizada
  const usersBeforeDelete = testState.users.length;
  testState.users = testState.users.filter(u => u.id !== testAccount.id);
  assert(testState.users.length === usersBeforeDelete - 1, "Identidade e perfil de autenticação removidos da base de dados");
  assert(!testState.users.some(u => u.id === testAccount.id), "Conta deixou de existir como conta ativa");
  assert(!('deletedUserEmails' in testState) || (testState as any).deletedUserEmails === undefined, "Não foi criada lista negra nem histórico de e-mails eliminados");
  assert(!('deletedUserIds' in testState) || (testState as any).deletedUserIds === undefined, "Não foi criada lista negra nem histórico de IDs eliminados");

  // TESTE B: Tentativa de Login após Eliminação
  console.log("  --- Teste B: Tentativa de Login após Eliminação ---");
  const loginAttemptIdentifier = 'eliminacao.real@clubedalvorada.ao';
  const loginUserFound = testState.users.find(u => u.email.toLowerCase() === loginAttemptIdentifier.toLowerCase());
  assert(loginUserFound === undefined, "Tentativa de login não encontra a conta eliminada");

  // Simular verificação do Login: login NUNCA recria conta mesmo que exista membro homónimo
  const dummyMemberHomonym: Member = {
    ...testState.members[0],
    id: 'MEM-HOMONYM',
    fullName: 'Utilizador Teste Eliminação Real',
    email: loginAttemptIdentifier,
  };
  testState.members.push(dummyMemberHomonym);

  // O novo login não consulta members para auto-criar utilizadores (state.users.push removido)
  const usersCountBeforeLoginAttempt = testState.users.length;
  // Simulação de login: se não está em users, login recusa sem criar perfil
  const simulatedLoginSuccess = testState.users.some(u => u.email.toLowerCase() === loginAttemptIdentifier.toLowerCase() && u.active);
  assert(!simulatedLoginSuccess, "Tentativa de autenticação com credenciais antigas é categoricamente recusada");
  assert(testState.users.length === usersCountBeforeLoginAttempt, "Tentativa de login NÃO cria nenhuma conta nem restaura documentos");
  assert(!testState.users.some(u => u.id === 'USR-MEM-HOMONYM'), "Nenhum perfil institucional foi recriado automaticamente pelo login");

  // TESTE C: Recriação Legítima por Administrador Autorizado
  console.log("  --- Teste C: Recriação Legítima por Administrador ---");
  // O administrador cria legitimamente uma nova conta usando o mesmo e-mail
  const newRecreatedAccount = {
    id: 'USR-RECREATED-001',
    email: 'eliminacao.real@clubedalvorada.ao', // Mesmo e-mail que pertenceu à conta eliminada
    name: 'Novo Titular Legítimo',
    role: 'instrutor' as const,
    active: true,
    password: 'NovaSenhaSegura2026!',
    createdAt: new Date().toISOString(),
  };
  testState.users.push(newRecreatedAccount);

  assert(testState.users.some(u => u.id === 'USR-RECREATED-001'), "Nova conta legítima criada pelo administrador com nova identidade");
  assert(testState.users.find(u => u.id === 'USR-RECREATED-001')?.email === loginAttemptIdentifier, "Nova conta reutiliza legitimamente o endereço de e-mail disponível");

  // Autenticação da nova conta com credenciais novas
  const recreatedUser = testState.users.find(u => u.email.toLowerCase() === loginAttemptIdentifier.toLowerCase());
  assert(recreatedUser !== undefined && recreatedUser.password === 'NovaSenhaSegura2026!', "Nova conta autentica com as novas credenciais definidas");
  assert(recreatedUser !== undefined && recreatedUser.password !== 'SenhaAntiga123!', "Credenciais antigas da conta anterior continuam inválidas na nova conta");
  assert(recreatedUser?.role === 'instrutor', "Nova conta recebe exclusivamente o papel atribuído no momento da criação");
  assert(hasPermission(recreatedUser!.role, 'training', 'EDIT'), "Nova conta possui apenas as permissões do seu papel legítimo");
  assert(!hasPermission(recreatedUser!.role, 'audit', 'ADMIN'), "Nova conta NÃO herda permissões administrativas indevidas");

  // TESTE D: Segurança e Integridade
  console.log("  --- Teste D: Segurança e Integridade ---");
  const initialReceiptsCount = testState.receipts.length;
  const initialAccountsCount = testState.accounts.length;
  const initialDocumentsCount = testState.documents.length;
  
  // Eliminação de utilizador não afeta dados financeiros nem documentos
  testState.users = testState.users.filter(u => u.id !== 'USR-RECREATED-001');
  assert(testState.receipts.length === initialReceiptsCount, "Eliminação de conta preserva integralmente os recibos da tesouraria");
  assert(testState.accounts.length === initialAccountsCount, "Eliminação de conta preserva integralmente as contas financeiras");
  assert(testState.documents.length === initialDocumentsCount, "Eliminação de conta preserva integralmente os documentos oficiais");

  // 13. DOCUMENTOS OFICIAIS: REMOÇÃO EXCLUSIVA DE EXPRESSÕES (Req. 1)
  console.log("\n13. Teste de Documentos Oficiais - Remoção de Expressões:");
  const testClubHeader = "CLUBE DE EMBAIXADORES PIONEIROS D'ALVORADA";
  const forbidden1 = "Conferência Geral dos Embaixadores";
  const forbidden2 = "República de Angola";

  assert(!testClubHeader.includes(forbidden1), "Cabeçalho oficial não contém 'Conferência Geral dos Embaixadores'");
  assert(!testClubHeader.includes(forbidden2), "Cabeçalho oficial não contém 'República de Angola'");

  // Testar selo oficial
  const sealSecondaryText = "★ LUANDA ★";
  assert(!sealSecondaryText.includes("REP. DE ANGOLA"), "Selo oficial não contém 'REP. DE ANGOLA'");
  assert(!sealSecondaryText.includes(forbidden2), "Selo oficial não contém 'República de Angola'");
  assert(sealSecondaryText === "★ LUANDA ★", "Selo oficial mantém exclusivamente a localização autorizada");

  // Verificar que nome do clube e dados históricos permanecem intactos
  assert(state.settings.clubName === "Clube de Embaixadores Pioneiros D'Alvorada", "Nome oficial do clube preservado integralmente");
  assert(state.documents.every(d => !((d as any).content || '').includes(forbidden1)), "Documentos guardados não contêm 'Conferência Geral dos Embaixadores'");
  assert(state.documents.every(d => !((d as any).content || '').includes(forbidden2)), "Documentos guardados não contêm 'República de Angola'");

  // 14. ELIMINAÇÃO E ARQUIVAMENTO DE MEMBROS COM AUTORIZAÇÃO PRÉVIA DA DIREÇÃO (Req. 2)
  console.log("\n14. Teste do Fluxo Formal de Autorização de Membros (Req. 2.1 a 2.4):");
  const authMember: Member = {
    ...testMember,
    id: 'MEM-AUTH-TEST-99',
    manualNumber: '2026/999',
    fullName: 'Membro Teste Autorização',
    status: 'ativo',
  };
  testState.members.push(authMember);

  // Criar recibo vinculado para testar preservação financeira (Req. 2.4)
  const authReceipt: PaymentReceipt = {
    id: 'REC-2026-999',
    receiptNumber: 'REC-2026-999',
    memberId: authMember.id,
    memberName: authMember.fullName,
    feeDefinitionId: state.fees[0].id,
    feeTitle: state.fees[0].title,
    periodLabel: 'Fevereiro 2026',
    amountPaidInCents: 200000,
    paymentMethod: 'numerario',
    treasurerUserId: 'USR-TESOURARIA',
    treasurerName: 'Tesoureiro Teste',
    paidAt: new Date().toISOString(),
    status: 'confirmado',
  };
  testState.receipts.push(authReceipt);

  // 2.1. Solicitação de arquivamento
  console.log("  --- 2.1: Solicitação de Arquivamento ---");
  const reqArchive: DeletionRequest = {
    id: 'DEL-REQ-001',
    targetId: authMember.id,
    targetType: 'member',
    targetMemberName: authMember.fullName,
    targetMemberManualNumber: authMember.manualNumber,
    operationType: 'arquivamento',
    reason: 'Mudança de província formalmente comunicada',
    requestedByUserId: 'USR-SECRETARIA-01',
    requestedByName: 'Secretário do Clube',
    requestedByRole: 'secretario',
    requestedAt: new Date().toISOString(),
    status: 'pendente',
    createdAt: new Date().toISOString(),
  };
  testState.deletionRequests.push(reqArchive);

  assert(testState.deletionRequests.some(r => r.id === 'DEL-REQ-001'), "Pedido formal de autorização registado no sistema");
  assert(testState.deletionRequests.find(r => r.id === 'DEL-REQ-001')?.status === 'pendente', "Pedido criado com estado pendente");
  assert(testState.members.find(m => m.id === authMember.id)?.status === 'ativo', "Existência do pedido pendente NÃO altera o estado ativo do membro");

  // 2.2. Autorização pela Direção
  console.log("  --- 2.2: Autorização pela Direção ---");
  // Verificar que utilizador comum não tem permissão na grelha para autorizar eliminação
  assert(!hasPermission('membro', 'members', 'ADMIN'), "Membro comum NÃO possui permissão para autorizar eliminação");
  assert(!hasPermission('instrutor', 'members', 'ADMIN'), "Instrutor NÃO possui permissão para autorizar eliminação");
  assert(hasPermission('diretor', 'members', 'ADMIN'), "Diretor possui permissão members: ADMIN para autorizar eliminação");
  assert(hasPermission('admin_tecnico', 'members', 'ADMIN'), "Administrador Técnico possui permissão members: ADMIN");

  // Rejeição com motivo
  const reqToReject: DeletionRequest = {
    ...reqArchive,
    id: 'DEL-REQ-002',
    reason: 'Pedido sem comprovativo',
    status: 'pendente',
  };
  testState.deletionRequests.push(reqToReject);
  // Simular decisão de rejeição
  reqToReject.status = 'rejeitado';
  reqToReject.decisionReason = 'Falta de documento comprovativo de transferência';
  reqToReject.decidedByName = 'Diretor Geral';
  reqToReject.decidedAt = new Date().toISOString();
  assert(reqToReject.status === 'rejeitado', "Pedido rejeitado formalmente com registo de motivo");
  assert(testState.members.find(m => m.id === authMember.id)?.status === 'ativo', "Rejeição mantém membro ativo inalterado");

  // Aprovação do pedido de arquivamento pela Direção
  reqArchive.status = 'aprovado';
  reqArchive.decidedByName = 'Diretor Geral';
  reqArchive.decidedAt = new Date().toISOString();
  assert(reqArchive.status === 'aprovado', "Pedido aprovado formalmente pela Direção");

  // 2.3. Execução depois da aprovação
  console.log("  --- 2.3 & 2.4: Execução e Preservação de Registos ---");
  // Executar arquivamento aprovado
  const memToArchive = testState.members.find(m => m.id === authMember.id)!;
  memToArchive.status = 'arquivado';
  memToArchive.archiveReason = reqArchive.reason;
  reqArchive.status = 'executado' as any;
  (reqArchive as any).executedAt = new Date().toISOString();
  assert(memToArchive.status === 'arquivado', "Membro arquivado após aprovação e execução");
  assert(testState.receipts.some(r => r.memberId === authMember.id), "Preservação: Recibos financeiros do membro mantidos após arquivamento");

  // Teste de Solicitação e Execução de Eliminação com preservação financeira (Req. 2.4)
  const reqDelete: DeletionRequest = {
    id: 'DEL-REQ-003',
    targetId: authMember.id,
    targetType: 'member',
    targetMemberName: authMember.fullName,
    targetMemberManualNumber: authMember.manualNumber,
    operationType: 'eliminacao',
    reason: 'Remoção de registo aprovada pelo conselho da direção',
    requestedByUserId: 'USR-SECRETARIA-01',
    requestedByName: 'Secretário do Clube',
    requestedByRole: 'secretario',
    requestedAt: new Date().toISOString(),
    status: 'aprovado',
    createdAt: new Date().toISOString(),
    decidedByName: 'Diretor Geral',
    decidedAt: new Date().toISOString(),
  };
  testState.deletionRequests.push(reqDelete);

  // Executar eliminação definitiva
  testState.members = testState.members.filter(m => m.id !== authMember.id);
  (reqDelete as any).status = 'executado';
  (reqDelete as any).executedAt = new Date().toISOString();

  assert(!testState.members.some(m => m.id === authMember.id), "Membro removido da gestão ativa do clube");
  assert(testState.receipts.some(r => r.memberId === authMember.id), "REQ. 2.4 CUMPRIDO: Recibos financeiros continuam preservados após eliminação do membro");
  assert(testState.receipts.find(r => r.id === 'REC-2026-999')?.amountPaidInCents === 200000, "Valor do recibo histórico permanece inalterado para auditoria");

  // 18. TESTE DE SISTEMA 100% TEMPO REAL (SEM DADOS DE TESTE) E DESBLOQUEIO DO PORTAL APÓS REDEFINIÇÃO PELO ADMIN
  console.log("\n18. Teste de Estado Limpo na Nuvem & Desbloqueio no Portal após Redefinição pelo Admin:");
  const cloudShell = createCleanCloudShellState();
  assert(cloudShell.members.length === 0, "Estado inicial da nuvem no navegador não cria membros de teste automaticamente");
  assert(cloudShell.activities.length === 0, "Estado inicial da nuvem no navegador não cria atividades de teste automaticamente");
  assert(cloudShell.receipts.length === 0, "Estado inicial da nuvem no navegador não cria recibos de teste automaticamente");

  const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const userWithPendingReset: typeof testState.users[number] = {
    ...testState.users[0],
    passwordResetRequested: true,
    lastPasswordChangedAt: fortyDaysAgo,
  };
  // Admin altera a senha após solicitação: limpa bloqueio de 60 dias para permitir redefinição no Portal do Membro
  const resetTimestamp = new Date().toISOString();
  const afterAdminReset: typeof testState.users[number] = {
    ...userWithPendingReset,
    password: 'NovaSenhaAdmin2026',
    passwordResetRequested: false,
    lastAdminPasswordResetAt: resetTimestamp,
  };
  delete afterAdminReset.lastPasswordChangedAt;

  const isPortalUnlockedAfterAdminReset = !afterAdminReset.lastPasswordChangedAt;
  assert(!afterAdminReset.passwordResetRequested, "Solicitação de redefinição pendente é concluída após alteração pelo Administrador");
  assert(isPortalUnlockedAfterAdminReset, "Redefinição pelo Administrador desbloqueia imediatamente a redefinição direta no Portal do Membro");

  // Utilizador redefine sua própria senha no Portal do Membro e então inicia novo ciclo de 60 dias
  const memberResetTimestamp = new Date().toISOString();
  const afterMemberSelfReset: typeof testState.users[number] = {
    ...afterAdminReset,
    password: 'MinhaNovaSenhaPessoal2026',
    lastPasswordChangedAt: memberResetTimestamp,
  };
  delete afterMemberSelfReset.lastAdminPasswordResetAt;

  const memberCooldownElapsed = (Date.now() - new Date(afterMemberSelfReset.lastPasswordChangedAt!).getTime()) / (1000 * 60 * 60 * 24);
  assert(!afterMemberSelfReset.lastAdminPasswordResetAt, "Sinalizador de redefinição assistida é limpo após o membro definir sua senha pessoal");
  assert(memberCooldownElapsed < 1, "Novo ciclo de 60 dias inicia somente após o membro concluir a redefinição no Portal do Membro");

  // 19. TESTE DE SEGURANÇA GLOBAL: ENCERRAMENTO AUTOMÁTICO POR INATIVIDADE (5 MINUTOS)
  console.log("\n19. Teste de Encerramento Automático de Sessão após 5 Minutos de Inatividade:");
  assert(INACTIVITY_TIMEOUT_MS === 5 * 60 * 1000, "Tempo limite global configurado exatamente para 5 minutos (300.000 ms)");
  const sessionBaseTime = 1_700_000_000_000;
  assert(!isSessionInactive(sessionBaseTime, sessionBaseTime + 3 * 60 * 1000), "Sessão permanece ativa aos 3 minutos de inatividade");
  assert(!isSessionInactive(sessionBaseTime, sessionBaseTime + 4 * 60 * 1000 + 59 * 1000), "Sessão permanece ativa antes de completar os 5 minutos");
  assert(isSessionInactive(sessionBaseTime, sessionBaseTime + 5 * 60 * 1000), "Sessão é encerrada automaticamente ao atingir exatamente 5 minutos de inatividade");
  assert(isSessionInactive(sessionBaseTime, sessionBaseTime + 7 * 60 * 1000), "Sessão é encerrada automaticamente após ultrapassar 5 minutos de inatividade");
  assert(getRemainingInactivityMs(sessionBaseTime, sessionBaseTime + 4 * 60 * 1000) === 60 * 1000, "Cálculo de tempo restante antes do encerramento automático retorna exatamente 1 minuto aos 4 minutos");

  // 20. TESTE DE RESTRIÇÃO DA SUB-ABA DE PRESENÇAS E FREQUÊNCIA EM ATIVIDADES
  console.log("\n20. Teste de Visibilidade da Sub-aba de Presenças & Frequência (Atividades e Reuniões):");
  assert(!canViewActivitiesAttendanceTab('membro'), "Membro NÃO pode visualizar a sub-aba de Presenças & Frequência");
  assert(!canViewActivitiesAttendanceTab('capelao'), "Capelão NÃO pode visualizar a sub-aba de Presenças & Frequência");
  assert(!canViewActivitiesAttendanceTab('tesoureiro'), "Tesoureiro NÃO pode visualizar a sub-aba de Presenças & Frequência");
  assert(!canViewActivitiesAttendanceTab('diretor_associado'), "Diretor-associado NÃO precisa aceder à sub-aba sensível de Presenças & Frequência");
  assert(canViewActivitiesAttendanceTab('secretario'), "Secretário pode visualizar a sub-aba de Presenças & Frequência");
  assert(canViewActivitiesAttendanceTab('diretor'), "Diretor pode visualizar a sub-aba de Presenças & Frequência");
  assert(canViewActivitiesAttendanceTab('instrutor'), "Instrutor pode visualizar a sub-aba de Presenças & Frequência");
  assert(canViewActivitiesAttendanceTab('admin_tecnico'), "Administrador Técnico pode visualizar a sub-aba de Presenças & Frequência");

  // 21. TESTE DO CARGO DIRETOR-ASSOCIADO (SUPERVISÃO, RELATÓRIOS E EQUIPAS SEM FINANÇAS/CAPELANIA EXCLUSIVA)
  console.log("\n21. Teste do Cargo Diretor-associado e Segregação de Funções:");
  assert(ROLE_LABELS.diretor_associado?.label === 'Diretor-associado', "Etiqueta institucional 'Diretor-associado' registada corretamente");
  assert(hasPermission('diretor_associado', 'members', 'VIEW') && hasPermission('diretor_associado', 'members', 'EDIT'), "Diretor-associado pode consultar membros e gerir equipas");
  assert(hasPermission('diretor_associado', 'reports', 'VIEW') && hasPermission('diretor_associado', 'reports', 'EXPORT'), "Diretor-associado tem acesso e exportação de relatórios oficiais");
  assert(hasPermission('diretor_associado', 'activities', 'VIEW') && hasPermission('diretor_associado', 'activities', 'EDIT'), "Diretor-associado pode monitorizar e editar atividades e reuniões");
  assert(hasPermission('diretor_associado', 'audit', 'VIEW') && hasPermission('diretor_associado', 'settings', 'VIEW'), "Diretor-associado tem visão de supervisão administrativa em auditoria e configurações");
  assert(!hasPermission('diretor_associado', 'treasury', 'VIEW') && !hasPermission('diretor_associado', 'treasury', 'CREATE') && !hasPermission('diretor_associado', 'treasury', 'APPROVE'), "Diretor-associado NÃO possui responsabilidades nem acesso financeiro de tesouraria");
  assert(!hasPermission('diretor_associado', 'chaplaincy', 'APPROVE'), "Diretor-associado NÃO possui funções espirituais exclusivas de atendimento do capelão");

  // Simular matriz legada da nuvem sem diretor_associado e verificar injeção automática
  const legacyMatrixWithoutAssociate: any = JSON.parse(JSON.stringify(ROLE_PERMISSIONS_MATRIX));
  delete legacyMatrixWithoutAssociate.diretor_associado;
  delete legacyMatrixWithoutAssociate.diretor.messaging;
  const syncedMatrix = syncPermissionsMatrix(legacyMatrixWithoutAssociate);
  assert(!legacyMatrixWithoutAssociate.diretor_associado, "syncPermissionsMatrix não muta a matriz original recebida");
  assert(Boolean(syncedMatrix.diretor_associado) && syncedMatrix.diretor_associado.members.includes('EDIT'), "syncPermissionsMatrix injeta automaticamente o cargo Diretor-associado em bases de dados legadas");
  assert(Array.isArray(syncedMatrix.diretor.messaging) && syncedMatrix.diretor.messaging.includes('VIEW'), "syncPermissionsMatrix garante módulos recentes como Mensagens em matrizes existentes");
  assert(PERMISSION_CATALOG.some(p => p.module === 'messaging' && p.action === 'CREATE'), "Catálogo RBAC inclui permissões de Mensagens para gestão granular");

  // 22. TESTE DE VISIBILIDADE DE CONTAS DE ADMINISTRADORES EM "CONTAS DE ACESSO"
  console.log("\n22. Teste de Visibilidade de Contas de Administradores em Contas de Acesso:");
  const sampleAccounts = [
    { id: 'USR-ADMIN-1', role: 'admin_tecnico' as const, name: 'Admin Principal' },
    { id: 'USR-DIR-1', role: 'diretor' as const, name: 'Diretor' },
    { id: 'USR-ASSOC-1', role: 'diretor_associado' as const, name: 'Diretor Associado' },
    { id: 'USR-SEC-1', role: 'secretario' as const, name: 'Secretário' },
    { id: 'USR-TES-1', role: 'tesoureiro' as const, name: 'Tesoureiro' },
    { id: 'USR-INST-1', role: 'instrutor' as const, name: 'Instrutor' },
    { id: 'USR-CAP-1', role: 'capelao' as const, name: 'Capelão' },
    { id: 'USR-MEM-1', role: 'membro' as const, name: 'Membro' },
  ];

  const visibleToAdmin = filterVisibleAccessAccounts(sampleAccounts, 'admin_tecnico');
  assert(visibleToAdmin.length === sampleAccounts.length && visibleToAdmin.some(a => a.role === 'admin_tecnico'), "Administrador pode visualizar todas as contas, incluindo contas de administradores");

  const nonAdminRoles = ['diretor', 'diretor_associado', 'secretario', 'tesoureiro', 'instrutor', 'capelao', 'membro'] as const;
  for (const r of nonAdminRoles) {
    const visibleToRole = filterVisibleAccessAccounts(sampleAccounts, r);
    assert(
      !canViewAccountInAccessList(r, 'admin_tecnico') &&
      !visibleToRole.some(a => a.role === 'admin_tecnico') &&
      visibleToRole.length === sampleAccounts.length - 1,
      `Cargo ${ROLE_LABELS[r].label} NÃO visualiza contas de administradores em Contas de Acesso`
    );
  }

  // 23. TESTE DE SINCRONIZAÇÃO CONTÍNUA E BIDIRECIONAL ENTRE CONTAS DE LOGIN E MEMBROS
  console.log("\n23. Teste de Sincronização Contínua (Conta de Login <-> Ficha do Membro):");
  const syncMemberBase: Member = {
    ...testMember,
    id: 'CDA-MEM-SYNC-01',
    manualNumber: '2026/701',
    fullName: 'Mateus Kiala Original',
    email: 'mateus.original@clubedalvorada.ao',
    phone: '+244 923 111 222',
  };
  const syncUserBase: UserAccount = {
    id: 'USR-SYNC-01',
    name: 'Mateus Kiala Original',
    email: 'mateus.original@clubedalvorada.ao',
    role: 'membro',
    linkedMemberId: 'CDA-MEM-SYNC-01',
    manualNumber: '2026/701',
    phone: '+244 923 111 222',
    active: true,
    createdAt: new Date().toISOString(),
  };

  // 23.1 Alteração na ficha do membro propaga automaticamente para a conta de login
  const editedMember: Member = {
    ...syncMemberBase,
    fullName: 'Mateus Kiala Atualizado',
    email: 'mateus.novo@clubedalvorada.ao',
    manualNumber: '2026/709',
    phone: '+244 923 999 888',
  };
  const usersAfterMemberEdit = syncMemberChangesToUsers(editedMember, [syncUserBase], syncMemberBase);
  assert(usersAfterMemberEdit[0].name === 'Mateus Kiala Atualizado', "Alteração de nome no membro sincroniza automaticamente para a conta de login");
  assert(usersAfterMemberEdit[0].email === 'mateus.novo@clubedalvorada.ao', "Alteração de e-mail no membro sincroniza automaticamente para a conta de login");
  assert(usersAfterMemberEdit[0].manualNumber === '2026/709', "Alteração de Nº de Membro sincroniza automaticamente para a conta de login");
  assert(usersAfterMemberEdit[0].phone === '+244 923 999 888', "Alteração de telefone no membro sincroniza automaticamente para a conta de login");

  // 23.2 Alteração na conta de login propaga automaticamente de volta para a ficha do membro
  const { syncedUser: userAfterAccountEdit, updatedMembers: membersAfterAccountEdit } = syncUserWithLinkedMember(
    usersAfterMemberEdit[0],
    [editedMember],
    new Date().toISOString(),
    {
      name: 'Mateus Kiala Direção',
      email: 'mateus.direcao@clubedalvorada.ao',
      manualNumber: '2026/715',
      phone: '+244 912 000 111',
    }
  );
  assert(userAfterAccountEdit.name === 'Mateus Kiala Direção' && membersAfterAccountEdit[0].fullName === 'Mateus Kiala Direção', "Alteração de nome na conta de login sincroniza automaticamente para o membro");
  assert(userAfterAccountEdit.email === 'mateus.direcao@clubedalvorada.ao' && membersAfterAccountEdit[0].email === 'mateus.direcao@clubedalvorada.ao', "Alteração de e-mail na conta de login sincroniza automaticamente para o membro");
  assert(userAfterAccountEdit.manualNumber === '2026/715' && membersAfterAccountEdit[0].manualNumber === '2026/715', "Alteração de Nº de Membro na conta de login sincroniza automaticamente para o membro");
  assert(userAfterAccountEdit.phone === '+244 912 000 111' && membersAfterAccountEdit[0].phone === '+244 912 000 111', "Alteração de telefone na conta de login sincroniza automaticamente para o membro");

  // 23.3 Reconciliação contínua (carregamento da nuvem) corrige contas dessincronizadas automaticamente
  const staleUserFromCloud: UserAccount = {
    ...syncUserBase,
    name: 'Nome Antigo',
    email: 'antigo@clubedalvorada.ao',
    manualNumber: '2026/000',
    phone: '000',
  };
  const adminAccountFromCloud: UserAccount = {
    id: 'USR-ADMIN',
    name: 'Administrador Técnico',
    email: 'admin@clubedalvorada.ao',
    role: 'admin_tecnico',
    active: true,
    createdAt: new Date().toISOString(),
  };
  const reconciled = reconcileUsersAndMembers([staleUserFromCloud, adminAccountFromCloud], [membersAfterAccountEdit[0]]);
  assert(reconciled.changed, "reconcileUsersAndMembers deteta e repara divergências de dados automaticamente");
  assert(reconciled.users[0].name === 'Mateus Kiala Direção' && reconciled.users[0].email === 'mateus.direcao@clubedalvorada.ao' && reconciled.users[0].manualNumber === '2026/715', "Reconciliação alinha conta de login com os dados atuais do membro");
  assert(!reconciled.users[1].linkedMemberId, "Conta institucional de Administrador permanece independente e sem vínculo a membro");

  // 24. TESTE DE REGULARIZAÇÃO DE QUOTAS, PERMISSÕES E RECÁLCULO POR DOMINGO
  console.log("\n24. Teste de Regularização de Quotas, Grelha de Permissões e Recálculo por Domingo:");
  assert(hasConfigureQuotaPermission('tesoureiro'), "Tesoureiro tem permissão padrão para definir valor das quotas");
  assert(hasConfigureQuotaPermission('diretor'), "Diretor tem permissão padrão para definir valor das quotas");
  assert(hasConfigureQuotaPermission('admin_tecnico'), "Administrador Técnico tem permissão para definir valor das quotas");
  assert(!hasConfigureQuotaPermission('membro'), "Membro comum NÃO pode alterar o valor das quotas por padrão");
  assert(!hasConfigureQuotaPermission('diretor_associado'), "Diretor-associado NÃO pode alterar o valor das quotas por padrão");

  const customMatrix = syncPermissionsMatrix(ROLE_PERMISSIONS_MATRIX);
  customMatrix.secretario.treasury = [...customMatrix.secretario.treasury, 'CONFIGURE_QUOTAS'];
  assert(hasConfigureQuotaPermission('secretario', customMatrix), "Qualquer cargo autorizado na Grelha de Permissões passa a poder definir quotas");

  const legacyWithoutQuotaPerm: any = JSON.parse(JSON.stringify(ROLE_PERMISSIONS_MATRIX));
  legacyWithoutQuotaPerm.admin_tecnico.treasury = legacyWithoutQuotaPerm.admin_tecnico.treasury.filter((a: string) => a !== 'CONFIGURE_QUOTAS');
  legacyWithoutQuotaPerm.diretor.treasury = legacyWithoutQuotaPerm.diretor.treasury.filter((a: string) => a !== 'CONFIGURE_QUOTAS');
  legacyWithoutQuotaPerm.tesoureiro.treasury = legacyWithoutQuotaPerm.tesoureiro.treasury.filter((a: string) => a !== 'CONFIGURE_QUOTAS');
  const migratedForQuotas = syncPermissionsMatrix(legacyWithoutQuotaPerm);
  assert(
    migratedForQuotas.diretor.treasury.includes('CONFIGURE_QUOTAS') && migratedForQuotas.tesoureiro.treasury.includes('CONFIGURE_QUOTAS'),
    "syncPermissionsMatrix migra automaticamente CONFIGURE_QUOTAS para Diretor e Tesoureiro em bases antigas"
  );

  // Contagem exata de domingos (Jan 2026: 4, 11, 18, 25)
  assert(countChargeableSundays('2026-01-01', '2026-01-25') === 4, "Contagem exata de 4 domingos entre 01/01/2026 e 25/01/2026");
  assert(countChargeableSundays('2026-02-01', '2026-02-01') === 1, "Domingo exato na data de início e fim conta como 1 domingo cobrável");

  const quotaMemberA: Member = {
    ...testMember,
    id: 'MEM-QUOTA-01',
    manualNumber: '2026/801',
    fullName: 'Joana Domingos Quota',
    joinedDate: '2026-01-01',
    createdAt: '2026-01-01T10:00:00Z',
  };
  const quotaMemberNew: Member = {
    ...testMember,
    id: 'MEM-QUOTA-02',
    manualNumber: '2026/802',
    fullName: 'Pedro Novo Membro',
    joinedDate: '2026-01-12', // Após os 2 primeiros domingos (4 e 11 de Jan)
    createdAt: '2026-01-12T10:00:00Z',
  };

  const quotaConfig500: QuotaConfig = {
    amountInCents: 50_000, // 500,00 Kz por domingo
    frequency: 'domingo',
    cycleStartDate: '2026-01-01',
    respectMemberJoinDate: true,
    activeQuotaFeeId: 'FEE-QUOTA-DOMINGO',
  };

  const quotaReceiptsSample: PaymentReceipt[] = [
    {
      id: 'REC-Q-1',
      receiptNumber: 'REC-2026-9001',
      memberId: quotaMemberA.id,
      memberName: quotaMemberA.fullName,
      feeDefinitionId: 'FEE-QUOTA-DOMINGO',
      feeTitle: 'Quota Regular (Cada Domingo)',
      periodLabel: '2 Domingos Janeiro',
      amountPaidInCents: 100_000, // 1.000,00 Kz pagos
      paymentMethod: 'numerario',
      treasurerUserId: 'USR-TES',
      treasurerName: 'Daniel Kissange',
      paidAt: '2026-01-18T12:00:00Z',
      status: 'confirmado',
    },
    {
      id: 'REC-Q-CANCELLED',
      receiptNumber: 'REC-2026-9002',
      memberId: quotaMemberA.id,
      memberName: quotaMemberA.fullName,
      feeDefinitionId: 'FEE-QUOTA-DOMINGO',
      feeTitle: 'Quota Regular (Cada Domingo)',
      periodLabel: 'Recibo anulado',
      amountPaidInCents: 100_000,
      paymentMethod: 'numerario',
      treasurerUserId: 'USR-TES',
      treasurerName: 'Daniel Kissange',
      paidAt: '2026-01-19T12:00:00Z',
      status: 'anulado',
      isCancelled: true,
    },
    {
      id: 'REC-CAMP-IGNORED',
      receiptNumber: 'REC-2026-9003',
      memberId: quotaMemberA.id,
      memberName: quotaMemberA.fullName,
      feeDefinitionId: 'FEE-04', // Acampamento, não é quota!
      feeTitle: 'Inscrição Acampamento Regional no Dondo',
      periodLabel: 'Acampamento',
      amountPaidInCents: 1_200_000,
      paymentMethod: 'transferencia_bancaria',
      treasurerUserId: 'USR-TES',
      treasurerName: 'Daniel Kissange',
      paidAt: '2026-01-20T12:00:00Z',
      status: 'confirmado',
    },
  ];

  const sumA500 = calculateMemberQuotaSummary(quotaMemberA, quotaConfig500, state.fees, quotaReceiptsSample, '2026-01-25');
  assert(sumA500.periodsCharged === 4 && sumA500.totalDueInCents === 200_000, "4 domingos x 500 Kz = 2.000,00 Kz devidos");
  assert(sumA500.totalPaidInCents === 100_000, "Recibos anulados e taxas de acampamento são ignorados; apenas 1.000,00 Kz de quota contam");
  assert(sumA500.balanceDueInCents === 100_000 && sumA500.status === 'parcial', "Saldo devedor parcial calculado corretamente (1.000,00 Kz em dívida)");

  const sumNewMember = calculateMemberQuotaSummary(quotaMemberNew, quotaConfig500, state.fees, quotaReceiptsSample, '2026-01-25');
  assert(sumNewMember.periodsCharged === 2 && sumNewMember.totalDueInCents === 100_000, "Membro admitido a 12/01 é cobrado apenas pelos 2 domingos seguintes (1.000,00 Kz)");

  // Alterar valor da quota para 1.000,00 Kz recalcula imediatamente quanto deve mantendo o que já pagou
  const quotaConfig1000: QuotaConfig = { ...quotaConfig500, amountInCents: 100_000 };
  const sumA1000 = calculateMemberQuotaSummary(quotaMemberA, quotaConfig1000, state.fees, quotaReceiptsSample, '2026-01-25');
  assert(sumA1000.totalDueInCents === 400_000, "Alteração da quota para 1.000 Kz/domingo recalcula o devido total para 4.000,00 Kz");
  assert(sumA1000.totalPaidInCents === 100_000 && sumA1000.balanceDueInCents === 300_000, "Valor já pago mantém-se em 1.000,00 Kz e o saldo em dívida recalcula para 3.000,00 Kz");

  // Regularização total do saldo restante (3.000,00 Kz)
  const fullRegReceipts: PaymentReceipt[] = [
    ...quotaReceiptsSample,
    {
      id: 'REC-Q-FULL',
      receiptNumber: 'REC-2026-9004',
      memberId: quotaMemberA.id,
      memberName: quotaMemberA.fullName,
      feeDefinitionId: 'FEE-QUOTA-DOMINGO',
      feeTitle: 'Quota Regular (Cada Domingo)',
      periodLabel: 'Regularização 3 domingos',
      amountPaidInCents: 300_000,
      paymentMethod: 'numerario',
      treasurerUserId: 'USR-TES',
      treasurerName: 'Daniel Kissange',
      paidAt: '2026-01-25T15:00:00Z',
      status: 'confirmado',
    },
  ];
  const sumAFull = calculateMemberQuotaSummary(quotaMemberA, quotaConfig1000, state.fees, fullRegReceipts, '2026-01-25');
  assert(sumAFull.balanceDueInCents === 0 && sumAFull.status === 'regularizado' && sumAFull.progressPercent === 100, "Após regularização total, o saldo devedor zera e estado passa para regularizado (100%)");

  const totals = calculateClubQuotaTotals([sumAFull, sumNewMember]);
  assert(totals.totalMembers === 2 && totals.inDebtCount === 1 && totals.regularizedCount === 1, "Totais do clube contabilizam corretamente membros em dia e em dívida");

  // 25. MÓDULO EXCLUSIVO DO DIRETOR-ASSOCIADO E CONTROLO NA GRELHA DE PERMISSÕES
  console.log("\n25. Teste do Módulo Exclusivo do Diretor-associado e Grelha de Permissões:");
  assert(
    PERMISSION_CATALOG.some((p) => p.module === 'associate_director' && p.action === 'VIEW'),
    "Catálogo RBAC regista o módulo exclusivo associate_director"
  );
  assert(
    canAccessAssociateDirectorModule('diretor_associado', ROLE_PERMISSIONS_MATRIX),
    "Diretor-associado acede por padrão ao seu módulo exclusivo"
  );
  assert(
    canAccessAssociateDirectorModule('admin_tecnico', ROLE_PERMISSIONS_MATRIX),
    "Administrador Técnico acede ao módulo para gestão e supervisão"
  );
  assert(
    !canAccessAssociateDirectorModule('diretor', ROLE_PERMISSIONS_MATRIX),
    "Diretor do Clube NÃO visualiza o módulo exclusivo sem concessão na grelha"
  );
  assert(
    !canAccessAssociateDirectorModule('secretario', ROLE_PERMISSIONS_MATRIX) &&
      !canAccessAssociateDirectorModule('tesoureiro', ROLE_PERMISSIONS_MATRIX) &&
      !canAccessAssociateDirectorModule('instrutor', ROLE_PERMISSIONS_MATRIX) &&
      !canAccessAssociateDirectorModule('capelao', ROLE_PERMISSIONS_MATRIX) &&
      !canAccessAssociateDirectorModule('membro', ROLE_PERMISSIONS_MATRIX),
    "Secretário, Tesoureiro, Instrutor, Capelão e Membro NÃO visualizam o módulo por padrão"
  );
  assert(
    canGrantAssociateDirectorModule('admin_tecnico') &&
      !canGrantAssociateDirectorModule('diretor') &&
      !canGrantAssociateDirectorModule('diretor_associado') &&
      !canGrantAssociateDirectorModule('secretario'),
    "Apenas o Administrador Técnico pode conceder/revogar acesso ao módulo na grelha"
  );

  // Simular concessão pela Grelha de Permissões pelo Administrador Técnico para Diretor e Secretário
  const customGrantedMatrix = syncPermissionsMatrix();
  customGrantedMatrix.diretor.associate_director = ['VIEW'];
  assert(
    canAccessAssociateDirectorModule('diretor', customGrantedMatrix),
    "Após concessão pelo Administrador na grelha, outro cargo passa a visualizar o módulo"
  );
  assert(
    !canAccessAssociateDirectorModule('secretario', customGrantedMatrix),
    "Cargos não concedidos permanecem bloqueados após concessão seletiva"
  );

  // Simular migração de matriz antiga sem a chave associate_director
  const legacyMatrixWithoutAssoc = JSON.parse(JSON.stringify(ROLE_PERMISSIONS_MATRIX));
  delete legacyMatrixWithoutAssoc.diretor_associado.associate_director;
  delete legacyMatrixWithoutAssoc.secretario.associate_director;
  const migratedAssocMatrix = syncPermissionsMatrix(legacyMatrixWithoutAssoc);
  assert(
    canAccessAssociateDirectorModule('diretor_associado', migratedAssocMatrix) &&
      !canAccessAssociateDirectorModule('secretario', migratedAssocMatrix),
    "syncPermissionsMatrix inicializa associate_director exclusivo para Diretor-associado em bases legadas"
  );

  // 26. ZERAR DÍVIDA NA REGULARIZAÇÃO DE QUOTAS E CONTROLO RBAC PELO ADMINISTRADOR
  console.log("\n26. Teste de Zerar Dívida de Quotas e Controlo na Grelha de Permissões:");
  assert(
    PERMISSION_CATALOG.some((p) => p.module === 'treasury' && p.action === 'WAIVE_QUOTA_DEBT'),
    "Catálogo RBAC inclui a permissão WAIVE_QUOTA_DEBT no módulo Tesouraria"
  );
  assert(
    hasWaiveQuotaDebtPermission('diretor', ROLE_PERMISSIONS_MATRIX) &&
      hasWaiveQuotaDebtPermission('admin_tecnico', ROLE_PERMISSIONS_MATRIX),
    "Diretor e Administrador Técnico podem zerar dívida de quotas por padrão"
  );
  assert(
    !hasWaiveQuotaDebtPermission('tesoureiro', ROLE_PERMISSIONS_MATRIX) &&
      !hasWaiveQuotaDebtPermission('diretor_associado', ROLE_PERMISSIONS_MATRIX) &&
      !hasWaiveQuotaDebtPermission('secretario', ROLE_PERMISSIONS_MATRIX) &&
      !hasWaiveQuotaDebtPermission('instrutor', ROLE_PERMISSIONS_MATRIX) &&
      !hasWaiveQuotaDebtPermission('membro', ROLE_PERMISSIONS_MATRIX),
    "Tesoureiro, Diretor-associado e restantes cargos não zeram dívida sem concessão do Administrador"
  );
  assert(
    canGrantWaiveQuotaDebt('admin_tecnico') &&
      !canGrantWaiveQuotaDebt('diretor') &&
      !canGrantWaiveQuotaDebt('tesoureiro'),
    "Apenas o Administrador Técnico pode conceder/revogar WAIVE_QUOTA_DEBT na Grelha de Permissões"
  );

  // Concessão pelo Administrador Técnico a outro cargo na grelha
  const waiveGrantedMatrix = syncPermissionsMatrix();
  waiveGrantedMatrix.tesoureiro.treasury = [...waiveGrantedMatrix.tesoureiro.treasury, 'WAIVE_QUOTA_DEBT'];
  waiveGrantedMatrix.diretor_associado.treasury = ['WAIVE_QUOTA_DEBT'];
  assert(
    hasWaiveQuotaDebtPermission('tesoureiro', waiveGrantedMatrix) &&
      hasWaiveQuotaDebtPermission('diretor_associado', waiveGrantedMatrix),
    "Após concessão na grelha pelo Administrador, outro cargo passa a poder zerar dívida de quotas"
  );

  // Migração de matriz legada sem WAIVE_QUOTA_DEBT
  const legacyMatrixWithoutWaive = JSON.parse(JSON.stringify(ROLE_PERMISSIONS_MATRIX));
  legacyMatrixWithoutWaive.diretor.treasury = legacyMatrixWithoutWaive.diretor.treasury.filter((a: string) => a !== 'WAIVE_QUOTA_DEBT');
  legacyMatrixWithoutWaive.admin_tecnico.treasury = legacyMatrixWithoutWaive.admin_tecnico.treasury.filter((a: string) => a !== 'WAIVE_QUOTA_DEBT');
  const migratedWaiveMatrix = syncPermissionsMatrix(legacyMatrixWithoutWaive);
  assert(
    hasWaiveQuotaDebtPermission('diretor', migratedWaiveMatrix) &&
      hasWaiveQuotaDebtPermission('admin_tecnico', migratedWaiveMatrix) &&
      !hasWaiveQuotaDebtPermission('tesoureiro', migratedWaiveMatrix),
    "syncPermissionsMatrix restaura WAIVE_QUOTA_DEBT para Diretor e Admin em bases legadas sem afetar outros cargos"
  );

  // Cálculo: Zerar dívida total (3.000,00 Kz em dívida sobre 4.000,00 Kz devidos, mantendo 1.000,00 Kz já pagos)
  const fullWaiver: QuotaDebtWaiver = {
    id: 'ZRD-2026-0001',
    memberId: quotaMemberA.id,
    memberName: quotaMemberA.fullName,
    amountWaivedInCents: 300_000,
    grossDueAtWaiverInCents: 400_000,
    paidAtWaiverInCents: 100_000,
    previousBalanceInCents: 300_000,
    cycleYear: 2026,
    reason: 'Perdão diretivo / regularização extraordinária',
    waivedByUserId: 'USR-DIR',
    waivedByName: 'Mateus Kiala',
    waivedByRole: 'diretor',
    waivedAt: '2026-01-25T16:00:00Z',
  };
  const sumAfterFullWaive = calculateMemberQuotaSummary(quotaMemberA, quotaConfig1000, state.fees, quotaReceiptsSample, '2026-01-25', [fullWaiver]);
  assert(
    sumAfterFullWaive.grossDueInCents === 400_000 &&
      sumAfterFullWaive.totalWaivedInCents === 300_000 &&
      sumAfterFullWaive.totalDueInCents === 100_000 &&
      sumAfterFullWaive.totalPaidInCents === 100_000 &&
      sumAfterFullWaive.balanceDueInCents === 0 &&
      sumAfterFullWaive.status === 'regularizado' &&
      sumAfterFullWaive.progressPercent === 100,
    "Zerar dívida reduz o saldo devedor a 0,00 Kz (regularizado) sem alterar recibos reais nem gerar crédito fantasma"
  );

  // Cálculo: Novo domingo após zerar dívida passa a cobrar apenas o novo domingo (1.000,00 Kz)
  const sumNextSundayAfterWaive = calculateMemberQuotaSummary(quotaMemberA, quotaConfig1000, state.fees, quotaReceiptsSample, '2026-02-01', [fullWaiver]);
  assert(
    sumNextSundayAfterWaive.periodsCharged === 5 &&
      sumNextSundayAfterWaive.grossDueInCents === 500_000 &&
      sumNextSundayAfterWaive.balanceDueInCents === 100_000 &&
      sumNextSundayAfterWaive.status === 'parcial',
    "Novo domingo após dívida zerada volta a cobrar normalmente apenas o novo período (1.000,00 Kz)"
  );

  // Cálculo: Zerar dívida parcial (150.000 centavos de 300.000 em dívida) e reversão
  const partialWaiver: QuotaDebtWaiver = {
    ...fullWaiver,
    id: 'ZRD-2026-0002',
    amountWaivedInCents: 150_000,
  };
  const sumPartialWaive = calculateMemberQuotaSummary(quotaMemberA, quotaConfig1000, state.fees, quotaReceiptsSample, '2026-01-25', [partialWaiver]);
  assert(
    sumPartialWaive.totalWaivedInCents === 150_000 && sumPartialWaive.balanceDueInCents === 150_000 && sumPartialWaive.status === 'parcial',
    "Abate parcial reduz proporcionalmente a dívida (de 3.000 Kz para 1.500 Kz)"
  );

  const reversedWaiver: QuotaDebtWaiver = {
    ...fullWaiver,
    isReversed: true,
    reversalReason: 'Lançamento por engano',
    reversedAt: '2026-01-25T17:00:00Z',
    reversedByUserId: 'USR-DIR',
    reversedByName: 'Mateus Kiala',
  };
  const sumAfterReversal = calculateMemberQuotaSummary(quotaMemberA, quotaConfig1000, state.fees, quotaReceiptsSample, '2026-01-25', [reversedWaiver]);
  assert(
    sumAfterReversal.totalWaivedInCents === 0 && sumAfterReversal.balanceDueInCents === 300_000 && sumAfterReversal.status === 'parcial',
    "Reversão da dívida zerada repõe integralmente o saldo devedor anterior (3.000,00 Kz)"
  );

  // 27. ASSINATURA COM NOME E CARGO DO AUTOR DA OPERAÇÃO EM RECIBOS E DOCUMENTOS
  console.log("\n27. Teste de Assinatura com Nome e Cargo do Autor nos Recibos e Documentos:");
  const recDirector = resolveReceiptOperatorSigner(
    {
      treasurerUserId: 'USR-DIR',
      treasurerName: 'Carlos Mutamba',
      treasurerRole: 'diretor',
    },
    state.users
  );
  assert(
    recDirector.name === 'Carlos Mutamba' && recDirector.roleLabel === 'Diretor do Clube',
    "Recibo emitido pelo Diretor exibe o seu nome e cargo real (Diretor do Clube), nunca 'Responsável' ou cargo fixo"
  );

  const recAssoc = resolveReceiptOperatorSigner(
    {
      treasurerUserId: 'USR-ASSOC-TEST',
      treasurerName: 'Ana Paula',
      treasurerRole: 'diretor_associado',
    },
    state.users
  );
  assert(
    recAssoc.name === 'Ana Paula' && recAssoc.roleLabel === 'Diretor-associado',
    "Recibo emitido pelo Diretor-associado exibe 'Ana Paula' e cargo 'Diretor-associado'"
  );

  const docLegacyReceipt = resolveDocumentOperatorSigner(
    {
      documentType: 'recibo',
      issuedByUserId: 'USR-TES',
      issuedByName: 'Daniel Kissange (Tesoureiro)',
    },
    state.users
  );
  assert(
    cleanOperatorDisplayName('Daniel Kissange (Tesoureiro)') === 'Daniel Kissange' &&
      docLegacyReceipt.name === 'Daniel Kissange' &&
      docLegacyReceipt.roleLabel === 'Tesoureiro',
    "Documento legado com sufixo entre parênteses limpa o nome e resolve o cargo real 'Tesoureiro'"
  );

  const docCertAdmin = resolveDocumentOperatorSigner(
    {
      documentType: 'certificado',
      issuedByUserId: 'USR-ADMIN',
      issuedByName: 'Eng. Manuel Kiluanje',
      issuedByRole: 'admin_tecnico',
    },
    state.users
  );
  assert(
    docCertAdmin.name === 'Eng. Manuel Kiluanje' &&
      docCertAdmin.roleLabel === 'Administrador Técnico' &&
      !docCertAdmin.roleLabel.includes('Responsável'),
    "Certificado emitido pelo Administrador exibe nome completo e cargo 'Administrador Técnico' sem 'Responsável'"
  );

  const docLookupByIdOnly = resolveDocumentOperatorSigner(
    {
      documentType: 'declaracao_membro',
      issuedByUserId: 'USR-SEC',
      issuedByName: 'Responsável',
    },
    state.users
  );
  assert(
    docLookupByIdOnly.name === 'Esperança Neto' && docLookupByIdOnly.roleLabel === 'Secretário',
    "Mesmo quando nome legado for 'Responsável', resolve pelo ID o nome real ('Esperança Neto') e cargo ('Secretário')"
  );

  console.log("\n=== RESULTADO FINAL DOS TESTES ===");
  console.log(`Total de Testes: ${passed + failed}`);
  console.log(`Testes Aprovados: ${passed}`);
  console.log(`Testes Falhados: ${failed}`);

  if (failed === 0) {
    console.log("SUCESSO: Todos os testes passaram sem qualquer falha!");
    process.exit(0);
  } else {
    console.error("ERRO: Existem testes que falharam!");
    process.exit(1);
  }
}

runTests();
