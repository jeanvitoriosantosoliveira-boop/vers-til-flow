## Objetivo
Aplicar uma rodada grande de melhorias: corrigir bug de role, esconder dados financeiros de gerente/colaborador, paginação em relatórios, notificações individuais, gestão completa de colaboradores/clientes/times, cadastro de serviços, upload de avatar e troca de senha.

---

## 1. Banco de dados (migration)

**Novas tabelas / colunas**
- `services` — catálogo de serviços da agência (`name`, `description`, `default_price`, `is_active`).
- `client_services` — N:N entre `clients` e `services` (com `monthly_price` opcional, `started_at`).
- `client_status` enum: garantir valores PT-BR + `paused` (`active`, `paused`, `inactive`, `prospect`).
- `client_collaborators` — N:N direto cliente↔colaborador (gerada via time, mas também manual).

**Funções / triggers**
- `sync_client_collaborators_from_team()` — quando `client_teams` muda, recalcula `client_collaborators` para membros `manager`/`leader` daquele time.
- Trigger em `clients` que, se `status` virar `paused`/`inactive`, remove vínculos em `client_collaborators`.
- Trigger em `tasks` (`assignee_id`) → cria `notifications` para o responsável (criada/atualizada/concluída).
- RLS de `notifications`: apenas o dono lê (já está); garantir inserts via trigger SECURITY DEFINER.

**RLS**
- `services`: SELECT autenticado; INSERT/UPDATE/DELETE só `leader`.
- `client_services`: SELECT autenticado; INSERT/UPDATE/DELETE só `leader`.
- `client_collaborators`: SELECT autenticado; modificação `leader`/`manager`.
- `client_satisfaction_history`: liberar INSERT para qualquer autenticado (não só admin).

**Storage**
- Bucket público `avatars` + policies (upload na própria pasta `auth.uid()/...`).

---

## 2. Bug de role no edge function `create-user`
Atualmente: provavelmente o `handle_new_user` insere `collaborator` por padrão e o edge function não substitui corretamente. Corrigir: depois de criar o auth user, **deletar** `user_roles` default e inserir o role escolhido (`leader`/`manager`/`collaborator`). Garantir que body é parseado certo.

---

## 3. Frontend

### 3.1 Permissões (esconder financeiro de manager/collaborator)
- Sidebar: `Finance`, `Reports > Financeiro` só para `leader`.
- `ClientDetail`: campos `monthly_value`, "Receita/mês" e mensalidade só visíveis para `leader`.
- `TeamMemberDetail`/perfil de colaborador: esconder `salary`, `hourly_rate`, `tax_rate` para não-líder.
- Manager ganha acesso a: Times, Colaboradores, Clientes, Kanban (sem financeiro).

### 3.2 `/reports/tasks` paginação
- Paginação client-side de 20 em 20, usando `<Pagination>` do shadcn (Prev/Next + números).

### 3.3 Notificações individuais
- `NotificationsBell` lê de `notifications` via Supabase filtrando `user_id = auth.uid()`, com realtime subscription.
- Marcar como lida → `UPDATE notifications SET read = true`.

### 3.4 Tela de Equipe / detalhe do colaborador
- Botão "Remover colaborador" (líder): chama edge function `delete-user` (a criar) que apaga do auth + profiles + user_roles.
- Seção "Clientes vinculados": multi-select de clientes → grava em `client_collaborators`.

### 3.5 Times (`/teams` ou `TeamsDB`)
- Adicionar seção "Clientes do time" com multi-select → `client_teams`.
- Trigger no DB cuida de sincronizar `client_collaborators`.

### 3.6 Clientes
- Status em PT-BR: Ativo, Pausado, Inativo, Prospect.
- Quando muda para Pausado/Inativo: trigger remove vínculos.
- "Equipe envolvida" agora vem de `client_collaborators` (join com profiles).
- Satisfação editável por **todos** (colaborador/gerente/líder) → grava em `client_satisfaction_history` e atualiza `clients.satisfaction`.
- Seção "Serviços contratados": multi-select de `services`. Editável só por líder; visível a todos.

### 3.7 Serviços
- Nova página `/services` (só líder pode acessar editar; manager/collaborator veem read-only).
- CRUD com nome, descrição, preço.

### 3.8 Perfil (`/profile`)
- Upload de avatar → bucket `avatars`. Substituir input de URL por `<input type="file">`.
- Seção "Senha": mostrar email + 2 campos (nova senha + confirmação) usando `supabase.auth.updateUser({ password })`. Não dá para "ver senha atual" (auth não expõe hash) — vou explicar isso e oferecer apenas "alterar senha".
- Salvar dados em `profiles` (não no mock store).

### 3.9 Colaboradores (`/collaborators`)
- Botão remover (líder).
- Editar role inline.

---

## 4. SQL final
No fim, entrego um script SQL único que o usuário pode rodar manualmente no Supabase para sincronizar (caso a migration automática falhe), + comando para promover líder.

---

## Detalhes técnicos
- Migration única com tudo (tabelas, triggers, RLS, bucket).
- Edge function `delete-user` usando service role.
- Hook `useCurrentRole()` em `AuthContext` já existe (`is_leader`, `is_manager`).
- Realtime: `supabase.channel('notif').on('postgres_changes', { table: 'notifications', filter: 'user_id=eq.<uid>' })`.

---

## Sobre "ver senha atual"
O Supabase **não permite** ver a senha atual do usuário (ela é hash bcrypt). Vou implementar apenas "alterar senha" (com confirmação da nova). Se quiser segurança extra, pedimos a senha atual e fazemos um `signInWithPassword` silencioso para validar antes de trocar — confirma se prefere assim?

---

## Ordem de execução
1. Migration SQL (tabelas, triggers, bucket, RLS).
2. Edge functions (`create-user` fix, `delete-user` novo).
3. Frontend: AuthContext/permissões → Sidebar → páginas (Profile, Collaborators, Clients, ClientDetail, Teams, Services nova, Reports).
4. Notificações realtime.
5. SQL final consolidado para o usuário.

Pode confirmar 2 pontos antes de começar?
- (a) "Ver senha atual" — confirmo que não é possível, vou implementar **alterar senha com confirmação da senha atual** (mais seguro). OK?
- (b) Manager pode **criar/remover colaboradores** (sem mexer em líder) ou só líder?
