import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface Notification {
  id: string;
  title: string;
  body?: string;
  type: "task_created" | "task_updated" | "task_done" | "info";
  created_at: string;
  read: boolean;
  user_id?: string; // destino
}

interface State {
  notifications: Notification[];
  unread: number;
  push: (n: Omit<Notification, "id" | "created_at" | "read">) => void;
  markAllRead: () => void;
  clear: () => void;
}

const Ctx = createContext<State | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const push = useCallback((n: Omit<Notification, "id" | "created_at" | "read">) => {
    setNotifications(prev => [
      { ...n, id: Math.random().toString(36).slice(2, 11), created_at: new Date().toISOString(), read: false },
      ...prev,
    ].slice(0, 50));
  }, []);

  const markAllRead = useCallback(() => setNotifications(p => p.map(n => ({ ...n, read: true }))), []);
  const clear = useCallback(() => setNotifications([]), []);

  const unread = notifications.filter(n => !n.read).length;

  return <Ctx.Provider value={{ notifications, unread, push, markAllRead, clear }}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useNotifications must be inside NotificationsProvider");
  return c;
}
