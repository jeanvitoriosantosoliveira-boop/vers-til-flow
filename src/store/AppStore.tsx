import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase as _supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { mockUsers, mockExpenses, mockExtraServices, mockTeams } from "@/data/mock";
import type {
  Client, Comment, Task, TaskStatus, TimeEntry, User, Role,
  KanbanColumn, Expense, ExtraService, TeamNote, FinanceSettings, Team, CashAdjustment
} from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationsContext";
import { toast } from "sonner";

// Sempre usa o cliente direto — nunca null
const db = _supabase;

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
  deleteClient: (id: string) => Promise<void>;
  setClientSatisfaction: (id: string, value: number, note?: string) => Promise<void>;
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

function uid() {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 11);
}

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

function mapRole(role?: string | null): Role {
  if (role === "leader" || role === "manager" || role === "commercial") return role;
  return "collaborator";
}

function mapUser(profile: any, roles: any[], members: any[]): User {
  const roleList = roles.filter((r) => r.user_id === profile.id).map((r) => r.role);
  const role = roleList.includes("leader")
    ? "leader"
    : roleList.includes("manager")
    ? "manager"
    : roleList.includes("commercial")
    ? "commercial"
    : "collaborator";
  const memberships = members.filter((m) => m.user_id === profile.id);
  const teamIds = memberships.map((m) => m.team_id);

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: mapRole(role),
    avatar_url: profile.avatar_url ?? null,
    position: profile.position ?? null,
    salary: profile.salary ?? undefined,
    tax_rate: profile.tax_rate ?? undefined,
    hire_date: profile.hire_date ?? profile.contract_start ?? null,
    team_id: teamIds[0] ?? null,
    team_ids: teamIds,
    is_manager: role === "leader" || role === "manager" || memberships.some((m) => m.role_in_team === "manager"),
    phone: profile.phone ?? null,
    birthdate: profile.birth_date ?? null,
    bio: profile.bio ?? null,
    city: profile.city ?? null,
    skills: profile.skills ?? [],
  };
}

function mapClient(row: any): Client {
  return {
    ...row,
    monthly_fee: Number(row.monthly_value ?? row.monthly_fee ?? 0),
    monthly_hours_target: row.monthly_hours_target ?? 40,
    services: row.services ?? [],
    health: row.health ?? "good",
  };
}

function clientToDb(data: Partial<Client>) {
  const { monthly_fee, satisfaction_history, ...rest } = data;
  return {
    ...rest,
    monthly_value: monthly_fee,
  } as any;
}

function mapTask(row: any): Task {
  return {
    ...row,
    recurrence: row.recurrence ?? { mode: "none" },
    column_id: row.column_id ?? null,
    is_template: row.is_template ?? false,
    template_id: row.template_id ?? null,
    last_spawn: row.last_spawn ?? null,
  };
}

function taskToDb(data: Partial<Task>) {
  // Remove campos undefined (Supabase ignora undefined, mas null é enviado explicitamente)
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as any;
}

function mapTimeEntry(row: any): TimeEntry {
  return {
    ...row,
    logged_at: row.started_at ?? row.logged_at ?? row.created_at,
    description: row.description ?? null,
    created_at: row.created_at ?? row.started_at,
  };
}

function timeEntryToDb(entry: TimeEntry) {
  return {
    id: entry.id,
    task_id: entry.task_id,
    user_id: entry.user_id,
    started_at: entry.logged_at,
    ended_at: entry.logged_at,
    seconds: entry.seconds,
    description: entry.description ?? null,
  } as any;
}

function mapTeam(row: any, members: any[]): Team {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    color: row.color ?? "#6366f1",
    manager_id: row.leader_id ?? null,
    member_ids: members.filter((m) => m.team_id === row.id).map((m) => m.user_id),
    created_at: row.created_at,
  };
}

function teamToDb(team: Partial<Team>) {
  return {
    id: team.id,
    name: team.name,
    description: team.description ?? null,
    color: team.color,
    leader_id: team.manager_id ?? null,
    created_at: team.created_at,
  } as any;
}

function mapExpense(row: any): Expense {
  return {
    id: row.id,
    title: row.title ?? row.category,
    description: row.description ?? null,
    amount: Number(row.amount ?? 0),
    category: row.category,
    date: row.occurred_on,
    recurring: row.recurring ?? false,
    created_at: row.created_at,
  };
}

function expenseToDb(expense: Partial<Expense>, userId?: string) {
  return {
    id: expense.id,
    title: expense.title,
    description: expense.description ?? null,
    amount: expense.amount ?? 0,
    category: expense.category ?? "other",
    occurred_on: expense.date,
    recurring: expense.recurring ?? false,
    created_by: userId,
    created_at: expense.created_at,
  } as any;
}

function mapExtraService(row: any): ExtraService {
  return {
    id: row.id,
    client_id: row.client_id ?? null,
    title: row.title,
    description: row.description ?? null,
    amount: Number(row.amount ?? 0),
    date: row.occurred_on,
    created_at: row.created_at,
  };
}

function extraServiceToDb(service: Partial<ExtraService>, userId?: string) {
  return {
    id: service.id,
    client_id: service.client_id ?? null,
    title: service.title,
    description: service.description ?? null,
    amount: service.amount ?? 0,
    occurred_on: service.date,
    created_by: userId,
    created_at: service.created_at,
  } as any;
}

function mapCashAdjustment(row: any): CashAdjustment {
  const amount = Number(row.amount ?? 0);
  return {
    id: row.id,
    amount: row.kind === "out" ? -Math.abs(amount) : Math.abs(amount),
    reason: row.description ?? "Ajuste de caixa",
    date: row.occurred_on,
    created_at: row.created_at,
  };
}

function cashAdjustmentToDb(adjustment: Partial<CashAdjustment>, userId?: string) {
  const amount = adjustment.amount ?? 0;
  return {
    id: adjustment.id,
    amount: Math.abs(amount),
    kind: amount < 0 ? "out" : "in",
    occurred_on: adjustment.date,
    description: adjustment.reason ?? null,
    created_by: userId,
    created_at: adjustment.created_at,
  } as any;
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { push: pushNotif } = useNotifications();

  const [users, setUsers] = useState<User[]>(() => loadLS<User[]>(LS.users, mockUsers));
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [usingBackend, setUsingBackend] = useState(false);
  const [ready, setReady] = useState(false);

  // Limpa LS antigo de tasks/clients quando Supabase está configurado
  useEffect(() => {
    if (isSupabaseConfigured) {
      localStorage.removeItem(LS.tasks);
      localStorage.removeItem(LS.clients);
    }
  }, []);

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
  // Só persiste tasks/clients no LS quando não tem Supabase (modo demo)
  useEffect(() => { if (!isSupabaseConfigured) saveLS(LS.clients, clients); }, [clients]);
  useEffect(() => { if (!isSupabaseConfigured) saveLS(LS.tasks, tasks); }, [tasks]);

  useEffect(() => {
    // Só carrega quando há usuário autenticado
    if (!user?.id) {
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [
          profilesRes, rolesRes, teamsRes, membersRes, clientsRes, tasksRes,
          commentsRes, timeRes, columnsRes, expensesRes, extraServicesRes,
          teamNotesRes, cashRes, financeRes,
        ] = await Promise.all([
          db.from("profiles").select("*").order("name"),
          db.from("user_roles").select("user_id,role"),
          db.from("teams").select("*").order("name"),
          db.from("team_members").select("*"),
          db.from("clients").select("*").order("created_at", { ascending: false }),
          db.from("tasks").select("*").order("created_at", { ascending: false }),
          db.from("comments").select("*").order("created_at"),
          db.from("time_entries").select("*").order("started_at", { ascending: false }),
          db.from("kanban_columns").select("*").order("order"),
          db.from("expenses").select("*").order("occurred_on", { ascending: false }),
          db.from("extra_services").select("*").order("occurred_on", { ascending: false }),
          db.from("team_notes").select("*").order("created_at", { ascending: false }),
          db.from("cash_adjustments").select("*").order("occurred_on", { ascending: false }),
          db.from("finance_settings").select("*"),
        ]);
        if (cancelled) return;

        const roles = rolesRes.data ?? [];
        const members = membersRes.data ?? [];
        if (!profilesRes.error && profilesRes.data) setUsers(profilesRes.data.map((p) => mapUser(p, roles, members)));
        if (!teamsRes.error && teamsRes.data) setTeams(teamsRes.data.map((tm) => mapTeam(tm, members)));
        if (!clientsRes.error && clientsRes.data) setClients(clientsRes.data.map(mapClient));
        if (!tasksRes.error && tasksRes.data) setTasks(tasksRes.data.map(mapTask));
        if (!commentsRes.error && commentsRes.data) setComments(commentsRes.data as Comment[]);
        if (!timeRes.error && timeRes.data) setTimeEntries(timeRes.data.map(mapTimeEntry));
        if (!columnsRes.error && columnsRes.data) setColumns(columnsRes.data.length ? columnsRes.data as KanbanColumn[] : DEFAULT_COLUMNS);
        if (!expensesRes.error && expensesRes.data) setExpenses(expensesRes.data.map(mapExpense));
        if (!extraServicesRes.error && extraServicesRes.data) setExtraServices(extraServicesRes.data.map(mapExtraService));
        if (!teamNotesRes.error && teamNotesRes.data) setTeamNotes(teamNotesRes.data as TeamNote[]);
        if (!cashRes.error && cashRes.data) setCashAdjustments(cashRes.data.map(mapCashAdjustment));
        if (!financeRes.error && financeRes.data) {
          const settings = financeRes.data.reduce((acc: FinanceSettings, row: any) => ({ ...acc, [row.key]: row.value }), {
            opening_balance: 25000, default_tax_rate: 32, custom_categories: [],
          });
          setFinanceSettings(settings);
        }
        setUsingBackend(true);
      } catch (e) {
        console.warn("Falha ao carregar dados do Supabase:", e);
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const upsert = <T extends { id: string }>(items: T[], item: T) => {
      const next = items.some((x) => x.id === item.id)
        ? items.map((x) => x.id === item.id ? item : x)
        : [item, ...items];
      return [...new Map(next.map((x) => [x.id, x])).values()];
    };
    const remove = <T extends { id: string }>(items: T[], id: string) => items.filter((x) => x.id !== id);

    const channel = db
      .channel("app-store-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        const row = payload.new ? mapTask(payload.new) : null;
        if (payload.eventType === "DELETE") setTasks((prev) => remove(prev, (payload.old as any).id));
        else if (row) setTasks((prev) => upsert(prev, row));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, (payload) => {
        const row = payload.new ? mapClient(payload.new) : null;
        if (payload.eventType === "DELETE") setClients((prev) => remove(prev, (payload.old as any).id));
        else if (row) setClients((prev) => upsert(prev, row));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, (payload) => {
        if (payload.eventType === "DELETE") setComments((prev) => remove(prev, (payload.old as any).id));
        else if (payload.new) setComments((prev) => upsert(prev, payload.new as Comment));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "time_entries" }, (payload) => {
        const row = payload.new ? mapTimeEntry(payload.new) : null;
        if (payload.eventType === "DELETE") setTimeEntries((prev) => remove(prev, (payload.old as any).id));
        else if (row) setTimeEntries((prev) => upsert(prev, row));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_columns" }, (payload) => {
        if (payload.eventType === "DELETE") setColumns((prev) => remove(prev, (payload.old as any).id));
        else if (payload.new) setColumns((prev) => upsert(prev, payload.new as KanbanColumn).sort((a, b) => a.order - b.order));
      })
      .subscribe();

    return () => { db.removeChannel(channel); };
  }, [user?.id]);

  const authUserId = user?.id ?? users[0]?.id;
  const fromList = users.find(u => u.id === authUserId);
  const currentUser: User = fromList ?? (user
    ? {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar_url: user.avatar_url ?? null,
        is_manager: user.is_manager,
        team_ids: [],
        team_id: null,
      } as any
    : users[0]);

  const notifyUser = useCallback(async (input: { type: "task_created" | "task_updated" | "task_done" | "info"; title: string; body?: string; user_id?: string | null }) => {
    if (!input.user_id) return;
    pushNotif({ ...input, user_id: input.user_id });
    if (true) {
      await db.from("notifications").insert({
        user_id: input.user_id,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
      } as any);
    }
  }, [pushNotif, usingBackend]);

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
    const { data: inserted, error } = await db.from("tasks").insert(taskToDb(newTask)).select().single();
    if (error) {
      toast.error("Erro ao criar tarefa: " + error.message);
      throw error;
    }
    setTasks((prev) => [mapTask(inserted), ...prev]);
    const assignee = users.find(u => u.id === newTask.assignee_id);
    await notifyUser({
      type: "task_created",
      title: "Nova tarefa criada",
      body: `${newTask.title}${assignee ? ` · atribuída a ${assignee.name}` : ""}`,
      user_id: newTask.assignee_id ?? undefined,
    });
    toast.success("Tarefa criada", { description: newTask.title });
  }, [users, notifyUser, currentUser]);

  const updateTask = useCallback(async (id: string, patch: Partial<Task>) => {
    let prevTask: Task | undefined;
    const updatedAt = new Date().toISOString();
    setTasks((prev) => prev.map((t) => {
      if (t.id === id) { prevTask = t; return { ...t, ...patch, updated_at: updatedAt }; }
      return t;
    }));
    const { data: savedTask, error } = await db
      .from("tasks")
      .update(taskToDb({ ...patch, updated_at: updatedAt }))
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) {
      if (prevTask) setTasks((prev) => prev.map((t) => t.id === id ? prevTask! : t));
      toast.error("Erro ao atualizar tarefa: " + error.message);
      throw error;
    }
    if (savedTask) setTasks((prev) => prev.map((t) => t.id === id ? mapTask(savedTask) : t));
    if (prevTask) {
      const isStatus = patch.status && patch.status !== prevTask.status;
      void notifyUser({
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
        void notifyUser({
          type: "task_created",
          title: "Próxima ocorrência agendada",
          body: `${nt.title} → ${next.toLocaleDateString("pt-BR")}`,
          user_id: nt.assignee_id ?? undefined,
        });
      }
    }
  }, [notifyUser]);

  const moveTask = useCallback(
    (id: string, target: { status?: TaskStatus; column_id?: string | null }) =>
      updateTask(id, target),
    [updateTask]
  );

  const deleteTask = useCallback(async (id: string) => {
    const previous = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    const { error } = await db.from("tasks").delete().eq("id", id);
    if (error) {
      if (previous) setTasks((prev) => [previous, ...prev]);
      toast.error("Erro ao excluir tarefa: " + error.message);
      throw error;
    }
  }, [tasks]);

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
    await db.from("clients").insert(clientToDb(c));
    toast.success("Cliente criado", { description: c.name });
  }, [pushNotif]);

  const updateClient = useCallback(async (id: string, patch: Partial<Client>) => {
    setClients((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));
    await db.from("clients").update(clientToDb(patch)).eq("id", id);
  }, []);

  const deleteClient = useCallback(async (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    await db.from("clients").delete().eq("id", id);
    toast.success("Cliente excluído");
  }, []);

  const addComment = useCallback(async (taskId: string, body: string) => {
    const c: Comment = { id: uid(), task_id: taskId, user_id: currentUser.id, body, created_at: new Date().toISOString() };
    setComments((prev) => [...prev, c]);
    await db.from("comments").insert(c as any);
  }, [currentUser]);

  const logTime = useCallback(async ({ task_id, seconds, description, logged_at }: { task_id: string; seconds: number; description?: string; logged_at?: string }) => {
    if (seconds <= 0) return;
    const task = tasks.find((t) => t.id === task_id);
    const entry: TimeEntry = {
      id: uid(), task_id, user_id: currentUser.id, seconds,
      description: description ?? null,
      logged_at: logged_at ?? new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    setTimeEntries((prev) => [entry, ...prev]);
    setTasks((prev) => prev.map((t) => t.id === task_id ? { ...t, total_seconds: t.total_seconds + seconds } : t));
    await db.from("time_entries").insert(timeEntryToDb(entry));
    if (task) await db.from("tasks").update({ total_seconds: task.total_seconds + seconds } as any).eq("id", task_id);
    toast.success("Horas lançadas", { description: `${(seconds/3600).toFixed(2)}h registradas` });
  }, [currentUser, tasks]);

  const deleteTimeEntry = useCallback(async (id: string) => {
    const entry = timeEntries.find(t => t.id === id);
    if (!entry) return;
    setTimeEntries((prev) => prev.filter(t => t.id !== id));
    setTasks((prev) => prev.map((t) => t.id === entry.task_id ? { ...t, total_seconds: Math.max(0, t.total_seconds - entry.seconds) } : t));
    await db.from("time_entries").delete().eq("id", id);
    const task = tasks.find((t) => t.id === entry.task_id);
    if (task) await db.from("tasks").update({ total_seconds: Math.max(0, task.total_seconds - entry.seconds) } as any).eq("id", entry.task_id);
  }, [tasks, timeEntries]);

  // ---------- Colunas dinâmicas (líder) ----------
  const createColumn = useCallback((title: string) => {
    const id = uid();
    setColumns(prev => {
      const order = (prev[prev.length - 1]?.order ?? 0) + 1;
      const accents = ["bg-accent","bg-primary","bg-warning","bg-success","bg-destructive"];
      const accent = accents[prev.length % accents.length];
      const column = { id, title, accent, order };
      if (true) void db.from("kanban_columns").insert(column as any);
      return [...prev, column];
    });
    toast.success("Coluna criada", { description: title });
  }, [usingBackend]);
  const renameColumn = useCallback((id: string, title: string) => {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, title } : c));
    if (true) void db.from("kanban_columns").update({ title }).eq("id", id);
  }, [usingBackend]);
  const deleteColumn = useCallback((id: string) => {
    const col = columns.find(c => c.id === id);
    if (!col || col.base) return;
    setColumns(prev => prev.filter(c => c.id !== id));
    // Tarefas que pertenciam a essa coluna voltam para "todo"
    setTasks(prev => prev.map(t => t.column_id === id ? { ...t, column_id: null, status: "todo" } : t));
    if (true) {
      void db.from("tasks").update({ column_id: null, status: "todo" } as any).eq("column_id", id);
      void db.from("kanban_columns").delete().eq("id", id);
    }
    toast.success("Coluna removida");
  }, [columns, usingBackend]);

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
    if (true) void db.from("expenses").insert(expenseToDb(item, currentUser.id));
    toast.success("Despesa lançada", { description: item.title });
  }, [currentUser, usingBackend]);
  const deleteExpense = useCallback((id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    if (true) void db.from("expenses").delete().eq("id", id);
  }, [usingBackend]);

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
    if (true) void db.from("extra_services").insert(extraServiceToDb(item, currentUser.id));
    toast.success("Serviço avulso lançado", { description: item.title });
  }, [currentUser, usingBackend]);
  const deleteExtraService = useCallback((id: string) => {
    setExtraServices(prev => prev.filter(s => s.id !== id));
    if (true) void db.from("extra_services").delete().eq("id", id);
  }, [usingBackend]);

  // ---------- Notas da equipe ----------
  const addTeamNote = useCallback((user_id: string, body: string) => {
    const n: TeamNote = { id: uid(), user_id, body, created_at: new Date().toISOString(), author_id: currentUser.id };
    setTeamNotes(prev => [n, ...prev]);
    if (true) void db.from("team_notes").insert(n as any);
  }, [currentUser, usingBackend]);
  const deleteTeamNote = useCallback((id: string) => {
    setTeamNotes(prev => prev.filter(n => n.id !== id));
    if (true) void db.from("team_notes").delete().eq("id", id);
  }, [usingBackend]);

  const updateUser = useCallback((id: string, patch: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
    if (true) {
      const profilePatch = {
        name: patch.name,
        email: patch.email,
        avatar_url: patch.avatar_url,
        phone: patch.phone,
        bio: patch.bio,
        position: patch.position,
        birth_date: patch.birthdate,
        skills: patch.skills,
        salary: patch.salary,
        tax_rate: patch.tax_rate,
        hire_date: patch.hire_date,
        city: patch.city,
        updated_at: new Date().toISOString(),
      };
      void db.from("profiles").update(profilePatch as any).eq("id", id);
    }
  }, [usingBackend]);

  const updateFinanceSettings = useCallback((patch: Partial<FinanceSettings>) => {
    setFinanceSettings(prev => ({ ...prev, ...patch }));
    if (true) {
      Object.entries(patch).forEach(([key, value]) => {
        void db.from("finance_settings").upsert({ key, value, updated_at: new Date().toISOString() } as any);
      });
    }
  }, [usingBackend]);

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
    if (true) void db.from("teams").insert(teamToDb(item));
    toast.success("Time criado", { description: item.name });
  }, [usingBackend]);
  const updateTeam = useCallback((id: string, patch: Partial<Team>) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    if (true) void db.from("teams").update(teamToDb(patch)).eq("id", id);
  }, [usingBackend]);
  const deleteTeam = useCallback((id: string) => {
    setTeams(prev => prev.filter(t => t.id !== id));
    setUsers(prev => prev.map(u => u.team_id === id ? { ...u, team_id: null, is_manager: false } : u));
    if (true) void db.from("teams").delete().eq("id", id);
  }, [usingBackend]);

  const addUserToTeam = useCallback((userId: string, teamId: string) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, member_ids: Array.from(new Set([...(t.member_ids ?? []), userId])) } : t));
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, team_ids: Array.from(new Set([...(u.team_ids ?? (u.team_id ? [u.team_id] : [])), teamId])), team_id: u.team_id ?? teamId } : u));
    if (true) {
      void db.from("team_members").insert({ team_id: teamId, user_id: userId, role_in_team: "member" } as any);
    }
  }, [usingBackend]);
  const removeUserFromTeam = useCallback((userId: string, teamId: string) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, member_ids: (t.member_ids ?? []).filter(x => x !== userId) } : t));
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      const next = (u.team_ids ?? (u.team_id ? [u.team_id] : [])).filter(x => x !== teamId);
      return { ...u, team_ids: next, team_id: u.team_id === teamId ? (next[0] ?? null) : u.team_id, is_manager: u.team_id === teamId ? false : u.is_manager };
    }));
    if (true) void db.from("team_members").delete().eq("team_id", teamId).eq("user_id", userId);
  }, [usingBackend]);

  const setClientSatisfaction = useCallback(async (id: string, value: number, note?: string) => {
    const monthKey = new Date().toISOString().slice(0,7);
    setClients(prev => prev.map(c => {
      if (c.id !== id) return c;
      const hist = (c.satisfaction_history ?? []).filter(h => h.month !== monthKey);
      return { ...c, satisfaction: value, satisfaction_history: [...hist, { month: monthKey, value, note }].sort((a,b) => a.month.localeCompare(b.month)) };
    }));
    if (true) {
      const { error } = await db.from("clients").update({ satisfaction: value } as any).eq("id", id);
      if (error) { toast.error("Erro ao salvar satisfação: " + error.message); return; }
      void db.from("client_satisfaction_history").insert({ client_id: id, rating: value, recorded_by: currentUser.id } as any);
    }
    toast.success("Satisfação atualizada", { description: `${value.toFixed(1)} / 5` });
  }, [currentUser, usingBackend]);

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
    if (true) void db.from("cash_adjustments").insert(cashAdjustmentToDb(item, currentUser.id));
    toast.success("Ajuste de caixa lançado");
  }, [currentUser, usingBackend]);
  const deleteCashAdjustment = useCallback((id: string) => {
    setCashAdjustments(prev => prev.filter(c => c.id !== id));
    if (true) void db.from("cash_adjustments").delete().eq("id", id);
  }, [usingBackend]);

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
    createTask, updateTask, moveTask, deleteTask, createClient, updateClient, deleteClient, setClientSatisfaction,
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
