import type { Client } from "@/types";

/** Rótulos PT-BR para status de cliente */
export const CLIENT_STATUS_LABEL: Record<Client["status"], string> = {
  active: "Ativo",
  paused: "Pausado",
  archived: "Arquivado",
};

export const CLIENT_STATUS_OPTIONS: { value: Client["status"]; label: string }[] = [
  { value: "active", label: "Ativo" },
  { value: "paused", label: "Pausado" },
  { value: "archived", label: "Arquivado" },
];
