import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const SHOOT_TYPES = [
  { value: "casal", label: "Casal" }, { value: "gestante", label: "Gestante" },
  { value: "corporativo", label: "Corporativo" }, { value: "individual", label: "Individual" },
  { value: "familia", label: "Família" }, { value: "casamento", label: "Casamento" },
  { value: "aniversario", label: "Aniversário" }, { value: "infantil", label: "Infantil" },
  { value: "empresarial", label: "Empresarial" }, { value: "parto", label: "Parto" },
  { value: "sensual", label: "Sensual" }, { value: "formatura", label: "Formatura" },
  { value: "produto", label: "Produto" },
];

type Shoot = {
  id: string; client_id: string; city: string; shoot_type: string;
  shoot_date: string | null; photos_delivered: number; notes: string | null;
};
type Client = { id: string; full_name: string; city: string };

export default function StudioShoots() {
  const { user } = useAuth();
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cityFilter, setCityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);

  async function load() {
    const [s, c] = await Promise.all([
      supabase.from("studio_shoots").select("*").order("shoot_date", { ascending: false, nullsFirst: false }),
      supabase.from("studio_clients").select("id, full_name, city").order("full_name"),
    ]);
    setShoots((s.data ?? []) as Shoot[]);
    setClients((c.data ?? []) as Client[]);
  }
  useEffect(() => { load(); }, []);

  const cities = Array.from(new Set(shoots.map(s => s.city))).sort();
  const filtered = shoots.filter(s =>
    (cityFilter === "all" || s.city === cityFilter) &&
    (typeFilter === "all" || s.shoot_type === typeFilter)
  );
  const clientMap = new Map(clients.map(c => [c.id, c]));

  async function remove(id: string) {
    if (!confirm("Excluir ensaio?")) return;
    await supabase.from("studio_shoots").delete().eq("id", id);
    toast.success("Removido"); load();
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl">Ensaios</h1>
          <p className="text-sm text-muted-foreground">Registre ensaios realizados e filtre para remarketing.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Novo ensaio</Button>
          </DialogTrigger>
          <NewShootDialog clients={clients} onSaved={() => { setOpen(false); load(); }} userId={user!.id} />
        </Dialog>
      </div>

      <Card className="p-4 grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Cidade</Label>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tipo de ensaio</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {SHOOT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(s => {
          const c = clientMap.get(s.client_id);
          const typeLabel = SHOOT_TYPES.find(t => t.value === s.shoot_type)?.label ?? s.shoot_type;
          return (
            <Card key={s.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold flex items-center gap-1"><Camera className="w-3 h-3" /> {typeLabel}</p>
                  <p className="text-sm">{c?.full_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{s.city} {s.shoot_date && `· ${new Date(s.shoot_date).toLocaleDateString("pt-BR")}`}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
              </div>
              <p className="text-xs"><span className="text-muted-foreground">Fotos entregues:</span> <strong>{s.photos_delivered}</strong></p>
              {s.notes && <p className="text-xs text-muted-foreground">{s.notes}</p>}
            </Card>
          );
        })}
        {filtered.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">Nenhum ensaio.</Card>}
      </div>
    </div>
  );
}

function NewShootDialog({ clients, onSaved, userId }: { clients: Client[]; onSaved: () => void; userId: string }) {
  const [client_id, setClientId] = useState("");
  const [shoot_type, setType] = useState("casal");
  const [shoot_date, setDate] = useState("");
  const [photos, setPhotos] = useState("0");
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = clients.find(x => x.id === client_id);
    if (c && !city) setCity(c.city);
  }, [client_id]); // eslint-disable-line

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!client_id || !city) { toast.error("Cliente e cidade são obrigatórios"); return; }
    setBusy(true);
    const { error } = await supabase.from("studio_shoots").insert({
      client_id, city, shoot_type: shoot_type as any,
      shoot_date: shoot_date || null,
      photos_delivered: parseInt(photos) || 0,
      notes: notes || null,
      created_by: userId,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Ensaio registrado");
    onSaved();
  }
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Novo ensaio</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label>Cliente*</Label>
          <Select value={client_id} onValueChange={setClientId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.city})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo*</Label>
            <Select value={shoot_type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SHOOT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Data</Label><Input type="date" value={shoot_date} onChange={e => setDate(e.target.value)} /></div>
          <div><Label>Cidade*</Label><Input value={city} onChange={e => setCity(e.target.value)} required /></div>
          <div><Label>Fotos entregues</Label><Input type="number" min={0} value={photos} onChange={e => setPhotos(e.target.value)} /></div>
        </div>
        <div><Label>Observações</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
        <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}