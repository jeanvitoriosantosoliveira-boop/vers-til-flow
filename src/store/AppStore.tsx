import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { mockClients, mockComments, mockTasks, mockTimeEntries, mockUsers, mockExpenses, mockExtraServices, mockTeams } from "@/data/mock";
import type {
  Client, Comment, Task, TaskStatus, TimeEntry, User,
  KanbanColumn, Expense, ExtraService, TeamNote, FinanceSettings, Team, CashAdjustment
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
  teams: Team[];
  cashAdjustments: CashAdjustment[];
  createTask: (t: Partial<Task>) => Promise<void>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  moveTask: (id: string, target: { status?: TaskStatus; column_id?: string | null }) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  createClient: (c: Partial<Client>) => Promise<void>;
  updateClient: (id: string, patch: Partial<Client>) => Promise<void>;
  setClientSatisfaction: (id: string, value: number, note?: string) => void;
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
  addCustomCategory: (label: string) => string;
  createTeam: (t: Partial<Team>) => void;
  updateTeam: (id: string, patch: Partial<Team>) => void;
  deleteTeam: (id: string) => void;
  addUserToTeam: (userId: string, teamId: string) => void;
  removeUserFromTeam: (userId: string, teamId: string) => void;
  addCashAdjustment: (a: Partial<CashAdjustment>) => void;
  deleteCashAdjustment: (id: string) => void;
  visibleTaskIds: () => Set<string>;
}

const Ctx = createContext<AppState | null>(null);

function uid() { return Math.random().toString(36).slice(2, 11); }

const LS = {
  columns: "vd:columns",
  expenses: "vd:expenses",
  extraServices: "vd:extra_services",
  teamNotes: "vd:team_notes",
  finance: "vd:finance_settings",
  users: "vd:users_v3",
  teams: "vd:teams",
  cash: "vd:cash_adjustments",
  clients: "vd:clients_v2",
  tasks: "vd:tasks_v2",
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
  const [clients, setClients] = useState<Client[]>(() => loadLS<Client[]>(LS.clients, mockClients));
  const [tasks, setTasks] = useState<Task[]>(() => loadLS<Task[]>(LS.tasks, mockTasks));
  const [comments, setComments] = useState<Comment[]>(mockComments);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(mockTimeEntries);
  const [usingBackend, setUsingBackend] = useState(false);
  const [ready, setReady] = useState(false);

  const [columns, setColumns] = useState<KanbanColumn[]>(() => loadLS<KanbanColumn[]>(LS.columns, DEFAULT_COLUMNS));
  const [expenses, setExpenses] = useState<Expense[]>(() => loadLS<Expense[]>(LS.expenses, mockExpenses));
  const [extraServices, setExtraServices] = useState<ExtraService[]>(() => loadLS<ExtraService[]>(LS.extraServices, mockExtraServices));
  const [teamNotes, setTeamNotes] = useState<TeamNote[]>(() => loadLS<TeamNote[]>(LS.teamNotes, []));
  const [financeSettings, setFinanceSettings] = useState<FinanceSettings>(() =>
    loadLS<FinanceSettings>(LS.finance, { opening_balance: 25000, default_tax_rate: 32, custom_categories: [] })
  );
  const [teams, setTeams] = useState<Team[]>(() => loadLS<Team[]>(LS.teams, mockTeams));
  const [cashAdjustments, setCashAdjustments] = useState<CashAdjustment[]>(() => loadLS<CashAdjustment[]>(LS.cash, []));

  useEffect(() => saveLS(LS.columns, columns), [columns]);
  useEffect(() => saveLS(LS.expenses, expenses), [expenses]);
  useEffect(() => saveLS(LS.extraServices, extraServices), [extraServices]);
  useEffect(() => saveLS(LS.teamNotes, teamNotes), [teamNotes]);
  useEffect(() => saveLS(LS.finance, financeSettings), [financeSettings]);
  useEffect(() => saveLS(LS.users, users), [users]);
  useEffect(() => saveLS(LS.teams, teams), [teams]);
  useEffect(() => saveLS(LS.cash, cashAdjustments), [cashAdjustments]);
  useEffect(() => saveLS(LS.clients, clients), [clients]);
  useEffect(() => saveLS(LS.tasks, tasks), [tasks]);

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

  const authUser = (user ?? users[0])!;
  const currentUser = users.find(u => u.id === authUser.id) ?? authUser;

  const createTask = useCallback(async (data: Partial<Task>) => {
    const newTask: Task = {
      id: uid(),
      title: data.title ?? "Nova tarefa",
      description: data.description ?? null,
      status: data.status ?? "todo",
      priority: data.priority ?? "medium",
      client_id: data.client_id ?? null,
      assignee_id: data.assignee_id ?? null,
      created_by: data.created_by ?? currentUser.id,
      due_date: data.due_date ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      total_seconds: 0,
      column_id: data.column_id ?? null,
      recurrence: data.recurrence ?? { mode: "none" },
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
  }, [usingBackend, users, pushNotif, currentUser]);

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
      // ----- Recorrência: ao concluir uma tarefa recorrente, agenda a próxima -----
      if (patch.status === "done" && prevTask.status !== "done" && prevTask.recurrence && prevTask.recurrence.mode !== "none") {
        const r = prevTask.recurrence;
        const interval = r.interval ?? 1;
        const base = prevTask.due_date ? new Date(prevTask.due_date) : new Date();
        const next = new Date(base);
        if (r.mode === "hourly")  next.setHours(next.getHours() + interval);
        if (r.mode === "daily")   next.setDate(next.getDate() + interval);
        if (r.mode === "weekly")  next.setDate(next.getDate() + 7 * interval);
        if (r.mode === "monthly") next.setMonth(next.getMonth() + interval);
        const nt: Task = {
          ...prevTask,
          id: uid(),
          status: "todo",
          column_id: null,
          total_seconds: 0,
          due_date: next.toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          recurrence: prevTask.recurrence,
        };
        setTasks(prev => [nt, ...prev]);
        pushNotif({
          type: "task_created",
          title: "Próxima ocorrência agendada",
          body: `${nt.title} → ${next.toLocaleDateString("pt-BR")}`,
          user_id: nt.assignee_id ?? undefined,
        });
      }
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

  // ---------- Teams ----------
  const createTeam = useCallback((t: Partial<Team>) => {
    const item: Team = {
      id: uid(),
      name: t.name ?? "Novo time",
      description: t.description ?? null,
      color: t.color ?? "bg-primary",
      manager_id: t.manager_id ?? null,
      created_at: new Date().toISOString(),
    };
    setTeams(prev => [item, ...prev]);
    toast.success("Time criado", { description: item.name });
  }, []);
  const updateTeam = useCallback((id: string, patch: Partial<Team>) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);
  const deleteTeam = useCallback((id: string) => {
    setTeams(prev => prev.filter(t => t.id !== id));
    setUsers(prev => prev.map(u => u.team_id === id ? { ...u, team_id: null, is_manager: false } : u));
  }, []);

  const addUserToTeam = useCallback((userId: string, teamId: string) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, member_ids: Array.from(new Set([...(t.member_ids ?? []), userId])) } : t));
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, team_ids: Array.from(new Set([...(u.team_ids ?? (u.team_id ? [u.team_id] : [])), teamId])), team_id: u.team_id ?? teamId } : u));
  }, []);
  const removeUserFromTeam = useCallback((userId: string, teamId: string) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, member_ids: (t.member_ids ?? []).filter(x => x !== userId) } : t));
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      const next = (u.team_ids ?? (u.team_id ? [u.team_id] : [])).filter(x => x !== teamId);
      return { ...u, team_ids: next, team_id: u.team_id === teamId ? (next[0] ?? null) : u.team_id, is_manager: u.team_id === teamId ? false : u.is_manager };
    }));
  }, []);

  const setClientSatisfaction = useCallback((id: string, value: number, note?: string) => {
    const monthKey = new Date().toISOString().slice(0,7);
    setClients(prev => prev.map(c => {
      if (c.id !== id) return c;
      const hist = (c.satisfaction_history ?? []).filter(h => h.month !== monthKey);
      return { ...c, satisfaction: value, satisfaction_history: [...hist, { month: monthKey, value, note }].sort((a,b) => a.month.localeCompare(b.month)) };
    }));
    toast.success("Satisfação atualizada", { description: `${value.toFixed(1)} / 5` });
  }, []);

  const addCustomCategory = useCallback((label: string) => {
    const key = "cat_" + label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 20) + "_" + uid().slice(0, 4);
    setFinanceSettings(prev => ({ ...prev, custom_categories: [...(prev.custom_categories ?? []), { key, label }] }));
    return key;
  }, []);

  const addCashAdjustment = useCallback((a: Partial<CashAdjustment>) => {
    const item: CashAdjustment = {
      id: uid(),
      amount: a.amount ?? 0,
      reason: a.reason ?? "Ajuste de caixa",
      date: a.date ?? new Date().toISOString().slice(0,10),
      created_at: new Date().toISOString(),
    };
    setCashAdjustments(prev => [item, ...prev]);
    toast.success("Ajuste de caixa lançado");
  }, []);
  const deleteCashAdjustment = useCallback((id: string) => setCashAdjustments(prev => prev.filter(c => c.id !== id)), []);

  // ---------- Visibilidade hierárquica ----------
  const visibleTaskIds = useCallback(() => {
    if (currentUser.role === "leader") return new Set(tasks.map(t => t.id));
    const ids = new Set<string>();
    // próprias
    tasks.forEach(t => { if (t.assignee_id === currentUser.id || t.created_by === currentUser.id) ids.add(t.id); });
    // se gerente, vê dos times onde gerencia
    if (currentUser.is_manager) {
      const myTeamIds = currentUser.team_ids ?? (currentUser.team_id ? [currentUser.team_id] : []);
      const myTeams = teams.filter(tm => myTeamIds.includes(tm.id) && tm.manager_id === currentUser.id);
      const subordinateIds = new Set<string>();
      myTeams.forEach(tm => (tm.member_ids ?? []).forEach(uid => subordinateIds.add(uid)));
      users.forEach(u => {
        const utIds = u.team_ids ?? (u.team_id ? [u.team_id] : []);
        if (utIds.some(t => myTeams.find(mt => mt.id === t))) subordinateIds.add(u.id);
      });
      tasks.forEach(t => { if (t.assignee_id && subordinateIds.has(t.assignee_id)) ids.add(t.id); });
    }
    return ids;
  }, [currentUser, tasks, teams, users]);

  // ---------- Scheduler de recorrência ----------
  useEffect(() => {
    function spawnDueOccurrences() {
      const now = new Date();
      let spawned: Task[] = [];
      tasks.filter(t => t.is_template && t.recurrence && t.recurrence.mode !== "none").forEach(tpl => {
        const occ = computeNextOccurrences(tpl, now);
        occ.forEach(date => {
          const sig = `${tpl.id}__${date.toISOString()}`;
          // evita duplicar instâncias já criadas
          const exists = tasks.some(x => x.template_id === tpl.id && x.due_date && Math.abs(new Date(x.due_date).getTime() - date.getTime()) < 60_000);
          if (exists) return;
          spawned.push({
            ...tpl,
            id: uid(),
            is_template: false,
            template_id: tpl.id,
            status: "todo",
            column_id: null,
            total_seconds: 0,
            due_date: date.toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_spawn: null,
          });
        });
      });
      if (spawned.length) {
        setTasks(prev => [...spawned, ...prev]);
        spawned.forEach(s => pushNotif({ type: "task_created", title: "Tarefa recorrente agendada", body: `${s.title} · ${new Date(s.due_date!).toLocaleString("pt-BR")}`, user_id: s.assignee_id ?? undefined }));
      }
    }
    spawnDueOccurrences();
    const id = window.setInterval(spawnDueOccurrences, 60_000);
    return () => window.clearInterval(id);
  }, [tasks, pushNotif]);

  const value: AppState = {
    ready, usingBackend, currentUser, users, clients, tasks, comments, timeEntries,
    columns, expenses, extraServices, teamNotes, financeSettings, teams, cashAdjustments,
    createTask, updateTask, moveTask, deleteTask, createClient, updateClient, setClientSatisfaction,
    addComment, logTime, deleteTimeEntry,
    createColumn, renameColumn, deleteColumn,
    createExpense, deleteExpense, createExtraService, deleteExtraService,
    addTeamNote, deleteTeamNote, updateUser, updateFinanceSettings, addCustomCategory,
    createTeam, updateTeam, deleteTeam, addUserToTeam, removeUserFromTeam,
    addCashAdjustment, deleteCashAdjustment, visibleTaskIds,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function labelStatus(s: TaskStatus) {
  return s === "todo" ? "A Fazer" : s === "in_progress" ? "Em Andamento" : s === "review" ? "Em Revisão" : "Concluído";
}

// ---------- Recorrência: cálculo de próximas ocorrências ----------
function computeNextOccurrences(tpl: Task, now: Date): Date[] {
  const r = tpl.recurrence;
  if (!r || r.mode === "none") return [];
  const out: Date[] = [];
  const interval = Math.max(1, r.interval ?? 1);
  const times = (r.times && r.times.length ? r.times : ["09:00"]).map(s => {
    const [hh, mm] = s.split(":").map(Number);
    return { hh: hh || 0, mm: mm || 0 };
  });
  const endDate = r.end_date ? new Date(r.end_date) : null;

  // Janela: do horário do template até "agora" (gera tudo que já deveria ter sido criado)
  const start = tpl.last_spawn ? new Date(tpl.last_spawn) : (tpl.due_date ? new Date(tpl.due_date) : new Date(tpl.created_at));
  // Limite: no máx 31 dias à frente OU 50 ocorrências por scan
  const horizon = new Date(now.getTime() + 31 * 86400000);
  const limit = endDate && endDate < horizon ? endDate : horizon;

  if (r.mode === "hourly") {
    let d = new Date(start);
    while (d <= limit && out.length < 50) {
      d = new Date(d.getTime() + interval * 3600 * 1000);
      if (d <= now) out.push(new Date(d));
    }
  } else if (r.mode === "daily") {
    const cursor = new Date(start); cursor.setHours(0,0,0,0);
    while (cursor <= limit && out.length < 50) {
      times.forEach(t => {
        const occ = new Date(cursor); occ.setHours(t.hh, t.mm, 0, 0);
        if (occ > start && occ <= now) out.push(occ);
      });
      cursor.setDate(cursor.getDate() + interval);
    }
  } else if (r.mode === "weekly") {
    const days = (r.days_of_week && r.days_of_week.length ? r.days_of_week : [new Date(start).getDay()]);
    const cursor = new Date(start); cursor.setHours(0,0,0,0);
    while (cursor <= limit && out.length < 50) {
      if (days.includes(cursor.getDay())) {
        times.forEach(t => {
          const occ = new Date(cursor); occ.setHours(t.hh, t.mm, 0, 0);
          if (occ > start && occ <= now) out.push(occ);
        });
      }
      cursor.setDate(cursor.getDate() + 1);
      // pula intervalos de N semanas
      const weeksDelta = Math.floor((cursor.getTime() - new Date(start).setHours(0,0,0,0)) / (7 * 86400000));
      if (weeksDelta % interval !== 0) cursor.setDate(cursor.getDate() + 6);
    }
  } else if (r.mode === "monthly") {
    const days = (r.days_of_month && r.days_of_month.length ? r.days_of_month : [new Date(start).getDate()]);
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= limit && out.length < 50) {
      days.forEach(dom => {
        times.forEach(t => {
          const occ = new Date(cursor.getFullYear(), cursor.getMonth(), dom, t.hh, t.mm);
          if (occ > start && occ <= now) out.push(occ);
        });
      });
      cursor.setMonth(cursor.getMonth() + interval);
    }
  }

  // Marca last_spawn
  if (out.length) tpl.last_spawn = now.toISOString();
  return out;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppStoreProvider");
  return ctx;
}
