import type { Client, Task, User, Comment, TimeEntry } from "@/types";

export const mockUsers: User[] = [
  { id: "u1", name: "Ana Viana",      email: "ana@versatil.digital",     role: "leader",   password: "lider123" },
  { id: "u2", name: "Ricardo Lima",   email: "ricardo@versatil.digital", role: "employee", password: "func123" },
  { id: "u3", name: "Maria Souza",    email: "maria@versatil.digital",   role: "employee", password: "func123" },
  { id: "u4", name: "Carlos Aguiar",  email: "carlos@versatil.digital",  role: "employee", password: "func123" },
  { id: "u5", name: "Juliana Reis",   email: "juliana@versatil.digital", role: "employee", password: "func123" },
];

export const mockClients: Client[] = [
  { id: "c1", name: "Aurora Cosméticos", company: "Aurora SA", email: "contato@aurora.com", status: "active", created_at: new Date().toISOString() },
  { id: "c2", name: "TechNova", company: "TechNova LTDA", email: "marketing@technova.io", status: "active", created_at: new Date().toISOString() },
  { id: "c3", name: "Verde Bistrô", company: "Verde Bistrô", email: "ola@verdebistro.com", status: "active", created_at: new Date().toISOString() },
  { id: "c4", name: "Studio Pilates", company: "Studio Pilates Zen", email: "contato@studiopilates.com", status: "paused", created_at: new Date().toISOString() },
  { id: "c5", name: "Construtora Horizonte", company: "Horizonte SA", email: "marketing@horizonte.com", status: "active", created_at: new Date().toISOString() },
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

export const mockTimeEntries: TimeEntry[] = [];
