import { useState } from "react";

export type StudioMonth = string | "all";

const STORAGE_KEY = "studio-selected-month";

export function currentStudioMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function isInStudioMonth(date: string | null | undefined, month: StudioMonth) {
  if (month === "all") return true;
  return Boolean(date?.startsWith(month));
}

export function useStudioMonth() {
  const [month, setMonthState] = useState<StudioMonth>(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "all" || /^\d{4}-\d{2}$/.test(saved ?? "") ? saved as StudioMonth : currentStudioMonth();
  });

  function setMonth(value: StudioMonth) {
    setMonthState(value);
    window.localStorage.setItem(STORAGE_KEY, value);
  }

  return [month, setMonth] as const;
}
