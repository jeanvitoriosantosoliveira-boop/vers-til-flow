import { useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useApp } from "@/store/AppStore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatSeconds } from "@/lib/format";
import { ChevronRight, Briefcase } from "lucide-react";

export default function Team() {
  const { users, tasks, currentUser } = useApp();
  const navigate = useNavigate();
  if (currentUser.role !== "leader" && currentUser.role !== "manager") return <Navigate to="/" replace />;

  // Mostra todos os colaboradores (não líderes, não comerciais) para qualquer perfil com acesso
  const team = useMemo(() => users.filter(u => u.role !== "leader" && u.role !== "commercial").map(u => {
    const t = tasks.filter(x => x.assignee_id === u.id);
    const done = t.filter(x => x.status === "done").length;
    const inProg = t.filter(x => x.status === "in_progress").length;
    const late = t.filter(x => x.due_date && new Date(x.due_date) < new Date() && x.status !== "done").length;
    const time = t.reduce((s, x) => s + x.total_seconds, 0);
    const pct = t.length ? Math.round((done / t.length) * 100) : 0;
    const overload = inProg > 4;
    return { user: u, total: t.length, done, inProg, late, time, pct, overload };
  }), [users, tasks]);

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Equipe" subtitle="Performance e carga de trabalho de cada colaborador." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {team.map(({ user: u, total, done, inProg, late, time, pct, overload }) => (
          <Card key={u.id} onClick={() => navigate(`/team/${u.id}`)} className="p-6 hover:shadow-lift hover:-translate-y-0.5 hover:border-accent/40 transition-all cursor-pointer group">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold shadow-glow">
                  {u.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                </div>
                <div>
                  <h3 className="font-semibold">{u.name}</h3>
                  {u.position && (
                    <p className="text-xs text-accent font-medium flex items-center gap-1 mt-0.5">
                      <Briefcase className="w-3 h-3" /> {u.position}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">{u.email}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {overload && <Badge variant="outline" className="border-warning/50 text-warning text-[10px]">Sobrecarga</Badge>}
                {late > 0 && <Badge variant="outline" className="border-destructive/50 text-destructive text-[10px]">{late} atraso(s)</Badge>}
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center mb-4">
              <div><p className="text-xl font-display font-bold tabular-nums">{total}</p><p className="text-[10px] text-muted-foreground uppercase">Total</p></div>
              <div><p className="text-xl font-display font-bold tabular-nums text-primary">{inProg}</p><p className="text-[10px] text-muted-foreground uppercase">Ativas</p></div>
              <div><p className="text-xl font-display font-bold tabular-nums text-success">{done}</p><p className="text-[10px] text-muted-foreground uppercase">Feitas</p></div>
              <div><p className="text-xl font-display font-bold tabular-nums text-accent">{pct}%</p><p className="text-[10px] text-muted-foreground uppercase">Taxa</p></div>
            </div>

            <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
              <div className="h-full gradient-primary transition-all" style={{ width: `${pct}%` }} />
            </div>

            <p className="text-xs text-muted-foreground">Tempo registrado: <span className="font-semibold text-foreground tabular-nums">{formatSeconds(time)}</span></p>
          </Card>
        ))}
      </div>
    </div>
  );
}