import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/store/AppStore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Building2, ChevronRight, Star, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { Client } from "@/types";
import { PeriodFilter, type Period, inPeriod } from "@/components/PeriodFilter";
import { useSearch } from "@/context/SearchContext";

function contractInfo(c: Client) {
  if (!c.contract_end) return null;
  const end = new Date(c.contract_end);
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
  if (days < 0)   return { label: `Encerrado há ${-days}d`, tone: "destructive" as const, days };
  if (days <= 30) return { label: `Encerra em ${days}d`,    tone: "warning" as const,     days };
  if (days <= 60) return { label: `${days}d para o fim`,    tone: "secondary" as const,   days };
  return { label: `Vigente até ${end.toLocaleDateString("pt-BR")}`, tone: "outline" as const, days };
}

const healthMap = {
  great:   { label: "Excelente", cls: "bg-success/15 text-success" },
  good:    { label: "Saudável",  cls: "bg-primary/15 text-primary" },
  warning: { label: "Atenção",   cls: "bg-warning/15 text-warning" },
  risk:    { label: "Em risco",  cls: "bg-destructive/15 text-destructive" },
};

export default function Clients() {
  const { clients, tasks, timeEntries, currentUser, createClient } = useApp();
  const navigate = useNavigate();
  const { query } = useSearch();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Client>>({ name: "", company: "", email: "", monthly_fee: 0, monthly_hours_target: 40, contract_months: 12 });
  const [period, setPeriod] = useState<Period>({ preset: "all" });
  const isLeader = currentUser.role === "leader";

  const visible = useMemo(() => {
    let list = currentUser.role === "leader"
      ? clients
      : (() => {
          const myClientIds = new Set(tasks.filter(t => t.assignee_id === currentUser.id).map(t => t.client_id).filter(Boolean));
          return clients.filter(c => myClientIds.has(c.id));
        })();

    // Período: cliente criado no período OU com tarefas atualizadas no período
    if (period.preset !== "all") {
      list = list.filter(c =>
        inPeriod(c.created_at, period) ||
        tasks.some(t => t.client_id === c.id && (inPeriod(t.updated_at, period) || inPeriod(t.created_at, period)))
      );
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [clients, tasks, currentUser, period, query]);

  function tasksInPeriodFor(clientId: string) {
    const all = tasks.filter(t => t.client_id === clientId);
    if (period.preset === "all") return all;
    return all.filter(t => inPeriod(t.created_at, period) || inPeriod(t.updated_at, period));
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Clientes"
        subtitle={`${visible.length} cliente${visible.length === 1 ? "" : "s"} ${currentUser.role === "leader" ? "ativos" : "vinculados a você"}`}
        actions={
          <>
            <PeriodFilter value={period} onChange={setPeriod} />
            {isLeader && <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Novo cliente</Button>}
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map(c => {
          const t = tasksInPeriodFor(c.id);
          const done = t.filter(x => x.status === "done").length;
          const late = t.filter(x => x.due_date && new Date(x.due_date) < new Date() && x.status !== "done").length;
          const pct = t.length ? Math.round((done / t.length) * 100) : 0;
          const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
          const monthSec = timeEntries.filter(e => {
            const tk = tasks.find(x => x.id === e.task_id);
            return tk?.client_id === c.id && new Date(e.logged_at) >= monthStart;
          }).reduce((s,e) => s+e.seconds, 0);
          const mh = monthSec / 3600;
          const target = c.monthly_hours_target ?? 40;
          const usage = Math.min(100, Math.round((mh / target) * 100));
          const over = mh > target;
          const h = healthMap[c.health ?? "good"];
          return (
            <Card key={c.id} onClick={() => navigate(`/clients/${c.id}`)} className="p-5 hover:shadow-lift hover:-translate-y-0.5 hover:border-accent/40 transition-all cursor-pointer group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground font-semibold shadow-glow">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold leading-tight">{c.name}</h3>
                    {c.company && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Building2 className="w-3 h-3" /> {c.company}</p>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
              </div>
              <div className="flex items-center justify-between mb-3">
                <Badge className={`${h.cls} border-0 text-[10px]`}>{h.label}</Badge>
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} className={`w-3 h-3 ${n <= Math.round(c.satisfaction ?? 0) ? "fill-warning text-warning" : "text-muted-foreground/20"}`} />
                  ))}
                </div>
              </div>
              {(() => {
                const ci = contractInfo(c);
                if (!ci) return null;
                return (
                  <div className={`flex items-center gap-1.5 text-[10px] mb-3 ${ci.tone === "destructive" ? "text-destructive" : ci.tone === "warning" ? "text-warning" : "text-muted-foreground"}`}>
                    {(ci.tone === "destructive" || ci.tone === "warning") && <AlertTriangle className="w-3 h-3" />}
                    <span className="font-medium">{ci.label}</span>
                  </div>
                );
              })()}
              <div className={`grid ${isLeader ? "grid-cols-3" : "grid-cols-2"} gap-2 text-center mb-4`}>
                {isLeader && (
                  <div>
                    <p className="text-base font-display font-bold tabular-nums">R$ {((c.monthly_fee ?? 0)/1000).toFixed(1)}k</p>
                    <p className="text-[10px] text-muted-foreground uppercase">Mensal</p>
                  </div>
                )}
                <div>
                  <p className={`text-base font-display font-bold tabular-nums ${over ? "text-destructive" : ""}`}>{mh.toFixed(0)}h</p>
                  <p className="text-[10px] text-muted-foreground uppercase">/{target}h mês</p>
                </div>
                <div>
                  <p className={`text-base font-display font-bold tabular-nums ${late ? "text-destructive" : ""}`}>{late || done}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{late ? "Atrasos" : "Feitas"}</p>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1.5">
                <div className={`h-full transition-all ${over ? "bg-destructive" : usage > 80 ? "bg-warning" : "bg-success"}`} style={{ width: `${usage}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{usage}% da meta de horas</span>
                <span>{pct}% tarefas</span>
              </div>
            </Card>
          );
        })}
        {visible.length === 0 && (
          <Card className="p-10 text-center text-muted-foreground col-span-full">Nenhum cliente para os filtros aplicados.</Card>
        )}
      </div>

      <Dialog open={open && isLeader} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div><Label>Nome</Label><Input value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Empresa</Label><Input value={form.company ?? ""} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.phone ?? ""} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Mensalidade (R$)</Label><Input type="number" value={form.monthly_fee ?? 0} onChange={e => setForm({ ...form, monthly_fee: +e.target.value })} /></div>
            <div><Label>Meta horas/mês</Label><Input type="number" value={form.monthly_hours_target ?? 40} onChange={e => setForm({ ...form, monthly_hours_target: +e.target.value })} /></div>
            <div><Label>Início do contrato</Label><Input type="date" value={form.contract_start ?? ""} onChange={e => setForm({ ...form, contract_start: e.target.value })} /></div>
            <div><Label>Fim do contrato</Label><Input type="date" value={form.contract_end ?? ""} onChange={e => setForm({ ...form, contract_end: e.target.value })} /></div>
            <div><Label>Duração (meses)</Label><Input type="number" value={form.contract_months ?? 12} onChange={e => setForm({ ...form, contract_months: +e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => { if (form.name?.trim()) { createClient(form); setOpen(false); setForm({ name: "", company: "", email: "", monthly_fee: 0, monthly_hours_target: 40, contract_months: 12 }); } }}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
