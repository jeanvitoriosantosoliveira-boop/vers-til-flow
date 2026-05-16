-- =====================================================================
-- Versátil Digital — Schema Supabase (CONSOLIDADO v3)
-- ZailonSoft · 2026
-- Cole este script inteiro no SQL Editor do Supabase e execute.
-- Cobre: usuários, times, clientes (com contratos e satisfação),
-- tarefas (com recorrência avançada e templates), horas, comentários,
-- colunas dinâmicas do Kanban, financeiro (despesas, serviços avulsos,
-- ajustes de caixa, configurações), notas de equipe e funções RBAC.
-- =====================================================================

-- ============== ENUMS ================================================
do $$ begin
  create type public.app_role as enum ('leader','employee');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum ('todo','in_progress','review','done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_priority as enum ('low','medium','high','urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.client_status as enum ('active','paused','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.recurrence_mode as enum ('none','hourly','daily','weekly','monthly');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.client_health as enum ('great','good','warning','risk');
exception when duplicate_object then null; end $$;

-- ============== USERS (perfil) =======================================
create table if not exists public.users (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null unique,
  role         public.app_role not null default 'employee',
  avatar_url   text,
  position     text,
  salary       numeric default 0,
  tax_rate     numeric default 32,
  hire_date    date,
  team_id      uuid,
  team_ids     uuid[] default '{}',
  is_manager   boolean not null default false,
  phone        text,
  birthdate    date,
  bio          text,
  city         text,
  skills       text[] default '{}',
  created_at   timestamptz not null default now()
);

-- ============== USER_ROLES (segurança) ===============================
create table if not exists public.user_roles (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role    public.app_role not null,
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_leader(_user_id uuid) returns boolean
language sql stable security definer set search_path = public
as $$ select public.has_role(_user_id, 'leader'); $$;

-- ============== TEAMS ================================================
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  color       text default 'bg-primary',
  manager_id  uuid references public.users(id) on delete set null,
  cover_url   text,
  member_ids  uuid[] default '{}',
  created_at  timestamptz not null default now()
);

-- ============== CLIENTS ==============================================
create table if not exists public.clients (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  company               text,
  email                 text,
  phone                 text,
  segment               text,
  monthly_fee           numeric default 0,
  contract_start        date,
  contract_end          date,
  contract_months       int,
  monthly_hours_target  numeric default 40,
  satisfaction          numeric default 0,
  satisfaction_history  jsonb default '[]'::jsonb,
  health                public.client_health default 'good',
  services              text[] default '{}',
  notes                 text,
  status                public.client_status not null default 'active',
  created_at            timestamptz not null default now()
);

-- ============== KANBAN COLUMNS =======================================
create table if not exists public.kanban_columns (
  id        uuid primary key default gen_random_uuid(),
  title     text not null,
  accent    text default 'bg-muted-foreground',
  "order"   int  not null default 0,
  base      public.task_status,
  created_at timestamptz not null default now()
);

-- ============== TASKS ================================================
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  status        public.task_status not null default 'todo',
  priority      public.task_priority not null default 'medium',
  client_id     uuid references public.clients(id) on delete set null,
  assignee_id   uuid references public.users(id) on delete set null,
  created_by    uuid references public.users(id) on delete set null,
  due_date      timestamptz,
  total_seconds bigint not null default 0,
  column_id     uuid references public.kanban_columns(id) on delete set null,
  -- Recorrência
  recurrence_mode      public.recurrence_mode default 'none',
  recurrence_interval  int default 1,
  recurrence_next_due  timestamptz,
  recurrence_days_of_week int[] default '{}',
  recurrence_days_of_month int[] default '{}',
  recurrence_times     text[] default '{}',
  recurrence_end_date  date,
  is_template          boolean not null default false,
  template_id          uuid references public.tasks(id) on delete set null,
  last_spawn           timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tasks_assignee on public.tasks(assignee_id);
create index if not exists idx_tasks_client   on public.tasks(client_id);
create index if not exists idx_tasks_status   on public.tasks(status);
create index if not exists idx_tasks_template on public.tasks(template_id);

-- ============== COMMENTS =============================================
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ============== TIME ENTRIES =========================================
create table if not exists public.time_entries (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  seconds     int not null check (seconds > 0),
  description text,
  logged_at   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index if not exists idx_time_user on public.time_entries(user_id);
create index if not exists idx_time_task on public.time_entries(task_id);

-- ============== EXPENSES =============================================
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  amount      numeric not null default 0,
  category    text not null default 'other',
  date        date not null default current_date,
  recurring   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ============== EXTRA SERVICES (receitas avulsas) ===================
create table if not exists public.extra_services (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.clients(id) on delete set null,
  title       text not null,
  description text,
  amount      numeric not null default 0,
  date        date not null default current_date,
  created_at  timestamptz not null default now()
);

-- ============== CASH ADJUSTMENTS =====================================
create table if not exists public.cash_adjustments (
  id         uuid primary key default gen_random_uuid(),
  amount     numeric not null,    -- positivo = aporte, negativo = retirada
  reason     text not null,
  date       date not null default current_date,
  created_at timestamptz not null default now()
);

-- ============== TEAM NOTES (anotações do líder) ======================
create table if not exists public.team_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  author_id  uuid not null references public.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ============== FINANCE SETTINGS (singleton) =========================
create table if not exists public.finance_settings (
  id                 int primary key default 1,
  opening_balance    numeric not null default 0,
  default_tax_rate   numeric not null default 32,
  custom_categories  jsonb default '[]'::jsonb,
  updated_at         timestamptz not null default now(),
  check (id = 1)
);
insert into public.finance_settings (id) values (1) on conflict do nothing;

-- ============== RLS ==================================================
alter table public.users            enable row level security;
alter table public.teams            enable row level security;
alter table public.clients          enable row level security;
alter table public.kanban_columns   enable row level security;
alter table public.tasks            enable row level security;
alter table public.comments         enable row level security;
alter table public.time_entries     enable row level security;
alter table public.expenses         enable row level security;
alter table public.extra_services   enable row level security;
alter table public.cash_adjustments enable row level security;
alter table public.team_notes       enable row level security;
alter table public.finance_settings enable row level security;

-- Leitura para autenticados; escrita restrita ao líder onde faz sentido.
create policy "auth read users"           on public.users            for select to authenticated using (true);
create policy "self update users"         on public.users            for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "leader manage users"       on public.users            for all    to authenticated using (public.is_leader(auth.uid())) with check (public.is_leader(auth.uid()));

create policy "auth read teams"           on public.teams            for select to authenticated using (true);
create policy "leader manage teams"       on public.teams            for all    to authenticated using (public.is_leader(auth.uid())) with check (public.is_leader(auth.uid()));

create policy "auth read clients"         on public.clients          for select to authenticated using (true);
create policy "leader manage clients"     on public.clients          for all    to authenticated using (public.is_leader(auth.uid())) with check (public.is_leader(auth.uid()));

create policy "auth read columns"         on public.kanban_columns   for select to authenticated using (true);
create policy "leader manage columns"     on public.kanban_columns   for all    to authenticated using (public.is_leader(auth.uid())) with check (public.is_leader(auth.uid()));

create policy "auth read tasks"           on public.tasks            for select to authenticated using (true);
create policy "auth write tasks"          on public.tasks            for all    to authenticated using (true) with check (true);

create policy "auth read comments"        on public.comments         for select to authenticated using (true);
create policy "auth write comments"       on public.comments         for insert to authenticated with check (user_id = auth.uid());

create policy "auth read time"            on public.time_entries     for select to authenticated using (true);
create policy "auth write time"           on public.time_entries     for insert to authenticated with check (user_id = auth.uid());
create policy "self delete time"          on public.time_entries     for delete to authenticated using (user_id = auth.uid() or public.is_leader(auth.uid()));

create policy "leader read expenses"      on public.expenses         for select to authenticated using (public.is_leader(auth.uid()));
create policy "leader manage expenses"    on public.expenses         for all    to authenticated using (public.is_leader(auth.uid())) with check (public.is_leader(auth.uid()));

create policy "leader read extra svc"     on public.extra_services   for select to authenticated using (public.is_leader(auth.uid()));
create policy "leader manage extra svc"   on public.extra_services   for all    to authenticated using (public.is_leader(auth.uid())) with check (public.is_leader(auth.uid()));

create policy "leader read cash"          on public.cash_adjustments for select to authenticated using (public.is_leader(auth.uid()));
create policy "leader manage cash"        on public.cash_adjustments for all    to authenticated using (public.is_leader(auth.uid())) with check (public.is_leader(auth.uid()));

create policy "leader read notes"         on public.team_notes       for select to authenticated using (public.is_leader(auth.uid()));
create policy "leader manage notes"       on public.team_notes       for all    to authenticated using (public.is_leader(auth.uid())) with check (public.is_leader(auth.uid()));

create policy "auth read fin settings"    on public.finance_settings for select to authenticated using (public.is_leader(auth.uid()));
create policy "leader manage settings"    on public.finance_settings for all    to authenticated using (public.is_leader(auth.uid())) with check (public.is_leader(auth.uid()));

-- ============== STORAGE (avatares) ===================================
insert into storage.buckets (id, name, public) values ('avatars','avatars', true)
on conflict (id) do nothing;

-- ============== SEED OPCIONAL (DEMO) =================================
-- Usuários de demonstração — emails iguais aos do mock.
insert into public.users (id, name, email, role, position, salary, tax_rate, hire_date, is_manager) values
  ('11111111-1111-1111-1111-111111111111', 'Ana Viana',     'ana@versatil.digital',     'leader',   'Diretora / CEO',      14000, 28, '2022-01-10', false),
  ('22222222-2222-2222-2222-222222222222', 'Ricardo Lima',  'ricardo@versatil.digital', 'employee', 'Gestor de Tráfego',    4800, 32, '2023-03-12', true),
  ('33333333-3333-3333-3333-333333333333', 'Maria Souza',   'maria@versatil.digital',   'employee', 'Social Media',         3800, 32, '2023-08-01', false),
  ('44444444-4444-4444-4444-444444444444', 'Carlos Aguiar', 'carlos@versatil.digital',  'employee', 'Designer / Editor',    4200, 32, '2024-02-20', true),
  ('55555555-5555-5555-5555-555555555555', 'Juliana Reis',  'juliana@versatil.digital', 'employee', 'Estrategista de SEO',  5200, 32, '2023-11-05', false)
on conflict (email) do nothing;

insert into public.user_roles (user_id, role) values
  ('11111111-1111-1111-1111-111111111111','leader'),
  ('22222222-2222-2222-2222-222222222222','employee'),
  ('33333333-3333-3333-3333-333333333333','employee'),
  ('44444444-4444-4444-4444-444444444444','employee'),
  ('55555555-5555-5555-5555-555555555555','employee')
on conflict do nothing;

insert into public.kanban_columns (id, title, accent, "order", base) values
  (gen_random_uuid(), 'A Fazer',      'bg-muted-foreground', 0, 'todo'),
  (gen_random_uuid(), 'Em Andamento', 'bg-primary',          1, 'in_progress'),
  (gen_random_uuid(), 'Em Revisão',   'bg-warning',          2, 'review'),
  (gen_random_uuid(), 'Concluído',    'bg-success',          3, 'done')
on conflict do nothing;

-- Pronto. Logins de demonstração:
--   ana@versatil.digital      / lider123    (líder)
--   ricardo@versatil.digital  / colab123    (gerente)
--   maria@versatil.digital    / colab123
--   carlos@versatil.digital   / colab123    (gerente)
--   juliana@versatil.digital  / colab123
