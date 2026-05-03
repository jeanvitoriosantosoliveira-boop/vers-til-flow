import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { mockUsers } from "@/data/mock";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
}

const Ctx = createContext<AuthState | null>(null);
const KEY = "vd_auth_user_id";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem(KEY);
    if (id) {
      const u = mockUsers.find(x => x.id === id);
      if (u) setUser(u);
    }
    setReady(true);
  }, []);

  function login(email: string, password: string) {
    const u = mockUsers.find(x => x.email.toLowerCase() === email.toLowerCase().trim());
    if (!u) return { ok: false, error: "Usuário não encontrado." };
    if (u.password !== password) return { ok: false, error: "Senha incorreta." };
    setUser(u);
    localStorage.setItem(KEY, u.id);
    return { ok: true };
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(KEY);
  }

  return <Ctx.Provider value={{ user, ready, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}
