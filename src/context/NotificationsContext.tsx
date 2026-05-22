import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

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
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return;
    let cancelled = false;

    supabase
      .from("notifications")
      .select("*")
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!cancelled && data) setNotifications(data as Notification[]);
      });

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, (payload) => {
        const next = payload.new as Notification | undefined;
        const old = payload.old as Notification | undefined;
        const belongsToUser = (item?: Notification) => item && (!item.user_id || item.user_id === user.id);
        if (payload.eventType === "DELETE") {
          if (old) setNotifications(prev => prev.filter(n => n.id !== old.id));
          return;
        }
        if (!belongsToUser(next)) return;
        setNotifications(prev => {
          const without = prev.filter(n => n.id !== next!.id);
          return [next!, ...without].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50);
        });
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const push = useCallback((n: Omit<Notification, "id" | "created_at" | "read">) => {
    const item = { ...n, id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 11), created_at: new Date().toISOString(), read: false };
    setNotifications(prev => [
      item,
      ...prev,
    ].slice(0, 50));
    if (isSupabaseConfigured && user?.id) {
      supabase.from("notifications").insert(item).then(({ error }) => {
        if (error) console.warn("Falha ao salvar notificação", error);
      });
    }
  }, [user?.id]);

  const markAllRead = useCallback(() => {
    setNotifications(p => p.map(n => ({ ...n, read: true })));
    if (isSupabaseConfigured && user?.id) {
      supabase.from("notifications").update({ read: true }).or(`user_id.eq.${user.id},user_id.is.null`);
    }
  }, [user?.id]);
  const clear = useCallback(() => {
    setNotifications([]);
    if (isSupabaseConfigured && user?.id) {
      supabase.from("notifications").delete().or(`user_id.eq.${user.id},user_id.is.null`);
    }
  }, [user?.id]);

  const unread = notifications.filter(n => !n.read).length;

  return <Ctx.Provider value={{ notifications, unread, push, markAllRead, clear }}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useNotifications must be inside NotificationsProvider");
  return c;
}
