import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Music2, Plus, Trash2, DollarSign, Calendar, Clock, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

const BRL = (v: number) => `R$ ${(v ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;

interface Session { id: string; title: string; artist_name: string | null; session_date: string; hours: number; hourly_rate: number; total_amount: number; payment_status: string; notes: string | null; }
interface SExpense { id: string; title: string; category: string; amount: number; occurred_on: string; description: string | null; }

export default function Studio() {
  const { user } = useAuth();
  if (!user) return null;
  if (!user.is_leader) return <Navigate to="/" replace />;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [expenses, setExpenses] = useState<SExpense[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [s, e] = await Promise.all([
      supabase.from("studio_sessions").select("*").order("session_date", { ascending: false }),
      supabase.from("studio_expenses").select("*").order("occurred_on", { ascending: false }),
    ]);
    if (s.data) setSessions(s.data as any);
    if (e.data) setExpenses(e.data as any);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const totalRevenue = useMemo(() => sessions.filter(s => s.payment_status === "paid").reduce((a, s) => a + Number(s.total_amount || 0), 0), [sessions]);
  const pendingRevenue = useMemo(() => sessions.filter(s => s.payment_status === "pending").reduce((a, s) => a + Number(s.total_amount || 0), 0), [sessions]);
  const totalExpenses = useMemo(() => expenses.reduce((a, e) => a + Number(e.amount || 0), 0), [expenses]);
  const profit = totalRevenue - totalExpenses;
  const totalSessions = sessions.length;

  // dialogs
  const [openSession, setOpenSession] = useState(false);
  const [sessionForm, setSessionForm] = useState<Partial<Session>>({ session_date: new Date().toISOString().slice(0, 10), hours: 1, hourly_rate: 0, total_amount: 0, payment_status: "pending" });
  const [openExp, setOpenExp] = useState(false);
  const [expForm, setExpForm] = useState<Partial<SExpense>>({ category: "general", occurred_on: new Date().toISOString().slice(0, 10), amount: 0 });

  async function saveSession() {
    if (!sessionForm.title?.trim()) return toast.error("Título obrigatório");
    const total = (Number(sessionForm.hours) || 0) * (Number(sessionForm.hourly_rate) || 0);
    const payload = { ...sessionForm, total_amount: sessionForm.total_amount || total, created_by: user.id } as any;
    const { error } = await supabase.from("studio_sessions").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Ensaio criado");
    setOpenSession(false);
    setSessionForm({ session_date: new Date().toISOString().slice(0, 10), hours: 1, hourly_rate: 0, total_amount: 0, payment_status: "pending" });
    load();
  }
  async function saveExpense() {
    if (!expForm.title?.trim()) return toast.error("Título obrigatório");
    const { error } = await supabase.from("studio_expenses").insert({ ...expForm, created_by: user.id } as any);
    if (error) return toast.error(error.message);
    toast.success("Despesa criada");
    setOpenExp(false);
    setExpForm({ category: "general", occurred_on: new Date().toISOString().slice(0, 10), amount: 0 });
    load();
  }
  async function removeSession(id: string) {
    if (!confirm("Remover ensaio?")) return;
    await supabase.from("studio_sessions").delete().eq("id", id);
    load();
  }
  async function removeExpense(id: string) {
    if (!confirm("Remover despesa?")) return;
    await supabase.from("studio_expenses").delete().eq("id", id);
    load();
  }
  async function togglePaid(s: Session) {
    const next = s.payment_status === "paid" ? "pending" : "paid";
    await supabase.from("studio_sessions").update({ payment_status: next }).eq("id", s.id);
    load();
  }

  return (
    <div className="max-w-7xl mx-auto p-4">
      <PageHeader
        title="Studio"
        subtitle="Controle de ensaios e financeiro exclusivo do estúdio."
        actions={
          <div className="flex gap-2">
            <Dialog open={openSession} onOpenChange={setOpenSession}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" /> Novo ensaio</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo ensaio</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div><Label>Título</Label><Input value={sessionForm.title ?? ""} onChange={e => setSessionForm(f => ({ ...f, title: e.target.value }))} /></div>
                  <div><Label>Empresa</Label><Input value={sessionForm.artist_name ?? ""} onChange={e => setSessionForm(f => ({ ...f, artist_name: e.target.value }))} /></div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label>Data</Label><Input type="date" value={sessionForm.session_date} onChange={e => setSessionForm(f => ({ ...f, session_date: e.target.value }))} /></div>
                    <div><Label>Horas</Label><Input type="number" step="0.5" value={sessionForm.hours} onChange={e => setSessionForm(f => ({ ...f, hours: Number(e.target.value) }))} /></div>
                    <div><Label>R$ / hora</Label><Input type="number" step="0.01" value={sessionForm.hourly_rate} onChange={e => setSessionForm(f => ({ ...f, hourly_rate: Number(e.target.value) }))} /></div>
                  </div>
                  <div><Label>Total (R$)</Label><Input type="number" step="0.01" value={sessionForm.total_amount || ((sessionForm.hours || 0) * (sessionForm.hourly_rate || 0))} onChange={e => setSessionForm(f => ({ ...f, total_amount: Number(e.target.value) }))} /></div>
                  <div><Label>Status</Label>
                    <Select value={sessionForm.payment_status} onValueChange={v => setSessionForm(f => ({ ...f, payment_status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="pending">Pendente</SelectItem><SelectItem value="paid">Pago</SelectItem><SelectItem value="canceled">Cancelado</SelectItem></SelectContent>
                    </Select>
                  </div>
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
              <thead className="text-xs uppercase text-muted-foreground"><tr><th className="text-left py-2">Data</th><th className="text-left">Título</th><th className="text-left">Artista</th><th className="text-right">Horas</th><th className="text-right">Total</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Carregando…</td></tr>}
                {!loading && sessions.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Nenhum ensaio</td></tr>}
                {sessions.map(s => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="py-2">{new Date(s.session_date).toLocaleDateString("pt-BR")}</td>
                    <td>{s.title}</td>
                    <td>{s.artist_name ?? "—"}</td>
                    <td className="text-right">{s.hours}</td>
                    <td className="text-right tabular-nums">{BRL(Number(s.total_amount))}</td>
                    <td><Badge onClick={() => togglePaid(s)} className="cursor-pointer" variant={s.payment_status === "paid" ? "default" : "outline"}>{s.payment_status === "paid" ? "Pago" : s.payment_status === "canceled" ? "Cancelado" : "Pendente"}</Badge></td>
                    <td className="text-right"><Button size="icon" variant="ghost" onClick={() => removeSession(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></td>
                  </tr>
                ))}
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