import { createContext, useContext, useState, type ReactNode } from "react";

const Ctx = createContext<{ query: string; setQuery: (v: string) => void } | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  return <Ctx.Provider value={{ query, setQuery }}>{children}</Ctx.Provider>;
}

export function useSearch() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSearch must be inside SearchProvider");
  return c;
}
