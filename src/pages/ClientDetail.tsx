import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "@/store/AppStore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Building2, Mail, Phone, Calendar, DollarSign, Clock, Star, Save, Heart, FileDown, AlertTriangle, CheckCircle2, Sparkles, Edit3 } from "lucide-react";
import { formatSeconds, formatDate } from "@/lib/format";
import type { Client } from "@/types";
import { exportReportPdf } from "@/lib/exportPdf";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

const healthMap = {
  great:   { label: "Excelente", color: "text-success", bg: "bg-success/15", bar: "bg-success" },
  good:    { label: "Saudável",  color: "text-primary", bg: "bg-primary/15", bar: "bg-primary" },
  warning: { label: "Atenção",   color: "text-warning", bg: "bg-warning/15", bar: "bg-warning" },
  risk:    { label: "Em risco",  color: "text-destructive", bg: "bg-destructive/15", bar: "bg-destructive" },
};

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { clients, tasks, users, timeEntries, currentUser, updateClient } = useApp();
  const client = clients.find(c => c.id === id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Client>>({});

  if (!client) return (
    <div className="max-w-3xl mx-auto py-12 text-center">
      <p className="text-muted-foreground mb-4">Cliente não encontrado.</p>
      <Button onClick={() => navigate("/clients")}>Voltar</Button>
    </div>
  );

  const isLeader = currentUser.role === "leader";
  const clientTasks = tasks.filter(t => t.client_id === client.id);
  const done = clientTasks.filter(t => t.status === "done").length;
  const inProgress = clientTasks.filter(t => t.status === "in_progress").length;
  const late = clientTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done").length;

  // Tempo do mês atual
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const clientEntries = timeEntries.filter(e => clientTasks.some(t => t.id === e.task_id));
  const monthSeconds = clientEntries.filter(e => new Date(e.logged_at) >= monthStart).reduce((s,e) => s+e.seconds, 0);
  const totalSeconds = clientEntries.reduce((s,e) => s+e.seconds, 0);
  const monthHours = monthSeconds / 3600;
  const target = client.monthly_hours_target ?? 40;
  const usagePct = Math.min(200, Math.round((monthHours / target) * 100));
  const overTarget = monthHours > target;

  // Custo (R$/h estimado a partir da mensalidade)
  const fee = client.monthly_fee ?? 0;
  const ratePerHour = target > 0 ? fee / target : 0;
  const monthCost = monthHours * ratePerHour;
  const profit = fee - monthCost;

  // Trend 6 meses (simulado a partir das entries reais)
  const monthsTrend = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i)); d.setDate(1); d.setHours(0,0,0,0);
    const next = new Date(d); next.setMonth(d.getMonth() + 1);
    const sec = clientEntries.filter(e => {
      const t = new Date(e.logged_at).getTime();
      return t >= d.getTime() && t < next.getTime();
    }).reduce((s,e) => s+e.seconds, 0);
    return { mes: d.toLocaleDateString("pt-BR", { month: "short" }), horas: +(sec/3600).toFixed(1), meta: target };
  }), [clientEntries, target]);

  // Distribuição por funcionário
  const byUser = useMemo(() => {
    const map = new Map<string, number>();
    clientEntries.forEach(e => map.set(e.user_id, (map.get(e.user_id) ?? 0) + e.seconds));
    return [...map.entries()].map(([uid, s]) => ({ user: users.find(u => u.id === uid), seconds: s }))
      .filter(x => x.user).sort((a,b) => b.seconds - a.seconds);
  }, [clientEntries, users]);

  const health = healthMap[client.health ?? "good"];

  function startEdit() { setDraft(client!); setEditing(true); }
  function saveEdit() { updateClient(client!.id, draft); setEditing(false); }

  function exportPdf() {
    exportReportPdf({
      title: `Relatório do cliente — ${client!.name}`,
      subtitle: client!.company ?? "",
      meta: {
        "Mensalidade": `R$ ${fee.toLocaleString("pt-BR")}`,
        "Meta de horas/mês": `${target}h`,
        "Horas no mês": `${monthHours.toFixed(1)}h (${usagePct}%)`,
        "Satisfação": `${(client!.satisfaction ?? 0).toFixed(1)} / 5`,
        "Saúde": health.label,
        "Início do contrato": client!.contract_start ? formatDate(client!.contract_start) : "—",
      },
      sections: [
        { title: "Serviços contratados", head: ["Serviço"], rows: (client!.services ?? []).map(s => [s]) },
        { title: "Tarefas", head: ["Título","Status","Responsável","Tempo","Prazo"],
          rows: clientTasks.map(t => {
            const a = users.find(u => u.id === t.assignee_id);
            const stMap: any = { todo:"A Fazer", in_progress:"Em andamento", review:"Revisão", done:"Concluído" };
            return [t.title, stMap[t.status], a?.name ?? "—", formatSeconds(t.total_seconds), t.due_date ? formatDate(t.due_date) : "—"];
          }),
        },
        { title: "Tempo por funcionário", head: ["Funcionário","Tempo","% do total"],
          rows: byUser.map(({ user, seconds }) => [
            user!.name, formatSeconds(seconds),
            totalSeconds ? `${Math.round(seconds/totalSeconds*100)}%` : "0%",
          ]),
        },
      ],
      fileName: `cliente-${client!.name.toLowerCase().replace(/\s+/g,'-')}.pdf`,
    });
  }

  return (
    <div className="max-w-7xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/clients")} className="gap-2 mb-4 -ml-2"><ArrowLeft className="w-4 h-4" /> Clientes</Button>

      {/* Hero */}
      <Card className="p-6 mb-6 relative overflow-hidden">
        <div className="absolute inset-0 gradient-glow opacity-50 pointer-events-none" />
        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-2xl font-display font-bold text-primary-foreground shadow-glow">
              {client.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-display text-3xl font-bold tracking-tight">{client.name}</h1>
                <Badge className={`${health.bg} ${health.color} border-0 gap-1`}>
                  <Sparkles className="w-3 h-3" /> {health.label}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2 flex-wrap">
                {client.company && <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {client.company}</span>}
                {client.email && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {client.email}</span>}
                {client.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {client.phone}</span>}
                {client.contract_start && <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Cliente desde {formatDate(client.contract_start)}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportPdf} className="gap-2"><FileDown className="w-4 h-4" /> Exportar PDF</Button>
            {isLeader && !editing && <Button onClick={startEdit} className="gap-2"><Edit3 className="w-4 h-4" /> Editar dados</Button>}
            {isLeader && editing && <Button onClick={saveEdit} className="gap-2"><Save className="w-4 h-4" /> Salvar</Button>}
          </div>
        </div>
      </Card>

      {/* Métricas chave */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${isLeader ? 4 : 2} gap-4 mb-6`}>
        {isLeader && (
          <Card className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2">
              <DollarSign className="w-3.5 h-3.5" /> Mensalidade
            </div>
            <p className="font-display text-2xl font-bold tabular-nums">R$ {fee.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground mt-1">≈ R$ {ratePerHour.toFixed(0)}/h sobre meta</p>
          </Card>
        )}
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2">
            <Clock className="w-3.5 h-3.5" /> Horas no mês
          </div>
          <p className="font-display text-2xl font-bold tabular-nums">{monthHours.toFixed(1)}<span className="text-base text-muted-foreground">/{target}h</span></p>
          <p className={`text-xs mt-1 ${overTarget ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
            {overTarget ? `Estourou ${(monthHours-target).toFixed(1)}h` : `Restam ${(target-monthHours).toFixed(1)}h`}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2">
            <Star className="w-3.5 h-3.5" /> Satisfação
          </div>
          <div className="flex items-center gap-1">
            {[1,2,3,4,5].map(n => (
              <Star key={n} className={`w-5 h-5 ${n <= Math.round(client.satisfaction ?? 0) ? "fill-warning text-warning" : "text-muted-foreground/30"}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{(client.satisfaction ?? 0).toFixed(1)} / 5</p>
        </Card>
        {isLeader && (
          <Card className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2">
              <Heart className="w-3.5 h-3.5" /> Lucro estimado
            </div>
            <p className={`font-display text-2xl font-bold tabular-nums ${profit < 0 ? "text-destructive" : "text-success"}`}>
              R$ {profit.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Mensalidade − custo de horas</p>
          </Card>
        )}
      </div>

      {/* Barra de uso vs meta */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display font-semibold">Consumo de horas vs meta mensal</h3>
            <p className="text-xs text-muted-foreground">Quanto da sua equipe está sendo dedicado a este cliente</p>
          </div>
          <Badge variant={overTarget ? "destructive" : usagePct > 80 ? "secondary" : "outline"}>{usagePct}%</Badge>
        </div>
        <div className="relative h-3 rounded-full bg-muted overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-success/30" style={{ width: "70%" }} />
          <div className="absolute inset-y-0 left-[70%] bg-warning/30" style={{ width: "30%" }} />
          <div
            className={`absolute inset-y-0 left-0 ${usagePct > 100 ? "bg-destructive" : usagePct > 80 ? "bg-warning" : "bg-success"} transition-all duration-500`}
            style={{ width: `${Math.min(100, usagePct)}%` }}
          />
          {usagePct > 100 && (
            <div className="absolute inset-y-0 left-full -translate-x-full bg-destructive animate-pulse" style={{ width: `${Math.min(100, usagePct - 100)}%` }} />
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5 uppercase">
          <span>0h</span>
          <span>{Math.round(target * 0.7)}h saudável</span>
          <span>{target}h meta</span>
          <span className="text-destructive">excesso</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-6 lg:col-span-2">
          <h3 className="font-display font-semibold mb-1">Histórico de horas</h3>
          <p className="text-xs text-muted-foreground mb-4">Últimos 6 meses · linha pontilhada = meta</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthsTrend}>
                <defs>
                  <linearGradient id="cdg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} unit="h" />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Area type="monotone" dataKey="meta" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" fill="transparent" strokeWidth={1} />
                <Area type="monotone" dataKey="horas" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#cdg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-display font-semibold mb-1">Serviços contratados</h3>
          <p className="text-xs text-muted-foreground mb-4">{(client.services ?? []).length} ativos</p>
          <div className="flex flex-wrap gap-2">
            {(client.services ?? []).map(s => (
              <Badge key={s} variant="secondary" className="bg-accent/10 text-accent border-accent/20">{s}</Badge>
            ))}
            {!(client.services?.length) && <p className="text-xs text-muted-foreground">Nenhum serviço cadastrado.</p>}
          </div>

          <div className="border-t border-border my-4" />
          <h4 className="text-sm font-semibold mb-2">Equipe envolvida</h4>
          <div className="space-y-2">
            {byUser.map(({ user, seconds }) => (
              <div key={user!.id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-[10px] font-semibold text-primary-foreground">
                  {user!.name.split(" ").map(n => n[0]).slice(0,2).join("")}
                </div>
                <span className="text-sm flex-1 truncate">{user!.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{formatSeconds(seconds)}</span>
              </div>
            ))}
            {!byUser.length && <p className="text-xs text-muted-foreground">Sem horas lançadas.</p>}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold">Tarefas ({clientTasks.length})</h3>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-success" /> {done} concluídas</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-primary" /> {inProgress} em andamento</span>
              {late > 0 && <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="w-3 h-3" /> {late} atrasadas</span>}
            </div>
          </div>
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
            {clientTasks.map(t => {
              const a = users.find(u => u.id === t.assignee_id);
              return (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className={`w-1 h-8 rounded-full ${t.status==="done"?"bg-success":t.status==="in_progress"?"bg-primary":t.status==="review"?"bg-warning":"bg-muted-foreground/40"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{a?.name ?? "Sem responsável"} · {formatSeconds(t.total_seconds)}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{t.status==="done"?"Concluído":t.status==="in_progress"?"Andamento":t.status==="review"?"Revisão":"A Fazer"}</Badge>
                </div>
              );
            })}
            {!clientTasks.length && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tarefa para este cliente.</p>}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-display font-semibold mb-3">Notas</h3>
          {editing ? (
            <Textarea rows={6} value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          ) : (
            <p className="text-sm text-muted-foreground whitespace-pre-line">{client.notes || "Sem notas adicionadas."}</p>
          )}
        </Card>
      </div>

      {/* Painel de edição (líder) */}
      {editing && isLeader && (
        <Card className="p-6 mt-6 border-accent/40">
          <h3 className="font-display font-semibold mb-4">Editar dados do cliente</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>Nome</Label><Input value={draft.name ?? ""} onChange={(e) => setDraft({...draft, name: e.target.value})} /></div>
            <div><Label>Empresa</Label><Input value={draft.company ?? ""} onChange={(e) => setDraft({...draft, company: e.target.value})} /></div>
            <div><Label>Segmento</Label><Input value={draft.segment ?? ""} onChange={(e) => setDraft({...draft, segment: e.target.value})} /></div>
            <div><Label>Email</Label><Input type="email" value={draft.email ?? ""} onChange={(e) => setDraft({...draft, email: e.target.value})} /></div>
            <div><Label>Telefone</Label><Input value={draft.phone ?? ""} onChange={(e) => setDraft({...draft, phone: e.target.value})} /></div>
            <div><Label>Início do contrato</Label><Input type="date" value={draft.contract_start?.slice(0,10) ?? ""} onChange={(e) => setDraft({...draft, contract_start: e.target.value})} /></div>
            <div><Label>Mensalidade (R$)</Label><Input type="number" value={draft.monthly_fee ?? 0} onChange={(e) => setDraft({...draft, monthly_fee: +e.target.value})} /></div>
            <div><Label>Meta de horas/mês</Label><Input type="number" value={draft.monthly_hours_target ?? 0} onChange={(e) => setDraft({...draft, monthly_hours_target: +e.target.value})} /></div>
            <div>
              <Label>Saúde do cliente</Label>
              <Select value={draft.health ?? "good"} onValueChange={(v) => setDraft({...draft, health: v as Client["health"]})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="great">Excelente</SelectItem>
                  <SelectItem value="good">Saudável</SelectItem>
                  <SelectItem value="warning">Atenção</SelectItem>
                  <SelectItem value="risk">Em risco</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Label>Satisfação ({(draft.satisfaction ?? 0).toFixed(1)} / 5)</Label>
              <input type="range" min={0} max={5} step={0.1} value={draft.satisfaction ?? 0}
                onChange={(e) => setDraft({...draft, satisfaction: +e.target.value})}
                className="w-full accent-[hsl(var(--accent))]" />
            </div>
            <div className="md:col-span-3">
              <Label>Serviços contratados (separados por vírgula)</Label>
              <Input value={(draft.services ?? []).join(", ")}
                onChange={(e) => setDraft({...draft, services: e.target.value.split(",").map(s => s.trim()).filter(Boolean)})} />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}