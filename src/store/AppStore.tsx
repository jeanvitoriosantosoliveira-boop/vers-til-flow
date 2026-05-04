import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { mockClients, mockComments, mockTasks, mockTimeEntries, mockUsers } from "@/data/mock";
import type { Client, Comment, Task, TaskStatus, TimeEntry, User } from "@/types";
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
  createTask: (t: Partial<Task>) => Promise<void>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  moveTask: (id: string, status: TaskStatus) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  createClient: (c: Partial<Client>) => Promise<void>;
  updateClient: (id: string, patch: Partial<Client>) => Promise<void>;
  addComment: (taskId: string, body: string) => Promise<void>;
  logTime: (input: { task_id: string; seconds: number; description?: string; logged_at?: string }) => Promise<void>;
  deleteTimeEntry: (id: string) => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

function uid() { return Math.random().toString(36).slice(2, 11); }

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { push: pushNotif } = useNotifications();

  const [users, setUsers] = useState<User[]>(mockUsers);
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [comments, setComments] = useState<Comment[]>(mockComments);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(mockTimeEntries);
  const [usingBackend, setUsingBackend] = useState(false);
  const [ready, setReady] = useState(false);

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

  const moveTask = useCallback((id: string, status: TaskStatus) => updateTask(id, { status }), [updateTask]);

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

  const value: AppState = {
    ready, usingBackend, currentUser, users, clients, tasks, comments, timeEntries,
    createTask, updateTask, moveTask, deleteTask, createClient, updateClient, addComment, logTime, deleteTimeEntry,
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
