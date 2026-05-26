import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User as SupaUser } from "@supabase/supabase-js";

export type AppRole = "leader" | "manager" | "collaborator";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  position?: string | null;
  role: AppRole;
  is_manager: boolean;
  is_leader: boolean;
}

interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

async function loadAppUser(supaUser: SupaUser): Promise<AuthUser> {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("name, avatar_url, position").eq("id", supaUser.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", supaUser.id),
  ]);
  const roleList = (roles ?? []).map((r: any) => r.role as AppRole);
  const role: AppRole = roleList.includes("leader") ? "leader" : roleList.includes("manager") ? "manager" : "collaborator";
  return {
    id: supaUser.id,
    email: supaUser.email ?? "",
    name: profile?.name ?? supaUser.email?.split("@")[0] ?? "Usuário",
    avatar_url: profile?.avatar_url,
    position: profile?.position,
    role,
    is_leader: role === "leader",
    is_manager: role === "manager" || role === "leader",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        // defer profile loading to avoid deadlock with the auth callback
        setTimeout(() => { loadAppUser(s.user).then(setUser); }, 0);
      } else {
        setUser(null);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user) setUser(await loadAppUser(data.session.user));
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  async function refresh() {
    const { data } = await supabase.auth.getUser();
    if (data.user) setUser(await loadAppUser(data.user));
  }

  return <Ctx.Provider value={{ user, session, ready, login, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}
