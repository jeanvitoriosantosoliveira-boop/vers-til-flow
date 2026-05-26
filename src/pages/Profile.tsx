import { useState, useEffect, useRef } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, User as UserIcon, Mail, Phone, Cake, MapPin, Sparkles, Briefcase, Plus, X, Upload, KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function Profile() {
  const { user, refresh } = useAuth();
  const [draft, setDraft] = useState<any>({});
  const [skillInput, setSkillInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) setDraft(data);
    });
  }, [user?.id]);

  async function save() {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      name: draft.name, phone: draft.phone, bio: draft.bio, position: draft.position,
      birth_date: draft.birth_date || null, city: draft.city, skills: draft.skills ?? [],
      avatar_url: draft.avatar_url,
    }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
    refresh();
  }

  async function uploadAvatar(file: File) {
    if (!user?.id) return;
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setDraft((d: any) => ({ ...d, avatar_url: data.publicUrl }));
    await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
    setUploading(false);
    toast.success("Foto atualizada");
    refresh();
  }

  async function changePassword() {
    if (!user?.email) return;
    if (pwd.next.length < 6) return toast.error("A nova senha precisa ter no mínimo 6 caracteres");
    if (pwd.next !== pwd.confirm) return toast.error("As senhas não coincidem");
    setChangingPwd(true);
    // valida senha atual
    const { error: signErr } = await supabase.auth.signInWithPassword({ email: user.email, password: pwd.current });
    if (signErr) { setChangingPwd(false); return toast.error("Senha atual incorreta"); }
    const { error } = await supabase.auth.updateUser({ password: pwd.next });
    setChangingPwd(false);
    if (error) return toast.error(error.message);
    setPwd({ current: "", next: "", confirm: "" });
    toast.success("Senha alterada com sucesso");
  }

  function addSkill() {
    const s = skillInput.trim();
    if (!s) return;
    setDraft((d: any) => ({ ...d, skills: Array.from(new Set([...((d.skills ?? []) as string[]), s])) }));
    setSkillInput("");
  }
  function removeSkill(s: string) {
    setDraft((d: any) => ({ ...d, skills: ((d.skills ?? []) as string[]).filter((x) => x !== s) }));
  }

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <PageHeader title="Meu perfil" subtitle="Atualize seus dados pessoais, foto e habilidades." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-1 relative overflow-hidden">
          <div className="absolute inset-0 gradient-glow opacity-50 pointer-events-none" />
          <div className="relative flex flex-col items-center text-center">
            <div className="w-28 h-28 rounded-3xl overflow-hidden gradient-primary flex items-center justify-center text-4xl font-display font-bold text-primary-foreground shadow-glow mb-4">
              {draft.avatar_url
                ? <img src={draft.avatar_url} alt={draft.name ?? ""} className="w-full h-full object-cover" />
                : (draft.name ?? user.name ?? "?").split(" ").map((n: string) => n[0]).slice(0,2).join("")}
            </div>
            <h2 className="font-display text-xl font-bold">{draft.name ?? user.name}</h2>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <Badge variant="outline" className="mt-2 gap-1 border-accent/40 text-accent">
              <Sparkles className="w-3 h-3" />
              {user.role === "leader" ? "Líder" : user.is_manager ? "Gerente" : "Colaborador"}
            </Badge>
            {draft.position && <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1"><Briefcase className="w-3 h-3" /> {draft.position}</p>}
          </div>
          <div className="mt-6">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
            <Button type="button" variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="w-4 h-4" /> {uploading ? "Enviando..." : "Trocar foto"}
            </Button>
            <p className="text-[10px] text-muted-foreground mt-1 text-center">JPG, PNG ou WEBP — até ~5 MB.</p>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2 space-y-4">
          <h3 className="font-display font-semibold">Dados pessoais</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label className="flex items-center gap-1.5"><UserIcon className="w-3 h-3" /> Nome</Label>
              <Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div><Label className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> Email</Label>
              <Input type="email" value={user.email} disabled /></div>
            <div><Label className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> Telefone</Label>
              <Input value={draft.phone ?? ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="(11) 99999-9999" /></div>
            <div><Label className="flex items-center gap-1.5"><Cake className="w-3 h-3" /> Data de nascimento</Label>
              <Input type="date" value={draft.birth_date ?? ""} onChange={(e) => setDraft({ ...draft, birth_date: e.target.value })} /></div>
            <div><Label className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Cidade</Label>
              <Input value={draft.city ?? ""} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="São Paulo / SP" /></div>
            <div><Label className="flex items-center gap-1.5"><Briefcase className="w-3 h-3" /> Cargo</Label>
              <Input value={draft.position ?? ""} onChange={(e) => setDraft({ ...draft, position: e.target.value })} placeholder="Ex: Social Media" /></div>
          </div>

          <div>
            <Label>Bio</Label>
            <Textarea rows={3} value={draft.bio ?? ""} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} placeholder="Fale um pouco sobre você, sua experiência e o que faz de melhor." />
          </div>

          <div>
            <Label>Habilidades</Label>
            <div className="flex gap-2 mb-2">
              <Input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); }}} placeholder="Adicione uma habilidade e pressione Enter" />
              <Button type="button" variant="outline" onClick={addSkill} className="gap-1"><Plus className="w-3 h-3" /> Add</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {((draft.skills ?? []) as string[]).map((s) => (
                <Badge key={s} variant="secondary" className="gap-1 bg-accent/10 text-accent border-accent/20">
                  {s}
                  <button type="button" onClick={() => removeSkill(s)}><X className="w-3 h-3" /></button>
                </Badge>
              ))}
              {!((draft.skills ?? []) as string[]).length && <p className="text-xs text-muted-foreground">Nenhuma habilidade adicionada.</p>}
            </div>
          </div>

          <div className="pt-2 border-t border-border flex justify-end">
            <Button onClick={save} disabled={saving} className="gap-2"><Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar alterações"}</Button>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-3 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-accent" />
            <h3 className="font-display font-semibold">Alterar senha</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Por segurança, sua senha atual fica criptografada e não pode ser exibida. Para trocá-la, informe a senha atual e a nova senha desejada.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Label>Senha atual</Label>
              <Input type={showPwd ? "text" : "password"} value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
            </div>
            <div>
              <Label>Nova senha</Label>
              <Input type={showPwd ? "text" : "password"} value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
            </div>
            <div>
              <Label>Confirmar nova senha</Label>
              <Input type={showPwd ? "text" : "password"} value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowPwd(v => !v)} className="gap-1.5">
              {showPwd ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />} {showPwd ? "Ocultar" : "Mostrar"} senhas
            </Button>
            <Button onClick={changePassword} disabled={changingPwd || !pwd.current || !pwd.next} className="gap-2">
              <KeyRound className="w-4 h-4" /> {changingPwd ? "Alterando..." : "Alterar senha"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}