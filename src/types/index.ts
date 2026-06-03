export type Role = "leader" | "manager" | "collaborator" | "commercial";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar_url?: string | null;
  password?: string;
  position?: string;
  salary?: number;
  tax_rate?: number;
  hire_date?: string | null;
  team_id?: string | null;        // legado: time principal
  team_ids?: string[];            // múltiplos times
  is_manager?: boolean;
  phone?: string | null;
  birthdate?: string | null;
  bio?: string | null;
  city?: string | null;
  skills?: string[];
}

export interface Team {
  id: string;
  name: string;
  description?: string | null;
  color?: string;
  manager_id?: string | null;
  cover_url?: string | null;
  member_ids?: string[];
  created_at: string;
}

export interface SatisfactionEntry {
  month: string;        // YYYY-MM
  value: number;        // 0..5
  note?: string | null;
}

export interface Client {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  segment?: string | null;
  monthly_fee?: number;
  contract_start?: string | null;
  contract_end?: string | null;
  contract_months?: number;
  monthly_hours_target?: number;
  satisfaction?: number;
  satisfaction_history?: SatisfactionEntry[];
  health?: "great" | "good" | "warning" | "risk";
  services?: string[];
  notes?: string | null;
  status: "active" | "paused" | "archived";
  created_at: string;
}

export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type RecurrenceMode = "none" | "hourly" | "daily" | "weekly" | "monthly";
export interface Recurrence {
  mode: RecurrenceMode;
  interval?: number;            // a cada N (default 1)
  next_due?: string | null;
  days_of_week?: number[];      // 0=Dom..6=Sáb (weekly)
  days_of_month?: number[];     // 1..31 (monthly)
  times?: string[];             // ["09:00","15:30"]
  end_date?: string | null;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  client_id: string | null;
  assignee_id: string | null;
  created_by?: string | null;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
  total_seconds: number;
  column_id?: string | null;
  recurrence?: Recurrence;
  is_template?: boolean;        // template recorrente, não aparece no Kanban
  template_id?: string | null;  // instância gerada de um template
  last_spawn?: string | null;
}

export interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  seconds: number;
  description?: string | null;
  logged_at: string;
  created_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  accent: string;
  order: number;
  base?: TaskStatus;
}

export type ExpenseCategory = string;  // categorias livres (padrão + customizadas)

export interface Expense {
  id: string;
  title: string;
  description?: string | null;
  amount: number;
  category: ExpenseCategory;
  date: string;
  recurring?: boolean;
  created_at: string;
}

export interface ExtraService {
  id: string;
  client_id?: string | null;
  title: string;
  description?: string | null;
  amount: number;
  date: string;
  created_at: string;
}

export interface TeamNote {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_id: string;
}

export interface FinanceSettings {
  opening_balance: number;
  default_tax_rate: number;
  custom_categories?: { key: string; label: string }[];
}

export interface CashAdjustment {
  id: string;
  amount: number;     // positivo = aporte, negativo = retirada
  reason: string;
  date: string;
  created_at: string;
}