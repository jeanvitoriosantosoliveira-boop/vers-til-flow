import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Service {
  id: string;
  name: string;
  description: string | null;
  default_price: number | null;
  is_active: boolean;
  created_at: string;
}

export default function Services() {
  const { user } = useAuth();
  if (!user?.is_leader) return <Navigate to="/" replace />;

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", default_price: "" });

  async function loadServices() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading services:", error);
        toast.error("Erro ao carregar serviços");
        return;
      }

      setServices((data ?? []) as Service[]);
    } catch (err: any) {
      console.error("Unexpected error:", err);
      toast.error("Erro inesperado ao carregar serviços");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadServices();
  }, []);

  function resetForm() {
    setForm({ name: "", description: "", default_price: "" });
    setEditingId(null);
  }

  function startEdit(service: Service) {
    setEditingId(service.id);
    setForm({
      name: service.name,
      description: service.description ?? "",
      default_price: service.default_price?.toString() ?? "",
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("Nome do serviço é obrigatório");
      return;
    }

    const price = form.default_price ? parseFloat(form.default_price) : null;
    if (form.default_price && isNaN(price!)) {
      toast.error("Preço deve ser um número válido");
      return;
    }

    try {
      if (editingId) {
        // Update
        const { error } = await supabase
          .from("services")
          .update({
            name: form.name.trim(),
            description: form.description.trim() || null,
            default_price: price,
          })
          .eq("id", editingId);

        if (error) {
          console.error("Update error:", error);
          toast.error("Erro ao atualizar serviço");
          return;
        }

        toast.success("Serviço atualizado!");
      } else {
        // Create
        const { error } = await supabase.from("services").insert([
          {
            name: form.name.trim(),
            description: form.description.trim() || null,
            default_price: price,
            is_active: true,
          },
        ]);

        if (error) {
          console.error("Insert error:", error);
          toast.error("Erro ao criar serviço");
          return;
        }

        toast.success("Serviço criado!");
      }

      resetForm();
      setOpen(false);
      loadServices();
    } catch (err: any) {
      console.error("Unexpected error:", err);
      toast.error(err?.message || "Erro inesperado");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Deseja remover o serviço "${name}"? Esta ação é permanente.`)) return;

    try {
      const { error } = await supabase.from("services").delete().eq("id", id);

      if (error) {
        console.error("Delete error:", error);
        toast.error("Erro ao remover serviço");
        return;
      }

      toast.success("Serviço removido!");
      loadServices();
    } catch (err: any) {
      console.error("Unexpected error:", err);
      toast.error(err?.message || "Erro inesperado");
    }
  }

  async function toggleActive(service: Service) {
    try {
      const { error } = await supabase
        .from("services")
        .update({ is_active: !service.is_active })
        .eq("id", service.id);

      if (error) {
        console.error("Update error:", error);
        toast.error("Erro ao atualizar serviço");
        return;
      }

      toast.success(
        !service.is_active ? "Serviço ativado!" : "Serviço desativado!"
      );
      loadServices();
    } catch (err: any) {
      console.error("Unexpected error:", err);
      toast.error(err?.message || "Erro inesperado");
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-3xl">Serviços</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie o catálogo de serviços oferecidos pela agência
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); setOpen(o); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" /> Novo serviço
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar serviço" : "Novo serviço"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome do serviço*</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Desenvolvimento Web"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Detalhes sobre o serviço..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="price">Preço padrão (R$)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={form.default_price}
                  onChange={(e) =>
                    setForm({ ...form, default_price: e.target.value })
                  }
                  placeholder="Ex: 5000.00"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setOpen(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingId ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Carregando serviços...
        </Card>
      ) : services.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum serviço cadastrado. Crie o primeiro com o botão acima.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <Card
              key={service.id}
              className="p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{service.name}</h3>
                    {service.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {service.description}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={service.is_active ? "default" : "secondary"}
                    className="shrink-0"
                  >
                    {service.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                {service.default_price && (
                  <p className="text-sm font-semibold text-primary mt-2">
                    R$ {service.default_price.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                )}
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => startEdit(service)}
                  className="w-full"
                >
                  <Pencil className="w-4 h-4 mr-1" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>handleDelete(service.id, service.name)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <Button
                size="sm"
                variant={service.is_active ? "outline" : "default"}
                onClick={() => toggleActive(service)}
                className="w-full"
              >
                {service.is_active ? "Desativar" : "Ativar"}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
