import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Music2, Plus, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";

type StudioShootType =
  | "casal" | "gestante" | "corporativo" | "individual" | "familia" | "casamento"
  | "aniversario" | "infantil" | "empresarial" | "parto" | "sensual" | "formatura" | "produto";

type StudioClient = {
  id: string;
  full_name: string;
  city: string;
};

type StudioShoot = {
  id: string;
  client_id: string;
  city: string;
  shoot_type: StudioShootType;
  shoot_date: string | null;
  photos_delivered: number;
  business_value: number | null;
  payment_status: string;
  notes: string | null;
};

interface SExpense { id: string; title: string; category: string; amount: number; occurred_on: string; description: string | null; }

const BRL = (v: number) => `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

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

const SHOOT_TYPE_LABELS = Object.fromEntries(SHOOT_TYPES.map((type) => [type.value, type.label])) as Record<string, string>;
const PAYMENT_STATUS_LABELS: Record<string, string> = { pending: "Pendente", paid: "Pago", canceled: "Cancelado" };

export default function Studio() {
  const { user } = useAuth();
  const [clients, setClients] = useState<StudioClient[]>([]);
  const [shoots, setShoots] = useState<StudioShoot[]>([]);
  const [expenses, setExpenses] = useState<SExpense[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [clientsResult, shootsResult, e] = await Promise.all([
      supabase.from("studio_clients").select("id, full_name, city").order("full_name"),
      supabase.from("studio_shoots").select("*").order("shoot_date", { ascending: false, nullsFirst: false }),
      supabase.from("studio_expenses").select("*").order("occurred_on", { ascending: false }),
    ]);
    if (clientsResult.error) toast.error("Erro ao carregar clientes do Studio");
    if (shootsResult.error) toast.error("Erro ao carregar ensaios do Studio");
    if (e.error) toast.error("Erro ao carregar despesas do Studio");
    if (clientsResult.data) setClients(clientsResult.data as StudioClient[]);
    if (shootsResult.data) setShoots(shootsResult.data as StudioShoot[]);
    if (e.data) setExpenses(e.data as SExpense[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const cityOptions = useMemo(
    () => Array.from(new Set(clients.map((client) => client.city).filter(Boolean))).sort(),
    [clients],
  );
  const totalRevenue = useMemo(() => shoots.filter(s => s.payment_status === "paid").reduce((a, s) => a + Number(s.business_value || 0), 0), [shoots]);
  const pendingRevenue = useMemo(() => shoots.filter(s => s.payment_status === "pending").reduce((a, s) => a + Number(s.business_value || 0), 0), [shoots]);
  const totalExpenses = useMemo(() => expenses.reduce((a, e) => a + Number(e.amount || 0), 0), [expenses]);
  const profit = totalRevenue - totalExpenses;
  const totalSessions = shoots.length;

  const [openSession, setOpenSession] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    client_id: "",
    city: "",
    shoot_type: "casal" as StudioShootType,
    shoot_date: new Date().toISOString().slice(0, 10),
    photos_delivered: "0",
    business_value: "",
    payment_status: "pending",
    notes: "",
  });
  const [openExp, setOpenExp] = useState(false);
  const [expForm, setExpForm] = useState<Partial<SExpense>>({ category: "general", occurred_on: new Date().toISOString().slice(0, 10), amount: 0 });
  const filteredClients = clients.filter((client) => !sessionForm.city || client.city === sessionForm.city);

  async function saveSession() {
    if (!sessionForm.city) return toast.error("Cidade obrigatória");
    if (!sessionForm.client_id) return toast.error("Cliente obrigatório");
    const payload = {
      client_id: sessionForm.client_id,
      city: sessionForm.city,
      shoot_type: sessionForm.shoot_type,
      shoot_date: sessionForm.shoot_date || null,
      photos_delivered: Number.parseInt(sessionForm.photos_delivered, 10) || 0,
      business_value: sessionForm.business_value ? Number(sessionForm.business_value) : 0,
      payment_status: sessionForm.payment_status,
      notes: sessionForm.notes.trim() || null,
      created_by: user?.id,
    };
    const { error } = await supabase.from("studio_shoots").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Negócio do Studio criado");
    setOpenSession(false);
    setSessionForm({ client_id: "", city: "", shoot_type: "casal", shoot_date: new Date().toISOString().slice(0, 10), photos_delivered: "0", business_value: "", payment_status: "pending", notes: "" });
    load();
  }
  async function saveExpense() {
    if (!expForm.title?.trim()) return toast.error("Título obrigatório");
    const payload = {
      title: expForm.title.trim(),
      category: expForm.category?.trim() || "general",
      amount: Number(expForm.amount) || 0,
      occurred_on: expForm.occurred_on || new Date().toISOString().slice(0, 10),
      description: expForm.description?.trim() || null,
      created_by: user?.id,
    };
    const { error } = await supabase.from("studio_expenses").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Despesa criada");
    setOpenExp(false);
    setExpForm({ category: "general", occurred_on: new Date().toISOString().slice(0, 10), amount: 0 });
    load();
  }
  async function removeSession(id: string) {
    if (!confirm("Remover ensaio?")) return;
    await supabase.from("studio_shoots").delete().eq("id", id);
    load();
  }
  async function removeExpense(id: string) {
    if (!confirm("Remover despesa?")) return;
    await supabase.from("studio_expenses").delete().eq("id", id);
    load();
  }
  async function togglePaid(s: StudioShoot) {
    const next = s.payment_status === "paid" ? "pending" : "paid";
    await supabase.from("studio_shoots").update({ payment_status: next }).eq("id", s.id);
    load();
  }

  if (!user) return null;
  if (user.role !== "studio") return <Navigate to="/" replace />;

  return (
    <div className="max-w-7xl mx-auto p-4">
      <PageHeader
        title="Financeiro Studio"
        subtitle="Controle financeiro usando os clientes e ensaios cadastrados no Studio."
        actions={
          <div className="flex gap-2">
            <Dialog open={openSession} onOpenChange={setOpenSession}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" /> Novo negócio</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo negócio do Studio</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div>
                    <Label>Cidade*</Label>
                    <Select value={sessionForm.city} onValueChange={value => setSessionForm(f => ({ ...f, city: value, client_id: "" }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{cityOptions.map(city => <SelectItem key={city} value={city}>{city}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Cliente*</Label>
                    <Select value={sessionForm.client_id} onValueChange={value => setSessionForm(f => ({ ...f, client_id: value }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{filteredClients.map(client => <SelectItem key={client.id} value={client.id}>{client.full_name} ({client.city})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Tipo*</Label>
                      <Select value={sessionForm.shoot_type} onValueChange={value => setSessionForm(f => ({ ...f, shoot_type: value as StudioShootType }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{SHOOT_TYPES.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Data</Label><Input type="date" value={sessionForm.shoot_date} onChange={e => setSessionForm(f => ({ ...f, shoot_date: e.target.value }))} /></div>
                    <div><Label>Valor do negócio</Label><Input type="number" min={0} step="0.01" value={sessionForm.business_value} onChange={e => setSessionForm(f => ({ ...f, business_value: e.target.value }))} /></div>
                    <div>
                      <Label>Status financeiro</Label>
                      <Select value={sessionForm.payment_status} onValueChange={v => setSessionForm(f => ({ ...f, payment_status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="pending">Pendente</SelectItem><SelectItem value="paid">Pago</SelectItem><SelectItem value="canceled">Cancelado</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Fotos entregues</Label><Input type="number" min={0} value={sessionForm.photos_delivered} onChange={e => setSessionForm(f => ({ ...f, photos_delivered: e.target.value }))} /></div>
                  <div><Label>Notas</Label><Textarea value={sessionForm.notes ?? ""} onChange={e => setSessionForm(f => ({ ...f, notes: e.target.value }))} /></div>
                </div>
                <DialogFooter><Button onClick={saveSession}>Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Music2 className="w-3 h-3" /> Ensaios</div><p className="font-display text-2xl font-bold mt-2">{totalSessions}</p></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Recebido</div><p className="font-display text-2xl font-bold mt-2 text-success">{BRL(totalRevenue)}</p></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> A receber</div><p className="font-display text-2xl font-bold mt-2 text-warning">{BRL(pendingRevenue)}</p></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Despesas</div><p className="font-display text-2xl font-bold mt-2 text-destructive">{BRL(totalExpenses)}</p></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="w-3 h-3" /> Lucro</div><p className={`font-display text-2xl font-bold mt-2 ${profit >= 0 ? "text-success" : "text-destructive"}`}>{BRL(profit)}</p></Card>
      </div>

      <Tabs defaultValue="sessions">
        <TabsList><TabsTrigger value="sessions">Ensaios</TabsTrigger><TabsTrigger value="expenses">Despesas</TabsTrigger></TabsList>

        <TabsContent value="sessions">
          <Card className="p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground"><tr><th className="text-left py-2">Data</th><th className="text-left">Tipo</th><th className="text-left">Cliente</th><th className="text-right">Fotos</th><th className="text-right">Valor</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Carregando…</td></tr>}
                {!loading && shoots.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Nenhum negócio cadastrado</td></tr>}
                {shoots.map(s => {
                  const client = clientMap.get(s.client_id);
                  return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="py-2">{s.shoot_date ? new Date(`${s.shoot_date}T00:00:00`).toLocaleDateString("pt-BR") : "—"}</td>
                    <td>{SHOOT_TYPE_LABELS[s.shoot_type] ?? s.shoot_type}</td>
                    <td>{client?.full_name ?? "Cliente não encontrado"}</td>
                    <td className="text-right">{s.photos_delivered}</td>
                    <td className="text-right tabular-nums">{BRL(Number(s.business_value ?? 0))}</td>
                    <td><Badge onClick={() => togglePaid(s)} className="cursor-pointer" variant={s.payment_status === "paid" ? "default" : "outline"}>{PAYMENT_STATUS_LABELS[s.payment_status] ?? s.payment_status}</Badge></td>
                    <td className="text-right"><Button size="icon" variant="ghost" onClick={() => removeSession(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></td>
                  </tr>
                )})}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <div className="flex justify-end mb-3">
            <Dialog open={openExp} onOpenChange={setOpenExp}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" /> Nova despesa</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova despesa do Studio</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div><Label>Título</Label><Input value={expForm.title ?? ""} onChange={e => setExpForm(f => ({ ...f, title: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Categoria</Label><Input value={expForm.category} onChange={e => setExpForm(f => ({ ...f, category: e.target.value }))} /></div>
                    <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={expForm.amount} onChange={e => setExpForm(f => ({ ...f, amount: Number(e.target.value) }))} /></div>
                  </div>
                  <div><Label>Data</Label><Input type="date" value={expForm.occurred_on} onChange={e => setExpForm(f => ({ ...f, occurred_on: e.target.value }))} /></div>
                  <div><Label>Descrição</Label><Textarea value={expForm.description ?? ""} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))} /></div>
                </div>
                <DialogFooter><Button onClick={saveExpense}>Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card className="p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground"><tr><th className="text-left py-2">Data</th><th className="text-left">Título</th><th className="text-left">Categoria</th><th className="text-right">Valor</th><th></th></tr></thead>
              <tbody>
                {!loading && expenses.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Nenhuma despesa</td></tr>}
                {expenses.map(e => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="py-2">{new Date(e.occurred_on).toLocaleDateString("pt-BR")}</td>
                    <td>{e.title}</td>
                    <td>{e.category}</td>
                    <td className="text-right tabular-nums text-destructive">{BRL(Number(e.amount))}</td>
                    <td className="text-right"><Button size="icon" variant="ghost" onClick={() => removeExpense(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}