import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Plus, UserPlus, Shield, Crown, Trash2, Pencil, Check, X } from "lucide-react";

type Profile = {
  id: string; name: string; email: string; avatar_url: string | null;
  position: string | null; phone: string | null; is_active: boolean;
  contract_start: string | null; contract_end: string | null;
};
type RoleRow = { user_id: string; role: "leader" | "manager" | "collaborator" | "commercial" };
type Team = { id: string; name: string };

const ROLE_LABELS: Record<string, string> = {
  leader: "Líder",
  manager: "Gerente",
  commercial: "Comercial",
  collaborator: "Colaborador",
};

export default function Collaborators() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  // Controle de edição de role inline
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<"leader" | "manager" | "collaborator" | "commercial">("collaborator");
  const [savingRole, setSavingRole] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: r }, { data: t }] = await Promise.all([
      supabase.from("profiles").select("id,name,email,avatar_url,position,phone,is_active,contract_start,contract_end").order("name"),
      supabase.from("user_roles").select("user_id,role"),
      supabase.from("teams").select("id,name").order("name"),
    ]);
    setProfiles((p as any) ?? []);
    setRoles((r as any) ?? []);
    setTeams((t as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const isAdmin = user?.is_manager || user?.is_leader;
  const isLeader = !!user?.is_leader;

  async function removeCollaborator(uid: string, name: string) {
    if (!confirm(`Remover ${name}? Esta ação é permanente.`)) return;
    const { data, error } = await supabase.functions.invoke("delete-user", { body: { user_id: uid } });
    if (error || (data as any)?.error) return toast.error((data as any)?.error ?? error?.message ?? "Erro");
    toast.success("Colaborador removido");
    load();
  }

  function roleOf(uid: string): "leader" | "manager" | "collaborator" | "commercial" {
    const rs = roles.filter(x => x.user_id === uid).map(x => x.role);
    if (rs.includes("leader")) return "leader";
    if (rs.includes("manager")) return "manager";
    if (rs.includes("commercial")) return "commercial";
    return "collaborator";
  }

  function startEditRole(uid: string) {
    setPendingRole(roleOf(uid));
    setEditingRoleId(uid);
  }

  function cancelEditRole() {
    setEditingRoleId(null);
  }

  async function saveRole(uid: string) {
    setSavingRole(true);
    try {
      // Remove todas as roles existentes do usuário e insere a nova
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", uid);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from("user_roles").insert({ user_id: uid, role: pendingRole } as any);
      if (insErr) throw insErr;
      toast.success(`Nível alterado para ${ROLE_LABELS[pendingRole]}`);
      setEditingRoleId(null);
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao alterar nível");
    } finally {
      setSavingRole(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">Gerencie sua equipe, cargos e contratos.</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto"><UserPlus className="w-4 h-4" /> Novo colaborador</Button>
            </DialogTrigger>
            <NewCollaboratorDialog
              teams={teams}
              canCreateManagers={!!user?.is_leader}
              onCreated={() => { setOpen(false); load(); }}
            />
          </Dialog>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : profiles.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum colaborador cadastrado ainda. Crie o primeiro com o botão acima.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map(p => {
            const r = roleOf(p.id);
            const isEditing = editingRoleId === p.id;
            return (
              <Card key={p.id} className="p-4 flex items-start gap-3">
                <Avatar className="w-12 h-12 shrink-0">
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback>{p.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{p.name}</p>
                    {!isEditing && (
                      <>
                        {r === "leader"       && <Badge variant="default"  className="gap-1"><Crown className="w-3 h-3" />Líder</Badge>}
                        {r === "manager"      && <Badge variant="secondary" className="gap-1"><Shield className="w-3 h-3" />Gerente</Badge>}
                        {r === "collaborator" && <Badge variant="outline">Colaborador</Badge>}
                        {r === "commercial"   && <Badge variant="outline" className="border-accent/40 text-accent">Comercial</Badge>}
                        {isLeader && p.id !== user?.id && (
                          <button
                            onClick={() => startEditRole(p.id)}
                            className="text-muted-foreground hover:text-accent transition-colors"
                            title="Alterar nível"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Editor inline de role */}
                  {isEditing && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <Select value={pendingRole} onValueChange={v => setPendingRole(v as any)} disabled={savingRole}>
                        <SelectTrigger className="h-7 text-xs w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="collaborator">Colaborador</SelectItem>
                          <SelectItem value="commercial">Comercial</SelectItem>
                          <SelectItem value="manager">Gerente</SelectItem>
                          <SelectItem value="leader">Líder</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        onClick={() => saveRole(p.id)}
                        disabled={savingRole}
                        className="text-success hover:text-success/80 transition-colors disabled:opacity-50"
                        title="Confirmar"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={cancelEditRole}
                        disabled={savingRole}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Cancelar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground truncate mt-0.5">{p.position ?? "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                </div>
                {isLeader && p.id !== user?.id && !isEditing && (
                  <Button size="icon" variant="ghost" onClick={() => removeCollaborator(p.id, p.name)} title="Remover">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewCollaboratorDialog({
  teams, canCreateManagers, onCreated,
}: { teams: Team[]; canCreateManagers: boolean; onCreated: () => void }) {
  const { session } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [position, setPosition] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"collaborator" | "manager" | "leader" | "commercial">("collaborator");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    // Validate session exists
    if (!session?.access_token) {
      toast.error("Sua sessão expirou. Por favor, faça login novamente.");
      return;
    }

    // Validate inputs
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (password.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { 
          name: name.trim(), 
          email: email.trim(), 
          password, 
          position: position.trim(), 
          phone: phone.trim(), 
          role, 
          team_ids: teamIds 
        },
      });

      if (error) {
        console.error("Function invocation error:", error);
        toast.error(error.message || "Erro ao criar colaborador");
        return;
      }

      if ((data as any)?.error) {
        console.error("Function returned error:", (data as any).error);
        toast.error((data as any).error);
        return;
      }

      toast.success("Colaborador criado com sucesso!");
      // Reset form
      setName("");
      setEmail("");
      setPassword("");
      setPosition("");
      setPhone("");
      setRole("collaborator");
      setTeamIds([]);
      onCreated();
    } catch (err: any) {
      console.error("Unexpected error:", err);
      toast.error(err?.message || "Erro inesperado ao criar colaborador");
    } finally {
      setBusy(false);
    }
  }

  function toggleTeam(id: string) {
    setTeamIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Novo colaborador</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Nome*</Label><Input value={name} onChange={e => setName(e.target.value)} required disabled={busy} /></div>
          <div><Label>E-mail*</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={busy} /></div>
          <div><Label>Senha* (mín 6)</Label><Input type="text" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} disabled={busy} /></div>
          <div><Label>Cargo</Label><Input value={position} onChange={e => setPosition(e.target.value)} placeholder="Ex: Designer" disabled={busy} /></div>
          <div><Label>Telefone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} disabled={busy} /></div>
          <div>
            <Label>Nível*</Label>
            <Select value={role} onValueChange={v => setRole(v as any)} disabled={busy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="collaborator">Colaborador</SelectItem>
                {canCreateManagers && <SelectItem value="commercial">Comercial</SelectItem>}
                {canCreateManagers && <SelectItem value="manager">Gerente</SelectItem>}
                {canCreateManagers && <SelectItem value="leader">Líder</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Times (pode participar de vários)</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {teams.length === 0 && <p className="text-xs text-muted-foreground">Nenhum time criado ainda.</p>}
            {teams.map(t => (
              <button
                type="button"
                key={t.id}
                onClick={() => toggleTeam(t.id)}
                disabled={busy}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${teamIds.includes(t.id) ? "bg-primary text-primary-foreground border-primary" : "border-border"} ${busy ? "opacity-50 cursor-not-allowed" : ""}`}
              >{t.name}</button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">{busy ? "Criando..." : "Criar colaborador"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}