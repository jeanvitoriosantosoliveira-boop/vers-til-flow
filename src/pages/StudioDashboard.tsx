import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Camera, MapPin, TrendingUp, Users } from "lucide-react";

type StudioClientSummary = {
  id: string;
  city: string;
};

type StudioShootSummary = {
  id: string;
  shoot_type: string;
  city: string;
  photos_delivered: number;
};

const TYPE_LABEL: Record<string, string> = {
  casal: "Casal",
  gestante: "Gestante",
  corporativo: "Corporativo",
  individual: "Individual",
  familia: "Família",
  casamento: "Casamento",
  aniversario: "Aniversário",
  infantil: "Infantil",
  empresarial: "Empresarial",
  parto: "Parto",
  sensual: "Sensual",
  formatura: "Formatura",
  produto: "Produto",
};

export default function StudioDashboard() {
  const { user } = useAuth();
  const [clients, setClients] = useState<StudioClientSummary[]>([]);
  const [shoots, setShoots] = useState<StudioShootSummary[]>([]);

  useEffect(() => {
    async function load() {
      const [clientsResult, shootsResult] = await Promise.all([
        supabase.from("studio_clients").select("id, city"),
        supabase.from("studio_shoots").select("id, shoot_type, city, photos_delivered"),
      ]);

      setClients((clientsResult.data ?? []) as StudioClientSummary[]);
      setShoots((shootsResult.data ?? []) as StudioShootSummary[]);
    }

    load();
  }, []);

  const cityCount = useMemo(
    () => clients.reduce<Record<string, number>>((acc, client) => {
      acc[client.city] = (acc[client.city] ?? 0) + 1;
      return acc;
    }, {}),
    [clients],
  );

  const typeCount = useMemo(
    () => shoots.reduce<Record<string, number>>((acc, shoot) => {
      acc[shoot.shoot_type] = (acc[shoot.shoot_type] ?? 0) + 1;
      return acc;
    }, {}),
    [shoots],
  );

  const topCities = Object.entries(cityCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topTypes = Object.entries(typeCount).sort((a, b) => b[1] - a[1]);
  const totalPhotos = shoots.reduce((sum, shoot) => sum + (shoot.photos_delivered ?? 0), 0);

  if (user?.role !== "studio") return <Navigate to="/" replace />;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl">Dashboard Studio</h1>
        <p className="text-sm text-muted-foreground">Visão geral dos clientes, cidades e ensaios realizados.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Users className="w-3 h-3" /> Clientes</div>
          <p className="text-2xl font-bold">{clients.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Camera className="w-3 h-3" /> Ensaios</div>
          <p className="text-2xl font-bold">{shoots.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><TrendingUp className="w-3 h-3" /> Fotos entregues</div>
          <p className="text-2xl font-bold">{totalPhotos}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><MapPin className="w-3 h-3" /> Cidades</div>
          <p className="text-2xl font-bold">{Object.keys(cityCount).length}</p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="font-semibold mb-3">Clientes por cidade</h2>
          <div className="space-y-2">
            {topCities.map(([city, total]) => (
              <div key={city} className="flex items-center justify-between text-sm">
                <span>{city}</span>
                <span className="font-semibold">{total}</span>
              </div>
            ))}
            {topCities.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold mb-3">Tipos de ensaio mais feitos</h2>
          <div className="space-y-2">
            {topTypes.map(([type, total]) => (
              <div key={type} className="flex items-center justify-between text-sm">
                <span>{TYPE_LABEL[type] ?? type}</span>
                <span className="font-semibold">{total}</span>
              </div>
            ))}
            {topTypes.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
