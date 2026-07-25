/**
 * 실제 의류 사진 카탈로그 — 인식된 옷과 가장 비슷한 "진짜 사진"을 먼저 찾는다.
 *
 * 사용자 요구(2026-07-25): 옷 한 점은 그 옷만 담긴 이미지 한 장으로 보여야 하고,
 * 가능하면 그려낸 그림이 아니라 실제 사진을 쓴다. 그래서 순서가 이렇다.
 *   1) 이 카탈로그에서 종류·색이 충분히 가까운 사진을 찾는다 (배경이 지워진 단품 컷)
 *   2) 못 찾으면 lib/garment-art 로 그 옷과 비슷한 그림을 만든다
 *
 * 카탈로그 사진은 모두 배경을 지운 PNG 단품 컷이라 "옷 한 점 = 이미지 한 장"이 항상 지켜진다.
 * 색은 각 사진의 실제 대표색(중앙값)을 재서 적었다 — 매칭 기준이 눈대중이 아니라 픽셀이다.
 */

import { hexToHsl, hueDistance, isNeutral } from "./garment";
import { garmentKind, type GarmentKind } from "./garment-art";
import type { Category } from "./garment";

export interface CatalogEntry {
  src: string;
  kind: GarmentKind;
  /** 사진에서 잰 대표색 */
  color: string;
  /** 소매·기장이 특징적인 경우 표시(없으면 무시) */
  note?: string;
}

/**
 * 대체 가능한 이웃 종류 — 실루엣이 거의 같은 것만 허용한다.
 * (코트 자리에 자켓 사진을 넣는 식으로 넓게 잡으면 "그 옷과 비슷한 사진"이 아니라 다른 옷이 된다.
 *  그럴 바엔 그 옷 모양으로 그린 그림이 더 정확하다.)
 */
const FAMILY: Record<GarmentKind, GarmentKind[]> = {
  tee: ["tee", "longtee"],
  longtee: ["longtee", "tee"],
  polo: ["polo", "shirt"],
  shirt: ["shirt"],
  knit: ["knit", "sweat"],
  sweat: ["sweat", "knit"],
  hoodie: ["hoodie"],
  cardigan: ["cardigan"],
  zipup: ["zipup"],
  jacket: ["jacket"],
  coat: ["coat"],
  padding: ["padding"],
  vest: ["vest"],
  pants: ["pants"],
  jeans: ["jeans"],
  jogger: ["jogger"],
  shorts: ["shorts"],
  skirt: ["skirt"],
  dress: ["dress"],
  sneakers: ["sneakers"],
  boots: ["boots"],
  loafers: ["loafers"],
  bag: ["bag"],
};

/**
 * 단품 컷 카탈로그. color 는 스크립트로 잰 값(중앙값)이다.
 * 새 사진을 넣을 때도 같은 방식으로 재서 적는다(scripts/measure-catalog.py).
 */
export const CATALOG: CatalogEntry[] = [
  // Wikimedia Commons 자유 라이선스 사진에서 배경을 지운 단품 컷 (출처: public/items/catalog/CREDITS.md)
  { src: "/items/catalog/tee-black.png", kind: "tee", color: "#252427" },
  { src: "/items/catalog/tee-charcoal.png", kind: "tee", color: "#393a3d" },
  { src: "/items/catalog/shirt-cream.png", kind: "shirt", color: "#ded8ca" },
  { src: "/items/catalog/shirt-grey.png", kind: "shirt", color: "#8d8783" },
  { src: "/items/catalog/shirt-blue.png", kind: "shirt", color: "#1e4f9a" },
  { src: "/items/catalog/sweat-black.png", kind: "sweat", color: "#302f28" },
  { src: "/items/catalog/hoodie-black.png", kind: "hoodie", color: "#292829" },
  { src: "/items/catalog/pants-black.png", kind: "pants", color: "#141414" },
  { src: "/items/catalog/jeans-indigo.png", kind: "jeans", color: "#364f6d" },
  { src: "/items/catalog/boots-black.png", kind: "boots", color: "#292732" },
  // 프로젝트 초기부터 쓰던 단품 컷
  { src: "/items/flat/boots-chelsea.png", kind: "boots", color: "#d59566" },
  { src: "/items/flat/cardigan-gray.png", kind: "cardigan", color: "#bfbfc1" },
  { src: "/items/flat/cardigan-ivory.png", kind: "cardigan", color: "#eadac5" },
  { src: "/items/flat/coat.png", kind: "coat", color: "#ccc5be" },
  { src: "/items/flat/denim-jacket.png", kind: "jacket", color: "#123652" },
  { src: "/items/flat/jeans-blue.png", kind: "jeans", color: "#154672" },
  { src: "/items/flat/knit-cream.png", kind: "knit", color: "#e4d8bd" },
  { src: "/items/flat/knit.png", kind: "knit", color: "#7f776d" },
  { src: "/items/flat/pants.png", kind: "pants", color: "#c2baa5" },
  { src: "/items/flat/shirt-oatmeal.png", kind: "shirt", color: "#e2ded9" },
  { src: "/items/flat/shirt-white.png", kind: "shirt", color: "#d1cdc5" },
  { src: "/items/flat/shoe.png", kind: "loafers", color: "#c97030" },
];

const rgb = (hex: string): [number, number, number] | null => {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** 사람 눈에 가까운 가중 RGB 거리 0~255 */
export function colorDistance(a: string, b: string): number {
  const A = rgb(a);
  const B = rgb(b);
  if (!A || !B) return 999;
  const rm = (A[0] + B[0]) / 2;
  const dr = A[0] - B[0];
  const dg = A[1] - B[1];
  const db = A[2] - B[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

/** 이 거리 안이면 "그 옷과 비슷한 사진"으로 인정한다 (같은 색 계열의 밝기 차이는 허용) */
const ACCEPT = 120;
/** 종류가 정확히 같지 않을 때 더해지는 벌점 */
const FAMILY_PENALTY = 42;

/**
 * 종류·색이 충분히 가까운 실제 사진을 찾는다. 없으면 null(호출부가 그림을 만든다).
 * 밝기 대역이 완전히 다른 색(검정 ↔ 아이보리)은 거리와 무관하게 거절한다.
 */
export function matchGarmentPhoto(opts: {
  name: string;
  category: Category | string;
  color: string;
  catalog?: CatalogEntry[];
}): string | null {
  const kind = garmentKind(opts.name, opts.category as Category);
  const fam = FAMILY[kind] ?? [kind];
  const want = hexToHsl(opts.color);
  let best: { src: string; score: number } | null = null;
  for (const e of opts.catalog ?? CATALOG) {
    const rank = fam.indexOf(e.kind);
    if (rank < 0) continue;
    const got = hexToHsl(e.color);
    if (want && got) {
      if (Math.abs(want.l - got.l) > 0.3) continue; // 검정 ↔ 흰색 뒤바뀜 방지
      const wantN = isNeutral(want);
      const gotN = isNeutral(got);
      // 색이 있는 옷(와인·네이비)을 무채색 사진(차콜)으로 대체하지 않는다. 반대도 마찬가지.
      if (wantN !== gotN) continue;
      // 둘 다 유채색이면 색상환에서 가까워야 한다 — 빨강 자리에 초록이 오는 일을 막는다
      if (!wantN && !gotN && hueDistance(want.h, got.h) > 45) continue;
    }
    const score = colorDistance(opts.color, e.color) + (rank === 0 ? 0 : FAMILY_PENALTY);
    if (!best || score < best.score || (score === best.score && e.src < best.src)) {
      best = { src: e.src, score };
    }
  }
  return best && best.score <= ACCEPT ? best.src : null;
}
