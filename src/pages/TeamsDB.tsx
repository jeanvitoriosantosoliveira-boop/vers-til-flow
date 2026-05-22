import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Users2, Trash2 } from "lucide-react";

type Team = { id: string; name: string; description: string | null; color: string | null; leader_id: string | null };
type Member = { id: string; team_id: string; user_id: string; role_in_team: "manager" | "member" };
type Profile = { id: string; name: string };

export default function TeamsDB() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    const [t, m, p] = await Promise.all([
      supabase.from("teams").select("*").order("name"),
      supabase.from("team_members").select("*"),
      supabase.from("profiles").select("id,name").order("name"),
    ]);
    setTeams((t.data as any) ?? []);
    setMembers((m.data as any) ?? []);
    setProfiles((p.data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const isAdmin = user?.is_manager || user?.is_leader;

  async function removeMember(teamId: string, userId: string) {
    const { error } = await supabase.from("team_members").delete().eq("team_id", teamId).eq("user_id", userId);
    if (error) return toast.error(error.message);
    load();
  }

  async function addMember(teamId: string, userId: string, role: "manager" | "member") {
    if (!userId) return;
    const { error } = await supabase.from("team_members").insert({ team_id: teamId, user_id: userId, role_in_team: role });
    if (error) return toast.error(error.message);
    load();
  }

  async function deleteTeam(id: string) {
    if (!confirm("Excluir time?")) return;
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl">Times</h1>
          <p className="text-sm text-muted-foreground">Estruture seus times. Colaboradores podem participar de vários ao mesmo tempo.</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto"><Plus className="w-4 h-4" /> Novo time</Button>
            </DialogTrigger>
            <NewTeamDialog onCreated={() => { setOpen(false); load(); }} />
          </Dialog>
        )}
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : teams.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum time criado ainda.</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map(t => {
            const tm = members.filter(m => m.team_id === t.id);
            const available = profiles.filter(p => !tm.some(x => x.user_id === p.id));
            return (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color ?? "#6366f1" }} />
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{t.name}</h3>
                      {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
                    </div>
                  </div>
                  {isAdmin && (
                    <Button size="icon" variant="ghost" onClick={() => deleteTeam(t.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Users2 className="w-3 h-3 inline mr-1" /> {tm.length} {tm.length === 1 ? "membro" : "membros"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {tm.map(m => {
                      const p = profiles.find(x => x.id === m.user_id);
                      return (
                        <Badge key={m.id} variant={m.role_in_team === "manager" ? "default" : "secondary"} className="gap-1">
                          {p?.name ?? "—"}
                          {isAdmin && (
                            <button onClick={() => removeMember(t.id, m.user_id)} className="ml-1 opacity-60 hover:opacity-100">×</button>
                          )}
                        </Badge>
                      );
                    })}
                    {tm.length === 0 && <span className="text-xs text-muted-foreground">Sem membros</span>}
                  </div>
                  {isAdmin && available.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      <select
                        className="flex-1 text-xs px-2 py-1.5 rounded-md border bg-background"
                        onChange={e => { if (e.target.value) { addMember(t.id, e.target.value, "member"); e.target.value = ""; } }}
                      >
                        <option value="">+ Adicionar membro...</option>
                        {available.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <select
                        className="flex-1 text-xs px-2 py-1.5 rounded-md border bg-background"
                        onChange={e => { if (e.target.value) { addMember(t.id, e.target.value, "manager"); e.target.value = ""; } }}
                      >
                        <option value="">+ Adicionar gerente...</option>
                        {available.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewTeamDialog({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("teams").insert({ name, description: description || null, color });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Time criado!");
    onCreated();
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Novo time</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Nome*</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
        <div><Label>Descrição</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div><Label>Cor</Label><Input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-10 w-20" /></div>
        <DialogFooter><Button type="submit" disabled={busy}>{busy ? "..." : "Criar"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}