import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Users, Camera, MapPin, TrendingUp } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  casal: "Casal", gestante: "Gestante", corporativo: "Corporativo", individual: "Individual",
  familia: "Família", casamento: "Casamento", aniversario: "Aniversário", infantil: "Infantil",
  empresarial: "Empresarial", parto: "Parto", sensual: "Sensual", formatura: "Formatura", produto: "Produto",
};

export default function StudioDashboard() {
  const [clients, setClients] = useState<any[]>([]);
  const [shoots, setShoots] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [c, s] = await Promise.all([
        supabase.from("studio_clients").select("id, city"),
        supabase.from("studio_shoots").select("id, shoot_type, city, photos_delivered"),
      ]);
      setClients(c.data ?? []);
      setShoots(s.data ?? []);
    })();
  }, []);

  const cityCount = clients.reduce<Record<string, number>>((acc, c) => { acc[c.city] = (acc[c.city] ?? 0) + 1; return acc; }, {});
  const typeCount = shoots.reduce<Record<string, number>>((acc, s) => { acc[s.shoot_type] = (acc[s.shoot_type] ?? 0) + 1; return acc; }, {});
  const topCities = Object.entries(cityCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topTypes = Object.entries(typeCount).sort((a, b) => b[1] - a[1]);
  const totalPhotos = shoots.reduce((sum, s) => sum + (s.photos_delivered ?? 0), 0);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl">Dashboard Studio</h1>
        <p className="text-sm text-muted-foreground">Visão geral dos clientes e ensaios.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Users className="w-3 h-3" /> Clientes</div><p className="text-2xl font-bold">{clients.length}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Camera className="w-3 h-3" /> Ensaios</div><p className="text-2xl font-bold">{shoots.length}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><TrendingUp className="w-3 h-3" /> Fotos entregues</div><p className="text-2xl font-bold">{totalPhotos}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><MapPin className="w-3 h-3" /> Cidades</div><p className="text-2xl font-bold">{Object.keys(cityCount).length}</p></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Clientes por cidade</h2>
          <div className="space-y-2">
            {topCities.map(([city, n]) => (
              <div key={city} className="flex items-center justify-between text-sm">
                <span>{city}</span>
                <span className="font-semibold">{n}</span>
              </div>
            ))}
            {topCities.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Tipos de ensaio mais feitos</h2>
          <div className="space-y-2">
            {topTypes.map(([t, n]) => (
              <div key={t} className="flex items-center justify-between text-sm">
                <span>{TYPE_LABEL[t] ?? t}</span>
                <span className="font-semibold">{n}</span>
              </div>
            ))}
            {topTypes.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}