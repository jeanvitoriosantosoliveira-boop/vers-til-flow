import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock, MessageCircle, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

type StudioShootType =
  | "casal" | "gestante" | "corporativo" | "individual" | "familia" | "casamento"
  | "aniversario" | "infantil" | "empresarial" | "parto" | "sensual" | "formatura" | "produto";

type FollowUpStatus = "pending" | "contacted" | "lost" | "converted";

type StudioFollowUp = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  city: string;
  desired_shoot_type: StudioShootType;
  estimated_value: number | null;
  status: FollowUpStatus;
  follow_up_date: string | null;
  notes: string | null;
  created_by?: string | null;
  created_at: string;
};

const SHOOT_TYPES: Array<{ value: "all" | StudioShootType; label: string }> = [
  { value: "all", label: "Todos os estilos" },
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

const STATUS_OPTIONS: Array<{ value: "all" | FollowUpStatus; label: string }> = [
  { value: "all", label: "Todos os status" },
  { value: "pending", label: "Aguardando retorno" },
  { value: "contacted", label: "Em contato" },
  { value: "lost", label: "Não fechou" },
  { value: "converted", label: "Fechado" },
];

const SHOOT_TYPE_LABELS = Object.fromEntries(SHOOT_TYPES.map((type) => [type.value, type.label])) as Record<string, string>;
const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.map((status) => [status.value, status.label])) as Record<string, string>;

export default function StudioFollowUps() {
  const { user } = useAuth();
  const [followUps, setFollowUps] = useState<StudioFollowUp[]>([]);
  const [cityFilter, setCityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | StudioShootType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | FollowUpStatus>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StudioFollowUp | null>(null);
  const [waOpen, setWaOpen] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [waTarget, setWaTarget] = useState<StudioFollowUp | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("studio_followups")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar follow ups do Studio");
      return;
    }

    setFollowUps((data ?? []) as StudioFollowUp[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cities = useMemo(
    () => Array.from(new Set(followUps.map((item) => item.city).filter(Boolean))).sort(),
    [followUps],
  );

  const filtered = followUps.filter((item) => {
    const term = search.trim().toLowerCase();
    if (cityFilter !== "all" && item.city !== cityFilter) return false;
    if (typeFilter !== "all" && item.desired_shoot_type !== typeFilter) return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (!term) return true;

    return [item.full_name, item.email, item.phone, item.city, item.notes]
      .some((value) => value?.toLowerCase().includes(term));
  });

  function openWhatsApp(item: StudioFollowUp) {
    setWaTarget(item);
    setWaMessage(`Olá ${item.full_name.split(" ")[0]}! Passando para retomarmos seu orçamento de fotos ${SHOOT_TYPE_LABELS[item.desired_shoot_type]?.toLowerCase() ?? item.desired_shoot_type} em ${item.city}.`);
    setWaOpen(true);
  }

  function sendWhatsApp() {
    if (!waTarget?.phone) {
      toast.error("Follow up sem telefone cadastrado");
      return;
    }

    const digits = waTarget.phone.replace(/\D/g, "");
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(waMessage)}`, "_blank");
    setWaOpen(false);
  }

  async function remove(id: string) {
    if (!confirm("Excluir este follow up?")) return;
    const { error } = await supabase.from("studio_followups").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Follow up removido");
    load();
  }

  if (user?.role !== "studio") return <Navigate to="/" replace />;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl">Follow Up Studio</h1>
          <p className="text-sm text-muted-foreground">Clientes que pediram orçamento, mas ainda não fecharam.</p>
        </div>

        <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> Novo follow up</Button>
          </DialogTrigger>
          <FollowUpFormDialog
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

      <Card className="p-4 grid sm:grid-cols-4 gap-3">
        <div>
          <Label>Buscar</Label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Nome, telefone, cidade..." />
          </div>
        </div>
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
          <Label>Estilo desejado</Label>
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as "all" | StudioShootType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SHOOT_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | FollowUpStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => (
          <Card key={item.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{item.full_name}</p>
                <p className="text-xs text-muted-foreground">{item.city}</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(item); setOpen(true); }}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(item.id)}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{SHOOT_TYPE_LABELS[item.desired_shoot_type] ?? item.desired_shoot_type}</Badge>
              <Badge variant={item.status === "lost" ? "destructive" : item.status === "converted" ? "default" : "secondary"}>
                {STATUS_LABELS[item.status] ?? item.status}
              </Badge>
            </div>

            <div className="text-xs space-y-0.5 text-muted-foreground">
              {item.phone && <p>Telefone: {item.phone}</p>}
              {item.email && <p>Email: {item.email}</p>}
              {item.estimated_value !== null && <p>Orçamento: R$ {Number(item.estimated_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>}
              {item.follow_up_date && (
                <p className="flex items-center gap-1">
                  <CalendarClock className="w-3 h-3" />
                  Retorno: {new Date(`${item.follow_up_date}T00:00:00`).toLocaleDateString("pt-BR")}
                </p>
              )}
              {item.notes && <p>{item.notes}</p>}
            </div>

            {item.phone && (
              <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => openWhatsApp(item)}>
                <MessageCircle className="w-3 h-3" /> WhatsApp
              </Button>
            )}
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            Nenhum follow up encontrado.
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

function FollowUpFormDialog({ editing, onSaved, userId }: { editing: StudioFollowUp | null; onSaved: () => void; userId: string }) {
  const [fullName, setFullName] = useState(editing?.full_name ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [city, setCity] = useState(editing?.city ?? "");
  const [desiredShootType, setDesiredShootType] = useState<StudioShootType>(editing?.desired_shoot_type ?? "gestante");
  const [estimatedValue, setEstimatedValue] = useState(editing?.estimated_value ? String(editing.estimated_value) : "");
  const [status, setStatus] = useState<FollowUpStatus>(editing?.status ?? "pending");
  const [followUpDate, setFollowUpDate] = useState(editing?.follow_up_date ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFullName(editing?.full_name ?? "");
    setEmail(editing?.email ?? "");
    setPhone(editing?.phone ?? "");
    setCity(editing?.city ?? "");
    setDesiredShootType(editing?.desired_shoot_type ?? "gestante");
    setEstimatedValue(editing?.estimated_value ? String(editing.estimated_value) : "");
    setStatus(editing?.status ?? "pending");
    setFollowUpDate(editing?.follow_up_date ?? "");
    setNotes(editing?.notes ?? "");
  }, [editing]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!fullName.trim() || !city.trim()) {
      toast.error("Nome e cidade são obrigatórios");
      return;
    }

    setBusy(true);
    const payload = {
      full_name: fullName.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      city: city.trim(),
      desired_shoot_type: desiredShootType,
      estimated_value: estimatedValue ? Number(estimatedValue) : null,
      status,
      follow_up_date: followUpDate || null,
      notes: notes.trim() || null,
    };

    const result = editing
      ? await supabase.from("studio_followups").update(payload).eq("id", editing.id)
      : await supabase.from("studio_followups").insert({ ...payload, created_by: userId });

    setBusy(false);
    if (result.error) return toast.error(result.error.message);
    toast.success("Follow up salvo");
    onSaved();
  }

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} follow up</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Nome*</Label><Input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></div>
          <div><Label>Cidade*</Label><Input value={city} onChange={(event) => setCity(event.target.value)} required /></div>
          <div><Label>Telefone com DDD</Label><Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="55 45 99999-9999" /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <div>
            <Label>Estilo desejado*</Label>
            <Select value={desiredShootType} onValueChange={(value) => setDesiredShootType(value as StudioShootType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SHOOT_TYPES.filter((type) => type.value !== "all").map((type) => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status*</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as FollowUpStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.filter((item) => item.value !== "all").map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Valor orçado</Label><Input type="number" min={0} step="0.01" value={estimatedValue} onChange={(event) => setEstimatedValue(event.target.value)} /></div>
          <div><Label>Data de retorno</Label><Input type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} /></div>
        </div>
        <div><Label>Observações</Label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} /></div>
        <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}
