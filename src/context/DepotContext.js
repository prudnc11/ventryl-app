import { createContext, useContext } from "react";

export const DepotContext = createContext(null);

export function useDepotContext() {
  const ctx = useContext(DepotContext);
  if (!ctx) throw new Error("useDepotContext must be used within DepotContext.Provider");
  return ctx;
}
