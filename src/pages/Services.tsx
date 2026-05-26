/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Briefcase, Trash2, Pencil } from "lucide-react";

type Service = {
  id: string;
  name: string;
  description: string | null;
  default_price: number;
  is_active: boolean;
};

export default function Services() {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);

  const isAdmin = user?.is_manager || user?.is_leader;

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("services").select("*").order("name");
    if (error) toast.error(error.message);
    setServices((data as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("services-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function removeService(id: string, name: string) {
    if (!confirm(`Remover o serviço "${name}"?`)) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Serviço removido");
    load();
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <PageHeader
        title="Serviços da agência"
        subtitle="Catálogo de serviços oferecidos. Vincule-os aos clientes no perfil de cada empresa."
        actions={
          isAdmin ? (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" /> Novo serviço</Button>
              </DialogTrigger>
              <ServiceDialog
                initial={editing}
                onSaved={() => { setOpen(false); setEditing(null); load(); }}
              />
            </Dialog>
          ) : undefined
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : services.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-40" />
          Nenhum serviço cadastrado ainda.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map(s => (
            <Card key={s.id} className="p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                <Briefcase className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{s.name}</p>
                  {!s.is_active && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
                </div>
                {s.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
                <p className="text-sm font-semibold tabular-nums mt-2">
                  R$ {Number(s.default_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              {isAdmin && (
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => removeService(s.id, s.name)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ServiceDialog({ initial, onSaved }: { initial: Service | null; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [defaultPrice, setDefaultPrice] = useState(initial?.default_price ?? 0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setDefaultPrice(initial?.default_price ?? 0);
  }, [initial]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      default_price: defaultPrice,
      is_active: true,
    };
    const { error } = initial
      ? await supabase.from("services").update(payload).eq("id", initial.id)
      : await supabase.from("services").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "Serviço atualizado" : "Serviço criado");
    onSaved();
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{initial ? "Editar serviço" : "Novo serviço"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div><Label>Nome*</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
        <div><Label>Descrição</Label><Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div><Label>Preço padrão (R$)</Label><Input type="number" min={0} step={0.01} value={defaultPrice} onChange={e => setDefaultPrice(+e.target.value)} /></div>
        <DialogFooter>
          <Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
