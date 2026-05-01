import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, KanbanSquare, BarChart3, Users, UserCog, Timer, Search, Bell, Moon, Sun, Database, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useTheme } from "@/components/ThemeProvider";
import { useApp } from "@/store/AppStore";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/kanban", label: "Kanban", icon: KanbanSquare },
  { to: "/reports", label: "Relatórios", icon: BarChart3 },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/team", label: "Equipe", icon: UserCog, leaderOnly: true },
  { to: "/time", label: "Tempo", icon: Timer },
];

export function AppLayout() {
  const { theme, toggle } = useTheme();
  const { currentUser, users, switchUser, usingBackend } = useApp();
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar shrink-0 flex flex-col py-6 px-4">
        <div className="flex items-center gap-3 px-2 mb-8">
          <Logo size={36} />
          <div>
            <h1 className="font-display font-bold text-lg leading-none">Versátil</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Digital</p>
          </div>
        </div>

        <nav className="space-y-1 flex-1">
          {nav.filter(n => !n.leaderOnly || currentUser.role === "leader").map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
            <Database className="w-3 h-3" />
            {usingBackend ? (
              <span className="text-success">Conectado ao banco</span>
            ) : (
              <span>Modo demo (mock)</span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/60 px-2 mt-2">por ZailonSoft</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between px-6 gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Buscar tarefas, clientes…"
              className="w-full h-9 bg-muted/50 border border-border rounded-lg pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition"
            />
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden md:inline-flex gap-1 border-accent/40 text-accent">
              <Sparkles className="w-3 h-3" /> {currentUser.role === "leader" ? "Líder" : "Funcionário"}
            </Badge>
            <Select value={currentUser.id} onValueChange={switchUser}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} · {u.role === "leader" ? "👑" : "👤"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Alternar tema">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Notificações">
              <Bell className="w-4 h-4" />
            </Button>
            <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xs font-semibold shadow-glow">
              {currentUser.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
            </div>
          </div>
        </header>

        <main key={location.pathname} className="flex-1 p-6 lg:p-8 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}