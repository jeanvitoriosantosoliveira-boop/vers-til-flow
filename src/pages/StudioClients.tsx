import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Search, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

type StudioClient = {
  id: string;
  full_name: string;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string;
  notes: string | null;
};

const SHOOT_TYPES = [
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
  const [list, setList] = useState<StudioClient[]>([]);
  const [cityFilter, setCityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [shootClientIds, setShootClientIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StudioClient | null>(null);
  const [waOpen, setWaOpen] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [waTarget, setWaTarget] = useState<StudioClient | null>(null);

  async function load() {
    const { data } = await supabase.from("studio_clients").select("*").order("created_at", { ascending: false });
    setList((data ?? []) as StudioClient[]);
    if (typeFilter !== "all") {
      const { data: shoots } = await supabase
        .from("studio_shoots").select("client_id").eq("shoot_type", typeFilter as any);
      setShootClientIds(new Set((shoots ?? []).map((s: any) => s.client_id)));
    } else {
      setShootClientIds(new Set());
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [typeFilter]);

  const cities = Array.from(new Set(list.map(c => c.city).filter(Boolean))).sort();
  const filtered = list.filter(c => {
    if (cityFilter && c.city.toLowerCase() !== cityFilter.toLowerCase()) return false;
    if (typeFilter !== "all" && !shootClientIds.has(c.id)) return false;
    return true;
  });

  function openWhats(c: StudioClient) {
    setWaTarget(c);
    setWaMessage(`Olá ${c.full_name.split(" ")[0]}! Abri agenda em ${c.city}, tenho horários disponíveis. Vamos agendar?`);
    setWaOpen(true);
  }
  function sendWhats() {
    if (!waTarget?.phone) { toast.error("Cliente sem telefone"); return; }
    const digits = waTarget.phone.replace(/\D/g, "");
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(waMessage)}`;
    window.open(url, "_blank");
    setWaOpen(false);
  }

  async function remove(id: string) {
    if (!confirm("Excluir este cliente?")) return;
    await supabase.from("studio_clients").delete().eq("id", id);
    toast.success("Removido");
    load();
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl">Clientes do Studio</h1>
          <p className="text-sm text-muted-foreground">Base de clientes para ensaios e remarketing.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><UserPlus className="w-4 h-4" /> Novo cliente</Button>
          </DialogTrigger>
          <ClientFormDialog editing={editing} onSaved={() => { setOpen(false); setEditing(null); load(); }} userId={user!.id} />
        </Dialog>
      </div>

      <Card className="p-4 grid sm:grid-cols-3 gap-3">
        <div>
          <Label>Cidade</Label>
          <Select value={cityFilter || "all"} onValueChange={v => setCityFilter(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as cidades</SelectItem>
              {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tipo de ensaio (já realizado)</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SHOOT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <p className="text-sm text-muted-foreground"><Search className="w-3 h-3 inline mr-1" />{filtered.length} cliente(s)</p>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(c => (
          <Card key={c.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{c.full_name}</p>
                <p className="text-xs text-muted-foreground">{c.city}</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="w-3 h-3" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
              </div>
            </div>
            <div className="text-xs space-y-0.5 text-muted-foreground">
              {c.phone && <p>📱 {c.phone}</p>}
              {c.email && <p>✉️ {c.email}</p>}
              {c.cpf && <p>CPF: {c.cpf}</p>}
            </div>
            {c.phone && (
              <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => openWhats(c)}>
                <MessageCircle className="w-3 h-3" /> WhatsApp
              </Button>
            )}
          </Card>
        ))}
        {filtered.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">Nenhum cliente encontrado.</Card>}
      </div>

      <Dialog open={waOpen} onOpenChange={setWaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mensagem para {waTarget?.full_name}</DialogTitle></DialogHeader>
          <Textarea value={waMessage} onChange={e => setWaMessage(e.target.value)} rows={5} />
          <DialogFooter>
            <Button onClick={sendWhats} className="gap-2"><MessageCircle className="w-4 h-4" /> Abrir WhatsApp</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientFormDialog({ editing, onSaved, userId }: { editing: StudioClient | null; onSaved: () => void; userId: string }) {
  const [full_name, setName] = useState(editing?.full_name ?? "");
  const [cpf, setCpf] = useState(editing?.cpf ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [address, setAddress] = useState(editing?.address ?? "");
  const [city, setCity] = useState(editing?.city ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(editing?.full_name ?? "");
    setCpf(editing?.cpf ?? "");
    setEmail(editing?.email ?? "");
    setPhone(editing?.phone ?? "");
    setAddress(editing?.address ?? "");
    setCity(editing?.city ?? "");
    setNotes(editing?.notes ?? "");
  }, [editing]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!full_name || !city) { toast.error("Nome e cidade são obrigatórios"); return; }
    setBusy(true);
    const payload = { full_name, cpf: cpf || null, email: email || null, phone: phone || null, address: address || null, city, notes: notes || null };
    const res = editing
      ? await supabase.from("studio_clients").update(payload).eq("id", editing.id)
      : await supabase.from("studio_clients").insert({ ...payload, created_by: userId });
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    toast.success("Salvo");
    onSaved();
  }
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} cliente</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Nome completo*</Label><Input value={full_name} onChange={e => setName(e.target.value)} required /></div>
          <div><Label>CPF</Label><Input value={cpf} onChange={e => setCpf(e.target.value)} /></div>
          <div><Label>E-mail</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div><Label>Telefone (com DDD)</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="55 45 99999-9999" /></div>
          <div className="sm:col-span-2"><Label>Endereço</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
          <div><Label>Cidade*</Label><Input value={city} onChange={e => setCity(e.target.value)} required /></div>
        </div>
        <div><Label>Observações</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
        <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}