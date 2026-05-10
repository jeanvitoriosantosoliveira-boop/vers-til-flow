import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useApp } from "@/store/AppStore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Crown, Users as UsersIcon, Edit3 } from "lucide-react";
import type { Team } from "@/types";

const COLORS = ["bg-primary","bg-accent","bg-success","bg-warning","bg-destructive"];

export default function Teams() {
  const { currentUser, teams, users, createTeam, updateTeam, deleteTeam, updateUser } = useApp();
  if (currentUser.role !== "leader") return <Navigate to="/" replace />;

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Team>>({ name: "", color: "bg-primary" });
  const [editingId, setEditingId] = useState<string | null>(null);

  const collaborators = useMemo(() => users.filter(u => u.role === "employee"), [users]);

  function openNew() { setEditingId(null); setDraft({ name: "", color: "bg-primary" }); setOpen(true); }
  function openEdit(t: Team) { setEditingId(t.id); setDraft(t); setOpen(true); }
  function submit() {
    if (!draft.name?.trim()) return;
    if (editingId) updateTeam(editingId, draft);
    else createTeam(draft);
    setOpen(false);
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Times"
        subtitle="Crie times, defina gerentes e organize a hierarquia da agência."
        actions={<Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Novo time</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teams.map(team => {
          const members = collaborators.filter(u => u.team_id === team.id);
          const manager = users.find(u => u.id === team.manager_id);
          const otherManagers = members.filter(u => u.is_manager && u.id !== team.manager_id);
          return (
            <Card key={team.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${team.color} flex items-center justify-center text-primary-foreground font-bold shadow-glow`}>
                    {team.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-lg leading-tight">{team.name}</h3>
                    {team.description && <p className="text-xs text-muted-foreground mt-0.5">{team.description}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(team)}><Edit3 className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteTeam(team.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>

              {manager && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30 mb-3">
                  <Crown className="w-4 h-4 text-warning shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-wider text-warning font-semibold">Gerente principal</p>
                    <p className="text-sm font-medium truncate">{manager.name} <span className="text-xs text-muted-foreground">· {manager.position}</span></p>
                  </div>
                </div>
              )}

              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2 flex items-center gap-2"><UsersIcon className="w-3 h-3" /> Membros ({members.length})</p>
              <div className="space-y-1.5">
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                    <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
                      {m.name.split(" ").map(n => n[0]).slice(0,2).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{m.position}</p>
                    </div>
                    {m.is_manager && <Badge variant="outline" className="text-[10px] border-warning/40 text-warning gap-1"><Crown className="w-2.5 h-2.5" /> Gerente</Badge>}
                    <Button size="sm" variant="ghost" onClick={() => updateUser(m.id, { is_manager: !m.is_manager })} className="text-[10px] h-7">
                      {m.is_manager ? "Rebaixar" : "Promover"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => updateUser(m.id, { team_id: null, is_manager: false })} className="text-[10px] h-7 text-muted-foreground hover:text-destructive">Remover</Button>
                  </div>
                ))}
                {!members.length && <p className="text-xs text-muted-foreground py-2">Nenhum membro neste time.</p>}
              </div>

              {/* Adicionar membro */}
              <div className="mt-4 border-t border-border pt-3">
                <Label className="text-[10px] uppercase">Adicionar colaborador</Label>
                <Select value="" onValueChange={(uid) => updateUser(uid, { team_id: team.id })}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Selecionar colaborador disponível" /></SelectTrigger>
                  <SelectContent>
                    {collaborators.filter(u => u.team_id !== team.id).map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name} {u.team_id ? `(em outro time)` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </Card>
          );
        })}
        {!teams.length && <Card className="p-10 text-center text-muted-foreground col-span-full">Nenhum time cadastrado ainda.</Card>}
      </div>

      {/* Sem time */}
      {(() => {
        const orphans = collaborators.filter(u => !u.team_id);
        if (!orphans.length) return null;
        return (
          <Card className="p-6 mt-6">
            <h3 className="font-display font-semibold mb-3">Colaboradores sem time ({orphans.length})</h3>
            <div className="space-y-1.5">
              {orphans.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
                    {u.name.split(" ").map(n => n[0]).slice(0,2).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{u.position}</p>
                  </div>
                  <Select value="" onValueChange={(tid) => updateUser(u.id, { team_id: tid })}>
                    <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="Atribuir a time" /></SelectTrigger>
                    <SelectContent>
                      {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar time" : "Novo time"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Nome do time</Label><Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex: Performance & Mídia" autoFocus /></div>
            <div><Label>Descrição</Label><Textarea rows={2} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
            <div>
              <Label>Gerente principal</Label>
              <Select value={draft.manager_id ?? "none"} onValueChange={(v) => setDraft({ ...draft, manager_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem gerente</SelectItem>
                  {collaborators.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 mt-1">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setDraft({ ...draft, color: c })} className={`w-8 h-8 rounded-lg ${c} ${draft.color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit}>{editingId ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}