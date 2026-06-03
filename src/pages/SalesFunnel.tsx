import { useEffect, useMemo, useState } from "react";
import { DndContext, type DragEndEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/store/AppStore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MessageCircle, Mail, Phone, Calendar, Trash2, Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import { PeriodFilter, type Period, inPeriod } from "@/components/PeriodFilter";

const BRL = (v: number) => `R$ ${(v ?? 0).toLocaleString("pt-BR")}`;

interface Stage { id: string; name: string; color: string; position: number; is_won: boolean; is_lost: boolean; }
interface Lead { id: string; name: string; company: string | null; email: string | null; phone: string | null; whatsapp: string | null; source: string | null; niche?: string | null; estimated_value: number | null; stage_id: string | null; owner_id: string | null; notes: string | null; next_followup_at: string | null; created_at?: string; updated_at?: string; time_spent_seconds?: number | null; }
interface Activity { id: string; lead_id: string; kind: string; body: string | null; occurred_at: string; user_id: string | null; }

function whatsLink(n?: string | null) { if (!n) return null; const digits = n.replace(/\D/g, ""); return digits ? `https://wa.me/${digits}` : null; }
function telLink(n?: string | null) { if (!n) return null; const digits = n.replace(/\D/g, ""); return digits ? `tel:${digits}` : null; }

function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const wa = whatsLink(lead.whatsapp || lead.phone);
  return (
    <div ref={setNodeRef} style={style} className={`bg-card border border-border rounded-lg p-3 space-y-2 ${isDragging ? "opacity-40" : ""} hover:border-accent/40 transition`}>
      <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing space-y-1">
        <div className="flex items-start justify-between gap-2">
          <button onClick={onClick} className="font-medium text-sm leading-tight text-left hover:text-accent">{lead.name}</button>
          {lead.estimated_value ? <Badge variant="outline" className="text-[10px] shrink-0">{BRL(Number(lead.estimated_value))}</Badge> : null}
        </div>
        {lead.company && <p className="text-xs text-muted-foreground truncate">{lead.company}</p>}
        {lead.next_followup_at && <p className="text-[10px] text-warning flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(lead.next_followup_at).toLocaleDateString("pt-BR")}</p>}
      </div>
      <div className="flex items-center gap-1 pt-1 border-t border-border">
        {wa && <a href={wa} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-success/15 text-success" title="WhatsApp"><MessageCircle className="w-3.5 h-3.5" /></a>}
        {lead.email && <a href={`mailto:${lead.email}`} className="p-1.5 rounded hover:bg-primary/15 text-primary" title="Email"><Mail className="w-3.5 h-3.5" /></a>}
        {telLink(lead.phone) && <a href={telLink(lead.phone)!} className="p-1.5 rounded hover:bg-muted text-muted-foreground" title="Telefone"><Phone className="w-3.5 h-3.5" /></a>}
      </div>
    </div>
  );
}

function StageColumn({ stage, leads, onCardClick }: { stage: Stage; leads: Lead[]; onCardClick: (l: Lead) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stage.id}` });
  const total = leads.reduce((s, l) => s + Number(l.estimated_value || 0), 0);
  return (
    <div ref={setNodeRef} className={`min-w-[280px] w-[280px] bg-muted/30 rounded-xl p-3 flex flex-col ${isOver ? "ring-2 ring-accent" : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: stage.color }} />
          <h3 className="font-semibold text-sm">{stage.name}</h3>
          <Badge variant="outline" className="text-[10px]">{leads.length}</Badge>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">{BRL(total)}</span>
      </div>
      <div className="space-y-2 flex-1 overflow-y-auto">
        {leads.map(l => <LeadCard key={l.id} lead={l} onClick={() => onCardClick(l)} />)}
        {leads.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Sem leads</p>}
      </div>
    </div>
  );
}

export default function SalesFunnel() {
  const { user } = useAuth();
  const { users } = useApp();
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [ownerFilter, setOwnerFilter] = useState("mine");
  const [period, setPeriod] = useState<Period>({ preset: "all" });
  const [stageForm, setStageForm] = useState<Partial<Stage> | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const isLeader = user?.role === "leader";
  const commercialUsers = users.filter((u) => u.role === "commercial");

  async function load() {
    let leadQuery = supabase.from("leads").select("*").order("created_at", { ascending: false });
    const filterOwner = ownerFilter === "mine" ? user?.id : ownerFilter;
    if (!isLeader || filterOwner !== "all") leadQuery = leadQuery.eq("owner_id", filterOwner);

    const [s, l, a] = await Promise.all([
      supabase.from("lead_stages").select("*").order("position"),
      leadQuery,
      supabase.from("lead_activities").select("*").order("occurred_at", { ascending: false }),
    ]);
    if (s.data) {
      const unique = new Map<string, Stage>();
      (s.data as Stage[]).forEach((stage) => {
        const key = stage.name.trim().toLowerCase();
        if (!unique.has(key)) unique.set(key, stage);
      });
      setStages([...unique.values()].sort((a, b) => a.position - b.position));
    }
    if (l.data) setLeads(l.data as any);
    if (a.data) setActivities(a.data as any);
  }
  useEffect(() => { load(); }, [ownerFilter, user?.id, isLeader]);

  useEffect(() => {
    const ch = supabase
      .channel("sales-funnel-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_stages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_activities" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ownerFilter, user?.id, isLeader]);

  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState<Partial<Lead>>({});
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [newActivity, setNewActivity] = useState<{ kind: string; body: string }>({ kind: "note", body: "" });

  async function createLead() {
    if (!form.name?.trim()) return toast.error("Nome obrigatório");
    const firstStage = stages.find(s => !s.is_won && !s.is_lost) ?? stages[0];
    const payload = { ...form, stage_id: form.stage_id || firstStage?.id, owner_id: form.owner_id || user?.id, estimated_value: Number(form.estimated_value || 0), time_spent_seconds: Number(form.time_spent_seconds || 0) } as any;
    const { error } = await supabase.from("leads").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Lead criado");
    setOpenNew(false); setForm({}); load();
  }

  async function onDragEnd(e: DragEndEvent) {
    const overId = e.over?.id?.toString();
    if (!overId?.startsWith("stage:")) return;
    const newStage = overId.replace("stage:", "");
    const id = e.active.id.toString();
    const lead = leads.find(l => l.id === id);
    if (!lead || lead.stage_id === newStage) return;
    setLeads(prev => prev.map(l => l.id === id ? { ...l, stage_id: newStage } : l));
    await supabase.from("leads").update({ stage_id: newStage }).eq("id", id);
  }

  async function updateLead(patch: Partial<Lead>) {
    if (!openLead) return;
    await supabase.from("leads").update(patch).eq("id", openLead.id);
    setOpenLead({ ...openLead, ...patch } as Lead);
    load();
  }
  async function saveStage() {
    if (!stageForm?.name?.trim()) return toast.error("Nome da etapa obrigatório");
    const payload = {
      name: stageForm.name.trim(),
      color: stageForm.color || "#6366f1",
      position: Number(stageForm.position ?? stages.length),
      is_won: false,
      is_lost: !!stageForm.is_lost,
    };
    const error = stageForm.id
      ? (await supabase.from("lead_stages").update(payload).eq("id", stageForm.id)).error
      : (await supabase.from("lead_stages").insert(payload)).error;
    if (error) return toast.error(error.message);
    setStageForm(null);
    toast.success(stageForm.id ? "Etapa atualizada" : "Etapa criada");
    load();
  }
  async function deleteStage(stage: Stage) {
    if (stage.is_won) return toast.error("A etapa Vendido é fixa e não pode ser removida");
    if (!confirm(`Remover etapa "${stage.name}"?`)) return;
    const fallback = stages.find((s) => !s.is_won && !s.is_lost && s.id !== stage.id) ?? stages.find((s) => s.id !== stage.id);
    if (fallback) await supabase.from("leads").update({ stage_id: fallback.id }).eq("stage_id", stage.id);
    const { error } = await supabase.from("lead_stages").delete().eq("id", stage.id);
    if (error) return toast.error(error.message);
    toast.success("Etapa removida");
    load();
  }
  async function addActivity() {
    if (!openLead || !newActivity.body.trim()) return;
    await supabase.from("lead_activities").insert({ lead_id: openLead.id, user_id: user?.id, kind: newActivity.kind, body: newActivity.body });
    setNewActivity({ kind: "note", body: "" });
    load();
  }
  async function deleteLead() {
    if (!openLead) return;
    if (!confirm("Excluir lead?")) return;
    await supabase.from("leads").delete().eq("id", openLead.id);
    setOpenLead(null);
    load();
  }

  const leadActivities = useMemo(() => openLead ? activities.filter(a => a.lead_id === openLead.id) : [], [openLead, activities]);

  return (
    <div className="p-4">
      <PageHeader
        title="Funil de Vendas"
        subtitle="Organize abordagens, follow-ups e fechamentos."
        actions={
          <div className="flex flex-wrap gap-2">
          <PeriodFilter value={period} onChange={setPeriod} />
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[190px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {isLeader && <SelectItem value="all">Todos os comerciais</SelectItem>}
              <SelectItem value="mine">Meus leads</SelectItem>
              {commercialUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {isLeader && <Button variant="outline" onClick={() => setStageForm({ color: "#6366f1", position: stages.length })} className="gap-2"><Plus className="w-4 h-4" /> Nova etapa</Button>}
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" /> Novo lead</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo lead</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div><Label>Nome*</Label><Input value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><Label>Empresa</Label><Input value={form.company ?? ""} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></div>
                <div><Label>Nicho / Segmento</Label><Input value={form.niche ?? ""} onChange={e => setForm(f => ({ ...f, niche: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>WhatsApp</Label><Input placeholder="55119..." value={form.whatsapp ?? ""} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} /></div>
                  <div><Label>Telefone</Label><Input value={form.phone ?? ""} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                </div>
                <div><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Origem</Label><Input value={form.source ?? ""} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} /></div>
                  <div><Label>Ticket estimado</Label><Input type="number" step="0.01" value={form.estimated_value ?? ""} onChange={e => setForm(f => ({ ...f, estimated_value: Number(e.target.value) }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Tempo gasto (min)</Label><Input type="number" value={Math.round((form.time_spent_seconds ?? 0) / 60)} onChange={e => setForm(f => ({ ...f, time_spent_seconds: Number(e.target.value) * 60 }))} /></div>
                  <div><Label>Comercial responsável</Label>
                    <Select value={form.owner_id ?? user?.id ?? ""} onValueChange={v => setForm(f => ({ ...f, owner_id: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{commercialUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Estágio</Label>
                  <Select value={form.stage_id ?? ""} onValueChange={v => setForm(f => ({ ...f, stage_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Primeiro estágio" /></SelectTrigger>
                    <SelectContent>{stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Notas</Label><Textarea value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              </div>
              <DialogFooter><Button onClick={createLead}>Criar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map(s => (
            <div key={s.id} className="relative group">
              <StageColumn stage={s} leads={leads.filter(l => l.stage_id === s.id && (period.preset === "all" || inPeriod(l.updated_at ?? l.created_at, period)))} onCardClick={setOpenLead} />
              {isLeader && (
                <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                  {!s.is_won && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setStageForm(s)}><Pencil className="w-3 h-3" /></Button>}
                  {!s.is_won && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteStage(s)}><Trash2 className="w-3 h-3 text-destructive" /></Button>}
                </div>
              )}
            </div>
          ))}
        </div>
      </DndContext>

      <Dialog open={!!stageForm} onOpenChange={(o) => !o && setStageForm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{stageForm?.id ? "Editar etapa" : "Nova etapa"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Nome</Label><Input value={stageForm?.name ?? ""} onChange={e => setStageForm(f => ({ ...f!, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Cor</Label><Input type="color" value={stageForm?.color ?? "#6366f1"} onChange={e => setStageForm(f => ({ ...f!, color: e.target.value }))} /></div>
              <div><Label>Posição</Label><Input type="number" value={stageForm?.position ?? 0} onChange={e => setStageForm(f => ({ ...f!, position: Number(e.target.value) }))} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={saveStage} className="gap-2"><Save className="w-4 h-4" /> Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openLead} onOpenChange={(o) => !o && setOpenLead(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {openLead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">{openLead.name}
                  {whatsLink(openLead.whatsapp || openLead.phone) && <a target="_blank" rel="noreferrer" href={whatsLink(openLead.whatsapp || openLead.phone)!} className="text-success"><MessageCircle className="w-4 h-4" /></a>}
                  {openLead.email && <a href={`mailto:${openLead.email}`} className="text-primary"><Mail className="w-4 h-4" /></a>}
                  {telLink(openLead.phone) && <a href={telLink(openLead.phone)!} className="text-muted-foreground"><Phone className="w-4 h-4" /></a>}
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Empresa</Label><Input value={openLead.company ?? ""} onChange={e => updateLead({ company: e.target.value })} /></div>
                <div><Label>Nicho / Segmento</Label><Input value={openLead.niche ?? ""} onChange={e => updateLead({ niche: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={openLead.email ?? ""} onChange={e => updateLead({ email: e.target.value })} /></div>
                <div><Label>WhatsApp</Label><Input value={openLead.whatsapp ?? ""} onChange={e => updateLead({ whatsapp: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={openLead.phone ?? ""} onChange={e => updateLead({ phone: e.target.value })} /></div>
                <div><Label>Ticket estimado</Label><Input type="number" value={openLead.estimated_value ?? 0} onChange={e => updateLead({ estimated_value: Number(e.target.value) })} /></div>
                <div><Label>Origem</Label><Input value={openLead.source ?? ""} onChange={e => updateLead({ source: e.target.value })} /></div>
                <div><Label>Tempo gasto (min)</Label><Input type="number" value={Math.round((openLead.time_spent_seconds ?? 0) / 60)} onChange={e => updateLead({ time_spent_seconds: Number(e.target.value) * 60 })} /></div>
                <div><Label>Próximo follow-up</Label><Input type="datetime-local" value={openLead.next_followup_at ? openLead.next_followup_at.slice(0, 16) : ""} onChange={e => updateLead({ next_followup_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
                <div><Label>Estágio</Label>
                  <Select value={openLead.stage_id ?? ""} onValueChange={v => updateLead({ stage_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Notas</Label><Textarea value={openLead.notes ?? ""} onChange={e => updateLead({ notes: e.target.value })} /></div>

              <div className="border-t border-border pt-3">
                <h4 className="font-semibold text-sm mb-2">Atividades</h4>
                <div className="flex gap-2 mb-3">
                  <Select value={newActivity.kind} onValueChange={v => setNewActivity(a => ({ ...a, kind: v }))}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="note">Nota</SelectItem>
                      <SelectItem value="call">Ligação</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="meeting">Reunião</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Descreva..." value={newActivity.body} onChange={e => setNewActivity(a => ({ ...a, body: e.target.value }))} />
                  <Button onClick={addActivity}>Adicionar</Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {leadActivities.map(a => (
                    <div key={a.id} className="text-xs bg-muted/40 p-2 rounded flex justify-between gap-2">
                      <div><Badge variant="outline" className="mr-2 text-[10px]">{a.kind}</Badge>{a.body}</div>
                      <span className="text-muted-foreground shrink-0">{new Date(a.occurred_at).toLocaleString("pt-BR")}</span>
                    </div>
                  ))}
                  {leadActivities.length === 0 && <p className="text-xs text-muted-foreground">Sem atividades</p>}
                </div>
              </div>

              <DialogFooter className="justify-between sm:justify-between">
                <Button variant="ghost" className="text-destructive" onClick={deleteLead}><Trash2 className="w-4 h-4 mr-2" />Excluir</Button>
                <Button onClick={() => setOpenLead(null)}>Fechar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}