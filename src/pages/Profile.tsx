import { useState, useEffect } from "react";
import { useApp } from "@/store/AppStore";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, User as UserIcon, Mail, Phone, Cake, MapPin, Sparkles, Briefcase, Plus, X } from "lucide-react";
import type { User } from "@/types";
import { toast } from "sonner";

export default function Profile() {
  const { currentUser, updateUser } = useApp();
  const [draft, setDraft] = useState<Partial<User>>(currentUser);
  const [skillInput, setSkillInput] = useState("");

  useEffect(() => { setDraft(currentUser); }, [currentUser.id]);

  function save() {
    updateUser(currentUser.id, draft);
    toast.success("Perfil atualizado");
  }

  function addSkill() {
    const s = skillInput.trim();
    if (!s) return;
    setDraft(d => ({ ...d, skills: Array.from(new Set([...(d.skills ?? []), s])) }));
    setSkillInput("");
  }
  function removeSkill(s: string) {
    setDraft(d => ({ ...d, skills: (d.skills ?? []).filter(x => x !== s) }));
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="Meu perfil" subtitle="Atualize seus dados pessoais, foto e habilidades." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-1 relative overflow-hidden">
          <div className="absolute inset-0 gradient-glow opacity-50 pointer-events-none" />
          <div className="relative flex flex-col items-center text-center">
            <div className="w-28 h-28 rounded-3xl overflow-hidden gradient-primary flex items-center justify-center text-4xl font-display font-bold text-primary-foreground shadow-glow mb-4">
              {draft.avatar_url
                ? <img src={draft.avatar_url} alt={draft.name} className="w-full h-full object-cover" />
                : (draft.name ?? "?").split(" ").map(n => n[0]).slice(0,2).join("")}
            </div>
            <h2 className="font-display text-xl font-bold">{draft.name}</h2>
            <p className="text-xs text-muted-foreground">{draft.email}</p>
            <Badge variant="outline" className="mt-2 gap-1 border-accent/40 text-accent">
              <Sparkles className="w-3 h-3" />
              {currentUser.role === "leader" ? "Líder" : currentUser.is_manager ? "Gerente" : "Colaborador"}
            </Badge>
            {draft.position && <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1"><Briefcase className="w-3 h-3" /> {draft.position}</p>}
          </div>
          <div className="mt-6">
            <Label className="text-[10px] uppercase">URL da foto</Label>
            <Input value={draft.avatar_url ?? ""} onChange={(e) => setDraft({ ...draft, avatar_url: e.target.value })} placeholder="https://…" />
            <p className="text-[10px] text-muted-foreground mt-1">Cole o link de uma imagem (ex.: imgur, gravatar).</p>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2 space-y-4">
          <h3 className="font-display font-semibold">Dados pessoais</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label className="flex items-center gap-1.5"><UserIcon className="w-3 h-3" /> Nome</Label>
              <Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div><Label className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> Email</Label>
              <Input type="email" value={draft.email ?? ""} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></div>
            <div><Label className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> Telefone</Label>
              <Input value={draft.phone ?? ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="(11) 99999-9999" /></div>
            <div><Label className="flex items-center gap-1.5"><Cake className="w-3 h-3" /> Data de nascimento</Label>
              <Input type="date" value={draft.birthdate ?? ""} onChange={(e) => setDraft({ ...draft, birthdate: e.target.value })} /></div>
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
              {(draft.skills ?? []).map(s => (
                <Badge key={s} variant="secondary" className="gap-1 bg-accent/10 text-accent border-accent/20">
                  {s}
                  <button type="button" onClick={() => removeSkill(s)}><X className="w-3 h-3" /></button>
                </Badge>
              ))}
              {!(draft.skills?.length) && <p className="text-xs text-muted-foreground">Nenhuma habilidade adicionada.</p>}
            </div>
          </div>

          <div className="pt-2 border-t border-border flex justify-end">
            <Button onClick={save} className="gap-2"><Save className="w-4 h-4" /> Salvar alterações</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}