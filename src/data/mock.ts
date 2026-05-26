import type { Client, Task, User, Comment, TimeEntry, Expense, ExtraService, Team } from "@/types";

export const mockUsers: User[] = [
  { id: "u1", name: "Ana Viana",      email: "ana@versatil.digital",     role: "leader",   password: "lider123", position: "Diretora / CEO",       salary: 14000, tax_rate: 28, hire_date: "2022-01-10" },
  { id: "u2", name: "Ricardo Lima",   email: "ricardo@versatil.digital", role: "employee", password: "colab123", position: "Gestor de Tráfego",    salary:  4800, tax_rate: 32, hire_date: "2023-03-12", team_id: "tm1", is_manager: true },
  { id: "u3", name: "Maria Souza",    email: "maria@versatil.digital",   role: "employee", password: "colab123", position: "Social Media",         salary:  3800, tax_rate: 32, hire_date: "2023-08-01", team_id: "tm1" },
  { id: "u4", name: "Carlos Aguiar",  email: "carlos@versatil.digital",  role: "employee", password: "colab123", position: "Designer / Editor",    salary:  4200, tax_rate: 32, hire_date: "2024-02-20", team_id: "tm2", is_manager: true },
  { id: "u5", name: "Juliana Reis",   email: "juliana@versatil.digital", role: "employee", password: "colab123", position: "Estrategista de SEO",  salary:  5200, tax_rate: 32, hire_date: "2023-11-05", team_id: "tm2" },
];

export const mockTeams: Team[] = [
  { id: "tm1", name: "Performance & Conteúdo", description: "Tráfego pago, social media, copy.", color: "bg-primary",   manager_id: "u2", created_at: new Date().toISOString() },
  { id: "tm2", name: "Branding & Criação",     description: "Design, vídeo, identidade visual.", color: "bg-accent",    manager_id: "u4", created_at: new Date().toISOString() },
];

export const mockClients: Client[] = [
  // { id: "c1", name: "Aurora Cosméticos", company: "Aurora SA", email: "contato@aurora.com", phone: "(11) 98888-1010",
  //   segment: "Beleza & Cosméticos", monthly_fee: 8500, contract_start: "2024-03-01",
  //   contract_end: "2026-09-30", contract_months: 30,
  //   monthly_hours_target: 60, satisfaction: 4.6, health: "great",
  //   services: ["Social Media","Tráfego Pago","Produção de Conteúdo","Influenciadores"],
  //   notes: "Cliente âncora. Reuniões semanais às quintas.",
  //   status: "active", created_at: new Date().toISOString() },
  // { id: "c2", name: "TechNova", company: "TechNova LTDA", email: "marketing@technova.io", phone: "(11) 99777-2020",
  //   segment: "SaaS B2B", monthly_fee: 12000, contract_start: "2023-11-15",
  //   contract_end: "2026-05-31", contract_months: 30,
  //   monthly_hours_target: 80, satisfaction: 4.2, health: "good",
  //   services: ["SEO","Inbound","E-mail Marketing","Google Ads","Analytics"],
  //   notes: "Foco em geração de MQLs. KPI principal: CPL.",
  //   status: "active", created_at: new Date().toISOString() },
  // { id: "c3", name: "Verde Bistrô", company: "Verde Bistrô", email: "ola@verdebistro.com", phone: "(11) 97666-3030",
  //   segment: "Gastronomia", monthly_fee: 3500, contract_start: "2025-01-10",
  //   contract_end: "2026-07-10", contract_months: 18,
  //   monthly_hours_target: 25, satisfaction: 4.8, health: "great",
  //   services: ["Social Media","Fotografia"],
  //   notes: "Adoram resultados orgânicos.",
  //   status: "active", created_at: new Date().toISOString() },
  // { id: "c4", name: "Studio Pilates", company: "Studio Pilates Zen", email: "contato@studiopilates.com", phone: "(11) 96555-4040",
  //   segment: "Saúde & Bem-estar", monthly_fee: 2200, contract_start: "2024-08-20",
  //   contract_end: "2026-05-15", contract_months: 21,
  //   monthly_hours_target: 18, satisfaction: 3.2, health: "warning",
  //   services: ["Social Media","Branding"],
  //   notes: "Em rebranding. Atenção à comunicação visual.",
  //   status: "paused", created_at: new Date().toISOString() },
  // { id: "c5", name: "Construtora Horizonte", company: "Horizonte SA", email: "marketing@horizonte.com", phone: "(11) 95444-5050",
  //   segment: "Construção Civil", monthly_fee: 9800, contract_start: "2024-06-01",
  //   contract_end: "2026-06-01", contract_months: 24,
  //   monthly_hours_target: 70, satisfaction: 2.8, health: "risk",
  //   services: ["Site & Landing Pages","Tráfego Pago","Vídeo","CRM"],
  //   notes: "Cliente exigente — revisar entregas com cuidado extra.",
  //   status: "active", created_at: new Date().toISOString() },
];

const now = Date.now();
const day = (n: number) => new Date(now + n * 86400000).toISOString();

// Tarefas pensadas para fluxo de agência de marketing digital
export const mockTasks: Task[] = [
  { id: "t1",  title: "Calendário editorial — Setembro",        description: "Planejar 30 posts de Instagram com pilares de conteúdo.", status: "in_progress", priority: "high",   client_id: "c1", assignee_id: "u2", due_date: day(2),  created_at: day(-3),  updated_at: day(0),  total_seconds: 5400 },
  { id: "t2",  title: "Otimização de campanha Google Ads",      description: "Reduzir CPA em 15% e ajustar lances por dispositivo.",     status: "in_progress", priority: "urgent", client_id: "c2", assignee_id: "u4", due_date: day(1),  created_at: day(-5),  updated_at: day(0),  total_seconds: 12600 },
  { id: "t3",  title: "Roteiro Reels — lançamento produto",     description: "3 roteiros de 30s com hook + payoff.",                     status: "review",      priority: "medium", client_id: "c1", assignee_id: "u3", due_date: day(3),  created_at: day(-2),  updated_at: day(0),  total_seconds: 3200 },
  { id: "t4",  title: "Wireframe site institucional",           description: "Low-fi de 6 telas para aprovação.",                        status: "todo",        priority: "high",   client_id: "c5", assignee_id: "u2", due_date: day(7),  created_at: day(-1),  updated_at: day(0),  total_seconds: 0 },
  { id: "t5",  title: "Newsletter mensal — Setembro",            description: "Briefing + copy + envio via RD Station.",                  status: "done",        priority: "low",    client_id: "c3", assignee_id: "u3", due_date: day(-2), created_at: day(-10), updated_at: day(-2), total_seconds: 4800 },
  { id: "t6",  title: "Estratégia SEO trimestral",              description: "Pesquisa de palavras-chave + plano editorial blog.",        status: "todo",        priority: "medium", client_id: "c2", assignee_id: "u5", due_date: day(10), created_at: day(0),   updated_at: day(0),  total_seconds: 0 },
  { id: "t7",  title: "Edição vídeo — depoimentos clientes",    description: "Cortar 4 cases em vídeos verticais 60s.",                  status: "in_progress", priority: "medium", client_id: "c5", assignee_id: "u3", due_date: day(4),  created_at: day(-2),  updated_at: day(0),  total_seconds: 7200 },
  { id: "t8",  title: "Relatório de performance — Agosto",      description: "Dashboard Looker Studio + insights.",                      status: "done",        priority: "high",   client_id: "c1", assignee_id: "u4", due_date: day(-1), created_at: day(-8),  updated_at: day(-1), total_seconds: 9000 },
  { id: "t9",  title: "Briefing nova marca",                    description: "Reunião + documento de posicionamento.",                   status: "review",      priority: "high",   client_id: "c4", assignee_id: "u5", due_date: day(2),  created_at: day(-3),  updated_at: day(0),  total_seconds: 2400 },
  { id: "t10", title: "Posts blog — 4 artigos SEO",             description: "Briefing > redação > revisão > publicação.",               status: "in_progress", priority: "low",    client_id: "c2", assignee_id: "u3", due_date: day(5),  created_at: day(-1),  updated_at: day(0),  total_seconds: 1800 },
  { id: "t11", title: "Auditoria de marca",                     description: "Análise de presença digital, gaps e oportunidades.",       status: "todo",        priority: "urgent", client_id: "c5", assignee_id: "u2", due_date: day(-1), created_at: day(-2),  updated_at: day(0),  total_seconds: 0 },
  { id: "t12", title: "Setup Pixel Meta Ads + GA4",             description: "Implementar via GTM e validar eventos.",                   status: "done",        priority: "medium", client_id: "c3", assignee_id: "u4", due_date: day(-3), created_at: day(-6),  updated_at: day(-3), total_seconds: 3600 },
  { id: "t13", title: "Criação de identidade visual",           description: "Logo, paleta, tipografia e manual de marca.",              status: "todo",        priority: "high",   client_id: "c4", assignee_id: "u5", due_date: day(14), created_at: day(0),   updated_at: day(0),  total_seconds: 0 },
  { id: "t14", title: "Campanha Black Friday",                  description: "Estratégia full-funnel + criativos + landing page.",       status: "todo",        priority: "urgent", client_id: "c1", assignee_id: "u2", due_date: day(20), created_at: day(0),   updated_at: day(0),  total_seconds: 0 },
  { id: "t15", title: "Resposta a comentários e DMs",           description: "Gestão de comunidade — semana atual.",                     status: "in_progress", priority: "low",    client_id: "c1", assignee_id: "u3", due_date: day(0),  created_at: day(-1),  updated_at: day(0),  total_seconds: 1200 },
  { id: "t16", title: "E-mail marketing — automação boas-vindas", description: "Fluxo de 5 e-mails para novos leads.",                   status: "review",      priority: "medium", client_id: "c2", assignee_id: "u4", due_date: day(3),  created_at: day(-4),  updated_at: day(0),  total_seconds: 5200 },
  { id: "t17", title: "Análise de concorrentes",                description: "Benchmark de 5 concorrentes diretos.",                     status: "in_progress", priority: "medium", client_id: "c5", assignee_id: "u5", due_date: day(6),  created_at: day(-2),  updated_at: day(0),  total_seconds: 2800 },
  { id: "t18", title: "Sessão de fotos produtos",               description: "Coordenar produção e direção de arte.",                    status: "todo",        priority: "high",   client_id: "c1", assignee_id: "u3", due_date: day(8),  created_at: day(0),   updated_at: day(0),  total_seconds: 0 },
];

export const mockComments: Comment[] = [
  { id: "cm1", task_id: "t1", user_id: "u1", body: "Lembrar de incluir CTA forte na semana 3.", created_at: day(-1) },
  { id: "cm2", task_id: "t2", user_id: "u4", body: "Ajustei lances. Aguardando 48h de dados.", created_at: day(0) },
];

const td = (n: number) => new Date(now - n * 86400000).toISOString();
export const mockTimeEntries: TimeEntry[] = [
  { id: "te1", task_id: "t1",  user_id: "u2", seconds: 5400,  description: "Pesquisa de pilares e referências",       logged_at: td(2), created_at: td(2) },
  { id: "te2", task_id: "t2",  user_id: "u4", seconds: 7200,  description: "Ajuste de lances e segmentação",          logged_at: td(1), created_at: td(1) },
  { id: "te3", task_id: "t2",  user_id: "u4", seconds: 5400,  description: "Análise de relatório de palavras-chave",  logged_at: td(0), created_at: td(0) },
  { id: "te4", task_id: "t3",  user_id: "u3", seconds: 3200,  description: "Roteirização e revisão",                  logged_at: td(1), created_at: td(1) },
  { id: "te5", task_id: "t7",  user_id: "u3", seconds: 7200,  description: "Edição cases 1 e 2",                      logged_at: td(0), created_at: td(0) },
  { id: "te6", task_id: "t8",  user_id: "u4", seconds: 9000,  description: "Montagem do dashboard + insights",        logged_at: td(3), created_at: td(3) },
  { id: "te7", task_id: "t10", user_id: "u3", seconds: 1800,  description: "Briefing dos artigos",                    logged_at: td(0), created_at: td(0) },
  { id: "te8", task_id: "t16", user_id: "u4", seconds: 5200,  description: "Setup automação RD Station",              logged_at: td(2), created_at: td(2) },
  { id: "te9", task_id: "t17", user_id: "u5", seconds: 2800,  description: "Mapeamento de 3 concorrentes",            logged_at: td(1), created_at: td(1) },
];

const monthAgo = (n: number) => {
  const d = new Date(); d.setMonth(d.getMonth() - n); d.setDate(15);
  return d.toISOString().slice(0, 10);
};

export const mockExpenses: Expense[] = [
  { id: "e1", title: "Aluguel do escritório",     description: "Sala comercial",          amount: 3200, category: "rent",      date: monthAgo(0), recurring: true,  created_at: monthAgo(0) },
  { id: "e2", title: "Energia elétrica",          description: "Conta CEMIG",             amount:  420, category: "utilities", date: monthAgo(0), recurring: true,  created_at: monthAgo(0) },
  { id: "e3", title: "Internet fibra 600MB",      description: "Vivo Empresas",           amount:  299, category: "internet",  date: monthAgo(0), recurring: true,  created_at: monthAgo(0) },
  { id: "e4", title: "Adobe Creative Cloud",      description: "5 licenças",              amount:  890, category: "software",  date: monthAgo(0), recurring: true,  created_at: monthAgo(0) },
  { id: "e5", title: "Câmera Sony ZV-E10",        description: "Para produção de vídeos", amount: 4200, category: "equipment", date: monthAgo(1), recurring: false, created_at: monthAgo(1) },
  { id: "e6", title: "Impulsionamento institucional", description: "Meta Ads próprio",    amount:  650, category: "marketing", date: monthAgo(0), recurring: false, created_at: monthAgo(0) },
  { id: "e7", title: "Aluguel do escritório",     description: "Sala comercial",          amount: 3200, category: "rent",      date: monthAgo(1), recurring: true,  created_at: monthAgo(1) },
  { id: "e8", title: "Aluguel do escritório",     description: "Sala comercial",          amount: 3200, category: "rent",      date: monthAgo(2), recurring: true,  created_at: monthAgo(2) },
];

export const mockExtraServices: ExtraService[] = [
  { id: "x1", client_id: "c1", title: "Ensaio fotográfico extra", description: "Sessão lançamento", amount: 2400, date: monthAgo(0), created_at: monthAgo(0) },
  { id: "x2", client_id: "c2", title: "Landing page especial",     description: "Webinar Q3",       amount: 3500, date: monthAgo(1), created_at: monthAgo(1) },
  { id: "x3", client_id: null, title: "Consultoria avulsa",        description: "Auditoria SEO",    amount: 1800, date: monthAgo(2), created_at: monthAgo(2) },
];
