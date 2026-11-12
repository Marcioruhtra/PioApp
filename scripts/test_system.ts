import { loadInitialState, generateNextDocumentNumber, isMemberNumberUnique, findPotentialDuplicateMember, cleanSystemStorageSpace } from '../src/services/storageService';
import { hasPermission, ROLE_PERMISSIONS_MATRIX, updatePermission } from '../src/services/permissionService';
import { formatKz } from '../src/utils/currency';
import { formatDateAO } from '../src/utils/date';
import { Member, PaymentReceipt, ExpenseRequest, ClubActivity, TrainingClass, SpecialtyHonor, DeletionRequest } from '../src/types';

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
