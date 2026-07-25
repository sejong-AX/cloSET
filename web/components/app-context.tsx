"use client";

import { createContext, useContext } from "react";
import type { ViewName, Item, ClothState, TrashEntry } from "@/lib/data";
import type { Gender } from "@/lib/garment";
import type { OutfitLogEntry } from "@/lib/outfit";

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
  /** '오늘 입을게요' — 착장 구성 옷들(id)을 착용 처리하고 세탁 대기열로 보낸다 */
  wearItems: (ids: string[]) => void;
  /** 옷 한 점만 착용 +1 (상태는 그대로) */
  bumpWear: (id: string) => void;
  trash: TrashEntry[];
  restoreFromTrash: (id: string) => void;
  /** id 지정 시 한 점 영구 삭제, 미지정 시 휴지통 비우기 */
  purgeTrash: (id?: string) => void;
  favorites: Set<string>;
  toggleFavorite: (id: string) => void;
  /** 마네킹 체형 — 여성 160cm / 남성 180cm. 추천 가중치도 같이 바뀐다 */
  gender: Gender;
  setGender: (g: Gender) => void;
  /** 착장 기록 (최신순) — '지난주 그 조합'·'오늘 입은 조합'의 단일 출처 */
  outfitLog: OutfitLogEntry[];
  logOutfit: (entry: OutfitLogEntry) => void;
  clearHistory: () => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppContext provider");
  return ctx;
}
