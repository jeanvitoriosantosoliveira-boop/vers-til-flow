import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { LayoutDashboard, KanbanSquare, BarChart3, Users, UserCog, Timer, Search, Moon, Sun, Database, Sparkles, LogOut, Wallet, Network, UserCircle2, Menu, UserPlus } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/Logo";
import { useTheme } from "@/components/ThemeProvider";
import { useApp } from "@/store/AppStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useSearch } from "@/context/SearchContext";
import { NotificationsBell } from "@/components/NotificationsBell";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/kanban", label: "Kanban", icon: KanbanSquare },
  { to: "/reports", label: "Relatórios", icon: BarChart3 },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/team", label: "Equipe", icon: UserCog, leaderOnly: true },
  { to: "/collaborators", label: "Colaboradores", icon: UserPlus, leaderOnly: true },
  { to: "/teams", label: "Times", icon: Network, leaderOnly: true },
  { to: "/finance", label: "Financeiro", icon: Wallet, leaderOnly: true },
  { to: "/time", label: "Tempo", icon: Timer },
];

export function AppLayout() {
  const { theme, toggle } = useTheme();
  const { currentUser, usingBackend } = useApp();
  const { logout } = useAuth();
  const { query, setQuery } = useSearch();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Mostrar busca apenas onde faz sentido (Kanban e Clientes)
  const showSearch = location.pathname === "/kanban" || location.pathname === "/clients";

  function handleSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && query.trim()) navigate("/kanban");
  }

  const SidebarContent = (
    <>
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
              onClick={() => setMobileOpen(false)}
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
            {usingBackend ? <span className="text-success">Conectado ao banco</span> : <span>Modo demo (mock)</span>}
          </div>
          <p className="text-[10px] text-muted-foreground/60 px-2 mt-2">por ZailonSoft</p>
        </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden lg:flex w-64 border-r border-sidebar-border bg-sidebar shrink-0 flex-col py-6 px-4">
        {SidebarContent}
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-4 flex flex-col">
          {SidebarContent}
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 gap-2 sm:gap-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1 max-w-sm">
            {showSearch && (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleSearchKey}
                  placeholder="Buscar tarefas, clientes, palavras-chave…"
                  className="w-full h-9 bg-muted/50 border border-border rounded-lg pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Badge variant="outline" className="hidden md:inline-flex gap-1 border-accent/40 text-accent">
              <Sparkles className="w-3 h-3" /> {currentUser.role === "leader" ? "Líder" : currentUser.is_manager ? "Gerente" : "Colaborador"}
            </Badge>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Alternar tema">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <NotificationsBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xs font-semibold shadow-glow hover:scale-105 transition">
                  {currentUser.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{currentUser.name}</span>
                    <span className="text-xs text-muted-foreground font-normal">{currentUser.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="gap-2 cursor-pointer flex items-center">
                    <UserCircle2 className="w-4 h-4" /> Meu perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="gap-2 text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main key={location.pathname} className="flex-1 p-0 sm:p-2 lg:p-8 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
