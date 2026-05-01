export function formatSeconds(s: number): string {
  if (!s) return "0min";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h && m) return `${h}h ${m}min`;
  if (h) return `${h}h`;
  return `${m}min`;
}

export function formatDate(d?: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function relativeDue(d?: string | null): { label: string; tone: "default" | "warning" | "destructive" | "success" } {
  if (!d) return { label: "Sem prazo", tone: "default" };
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d atrasada`, tone: "destructive" };
  if (diff === 0) return { label: "Hoje", tone: "warning" };
  if (diff === 1) return { label: "Amanhã", tone: "warning" };
  if (diff <= 7) return { label: `em ${diff}d`, tone: "default" };
  return { label: formatDate(d), tone: "default" };
}