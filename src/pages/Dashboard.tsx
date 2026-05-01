import { useMemo } from "react";
import { useApp } from "@/store/AppStore";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Clock, AlertTriangle, ListTodo, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { relativeDue } from "@/lib/format";

export default function Dashboard() {
  const { tasks, clients, users, currentUser } = useApp();

  const visibleTasks = useMemo(
    () => currentUser.role === "leader" ? tasks : tasks.filter(t => t.assignee_id === currentUser.id),
    [tasks, currentUser]
  );

  const stats = useMemo(() => {
    const total = visibleTasks.length;
    const done = visibleTasks.filter(t => t.status === "done").length;
    const progress = visibleTasks.filter(t => t.status === "in_progress").length;
    const late = visibleTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done").length;
    return { total, done, progress, late, productivity: total ? Math.round((done / total) * 100) : 0 };
  }, [visibleTasks]);

  const byUser = useMemo(() => {
    return users.filter(u => u.role === "employee").map(u => ({
      name: u.name.split(" ")[0],
      concluidas: tasks.filter(t => t.assignee_id === u.id && t.status === "done").length,
      andamento: tasks.filter(t => t.assignee_id === u.id && t.status === "in_progress").length,
    }));
  }, [tasks, users]);

  const statusDist = useMemo(() => {
    const map: Record<string, string> = { todo: "A Fazer", in_progress: "Em Andamento", review: "Revisão", done: "Concluído" };
    const colors = ["hsl(var(--muted-foreground))", "hsl(var(--primary))", "hsl(var(--warning))", "hsl(var(--success))"];
    return Object.entries(map).map(([k, label], i) => ({
      name: label,
      value: visibleTasks.filter(t => t.status === k).length,
      fill: colors[i],
    }));
  }, [visibleTasks]);

  const recent = visibleTasks.slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title={`Olá, ${currentUser.name.split(" ")[0]} 👋`}
        subtitle={currentUser.role === "leader" ? "Visão geral da operação Versátil Digital." : "Aqui está o seu dia."}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tarefas totais" value={stats.total} icon={ListTodo} tone="accent" />
        <StatCard label="Em andamento" value={stats.progress} icon={Clock} tone="default" hint="Trabalho ativo" />
        <StatCard label="Concluídas" value={stats.done} icon={CheckCircle2} tone="success" hint={`${stats.productivity}% de conclusão`} />
        <StatCard label="Atrasadas" value={stats.late} icon={AlertTriangle} tone={stats.late ? "destructive" : "default"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display font-semibold text-lg">Produtividade da equipe</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Tarefas por funcionário</p>
            </div>
            <Badge variant="secondary" className="gap-1"><TrendingUp className="w-3 h-3" /> Semanal</Badge>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byUser} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                  cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="concluidas" name="Concluídas" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="andamento" name="Em andamento" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-display font-semibold text-lg mb-1">Distribuição</h3>
          <p className="text-xs text-muted-foreground mb-4">Por status</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {statusDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-4">
            {statusDist.map(s => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: s.fill }} />{s.name}</span>
                <span className="font-semibold tabular-nums">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-semibold text-lg">Tarefas recentes</h3>
        </div>
        <div className="space-y-2">
          {recent.map(t => {
            const due = relativeDue(t.due_date);
            const client = clients.find(c => c.id === t.client_id);
            const assignee = users.find(u => u.id === t.assignee_id);
            return (
              <div key={t.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
                <div className={`w-1 h-10 rounded-full ${t.status === "done" ? "bg-success" : t.status === "in_progress" ? "bg-primary" : t.status === "review" ? "bg-warning" : "bg-muted-foreground/40"}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{client?.name} · {assignee?.name}</p>
                </div>
                <Badge variant={due.tone === "destructive" ? "destructive" : "secondary"} className="text-[10px]">{due.label}</Badge>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}