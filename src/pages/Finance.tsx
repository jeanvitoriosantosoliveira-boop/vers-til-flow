import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useApp } from "@/store/AppStore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  TrendingUp, TrendingDown, Wallet, Sparkles, ArrowUpRight, ArrowDownRight,
  Plus, Trash2, FileDown, DollarSign, Building2, Users as UsersIcon, Receipt,
  Home, Zap, Wifi, Briefcase, Code2, Megaphone, Tag, ArrowDownLeft, ArrowUpLeft
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Legend
} from "recharts";
import type { Expense, ExpenseCategory, ExtraService } from "@/types";
import { exportReportPdf } from "@/lib/exportPdf";

const BUILTIN_CATEGORY_META: Record<string, { label: string; icon: any; color: string }> = {
  rent:      { label: "Aluguel",       icon: Home,       color: "text-primary" },
  utilities: { label: "Água/Luz",      icon: Zap,        color: "text-warning" },
  internet:  { label: "Internet",      icon: Wifi,       color: "text-accent" },
  equipment: { label: "Equipamento",   icon: Briefcase,  color: "text-success" },
  software:  { label: "Software",      icon: Code2,      color: "text-primary" },
  marketing: { label: "Marketing",     icon: Megaphone,  color: "text-accent" },
  tax:       { label: "Impostos",      icon: Receipt,    color: "text-destructive" },
  other:     { label: "Outros",        icon: Tag,        color: "text-muted-foreground" },
};
const FALLBACK_META = { label: "Outros", icon: Tag, color: "text-muted-foreground" };

const BRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

export default function Finance() {
  const {
    currentUser, clients, users, expenses, extraServices, financeSettings, cashAdjustments,
    createExpense, deleteExpense, createExtraService, deleteExtraService,
    updateFinanceSettings, updateUser, addCustomCategory,
    addCashAdjustment, deleteCashAdjustment,
  } = useApp();

  if (currentUser.role !== "leader") return <Navigate to="/" replace />;

  // Catálogo de categorias = built-ins + customizadas do usuário
  const CATEGORY_META: Record<string, { label: string; icon: any; color: string }> = {
    ...BUILTIN_CATEGORY_META,
    ...Object.fromEntries((financeSettings.custom_categories ?? []).map(c => [c.key, { label: c.label, icon: Tag, color: "text-accent" }])),
  };
  const getMeta = (k: string) => CATEGORY_META[k] ?? FALLBACK_META;

  // ---------------- helpers ----------------
  const now = new Date();
  const monthKey = (d: Date | string) => {
    const x = typeof d === "string" ? new Date(d) : d;
    return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`;
  };
  const currentMonthKey = monthKey(now);

  // Receita mensal fixa (mensalidades de clientes ativos)
  const monthlyRecurringRevenue = useMemo(
    () => clients.filter(c => c.status === "active").reduce((s,c) => s + (c.monthly_fee ?? 0), 0),
    [clients]
  );

  // Folha mensal
  const payrollBreakdown = useMemo(() => users.map(u => {
    const salary = u.salary ?? 0;
    const rate = u.tax_rate ?? financeSettings.default_tax_rate;
    const tax = salary * (rate / 100);
    return { user: u, salary, rate, tax, total: salary + tax };
  }), [users, financeSettings.default_tax_rate]);
  const monthlyPayroll = payrollBreakdown.reduce((s,p) => s + p.total, 0);

  // Aggregations por mês (últimos 12 + próximo)
  const months = useMemo(() => {
    const arr: { key: string; label: string; date: Date }[] = [];
    for (let i = 11; i >= -1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      arr.push({ key: monthKey(d), label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), date: d });
    }
    return arr;
  }, []);

  // Average of last 3 months for non-fixed components (used to forecast)
  const last3Avg = (filterFn: (mk: string) => number) => {
    const past = months.slice(-4, -1).map(m => filterFn(m.key));
    return past.reduce((a,b) => a+b, 0) / 3;
  };

  const monthlySeries = useMemo(() => months.map(m => {
    const isFuture = m.key > currentMonthKey;
    const avulsosMonth = extraServices.filter(s => monthKey(s.date) === m.key).reduce((s,x) => s + x.amount, 0);
    const expensesMonth = expenses.filter(e => monthKey(e.date) === m.key).reduce((s,e) => s + e.amount, 0);
    let revenue = monthlyRecurringRevenue + avulsosMonth;
    let cost = expensesMonth + monthlyPayroll;
    if (isFuture) {
      // forecast avulsos & expenses by 3-month average
      const avgAvulsos = last3Avg(k => extraServices.filter(s => monthKey(s.date) === k).reduce((s,x) => s + x.amount, 0));
      const avgExpenses = last3Avg(k => expenses.filter(e => monthKey(e.date) === k).reduce((s,e) => s + e.amount, 0));
      revenue = monthlyRecurringRevenue + avgAvulsos;
      cost = avgExpenses + monthlyPayroll;
    }
    return { ...m, isFuture, revenue, cost, profit: revenue - cost };
  }), [months, extraServices, expenses, monthlyRecurringRevenue, monthlyPayroll, currentMonthKey]);

  const currentMonth = monthlySeries.find(m => m.key === currentMonthKey)!;
  const nextMonth = monthlySeries[monthlySeries.length - 1];
  const prevMonth = monthlySeries[monthlySeries.length - 3];
  const sameMonthLastYear = monthlySeries.find(m => {
    const [y,mo] = m.key.split("-");
    return +y === now.getFullYear() - 1 && +mo === now.getMonth() + 1;
  });

  const growthVsPrev = prevMonth && prevMonth.revenue
    ? ((currentMonth.revenue - prevMonth.revenue) / prevMonth.revenue) * 100
    : 0;
  const growthVsLastYear = sameMonthLastYear && sameMonthLastYear.revenue
    ? ((currentMonth.revenue - sameMonthLastYear.revenue) / sameMonthLastYear.revenue) * 100
    : null;

  // Caixa: saldo inicial + ajustes manuais + lucros históricos até hoje
  const cashCurrent = useMemo(() => {
    const past = monthlySeries.filter(m => m.key <= currentMonthKey);
    const adj = cashAdjustments.reduce((s,a) => s + a.amount, 0);
    return financeSettings.opening_balance + adj + past.reduce((s,m) => s + m.profit, 0);
  }, [monthlySeries, currentMonthKey, financeSettings.opening_balance, cashAdjustments]);

  // Categorias (mês atual)
  const expensesByCategory = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    expenses.filter(e => monthKey(e.date) === currentMonthKey).forEach(e => {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    });
    return [...map.entries()].sort((a,b) => b[1] - a[1]);
  }, [expenses, currentMonthKey]);

  // ---------------- dialogs ----------------
  const [expOpen, setExpOpen] = useState(false);
  const [expForm, setExpForm] = useState<Partial<Expense>>({ category: "other", date: new Date().toISOString().slice(0,10), amount: 0 });
  const [svcOpen, setSvcOpen] = useState(false);
  const [svcForm, setSvcForm] = useState<Partial<ExtraService>>({ date: new Date().toISOString().slice(0,10), amount: 0 });
  const [newCatLabel, setNewCatLabel] = useState("");
  const [adjForm, setAdjForm] = useState<{ amount: number; reason: string; date: string; type: "in" | "out" }>({
    amount: 0, reason: "", date: new Date().toISOString().slice(0,10), type: "in"
  });
  const [cashEditOpen, setCashEditOpen] = useState(false);
  const [cashEditValue, setCashEditValue] = useState(0);

  function submitExpense() {
    if (!expForm.title?.trim() || !expForm.amount) return;
    createExpense(expForm);
    setExpOpen(false);
    setExpForm({ category: "other", date: new Date().toISOString().slice(0,10), amount: 0 });
  }
  function submitService() {
    if (!svcForm.title?.trim() || !svcForm.amount) return;
    createExtraService(svcForm);
    setSvcOpen(false);
    setSvcForm({ date: new Date().toISOString().slice(0,10), amount: 0 });
  }

  function exportReport() {
    exportReportPdf({
      title: "Relatório financeiro",
      subtitle: `Mês de referência: ${currentMonth.label}`,
      meta: {
        "Caixa atual":          BRL(cashCurrent),
        "Receitas (mês)":       BRL(currentMonth.revenue),
        "Despesas + folha (mês)": BRL(currentMonth.cost),
        "Lucro (mês)":          BRL(currentMonth.profit),
        "Estimativa próx. mês": BRL(nextMonth.profit),
        "Crescimento vs mês anterior": `${growthVsPrev.toFixed(1)}%`,
      },
      sections: [
        { title: "Receitas — mensalidades de clientes ativos", head: ["Cliente","Mensalidade"],
          rows: clients.filter(c => c.status === "active").map(c => [c.name, BRL(c.monthly_fee ?? 0)]) },
        { title: "Serviços avulsos (mês)", head: ["Data","Cliente","Título","Valor"],
          rows: extraServices.filter(s => monthKey(s.date) === currentMonthKey).map(s => [
            s.date, clients.find(c => c.id === s.client_id)?.name ?? "—", s.title, BRL(s.amount)]) },
        { title: "Despesas (mês)", head: ["Data","Categoria","Título","Valor"],
          rows: expenses.filter(e => monthKey(e.date) === currentMonthKey).map(e => [
            e.date, getMeta(e.category).label, e.title, BRL(e.amount)]) },
        { title: "Folha de pagamento", head: ["Funcionário","Cargo","Salário","Imposto","Total"],
          rows: payrollBreakdown.map(p => [p.user.name, p.user.position ?? "—", BRL(p.salary), `${p.rate}% (${BRL(p.tax)})`, BRL(p.total)]) },
      ],
      fileName: "relatorio-financeiro.pdf",
    });
  }

  // ---------------- render ----------------
  const chartData = monthlySeries.slice(-7).map(m => ({
    mes: m.label, Receita: Math.round(m.revenue), Custos: Math.round(m.cost), Lucro: Math.round(m.profit),
  }));

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Financeiro"
        subtitle="Controle total de receitas, despesas, folha e crescimento da agência."
        actions={<Button onClick={exportReport} className="gap-2"><FileDown className="w-4 h-4" /> Exportar PDF</Button>}
      />

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card className="p-5 relative overflow-hidden">
          <div className="absolute inset-0 gradient-glow opacity-50 pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider"><Wallet className="w-3.5 h-3.5" /> Caixa atual</div>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => { setCashEditValue(cashCurrent); setCashEditOpen(true); }}>Editar</Button>
          </div>
          <p className={`font-display text-2xl font-bold tabular-nums ${cashCurrent < 0 ? "text-destructive" : ""}`}>{BRL(cashCurrent)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Inicial: {BRL(financeSettings.opening_balance)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2"><ArrowUpRight className="w-3.5 h-3.5" /> Receitas (mês)</div>
          <p className="font-display text-2xl font-bold tabular-nums text-success">{BRL(currentMonth.revenue)}</p>
          <p className={`text-[10px] mt-1 flex items-center gap-1 ${growthVsPrev >= 0 ? "text-success" : "text-destructive"}`}>
            {growthVsPrev >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {growthVsPrev.toFixed(1)}% vs mês anterior
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2"><ArrowDownRight className="w-3.5 h-3.5" /> Saídas (mês)</div>
          <p className="font-display text-2xl font-bold tabular-nums text-destructive">{BRL(currentMonth.cost)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Folha: {BRL(monthlyPayroll)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2"><DollarSign className="w-3.5 h-3.5" /> Lucro (mês)</div>
          <p className={`font-display text-2xl font-bold tabular-nums ${currentMonth.profit >= 0 ? "text-success" : "text-destructive"}`}>{BRL(currentMonth.profit)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Margem: {currentMonth.revenue ? Math.round((currentMonth.profit/currentMonth.revenue)*100) : 0}%</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-2"><Sparkles className="w-3.5 h-3.5" /> Próx. mês (est.)</div>
          <p className={`font-display text-2xl font-bold tabular-nums ${nextMonth.profit >= 0 ? "text-success" : "text-destructive"}`}>{BRL(nextMonth.profit)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Receita: {BRL(nextMonth.revenue)}</p>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="revenue">Receitas</TabsTrigger>
          <TabsTrigger value="expenses">Despesas</TabsTrigger>
          <TabsTrigger value="payroll">Folha</TabsTrigger>
          <TabsTrigger value="settings">Ajustes</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-semibold">Receita vs Despesas — últimos 6 meses + previsão</h3>
                <p className="text-xs text-muted-foreground">Barra mais clara à direita = projeção do próximo mês</p>
              </div>
              {growthVsLastYear != null && (
                <Badge variant="outline" className={growthVsLastYear >= 0 ? "text-success border-success/40" : "text-destructive border-destructive/40"}>
                  {growthVsLastYear >= 0 ? "+" : ""}{growthVsLastYear.toFixed(1)}% vs mesmo mês ano anterior
                </Badge>
              )}
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} formatter={(v: number) => BRL(v)} />
                  <Legend />
                  <Bar dataKey="Receita" fill="hsl(var(--success))" radius={[6,6,0,0]} />
                  <Bar dataKey="Custos"  fill="hsl(var(--destructive))" radius={[6,6,0,0]} />
                  <Bar dataKey="Lucro"   fill="hsl(var(--primary))" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-display font-semibold mb-1">Caixa projetado</h3>
              <p className="text-xs text-muted-foreground mb-4">Evolução acumulada do saldo</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={(() => {
                    let bal = financeSettings.opening_balance;
                    return monthlySeries.map(m => { bal += m.profit; return { mes: m.label, Caixa: Math.round(bal) }; });
                  })()}>
                    <defs>
                      <linearGradient id="cgr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} formatter={(v: number) => BRL(v)} />
                    <Area type="monotone" dataKey="Caixa" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#cgr)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-display font-semibold mb-1">Despesas do mês por categoria</h3>
              <p className="text-xs text-muted-foreground mb-4">{expensesByCategory.length} categoria(s)</p>
              <div className="space-y-3">
                {expensesByCategory.map(([cat, val]) => {
                  const meta = getMeta(cat);
                  const Icon = meta.icon;
                  const total = expensesByCategory.reduce((s,[,v]) => s+v, 0);
                  const pct = Math.round((val/total)*100);
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="flex items-center gap-2"><Icon className={`w-3.5 h-3.5 ${meta.color}`} /> {meta.label}</span>
                        <span className="tabular-nums font-semibold">{BRL(val)} · {pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full gradient-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {!expensesByCategory.length && <p className="text-xs text-muted-foreground">Sem despesas neste mês.</p>}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* RECEITAS */}
        <TabsContent value="revenue" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-semibold">Mensalidades recorrentes</h3>
                <p className="text-xs text-muted-foreground">Total: <span className="font-semibold text-foreground">{BRL(monthlyRecurringRevenue)}</span> / mês</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {clients.filter(c => c.status === "active").map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/40">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.segment ?? "—"}</p>
                  </div>
                  <span className="font-display font-bold tabular-nums">{BRL(c.monthly_fee ?? 0)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-semibold">Serviços avulsos</h3>
                <p className="text-xs text-muted-foreground">Receitas pontuais lançadas no mês</p>
              </div>
              <Button onClick={() => setSvcOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Lançar serviço</Button>
            </div>
            <div className="space-y-1.5">
              {extraServices.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum serviço avulso lançado.</p>}
              {extraServices.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/40 group">
                  <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground"><Tag className="w-4 h-4" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.date} · {clients.find(c => c.id === s.client_id)?.name ?? "Sem cliente"}{s.description ? ` · ${s.description}` : ""}</p>
                  </div>
                  <span className="font-display font-bold tabular-nums text-success">{BRL(s.amount)}</span>
                  <button onClick={() => deleteExtraService(s.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* DESPESAS */}
        <TabsContent value="expenses" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-semibold">Despesas lançadas</h3>
                <p className="text-xs text-muted-foreground">Total no mês: <span className="font-semibold text-destructive">{BRL(expenses.filter(e => monthKey(e.date) === currentMonthKey).reduce((s,e) => s+e.amount, 0))}</span></p>
              </div>
              <Button onClick={() => setExpOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Lançar despesa</Button>
            </div>
            <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
              {expenses.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Sem despesas lançadas.</p>}
              {[...expenses].sort((a,b) => b.date.localeCompare(a.date)).map(e => {
                const meta = getMeta(e.category);
                const Icon = meta.icon;
                return (
                  <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/40 group">
                    <div className={`w-8 h-8 rounded-lg bg-muted flex items-center justify-center ${meta.color}`}><Icon className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-2">
                        {e.title}
                        {e.recurring && <Badge variant="outline" className="text-[9px]">Recorrente</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{e.date} · {meta.label}{e.description ? ` · ${e.description}` : ""}</p>
                    </div>
                    <span className="font-display font-bold tabular-nums text-destructive">{BRL(e.amount)}</span>
                    <button onClick={() => deleteExpense(e.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* FOLHA */}
        <TabsContent value="payroll" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-semibold">Folha de pagamento</h3>
                <p className="text-xs text-muted-foreground">Custo mensal total: <span className="font-semibold text-destructive">{BRL(monthlyPayroll)}</span></p>
              </div>
              <UsersIcon className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Funcionário</th>
                    <th className="text-left px-3 py-2 font-semibold">Cargo</th>
                    <th className="text-right px-3 py-2 font-semibold">Salário</th>
                    <th className="text-right px-3 py-2 font-semibold">% Imposto</th>
                    <th className="text-right px-3 py-2 font-semibold">Imposto</th>
                    <th className="text-right px-3 py-2 font-semibold">Custo total</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollBreakdown.map(p => (
                    <tr key={p.user.id} className="border-t border-border">
                      <td className="px-3 py-3 font-medium">{p.user.name}</td>
                      <td className="px-3 py-3 text-muted-foreground">{p.user.position ?? "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <Input type="number" value={p.user.salary ?? 0} onChange={(e) => updateUser(p.user.id, { salary: +e.target.value })} className="w-28 h-8 text-right ml-auto" />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <Input type="number" value={p.user.tax_rate ?? financeSettings.default_tax_rate} onChange={(e) => updateUser(p.user.id, { tax_rate: +e.target.value })} className="w-20 h-8 text-right ml-auto" />
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-warning">{BRL(p.tax)}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold text-destructive">{BRL(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-bold">
                    <td colSpan={5} className="px-3 py-3 text-right">Total mensal</td>
                    <td className="px-3 py-3 text-right tabular-nums text-destructive">{BRL(monthlyPayroll)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* SETTINGS */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-display font-semibold mb-4">Ajustes do financeiro</h3>
              <div className="space-y-4">
                <div>
                  <Label>Caixa inicial (R$)</Label>
                  <Input type="number" value={financeSettings.opening_balance}
                    onChange={(e) => updateFinanceSettings({ opening_balance: +e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Saldo de partida usado para calcular o caixa atual.</p>
                </div>
                <div>
                  <Label>% Imposto/encargos padrão</Label>
                  <Input type="number" value={financeSettings.default_tax_rate}
                    onChange={(e) => updateFinanceSettings({ default_tax_rate: +e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Aplicado quando um funcionário não tem alíquota própria.</p>
                </div>
                <div className="border-t border-border pt-4">
                  <Label>Categorias personalizadas</Label>
                  <div className="flex gap-2 mt-1 mb-3">
                    <Input value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} placeholder="Ex: Cursos, Reuniões, Eventos…" />
                    <Button type="button" variant="outline" onClick={() => { if (newCatLabel.trim()) { addCustomCategory(newCatLabel.trim()); setNewCatLabel(""); } }} className="gap-1"><Plus className="w-3 h-3" /> Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(financeSettings.custom_categories ?? []).map(c => (
                      <Badge key={c.key} variant="secondary" className="bg-accent/10 text-accent border-accent/20">
                        <Tag className="w-3 h-3 mr-1" /> {c.label}
                      </Badge>
                    ))}
                    {!(financeSettings.custom_categories?.length) && <p className="text-xs text-muted-foreground">Nenhuma categoria personalizada.</p>}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-display font-semibold mb-1">Movimentação manual de caixa</h3>
              <p className="text-xs text-muted-foreground mb-4">Lance aportes, retiradas ou ajustes diretos no saldo.</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="col-span-2">
                  <Label>Motivo</Label>
                  <Input value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })} placeholder="Ex: Aporte sócio, retirada pró-labore" />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={adjForm.type} onValueChange={(v) => setAdjForm({ ...adjForm, type: v as "in"|"out" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">Entrada (+)</SelectItem>
                      <SelectItem value="out">Saída (−)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor (R$)</Label>
                  <Input type="number" value={adjForm.amount} onChange={(e) => setAdjForm({ ...adjForm, amount: +e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Data</Label>
                  <Input type="date" value={adjForm.date} onChange={(e) => setAdjForm({ ...adjForm, date: e.target.value })} />
                </div>
              </div>
              <Button className="w-full gap-2" onClick={() => {
                if (!adjForm.amount || !adjForm.reason.trim()) return;
                addCashAdjustment({ amount: adjForm.type === "in" ? adjForm.amount : -adjForm.amount, reason: adjForm.reason, date: adjForm.date });
                setAdjForm({ amount: 0, reason: "", date: new Date().toISOString().slice(0,10), type: "in" });
              }}><Plus className="w-3 h-3" /> Lançar movimentação</Button>

              <div className="mt-5 space-y-1.5 max-h-72 overflow-y-auto">
                {!cashAdjustments.length && <p className="text-xs text-muted-foreground text-center py-3">Nenhuma movimentação manual.</p>}
                {cashAdjustments.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40 group">
                    {a.amount >= 0
                      ? <ArrowDownLeft className="w-4 h-4 text-success" />
                      : <ArrowUpLeft className="w-4 h-4 text-destructive" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.reason}</p>
                      <p className="text-[10px] text-muted-foreground">{a.date}</p>
                    </div>
                    <span className={`font-display font-bold tabular-nums ${a.amount >= 0 ? "text-success" : "text-destructive"}`}>{BRL(Math.abs(a.amount))}</span>
                    <button onClick={() => deleteCashAdjustment(a.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog despesa */}
      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Lançar despesa</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2"><Label>Título</Label><Input value={expForm.title ?? ""} onChange={(e) => setExpForm({...expForm, title: e.target.value})} placeholder="Ex: Câmera Sony" /></div>
            <div className="col-span-2"><Label>Descrição</Label><Textarea rows={2} value={expForm.description ?? ""} onChange={(e) => setExpForm({...expForm, description: e.target.value})} /></div>
            <div>
              <Label>Categoria</Label>
              <Select value={expForm.category} onValueChange={(v) => setExpForm({...expForm, category: v as ExpenseCategory})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">Crie novas categorias em <strong>Ajustes</strong>.</p>
            </div>
            <div><Label>Valor (R$)</Label><Input type="number" value={expForm.amount ?? 0} onChange={(e) => setExpForm({...expForm, amount: +e.target.value})} /></div>
            <div><Label>Data</Label><Input type="date" value={expForm.date ?? ""} onChange={(e) => setExpForm({...expForm, date: e.target.value})} /></div>
            <div className="flex items-end gap-2">
              <input id="rec" type="checkbox" checked={!!expForm.recurring} onChange={(e) => setExpForm({...expForm, recurring: e.target.checked})} />
              <Label htmlFor="rec" className="cursor-pointer">Recorrente mensal</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExpOpen(false)}>Cancelar</Button>
            <Button onClick={submitExpense}>Lançar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog serviço avulso */}
      <Dialog open={svcOpen} onOpenChange={setSvcOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Lançar serviço avulso</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2"><Label>Título</Label><Input value={svcForm.title ?? ""} onChange={(e) => setSvcForm({...svcForm, title: e.target.value})} placeholder="Ex: Landing page Black Friday" /></div>
            <div className="col-span-2"><Label>Descrição</Label><Textarea rows={2} value={svcForm.description ?? ""} onChange={(e) => setSvcForm({...svcForm, description: e.target.value})} /></div>
            <div>
              <Label>Cliente (opcional)</Label>
              <Select value={svcForm.client_id ?? "none"} onValueChange={(v) => setSvcForm({...svcForm, client_id: v === "none" ? null : v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cliente</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Valor (R$)</Label><Input type="number" value={svcForm.amount ?? 0} onChange={(e) => setSvcForm({...svcForm, amount: +e.target.value})} /></div>
            <div><Label>Data</Label><Input type="date" value={svcForm.date ?? ""} onChange={(e) => setSvcForm({...svcForm, date: e.target.value})} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSvcOpen(false)}>Cancelar</Button>
            <Button onClick={submitService}>Lançar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog editar caixa atual */}
      <Dialog open={cashEditOpen} onOpenChange={setCashEditOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Definir caixa atual</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Valor exato (R$)</Label>
            <Input type="number" step="0.01" value={cashEditValue} onChange={(e) => setCashEditValue(+e.target.value)} />
            <p className="text-xs text-muted-foreground">Um ajuste manual será criado para igualar o caixa ao valor informado.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCashEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              const delta = cashEditValue - cashCurrent;
              if (delta !== 0) addCashAdjustment({ amount: delta, reason: "Ajuste manual de caixa", date: new Date().toISOString().slice(0,10) });
              setCashEditOpen(false);
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}