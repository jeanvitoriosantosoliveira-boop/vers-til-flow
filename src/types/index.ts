export type Role = "leader" | "employee";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar_url?: string | null;
  password?: string; // mock-only
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