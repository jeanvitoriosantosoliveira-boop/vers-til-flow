import { useMemo, useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router-dom";
import { useApp } from "@/store/AppStore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronLeft, ChevronRight, FileDown, Building, ListTodo, Users as UsersIcon, Wallet } from "lucide-react";
import { formatSeconds, formatDate } from "@/lib/format";
import { exportReportPdf } from "@/lib/exportPdf";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, Legend
} from "recharts";

const STATUS_LABEL: Record<string,string> = { todo:"A Fazer", in_progress:"Em andamento", review:"Revisão", done:"Concluído" };
const STATUS_COLOR: Record<string,string> = { todo:"hsl(var(--muted-foreground))", in_progress:"hsl(var(--primary))", review:"hsl(var(--warning))", done:"hsl(var(--success))" };
const BRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
const PAGE_SIZE = 20;

export default function ReportDetail() {
  const { type } = useParams<{ type: "clients" | "tasks" | "team" | "financial" }>();
  const navigate = useNavigate();
  const { clients, tasks, users, timeEntries, currentUser, expenses, extraServices } = useApp();
  const [taskPage, setTaskPage] = useState(0);
  const isLeader = currentUser.role === "leader";

  if (!type || !["clients","tasks","team","financial"].includes(type)) return <Navigate to="/reports" replace />;
  if (type === "financial" && !isLeader) return <Navigate to="/" replace />;
  if (type === "team" && !isLeader && !currentUser.is_manager) return <Navigate to="/" replace />;

  const meta = ({
    clients:   { title: "Relatório de Clientes",   icon: Building,   color: "from-primary to-accent" },
    tasks:     { title: "Relatório de Tarefas",    icon: ListTodo,   color: "from-accent to-success" },
    team:      { title: "Relatório de Equipe",     icon: UsersIcon,  color: "from-warning to-destructive" },
    financial: { title: "Relatório Financeiro",    icon: Wallet,     color: "from-success to-primary" },
  } as const)[type];
  const Icon = meta.icon;

  // ---------- DATA ----------
  const clientRows = useMemo(() => clients.map(c => {
    const ts = tasks.filter(t => t.client_id === c.id);
    const sec = timeEntries.filter(e => ts.some(t => t.id === e.task_id)).reduce((s,e) => s+e.seconds, 0);
    return { c, total: ts.length, done: ts.filter(t => t.status === "done").length, seconds: sec };
  }), [clients, tasks, timeEntries]);

  const taskStatusData = useMemo(() => {
    const counts: Record<string, number> = { todo: 0, in_progress: 0, review: 0, done: 0 };
    tasks.forEach(t => counts[t.status]++);
    return Object.entries(counts).map(([k,v]) => ({ name: STATUS_LABEL[k], value: v, color: STATUS_COLOR[k] }));
  }, [tasks]);

  const teamRows = useMemo(() => users.filter(u => u.role === "employee").map(u => {
    const ts = tasks.filter(t => t.assignee_id === u.id);
    const sec = timeEntries.filter(e => e.user_id === u.id).reduce((s,e) => s+e.seconds, 0);
    return { u, total: ts.length, done: ts.filter(t => t.status === "done").length, seconds: sec, hours: Math.round(sec/3600) };
  }), [users, tasks, timeEntries]);

  const now = new Date();
  const cmKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const monthRevenue = clients.filter(c => c.status === "active").reduce((s,c) => s + (c.monthly_fee ?? 0), 0)
    + extraServices.filter(s => s.date.startsWith(cmKey)).reduce((s,x) => s + x.amount, 0);
  const monthExpenses = expenses.filter(e => e.date.startsWith(cmKey)).reduce((s,e) => s + e.amount, 0);
  const payroll = users.reduce((s,u) => s + (u.salary ?? 0) * (1 + (u.tax_rate ?? 32)/100), 0);

  // ---------- EXPORT ----------
  function exportPdf() {
    if (type === "clients") {
      exportReportPdf({
        title: meta.title, subtitle: `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
        meta: {
          "Clientes": clientRows.length,
          ...(isLeader ? { "Receita/mês": BRL(clients.reduce((s,c) => s+(c.monthly_fee ?? 0),0)) } : {}),
          "Horas totais": formatSeconds(clientRows.reduce((s,r) => s+r.seconds, 0)),
        },
        sections: [{ title: "Clientes", head: isLeader
          ? ["Cliente","Empresa","Mensalidade","Tarefas","Concluídas","Horas","Saúde"]
          : ["Cliente","Empresa","Tarefas","Concluídas","Horas","Saúde"],
          rows: clientRows.map(r => isLeader
            ? [r.c.name, r.c.company ?? "—", BRL(r.c.monthly_fee ?? 0), r.total, r.done, formatSeconds(r.seconds), r.c.health ?? "—"]
            : [r.c.name, r.c.company ?? "—", r.total, r.done, formatSeconds(r.seconds), r.c.health ?? "—"]) }],
        fileName: "relatorio-clientes.pdf",
      });
    } else if (type === "tasks") {
      exportReportPdf({
        title: meta.title, subtitle: `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
        meta: { "Tarefas": tasks.length, "Concluídas": tasks.filter(t => t.status==="done").length, "Tempo total": formatSeconds(tasks.reduce((s,t) => s+t.total_seconds, 0)) },
        sections: [{ title: "Tarefas", head: ["Título","Cliente","Responsável","Status","Tempo","Prazo"],
          rows: tasks.map(t => [t.title, clients.find(c => c.id===t.client_id)?.name ?? "—", users.find(u => u.id===t.assignee_id)?.name ?? "—", STATUS_LABEL[t.status], formatSeconds(t.total_seconds), t.due_date ? formatDate(t.due_date) : "—"]) }],
        fileName: "relatorio-tarefas.pdf",
      });
    } else if (type === "team") {
      exportReportPdf({
        title: meta.title, subtitle: `Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
        meta: { "Funcionários": teamRows.length, "Horas totais": formatSeconds(teamRows.reduce((s,r) => s+r.seconds, 0)) },
        sections: [{ title: "Equipe", head: ["Nome","Cargo","Tarefas","Concluídas","Horas"],
          rows: teamRows.map(r => [r.u.name, r.u.position ?? "—", r.total, r.done, formatSeconds(r.seconds)]) }],
        fileName: "relatorio-equipe.pdf",
      });
    } else {
      exportReportPdf({
        title: meta.title, subtitle: `Mês de ${now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
        meta: { "Receita do mês": BRL(monthRevenue), "Despesas": BRL(monthExpenses), "Folha": BRL(payroll), "Lucro": BRL(monthRevenue - monthExpenses - payroll) },
        sections: [
          { title: "Mensalidades de clientes ativos", head: ["Cliente","Mensalidade"],
            rows: clients.filter(c => c.status === "active").map(c => [c.name, BRL(c.monthly_fee ?? 0)]) },
          { title: "Despesas (mês)", head: ["Data","Título","Categoria","Valor"],
            rows: expenses.filter(e => e.date.startsWith(cmKey)).map(e => [e.date, e.title, e.category, BRL(e.amount)]) },
        ],
        fileName: "relatorio-financeiro.pdf",
      });
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/reports")} className="gap-2 mb-4 -ml-2"><ArrowLeft className="w-4 h-4" /> Relatórios</Button>

      <Card className={`p-8 mb-6 relative overflow-hidden bg-gradient-to-br ${meta.color}`}>
        <div className="absolute inset-0 bg-background/85 backdrop-blur-xl" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground shadow-glow">
              <Icon className="w-7 h-7" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold">{meta.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">Visualização completa dos dados — exporte como PDF quando precisar.</p>
            </div>
          </div>
          <Button onClick={exportPdf} className="gap-2"><FileDown className="w-4 h-4" /> Baixar PDF</Button>
        </div>
      </Card>

      {type === "clients" && (
        <>
          <div className={`grid grid-cols-2 ${isLeader ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-4 mb-6`}>
            <KPI label="Total de clientes" value={clientRows.length.toString()} />
            <KPI label="Ativos"      value={clients.filter(c => c.status==="active").length.toString()} tone="success" />
            {isLeader && <KPI label="Receita/mês" value={BRL(clients.reduce((s,c) => s+(c.monthly_fee ?? 0), 0))} tone="primary" />}
            <KPI label="Horas totais" value={formatSeconds(clientRows.reduce((s,r) => s+r.seconds, 0))} />
          </div>
          {isLeader && (
            <Card className="p-6 mb-6">
              <h3 className="font-display font-semibold mb-4">Receita por cliente</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={clients.map(c => ({ name: c.name, Receita: c.monthly_fee ?? 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} formatter={(v: number) => BRL(v)} />
                    <Bar dataKey="Receita" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
          <DataTable head={isLeader ? ["Cliente","Mensalidade","Tarefas","Concluídas","Horas","Saúde"] : ["Cliente","Tarefas","Concluídas","Horas","Saúde"]} rows={clientRows.map(r => isLeader
            ? [r.c.name, BRL(r.c.monthly_fee ?? 0), r.total, r.done, formatSeconds(r.seconds), <Badge key={r.c.id} variant="outline">{r.c.health ?? "—"}</Badge>]
            : [r.c.name, r.total, r.done, formatSeconds(r.seconds), <Badge key={r.c.id} variant="outline">{r.c.health ?? "—"}</Badge>]
          )} />
        </>
      )}

      {type === "tasks" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPI label="Total tarefas"  value={tasks.length.toString()} />
            <KPI label="Em andamento"   value={tasks.filter(t => t.status==="in_progress").length.toString()} tone="primary" />
            <KPI label="Concluídas"     value={tasks.filter(t => t.status==="done").length.toString()} tone="success" />
            <KPI label="Atrasadas"      value={tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done").length.toString()} tone="destructive" />
          </div>
          <Card className="p-6 mb-6">
            <h3 className="font-display font-semibold mb-4">Distribuição por status</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={taskStatusData} dataKey="value" nameKey="name" outerRadius={100} innerRadius={60}>
                    {taskStatusData.map((d,i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <DataTable head={["Tarefa","Cliente","Responsável","Status","Tempo","Prazo"]} rows={tasks.slice(taskPage * PAGE_SIZE, (taskPage + 1) * PAGE_SIZE).map(t => [
            t.title, clients.find(c => c.id===t.client_id)?.name ?? "—", users.find(u => u.id===t.assignee_id)?.name ?? "—",
            <Badge key={t.id} variant="secondary">{STATUS_LABEL[t.status]}</Badge>, formatSeconds(t.total_seconds), t.due_date ? formatDate(t.due_date) : "—"
          ])} />
          {tasks.length > PAGE_SIZE && (
            <div className="flex items-center justify-between p-3 border-t border-border text-xs mt-0">
              <span className="text-muted-foreground">
                Mostrando {taskPage * PAGE_SIZE + 1}–{Math.min((taskPage + 1) * PAGE_SIZE, tasks.length)} de {tasks.length}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={taskPage === 0} onClick={() => setTaskPage(p => Math.max(0, p - 1))} className="gap-1">
                  <ChevronLeft className="w-3 h-3" /> Anterior
                </Button>
                <Button size="sm" variant="outline" disabled={(taskPage + 1) * PAGE_SIZE >= tasks.length} onClick={() => setTaskPage(p => p + 1)} className="gap-1">
                  Próximo <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {type === "team" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPI label="Funcionários" value={teamRows.length.toString()} />
            <KPI label="Tarefas"      value={teamRows.reduce((s,r) => s+r.total, 0).toString()} tone="primary" />
            <KPI label="Concluídas"   value={teamRows.reduce((s,r) => s+r.done, 0).toString()} tone="success" />
            <KPI label="Horas totais" value={formatSeconds(teamRows.reduce((s,r) => s+r.seconds, 0))} />
          </div>
          <Card className="p-6 mb-6">
            <h3 className="font-display font-semibold mb-4">Horas por funcionário</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamRows.map(r => ({ name: r.u.name.split(" ")[0], Horas: r.hours }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit="h" />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                  <Bar dataKey="Horas" fill="hsl(var(--accent))" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <DataTable head={["Funcionário","Cargo","Tarefas","Concluídas","Horas"]} rows={teamRows.map(r => [
            r.u.name, r.u.position ?? "—", r.total, r.done, formatSeconds(r.seconds)
          ])} />
        </>
      )}

      {type === "financial" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KPI label="Receita do mês" value={BRL(monthRevenue)} tone="success" />
            <KPI label="Despesas"       value={BRL(monthExpenses)} tone="destructive" />
            <KPI label="Folha"          value={BRL(payroll)} tone="warning" />
            <KPI label="Lucro"          value={BRL(monthRevenue - monthExpenses - payroll)} tone="primary" />
          </div>
          <DataTable head={["Cliente","Mensalidade"]} rows={clients.filter(c => c.status === "active").map(c => [c.name, BRL(c.monthly_fee ?? 0)])} />
        </>
      )}
    </div>
  );
}

function KPI({ label, value, tone = "default" }: { label: string; value: string; tone?: "default"|"success"|"primary"|"warning"|"destructive" }) {
  const colors: Record<string,string> = { default:"text-foreground", success:"text-success", primary:"text-primary", warning:"text-warning", destructive:"text-destructive" };
  return (
    <Card className="p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">{label}</p>
      <p className={`font-display text-2xl font-bold tabular-nums ${colors[tone]}`}>{value}</p>
    </Card>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: (string | number | JSX.Element)[][] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>{head.map(h => <th key={h} className="text-left px-4 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border hover:bg-muted/30">
                {r.map((cell, j) => <td key={j} className="px-4 py-3">{cell as any}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}