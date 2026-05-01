import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { mockClients, mockComments, mockTasks, mockTimeEntries, mockUsers } from "@/data/mock";
import type { Client, Comment, Task, TaskStatus, TimeEntry, User } from "@/types";

interface AppState {
  ready: boolean;
  usingBackend: boolean;
  currentUser: User;
  users: User[];
  clients: Client[];
  tasks: Task[];
  comments: Comment[];
  timeEntries: TimeEntry[];
  activeTimer: { taskId: string; startedAt: number } | null;
  switchUser: (id: string) => void;
  createTask: (t: Partial<Task>) => Promise<void>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  moveTask: (id: string, status: TaskStatus) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  createClient: (c: Partial<Client>) => Promise<void>;
  addComment: (taskId: string, body: string) => Promise<void>;
  startTimer: (taskId: string) => void;
  stopTimer: () => void;
}

const Ctx = createContext<AppState | null>(null);

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [comments, setComments] = useState<Comment[]>(mockComments);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(mockTimeEntries);
  const [currentUserId, setCurrentUserId] = useState<string>(() => localStorage.getItem("vd_user") ?? "u1");
  const [activeTimer, setActiveTimer] = useState<AppState["activeTimer"]>(null);
  const [usingBackend, setUsingBackend] = useState(false);
  const [ready, setReady] = useState(false);

  // Try to load from Supabase if configured, else mock
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

  const switchUser = useCallback((id: string) => {
    setCurrentUserId(id);
    localStorage.setItem("vd_user", id);
  }, []);

  const currentUser = useMemo(
    () => users.find((u) => u.id === currentUserId) ?? users[0],
    [users, currentUserId]
  );

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
    if (usingBackend && supabase) {
      await supabase.from("tasks").insert(newTask);
    }
  }, [usingBackend]);

  const updateTask = useCallback(async (id: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch, updated_at: new Date().toISOString() } : t)));
    if (usingBackend && supabase) {
      await supabase.from("tasks").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    }
  }, [usingBackend]);

  const moveTask = useCallback((id: string, status: TaskStatus) => updateTask(id, { status }), [updateTask]);

  const deleteTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (usingBackend && supabase) {
      await supabase.from("tasks").delete().eq("id", id);
    }
  }, [usingBackend]);

  const createClient = useCallback(async (data: Partial<Client>) => {
    const c: Client = {
      id: uid(),
      name: data.name ?? "Novo cliente",
      company: data.company ?? null,
      email: data.email ?? null,
      status: data.status ?? "active",
      created_at: new Date().toISOString(),
    };
    setClients((prev) => [c, ...prev]);
    if (usingBackend && supabase) await supabase.from("clients").insert(c);
  }, [usingBackend]);

  const addComment = useCallback(async (taskId: string, body: string) => {
    const c: Comment = { id: uid(), task_id: taskId, user_id: currentUserId, body, created_at: new Date().toISOString() };
    setComments((prev) => [...prev, c]);
    if (usingBackend && supabase) await supabase.from("comments").insert(c);
  }, [currentUserId, usingBackend]);

  const startTimer = useCallback((taskId: string) => {
    setActiveTimer({ taskId, startedAt: Date.now() });
  }, []);

  const stopTimer = useCallback(() => {
    if (!activeTimer) return;
    const seconds = Math.round((Date.now() - activeTimer.startedAt) / 1000);
    const entry: TimeEntry = {
      id: uid(),
      task_id: activeTimer.taskId,
      user_id: currentUserId,
      started_at: new Date(activeTimer.startedAt).toISOString(),
      ended_at: new Date().toISOString(),
      seconds,
    };
    setTimeEntries((prev) => [...prev, entry]);
    setTasks((prev) => prev.map((t) => t.id === activeTimer.taskId ? { ...t, total_seconds: t.total_seconds + seconds } : t));
    if (usingBackend && supabase) {
      supabase.from("time_entries").insert(entry);
    }
    setActiveTimer(null);
  }, [activeTimer, currentUserId, usingBackend]);

  const value: AppState = {
    ready, usingBackend, currentUser, users, clients, tasks, comments, timeEntries, activeTimer,
    switchUser, createTask, updateTask, moveTask, deleteTask, createClient, addComment, startTimer, stopTimer,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppStoreProvider");
  return ctx;
}