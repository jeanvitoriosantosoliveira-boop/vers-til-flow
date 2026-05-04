import { useMemo, useState } from "react";
import { useApp } from "@/store/AppStore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Trash, TrendingUp, CalendarDays, Target } from "lucide-react";
import { formatSeconds, formatDate } from "@/lib/format";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { StatCard } from "@/components/StatCard";

export default function TimeTracking() {
  const { tasks, clients, users, currentUser, timeEntries, logTime, deleteTimeEntry } = useApp();

  const [taskId, setTaskId] = useState<string>("");
  const [hoursStr, setHoursStr] = useState("");
  const [minutesStr, setMinutesStr] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const isLeader = currentUser.role === "leader";

  const visibleTasks = useMemo(
    () => isLeader ? tasks : tasks.filter(t => t.assignee_id === currentUser.id),
    [tasks, isLeader, currentUser.id]
  );

  const visibleEntries = useMemo(
    () => timeEntries
      .filter(e => isLeader || e.user_id === currentUser.id)
      .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()),
    [timeEntries, isLeader, currentUser.id]
  );

  const today = new Date(); today.setHours(0,0,0,0);
  const last7 = new Date(today.getTime() - 6 * 86400000);
  const last30 = new Date(today.getTime() - 29 * 86400000);

  const sumIn = (from: Date) => visibleEntries
    .filter(e => new Date(e.logged_at) >= from)
    .reduce((s, e) => s + e.seconds, 0);

  const todaySec = sumIn(today);
  const week = sumIn(last7);
  const month = sumIn(last30);
  const avgDay = Math.round(month / 30);

  // Trend 14 dias
  const trend = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today.getTime() - (13 - i) * 86400000);
    const next = new Date(d.getTime() + 86400000);
    const sec = visibleEntries.filter(e => {
      const t = new Date(e.logged_at).getTime();
      return t >= d.getTime() && t < next.getTime();
    }).reduce((s, e) => s + e.seconds, 0);
    return { day: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), horas: +(sec / 3600).toFixed(1) };
  }), [visibleEntries]);

  // Top tarefas e clientes (no mês)
  const monthEntries = visibleEntries.filter(e => new Date(e.logged_at) >= last30);
  const topTasks = useMemo(() => {
    const map = new Map<string, number>();
    monthEntries.forEach(e => map.set(e.task_id, (map.get(e.task_id) ?? 0) + e.seconds));
    return [...map.entries()].map(([id, s]) => ({ task: tasks.find(t => t.id === id), seconds: s }))
      .filter(x => x.task).sort((a,b) => b.seconds - a.seconds).slice(0, 6);
  }, [monthEntries, tasks]);

  const topClients = useMemo(() => {
    const map = new Map<string, number>();
    monthEntries.forEach(e => {
      const t = tasks.find(x => x.id === e.task_id);
      if (t?.client_id) map.set(t.client_id, (map.get(t.client_id) ?? 0) + e.seconds);
    });
    const total = [...map.values()].reduce((a,b) => a + b, 0) || 1;
    return [...map.entries()].map(([id, s]) => ({
      client: clients.find(c => c.id === id), seconds: s, pct: Math.round((s / total) * 100),
    })).filter(x => x.client).sort((a,b) => b.seconds - a.seconds);
  }, [monthEntries, tasks, clients]);

  async function submit() {
    if (!taskId) return;
    const h = parseFloat(hoursStr || "0") || 0;
    const m = parseFloat(minutesStr || "0") || 0;
    const seconds = Math.round(h * 3600 + m * 60);
    if (seconds <= 0) return;
    await logTime({ task_id: taskId, seconds, description: desc.trim() || undefined, logged_at: new Date(date).toISOString() });
    setHoursStr(""); setMinutesStr(""); setDesc("");
  }

  // Group entries by day for timeline
  const grouped = useMemo(() => {
    const map = new Map<string, typeof visibleEntries>();
    visibleEntries.forEach(e => {
      const k = e.logged_at.slice(0, 10);
      if (!map.has(k)) map.set(k, [] as any);
      map.get(k)!.push(e);
    });
    return [...map.entries()].slice(0, 10);
  }, [visibleEntries]);

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title="Controle de tempo" subtitle="Lance horas trabalhadas e acompanhe sua produtividade." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Hoje" value={formatSeconds(todaySec)} icon={Clock} tone="accent" />
        <StatCard label="Últimos 7 dias" value={formatSeconds(week)} icon={CalendarDays} tone="default" />
        <StatCard label="Últimos 30 dias" value={formatSeconds(month)} icon={TrendingUp} tone="success" />
        <StatCard label="Média diária (30d)" value={formatSeconds(avgDay)} icon={Target} tone="warning" />
      </div>

      {/* Lançamento rápido */}
      <Card className="p-6 mb-6 relative overflow-hidden">
        <div className="absolute inset-0 gradient-glow opacity-40 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground shadow-glow">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-semibold">Lançar horas</h3>
              <p className="text-xs text-muted-foreground">Sem cronômetro — registre quando terminar a atividade.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4">
              <Label className="text-[10px] uppercase">Tarefa</Label>
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger><SelectValue placeholder="Selecione uma tarefa" /></SelectTrigger>
                <SelectContent>
                  {visibleTasks.filter(t => t.status !== "done").map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1">
              <Label className="text-[10px] uppercase">H</Label>
              <Input type="number" min="0" value={hoursStr} onChange={(e) => setHoursStr(e.target.value)} placeholder="0" />
            </div>
            <div className="md:col-span-1">
              <Label className="text-[10px] uppercase">Min</Label>
              <Input type="number" min="0" max="59" value={minutesStr} onChange={(e) => setMinutesStr(e.target.value)} placeholder="0" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-[10px] uppercase">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <Label className="text-[10px] uppercase">O que foi feito</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Atividade" />
            </div>
            <div className="md:col-span-1 flex items-end">
              <Button onClick={submit} className="w-full">Lançar</Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold">Horas por dia</h3>
              <p className="text-xs text-muted-foreground">Últimos 14 dias</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="ttg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} unit="h" />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Area type="monotone" dataKey="horas" stroke="hsl(var(--accent))" strokeWidth={2} fill="url(#ttg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-display font-semibold mb-1">Distribuição por cliente</h3>
          <p className="text-xs text-muted-foreground mb-4">Mês atual</p>
          <div className="space-y-3">
            {topClients.length === 0 && <p className="text-xs text-muted-foreground">Sem lançamentos no mês.</p>}
            {topClients.map(({ client, seconds, pct }) => (
              <div key={client!.id}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium truncate">{client!.name}</span>
                  <span className="tabular-nums text-muted-foreground">{formatSeconds(seconds)} · {pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full gradient-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <h3 className="font-display font-semibold mb-4">Linha do tempo de lançamentos</h3>
          <div className="space-y-5">
            {grouped.length === 0 && <p className="text-sm text-muted-foreground">Nenhum lançamento ainda. Use o formulário acima ou abra uma tarefa no Kanban.</p>}
            {grouped.map(([day, entries]) => {
              const total = entries.reduce((s, e) => s + e.seconds, 0);
              return (
                <div key={day}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-2 h-2 rounded-full bg-accent shadow-glow" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{formatDate(day)}</p>
                    <Badge variant="secondary" className="text-[10px]">{formatSeconds(total)}</Badge>
                  </div>
                  <div className="ml-1 border-l-2 border-border pl-5 space-y-2">
                    {entries.map(e => {
                      const task = tasks.find(t => t.id === e.task_id);
                      const client = task ? clients.find(c => c.id === task.client_id) : null;
                      const u = users.find(x => x.id === e.user_id);
                      const canDelete = isLeader || e.user_id === currentUser.id;
                      return (
                        <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors group">
                          <div className="font-display font-bold tabular-nums text-accent w-20 text-sm">{formatSeconds(e.seconds)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{task?.title ?? "—"}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {client?.name ?? "Sem cliente"} · {u?.name}
                              {e.description && <> · {e.description}</>}
                            </p>
                          </div>
                          {canDelete && (
                            <button onClick={() => deleteTimeEntry(e.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-display font-semibold mb-1">Top tarefas do mês</h3>
          <p className="text-xs text-muted-foreground mb-4">Onde seu tempo foi gasto</p>
          <div className="space-y-2">
            {topTasks.length === 0 && <p className="text-xs text-muted-foreground">Sem dados.</p>}
            {topTasks.map(({ task, seconds }, i) => (
              <div key={task!.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50">
                <span className="font-display text-xs font-bold text-muted-foreground w-5">#{i+1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate font-medium">{task!.title}</p>
                  <p className="text-[10px] text-muted-foreground">{clients.find(c => c.id === task!.client_id)?.name ?? "—"}</p>
                </div>
                <span className="text-xs tabular-nums font-semibold text-accent">{formatSeconds(seconds)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}