# Plano de Migração Completa para Banco de Dados Real

Esta é uma reformulação grande do sistema. Vou executar em fases para garantir que tudo funcione. Antes de começar, preciso confirmar alguns pontos importantes.

## O que será feito

### 1. Banco de Dados (Supabase)
Expandir o schema atual para suportar todas as funcionalidades:

- **profiles** (ligada a `auth.users`): name, email, avatar_url, phone, bio, position (cargo), birth_date, skills[], hourly_rate, contract_start, contract_end, status
- **user_roles** (já existe): manter padrão `app_role` enum = `leader | manager | collaborator`
- **teams**: id, name, description, leader_id, color, created_at
- **team_members** (N:N): team_id, user_id, role_in_team (`manager | member`) — permite múltiplos times por colaborador
- **clients**: ampliar com phone, contract_start, contract_end, satisfaction, notes
- **client_team** (N:N): client_id, team_id
- **tasks**: ampliar com created_by, recurrence (jsonb), parent_task_id, template_id
- **task_assignees** (N:N): task_id, user_id (caso queira múltiplos)
- **task_templates**: para recorrência
- **expenses**: id, category, amount, date, description, created_by, client_id
- **finance_settings**: chave/valor (jsonb) com cash adjustments, custom categories
- **client_satisfaction_history**: client_id, rating, recorded_at
- Trigger `handle_new_user` para criar profile automaticamente no signup
- RLS em todas as tabelas usando função `has_role()`

### 2. Autenticação
- Login real via `supabase.auth.signInWithPassword` (email + senha)
- Remover lista de contas demo da tela de login
- Tela de cadastro de funcionário (Líder/Gerente cria): chama edge function `create-user` que usa `supabase.auth.admin.createUser` → cria profile + atribui role + adiciona aos times selecionados
- Edge function necessária pois `auth.admin` requer service_role key

### 3. Frontend — remover 100% dos mocks
- Substituir `AppStore` (Context com mock) por hooks que consomem Supabase via TanStack Query
- Real-time subscriptions onde fizer sentido (tasks, comments, notifications)
- Todas as páginas (Kanban, Clientes, Times, Equipe, Relatórios, Finanças, Perfil) buscando do banco
- Loading states e error states em todas as telas

### 4. Times — múltipla participação
- Tela de Times usa `team_members` (N:N), colaborador pode pertencer a vários
- Ao criar/editar time, multi-select de membros e gerentes

### 5. Funcionários (renomeado "Colaboradores")
- Página `/team` vira CRUD completo: criar com email+senha+cargo+role+times+contrato
- Edição de cargo, desativação, reset de senha

### 6. Responsividade Mobile
- Sidebar vira drawer no mobile (já existe `Sheet` no shadcn)
- Kanban: scroll horizontal de colunas com snap
- Tabelas viram cards no mobile (Clientes, Equipe, Finanças)
- Diálogos full-screen no mobile
- Touch targets ≥44px, tipografia escalada
- Bottom nav opcional para ações principais

### 7. SQL Final
Entregarei um script único `migration.sql` com:
- CREATE TABLE / ALTER TABLE para tudo que falta
- Enums (`app_role`, `team_role`, `task_status`, etc.)
- Função `has_role` + trigger `handle_new_user`
- Políticas RLS completas
- Comando separado para promover seu usuário a Líder após primeiro signup:
  ```sql
  -- Após criar sua conta pela tela de signup (ou via Auth dashboard):
  INSERT INTO user_roles (user_id, role)
  SELECT id, 'leader' FROM auth.users WHERE email = 'SEU_EMAIL_AQUI';
  ```

## Detalhes técnicos
- Edge function `create-user` em `supabase/functions/create-user/index.ts` usa SERVICE_ROLE_KEY (já disponível no Cloud) — verifica caller é leader/manager via JWT
- Storage bucket `avatars` para fotos de perfil
- TanStack Query já instalado; usar `useQuery`/`useMutation` por entidade
- Tipos TypeScript gerados a partir do schema em `src/integrations/supabase/types.ts` (auto-gerado)

## Perguntas antes de começar

**Esta migração é grande (~2-4h de execução, vários arquivos).** Preciso confirmar:

1. **Posso apagar o `AppStore` atual e os dados mock** (`src/data/mock.ts`)? Tudo passa a vir do banco e o banco começa vazio (exceto o Líder que você criar).

2. **Login**: prefere que eu **mantenha uma tela de signup pública** (qualquer um cria conta, mas sem role até líder aprovar) ou **apenas líder/gerente cria** funcionários (signup público desabilitado)?

3. **Posso seguir e quebrar em commits parciais** (fase 1: schema + auth, fase 2: páginas, fase 3: mobile)? Isso evita uma resposta gigante quebrar tudo de uma vez.

4. **Sobre o "Líder inicial"**: você quer **criar a conta pela própria tela de signup** e depois rodar o SQL para virar líder, ou prefere que eu te entregue um SQL que **cria o usuário direto no `auth.users`** (mais complexo, requer função `crypt`)?

Responda essas 4 perguntas e eu sigo direto na implementação.