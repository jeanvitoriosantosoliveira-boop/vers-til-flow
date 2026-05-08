import { useMemo, useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { useApp } from "@/store/AppStore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Briefcase, Calendar, Mail, ListTodo, Clock, Heart, Star,
  DollarSign, FileDown, Plus, Trash2, TrendingUp, CheckCircle2, AlertTriangle, Save, Edit3
} from "lucide-react";
import { formatSeconds, formatDate } from "@/lib/format";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { exportReportPdf } from "@/lib/exportPdf";

export default function TeamMemberDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { users, tasks, clients, timeEntries, currentUser, teamNotes, addTeamNote, deleteTeamNote, updateUser } = useApp();

  if (currentUser.role !== "leader") return <Navigate to="/" replace />;

  const member = users.find(u => u.id === id);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ position: "", salary: 0, tax_rate: 0, hire_date: "" });

  if (!member) return (
    <div className="max-w-3xl mx-auto py-12 text-center">
      <p className="text-muted-foreground mb-4">Funcionário não encontrado.</p>
      <Button onClick={() => navigate("/team")}>Voltar</Button>
    </div>
  );

  const memberTasks = tasks.filter(t => t.assignee_id === member.id);
  const recentTasks = [...memberTasks].sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 10);
  const memberEntries = timeEntries.filter(e => e.user_id === member.id).sort((a,b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());
  const totalSeconds = memberEntries.reduce((s,e) => s+e.seconds, 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const monthSeconds = memberEntries.filter(e => new Date(e.logged_at) >= monthStart).reduce((s,e) => s+e.seconds, 0);

  const memberClientIds = [...new Set(memberTasks.map(t => t.client_id).filter(Boolean) as string[])];
  const memberClients = clients.filter(c => memberClientIds.includes(c.id));
  const avgSatisfaction = memberClients.length
    ? memberClients.reduce((s,c) => s + (c.satisfaction ?? 0), 0) / memberClients.length
    : 0;

  const done = memberTasks.filter(t => t.status === "done").length;
  const late = memberTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done").length;
  const onTime = memberTasks.filter(t => t.status === "done" && t.due_date && new Date(t.updated_at) <= new Date(t.due_date)).length;
  const onTimeRate = done ? Math.round((onTime / done) * 100) : 0;
  const completionRate = memberTasks.length ? Math.round((done / memberTasks.length) * 100) : 0;
  const avgPerTask = done ? Math.round(totalSeconds / done) : 0;

  // Trend: 12 semanas
  const trend = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const start = new Date(); start.setDate(start.getDate() - (11 - i) * 7); start.setHours(0,0,0,0);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    const sec = memberEntries.filter(e => {
      const t = new Date(e.logged_at).getTime();
      return t >= start.getTime() && t < end.getTime();
    }).reduce((s,e) => s+e.seconds, 0);
    return { wk: start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), horas: +(sec/3600).toFixed(1) };
  }), [memberEntries]);

  const notes = teamNotes.filter(n => n.user_id === member.id);

  // Custos
  const salary = member.salary ?? 0;
  const taxRate = member.tax_rate ?? 32;
  const taxValue = salary * (taxRate / 100);
  const totalCost = salary + taxValue;

  function startEdit() {
    setDraft({
      position: member!.position ?? "",
      salary: member!.salary ?? 0,
      tax_rate: member!.tax_rate ?? 32,
      hire_date: member!.hire_date ?? "",
    });
    setEditing(true);
  }
  function saveEdit() {
    updateUser(member!.id, { ...draft, hire_date: draft.hire_date || null });
    setEditing(false);
  }

  function exportPdf() {
    const stMap: Record<string,string> = { todo:"A Fazer", in_progress:"Em andamento", review:"Revisão", done:"Concluído" };
    exportReportPdf({
      title: `Funcionário — ${member!.name}`,
      subtitle: `${member!.position ?? ""} · ${member!.email}`,
      meta: {
        "Tarefas":     memberTasks.length,
        "Concluídas":  done,
        "Atrasadas":   late,
        "Horas total": formatSeconds(totalSeconds),
        "Horas mês":   formatSeconds(monthSeconds),
        "Satisfação clientes": `${avgSatisfaction.toFixed(1)} / 5`,
        "Salário":      `R$ ${salary.toLocaleString("pt-BR")}`,
        "Imposto":      `${taxRate}% (R$ ${taxValue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })})`,
        "Custo total":  `R$ ${totalCost.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
      },
      sections: [
        { title: "Tarefas recentes", head: ["Título","Cliente","Status","Atualizada"],
          rows: recentTasks.map(t => [t.title, clients.find(c => c.id === t.client_id)?.name ?? "—", stMap[t.status], formatDate(t.updated_at)]) },
        { title: "Clientes vinculados", head: ["Cliente","Satisfação","Saúde"],
          rows: memberClients.map(c => [c.name, `${(c.satisfaction ?? 0).toFixed(1)} / 5`, c.health ?? "—"]) },
      ],
      fileName: `funcionario-${member!.name.toLowerCase().replace(/\s+/g,'-')}.pdf`,
    });
  }

  return (
    <div className="max-w-7xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/team")} className="gap-2 mb-4 -ml-2"><ArrowLeft className="w-4 h-4" /> Equipe</Button>

      {/* Hero */}
      <Card className="p-6 mb-6 relative overflow-hidden">
        <div className="absolute inset-0 gradient-glow opacity-50 pointer-events-none" />
        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-2xl font-display font-bold text-primary-foreground shadow-glow">
              {member.name.split(" ").map(n => n[0]).slice(0,2).join("")}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-display text-3xl font-bold tracking-tight">{member.name}</h1>
                {member.position && <Badge className="bg-accent/15 text-accent border-0 gap-1"><Briefcase className="w-3 h-3" /> {member.position}</Badge>}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2 flex-wrap">
                <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {member.email}</span>
                {member.hire_date && <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Desde {formatDate(member.hire_date)}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportPdf} className="gap-2"><FileDown className="w-4 h-4" /> Exportar PDF</Button>
            {!editing ? <Button onClick={startEdit} className="gap-2"><Edit3 className="w-4 h-4" /> Editar</Button>
                      : <Button onClick={saveEdit} className="gap-2"><Save className="w-4 h-4" /> Salvar</Button>}
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase mb-2"><ListTodo className="w-3.5 h-3.5" /> Tarefas</div>
          <p className="font-display text-2xl font-bold tabular-nums">{memberTasks.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{completionRate}% concluídas</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase mb-2"><Clock className="w-3.5 h-3.5" /> Horas (mês)</div>
          <p className="font-display text-2xl font-bold tabular-nums">{formatSeconds(monthSeconds)}</p>
          <p className="text-xs text-muted-foreground mt-1">Total: {formatSeconds(totalSeconds)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase mb-2"><CheckCircle2 className="w-3.5 h-3.5" /> No prazo</div>
          <p className="font-display text-2xl font-bold tabular-nums text-success">{onTimeRate}%</p>
          <p className="text-xs text-muted-foreground mt-1">{late} atrasada(s)</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase mb-2"><Star className="w-3.5 h-3.5" /> Satisfação clientes</div>
          <div className="flex items-center gap-1">
            {[1,2,3,4,5].map(n => (
              <Star key={n} className={`w-4 h-4 ${n <= Math.round(avgSatisfaction) ? "fill-warning text-warning" : "text-muted-foreground/30"}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{avgSatisfaction.toFixed(1)} / 5</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase mb-2"><TrendingUp className="w-3.5 h-3.5" /> Tempo médio/tarefa</div>
          <p className="font-display text-2xl font-bold tabular-nums">{formatSeconds(avgPerTask)}</p>
          <p className="text-xs text-muted-foreground mt-1">{done} concluídas</p>
        </Card>
      </div>

      {/* Editor */}
      {editing && (
        <Card className="p-6 mb-6 border-accent/40">
          <h3 className="font-display font-semibold mb-4">Dados profissionais e financeiros</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><Label>Cargo</Label><Input value={draft.position} onChange={(e) => setDraft({...draft, position: e.target.value})} /></div>
            <div><Label>Salário (R$)</Label><Input type="number" value={draft.salary} onChange={(e) => setDraft({...draft, salary: +e.target.value})} /></div>
            <div><Label>% Imposto/encargos</Label><Input type="number" value={draft.tax_rate} onChange={(e) => setDraft({...draft, tax_rate: +e.target.value})} /></div>
            <div><Label>Data de admissão</Label><Input type="date" value={draft.hire_date?.slice(0,10) ?? ""} onChange={(e) => setDraft({...draft, hire_date: e.target.value})} /></div>
          </div>
        </Card>
      )}

      {/* Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase mb-2"><DollarSign className="w-3.5 h-3.5" /> Salário bruto</div>
          <p className="font-display text-2xl font-bold tabular-nums">R$ {salary.toLocaleString("pt-BR")}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase mb-2"><DollarSign className="w-3.5 h-3.5" /> Encargos / Imposto</div>
          <p className="font-display text-2xl font-bold tabular-nums text-warning">+ R$ {taxValue.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-muted-foreground mt-1">{taxRate}% sobre salário</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase mb-2"><DollarSign className="w-3.5 h-3.5" /> Custo total mensal</div>
          <p className="font-display text-2xl font-bold tabular-nums text-destructive">R$ {totalCost.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Trend */}
        <Card className="p-6 lg:col-span-2">
          <h3 className="font-display font-semibold mb-1">Horas trabalhadas — 12 semanas</h3>
          <p className="text-xs text-muted-foreground mb-4">Volume semanal de horas lançadas</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="tmg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="wk" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} unit="h" />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Area type="monotone" dataKey="horas" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#tmg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Clientes */}
        <Card className="p-6">
          <h3 className="font-display font-semibold mb-1">Clientes vinculados</h3>
          <p className="text-xs text-muted-foreground mb-4">{memberClients.length} cliente(s)</p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {memberClients.map(c => (
              <div key={c.id} onClick={() => navigate(`/clients/${c.id}`)} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer">
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">{c.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4,5].map(n => <Star key={n} className={`w-3 h-3 ${n <= Math.round(c.satisfaction ?? 0) ? "fill-warning text-warning" : "text-muted-foreground/20"}`} />)}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">{c.health ?? "—"}</Badge>
              </div>
            ))}
            {!memberClients.length && <p className="text-xs text-muted-foreground">Nenhum cliente vinculado.</p>}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent tasks */}
        <Card className="p-6 lg:col-span-2">
          <h3 className="font-display font-semibold mb-4">Últimas tarefas lançadas</h3>
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
            {recentTasks.map(t => {
              const c = clients.find(x => x.id === t.client_id);
              const stMap: Record<string,string> = { todo:"A Fazer", in_progress:"Andamento", review:"Revisão", done:"Concluído" };
              return (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50">
                  <div className={`w-1 h-8 rounded-full ${t.status==="done"?"bg-success":t.status==="in_progress"?"bg-primary":t.status==="review"?"bg-warning":"bg-muted-foreground/40"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{c?.name ?? "—"} · atualizada {formatDate(t.updated_at)}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{stMap[t.status]}</Badge>
                </div>
              );
            })}
            {!recentTasks.length && <p className="text-sm text-muted-foreground text-center py-6">Sem tarefas.</p>}
          </div>
        </Card>

        {/* Notes */}
        <Card className="p-6">
          <h3 className="font-display font-semibold mb-3">Anotações do líder</h3>
          <div className="flex gap-2 mb-3">
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Feedback, evolução, pontos de atenção…" />
          </div>
          <Button size="sm" onClick={() => { if (note.trim()) { addTeamNote(member!.id, note.trim()); setNote(""); } }} className="w-full mb-4 gap-2"><Plus className="w-3 h-3" /> Adicionar anotação</Button>
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {notes.map(n => (
              <div key={n.id} className="bg-muted/40 rounded-lg p-3 text-sm group relative">
                <p className="whitespace-pre-line">{n.body}</p>
                <p className="text-[10px] text-muted-foreground mt-1.5">{formatDate(n.created_at)}</p>
                <button onClick={() => deleteTeamNote(n.id)} className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {!notes.length && <p className="text-xs text-muted-foreground">Nenhuma anotação ainda.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}