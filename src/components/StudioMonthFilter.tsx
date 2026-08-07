import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { currentStudioMonth, type StudioMonth } from "@/lib/studioMonth";

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(year, monthNumber - 1 + amount, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

export function StudioMonthFilter({
  value,
  onChange,
}: {
  value: StudioMonth;
  onChange: (value: StudioMonth) => void;
}) {
  const currentMonth = currentStudioMonth();

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <Label htmlFor="studio-month">Mês</Label>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="outline"
            disabled={value === "all"}
            aria-label="Mês anterior"
            onClick={() => value !== "all" && onChange(shiftMonth(value, -1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Input
            id="studio-month"
            type="month"
            className="w-[160px]"
            value={value === "all" ? "" : value}
            onChange={(event) => event.target.value && onChange(event.target.value)}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            disabled={value === "all"}
            aria-label="Próximo mês"
            onClick={() => value !== "all" && onChange(shiftMonth(value, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <Button
        type="button"
        variant={value === currentMonth ? "secondary" : "outline"}
        onClick={() => onChange(currentMonth)}
        className="gap-2"
      >
        <CalendarDays className="w-4 h-4" />
        Mês atual
      </Button>
      <Button
        type="button"
        variant={value === "all" ? "secondary" : "outline"}
        onClick={() => onChange("all")}
      >
        Todo o período
      </Button>
    </div>
  );
}
