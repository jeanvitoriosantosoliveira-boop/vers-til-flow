## Escopo

Três blocos grandes:

### 1. Aba "Studio" (apenas líder)
- Nova rota `/studio` visível só para `is_leader`.
- Controle de ensaios: tabela `studio_sessions` (data, cliente/artista, horas, valor, status pago/pendente, observações).
- Financeiro próprio do Studio: `studio_expenses` + cards de receita/despesa/lucro do studio (separado do Financeiro principal).
- CRUD completo, gráficos simples (mensal).

### 2. Financeiro: editar Caixa atual manualmente
- No card "Caixa atual" da tela `/finance`, botão "Editar" abre dialog para setar valor exato.
- Implementado gravando em `finance_settings` chave `cash_override` (valor + data) — o cálculo de caixa passa a usar override se existir, senão segue regra atual.

### 3. Novo perfil "Comercial" (vendedor)
- Adicionar `'commercial'` ao enum `app_role`.
- Helper SQL `is_commercial(uid)`; navegação por role:
  - Comercial vê: Dashboard (CRM), Funil de Vendas (kanban próprio), Leads/Clientes-CRM, Agenda, Perfil.
  - Não vê: Kanban de tarefas operacionais, Times, Colaboradores, Finance, Studio, Reports operacionais.
- Tabelas novas para CRM de vendas:
  - `leads` (nome, empresa, email, phone, whatsapp, origem, valor estimado, status, owner_id, notes).
  - `lead_stages` (colunas configuráveis do funil: Novo, Abordagem, Follow-up, Proposta, Negociação, Ganho, Perdido) + `stage_id` em `leads`.
  - `lead_activities` (tipo: call/email/whatsapp/note/meeting, descrição, data).
  - `sales_events` (agenda: título, lead_id, start, end, tipo: call/meeting/reuniao, location/link).
- Telas:
  - `/sales` — Kanban funil drag-and-drop (mesma lógica do Kanban atual).
  - Card do lead exibe nome, valor, próximo follow-up; botões: WhatsApp (abre `https://wa.me/<num>`), email (`mailto:`), telefone (`tel:`).
  - Dialog do lead: dados + timeline de atividades + agendar evento.
  - `/sales/agenda` — calendário com eventos próximos, criar/editar evento.
  - `/sales/dashboard` (sobrescreve `/` quando role=commercial): KPIs de vendas (leads no funil, valor previsto, ganhos do mês, conversão).
- Edge function `create-user` aceita role `commercial`.

### 4. SQL consolidado
Ao final, entrego script único: enum `commercial`, novas tabelas (`studio_sessions`, `studio_expenses`, `leads`, `lead_stages`, `lead_activities`, `sales_events`), GRANTs + RLS, seed de stages padrão e colunas Kanban do funil.

---

## Detalhes técnicos
- Migration única com tudo.
- RLS:
  - `studio_*`: SELECT/INSERT/UPDATE/DELETE apenas `leader`.
  - `leads`/`lead_activities`/`sales_events`: SELECT auth (leader/manager veem tudo); commercial vê só `owner_id = auth.uid()`; INSERT/UPDATE pelo dono ou leader/manager.
  - `lead_stages`: SELECT auth; modify leader/manager.
- AppLayout: navegação varia por role (`leader|manager|collaborator|commercial`).
- Rotas guard: helper `<RoleGuard allow={['leader']}>`.
- Reaproveitar `@dnd-kit` do Kanban atual para o funil.
- Card lead com ícones lucide `MessageCircle` (whats), `Mail`, `Phone`.
- Agenda: lista por dia (sem lib de calendário pesada) + filtro semana/mês.
- Override de caixa: ao salvar, grava `finance_settings.cash_override = { value, set_at }`. `Finance.tsx` usa esse valor como base, somando ajustes posteriores a `set_at`.

## Ordem
1. Migration (enum + tabelas + RLS + seed stages).
2. Edge function `create-user`: aceitar `commercial`.
3. AuthContext: tipo `AppRole` inclui `commercial`; `is_commercial`.
4. AppLayout: nav por role + guard de rotas.
5. Páginas Studio (lista ensaios + financeiro studio).
6. Edit caixa atual em Finance.
7. Páginas Sales (Funil, Lead detail, Agenda, Dashboard comercial).
8. SQL final consolidado para o usuário.

---

Posso seguir?
