-- =====================================================================
-- Versátil Digital — Schema Supabase (atualizado)
-- ZailonSoft · 2026
-- Cole este script inteiro no SQL Editor do Supabase e execute.
-- =====================================================================

-- Reset opcional (descomente se quiser recriar do zero)
-- drop table if exists public.time_entries cascade;
-- drop table if exists public.comments cascade;
-- drop table if exists public.tasks cascade;
-- drop table if exists public.clients cascade;
-- drop table if exists public.user_roles cascade;
-- drop table if exists public.users cascade;
-- drop type if exists public.app_role;
-- drop type if exists public.task_status;
-- drop type if exists public.task_priority;
-- drop type if exists public.client_status;

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

-- ============== USERS (perfil) =======================================
-- Importante: a autenticação real fica em auth.users (Supabase Auth).
-- public.users é o perfil + dados visíveis na app, ligado por id.
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  role public.app_role not null default 'employee',
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ============== USER_ROLES (segurança) ===============================
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- ============== CLIENTS ==============================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text,
  status public.client_status not null default 'active',
  created_at timestamptz not null default now()
);

-- ============== TASKS ================================================
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  client_id uuid references public.clients(id) on delete set null,
  assignee_id uuid references public.users(id) on delete set null,
  due_date timestamptz,
  total_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_assignee on public.tasks(assignee_id);
create index if not exists idx_tasks_client on public.tasks(client_id);

-- ============== COMMENTS =============================================
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- ============== TIME ENTRIES =========================================
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  seconds integer not null default 0
);

-- ============== NOTIFICATIONS ========================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============== updated_at trigger ===================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_tasks_updated on public.tasks;
create trigger trg_tasks_updated before update on public.tasks
for each row execute function public.set_updated_at();

-- ============== RLS ==================================================
alter table public.users          enable row level security;
alter table public.user_roles     enable row level security;
alter table public.clients        enable row level security;
alter table public.tasks          enable row level security;
alter table public.comments       enable row level security;
alter table public.time_entries   enable row level security;
alter table public.notifications  enable row level security;

-- Política simples para começar: usuários autenticados podem ler tudo.
-- Líder pode escrever tudo; funcionário só pode editar tarefas em que
-- é o assignee. Ajuste conforme necessário em produção.

create policy "auth read users"        on public.users         for select to authenticated using (true);
create policy "auth read clients"      on public.clients       for select to authenticated using (true);
create policy "auth read tasks"        on public.tasks         for select to authenticated using (true);
create policy "auth read comments"     on public.comments      for select to authenticated using (true);
create policy "auth read time"         on public.time_entries  for select to authenticated using (true);
create policy "auth read notifs"       on public.notifications for select to authenticated using (user_id is null or user_id = auth.uid());
create policy "auth read roles"        on public.user_roles    for select to authenticated using (true);

create policy "leader writes clients"  on public.clients       for all to authenticated
  using (public.has_role(auth.uid(),'leader')) with check (public.has_role(auth.uid(),'leader'));

create policy "leader writes tasks"    on public.tasks         for all to authenticated
  using (public.has_role(auth.uid(),'leader')) with check (public.has_role(auth.uid(),'leader'));

create policy "assignee updates own task" on public.tasks      for update to authenticated
  using (assignee_id = auth.uid()) with check (assignee_id = auth.uid());

create policy "user inserts own comment" on public.comments    for insert to authenticated
  with check (user_id = auth.uid());

create policy "user inserts own time"    on public.time_entries for insert to authenticated
  with check (user_id = auth.uid());

-- ============== SEED =================================================
-- Usuários (mesmas credenciais do app demo)
insert into public.users (id, name, email, role) values
  ('11111111-1111-1111-1111-111111111111','Ana Viana',     'ana@versatil.digital',     'leader'),
  ('22222222-2222-2222-2222-222222222222','Ricardo Lima',  'ricardo@versatil.digital', 'employee'),
  ('33333333-3333-3333-3333-333333333333','Maria Souza',   'maria@versatil.digital',   'employee'),
  ('44444444-4444-4444-4444-444444444444','Carlos Aguiar', 'carlos@versatil.digital',  'employee'),
  ('55555555-5555-5555-5555-555555555555','Juliana Reis',  'juliana@versatil.digital', 'employee')
on conflict (id) do nothing;

insert into public.user_roles (user_id, role) values
  ('11111111-1111-1111-1111-111111111111','leader'),
  ('22222222-2222-2222-2222-222222222222','employee'),
  ('33333333-3333-3333-3333-333333333333','employee'),
  ('44444444-4444-4444-4444-444444444444','employee'),
  ('55555555-5555-5555-5555-555555555555','employee')
on conflict do nothing;

-- Clientes
insert into public.clients (id, name, company, email, status) values
  ('aaaaaaaa-0001-0000-0000-000000000001','Aurora Cosméticos',   'Aurora SA',           'contato@aurora.com',         'active'),
  ('aaaaaaaa-0002-0000-0000-000000000002','TechNova',            'TechNova LTDA',       'marketing@technova.io',      'active'),
  ('aaaaaaaa-0003-0000-0000-000000000003','Verde Bistrô',        'Verde Bistrô',        'ola@verdebistro.com',        'active'),
  ('aaaaaaaa-0004-0000-0000-000000000004','Studio Pilates',      'Studio Pilates Zen',  'contato@studiopilates.com',  'paused'),
  ('aaaaaaaa-0005-0000-0000-000000000005','Construtora Horizonte','Horizonte SA',       'marketing@horizonte.com',    'active')
on conflict (id) do nothing;

-- Tarefas (agência de marketing)
insert into public.tasks (title, description, status, priority, client_id, assignee_id, due_date) values
  ('Calendário editorial — Setembro', 'Planejar 30 posts de Instagram com pilares de conteúdo.', 'in_progress','high',   'aaaaaaaa-0001-0000-0000-000000000001','22222222-2222-2222-2222-222222222222', now() + interval '2 days'),
  ('Otimização de campanha Google Ads','Reduzir CPA em 15% e ajustar lances por dispositivo.',   'in_progress','urgent', 'aaaaaaaa-0002-0000-0000-000000000002','44444444-4444-4444-4444-444444444444', now() + interval '1 day'),
  ('Roteiro Reels — lançamento produto','3 roteiros de 30s com hook + payoff.',                  'review',     'medium', 'aaaaaaaa-0001-0000-0000-000000000001','33333333-3333-3333-3333-333333333333', now() + interval '3 days'),
  ('Wireframe site institucional',     'Low-fi de 6 telas para aprovação.',                       'todo',       'high',   'aaaaaaaa-0005-0000-0000-000000000005','22222222-2222-2222-2222-222222222222', now() + interval '7 days'),
  ('Newsletter mensal — Setembro',     'Briefing + copy + envio via RD Station.',                 'done',       'low',    'aaaaaaaa-0003-0000-0000-000000000003','33333333-3333-3333-3333-333333333333', now() - interval '2 days'),
  ('Estratégia SEO trimestral',        'Pesquisa de palavras-chave + plano editorial blog.',      'todo',       'medium', 'aaaaaaaa-0002-0000-0000-000000000002','55555555-5555-5555-5555-555555555555', now() + interval '10 days'),
  ('Edição vídeo — depoimentos clientes','Cortar 4 cases em vídeos verticais 60s.',               'in_progress','medium', 'aaaaaaaa-0005-0000-0000-000000000005','33333333-3333-3333-3333-333333333333', now() + interval '4 days'),
  ('Relatório de performance — Agosto','Dashboard Looker Studio + insights.',                     'done',       'high',   'aaaaaaaa-0001-0000-0000-000000000001','44444444-4444-4444-4444-444444444444', now() - interval '1 day'),
  ('Briefing nova marca',              'Reunião + documento de posicionamento.',                  'review',     'high',   'aaaaaaaa-0004-0000-0000-000000000004','55555555-5555-5555-5555-555555555555', now() + interval '2 days'),
  ('Posts blog — 4 artigos SEO',       'Briefing > redação > revisão > publicação.',              'in_progress','low',    'aaaaaaaa-0002-0000-0000-000000000002','33333333-3333-3333-3333-333333333333', now() + interval '5 days'),
  ('Auditoria de marca',               'Análise de presença digital, gaps e oportunidades.',      'todo',       'urgent', 'aaaaaaaa-0005-0000-0000-000000000005','22222222-2222-2222-2222-222222222222', now() - interval '1 day'),
  ('Setup Pixel Meta Ads + GA4',       'Implementar via GTM e validar eventos.',                  'done',       'medium', 'aaaaaaaa-0003-0000-0000-000000000003','44444444-4444-4444-4444-444444444444', now() - interval '3 days'),
  ('Criação de identidade visual',     'Logo, paleta, tipografia e manual de marca.',             'todo',       'high',   'aaaaaaaa-0004-0000-0000-000000000004','55555555-5555-5555-5555-555555555555', now() + interval '14 days'),
  ('Campanha Black Friday',            'Estratégia full-funnel + criativos + landing page.',      'todo',       'urgent', 'aaaaaaaa-0001-0000-0000-000000000001','22222222-2222-2222-2222-222222222222', now() + interval '20 days'),
  ('Resposta a comentários e DMs',     'Gestão de comunidade — semana atual.',                    'in_progress','low',    'aaaaaaaa-0001-0000-0000-000000000001','33333333-3333-3333-3333-333333333333', now()),
  ('E-mail marketing — automação boas-vindas','Fluxo de 5 e-mails para novos leads.',             'review',     'medium', 'aaaaaaaa-0002-0000-0000-000000000002','44444444-4444-4444-4444-444444444444', now() + interval '3 days'),
  ('Análise de concorrentes',          'Benchmark de 5 concorrentes diretos.',                    'in_progress','medium', 'aaaaaaaa-0005-0000-0000-000000000005','55555555-5555-5555-5555-555555555555', now() + interval '6 days'),
  ('Sessão de fotos produtos',         'Coordenar produção e direção de arte.',                   'todo',       'high',   'aaaaaaaa-0001-0000-0000-000000000001','33333333-3333-3333-3333-333333333333', now() + interval '8 days');

-- =====================================================================
-- IMPORTANTE — autenticação real:
-- Para que o login do app funcione contra o Supabase, crie cada usuário
-- também em Authentication > Users com o MESMO email e a senha de demo.
-- Sugestão (mock):
--   ana@versatil.digital     · senha: lider123
--   ricardo@versatil.digital · senha: func123
--   maria@versatil.digital   · senha: func123
--   carlos@versatil.digital  · senha: func123
--   juliana@versatil.digital · senha: func123
-- Depois, atualize o id em public.users para coincidir com auth.users.id.
-- =====================================================================
