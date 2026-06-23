import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type StudioShootType =
  | "casal" | "gestante" | "corporativo" | "individual" | "familia" | "casamento"
  | "aniversario" | "infantil" | "empresarial" | "parto" | "sensual" | "formatura" | "produto";

type Shoot = {
  id: string;
  client_id: string;
  city: string;
  shoot_type: StudioShootType;
  shoot_date: string | null;
  photos_delivered: number;
  notes: string | null;
};

type Client = {
  id: string;
  full_name: string;
  city: string;
};

const SHOOT_TYPES: Array<{ value: StudioShootType; label: string }> = [
  { value: "casal", label: "Casal" },
  { value: "gestante", label: "Gestante" },
  { value: "corporativo", label: "Corporativo" },
  { value: "individual", label: "Individual" },
  { value: "familia", label: "Família" },
  { value: "casamento", label: "Casamento" },
  { value: "aniversario", label: "Aniversário" },
  { value: "infantil", label: "Infantil" },
  { value: "empresarial", label: "Empresarial" },
  { value: "parto", label: "Parto" },
  { value: "sensual", label: "Sensual" },
  { value: "formatura", label: "Formatura" },
  { value: "produto", label: "Produto" },
];

export default function StudioShoots() {
  const { user } = useAuth();
  const [shoots, setShoots] = useState<Shoot[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cityFilter, setCityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | StudioShootType>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Shoot | null>(null);

  async function load() {
    const [shootsResult, clientsResult] = await Promise.all([
      supabase.from("studio_shoots").select("*").order("shoot_date", { ascending: false, nullsFirst: false }),
      supabase.from("studio_clients").select("id, full_name, city").order("full_name"),
    ]);

    if (shootsResult.error) toast.error("Erro ao carregar ensaios");
    if (clientsResult.error) toast.error("Erro ao carregar clientes");

    setShoots((shootsResult.data ?? []) as Shoot[]);
    setClients((clientsResult.data ?? []) as Client[]);
  }

  useEffect(() => {
    load();
  }, []);

  const cities = useMemo(
    () => Array.from(new Set(shoots.map((shoot) => shoot.city).filter(Boolean))).sort(),
    [shoots],
  );
  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const filtered = shoots.filter((shoot) =>
    (cityFilter === "all" || shoot.city === cityFilter) &&
    (typeFilter === "all" || shoot.shoot_type === typeFilter)
  );

  async function remove(id: string) {
    if (!confirm("Excluir este ensaio?")) return;
    const { error } = await supabase.from("studio_shoots").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Ensaio removido");
    load();
  }

  if (user?.role !== "studio") return <Navigate to="/" replace />;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl">Ensaios</h1>
          <p className="text-sm text-muted-foreground">Registre ensaios e segmente por cidade e tipo.</p>
        </div>

        <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Novo ensaio</Button>
          </DialogTrigger>
          <ShootFormDialog
            clients={clients}
            editing={editing}
            userId={user.id}
            onSaved={() => {
              setOpen(false);
              setEditing(null);
              load();
            }}
          />
        </Dialog>
      </div>

      <Card className="p-4 grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Cidade</Label>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as cidades</SelectItem>
              {cities.map((city) => <SelectItem key={city} value={city}>{city}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tipo de ensaio</Label>
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as "all" | StudioShootType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {SHOOT_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((shoot) => {
          const client = clientMap.get(shoot.client_id);
          const typeLabel = SHOOT_TYPES.find((type) => type.value === shoot.shoot_type)?.label ?? shoot.shoot_type;

          return (
            <Card key={shoot.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold flex items-center gap-1"><Camera className="w-3 h-3" /> {typeLabel}</p>
                  <p className="text-sm">{client?.full_name ?? "Cliente não encontrado"}</p>
                  <p className="text-xs text-muted-foreground">
                    {shoot.city}
                    {shoot.shoot_date && ` · ${new Date(shoot.shoot_date).toLocaleDateString("pt-BR")}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(shoot); setOpen(true); }}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(shoot.id)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </div>
              <p className="text-xs"><span className="text-muted-foreground">Fotos entregues:</span> <strong>{shoot.photos_delivered}</strong></p>
              {shoot.notes && <p className="text-xs text-muted-foreground">{shoot.notes}</p>}
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            Nenhum ensaio encontrado.
          </Card>
        )}
      </div>
    </div>
  );
}

function ShootFormDialog({ clients, editing, onSaved, userId }: { clients: Client[]; editing: Shoot | null; onSaved: () => void; userId: string }) {
  const [clientId, setClientId] = useState(editing?.client_id ?? "");
  const [shootType, setShootType] = useState<StudioShootType>(editing?.shoot_type ?? "casal");
  const [shootDate, setShootDate] = useState(editing?.shoot_date ?? "");
  const [photos, setPhotos] = useState(String(editing?.photos_delivered ?? 0));
  const [city, setCity] = useState(editing?.city ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setClientId(editing?.client_id ?? "");
    setShootType(editing?.shoot_type ?? "casal");
    setShootDate(editing?.shoot_date ?? "");
    setPhotos(String(editing?.photos_delivered ?? 0));
    setCity(editing?.city ?? "");
    setNotes(editing?.notes ?? "");
  }, [editing]);

  useEffect(() => {
    const client = clients.find((item) => item.id === clientId);
    if (client && !city) setCity(client.city);
  }, [clientId, clients, city]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!clientId || !city.trim()) {
      toast.error("Cliente e cidade são obrigatórios");
      return;
    }

    setBusy(true);
    const payload = {
      client_id: clientId,
      city: city.trim(),
      shoot_type: shootType,
      shoot_date: shootDate || null,
      photos_delivered: Number.parseInt(photos, 10) || 0,
      notes: notes.trim() || null,
      created_by: userId,
    };

    const result = editing
      ? await supabase.from("studio_shoots").update(payload).eq("id", editing.id)
      : await supabase.from("studio_shoots").insert(payload);

    setBusy(false);
    if (result.error) return toast.error(result.error.message);
    toast.success(editing ? "Ensaio atualizado" : "Ensaio registrado");
    onSaved();
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} ensaio</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label>Cliente*</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.full_name} ({client.city})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo*</Label>
            <Select value={shootType} onValueChange={(value) => setShootType(value as StudioShootType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SHOOT_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Data</Label><Input type="date" value={shootDate} onChange={(event) => setShootDate(event.target.value)} /></div>
          <div><Label>Cidade*</Label><Input value={city} onChange={(event) => setCity(event.target.value)} required /></div>
          <div><Label>Fotos entregues</Label><Input type="number" min={0} value={photos} onChange={(event) => setPhotos(event.target.value)} /></div>
        </div>
        <div><Label>Observações</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} /></div>
        <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
