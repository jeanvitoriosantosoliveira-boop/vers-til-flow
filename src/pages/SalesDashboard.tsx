import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, TrendingUp, CheckCircle2, Calendar, MessageCircle } from "lucide-react";

const BRL = (v: number) => `R$ ${(v ?? 0).toLocaleString("pt-BR")}`;
function waLink(n?: string | null) { if (!n) return null; const d = n.replace(/\D/g, ""); return d ? `https://wa.me/${d}` : null; }

export default function SalesDashboard() {
  const [leads, setLeads] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  async function load() {
    const [l, s, e] = await Promise.all([
      supabase.from("leads").select("*"),
      supabase.from("lead_stages").select("*").order("position"),
      supabase.from("sales_events").select("*").gte("start_at", new Date().toISOString()).order("start_at").limit(5),
    ]);
    if (l.data) setLeads(l.data);
    if (s.data) setStages(s.data);
    if (e.data) setEvents(e.data);
  }
  useEffect(() => { load(); }, []);

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const wonStage = stages.find(s => s.is_won);
  const lostStage = stages.find(s => s.is_lost);
  const openLeads = leads.filter(l => l.stage_id !== wonStage?.id && l.stage_id !== lostStage?.id);
  const pipelineValue = openLeads.reduce((s, l) => s + Number(l.estimated_value || 0), 0);
  const wonThisMonth = leads.filter(l => l.stage_id === wonStage?.id && new Date(l.updated_at || l.created_at) >= monthStart);
  const wonValue = wonThisMonth.reduce((s, l) => s + Number(l.estimated_value || 0), 0);
  const conversion = leads.length ? Math.round((leads.filter(l => l.stage_id === wonStage?.id).length / leads.length) * 100) : 0;

  const upcomingFollowups = useMemo(() => leads.filter(l => l.next_followup_at).sort((a, b) => a.next_followup_at.localeCompare(b.next_followup_at)).slice(0, 5), [leads]);

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <PageHeader title="Comercial" subtitle="Visão geral do seu funil de vendas." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-5"><div className="text-xs text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" /> Leads no funil</div><p className="font-display text-2xl font-bold mt-2">{openLeads.length}</p></Card>
        <Card className="p-5"><div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Pipeline</div><p className="font-display text-2xl font-bold mt-2 text-primary">{BRL(pipelineValue)}</p></Card>
        <Card className="p-5"><div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Ganhos do mês</div><p className="font-display text-2xl font-bold mt-2 text-success">{BRL(wonValue)}</p><p className="text-[10px] text-muted-foreground mt-1">{wonThisMonth.length} negócios</p></Card>
        <Card className="p-5"><div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Conversão</div><p className="font-display text-2xl font-bold mt-2">{conversion}%</p></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Próximos follow-ups</h3>
            <Link to="/sales"><Button size="sm" variant="ghost">Ver funil</Button></Link>
          </div>
          <div className="space-y-2">
            {upcomingFollowups.length === 0 && <p className="text-sm text-muted-foreground">Sem follow-ups agendados</p>}
            {upcomingFollowups.map(l => {
              const wa = waLink(l.whatsapp || l.phone);
              return (
                <div key={l.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{l.name}</p>
                    <p className="text-xs text-warning">{new Date(l.next_followup_at).toLocaleString("pt-BR")}</p>
                  </div>
                  {wa && <a href={wa} target="_blank" rel="noreferrer" className="text-success p-2 hover:bg-success/15 rounded"><MessageCircle className="w-4 h-4" /></a>}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Próximos eventos</h3>
            <Link to="/sales/agenda"><Button size="sm" variant="ghost">Ver agenda</Button></Link>
          </div>
          <div className="space-y-2">
            {events.length === 0 && <p className="text-sm text-muted-foreground">Sem eventos próximos</p>}
            {events.map(e => (
              <div key={e.id} className="p-3 bg-muted/30 rounded-lg">
                <p className="font-medium text-sm">{e.title}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>{new Date(e.start_at).toLocaleString("pt-BR")}</span>
                  <Badge variant="outline" className="text-[10px]">{e.kind}</Badge>
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5 mt-6">
        <h3 className="font-semibold mb-3">Funil por estágio</h3>
        <div className="space-y-2">
          {stages.map(s => {
            const c = leads.filter(l => l.stage_id === s.id);
            const val = c.reduce((a, l) => a + Number(l.estimated_value || 0), 0);
            return (
              <div key={s.id} className="flex items-center gap-3">
                <span className="w-2 h-6 rounded" style={{ background: s.color }} />
                <span className="text-sm font-medium flex-1">{s.name}</span>
                <Badge variant="outline">{c.length}</Badge>
                <span className="text-xs text-muted-foreground tabular-nums w-24 text-right">{BRL(val)}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}