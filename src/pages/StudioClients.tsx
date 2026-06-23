import { useCallback, useEffect, useMemo, useState } from "react";
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
import { MessageCircle, Pencil, Search, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

type StudioClient = {
  id: string;
  full_name: string;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string;
  notes: string | null;
  created_by?: string | null;
};

type StudioShootType =
  | "casal" | "gestante" | "corporativo" | "individual" | "familia" | "casamento"
  | "aniversario" | "infantil" | "empresarial" | "parto" | "sensual" | "formatura" | "produto";

const SHOOT_TYPES: Array<{ value: "all" | StudioShootType; label: string }> = [
  { value: "all", label: "Todos os tipos" },
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

export default function StudioClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<StudioClient[]>([]);
  const [shootClientIds, setShootClientIds] = useState<Set<string>>(new Set());
  const [cityFilter, setCityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | StudioShootType>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StudioClient | null>(null);
  const [waOpen, setWaOpen] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [waTarget, setWaTarget] = useState<StudioClient | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("studio_clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar clientes do Studio");
      return;
    }

    setClients((data ?? []) as StudioClient[]);

    if (typeFilter === "all") {
      setShootClientIds(new Set());
      return;
    }

    const { data: shoots, error: shootsError } = await supabase
      .from("studio_shoots")
      .select("client_id")
      .eq("shoot_type", typeFilter);

    if (shootsError) {
      toast.error("Erro ao aplicar filtro por tipo de ensaio");
      return;
    }

    setShootClientIds(new Set((shoots ?? []).map((shoot) => shoot.client_id)));
  }, [typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const cities = useMemo(
    () => Array.from(new Set(clients.map((client) => client.city).filter(Boolean))).sort(),
    [clients],
  );

  const filtered = clients.filter((client) => {
    if (cityFilter !== "all" && client.city !== cityFilter) return false;
    if (typeFilter !== "all" && !shootClientIds.has(client.id)) return false;
    return true;
  });

  function openWhatsApp(client: StudioClient) {
    setWaTarget(client);
    setWaMessage(`Olá ${client.full_name.split(" ")[0]}! Abri agenda em ${client.city}, tenho horários disponíveis. Vamos agendar?`);
    setWaOpen(true);
  }

  function sendWhatsApp() {
    if (!waTarget?.phone) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }

    const digits = waTarget.phone.replace(/\D/g, "");
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(waMessage)}`, "_blank");
    setWaOpen(false);
  }

  async function remove(id: string) {
    if (!confirm("Excluir este cliente do Studio?")) return;
    const { error } = await supabase.from("studio_clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Cliente removido");
    load();
  }

  if (user?.role !== "studio") return <Navigate to="/" replace />;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl">Clientes do Studio</h1>
          <p className="text-sm text-muted-foreground">Base separada para organização, filtros e remarketing.</p>
        </div>

        <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><UserPlus className="w-4 h-4" /> Novo cliente</Button>
          </DialogTrigger>
          <ClientFormDialog
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

      <Card className="p-4 grid sm:grid-cols-3 gap-3">
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
          <Label>Tipo de ensaio já realizado</Label>
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as "all" | StudioShootType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SHOOT_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <p className="text-sm text-muted-foreground">
            <Search className="w-3 h-3 inline mr-1" />
            {filtered.length} cliente(s)
          </p>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((client) => (
          <Card key={client.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{client.full_name}</p>
                <p className="text-xs text-muted-foreground">{client.city}</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(client); setOpen(true); }}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(client.id)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            </div>
            <div className="text-xs space-y-0.5 text-muted-foreground">
              {client.phone && <p>Telefone: {client.phone}</p>}
              {client.email && <p>Email: {client.email}</p>}
              {client.cpf && <p>CPF: {client.cpf}</p>}
            </div>
            {client.phone && (
              <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => openWhatsApp(client)}>
                <MessageCircle className="w-3 h-3" /> WhatsApp
              </Button>
            )}
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            Nenhum cliente encontrado.
          </Card>
        )}
      </div>

      <Dialog open={waOpen} onOpenChange={setWaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mensagem para {waTarget?.full_name}</DialogTitle></DialogHeader>
          <Textarea value={waMessage} onChange={(event) => setWaMessage(event.target.value)} rows={5} />
          <DialogFooter>
            <Button onClick={sendWhatsApp} className="gap-2"><MessageCircle className="w-4 h-4" /> Abrir WhatsApp</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientFormDialog({ editing, onSaved, userId }: { editing: StudioClient | null; onSaved: () => void; userId: string }) {
  const [fullName, setFullName] = useState(editing?.full_name ?? "");
  const [cpf, setCpf] = useState(editing?.cpf ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [address, setAddress] = useState(editing?.address ?? "");
  const [city, setCity] = useState(editing?.city ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFullName(editing?.full_name ?? "");
    setCpf(editing?.cpf ?? "");
    setEmail(editing?.email ?? "");
    setPhone(editing?.phone ?? "");
    setAddress(editing?.address ?? "");
    setCity(editing?.city ?? "");
    setNotes(editing?.notes ?? "");
  }, [editing]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!fullName.trim() || !city.trim()) {
      toast.error("Nome completo e cidade são obrigatórios");
      return;
    }

    setBusy(true);
    const payload = {
      full_name: fullName.trim(),
      cpf: cpf.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      city: city.trim(),
      notes: notes.trim() || null,
    };

    const result = editing
      ? await supabase.from("studio_clients").update(payload).eq("id", editing.id)
      : await supabase.from("studio_clients").insert({ ...payload, created_by: userId });

    setBusy(false);
    if (result.error) return toast.error(result.error.message);
    toast.success("Cliente salvo");
    onSaved();
  }

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} cliente do Studio</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Nome completo*</Label><Input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></div>
          <div><Label>CPF</Label><Input value={cpf} onChange={(event) => setCpf(event.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <div><Label>Telefone com DDD</Label><Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="55 45 99999-9999" /></div>
          <div className="sm:col-span-2"><Label>Endereço</Label><Input value={address} onChange={(event) => setAddress(event.target.value)} /></div>
          <div><Label>Cidade*</Label><Input value={city} onChange={(event) => setCity(event.target.value)} required /></div>
        </div>
        <div><Label>Observações</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} /></div>
        <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
