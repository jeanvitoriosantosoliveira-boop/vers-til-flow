export type Role = "leader" | "employee";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar_url?: string | null;
  password?: string; // mock-only
  position?: string;          // ex: "Gestor de Tráfego"
  salary?: number;            // R$ bruto/mês
  tax_rate?: number;          // % de imposto/encargos sobre salário
  hire_date?: string | null;
}

export interface Client {
  id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  segment?: string | null;            // setor/segmento
  monthly_fee?: number;               // mensalidade (R$)
  contract_start?: string | null;
  monthly_hours_target?: number;      // meta de horas/mês para esse cliente
  satisfaction?: number;              // 0..5
  health?: "great" | "good" | "warning" | "risk";
  services?: string[];                // ex: ["SEO","Tráfego pago","Conteúdo"]
  notes?: string | null;
  status: "active" | "paused" | "archived";
  created_at: string;
}

export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  client_id: string | null;
  assignee_id: string | null;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
  total_seconds: number;
  /** Quando definido, a tarefa é exibida nesta coluna customizada (apenas líder). */
  column_id?: string | null;
}

export interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  seconds: number;
  description?: string | null;
  logged_at: string;       // data do trabalho
  created_at: string;      // data do registro
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
  accent: string;          // tailwind bg-* token
  order: number;
  /** Colunas base (todo, in_progress, review, done) não podem ser excluídas. */
  base?: TaskStatus;
}

export type ExpenseCategory =
  | "rent" | "utilities" | "internet" | "equipment" | "software"
  | "marketing" | "tax" | "other";

export interface Expense {
  id: string;
  title: string;
  description?: string | null;
  amount: number;
  category: ExpenseCategory;
  date: string;             // YYYY-MM-DD
  recurring?: boolean;      // se true, repete todo mês
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
  user_id: string;          // funcionário
  body: string;
  created_at: string;
  author_id: string;        // líder que escreveu
}

export interface FinanceSettings {
  opening_balance: number;  // caixa inicial
  default_tax_rate: number; // % padrão sobre folha
}