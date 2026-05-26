/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
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
  setClientSatisfaction: (id: string, value: number, note?: string) => Promise<void>;
  addComment: (taskId: string, body: string) => Promise<void>;
  logTime: (input: { task_id: string; seconds: number; description?: string; logged_at?: string }) => Promise<void>;
  deleteTimeEntry: (id: string) => Promise<void>;
  createColumn: (title: string) => Promise<void>;
  renameColumn: (id: string, title: string) => Promise<void>;
  deleteColumn: (id: string) => Promise<void>;
  createExpense: (e: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  createExtraService: (s: Partial<ExtraService>) => Promise<void>;
  deleteExtraService: (id: string) => Promise<void>;
  addTeamNote: (user_id: string, body: string) => Promise<void>;
  deleteTeamNote: (id: string) => Promise<void>;
  updateUser: (id: string, patch: Partial<User>) => Promise<void>;
  updateFinanceSettings: (patch: Partial<FinanceSettings>) => Promise<void>;
  addCustomCategory: (label: string) => string;
  createTeam: (t: Partial<Team>) => Promise<void>;
  updateTeam: (id: string, patch: Partial<Team>) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  addUserToTeam: (userId: string, teamId: string) => Promise<void>;
  removeUserFromTeam: (userId: string, teamId: string) => Promise<void>;
  addCashAdjustment: (a: Partial<CashAdjustment>) => Promise<void>;
  deleteCashAdjustment: (id: string) => Promise<void>;
  visibleTaskIds: () => Set<string>;
}

const Ctx = createContext<AppState | null>(null);

function uid() { return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 11); }

const db = supabase as any;

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

function showDbError(error: unknown, fallback: string) {
  const message = error && typeof error === "object" && "message" in error ? String((error as any).message) : fallback;
  toast.error(fallback, { description: message });
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  return items.some(x => x.id === item.id) ? items.map(x => x.id === item.id ? item : x) : [item, ...items];
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

function clientPayload(data: Partial<Client>) {
  return {
    name: data.name,
    company: data.company ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    status: data.status ?? "active",
    contract_start: data.contract_start ?? null,
    contract_end: data.contract_end ?? null,
    monthly_value: data.monthly_fee ?? 0,
    satisfaction: data.satisfaction ?? null,
    notes: data.notes ?? null,
    segment: data.segment ?? null,
    monthly_hours_target: data.monthly_hours_target ?? 40,
    contract_months: data.contract_months ?? null,
    health: data.health ?? "good",
    services: data.services ?? [],
  };
}

function mapTask(row: any): Task {
  return {
    ...row,
    total_seconds: row.total_seconds ?? 0,
    column_id: row.column_id ?? null,
    recurrence: row.recurrence ?? { mode: "none" },
    template_id: row.template_id ?? row.parent_task_id ?? null,
    is_template: row.is_template ?? false,
    last_spawn: row.last_spawn ?? null,
  };
}

function taskPayload(data: Partial<Task>) {
  return {
    title: data.title,
    description: data.description ?? null,
    status: data.status,
    priority: data.priority,
    client_id: data.client_id ?? null,
    assignee_id: data.assignee_id ?? null,
    created_by: data.created_by ?? null,
    due_date: data.due_date ?? null,
    total_seconds: data.total_seconds ?? 0,
    column_id: data.column_id ?? null,
    recurrence: data.recurrence ?? { mode: "none" },
    is_template: data.is_template ?? false,
    template_id: data.template_id ?? null,
    last_spawn: data.last_spawn ?? null,
  };
}

function taskPatchPayload(patch: Partial<Task>) {
  const allowed = ["title", "description", "status", "priority", "client_id", "assignee_id", "created_by", "due_date", "total_seconds", "column_id", "recurrence", "is_template", "template_id", "last_spawn"] as const;
  const out: Record<string, unknown> = {};
  allowed.forEach(key => {
    if (key in patch) out[key] = (patch as any)[key];
  });
  out.updated_at = new Date().toISOString();
  return out;
}

function mapTimeEntry(row: any): TimeEntry {
  return {
    id: row.id,
    task_id: row.task_id,
    user_id: row.user_id,
    seconds: row.seconds ?? 0,
    description: row.description ?? null,
    logged_at: row.started_at ?? row.logged_at,
    created_at: row.created_at ?? row.started_at,
  };
}

function mapExpense(row: any): Expense {
  return {
    id: row.id,
    title: row.title ?? row.description ?? "Despesa",
    description: row.description ?? null,
    amount: Number(row.amount ?? 0),
    category: row.category ?? "other",
    date: row.occurred_on ?? row.date,
    recurring: row.recurring ?? false,
    created_at: row.created_at,
  };
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

function mapTeam(row: any, members: any[] = []): Team {
  const tm = members.filter(m => m.team_id === row.id);
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    color: row.color ?? "#6366f1",
    manager_id: tm.find(m => m.role_in_team === "manager")?.user_id ?? row.leader_id ?? null,
    member_ids: tm.map(m => m.user_id),
    created_at: row.created_at,
  };
}

function mapUsers(profiles: any[], roles: any[], members: any[]): User[] {
  return profiles.map(profile => {
    const roleList = roles.filter(r => r.user_id === profile.id).map(r => r.role);
    const teamRows = members.filter(m => m.user_id === profile.id);
    const isLeader = roleList.includes("leader");
    const isManager = isLeader || roleList.includes("manager") || teamRows.some(m => m.role_in_team === "manager");
    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: isLeader ? "leader" : "employee",
      avatar_url: profile.avatar_url,
      position: profile.position,
      salary: Number(profile.salary ?? profile.hourly_rate ?? 0),
      tax_rate: profile.tax_rate ?? undefined,
      hire_date: profile.hire_date ?? profile.contract_start ?? null,
      team_id: teamRows[0]?.team_id ?? null,
      team_ids: teamRows.map(m => m.team_id),
      is_manager: isManager,
      phone: profile.phone,
      birthdate: profile.birth_date,
      bio: profile.bio,
      city: profile.city,
      skills: profile.skills ?? [],
    };
  });
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
      if (isSupabaseConfigured) {
        try {
          const [profilesRes, rolesRes, membersRes, teamsRes, clientsRes, tasksRes, commentsRes, timeRes, columnsRes, expensesRes, extraRes, notesRes, financeRes, cashRes] = await Promise.all([
            db.from("profiles").select("*").order("name"),
            db.from("user_roles").select("*"),
            db.from("team_members").select("*"),
            db.from("teams").select("*").order("name"),
            db.from("clients").select("*").order("created_at", { ascending: false }),
            db.from("tasks").select("*").order("created_at", { ascending: false }),
            db.from("comments").select("*").order("created_at"),
            db.from("time_entries").select("*").order("started_at", { ascending: false }),
            db.from("kanban_columns").select("*").order("order"),
            db.from("expenses").select("*").order("occurred_on", { ascending: false }),
            db.from("extra_services").select("*").order("occurred_on", { ascending: false }),
            db.from("team_notes").select("*").order("created_at", { ascending: false }),
            db.from("finance_settings").select("*"),
            db.from("cash_adjustments").select("*").order("occurred_on", { ascending: false }),
          ]);
          if (cancelled) return;
          const criticalError = profilesRes.error || rolesRes.error || membersRes.error || teamsRes.error || clientsRes.error || tasksRes.error;
          if (criticalError) throw criticalError;

          const members = membersRes.data ?? [];
          const profiles = profilesRes.data ?? [];
          const roles = rolesRes.data ?? [];

          setUsers(mapUsers(profiles, roles, members));
          setTeams((teamsRes.data ?? []).map((team: any) => mapTeam(team, members)));
          setClients((clientsRes.data ?? []).map(mapClient));
          setTasks((tasksRes.data ?? []).map(mapTask));
          if (!commentsRes.error && commentsRes.data) setComments(commentsRes.data as Comment[]);
          if (!timeRes.error && timeRes.data) setTimeEntries(timeRes.data.map(mapTimeEntry));
          if (!columnsRes.error && columnsRes.data?.length) setColumns(columnsRes.data as KanbanColumn[]);
          if (!expensesRes.error && expensesRes.data) setExpenses(expensesRes.data.map(mapExpense));
          if (!extraRes.error && extraRes.data) setExtraServices(extraRes.data.map(mapExtraService));
          if (!notesRes.error && notesRes.data) setTeamNotes(notesRes.data as TeamNote[]);
          if (!cashRes.error && cashRes.data) setCashAdjustments(cashRes.data.map(mapCashAdjustment));
          if (!financeRes.error && financeRes.data) {
            const row = financeRes.data.find((item: any) => item.key === "main");
            if (row?.value) setFinanceSettings(row.value as FinanceSettings);
          }
          setUsingBackend(true);
        } catch (e) {
          console.warn("Supabase falhou, usando mocks", e);
          toast.error("Banco indisponível", { description: "Usando dados locais até reconectar." });
        }
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!usingBackend) return;

    async function reloadPeopleAndTeams() {
      const [profilesRes, rolesRes, membersRes, teamsRes] = await Promise.all([
        db.from("profiles").select("*").order("name"),
        db.from("user_roles").select("*"),
        db.from("team_members").select("*"),
        db.from("teams").select("*").order("name"),
      ]);
      if (profilesRes.error || rolesRes.error || membersRes.error || teamsRes.error) return;
      const members = membersRes.data ?? [];
      setUsers(mapUsers(profilesRes.data ?? [], rolesRes.data ?? [], members));
      setTeams((teamsRes.data ?? []).map((team: any) => mapTeam(team, members)));
    }

    const channel = db
      .channel("app-store-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload: any) => {
        if (payload.eventType === "DELETE") setTasks(prev => prev.filter(t => t.id !== payload.old.id));
        else setTasks(prev => upsertById(prev, mapTask(payload.new)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, (payload: any) => {
        if (payload.eventType === "DELETE") setClients(prev => prev.filter(c => c.id !== payload.old.id));
        else setClients(prev => upsertById(prev, mapClient(payload.new)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, (payload: any) => {
        if (payload.eventType === "DELETE") setComments(prev => prev.filter(c => c.id !== payload.old.id));
        else setComments(prev => upsertById(prev, payload.new as Comment));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "time_entries" }, (payload: any) => {
        if (payload.eventType === "DELETE") setTimeEntries(prev => prev.filter(t => t.id !== payload.old.id));
        else setTimeEntries(prev => upsertById(prev, mapTimeEntry(payload.new)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "kanban_columns" }, (payload: any) => {
        if (payload.eventType === "DELETE") setColumns(prev => prev.filter(c => c.id !== payload.old.id));
        else setColumns(prev => upsertById(prev, payload.new as KanbanColumn));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, (payload: any) => {
        if (payload.eventType === "DELETE") setExpenses(prev => prev.filter(e => e.id !== payload.old.id));
        else setExpenses(prev => upsertById(prev, mapExpense(payload.new)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "extra_services" }, (payload: any) => {
        if (payload.eventType === "DELETE") setExtraServices(prev => prev.filter(s => s.id !== payload.old.id));
        else setExtraServices(prev => upsertById(prev, mapExtraService(payload.new)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "team_notes" }, (payload: any) => {
        if (payload.eventType === "DELETE") setTeamNotes(prev => prev.filter(n => n.id !== payload.old.id));
        else setTeamNotes(prev => upsertById(prev, payload.new as TeamNote));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_adjustments" }, (payload: any) => {
        if (payload.eventType === "DELETE") setCashAdjustments(prev => prev.filter(c => c.id !== payload.old.id));
        else setCashAdjustments(prev => upsertById(prev, mapCashAdjustment(payload.new)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_settings" }, (payload: any) => {
        if (payload.eventType !== "DELETE" && payload.new.key === "main") setFinanceSettings(payload.new.value as FinanceSettings);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, reloadPeopleAndTeams)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, reloadPeopleAndTeams)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, reloadPeopleAndTeams)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, reloadPeopleAndTeams)
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [usingBackend]);

const authUserId = user?.id ?? null;

const fromList = users.find(u => u.id === authUserId);

// 🚨 fallback SEGURO
const safeUser: User = {
  id: "guest",
  name: "Usuário",
  email: "",
  role: "employee",
  avatar_url: null,
  is_manager: false,
  team_ids: [],
  team_id: null,
};

// ✅ nunca mais será undefined
const currentUser: User =
  fromList ??
  (user
    ? {
        id: user.id,
        name: user.name,
        email: user.email,
        role: (user.role === "collaborator" ? "employee" : user.role) as any,
        avatar_url: user.avatar_url ?? null,
        is_manager: user.is_manager,
        team_ids: [],
        team_id: null,
      }
    : safeUser);

  const createTask = useCallback(async (data: Partial<Task>) => {
    const now = new Date().toISOString();
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
      created_at: now,
      updated_at: now,
      total_seconds: 0,
      column_id: data.column_id ?? null,
      recurrence: data.recurrence ?? { mode: "none" },
      is_template: data.is_template ?? false,
      template_id: data.template_id ?? null,
      last_spawn: data.last_spawn ?? null,
    };
    setTasks((prev) => [newTask, ...prev]);
    if (usingBackend) {
      const { error } = await db.from("tasks").insert({ id: newTask.id, ...taskPayload(newTask), created_at: now, updated_at: now });
      if (error) {
        setTasks(prev => prev.filter(t => t.id !== newTask.id));
        toast.error("Erro ao salvar tarefa", { description: error.message });
        return;
      }
    }
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
    if (usingBackend) {
      const { error } = await db.from("tasks").update(taskPatchPayload(patch)).eq("id", id);
      if (error) {
        if (prevTask) setTasks(prev => prev.map(t => t.id === id ? prevTask! : t));
        toast.error("Erro ao salvar tarefa", { description: error.message });
        return;
      }
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
        if (usingBackend) {
          db.from("tasks").insert({ id: nt.id, ...taskPayload(nt), created_at: nt.created_at, updated_at: nt.updated_at }).then(({ error }: any) => {
            if (error) toast.error("Erro ao agendar recorrência", { description: error.message });
          });
        }
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
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (usingBackend) {
      const { error } = await db.from("tasks").delete().eq("id", id);
      if (error) {
        setTasks(previous);
        toast.error("Erro ao excluir tarefa", { description: error.message });
      }
    }
  }, [usingBackend, tasks]);

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
    if (usingBackend) {
      const { error } = await db.from("clients").insert({ id: c.id, ...clientPayload(c), created_at: c.created_at });
      if (error) {
        setClients(prev => prev.filter(item => item.id !== c.id));
        toast.error("Erro ao salvar cliente", { description: error.message });
        return;
      }
    }
    pushNotif({ type: "info", title: "Novo cliente", body: c.name });
    toast.success("Cliente criado", { description: c.name });
  }, [usingBackend, pushNotif]);

  const updateClient = useCallback(async (id: string, patch: Partial<Client>) => {
    const previous = clients;
    setClients((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));
    if (usingBackend) {
      const current = clients.find(c => c.id === id);
      const { error } = await db.from("clients").update(clientPayload({ ...current, ...patch })).eq("id", id);
      if (error) {
        setClients(previous);
        toast.error("Erro ao salvar cliente", { description: error.message });
      }
    }
  }, [usingBackend, clients]);

  const addComment = useCallback(async (taskId: string, body: string) => {
    const c: Comment = { id: uid(), task_id: taskId, user_id: currentUser.id, body, created_at: new Date().toISOString() };
    setComments((prev) => [...prev, c]);
    if (usingBackend) {
      const { error } = await db.from("comments").insert(c);
      if (error) {
        setComments(prev => prev.filter(item => item.id !== c.id));
        toast.error("Erro ao salvar comentário", { description: error.message });
      }
    }
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
    if (usingBackend) {
      const startedAt = entry.logged_at;
      const endedAt = new Date(new Date(startedAt).getTime() + seconds * 1000).toISOString();
      const { error } = await db.from("time_entries").insert({
        id: entry.id,
        task_id,
        user_id: currentUser.id,
        started_at: startedAt,
        ended_at: endedAt,
        seconds,
        description: entry.description,
        created_at: entry.created_at,
      });
      if (error) {
        setTimeEntries(prev => prev.filter(item => item.id !== entry.id));
        setTasks(prev => prev.map(t => t.id === task_id ? { ...t, total_seconds: Math.max(0, t.total_seconds - seconds) } : t));
        toast.error("Erro ao lançar horas", { description: error.message });
        return;
      }
    }
    toast.success("Horas lançadas", { description: `${(seconds/3600).toFixed(2)}h registradas` });
  }, [currentUser, usingBackend]);

  const deleteTimeEntry = useCallback(async (id: string) => {
    const entry = timeEntries.find(t => t.id === id);
    if (!entry) return;
    setTimeEntries((prev) => prev.filter(t => t.id !== id));
    setTasks((prev) => prev.map((t) => t.id === entry.task_id ? { ...t, total_seconds: Math.max(0, t.total_seconds - entry.seconds) } : t));
    if (usingBackend) {
      const { error } = await db.from("time_entries").delete().eq("id", id);
      if (error) {
        setTimeEntries(prev => [entry, ...prev]);
        setTasks(prev => prev.map(t => t.id === entry.task_id ? { ...t, total_seconds: t.total_seconds + entry.seconds } : t));
        toast.error("Erro ao excluir horas", { description: error.message });
      }
    }
  }, [timeEntries, usingBackend]);

  // ---------- Colunas dinâmicas (líder) ----------
  const createColumn = useCallback(async (title: string) => {
    const order = (columns[columns.length - 1]?.order ?? 0) + 1;
    const accents = ["bg-accent","bg-primary","bg-warning","bg-success","bg-destructive"];
    const item: KanbanColumn = { id: uid(), title, accent: accents[columns.length % accents.length], order };
    setColumns(prev => [...prev, item]);
    if (usingBackend) {
      const { error } = await db.from("kanban_columns").insert(item);
      if (error) {
        setColumns(prev => prev.filter(c => c.id !== item.id));
        toast.error("Erro ao criar coluna", { description: error.message });
        return;
      }
    }
    toast.success("Coluna criada", { description: title });
  }, [columns, usingBackend]);
  const renameColumn = useCallback(async (id: string, title: string) => {
    const previous = columns;
    setColumns(prev => prev.map(c => c.id === id ? { ...c, title } : c));
    if (usingBackend) {
      const { error } = await db.from("kanban_columns").update({ title }).eq("id", id);
      if (error) {
        setColumns(previous);
        toast.error("Erro ao renomear coluna", { description: error.message });
      }
    }
  }, [columns, usingBackend]);
  const deleteColumn = useCallback(async (id: string) => {
    const col = columns.find(c => c.id === id);
    if (!col || col.base) return;
    const previousColumns = columns;
    const previousTasks = tasks;
    setColumns(prev => prev.filter(c => c.id !== id));
    // Tarefas que pertenciam a essa coluna voltam para "todo"
    setTasks(prev => prev.map(t => t.column_id === id ? { ...t, column_id: null, status: "todo" } : t));
    if (usingBackend) {
      const [{ error: taskError }, { error: columnError }] = await Promise.all([
        db.from("tasks").update({ column_id: null, status: "todo" }).eq("column_id", id),
        db.from("kanban_columns").delete().eq("id", id),
      ]);
      const error = taskError || columnError;
      if (error) {
        setColumns(previousColumns);
        setTasks(previousTasks);
        toast.error("Erro ao remover coluna", { description: error.message });
        return;
      }
    }
    toast.success("Coluna removida");
  }, [columns, tasks, usingBackend]);

  // ---------- Finanças ----------
  const createExpense = useCallback(async (e: Partial<Expense>) => {
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
    if (usingBackend) {
      const { error } = await db.from("expenses").insert({
        id: item.id,
        title: item.title,
        description: item.description,
        amount: item.amount,
        category: item.category,
        occurred_on: item.date,
        recurring: item.recurring ?? false,
        created_by: currentUser.id,
        created_at: item.created_at,
      });
      if (error) {
        setExpenses(prev => prev.filter(x => x.id !== item.id));
        toast.error("Erro ao lançar despesa", { description: error.message });
        return;
      }
    }
    toast.success("Despesa lançada", { description: item.title });
  }, [currentUser.id, usingBackend]);
  const deleteExpense = useCallback(async (id: string) => {
    const previous = expenses;
    setExpenses(prev => prev.filter(e => e.id !== id));
    if (usingBackend) {
      const { error } = await db.from("expenses").delete().eq("id", id);
      if (error) {
        setExpenses(previous);
        toast.error("Erro ao excluir despesa", { description: error.message });
      }
    }
  }, [expenses, usingBackend]);

  const createExtraService = useCallback(async (s: Partial<ExtraService>) => {
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
    if (usingBackend) {
      const { error } = await db.from("extra_services").insert({
        id: item.id,
        client_id: item.client_id,
        title: item.title,
        description: item.description,
        amount: item.amount,
        occurred_on: item.date,
        created_by: currentUser.id,
        created_at: item.created_at,
      });
      if (error) {
        setExtraServices(prev => prev.filter(x => x.id !== item.id));
        toast.error("Erro ao lançar serviço avulso", { description: error.message });
        return;
      }
    }
    toast.success("Serviço avulso lançado", { description: item.title });
  }, [currentUser.id, usingBackend]);
  const deleteExtraService = useCallback(async (id: string) => {
    const previous = extraServices;
    setExtraServices(prev => prev.filter(s => s.id !== id));
    if (usingBackend) {
      const { error } = await db.from("extra_services").delete().eq("id", id);
      if (error) {
        setExtraServices(previous);
        toast.error("Erro ao excluir serviço avulso", { description: error.message });
      }
    }
  }, [extraServices, usingBackend]);

  // ---------- Notas da equipe ----------
  const addTeamNote = useCallback(async (user_id: string, body: string) => {
    const n: TeamNote = { id: uid(), user_id, body, created_at: new Date().toISOString(), author_id: currentUser.id };
    setTeamNotes(prev => [n, ...prev]);
    if (usingBackend) {
      const { error } = await db.from("team_notes").insert(n);
      if (error) {
        setTeamNotes(prev => prev.filter(item => item.id !== n.id));
        toast.error("Erro ao salvar anotação", { description: error.message });
      }
    }
  }, [currentUser, usingBackend]);
  const deleteTeamNote = useCallback(async (id: string) => {
    const previous = teamNotes;
    setTeamNotes(prev => prev.filter(n => n.id !== id));
    if (usingBackend) {
      const { error } = await db.from("team_notes").delete().eq("id", id);
      if (error) {
        setTeamNotes(previous);
        toast.error("Erro ao excluir anotação", { description: error.message });
      }
    }
  }, [teamNotes, usingBackend]);

  const updateUser = useCallback(async (id: string, patch: Partial<User>) => {
    const previous = users;
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
    if (usingBackend) {
      const { error } = await db.from("profiles").update({
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
      }).eq("id", id);
      if (error) {
        setUsers(previous);
        toast.error("Erro ao salvar usuário", { description: error.message });
      }
    }
  }, [users, usingBackend]);

  const updateFinanceSettings = useCallback(async (patch: Partial<FinanceSettings>) => {
    const next = { ...financeSettings, ...patch };
    setFinanceSettings(next);
    if (usingBackend) {
      const { error } = await db.from("finance_settings").upsert({ key: "main", value: next, updated_at: new Date().toISOString() });
      if (error) {
        setFinanceSettings(financeSettings);
        toast.error("Erro ao salvar configurações", { description: error.message });
      }
    }
  }, [financeSettings, usingBackend]);

  // ---------- Teams ----------
  const createTeam = useCallback(async (t: Partial<Team>) => {
    const item: Team = {
      id: uid(),
      name: t.name ?? "Novo time",
      description: t.description ?? null,
      color: t.color ?? "bg-primary",
      manager_id: t.manager_id ?? null,
      created_at: new Date().toISOString(),
    };
    setTeams(prev => [item, ...prev]);
    if (usingBackend) {
      const { error } = await db.from("teams").insert({ id: item.id, name: item.name, description: item.description, color: item.color, leader_id: item.manager_id, created_at: item.created_at });
      if (error) {
        setTeams(prev => prev.filter(team => team.id !== item.id));
        toast.error("Erro ao criar time", { description: error.message });
        return;
      }
    }
    toast.success("Time criado", { description: item.name });
  }, [usingBackend]);
  const updateTeam = useCallback(async (id: string, patch: Partial<Team>) => {
    const previous = teams;
    setTeams(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    if (usingBackend) {
      const { error } = await db.from("teams").update({ name: patch.name, description: patch.description, color: patch.color, leader_id: patch.manager_id }).eq("id", id);
      if (error) {
        setTeams(previous);
        toast.error("Erro ao salvar time", { description: error.message });
      }
    }
  }, [teams, usingBackend]);
  const deleteTeam = useCallback(async (id: string) => {
    const previousTeams = teams;
    const previousUsers = users;
    setTeams(prev => prev.filter(t => t.id !== id));
    setUsers(prev => prev.map(u => u.team_id === id ? { ...u, team_id: null, is_manager: false } : u));
    if (usingBackend) {
      const { error } = await db.from("teams").delete().eq("id", id);
      if (error) {
        setTeams(previousTeams);
        setUsers(previousUsers);
        toast.error("Erro ao excluir time", { description: error.message });
      }
    }
  }, [teams, users, usingBackend]);

  const addUserToTeam = useCallback(async (userId: string, teamId: string) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, member_ids: Array.from(new Set([...(t.member_ids ?? []), userId])) } : t));
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, team_ids: Array.from(new Set([...(u.team_ids ?? (u.team_id ? [u.team_id] : [])), teamId])), team_id: u.team_id ?? teamId } : u));
    if (usingBackend) {
      const { error } = await db.from("team_members").upsert({ team_id: teamId, user_id: userId, role_in_team: "member" }, { onConflict: "team_id,user_id" });
      if (error) toast.error("Erro ao adicionar membro", { description: error.message });
    }
  }, [usingBackend]);
  const removeUserFromTeam = useCallback(async (userId: string, teamId: string) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, member_ids: (t.member_ids ?? []).filter(x => x !== userId) } : t));
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      const next = (u.team_ids ?? (u.team_id ? [u.team_id] : [])).filter(x => x !== teamId);
      return { ...u, team_ids: next, team_id: u.team_id === teamId ? (next[0] ?? null) : u.team_id, is_manager: u.team_id === teamId ? false : u.is_manager };
    }));
    if (usingBackend) {
      const { error } = await db.from("team_members").delete().eq("team_id", teamId).eq("user_id", userId);
      if (error) toast.error("Erro ao remover membro", { description: error.message });
    }
  }, [usingBackend]);

  const setClientSatisfaction = useCallback(async (id: string, value: number, note?: string) => {
    const monthKey = new Date().toISOString().slice(0,7);
    setClients(prev => prev.map(c => {
      if (c.id !== id) return c;
      const hist = (c.satisfaction_history ?? []).filter(h => h.month !== monthKey);
      return { ...c, satisfaction: value, satisfaction_history: [...hist, { month: monthKey, value, note }].sort((a,b) => a.month.localeCompare(b.month)) };
    }));
    if (usingBackend) {
      const [{ error: clientError }, { error: historyError }] = await Promise.all([
        db.from("clients").update({ satisfaction: value }).eq("id", id),
        db.from("client_satisfaction_history").insert({ client_id: id, rating: value, recorded_by: currentUser.id }),
      ]);
      const error = clientError || historyError;
      if (error) {
        toast.error("Erro ao salvar satisfação", { description: error.message });
        return;
      }
    }
    toast.success("Satisfação atualizada", { description: `${value.toFixed(1)} / 5` });
  }, [currentUser.id, usingBackend]);

  const addCustomCategory = useCallback((label: string) => {
    const key = "cat_" + label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 20) + "_" + uid().slice(0, 4);
    setFinanceSettings(prev => {
      const next = { ...prev, custom_categories: [...(prev.custom_categories ?? []), { key, label }] };
      if (usingBackend) {
        db.from("finance_settings").upsert({ key: "main", value: next, updated_at: new Date().toISOString() }).then(({ error }: any) => {
          if (error) toast.error("Erro ao salvar categoria", { description: error.message });
        });
      }
      return next;
    });
    return key;
  }, [usingBackend]);

  const addCashAdjustment = useCallback(async (a: Partial<CashAdjustment>) => {
    const item: CashAdjustment = {
      id: uid(),
      amount: a.amount ?? 0,
      reason: a.reason ?? "Ajuste de caixa",
      date: a.date ?? new Date().toISOString().slice(0,10),
      created_at: new Date().toISOString(),
    };
    setCashAdjustments(prev => [item, ...prev]);
    if (usingBackend) {
      const { error } = await db.from("cash_adjustments").insert({
        id: item.id,
        amount: Math.abs(item.amount),
        kind: item.amount < 0 ? "out" : "in",
        occurred_on: item.date,
        description: item.reason,
        created_by: currentUser.id,
        created_at: item.created_at,
      });
      if (error) {
        setCashAdjustments(prev => prev.filter(x => x.id !== item.id));
        toast.error("Erro ao lançar ajuste", { description: error.message });
        return;
      }
    }
    toast.success("Ajuste de caixa lançado");
  }, [currentUser.id, usingBackend]);
  const deleteCashAdjustment = useCallback(async (id: string) => {
    const previous = cashAdjustments;
    setCashAdjustments(prev => prev.filter(c => c.id !== id));
    if (usingBackend) {
      const { error } = await db.from("cash_adjustments").delete().eq("id", id);
      if (error) {
        setCashAdjustments(previous);
        toast.error("Erro ao excluir ajuste", { description: error.message });
      }
    }
  }, [cashAdjustments, usingBackend]);

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
      const spawned: Task[] = [];
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
