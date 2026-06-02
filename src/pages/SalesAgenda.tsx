import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CalendarDays, Video, Phone, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface SEvent { id: string; title: string; lead_id: string | null; kind: string; start_at: string; end_at: string | null; location: string | null; link: string | null; notes: string | null; }
interface Lead { id: string; name: string; }

export default function SalesAgenda() {
  const { user } = useAuth();
  const [events, setEvents] = useState<SEvent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<SEvent>>({ kind: "meeting", start_at: new Date().toISOString().slice(0, 16) });

  async function load() {
    const [e, l] = await Promise.all([
      supabase.from("sales_events").select("*").order("start_at"),
      supabase.from("leads").select("id,name"),
    ]);
    if (e.data) setEvents(e.data as any);
    if (l.data) setLeads(l.data as any);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.title?.trim() || !form.start_at) return toast.error("Título e data obrigatórios");
    const payload = { ...form, owner_id: user?.id, start_at: new Date(form.start_at).toISOString(), end_at: form.end_at ? new Date(form.end_at).toISOString() : null } as any;
    const { error } = await supabase.from("sales_events").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Evento criado");
    setOpen(false); setForm({ kind: "meeting", start_at: new Date().toISOString().slice(0, 16) });
    load();
  }
  async function remove(id: string) { if (!confirm("Remover?")) return; await supabase.from("sales_events").delete().eq("id", id); load(); }

  const grouped = useMemo(() => {
    const m = new Map<string, SEvent[]>();
    events.forEach(e => {
      const k = new Date(e.start_at).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    });
    return [...m.entries()];
  }, [events]);

  const KIND_ICON: Record<string, any> = { call: Phone, meeting: Video, task: CalendarDays, other: CalendarDays };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <PageHeader title="Agenda" subtitle="Próximas calls, reuniões e compromissos." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" /> Novo evento</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo evento</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Título</Label><Input value={form.title ?? ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Tipo</Label>
                  <Select value={form.kind} onValueChange={v => setForm(f => ({ ...f, kind: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meeting">Reunião</SelectItem>
                      <SelectItem value="call">Ligação</SelectItem>
                      <SelectItem value="task">Tarefa</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Lead</Label>
                  <Select value={form.lead_id ?? ""} onValueChange={v => setForm(f => ({ ...f, lead_id: v || null }))}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{leads.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Início</Label><Input type="datetime-local" value={form.start_at} onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))} /></div>
                <div><Label>Fim</Label><Input type="datetime-local" value={form.end_at ?? ""} onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Local</Label><Input value={form.location ?? ""} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
                <div><Label>Link</Label><Input value={form.link ?? ""} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} /></div>
              </div>
              <div><Label>Notas</Label><Textarea value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <div className="space-y-6">
        {grouped.length === 0 && <Card className="p-8 text-center text-muted-foreground">Sem eventos agendados</Card>}
        {grouped.map(([day, evs]) => (
          <div key={day}>
            <h3 className="font-semibold mb-2 capitalize">{day}</h3>
            <div className="space-y-2">
              {evs.map(e => {
                const Icon = KIND_ICON[e.kind] ?? CalendarDays;
                const lead = leads.find(l => l.id === e.lead_id);
                return (
                  <Card key={e.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{e.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                          <span>{new Date(e.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                          {lead && <Badge variant="outline" className="text-[10px]">{lead.name}</Badge>}
                          {e.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{e.location}</span>}
                          {e.link && <a href={e.link} target="_blank" rel="noreferrer" className="text-accent">link</a>}
                        </p>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}