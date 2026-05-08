import { useMemo, useState } from "react";
import { useApp } from "@/store/AppStore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDown, Search, FileSpreadsheet, Users as UsersIcon, ListTodo, Building, Wallet, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatSeconds, formatDate } from "@/lib/format";
import { exportReportPdf } from "@/lib/exportPdf";
import { PeriodFilter, type Period, inPeriod } from "@/components/PeriodFilter";

type Tab = "clients" | "tasks" | "team";

const statusLabel: Record<string,string> = { todo:"A Fazer", in_progress:"Em andamento", review:"Revisão", done:"Concluído" };

export default function Reports() {
  const { clients, tasks, users, timeEntries, currentUser } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("clients");
  const [period, setPeriod] = useState<Period>({ preset: "month" });
  const [q, setQ] = useState("");
  const isLeader = currentUser.role === "leader";

  const periodEntries = useMemo(() => timeEntries.filter(e => inPeriod(e.logged_at, period)), [timeEntries, period]);
  const periodTasks = useMemo(() => tasks.filter(t => inPeriod(t.created_at, period) || inPeriod(t.updated_at, period)), [tasks, period]);

  // ---------- CLIENTS ----------
  const clientRows = useMemo(() => clients.map(c => {
    const ts = tasks.filter(t => t.client_id === c.id);
    const tsRange = periodTasks.filter(t => t.client_id === c.id);
    const sec = periodEntries.filter(e => ts.some(t => t.id === e.task_id)).reduce((s,e) => s+e.seconds, 0);
    const done = tsRange.filter(t => t.status === "done").length;
    const target = c.monthly_hours_target ?? 40;
    return { c, totalTasks: tsRange.length, done, seconds: sec, hours: sec/3600, target, fee: c.monthly_fee ?? 0 };
  }).filter(r => r.c.name.toLowerCase().includes(q.toLowerCase()) || (r.c.company ?? "").toLowerCase().includes(q.toLowerCase())),
    [clients, tasks, periodTasks, periodEntries, q]);

  // ---------- TASKS ----------
  const taskRows = useMemo(() => periodTasks
    .filter(t => t.title.toLowerCase().includes(q.toLowerCase()))
    .map(t => ({
      t,
      client: clients.find(c => c.id === t.client_id),
      assignee: users.find(u => u.id === t.assignee_id),
    })), [periodTasks, clients, users, q]);

  // ---------- TEAM ----------
  const teamRows = useMemo(() => users.filter(u => u.role === "employee").map(u => {
    const sec = periodEntries.filter(e => e.user_id === u.id).reduce((s,e) => s+e.seconds, 0);
    const ts = periodTasks.filter(t => t.assignee_id === u.id);
    const done = ts.filter(t => t.status === "done").length;
    const late = ts.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done").length;
    return { u, seconds: sec, tasks: ts.length, done, late };
  }).filter(r => r.u.name.toLowerCase().includes(q.toLowerCase())), [users, periodEntries, periodTasks, q]);

  function exportAll() {
    const periodLabel = period.preset === "week" ? "Últimos 7 dias" : period.preset === "month" ? "Último mês" : period.preset === "all" ? "Histórico completo" : "Período custom";
    if (tab === "clients") {
      exportReportPdf({
        title: "Relatório de Clientes",
        subtitle: periodLabel,
        meta: { "Clientes": clientRows.length, "Total horas": formatSeconds(clientRows.reduce((s,r) => s+r.seconds, 0)), "Receita/mês": `R$ ${clientRows.reduce((s,r) => s+r.fee, 0).toLocaleString("pt-BR")}` },
        sections: [{ title: "Clientes", head: ["Cliente","Mensalidade","Tarefas","Concluídas","Horas","Meta","Saúde"],
          rows: clientRows.map(r => [r.c.name, `R$ ${r.fee.toLocaleString("pt-BR")}`, r.totalTasks, r.done, `${r.hours.toFixed(1)}h`, `${r.target}h`, r.c.health ?? "—"]) }],
        fileName: "relatorio-clientes.pdf",
      });
    } else if (tab === "tasks") {
      exportReportPdf({
        title: "Relatório de Tarefas",
        subtitle: periodLabel,
        meta: { "Tarefas": taskRows.length, "Concluídas": taskRows.filter(r => r.t.status==="done").length, "Tempo total": formatSeconds(taskRows.reduce((s,r) => s+r.t.total_seconds, 0)) },
        sections: [{ title: "Tarefas", head: ["Título","Cliente","Responsável","Status","Prioridade","Tempo","Prazo"],
          rows: taskRows.map(({t, client, assignee}) => [t.title, client?.name ?? "—", assignee?.name ?? "—", statusLabel[t.status], t.priority, formatSeconds(t.total_seconds), t.due_date ? formatDate(t.due_date) : "—"]) }],
        fileName: "relatorio-tarefas.pdf",
      });
    } else {
      exportReportPdf({
        title: "Relatório da Equipe",
        subtitle: periodLabel,
        meta: { "Funcionários": teamRows.length, "Tempo total": formatSeconds(teamRows.reduce((s,r) => s+r.seconds, 0)) },
        sections: [{ title: "Equipe", head: ["Nome","Tarefas","Concluídas","Atrasadas","Horas"],
          rows: teamRows.map(r => [r.u.name, r.tasks, r.done, r.late, formatSeconds(r.seconds)]) }],
        fileName: "relatorio-equipe.pdf",
      });
    }
  }

  function exportClient(clientId: string) {
    const c = clients.find(x => x.id === clientId)!;
    const ts = tasks.filter(t => t.client_id === c.id);
    const sec = timeEntries.filter(e => ts.some(t => t.id === e.task_id)).reduce((s,e) => s+e.seconds, 0);
    exportReportPdf({
      title: `Cliente — ${c.name}`,
      subtitle: c.company ?? "",
      meta: { "Mensalidade": `R$ ${(c.monthly_fee ?? 0).toLocaleString("pt-BR")}`, "Meta": `${c.monthly_hours_target ?? 0}h/mês`, "Total horas": formatSeconds(sec), "Saúde": c.health ?? "—" },
      sections: [
        { title: "Serviços contratados", head: ["Serviço"], rows: (c.services ?? []).map(s => [s]) },
        { title: "Tarefas", head: ["Título","Status","Responsável","Tempo","Prazo"], rows: ts.map(t => [t.title, statusLabel[t.status], users.find(u => u.id===t.assignee_id)?.name ?? "—", formatSeconds(t.total_seconds), t.due_date ? formatDate(t.due_date) : "—"]) },
      ],
      fileName: `cliente-${c.name.toLowerCase().replace(/\s+/g,'-')}.pdf`,
    });
  }

  function exportEmployee(userId: string) {
    const u = users.find(x => x.id === userId)!;
    const ts = tasks.filter(t => t.assignee_id === u.id);
    const entries = timeEntries.filter(e => e.user_id === u.id);
    exportReportPdf({
      title: `Funcionário — ${u.name}`,
      subtitle: u.email,
      meta: { "Tarefas": ts.length, "Concluídas": ts.filter(t => t.status==="done").length, "Total horas": formatSeconds(entries.reduce((s,e) => s+e.seconds, 0)) },
      sections: [
        { title: "Tarefas", head: ["Título","Cliente","Status","Tempo","Prazo"], rows: ts.map(t => [t.title, clients.find(c=>c.id===t.client_id)?.name ?? "—", statusLabel[t.status], formatSeconds(t.total_seconds), t.due_date ? formatDate(t.due_date) : "—"]) },
        { title: "Lançamentos de horas", head: ["Data","Tarefa","Atividade","Tempo"], rows: entries.slice(0, 50).map(e => [formatDate(e.logged_at), tasks.find(t=>t.id===e.task_id)?.title ?? "—", e.description ?? "—", formatSeconds(e.seconds)]) },
      ],
      fileName: `funcionario-${u.name.toLowerCase().replace(/\s+/g,'-')}.pdf`,
    });
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Relatórios"
        subtitle="Explore, filtre e exporte dados completos da operação."
        actions={
          <>
            <PeriodFilter value={period} onChange={setPeriod} />
            <Button onClick={exportAll} className="gap-2"><FileDown className="w-4 h-4" /> Exportar PDF</Button>
          </>
        }
      />

      {/* Cards de relatórios — clique abre tela detalhada */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { id: "clients",   title: "Clientes",   subtitle: `${clients.length} cliente(s)`,                           icon: Building,   color: "text-primary" },
          { id: "tasks",     title: "Tarefas",    subtitle: `${tasks.length} tarefa(s) no total`,                     icon: ListTodo,   color: "text-accent" },
          ...(isLeader ? [{ id: "team",      title: "Equipe",     subtitle: `${users.filter(u => u.role==="employee").length} funcionário(s)`, icon: UsersIcon, color: "text-warning" }] : []),
          ...(isLeader ? [{ id: "financial", title: "Financeiro", subtitle: "Receitas, despesas e folha",            icon: Wallet,    color: "text-success" }] : []),
        ].map(card => {
          const Icon = card.icon;
          return (
            <Card key={card.id} onClick={() => navigate(`/reports/${card.id}`)} className="p-5 cursor-pointer hover:shadow-lift hover:-translate-y-0.5 hover:border-accent/40 transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${card.color}`}><Icon className="w-5 h-5" /></div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
              </div>
              <h3 className="font-display font-semibold">{card.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
            </Card>
          );
        })}
      </div>

      <Card className="p-2 mb-6 flex flex-col md:flex-row md:items-center gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="clients" className="gap-2"><Building className="w-3.5 h-3.5" /> Clientes</TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2"><ListTodo className="w-3.5 h-3.5" /> Tarefas</TabsTrigger>
            {isLeader && <TabsTrigger value="team" className="gap-2"><UsersIcon className="w-3.5 h-3.5" /> Equipe</TabsTrigger>}
          </TabsList>
        </Tabs>
        <div className="relative flex-1 md:max-w-sm md:ml-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar ${tab === "clients" ? "clientes" : tab === "tasks" ? "tarefas" : "funcionários"}…`} className="pl-9" />
        </div>
      </Card>

      {tab === "clients" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Cliente</th>
                  <th className="text-right px-4 py-3 font-semibold">Mensalidade</th>
                  <th className="text-right px-4 py-3 font-semibold">Tarefas</th>
                  <th className="text-right px-4 py-3 font-semibold">Horas / Meta</th>
                  <th className="text-left px-4 py-3 font-semibold">Saúde</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {clientRows.map(r => {
                  const pct = Math.round((r.hours / r.target) * 100);
                  const over = r.hours > r.target;
                  return (
                    <tr key={r.c.id} className="border-t border-border hover:bg-muted/30 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">{r.c.name.charAt(0)}</div>
                          <div>
                            <p className="font-medium">{r.c.name}</p>
                            <p className="text-xs text-muted-foreground">{r.c.company ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">R$ {r.fee.toLocaleString("pt-BR")}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.done}/{r.totalTasks}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span className={`tabular-nums text-xs ${over ? "text-destructive font-semibold" : ""}`}>{r.hours.toFixed(1)}/{r.target}h</span>
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full ${over ? "bg-destructive" : pct > 80 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-[10px]">{r.c.health ?? "—"}</Badge></td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => exportClient(r.c.id)} className="gap-1.5"><FileSpreadsheet className="w-3 h-3" /> PDF</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "tasks" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Tarefa</th>
                  <th className="text-left px-4 py-3 font-semibold">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold">Responsável</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-right px-4 py-3 font-semibold">Tempo</th>
                  <th className="text-left px-4 py-3 font-semibold">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {taskRows.map(({t, client, assignee}) => (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/30 transition">
                    <td className="px-4 py-3 font-medium">{t.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{client?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{assignee?.name ?? "—"}</td>
                    <td className="px-4 py-3"><Badge variant="secondary" className="text-[10px]">{statusLabel[t.status]}</Badge></td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatSeconds(t.total_seconds)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.due_date ? formatDate(t.due_date) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "team" && isLeader && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Funcionário</th>
                  <th className="text-right px-4 py-3 font-semibold">Tarefas</th>
                  <th className="text-right px-4 py-3 font-semibold">Concluídas</th>
                  <th className="text-right px-4 py-3 font-semibold">Atrasadas</th>
                  <th className="text-right px-4 py-3 font-semibold">Horas</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {teamRows.map(r => (
                  <tr key={r.u.id} className="border-t border-border hover:bg-muted/30 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">{r.u.name.split(" ").map(n=>n[0]).slice(0,2).join("")}</div>
                        <div>
                          <p className="font-medium">{r.u.name}</p>
                          <p className="text-xs text-muted-foreground">{r.u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.tasks}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-success font-semibold">{r.done}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${r.late ? "text-destructive font-semibold" : ""}`}>{r.late}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatSeconds(r.seconds)}</td>
                    <td className="px-4 py-3 text-right"><Button size="sm" variant="ghost" onClick={() => exportEmployee(r.u.id)} className="gap-1.5"><FileSpreadsheet className="w-3 h-3" /> PDF</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}