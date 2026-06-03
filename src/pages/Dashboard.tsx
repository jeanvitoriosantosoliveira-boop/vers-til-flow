import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/store/AppStore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, Clock, AlertTriangle, ListTodo, TrendingUp, Users as UsersIcon,
  Sparkles, Flame, Target, ArrowUpRight, Zap, Crown, Activity, Lock
} from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { relativeDue, formatSeconds } from "@/lib/format";
import { PeriodFilter, type Period, inPeriod } from "@/components/PeriodFilter";
import { canViewFinancial } from "@/lib/roleVisibility";

export default function Dashboard() {
  const { tasks, clients, users, timeEntries, currentUser } = useApp();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>({ preset: "week" });

  const isLeader = currentUser.role === "leader";

  const myScope = useMemo(
    () => isLeader ? tasks : tasks.filter(t => t.assignee_id === currentUser.id),
    [tasks, isLeader, currentUser.id]
  );

  const inRange = useMemo(
    () => myScope.filter(t => inPeriod(t.created_at, period) || inPeriod(t.updated_at, period)),
    [myScope, period]
  );

  const stats = useMemo(() => {
    const total = inRange.length;
    const done = inRange.filter(t => t.status === "done").length;
    const progress = inRange.filter(t => t.status === "in_progress").length;
    const late = inRange.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done").length;
    return { total, done, progress, late, productivity: total ? Math.round((done / total) * 100) : 0 };
  }, [inRange]);

  // Tempo lançado no período
  const periodSeconds = useMemo(() => {
    return timeEntries
      .filter(e => isLeader || e.user_id === currentUser.id)
      .filter(e => inPeriod(e.logged_at, period))
      .reduce((s, e) => s + e.seconds, 0);
  }, [timeEntries, period, isLeader, currentUser.id]);

  // Receita estimada do mês (líder)
  const monthlyRevenue = useMemo(() => clients.reduce((s, c) => s + (c.monthly_fee ?? 0), 0), [clients]);

  // Trend 14d horas
  const today = new Date(); today.setHours(0,0,0,0);
  const trend14 = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today.getTime() - (13 - i) * 86400000);
    const next = new Date(d.getTime() + 86400000);
    const sec = timeEntries
      .filter(e => isLeader || e.user_id === currentUser.id)
      .filter(e => {
        const t = new Date(e.logged_at).getTime();
        return t >= d.getTime() && t < next.getTime();
      }).reduce((s,e) => s+e.seconds, 0);
    const dn = inRange.filter(t => t.status === "done"
      && new Date(t.updated_at).getTime() >= d.getTime()
      && new Date(t.updated_at).getTime() < next.getTime()).length;
    return { dia: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), horas: +(sec/3600).toFixed(1), concluidas: dn };
  }), [timeEntries, inRange, isLeader, currentUser.id]);

  const byUser = useMemo(() => users.filter(u => u.role !== "leader" && u.role !== "commercial").map(u => {
    const ut = inRange.filter(t => t.assignee_id === u.id);
    return {
      name: u.name.split(" ")[0],
      concluidas: ut.filter(t => t.status === "done").length,
      andamento: ut.filter(t => t.status === "in_progress").length,
    };
  }), [inRange, users]);

  const statusDist = useMemo(() => {
    const map: Record<string, string> = { todo: "A Fazer", in_progress: "Em Andamento", review: "Revisão", done: "Concluído" };
    const colors = ["hsl(var(--muted-foreground))", "hsl(var(--primary))", "hsl(var(--warning))", "hsl(var(--success))"];
    return Object.entries(map).map(([k, label], i) => ({
      name: label, value: inRange.filter(t => t.status === k).length, fill: colors[i],
    }));
  }, [inRange]);

  // Top performer (líder)
  const topPerformer = useMemo(() => {
    const ranked = users.filter(u => u.role !== "leader" && u.role !== "commercial").map(u => {
      const sec = timeEntries.filter(e => e.user_id === u.id && inPeriod(e.logged_at, period))
        .reduce((s,e) => s+e.seconds, 0);
      const dn = inRange.filter(t => t.assignee_id === u.id && t.status === "done").length;
      return { user: u, seconds: sec, done: dn, score: sec + dn * 3600 };
    }).sort((a,b) => b.score - a.score);
    return ranked[0];
  }, [users, timeEntries, inRange, period]);

  // Cliente em risco
  const clientsAtRisk = useMemo(() => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    return clients.map(c => {
      const sec = timeEntries.filter(e => {
        const t = tasks.find(x => x.id === e.task_id);
        return t?.client_id === c.id && new Date(e.logged_at) >= monthStart;
      }).reduce((s,e) => s+e.seconds, 0);
      const hours = sec / 3600;
      const target = c.monthly_hours_target ?? 40;
      return { c, hours, target, over: hours > target, pct: Math.round(hours/target*100) };
    }).filter(x => x.over || x.c.health === "risk" || x.c.health === "warning")
      .sort((a,b) => b.pct - a.pct).slice(0, 4);
  }, [clients, timeEntries, tasks]);

  const recent = useMemo(
    () => [...myScope].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 6),
    [myScope]
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();

  return (
    <div className="max-w-7xl mx-auto">
      {/* HERO */}
      <Card className="relative overflow-hidden p-8 mb-6 border-0 bg-gradient-to-br from-[hsl(var(--card))] via-[hsl(var(--card))] to-[hsl(var(--accent)/0.08)]">
        <div className="absolute -right-10 -top-10 w-80 h-80 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-end justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold">{greeting}, {currentUser.name.split(" ")[0]}</p>
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              {isLeader ? "Operação em movimento." : "Vamos fazer acontecer."}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-xl">
              {isLeader
                ? `${stats.done} entregas concluídas, ${formatSeconds(periodSeconds)} de trabalho registrado e ${clients.length} clientes ativos.`
                : `Você tem ${stats.progress} tarefas em andamento e ${formatSeconds(periodSeconds)} lançados no período.`}
            </p>
            <div className="flex items-center gap-2 mt-4">
              <PeriodFilter value={period} onChange={setPeriod} />
              <button onClick={() => navigate("/kanban")} className="text-sm font-semibold text-accent hover:underline flex items-center gap-1">
                Abrir Kanban <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {canViewFinancial(currentUser) && (
            <div className="flex flex-col items-end">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Receita recorrente</p>
              <p className="font-display text-4xl font-bold text-gradient tabular-nums">R$ {monthlyRevenue.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground">/mês · {clients.length} clientes</p>
            </div>
          )}
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <button onClick={() => navigate("/kanban")} className="text-left">
          <Card className="p-5 hover:shadow-lift hover:-translate-y-0.5 transition-all group h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center"><ListTodo className="w-5 h-5" /></div>
              <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition" />
            </div>
            <p className="font-display text-3xl font-bold tabular-nums">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Tarefas no período</p>
          </Card>
        </button>
        <Card className="p-5 hover:shadow-lift hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center"><CheckCircle2 className="w-5 h-5" /></div>
            <Badge variant="secondary" className="text-[10px] gap-1"><Activity className="w-3 h-3" />{stats.productivity}%</Badge>
          </div>
          <p className="font-display text-3xl font-bold tabular-nums text-success">{stats.done}</p>
          <p className="text-xs text-muted-foreground mt-1 font-medium">Concluídas</p>
        </Card>
        <Card className="p-5 hover:shadow-lift hover:-translate-y-0.5 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Clock className="w-5 h-5" /></div>
          </div>
          <p className="font-display text-3xl font-bold tabular-nums">{formatSeconds(periodSeconds)}</p>
          <p className="text-xs text-muted-foreground mt-1 font-medium">Horas trabalhadas</p>
        </Card>
        <Card className={`p-5 hover:shadow-lift hover:-translate-y-0.5 transition-all ${stats.late ? "border-destructive/40" : ""}`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stats.late ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}><AlertTriangle className="w-5 h-5" /></div>
          </div>
          <p className={`font-display text-3xl font-bold tabular-nums ${stats.late ? "text-destructive" : ""}`}>{stats.late}</p>
          <p className="text-xs text-muted-foreground mt-1 font-medium">Atrasadas</p>
        </Card>
      </div>

      {/* PRODUTIVIDADE / DISTRIBUIÇÃO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2 p-6 relative overflow-hidden">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-display font-semibold text-lg">Pulso da produção</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Horas lançadas + tarefas concluídas — últimos 14 dias</p>
            </div>
            <Badge className="gap-1 bg-accent/15 text-accent border-0"><TrendingUp className="w-3 h-3" /> ao vivo</Badge>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend14}>
                <defs>
                  <linearGradient id="dh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="l" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} unit="h" />
                <YAxis yAxisId="r" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area yAxisId="l" type="monotone" dataKey="horas" name="Horas" stroke="hsl(var(--accent))" strokeWidth={2} fill="url(#dh)" />
                <Area yAxisId="r" type="monotone" dataKey="concluidas" name="Concluídas" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#dd)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-display font-semibold text-lg mb-1">Status</h3>
          <p className="text-xs text-muted-foreground mb-4">Distribuição no período</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={4}>
                  {statusDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {statusDist.map(s => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: s.fill }} />{s.name}</span>
                <span className="font-semibold tabular-nums">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* LIDER: top performer + risco */}
      {isLeader && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="p-6 relative overflow-hidden">
            <div className="absolute inset-0 gradient-glow opacity-40 pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-4">
                <Crown className="w-3.5 h-3.5 text-warning" /> Destaque do período
              </div>
              {topPerformer ? (
                <>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground font-bold shadow-glow">
                      {topPerformer.user.name.split(" ").map(n => n[0]).slice(0,2).join("")}
                    </div>
                    <div>
                      <p className="font-display text-lg font-bold leading-tight">{topPerformer.user.name}</p>
                      <p className="text-xs text-muted-foreground">{topPerformer.done} entregas · {formatSeconds(topPerformer.seconds)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Badge className="bg-success/15 text-success border-0 gap-1"><Flame className="w-3 h-3" /> on fire</Badge>
                    <Badge variant="outline" className="gap-1"><Zap className="w-3 h-3" /> top performer</Badge>
                  </div>
                </>
              ) : <p className="text-sm text-muted-foreground">Sem dados ainda.</p>}
            </div>
          </Card>

          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" /> Clientes que precisam de atenção</h3>
                <p className="text-xs text-muted-foreground">Estouro de horas ou saúde comprometida</p>
              </div>
            </div>
            <div className="space-y-2">
              {clientsAtRisk.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Tudo sob controle ✨</p>}
              {clientsAtRisk.map(({ c, hours, target, pct, over }) => (
                <button key={c.id} onClick={() => navigate(`/clients/${c.id}`)} className="w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition group">
                  <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">{c.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full ${over ? "bg-destructive" : "bg-warning"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground">{hours.toFixed(0)}/{target}h</span>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-accent" />
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Equipe + recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isLeader && (
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-display font-semibold flex items-center gap-2"><UsersIcon className="w-4 h-4" /> Performance da equipe</h3>
                <p className="text-xs text-muted-foreground">Tarefas no período</p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byUser} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
                  <Bar dataKey="concluidas" name="Concluídas" fill="hsl(var(--success))" radius={[6,6,0,0]} />
                  <Bar dataKey="andamento" name="Andamento" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        <Card className={`p-6 ${isLeader ? "" : "lg:col-span-3"}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold flex items-center gap-2"><Target className="w-4 h-4" /> Atividade recente</h3>
          </div>
          <div className="space-y-2">
            {recent.map(t => {
              const due = relativeDue(t.due_date);
              const client = clients.find(c => c.id === t.client_id);
              const assignee = users.find(u => u.id === t.assignee_id);
              return (
                <div key={t.id} onClick={() => navigate("/kanban")} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition cursor-pointer">
                  <div className={`w-1 h-9 rounded-full ${t.status === "done" ? "bg-success" : t.status === "in_progress" ? "bg-primary" : t.status === "review" ? "bg-warning" : "bg-muted-foreground/40"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{client?.name ?? "—"} · {assignee?.name ?? "—"}</p>
                  </div>
                  <Badge variant={due.tone === "destructive" ? "destructive" : "secondary"} className="text-[10px] shrink-0">{due.label}</Badge>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}