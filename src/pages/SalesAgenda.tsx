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
import { Plus, CalendarDays, Video, Phone, MapPin, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

interface SEvent { id: string; title: string; lead_id: string | null; kind: string; start_at: string; end_at: string | null; location: string | null; link: string | null; notes: string | null; }
interface Lead { id: string; name: string; }

type FilterPreset = "today" | "week" | "month" | "custom";

// Retorna datetime-local no fuso do usuário (YYYY-MM-DDTHH:MM)
function localDateTimeStr(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Retorna YYYY-MM-DD no fuso local
function localDateStr(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function SalesAgenda() {
  const { user } = useAuth();
  const [events, setEvents] = useState<SEvent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<SEvent>>({ kind: "meeting", start_at: localDateTimeStr() });

  // Filtro de período
  const [preset, setPreset] = useState<FilterPreset>("week");
  const [customFrom, setCustomFrom] = useState(localDateStr());
  const [customTo, setCustomTo] = useState(localDateStr());

  async function load() {
    let eventsQuery = supabase.from("sales_events").select("*").order("start_at");
    let leadsQuery = supabase.from("leads").select("id,name");
    if (user?.role === "commercial") {
      eventsQuery = eventsQuery.eq("owner_id", user.id);
      leadsQuery = leadsQuery.eq("owner_id", user.id);
    }
    const [e, l] = await Promise.all([eventsQuery, leadsQuery]);
    if (e.data) setEvents(e.data as any);
    if (l.data) setLeads(l.data as any);
  }

  useEffect(() => { load(); }, [user?.id, user?.role]);
  useEffect(() => {
    const ch = supabase
      .channel("sales-agenda-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_events" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, user?.role]);

  async function save() {
    if (!form.title?.trim() || !form.start_at) return toast.error("Título e data obrigatórios");
    const payload = {
      ...form,
      owner_id: user?.id,
      start_at: new Date(form.start_at).toISOString(),
      end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
    } as any;
    const { error } = editingId
      ? await supabase.from("sales_events").update(payload).eq("id", editingId)
      : await supabase.from("sales_events").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Evento atualizado" : "Evento criado");
    setOpen(false);
    setEditingId(null);
    setForm({ kind: "meeting", start_at: localDateTimeStr() });
    load();
  }

  function openCreate() {
    setEditingId(null);
    setForm({ kind: "meeting", start_at: localDateTimeStr() });
    setOpen(true);
  }

  function openEdit(event: SEvent) {
    setEditingId(event.id);
    setForm({
      ...event,
      start_at: localDateTimeStr(new Date(event.start_at)),
      end_at: event.end_at ? localDateTimeStr(new Date(event.end_at)) : null,
    });
    setOpen(true);
  }

  async function remove(id: string) {
    if (!confirm("Remover este evento?")) return;
    await supabase.from("sales_events").delete().eq("id", id);
    load();
  }

  // Calcula os limites do filtro
  const { filterFrom, filterTo } = useMemo(() => {
    const now = new Date();
    if (preset === "today") {
      const from = new Date(now); from.setHours(0, 0, 0, 0);
      const to   = new Date(now); to.setHours(23, 59, 59, 999);
      return { filterFrom: from, filterTo: to };
    }
    if (preset === "week") {
      const from = new Date(now);
      from.setDate(now.getDate() - now.getDay()); from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(from.getDate() + 6); to.setHours(23, 59, 59, 999);
      return { filterFrom: from, filterTo: to };
    }
    if (preset === "month") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { filterFrom: from, filterTo: to };
    }
    // custom
    const from = new Date(customFrom + "T00:00:00");
    const to   = new Date(customTo   + "T23:59:59");
    return { filterFrom: from, filterTo: to };
  }, [preset, customFrom, customTo]);

  const filtered = useMemo(() =>
    events.filter(e => {
      const d = new Date(e.start_at);
      return d >= filterFrom && d <= filterTo;
    }),
    [events, filterFrom, filterTo]
  );

  const grouped = useMemo(() => {
    const m = new Map<string, SEvent[]>();
    filtered.forEach(e => {
      const k = new Date(e.start_at).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    });
    return [...m.entries()];
  }, [filtered]);

  const KIND_ICON: Record<string, any> = { call: Phone, meeting: Video, task: CalendarDays, other: CalendarDays };

  const PRESET_LABELS: Record<FilterPreset, string> = {
    today: "Hoje",
    week: "Esta semana",
    month: "Este mês",
    custom: "Período",
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <PageHeader
        title="Agenda"
        subtitle="Próximas calls, reuniões e compromissos."
        actions={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingId(null); }}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={openCreate}><Plus className="w-4 h-4" /> Novo evento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden">
              <DialogHeader><DialogTitle>{editingId ? "Editar evento" : "Novo evento"}</DialogTitle></DialogHeader>
              <div className="grid gap-3 overflow-y-auto flex-1 pr-1 py-1">
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
              <DialogFooter><Button onClick={save}>{editingId ? "Salvar alterações" : "Salvar"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Filtros de período */}
      <Card className="p-3 mb-6 flex items-center gap-2 flex-wrap">
        {(["today", "week", "month", "custom"] as FilterPreset[]).map(p => (
          <Button
            key={p}
            size="sm"
            variant={preset === p ? "default" : "outline"}
            onClick={() => setPreset(p)}
          >
            {PRESET_LABELS[p]}
          </Button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <Input
              type="date"
              className="h-8 w-36 text-sm"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
            />
            <span className="text-muted-foreground text-sm">até</span>
            <Input
              type="date"
              className="h-8 w-36 text-sm"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
            />
          </div>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} evento{filtered.length !== 1 ? "s" : ""}
        </span>
      </Card>

      <div className="space-y-6">
        {grouped.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            Nenhum evento no período selecionado
          </Card>
        )}
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
                      <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{e.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                          <span>
                            {new Date(e.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            {e.end_at && ` → ${new Date(e.end_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                          </span>
                          {lead && <Badge variant="outline" className="text-[10px]">{lead.name}</Badge>}
                          {e.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{e.location}</span>}
                          {e.link && <a href={e.link} target="_blank" rel="noreferrer" className="text-accent underline">link</a>}
                        </p>
                        {e.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{e.notes}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(e)} title="Editar">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(e.id)} title="Remover">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
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
