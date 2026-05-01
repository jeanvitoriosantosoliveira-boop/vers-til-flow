import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/store/AppStore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Square, Timer } from "lucide-react";
import { formatSeconds } from "@/lib/format";

export default function TimeTracking() {
  const { tasks, clients, users, currentUser, activeTimer, startTimer, stopTimer } = useApp();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!activeTimer) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeTimer]);

  const elapsed = activeTimer ? Math.round((Date.now() - activeTimer.startedAt) / 1000) : 0;
  const visible = useMemo(
    () => currentUser.role === "leader" ? tasks : tasks.filter(t => t.assignee_id === currentUser.id),
    [tasks, currentUser]
  );
  const activeTask = activeTimer ? tasks.find(t => t.id === activeTimer.taskId) : null;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="Controle de tempo" subtitle="Inicie, pause e retome o tempo de cada tarefa." />

      {/* Timer ativo */}
      <Card className={`p-6 mb-6 relative overflow-hidden ${activeTimer ? "border-accent shadow-glow animate-pulse-glow" : ""}`}>
        <div className="absolute inset-0 gradient-glow opacity-50 pointer-events-none" />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{activeTimer ? "Cronômetro ativo" : "Nenhum cronômetro ativo"}</p>
            <p className="font-display text-4xl font-bold tabular-nums">{formatSeconds(elapsed)}</p>
            {activeTask && <p className="text-sm text-muted-foreground mt-1">{activeTask.title}</p>}
          </div>
          {activeTimer ? (
            <Button size="lg" variant="destructive" onClick={stopTimer} className="gap-2"><Square className="w-4 h-4" /> Parar</Button>
          ) : (
            <Timer className="w-12 h-12 text-muted-foreground/40" />
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-display font-semibold text-lg mb-4">Tarefas {currentUser.role === "leader" ? "" : "atribuídas a você"}</h3>
        <div className="space-y-2">
          {visible.filter(t => t.status !== "done").map(t => {
            const client = clients.find(c => c.id === t.client_id);
            const assignee = users.find(u => u.id === t.assignee_id);
            const isThisActive = activeTimer?.taskId === t.id;
            return (
              <div key={t.id} className="flex items-center gap-4 p-3.5 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{client?.name} {assignee && `· ${assignee.name}`}</p>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{formatSeconds(t.total_seconds)}</span>
                {isThisActive ? (
                  <Button size="sm" variant="destructive" onClick={stopTimer} className="gap-2"><Square className="w-3 h-3" /> Parar</Button>
                ) : (
                  <Button size="sm" onClick={() => startTimer(t.id)} disabled={!!activeTimer} className="gap-2"><Play className="w-3 h-3" /> Iniciar</Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}