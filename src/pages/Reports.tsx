import { useMemo, useState } from "react";
import { useApp } from "@/store/AppStore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatCard } from "@/components/StatCard";
import { Clock, CheckCircle2, ListTodo, Target } from "lucide-react";
import { formatSeconds } from "@/lib/format";

type Range = "7d" | "30d" | "90d";

export default function Reports() {
  const { tasks, users, clients, currentUser } = useApp();
  const [range, setRange] = useState<Range>("30d");

  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = Date.now() - days * 86400000;

  const visible = useMemo(
    () => currentUser.role === "leader" ? tasks : tasks.filter(t => t.assignee_id === currentUser.id),
    [tasks, currentUser]
  );

  const ranged = visible.filter(t => new Date(t.updated_at).getTime() >= cutoff);
  const done = ranged.filter(t => t.status === "done");
  const totalTime = ranged.reduce((s, t) => s + t.total_seconds, 0);
  const avgTime = done.length ? Math.round(totalTime / done.length) : 0;

  const trend = useMemo(() => {
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      const label = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
      const dayStart = new Date(d.toDateString()).getTime();
      const dayEnd = dayStart + 86400000;
      const count = visible.filter(t => t.status === "done" && new Date(t.updated_at).getTime() >= dayStart && new Date(t.updated_at).getTime() < dayEnd).length;
      return { day: label, concluidas: count };
    });
    return buckets;
  }, [visible]);

  const byClient = useMemo(() => clients.map(c => ({
    name: c.name.split(" ")[0],
    total: visible.filter(t => t.client_id === c.id).length,
    concluidas: visible.filter(t => t.client_id === c.id && t.status === "done").length,
  })), [clients, visible]);

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Relatórios"
        subtitle="Performance, tempo e tendências."
        actions={
          <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
            <TabsList>
              <TabsTrigger value="7d">7 dias</TabsTrigger>
              <TabsTrigger value="30d">30 dias</TabsTrigger>
              <TabsTrigger value="90d">90 dias</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tarefas no período" value={ranged.length} icon={ListTodo} tone="accent" />
        <StatCard label="Concluídas" value={done.length} icon={CheckCircle2} tone="success" />
        <StatCard label="Tempo total" value={formatSeconds(totalTime)} icon={Clock} tone="default" />
        <StatCard label="Tempo médio/tarefa" value={formatSeconds(avgTime)} icon={Target} tone="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-display font-semibold text-lg mb-1">Conclusões — últimos 7 dias</h3>
          <p className="text-xs text-muted-foreground mb-4">Tarefas finalizadas por dia</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Area type="monotone" dataKey="concluidas" stroke="hsl(var(--accent))" strokeWidth={2} fill="url(#gradArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-display font-semibold text-lg mb-1">Performance por cliente</h3>
          <p className="text-xs text-muted-foreground mb-4">Total vs. concluídas</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byClient}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
                <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="concluidas" name="Concluídas" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {currentUser.role === "leader" && (
          <Card className="p-6 lg:col-span-2">
            <h3 className="font-display font-semibold text-lg mb-4">Por funcionário</h3>
            <div className="space-y-3">
              {users.filter(u => u.role === "employee").map(u => {
                const userTasks = visible.filter(t => t.assignee_id === u.id);
                const userDone = userTasks.filter(t => t.status === "done").length;
                const pct = userTasks.length ? Math.round((userDone / userTasks.length) * 100) : 0;
                return (
                  <div key={u.id} className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-xs font-semibold text-primary-foreground">
                      {u.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{userDone}/{userTasks.length} · {pct}%</p>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full gradient-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}