"use client";

import { createContext, useContext } from "react";
import type { ViewName, Item, ClothState } from "@/lib/data";

export interface AppContextValue {
  view: ViewName;
  switchView: (v: ViewName) => void;
  toast: (msg: string, action?: { label: string; onAction: () => void }) => void;
  closetQuery: string;
  setClosetQuery: (q: string) => void;
  reducedMotion: boolean;
  logout: () => void;
  items: Item[];
  addClothing: (item: Omit<Item, "id">) => void;
  removeClothing: (id: string) => void;
  restoreClothing: (item: Item) => void;
  setClothingState: (id: string, state: ClothState) => void;
  favorites: Set<string>;
  toggleFavorite: (id: string) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppContext provider");
  return ctx;
}
