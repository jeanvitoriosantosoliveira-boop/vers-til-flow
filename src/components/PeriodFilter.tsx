import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarRange } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type PeriodPreset = "week" | "month" | "custom" | "all";
export interface Period { preset: PeriodPreset; from?: Date; to?: Date; }

export function periodRange(p: Period): { from: Date; to: Date } | null {
  const now = new Date();
  if (p.preset === "all") return null;
  if (p.preset === "week") {
    const from = new Date(now); from.setDate(now.getDate() - 7); from.setHours(0,0,0,0);
    return { from, to: now };
  }
  if (p.preset === "month") {
    const from = new Date(now); from.setDate(now.getDate() - 30); from.setHours(0,0,0,0);
    return { from, to: now };
  }
  if (p.from && p.to) return { from: p.from, to: p.to };
  return null;
}

export function inPeriod(dateStr: string | null | undefined, p: Period): boolean {
  if (!dateStr) return false;
  const r = periodRange(p);
  if (!r) return true;
  const d = new Date(dateStr).getTime();
  return d >= r.from.getTime() && d <= r.to.getTime() + 86400000 - 1;
}

export function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={value.preset}
        onValueChange={(v) => {
          const preset = v as PeriodPreset;
          onChange({ preset, from: value.from, to: value.to });
        }}
      >
        <SelectTrigger className="w-[170px] h-9">
          <CalendarRange className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="week">Últimos 7 dias</SelectItem>
          <SelectItem value="month">Último mês</SelectItem>
          <SelectItem value="custom">Período custom</SelectItem>
          <SelectItem value="all">Todo período</SelectItem>
        </SelectContent>
      </Select>

      {value.preset === "custom" && (
        <Popover defaultOpen>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 text-xs">
              {value.from && value.to
                ? `${format(value.from, "dd/MM", { locale: ptBR })} → ${format(value.to, "dd/MM", { locale: ptBR })}`
                : value.from
                  ? `${format(value.from, "dd/MM", { locale: ptBR })} → …`
                  : "Selecionar datas"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              defaultMonth={value.from ?? new Date()}
              selected={{ from: value.from, to: value.to }}
              onSelect={(r) => {
                onChange({ preset: "custom", from: r?.from, to: r?.to });
              }}
              numberOfMonths={2}
              locale={ptBR}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
