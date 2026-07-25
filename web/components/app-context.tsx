"use client";

import { createContext, useContext } from "react";
import type { ViewName, Item, ClothState, TrashEntry } from "@/lib/data";

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
  /** 삭제 = 휴지통으로 이동(복원 가능) */
  removeClothing: (item: Item) => void;
  restoreClothing: (item: Item) => void;
  setClothingState: (id: string, state: ClothState) => void;
  /** '오늘 입을게요' — 착장 구성 옷들을 착용 처리하고 세탁 대기열로 보낸다 */
  wearOutfit: (imgs: string[]) => void;
  trash: TrashEntry[];
  restoreFromTrash: (id: string) => void;
  /** id 지정 시 한 점 영구 삭제, 미지정 시 휴지통 비우기 */
  purgeTrash: (id?: string) => void;
  favorites: Set<string>;
  toggleFavorite: (id: string) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppContext provider");
  return ctx;
}
