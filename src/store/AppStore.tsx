import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { mockClients, mockComments, mockTasks, mockTimeEntries, mockUsers, mockExpenses, mockExtraServices } from "@/data/mock";
import type {
  Client, Comment, Task, TaskStatus, TimeEntry, User,
  KanbanColumn, Expense, ExtraService, TeamNote, FinanceSettings
} from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationsContext";
import { toast } from "sonner";

interface AppState {
  ready: boolean;
  usingBackend: boolean;
  currentUser: User;
  users: User[];
  clients: Client[];
  tasks: Task[];
  comments: Comment[];
  timeEntries: TimeEntry[];
  columns: KanbanColumn[];
  expenses: Expense[];
  extraServices: ExtraService[];
  teamNotes: TeamNote[];
  financeSettings: FinanceSettings;
  createTask: (t: Partial<Task>) => Promise<void>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  moveTask: (id: string, target: { status?: TaskStatus; column_id?: string | null }) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  createClient: (c: Partial<Client>) => Promise<void>;
  updateClient: (id: string, patch: Partial<Client>) => Promise<void>;
  addComment: (taskId: string, body: string) => Promise<void>;
  logTime: (input: { task_id: string; seconds: number; description?: string; logged_at?: string }) => Promise<void>;
  deleteTimeEntry: (id: string) => Promise<void>;
  createColumn: (title: string) => void;
  renameColumn: (id: string, title: string) => void;
  deleteColumn: (id: string) => void;
  createExpense: (e: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  createExtraService: (s: Partial<ExtraService>) => void;
  deleteExtraService: (id: string) => void;
  addTeamNote: (user_id: string, body: string) => void;
  deleteTeamNote: (id: string) => void;
  updateUser: (id: string, patch: Partial<User>) => void;
  updateFinanceSettings: (patch: Partial<FinanceSettings>) => void;
}

const Ctx = createContext<AppState | null>(null);

function uid() { return Math.random().toString(36).slice(2, 11); }

const LS = {
  columns: "vd:columns",
  expenses: "vd:expenses",
  extraServices: "vd:extra_services",
  teamNotes: "vd:team_notes",
  finance: "vd:finance_settings",
  users: "vd:users",
};

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "todo",        title: "A Fazer",        accent: "bg-muted-foreground", order: 0, base: "todo" },
  { id: "in_progress", title: "Em Andamento",   accent: "bg-primary",          order: 1, base: "in_progress" },
  { id: "review",      title: "Em Revisão",     accent: "bg-warning",          order: 2, base: "review" },
  { id: "done",        title: "Concluído",      accent: "bg-success",          order: 3, base: "done" },
];

function loadLS<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; }
  catch { return fallback; }
}
function saveLS<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { push: pushNotif } = useNotifications();

  const [users, setUsers] = useState<User[]>(() => loadLS<User[]>(LS.users, mockUsers));
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [comments, setComments] = useState<Comment[]>(mockComments);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(mockTimeEntries);
  const [usingBackend, setUsingBackend] = useState(false);
  const [ready, setReady] = useState(false);

  const [columns, setColumns] = useState<KanbanColumn[]>(() => loadLS<KanbanColumn[]>(LS.columns, DEFAULT_COLUMNS));
  const [expenses, setExpenses] = useState<Expense[]>(() => loadLS<Expense[]>(LS.expenses, mockExpenses));
  const [extraServices, setExtraServices] = useState<ExtraService[]>(() => loadLS<ExtraService[]>(LS.extraServices, mockExtraServices));
  const [teamNotes, setTeamNotes] = useState<TeamNote[]>(() => loadLS<TeamNote[]>(LS.teamNotes, []));
  const [financeSettings, setFinanceSettings] = useState<FinanceSettings>(() =>
    loadLS<FinanceSettings>(LS.finance, { opening_balance: 25000, default_tax_rate: 32 })
  );

  useEffect(() => saveLS(LS.columns, columns), [columns]);
  useEffect(() => saveLS(LS.expenses, expenses), [expenses]);
  useEffect(() => saveLS(LS.extraServices, extraServices), [extraServices]);
  useEffect(() => saveLS(LS.teamNotes, teamNotes), [teamNotes]);
  useEffect(() => saveLS(LS.finance, financeSettings), [financeSettings]);
  useEffect(() => saveLS(LS.users, users), [users]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          const [u, c, t, cm] = await Promise.all([
            supabase.from("users").select("*"),
            supabase.from("clients").select("*"),
            supabase.from("tasks").select("*"),
            supabase.from("comments").select("*"),
          ]);
          if (cancelled) return;
          if (!u.error && u.data?.length) setUsers(u.data as User[]);
          if (!c.error && c.data) setClients(c.data as Client[]);
          if (!t.error && t.data) setTasks(t.data as Task[]);
          if (!cm.error && cm.data) setComments(cm.data as Comment[]);
          setUsingBackend(true);
        } catch (e) {
          console.warn("Supabase falhou, usando mocks", e);
        }
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const currentUser = (user ?? users[0])!;

  const createTask = useCallback(async (data: Partial<Task>) => {
    const newTask: Task = {
      id: uid(),
      title: data.title ?? "Nova tarefa",
      description: data.description ?? null,
      status: data.status ?? "todo",
      priority: data.priority ?? "medium",
      client_id: data.client_id ?? null,
      assignee_id: data.assignee_id ?? null,
      due_date: data.due_date ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      total_seconds: 0,
    };
    setTasks((prev) => [newTask, ...prev]);
    if (usingBackend && supabase) await supabase.from("tasks").insert(newTask);
    const assignee = users.find(u => u.id === newTask.assignee_id);
    pushNotif({
      type: "task_created",
      title: "Nova tarefa criada",
      body: `${newTask.title}${assignee ? ` · atribuída a ${assignee.name}` : ""}`,
      user_id: newTask.assignee_id ?? undefined,
    });
    toast.success("Tarefa criada", { description: newTask.title });
  }, [usingBackend, users, pushNotif]);

  const updateTask = useCallback(async (id: string, patch: Partial<Task>) => {
    let prevTask: Task | undefined;
    setTasks((prev) => prev.map((t) => {
      if (t.id === id) { prevTask = t; return { ...t, ...patch, updated_at: new Date().toISOString() }; }
      return t;
    }));
    if (usingBackend && supabase) {
      await supabase.from("tasks").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    }
    if (prevTask) {
      const isStatus = patch.status && patch.status !== prevTask.status;
      pushNotif({
        type: patch.status === "done" ? "task_done" : "task_updated",
        title: patch.status === "done" ? "Tarefa concluída" : "Tarefa atualizada",
        body: `${prevTask.title}${isStatus ? ` → ${labelStatus(patch.status!)}` : ""}`,
        user_id: prevTask.assignee_id ?? undefined,
      });
    }
  }, [usingBackend, pushNotif]);

  const moveTask = useCallback(
    (id: string, target: { status?: TaskStatus; column_id?: string | null }) =>
      updateTask(id, target),
    [updateTask]
  );

  const deleteTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (usingBackend && supabase) await supabase.from("tasks").delete().eq("id", id);
  }, [usingBackend]);

  const createClient = useCallback(async (data: Partial<Client>) => {
    const c: Client = {
      id: uid(),
      name: data.name ?? "Novo cliente",
      company: data.company ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      segment: data.segment ?? null,
      monthly_fee: data.monthly_fee ?? 0,
      contract_start: data.contract_start ?? new Date().toISOString().slice(0,10),
      monthly_hours_target: data.monthly_hours_target ?? 40,
      satisfaction: data.satisfaction ?? 4,
      health: data.health ?? "good",
      services: data.services ?? [],
      notes: data.notes ?? null,
      status: data.status ?? "active",
      created_at: new Date().toISOString(),
    };
    setClients((prev) => [c, ...prev]);
    if (usingBackend && supabase) await supabase.from("clients").insert(c);
    pushNotif({ type: "info", title: "Novo cliente", body: c.name });
    toast.success("Cliente criado", { description: c.name });
  }, [usingBackend, pushNotif]);

  const updateClient = useCallback(async (id: string, patch: Partial<Client>) => {
    setClients((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));
    if (usingBackend && supabase) await supabase.from("clients").update(patch).eq("id", id);
  }, [usingBackend]);

  const addComment = useCallback(async (taskId: string, body: string) => {
    const c: Comment = { id: uid(), task_id: taskId, user_id: currentUser.id, body, created_at: new Date().toISOString() };
    setComments((prev) => [...prev, c]);
    if (usingBackend && supabase) await supabase.from("comments").insert(c);
  }, [currentUser, usingBackend]);

  const logTime = useCallback(async ({ task_id, seconds, description, logged_at }: { task_id: string; seconds: number; description?: string; logged_at?: string }) => {
    if (seconds <= 0) return;
    const entry: TimeEntry = {
      id: uid(), task_id, user_id: currentUser.id, seconds,
      description: description ?? null,
      logged_at: logged_at ?? new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    setTimeEntries((prev) => [entry, ...prev]);
    setTasks((prev) => prev.map((t) => t.id === task_id ? { ...t, total_seconds: t.total_seconds + seconds } : t));
    if (usingBackend && supabase) await supabase.from("time_entries").insert(entry);
    toast.success("Horas lançadas", { description: `${(seconds/3600).toFixed(2)}h registradas` });
  }, [currentUser, usingBackend]);

  const deleteTimeEntry = useCallback(async (id: string) => {
    const entry = timeEntries.find(t => t.id === id);
    if (!entry) return;
    setTimeEntries((prev) => prev.filter(t => t.id !== id));
    setTasks((prev) => prev.map((t) => t.id === entry.task_id ? { ...t, total_seconds: Math.max(0, t.total_seconds - entry.seconds) } : t));
    if (usingBackend && supabase) await supabase.from("time_entries").delete().eq("id", id);
  }, [timeEntries, usingBackend]);

  // ---------- Colunas dinâmicas (líder) ----------
  const createColumn = useCallback((title: string) => {
    setColumns(prev => {
      const order = (prev[prev.length - 1]?.order ?? 0) + 1;
      const accents = ["bg-accent","bg-primary","bg-warning","bg-success","bg-destructive"];
      const accent = accents[prev.length % accents.length];
      return [...prev, { id: uid(), title, accent, order }];
    });
    toast.success("Coluna criada", { description: title });
  }, []);
  const renameColumn = useCallback((id: string, title: string) => {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, title } : c));
  }, []);
  const deleteColumn = useCallback((id: string) => {
    const col = columns.find(c => c.id === id);
    if (!col || col.base) return;
    setColumns(prev => prev.filter(c => c.id !== id));
    // Tarefas que pertenciam a essa coluna voltam para "todo"
    setTasks(prev => prev.map(t => t.column_id === id ? { ...t, column_id: null, status: "todo" } : t));
    toast.success("Coluna removida");
  }, [columns]);

  // ---------- Finanças ----------
  const createExpense = useCallback((e: Partial<Expense>) => {
    const item: Expense = {
      id: uid(),
      title: e.title ?? "Despesa",
      description: e.description ?? null,
      amount: e.amount ?? 0,
      category: e.category ?? "other",
      date: e.date ?? new Date().toISOString().slice(0,10),
      recurring: e.recurring ?? false,
      created_at: new Date().toISOString(),
    };
    setExpenses(prev => [item, ...prev]);
    toast.success("Despesa lançada", { description: item.title });
  }, []);
  const deleteExpense = useCallback((id: string) => setExpenses(prev => prev.filter(e => e.id !== id)), []);

  const createExtraService = useCallback((s: Partial<ExtraService>) => {
    const item: ExtraService = {
      id: uid(),
      client_id: s.client_id ?? null,
      title: s.title ?? "Serviço avulso",
      description: s.description ?? null,
      amount: s.amount ?? 0,
      date: s.date ?? new Date().toISOString().slice(0,10),
      created_at: new Date().toISOString(),
    };
    setExtraServices(prev => [item, ...prev]);
    toast.success("Serviço avulso lançado", { description: item.title });
  }, []);
  const deleteExtraService = useCallback((id: string) => setExtraServices(prev => prev.filter(s => s.id !== id)), []);

  // ---------- Notas da equipe ----------
  const addTeamNote = useCallback((user_id: string, body: string) => {
    const n: TeamNote = { id: uid(), user_id, body, created_at: new Date().toISOString(), author_id: currentUser.id };
    setTeamNotes(prev => [n, ...prev]);
  }, [currentUser]);
  const deleteTeamNote = useCallback((id: string) => setTeamNotes(prev => prev.filter(n => n.id !== id)), []);

  const updateUser = useCallback((id: string, patch: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
  }, []);

  const updateFinanceSettings = useCallback((patch: Partial<FinanceSettings>) => {
    setFinanceSettings(prev => ({ ...prev, ...patch }));
  }, []);

  const value: AppState = {
    ready, usingBackend, currentUser, users, clients, tasks, comments, timeEntries,
    columns, expenses, extraServices, teamNotes, financeSettings,
    createTask, updateTask, moveTask, deleteTask, createClient, updateClient, addComment, logTime, deleteTimeEntry,
    createColumn, renameColumn, deleteColumn,
    createExpense, deleteExpense, createExtraService, deleteExtraService,
    addTeamNote, deleteTeamNote, updateUser, updateFinanceSettings,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function labelStatus(s: TaskStatus) {
  return s === "todo" ? "A Fazer" : s === "in_progress" ? "Em Andamento" : s === "review" ? "Em Revisão" : "Concluído";
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppStoreProvider");
  return ctx;
}
