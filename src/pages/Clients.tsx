import { useMemo, useState } from "react";
import { useApp } from "@/store/AppStore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Building2, Mail, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { Client } from "@/types";

export default function Clients() {
  const { clients, tasks, currentUser, createClient } = useApp();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Client | null>(null);
  const [form, setForm] = useState<Partial<Client>>({ name: "", company: "", email: "" });

  const visible = useMemo(() => {
    if (currentUser.role === "leader") return clients;
    const myClientIds = new Set(tasks.filter(t => t.assignee_id === currentUser.id).map(t => t.client_id).filter(Boolean));
    return clients.filter(c => myClientIds.has(c.id));
  }, [clients, tasks, currentUser]);

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Clientes"
        subtitle={`${visible.length} cliente${visible.length === 1 ? "" : "s"} ${currentUser.role === "leader" ? "ativos" : "vinculados a você"}`}
        actions={currentUser.role === "leader" && (
          <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Novo cliente</Button>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map(c => {
          const t = tasks.filter(x => x.client_id === c.id);
          const done = t.filter(x => x.status === "done").length;
          const inProg = t.filter(x => x.status === "in_progress").length;
          const late = t.filter(x => x.due_date && new Date(x.due_date) < new Date() && x.status !== "done").length;
          const pct = t.length ? Math.round((done / t.length) * 100) : 0;
          return (
            <Card key={c.id} onClick={() => setSelected(c)} className="p-5 hover:shadow-lift hover:-translate-y-0.5 hover:border-accent/40 transition-all cursor-pointer group">
              <div className="flex items-start justify-between mb-4">
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
              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div><p className="text-lg font-display font-bold tabular-nums">{t.length}</p><p className="text-[10px] text-muted-foreground uppercase">Total</p></div>
                <div><p className="text-lg font-display font-bold tabular-nums text-primary">{inProg}</p><p className="text-[10px] text-muted-foreground uppercase">Andamento</p></div>
                <div><p className={`text-lg font-display font-bold tabular-nums ${late ? "text-destructive" : ""}`}>{late}</p><p className="text-[10px] text-muted-foreground uppercase">Atrasos</p></div>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
                <div className="h-full gradient-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{pct}% concluído</p>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Nome</Label><Input value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Empresa</Label><Input value={form.company ?? ""} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => { if (form.name?.trim()) { createClient(form); setOpen(false); setForm({ name: "", company: "", email: "" }); } }}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (() => {
            const t = tasks.filter(x => x.client_id === selected.id);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground font-semibold">{selected.name.charAt(0)}</div>
                    {selected.name}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {selected.company && <p className="flex items-center gap-2"><Building2 className="w-4 h-4" /> {selected.company}</p>}
                  {selected.email && <p className="flex items-center gap-2"><Mail className="w-4 h-4" /> {selected.email}</p>}
                </div>
                <div className="border-t border-border pt-4 mt-4">
                  <h4 className="font-semibold mb-3">Tarefas ({t.length})</h4>
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {t.map(x => (
                      <div key={x.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                        <span className="text-sm">{x.title}</span>
                        <Badge variant="secondary" className="text-[10px]">{x.status === "done" ? "Concluído" : x.status === "in_progress" ? "Andamento" : x.status === "review" ? "Revisão" : "A Fazer"}</Badge>
                      </div>
                    ))}
                    {!t.length && <p className="text-xs text-muted-foreground">Nenhuma tarefa.</p>}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}