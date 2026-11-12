# Sistema de Gestão do Clube D'Alvorada (Angola)

Aplicação institucional integrada e progressiva (PWA) desenvolvida para a gestão exclusiva do **Clube D'Alvorada** (Luanda, Angola), com suporte integral à moeda nacional **Kwanza (Kz)**, formatação de datas **DD/MM/AAAA** e controlo de acessos baseado em papéis institucionais (RBAC).

---

## 1. Visão Geral da Arquitetura

- **Frontend:** React 19 + TypeScript + Tailwind CSS v4.
- **Identidade Visual:** Azul-escuro (`#0f172a`, `#1e3a8a`), branco e cinzento neutro; tipografia limpa, acessível em computador, tablet e telemóvel.
- **Autenticação e Dados:** Estrutura preparada para Firebase Authentication (e-mail e palavra-passe) e Cloud Firestore. Modo de demonstração local ativo para validação sem custos ou credenciais de produção.
- **Integridade Financeira:** Todos os cálculos em Kwanza (Kz) operam exclusivamente com números inteiros de cêntimos (`1 Kz = 100 cêntimos`) para eliminar imprecisões binárias de ponto flutuante.
- **Política de Acesso Não-Público:** O registo público de contas é expressamente proibido. O Secretário regista o membro institucional e o Administrador Técnico cria a conta de acesso vinculada.

---

## 2. Matriz de Módulos e Estado de Implementação

| Módulo | Estado | Descrição e Validação |
|---|---|---|
| **Fundação & PWA** | Concluído | Layout responsivo, navegação lateral recolhível, navegação móvel inferior, manifesto PWA e Service Worker (`/public/sw.js`). |
| **Utilizadores & RBAC** | Concluído | Catálogo de permissões central (`permissionService.ts`), simulador de troca rápida de papel no topo e gestão de contas. |
| **Gestão de Membros** | Concluído | Formulário por secções, identificador auto (`PioApp-MEM-xxx`), unicidade do número manual, filtro por B.I. e renovação em lote. |
| **Tesouraria (Kz)** | Concluído | Contas (Caixa e Bancos), emissão de recibos (`REC-2026-xxxx`), despesas com regra de 2º aprovador em despesa própria e fecho fiscal. |
| **Atividades & Reuniões** | Concluído | Fases da atividade, chamada de presenças anti-duplicação, tarefas com prazos e atas estruturadas com numeração oficial (`ATA-2026-xxxx`). |
| **Formação & Classes** | Concluído | Classes regulares (Amigo a Guia) e especialidades, lista de requisitos, progresso em % e validação final pelo Diretor. |
| **Documentos Oficiais** | Concluído | Emissão e arquivo de recibos, atas e declarações; modal de impressão oficial com assinaturas manuais e proibição de reutilizar códigos cancelados. |
| **Portal do Membro** | Concluído | Área pessoal do membro, histórico de quotas, envio de comprovativo com aviso de pendência e solicitações institucionais. |
| **Pedidos e Avisos** | Concluído | Publicação de editais com níveis de urgência e fluxo de aprovação de pedidos dos membros. |
| **Relatórios Oficiais** | Concluído | Mapas de membros, financeiro, atividades e formação; exportação real em CSV e pré-visualização de impressão. |
| **Configurações** | Concluído | Gestão de dados institucionais, departamentos, quotas e unidades do clube com preservação de registos históricos. |
| **Auditoria e Segurança** | Concluído | Registo de auditoria inalterável (append-only), exportação/importação de cópias de segurança JSON e suíte de 10 testes de segurança. |

---

## 3. Segurança em Múltiplas Camadas

### A. Camada de Interface (Client-side)
A interface não se limita a esconder botões: qualquer mutação invocada passa pelo verificador `can(module, action)` do `ClubContext`.

### B. Regras de Segurança do Cloud Firestore (`firestore.rules`)
O ficheiro `firestore.rules` foi estruturado com política de bloqueio por padrão (`match /{document=**} { allow read, write: if false; }`):
- Membros só podem consultar os seus próprios dados autorizados (`isOwner(memberId)`).
- Apenas a Secretaria pode criar novos registos de membros.
- Recibos são imutáveis; apenas o Tesoureiro pode emitir ou cancelar com motivo gravado.
- Registos de auditoria são inalteráveis e apenas podem ser anexados (`allow create: if isAuthenticated(); allow update, delete: if false;`).

---

## 4. Procedimentos Institucionais (Continuidade e Segurança)

### A. Cópias de Segurança e Restauração
O sistema implementa uma estratégia de três níveis:

1.  **Dados do Sistema:** Disponível via Módulo de Auditoria e Administração (Exportar Backup JSON). Este ficheiro contém o estado integral da base de dados e configurações.
2.  **Código-Fonte:** Sincronização obrigatória com repositório Git institucional para controlo de versão.
3.  **Ficheiros:** Armazenados no Firebase Storage. Requer backup manual periódico do *bucket* do Storage.

**Procedimento de Teste de Restauração:**
1. Criar um ambiente de teste isolado (projeto Firebase separado).
2. Importar o ficheiro JSON de backup através da interface de administração.
3. Verificar a integridade dos saldos financeiros e relações entre membros e pagamentos.
4. Validar o acesso RBAC no ambiente de teste.

### B. Continuidade Institucional
1. **Palavras-passe:** Nunca guarde nem partilhe palavras-passe. A recuperação de acesso é gerida pelo administrador através de envio de link de *reset* pelo Firebase.
2. **Transferência de Papéis:** A mudança de responsáveis deve ser feita atualizando a conta de utilizador no módulo de Auditoria, respeitando a auditoria de alterações.
3. **Abertura de Novo Ano:** A função de "Abertura de Novo Ano" (Configurações) deve ser utilizada pelo Administrador Técnico e confirmada pelo Diretor, garantindo que o histórico do ano anterior não seja sobrescrito.

### C. Firebase e Custos
- A aplicação utiliza o *Firebase Spark Plan* (limites gratuitos). A ativação de serviços pagos ou escalabilidade em produção requer autorização da Direção.
- **Custos:** Monitorizar limites de leitura/escrita no Firestore e armazenamento no Storage no console do Firebase.

---

## 5. Bateria de Testes de Segurança (10 Cenários)

O módulo **Auditoria e Acessos** inclui uma suíte executável com os seguintes 10 testes validados:
1. **Acesso Não Autenticado:** Bloqueio de utilizadores sem sessão ativa.
2. **Isolamento de Membros:** Proibição de acesso cruzado a dados privados.
3. **Tentativa de Elevação:** Proibição de atribuição arbitrária de privilégios.
4. **Mutação de Permissões:** Garantia de que a matriz central de permissões é inalterável.
5. **Histórico de Auditoria:** Bloqueio de edição e eliminação de eventos passados.
6. **Prevenção de Duplicados:** Validação rigorosa de número de membro e B.I.
7. **Aritmética Monetária (Kz):** Garantia de cálculos em cêntimos inteiros.
8. **Independência de Despesa:** Exigência de 2º aprovador caso a despesa seja do próprio solicitante.
9. **Reabertura Fiscal Restrita:** Apenas o Diretor tem autorização para reabrir meses encerrados.
10. **Deteção de Ambiente:** Transparência sobre o modo de execução (Demonstração vs Produção).

---

## 6. Como Ligar o Firebase de Produção

1. No Console do Firebase, crie o projeto institucional do Clube D'Alvorada.
2. Ative **Authentication** com o fornecedor **E-mail/Password** (desative o registo público nas definições do Firebase).
3. Ative o **Cloud Firestore** no modo de produção e aplique o ficheiro `firestore.rules`.
4. Defina as seguintes variáveis no ficheiro `.env` ou no painel de segredos do servidor:
   ```env
   VITE_FIREBASE_API_KEY="sua-api-key"
   VITE_FIREBASE_AUTH_DOMAIN="seu-projeto.firebaseapp.com"
   VITE_FIREBASE_PROJECT_ID="seu-projeto-id"
   VITE_FIREBASE_STORAGE_BUCKET="seu-projeto.appspot.com"
   VITE_FIREBASE_MESSAGING_SENDER_ID="seu-sender-id"
   VITE_FIREBASE_APP_ID="seu-app-id"
   ```
5. A aplicação detectará automaticamente as variáveis preenchidas através de `src/services/firebaseConfig.ts` e comutará do modo de demonstração para o modo de produção em tempo real.
