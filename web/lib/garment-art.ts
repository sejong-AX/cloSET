/**
 * 의류 아트 — 옷 "한 점"을 그림 "한 장"으로 그린다. 전부 결정적 SVG(런타임 AI 호출 0).
 *
 * 왜 필요한가: 옷장 전체를 찍은 사진에서 품목별로 잘라낸 크롭은 옆 옷·옷걸이·벽이 함께 담긴다.
 * 티셔츠 카드에 티셔츠 한 장만 보이려면, 인식된 옷의 종류·색·핏·패턴으로 그 옷과 가장 비슷한
 * 그림을 새로 그려야 한다. 사진은 색을 뽑고 근거로 남기는 용도로만 쓴다(Item.photo).
 *
 * 같은 어휘(kind·pattern·팔레트)를 마네킹(lib/mannequin-geom.ts)도 함께 쓴다 →
 * 옷장 썸네일과 마네킹이 입은 옷이 같은 옷으로 보인다.
 */

import { hexToHsl, type Category } from "./garment";

// ---- 종류 ----

export type GarmentKind =
  | "tee"        // 반팔 티셔츠
  | "longtee"    // 긴팔 티셔츠
  | "shirt"      // 셔츠·블라우스
  | "polo"       // 카라 티셔츠
  | "knit"       // 니트·스웨터
  | "sweat"      // 맨투맨
  | "hoodie"     // 후드티
  | "cardigan"   // 가디건 (앞이 열린다)
  | "zipup"      // 집업·후드집업
  | "jacket"     // 자켓·블레이저
  | "coat"       // 코트·트렌치
  | "padding"    // 패딩·다운
  | "vest"       // 조끼
  | "pants"      // 슬랙스·일반 바지
  | "jeans"      // 데님
  | "jogger"     // 조거·트레이닝
  | "shorts"     // 반바지
  | "skirt"      // 치마
  | "dress"      // 원피스
  | "sneakers"
  | "boots"
  | "loafers"
  | "bag";

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
const hit = (t: string, words: string[]) => words.some((w) => t.includes(w));

/** 이름·카테고리 → 그림 종류. 이름의 확정 명사가 우선(카테고리는 폴백). */
export function garmentKind(name: string, category: Category): GarmentKind {
  const n = norm(name);
  if (category === "가방" || hit(n, ["가방", "백팩", "토트", "숄더백", "크로스백", "bag"])) return "bag";
  if (category === "신발" || hit(n, ["신발", "슈즈", "스니커", "운동화", "부츠", "로퍼", "구두", "샌들", "힐"])) {
    if (hit(n, ["부츠", "첼시", "워커", "boots"])) return "boots";
    if (hit(n, ["로퍼", "구두", "더비", "옥스퍼드", "펌프스", "힐", "loafer"])) return "loafers";
    return "sneakers";
  }
  if (category === "원피스" || hit(n, ["원피스", "드레스", "dress"])) return "dress";
  if (category === "하의" || hit(n, ["바지", "팬츠", "슬랙스", "청바지", "치마", "스커트", "반바지", "숏츠", "레깅스"])) {
    if (hit(n, ["치마", "스커트", "skirt"])) return "skirt";
    if (hit(n, ["반바지", "숏츠", "버뮤다", "shorts"])) return "shorts";
    if (hit(n, ["청바지", "데님", "진", "denim", "jean"])) return "jeans";
    if (hit(n, ["조거", "트레이닝", "스웨트팬츠", "jogger"])) return "jogger";
    return "pants";
  }
  // 앞이 열리는 겉옷 — 카테고리가 니트여도 가디건은 겉에 입는다
  if (hit(n, ["가디건", "cardigan"])) return "cardigan";
  if (hit(n, ["조끼", "베스트", "vest"])) return "vest";
  if (hit(n, ["집업", "zip"])) return "zipup";
  if (hit(n, ["패딩", "다운", "puffer", "무스탕"])) return "padding";
  if (hit(n, ["코트", "트렌치", "파카", "야상", "coat", "parka"])) return "coat";
  if (hit(n, ["자켓", "재킷", "점퍼", "블레이저", "바람막이", "아노락", "jacket", "blazer"])) return "jacket";
  if (hit(n, ["후드", "hoodie"])) return "hoodie";
  if (hit(n, ["맨투맨", "스웨트", "sweatshirt"])) return "sweat";
  if (hit(n, ["니트", "스웨터", "풀오버", "knit", "sweater"])) return "knit";
  if (hit(n, ["폴로", "카라티", "polo"])) return "polo";
  // '티셔츠'는 '셔츠'를 포함한다 — 티 계열을 셔츠보다 먼저 판정해야 칼라·앞단이 붙지 않는다
  if (hit(n, ["반팔", "숏슬리브", "탱크", "나시", "민소매", "tee", "t-shirt"])) return "tee";
  if (hit(n, ["긴팔", "롱슬리브", "longsleeve"])) return "longtee";
  if (hit(n, ["티셔츠", "티샤쓰", "tshirt"])) return "tee";
  if (hit(n, ["셔츠", "블라우스", "남방", "shirt", "blouse"])) return "shirt";
  if (category === "아우터") return "jacket";
  if (category === "니트") return "knit";
  return "tee";
}

/** 마네킹 레이어 위치 — 그림 종류에서 바로 얻는다 */
export function kindSlot(kind: GarmentKind): "outer" | "top" | "bottom" | "shoe" | "dress" | "bag" {
  switch (kind) {
    case "cardigan": case "zipup": case "jacket": case "coat": case "padding": case "vest":
      return "outer";
    case "pants": case "jeans": case "jogger": case "shorts": case "skirt":
      return "bottom";
    case "sneakers": case "boots": case "loafers":
      return "shoe";
    case "dress":
      return "dress";
    case "bag":
      return "bag";
    default:
      return "top";
  }
}

/** 소매가 긴 옷인가 — 마네킹 소매 길이와 그림이 같은 판단을 쓴다 */
export function isLongSleeve(kind: GarmentKind, name: string): boolean {
  const n = norm(name);
  if (hit(n, ["반팔", "half", "숏슬리브"])) return false;
  if (hit(n, ["긴팔", "롱슬리브"])) return true;
  return !(kind === "tee" || kind === "polo" || kind === "vest");
}

// ---- 패턴 ----

export type GarmentPattern = "solid" | "stripe" | "check" | "denim" | "cable" | "graphic";

export function garmentPattern(name: string, kind: GarmentKind): GarmentPattern {
  const n = norm(name);
  if (hit(n, ["스트라이프", "줄무늬", "보더", "stripe"])) return "stripe";
  if (hit(n, ["체크", "깅엄", "타탄", "플란넬", "check", "plaid"])) return "check";
  if (hit(n, ["케이블", "꽈배기", "cable", "아란"])) return "cable";
  if (hit(n, ["로고", "프린트", "그래픽", "레터링", "logo", "print"])) return "graphic";
  if (kind === "jeans" || hit(n, ["데님", "청", "denim"])) return "denim";
  if (kind === "knit") return "cable";
  return "solid";
}

// ---- 색 ----

/** 한국어·영어 색 이름 → 대표 hex. 옷 이름과 비전이 준 색 단어를 함께 훑는다. */
const COLOR_WORDS: [string[], string][] = [
  [["검정", "검은", "블랙", "먹색", "black"], "#23252a"],
  [["차콜", "charcoal", "진회색"], "#41464b"],
  [["회색", "그레이", "그레이지", "gray", "grey", "은색", "실버"], "#9aa0a2"],
  [["연회색", "라이트그레이", "애쉬"], "#c3c7c8"],
  [["흰", "화이트", "백색", "white"], "#f3f1ec"],
  [["아이보리", "ivory", "크림", "cream", "오프화이트"], "#ece3d1"],
  [["오트밀", "oatmeal", "샌드", "sand"], "#d9cdb4"],
  [["베이지", "beige"], "#d6c4a6"],
  [["카멜", "camel"], "#b98b5c"],
  [["탄색", "탄", "tan"], "#c9a071"],
  [["브라운", "갈색", "초콜릿", "brown", "코코아"], "#7a5a41"],
  [["네이비", "감색", "곤색", "곤navy", "navy", "남색"], "#26314e"],
  [["인디고", "indigo", "진청"], "#39527a"],
  [["연청", "라이트데님", "하늘색", "스카이", "sky"], "#9dbcd8"],
  [["청", "데님", "denim", "블루", "파랑", "파란", "blue"], "#3f6ba0"],
  [["민트", "mint"], "#9ccdbb"],
  [["카키", "khaki"], "#5d6350"],
  [["올리브", "olive"], "#6f7248"],
  [["초록", "그린", "green", "녹색"], "#3f6d4e"],
  [["와인", "버건디", "버건디색", "wine", "burgundy", "자주"], "#6e2b38"],
  [["빨강", "빨간", "레드", "red"], "#b6403c"],
  [["코랄", "coral", "살구"], "#e08a72"],
  [["분홍", "핑크", "pink"], "#e0a5ae"],
  [["보라", "퍼플", "purple", "라벤더", "lavender"], "#6b5590"],
  [["머스타드", "mustard"], "#c8992f"],
  [["노랑", "노란", "옐로", "yellow"], "#e3c14e"],
  [["주황", "오렌지", "orange"], "#d9793f"],
];

/** 이름·색 단어에서 대표 hex 를 찾는다. 못 찾으면 null. */
export function colorFromWords(...texts: (string | undefined)[]): string | null {
  const t = norm(texts.filter(Boolean).join(" "));
  if (!t) return null;
  let best: { hex: string; at: number; len: number } | null = null;
  for (const [words, hex] of COLOR_WORDS) {
    for (const w of words) {
      const at = t.indexOf(w);
      if (at < 0) continue;
      // 더 앞에 나온 색 이름이 이긴다(“검정 반팔 티셔츠”). 같은 위치면 더 긴 단어가 이긴다.
      if (!best || at < best.at || (at === best.at && w.length > best.len)) {
        best = { hex, at, len: w.length };
      }
    }
  }
  return best ? best.hex : null;
}

/** #rrggbb 형태만 통과시킨다(모델이 준 hex 방어) */
export function normalizeHex(raw?: string): string | null {
  if (!raw) return null;
  let h = raw.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return /^[0-9a-fA-F]{6}$/.test(h) ? `#${h.toLowerCase()}` : null;
}

const CATEGORY_FALLBACK: Record<string, string> = {
  상의: "#dfe3df",
  니트: "#d7cdb8",
  하의: "#4a5361",
  아우터: "#585f5c",
  원피스: "#c8a9a0",
  신발: "#3a3d40",
  가방: "#8a7a63",
  액세서리: "#9a90a8",
};

/**
 * 옷 한 점의 최종 색 — 이름·색 단어가 1순위(가장 정확), 모델 hex 2순위, 사진에서 뽑은 색 3순위.
 * 전부 실패하면 카테고리 기본색.
 */
export function resolveColor(opts: {
  name?: string;
  colorWord?: string;
  hex?: string;
  sampled?: string;
  category?: string;
}): string {
  return (
    colorFromWords(opts.name, opts.colorWord) ??
    normalizeHex(opts.hex) ??
    normalizeHex(opts.sampled) ??
    CATEGORY_FALLBACK[opts.category ?? ""] ??
    "#cfd6d0"
  );
}

// ---- 팔레트 (색 하나에서 음영·라인·디테일 색을 만든다) ----

export interface Palette {
  base: string;
  light: string;
  shade: string;
  deep: string;
  line: string;
  stitch: string;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) => Math.round(clamp01(v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** 밝기/채도를 옮긴 파생색 */
export function shift(hex: string, dl: number, ds = 0): string {
  const c = hexToHsl(hex);
  if (!c) return hex;
  return hslToHex(c.h, clamp01(c.s + ds), clamp01(c.l + dl));
}

export function paletteOf(hex: string): Palette {
  const c = hexToHsl(hex) ?? { h: 0, s: 0, l: 0.7 };
  const dark = c.l < 0.28; // 검정 계열은 밝은 쪽으로 음영을 만들어야 형태가 보인다
  return {
    base: hex,
    light: shift(hex, dark ? 0.1 : 0.07, -0.02),
    shade: shift(hex, dark ? 0.05 : -0.08),
    deep: shift(hex, dark ? 0.02 : -0.16),
    line: shift(hex, dark ? 0.14 : -0.3, 0.02),
    stitch: shift(hex, dark ? 0.24 : 0.16, -0.05),
  };
}

// ---- 좌표 유틸 ----

const CX = 100; // 그림 중심축 (viewBox 0 0 200 200)
const r1 = (v: number) => Math.round(v * 10) / 10;
const p = (x: number, y: number) => `${r1(x)},${r1(y)}`;

/** 핏 → 폭 배율 */
export function fitScale(fit?: string): number {
  switch (fit) {
    case "와이드": return 1.16;
    case "오버핏": return 1.12;
    case "루즈": return 1.07;
    case "슬림": return 0.9;
    case "테이퍼드": return 0.95;
    case "크롭": return 1.0;
    default: return 1;
  }
}

// ---- 상의 계열 실루엣 ----

interface TopSpec {
  shY: number;
  shHalf: number;
  chestHalf: number;
  waistHalf: number;
  hemHalf: number;
  hemY: number;
  neckHalf: number;
  neckDepth: number;
  sleeveOuter: number;
  cuffTopY: number;
  cuffInner: number;
  cuffBotY: number;
  armpitY: number;
}

function topSpec(kind: GarmentKind, k: number, long: boolean, cropped: boolean): TopSpec {
  const shHalf = (kind === "coat" || kind === "padding" ? 40 : 37) * k;
  const chestHalf = (kind === "coat" || kind === "padding" ? 44 : 40) * k;
  const hemY =
    kind === "coat" ? 184 : kind === "padding" ? 170 : kind === "jacket" || kind === "cardigan" || kind === "zipup" ? 162 : cropped ? 134 : 152;
  return {
    shY: 52,
    shHalf,
    chestHalf,
    waistHalf: chestHalf * (kind === "coat" ? 0.98 : 0.94),
    hemHalf: chestHalf * (kind === "coat" ? 1.02 : kind === "knit" ? 0.9 : 0.96),
    hemY,
    neckHalf: 15,
    neckDepth: kind === "knit" || kind === "sweat" ? 11 : 9,
    sleeveOuter: chestHalf + (long ? 24 : 20),
    cuffTopY: long ? 132 : 84,
    cuffInner: chestHalf + (long ? 6 : 2),
    cuffBotY: long ? 146 : 98,
    armpitY: 104,
  };
}

/** 상의·아우터 바깥 실루엣 한 붓 그리기 */
function topOutline(s: TopSpec): string {
  const L = (v: number) => CX - v;
  const R = (v: number) => CX + v;
  return [
    `M${p(L(s.neckHalf), s.shY)}`,
    `Q${p(L(s.shHalf * 0.62), s.shY - 4)} ${p(L(s.shHalf), s.shY + 4)}`,
    `C${p(L(s.sleeveOuter * 0.82), s.shY + (s.cuffTopY - s.shY) * 0.42)} ${p(L(s.sleeveOuter), s.cuffTopY - 12)} ${p(L(s.sleeveOuter), s.cuffTopY)}`,
    `L${p(L(s.cuffInner), s.cuffBotY)}`,
    `C${p(L(s.cuffInner - 2), s.cuffBotY - 14)} ${p(L(s.chestHalf + 1), s.armpitY + 6)} ${p(L(s.chestHalf), s.armpitY)}`,
    `C${p(L(s.chestHalf), s.armpitY + 14)} ${p(L(s.waistHalf), s.hemY - 34)} ${p(L(s.hemHalf), s.hemY - 6)}`,
    `Q${p(L(s.hemHalf), s.hemY)} ${p(L(s.hemHalf - 5), s.hemY)}`,
    `L${p(R(s.hemHalf - 5), s.hemY)}`,
    `Q${p(R(s.hemHalf), s.hemY)} ${p(R(s.hemHalf), s.hemY - 6)}`,
    `C${p(R(s.waistHalf), s.hemY - 34)} ${p(R(s.chestHalf), s.armpitY + 14)} ${p(R(s.chestHalf), s.armpitY)}`,
    `C${p(R(s.chestHalf + 1), s.armpitY + 6)} ${p(R(s.cuffInner - 2), s.cuffBotY - 14)} ${p(R(s.cuffInner), s.cuffBotY)}`,
    `L${p(R(s.sleeveOuter), s.cuffTopY)}`,
    `C${p(R(s.sleeveOuter), s.cuffTopY - 12)} ${p(R(s.sleeveOuter * 0.82), s.shY + (s.cuffTopY - s.shY) * 0.42)} ${p(R(s.shHalf), s.shY + 4)}`,
    `Q${p(R(s.shHalf * 0.62), s.shY - 4)} ${p(R(s.neckHalf), s.shY)}`,
    `Q${p(CX, s.shY + s.neckDepth)} ${p(L(s.neckHalf), s.shY)}`,
    "Z",
  ].join(" ");
}

// ---- 하의 계열 실루엣 ----

interface BottomSpec {
  waistY: number;
  waistHalf: number;
  hipHalf: number;
  hipY: number;
  crotchY: number;
  hemY: number;
  hemHalf: number;
  gap: number;
}

function bottomSpec(kind: GarmentKind, k: number, cropped: boolean): BottomSpec {
  const wide = k >= 1.1;
  const slim = k <= 0.92;
  const hemHalf = kind === "jogger" ? 15 : wide ? 24 : slim ? 14 : 18.5;
  return {
    waistY: 44,
    waistHalf: 32 * (k > 1 ? 1 + (k - 1) * 0.4 : k),
    hipHalf: 38 * (k > 1 ? 1 + (k - 1) * 0.5 : k),
    hipY: 76,
    crotchY: 100,
    hemY: kind === "shorts" ? 122 : cropped ? 164 : 180,
    hemHalf: hemHalf * (k > 1 ? 1 + (k - 1) * 0.8 : 1),
    gap: 2.4,
  };
}

/** 다리 한 짝 (sign = -1 왼쪽 / +1 오른쪽) — 두 짝 사이에 실제 틈이 남는다 */
function legOutline(s: BottomSpec, sign: number): string {
  const outerTop = CX + sign * s.hipHalf;
  const outerHem = CX + sign * (s.gap + s.hemHalf * 2);
  const innerHem = CX + sign * s.gap;
  return [
    `M${p(CX + sign * 0.6, s.waistY)}`,
    `L${p(outerTop, s.waistY + 2)}`,
    `C${p(outerTop + sign * 1.5, s.hipY)} ${p(outerHem + sign * 4, s.crotchY + 26)} ${p(outerHem, s.hemY - 4)}`,
    `Q${p(outerHem, s.hemY)} ${p(outerHem - sign * 4, s.hemY)}`,
    `L${p(innerHem + sign * 4, s.hemY)}`,
    `Q${p(innerHem, s.hemY)} ${p(innerHem, s.hemY - 5)}`,
    // 안쪽 인심은 밑단에서 가랑이까지 곧게 올라간다 — 가운데가 둥글게 뚫려 보이면 바지로 안 읽힌다
    `C${p(innerHem, s.crotchY + (s.hemY - s.crotchY) * 0.5)} ${p(CX + sign * (s.gap + 2.5), s.crotchY + 9)} ${p(CX + sign * 0.6, s.crotchY)}`,
    "Z",
  ].join(" ");
}

function skirtOutline(s: BottomSpec): string {
  const hem = s.hipHalf * 1.5;
  return [
    `M${p(CX - s.waistHalf, s.waistY)}`,
    `C${p(CX - s.hipHalf - 2, s.hipY)} ${p(CX - hem, 130)} ${p(CX - hem, 158)}`,
    `Q${p(CX, 168)} ${p(CX + hem, 158)}`,
    `C${p(CX + hem, 130)} ${p(CX + s.hipHalf + 2, s.hipY)} ${p(CX + s.waistHalf, s.waistY)}`,
    `Q${p(CX, s.waistY - 5)} ${p(CX - s.waistHalf, s.waistY)}`,
    "Z",
  ].join(" ");
}

function dressOutline(k: number): string {
  const shHalf = 34 * k;
  const chest = 36 * k;
  const waist = 29 * k;
  const hem = 52 * k;
  return [
    `M${p(CX - 14, 46)}`,
    `Q${p(CX - shHalf * 0.6, 42)} ${p(CX - shHalf, 50)}`,
    `L${p(CX - chest - 3, 76)}`,
    `L${p(CX - chest, 82)}`,
    `C${p(CX - chest, 96)} ${p(CX - waist, 100)} ${p(CX - waist, 108)}`,
    `C${p(CX - hem, 130)} ${p(CX - hem, 152)} ${p(CX - hem, 168)}`,
    `Q${p(CX, 178)} ${p(CX + hem, 168)}`,
    `C${p(CX + hem, 152)} ${p(CX + hem, 130)} ${p(CX + waist, 108)}`,
    `C${p(CX + waist, 100)} ${p(CX + chest, 96)} ${p(CX + chest, 82)}`,
    `L${p(CX + chest + 3, 76)}`,
    `L${p(CX + shHalf, 50)}`,
    `Q${p(CX + shHalf * 0.6, 42)} ${p(CX + 14, 46)}`,
    `Q${p(CX, 56)} ${p(CX - 14, 46)}`,
    "Z",
  ].join(" ");
}

// ---- 신발·가방 ----

/**
 * 신발 옆모습 — 뒤꿈치(왼쪽) → 발목 개구부 → 앞코(오른쪽) → 밑창.
 * 실루엣에 발목 개구부의 V 홈이 실제로 파여 있어야 신발로 읽힌다(홈이 없으면 그냥 둥근 덩어리).
 */
function shoeOutline(kind: GarmentKind): string {
  if (kind === "boots") {
    return [
      `M${p(50, 56)}`,
      `C${p(50, 49)} ${p(55, 46)} ${p(62, 46)}`,
      `L${p(97, 46)}`,
      `C${p(104, 46)} ${p(108, 50)} ${p(108, 57)}`,
      `L${p(108, 110)}`,
      `C${p(126, 118)} ${p(150, 128)} ${p(168, 137)}`,
      `C${p(178, 142)} ${p(177, 152)} ${p(166, 153)}`,
      `L${p(60, 153)}`,
      `C${p(51, 153)} ${p(47, 148)} ${p(48, 139)}`,
      "Z",
    ].join(" ");
  }
  if (kind === "loafers") {
    return [
      `M${p(36, 138)}`,
      `C${p(32, 118)} ${p(46, 106)} ${p(70, 105)}`,
      `C${p(100, 104)} ${p(134, 116)} ${p(160, 130)}`,
      `C${p(174, 138)} ${p(180, 143)} ${p(178, 147)}`,
      `C${p(175, 151)} ${p(166, 151)} ${p(156, 151)}`,
      `L${p(48, 151)}`,
      `C${p(38, 151)} ${p(36, 145)} ${p(36, 138)}`,
      "Z",
    ].join(" ");
  }
  // 스니커즈 — 힐카운터가 서고, 발목이 넓게 파이고, 텅에서 앞코로 길게 흐른다
  return [
    `M${p(32, 140)}`,
    `C${p(28, 122)} ${p(30, 106)} ${p(42, 100)}`,
    `C${p(50, 96)} ${p(60, 95)} ${p(68, 97)}`,
    `C${p(74, 107)} ${p(80, 114)} ${p(93, 118)}`, // 발목 개구부
    `C${p(97, 111)} ${p(101, 102)} ${p(108, 96)}`, // 텅
    `C${p(128, 104)} ${p(152, 116)} ${p(168, 128)}`,
    `C${p(177, 134)} ${p(181, 139)} ${p(180, 144)}`,
    `C${p(179, 148)} ${p(175, 150)} ${p(168, 150)}`,
    `L${p(44, 150)}`,
    `C${p(34, 150)} ${p(32, 146)} ${p(32, 140)}`,
    "Z",
  ].join(" ");
}

function bagOutline(): string {
  return [
    `M${p(56, 78)}`,
    `L${p(144, 78)}`,
    `C${p(150, 78)} ${p(152, 82)} ${p(151, 88)}`,
    `L${p(142, 156)}`,
    `C${p(141, 162)} ${p(137, 165)} ${p(131, 165)}`,
    `L${p(69, 165)}`,
    `C${p(63, 165)} ${p(59, 162)} ${p(58, 156)}`,
    `L${p(49, 88)}`,
    `C${p(48, 82)} ${p(50, 78)} ${p(56, 78)}`,
    "Z",
  ].join(" ");
}

// ---- 그림 조립 ----

export interface ArtSpec {
  name: string;
  category: Category | string;
  color: string;
  fit?: string;
}

interface Resolved {
  kind: GarmentKind;
  pattern: GarmentPattern;
  pal: Palette;
  outline: string;
  /** 옷 위에 얹는 디테일(칼라·단추·솔기…) */
  details: string;
  /** 앞이 열린 옷의 안쪽(속옷이 비치는 부분) */
  inner: string;
  /** 접지 그림자 y — 옷마다 밑단 높이가 다르다 */
  ground: number;
  /** 실루엣 밖으로 나가는 부속(가방 손잡이 등) — 클립 밖에 그린다 */
  overlay: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 세로 리브(가디건 여밈·소매 시보리) 같은 반복 선 */
function ribLines(x1: number, x2: number, y1: number, y2: number, step: number, stroke: string): string {
  let out = "";
  for (let x = x1 + step; x < x2; x += step) {
    out += `<line x1="${r1(x)}" y1="${r1(y1)}" x2="${r1(x)}" y2="${r1(y2)}" stroke="${stroke}" stroke-width="0.7"/>`;
  }
  return out;
}

function resolve(spec: ArtSpec): Resolved {
  const kind = garmentKind(spec.name, spec.category as Category);
  const pattern = garmentPattern(spec.name, kind);
  const pal = paletteOf(spec.color);
  const k = fitScale(spec.fit);
  const cropped = spec.fit === "크롭";
  const long = isLongSleeve(kind, spec.name);
  const slot = kindSlot(kind);

  let outline = "";
  let details = "";
  let inner = "";
  let overlay = "";
  let ground = 166;

  if (slot === "shoe") {
    ground = 164;
    outline = shoeOutline(kind);
    // 밑창(미드솔·아웃솔)은 세 종류가 같은 규칙 — 옷과 달리 신발은 바닥 띠가 있어야 신발로 읽힌다
    const soleTop = kind === "boots" ? 136 : 134;
    const midsole =
      `<path d="M24 ${soleTop} C70 ${soleTop + 8} 140 ${soleTop + 12} 186 ${soleTop + 4} L186 ${soleTop + 12} L24 ${soleTop + 12} Z" fill="${pal.light}"/>` +
      `<rect x="24" y="${soleTop + 11}" width="162" height="14" fill="${pal.deep}"/>` +
      `<path d="M24 ${soleTop + 1} C70 ${soleTop + 9} 140 ${soleTop + 13} 186 ${soleTop + 5}" fill="none" stroke="${pal.line}" stroke-width="1" opacity="0.55"/>`;

    if (kind === "sneakers") {
      details =
        midsole +
        // 아이스테이(끈 구멍 판) + 끈
        `<path d="M96 116 C102 106 110 99 118 96 L128 104 C118 110 110 118 106 126 Z" fill="${pal.shade}"/>` +
        [0, 1, 2]
          .map((i) => `<line x1="${r1(99 + i * 11)}" y1="${r1(115 - i * 6)}" x2="${r1(112 + i * 11)}" y2="${r1(122 - i * 6)}" stroke="${pal.stitch}" stroke-width="2.2" stroke-linecap="round"/>`)
          .join("") +
        `<path d="M44 100 C42 116 42 130 42 138" fill="none" stroke="${pal.line}" stroke-width="1.1" opacity="0.5"/>` +
        `<path d="M148 118 C158 124 168 131 175 137" fill="none" stroke="${pal.line}" stroke-width="1" opacity="0.45"/>` +
        `<path d="M56 124 C80 132 110 138 140 140" fill="none" stroke="${pal.line}" stroke-width="1.2" opacity="0.32"/>`;
    } else if (kind === "boots") {
      details =
        midsole +
        `<path d="M48 60 L108 60" stroke="${pal.line}" stroke-width="1" opacity="0.45"/>` +
        // 첼시 부츠 고무 밴드
        `<path d="M92 56 L108 56 L108 108 L92 104 Z" fill="${pal.shade}"/>` +
        ribLines(92, 108, 58, 104, 4, `${pal.deep}`) +
        `<path d="M108 110 C126 118 150 128 168 137" fill="none" stroke="${pal.line}" stroke-width="1" opacity="0.4"/>` +
        `<path d="M124 122 C140 129 154 135 166 140" fill="none" stroke="${pal.stitch}" stroke-width="0.9" opacity="0.55"/>`;
    } else {
      details =
        midsole +
        // 발등 입구(스로트) + 새들 스트랩
        `<path d="M50 122 C56 108 70 104 88 108 C104 112 120 120 134 130 C112 128 76 126 50 130 Z" fill="${pal.deep}" opacity="0.55"/>` +
        `<path d="M84 110 C96 108 110 114 122 122 L115 132 C104 124 92 119 80 118 Z" fill="${pal.shade}"/>` +
        `<path d="M94 115 L110 123" stroke="${pal.stitch}" stroke-width="1.8" stroke-linecap="round"/>` +
        `<path d="M140 128 C154 135 166 141 174 146" fill="none" stroke="${pal.line}" stroke-width="1" opacity="0.4"/>`;
    }
  } else if (kind === "bag") {
    ground = 175;
    outline = bagOutline();
    details = `<path d="M49 92 L151 92" stroke="${pal.line}" stroke-width="1" opacity="0.5"/>`;
    // 손잡이는 가방 몸통 밖으로 나가므로 클립 밖에 그린다
    overlay = `<path d="M74 80 C74 50 126 50 126 80" fill="none" stroke="${pal.shade}" stroke-width="5" stroke-linecap="round"/>`;
  } else if (kind === "dress") {
    ground = 178;
    outline = dressOutline(k);
    details =
      `<path d="M${CX - 14} 46 Q${CX} 56 ${CX + 14} 46" fill="none" stroke="${pal.line}" stroke-width="1.2" opacity="0.7"/>` +
      `<path d="M${CX - 29 * k} 108 Q${CX} 114 ${CX + 29 * k} 108" fill="none" stroke="${pal.line}" stroke-width="1.4" opacity="0.6"/>` +
      [-1, 1].map((s) => `<path d="M${r1(CX + s * 16)} 116 C${r1(CX + s * 22)} 136 ${r1(CX + s * 26)} 152 ${r1(CX + s * 28)} 166" fill="none" stroke="${pal.line}" stroke-width="0.8" opacity="0.4"/>`).join("");
  } else if (slot === "bottom") {
    const s = bottomSpec(kind, k, cropped);
    ground = (kind === "skirt" ? 158 : s.hemY) + 10;
    if (kind === "skirt") {
      outline = skirtOutline(s);
      details =
        `<path d="M${CX - s.waistHalf} ${s.waistY + 9} Q${CX} ${s.waistY + 13} ${CX + s.waistHalf} ${s.waistY + 9}" fill="none" stroke="${pal.line}" stroke-width="1.2" opacity="0.7"/>` +
        [-2, -1, 0, 1, 2].map((i) => `<path d="M${r1(CX + i * 13)} ${s.waistY + 12} C${r1(CX + i * 17)} 110 ${r1(CX + i * 21)} 134 ${r1(CX + i * 24)} 158" fill="none" stroke="${pal.line}" stroke-width="0.8" opacity="0.35"/>`).join("");
    } else {
      outline = `${legOutline(s, -1)} ${legOutline(s, 1)}`;
      const bandY = s.waistY + 11;
      details =
        `<path d="M${CX - s.waistHalf - 1} ${s.waistY} L${CX + s.waistHalf + 1} ${s.waistY} L${CX + s.waistHalf + 1} ${bandY} L${CX - s.waistHalf - 1} ${bandY} Z" fill="${pal.shade}" opacity="0.55"/>` +
        `<path d="M${CX - s.waistHalf - 1} ${bandY} L${CX + s.waistHalf + 1} ${bandY}" stroke="${pal.line}" stroke-width="1" opacity="0.8"/>` +
        `<path d="M${CX} ${bandY} L${CX} ${s.crotchY - 4}" stroke="${pal.line}" stroke-width="1" opacity="0.65"/>` +
        (kind === "jeans"
          ? `<path d="M${CX + 3} ${bandY + 2} C${CX + 9} ${bandY + 12} ${CX + 9} ${bandY + 20} ${CX + 4} ${s.crotchY - 8}" fill="none" stroke="${pal.stitch}" stroke-width="1" opacity="0.9"/>` +
            [-1, 1].map((sg) => `<path d="M${r1(CX + sg * (s.waistHalf - 3))} ${bandY + 2} C${r1(CX + sg * (s.waistHalf - 6))} ${bandY + 12} ${r1(CX + sg * (s.waistHalf - 14))} ${bandY + 15} ${r1(CX + sg * 12)} ${bandY + 13}" fill="none" stroke="${pal.stitch}" stroke-width="1" opacity="0.85"/>`).join("") +
            [-1, 1].map((sg) => `<rect x="${r1(CX + sg * 20 - (sg < 0 ? 15 : 0))}" y="${bandY + 20}" width="15" height="13" rx="2" fill="none" stroke="${pal.stitch}" stroke-width="0.9" opacity="0.7"/>`).join("")
          : "") +
        (kind === "jogger"
          ? [-1, 1].map((sg) => `<rect x="${r1(CX + sg * s.gap + (sg < 0 ? -s.hemHalf * 2 : 0))}" y="${s.hemY - 12}" width="${r1(s.hemHalf * 2)}" height="12" fill="${pal.shade}" opacity="0.7"/>`).join("")
          : `<path d="M${CX - s.gap - s.hemHalf * 2 + 1} ${s.hemY - 7} L${CX - s.gap - 1} ${s.hemY - 7} M${CX + s.gap + 1} ${s.hemY - 7} L${CX + s.gap + s.hemHalf * 2 - 1} ${s.hemY - 7}" stroke="${pal.line}" stroke-width="0.8" opacity="0.45"/>`) +
        [-1, 1].map((sg) => `<path d="M${r1(CX + sg * (s.hipHalf * 0.5))} ${s.crotchY + 6} C${r1(CX + sg * (s.hipHalf * 0.55))} 130 ${r1(CX + sg * (s.gap + s.hemHalf))} 156 ${r1(CX + sg * (s.gap + s.hemHalf))} ${s.hemY - 10}" fill="none" stroke="${pal.line}" stroke-width="0.7" opacity="0.3"/>`).join("");
    }
  } else {
    // 상의·아우터
    const s = topSpec(kind, k, long, cropped);
    ground = s.hemY + 10;
    outline = topOutline(s);
    const open = kind === "cardigan" || kind === "jacket" || kind === "coat" || kind === "zipup" || kind === "padding" || kind === "vest";
    const cuffY = s.cuffBotY;
    const cuffTop = long ? cuffY - 12 : cuffY - 8;

    // 소매 시보리·밑단 라인은 모든 상의 공통
    details +=
      [-1, 1]
        .map((sg) => {
          const o = CX + sg * s.sleeveOuter;
          const i = CX + sg * s.cuffInner;
          return `<path d="M${r1(o)} ${r1(s.cuffTopY - (long ? 10 : 8))} L${r1(i)} ${r1(cuffTop)} L${r1(i)} ${r1(cuffY)} L${r1(o)} ${r1(s.cuffTopY)} Z" fill="${pal.shade}" opacity="${kind === "knit" || kind === "sweat" || kind === "hoodie" ? 0.75 : 0.4}"/>`;
        })
        .join("") +
      `<path d="M${CX - s.hemHalf + 2} ${s.hemY - 9} Q${CX} ${s.hemY - 6} ${CX + s.hemHalf - 2} ${s.hemY - 9}" fill="none" stroke="${pal.line}" stroke-width="0.9" opacity="0.45"/>`;

    if (open) {
      // 앞이 열린 옷 — 가운데로 속옷(그늘)이 보이고 좌우 여밈판이 겹친다
      const gap = kind === "coat" || kind === "padding" ? 7 : 9;
      inner = `M${CX - gap} ${s.shY + 6} L${CX + gap} ${s.shY + 6} L${CX + gap * 0.7} ${s.hemY - 2} L${CX - gap * 0.7} ${s.hemY - 2} Z`;
      details +=
        [-1, 1]
          .map((sg) => {
            const x = CX + sg * gap;
            const x2 = CX + sg * (gap + 7);
            return `<path d="M${r1(x)} ${s.shY + 6} L${r1(x2)} ${s.shY + 6} L${r1(x2 - sg * 1)} ${s.hemY - 2} L${r1(x - sg * 1.5)} ${s.hemY - 2} Z" fill="${pal.shade}" opacity="0.55"/>`;
          })
          .join("") +
        (kind === "jacket" || kind === "coat"
          ? [-1, 1]
              .map(
                (sg) =>
                  `<path d="M${r1(CX + sg * 15)} ${s.shY + 1} L${r1(CX + sg * 30)} ${s.shY + 7} L${r1(CX + sg * gap)} ${s.shY + 44} L${r1(CX + sg * (gap - 1))} ${s.shY + 8} Z" fill="${pal.light}" stroke="${pal.line}" stroke-width="0.8" stroke-opacity="0.5"/>`
              )
              .join("")
          : "") +
        (kind === "zipup"
          ? `<line x1="${CX}" y1="${s.shY + 6}" x2="${CX}" y2="${s.hemY - 3}" stroke="${pal.stitch}" stroke-width="2" stroke-dasharray="2 1.6" opacity="0.9"/>`
          : [0, 1, 2, 3]
              .map((i) => `<circle cx="${r1(CX - gap - 3.5)}" cy="${r1(s.shY + 26 + i * 26)}" r="2.1" fill="${pal.stitch}" opacity="0.95"/>`)
              .join("")) +
        (kind === "padding"
          ? [0, 1, 2, 3, 4]
              .map((i) => `<line x1="${CX - s.chestHalf + 2}" y1="${r1(s.shY + 20 + i * 22)}" x2="${CX + s.chestHalf - 2}" y2="${r1(s.shY + 20 + i * 22)}" stroke="${pal.line}" stroke-width="1" opacity="0.35"/>`)
              .join("")
          : "");
    } else if (kind === "shirt" || kind === "polo") {
      // 칼라 + 앞단 + 단추
      details +=
        `<path d="M${CX - s.neckHalf} ${s.shY} L${CX - 4} ${s.shY + 22} L${CX - 20} ${s.shY + 13} Z" fill="${pal.light}" stroke="${pal.line}" stroke-width="0.8" stroke-opacity="0.55"/>` +
        `<path d="M${CX + s.neckHalf} ${s.shY} L${CX + 4} ${s.shY + 22} L${CX + 20} ${s.shY + 13} Z" fill="${pal.light}" stroke="${pal.line}" stroke-width="0.8" stroke-opacity="0.55"/>` +
        `<rect x="${CX - 5}" y="${s.shY + 10}" width="10" height="${r1((kind === "polo" ? 46 : s.hemY - s.shY - 14))}" fill="${pal.light}" opacity="0.75"/>` +
        `<line x1="${CX - 5}" y1="${s.shY + 10}" x2="${CX - 5}" y2="${r1(s.shY + 10 + (kind === "polo" ? 46 : s.hemY - s.shY - 14))}" stroke="${pal.line}" stroke-width="0.8" opacity="0.6"/>` +
        `<line x1="${CX + 5}" y1="${s.shY + 10}" x2="${CX + 5}" y2="${r1(s.shY + 10 + (kind === "polo" ? 46 : s.hemY - s.shY - 14))}" stroke="${pal.line}" stroke-width="0.8" opacity="0.6"/>` +
        (kind === "polo" ? [0, 1] : [0, 1, 2, 3])
          .map((i) => `<circle cx="${CX}" cy="${r1(s.shY + 26 + i * 24)}" r="2" fill="${pal.stitch}"/>`)
          .join("");
    } else if (kind === "hoodie") {
      details +=
        `<path d="M${CX - s.neckHalf - 9} ${s.shY + 2} C${CX - 14} ${s.shY - 12} ${CX + 14} ${s.shY - 12} ${CX + s.neckHalf + 9} ${s.shY + 2} C${CX + 12} ${s.shY + 20} ${CX - 12} ${s.shY + 20} ${CX - s.neckHalf - 9} ${s.shY + 2} Z" fill="${pal.shade}" stroke="${pal.line}" stroke-width="0.9" stroke-opacity="0.5"/>` +
        `<path d="M${CX - 30} ${s.hemY - 46} L${CX + 30} ${s.hemY - 46} L${CX + 26} ${s.hemY - 16} L${CX - 26} ${s.hemY - 16} Z" fill="none" stroke="${pal.line}" stroke-width="1" opacity="0.5"/>` +
        `<line x1="${CX - 6}" y1="${s.shY + 14}" x2="${CX - 8}" y2="${s.shY + 40}" stroke="${pal.stitch}" stroke-width="1.6" stroke-linecap="round"/>` +
        `<line x1="${CX + 6}" y1="${s.shY + 14}" x2="${CX + 8}" y2="${s.shY + 40}" stroke="${pal.stitch}" stroke-width="1.6" stroke-linecap="round"/>`;
    } else {
      // 라운드넥 리브
      details += `<path d="M${CX - s.neckHalf} ${s.shY} Q${CX} ${s.shY + s.neckDepth} ${CX + s.neckHalf} ${s.shY} Q${CX} ${s.shY + s.neckDepth + 5} ${CX - s.neckHalf} ${s.shY} Z" fill="${pal.shade}" opacity="0.8"/>`;
      if (kind === "sweat" || kind === "knit") {
        details += `<path d="M${CX - s.hemHalf + 1} ${s.hemY - 11} L${CX + s.hemHalf - 1} ${s.hemY - 11} L${CX + s.hemHalf - 3} ${s.hemY} L${CX - s.hemHalf + 3} ${s.hemY} Z" fill="${pal.shade}" opacity="0.7"/>`;
      }
    }
  }

  return { kind, pattern, pal, outline, details, inner, ground, overlay };
}

/** 패턴 오버레이 — 옷 실루엣 안쪽으로 잘라 넣는다 */
function patternLayer(r: Resolved): string {
  const { pattern, pal } = r;
  if (pattern === "solid") return "";
  if (pattern === "stripe") {
    let out = "";
    for (let y = 30; y < 190; y += 11) {
      out += `<rect x="20" y="${y}" width="160" height="5" fill="${pal.deep}" opacity="0.42"/>`;
    }
    return out;
  }
  if (pattern === "check") {
    let out = "";
    for (let y = 30; y < 190; y += 16) out += `<rect x="20" y="${y}" width="160" height="3" fill="${pal.deep}" opacity="0.34"/>`;
    for (let x = 24; x < 180; x += 16) out += `<rect x="${x}" y="30" width="3" height="160" fill="${pal.deep}" opacity="0.34"/>`;
    return out;
  }
  if (pattern === "denim") {
    let out = "";
    for (let i = -12; i < 26; i += 1) {
      const x = 20 + i * 9;
      out += `<line x1="${x}" y1="20" x2="${x + 90}" y2="200" stroke="${pal.light}" stroke-width="1.1" opacity="0.28"/>`;
    }
    return out;
  }
  if (pattern === "cable") {
    let out = "";
    for (let x = 34; x < 170; x += 13) {
      out += `<line x1="${x}" y1="24" x2="${x}" y2="196" stroke="${pal.light}" stroke-width="2.4" opacity="0.3"/>`;
      out += `<line x1="${x + 6}" y1="24" x2="${x + 6}" y2="196" stroke="${pal.deep}" stroke-width="1.2" opacity="0.22"/>`;
    }
    return out;
  }
  // graphic — 가슴 포인트 하나
  return `<g opacity="0.9"><circle cx="100" cy="104" r="15" fill="none" stroke="${pal.stitch}" stroke-width="2.4"/><path d="M92 104 L98 111 L110 98" fill="none" stroke="${pal.stitch}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

/**
 * 옷 한 점의 그림(SVG 마크업). 배경은 은은한 스튜디오 톤, 옷은 화면 가운데 한 점만.
 */
export function garmentArtSvg(spec: ArtSpec): string {
  const r = resolve(spec);
  const { pal } = r;
  const label = esc(spec.name || "옷");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${label}">`,
    `<defs>`,
    `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f5f0"/><stop offset="1" stop-color="#e9e6de"/></linearGradient>`,
    `<linearGradient id="sh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.2"/><stop offset="0.22" stop-color="#000" stop-opacity="0.03"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.16"/><stop offset="0.8" stop-color="#000" stop-opacity="0.04"/><stop offset="1" stop-color="#000" stop-opacity="0.22"/></linearGradient>`,
    `<clipPath id="cl"><path d="${r.outline}"/></clipPath>`,
    `</defs>`,
    `<rect width="200" height="200" fill="url(#bg)"/>`,
    `<ellipse cx="100" cy="${r1(Math.min(r.ground, 192))}" rx="58" ry="7" fill="#1f2a26" opacity="0.08"/>`,
    `<path d="${r.outline}" fill="${pal.base}"/>`,
    `<g clip-path="url(#cl)">`,
    patternLayer(r),
    r.inner ? `<path d="${r.inner}" fill="#2b302e" opacity="0.55"/>` : "",
    r.details,
    `<path d="${r.outline}" fill="url(#sh)"/>`,
    `</g>`,
    `<path d="${r.outline}" fill="none" stroke="${pal.line}" stroke-width="1.1" stroke-linejoin="round"/>`,
    r.overlay,
    `</svg>`,
  ].join("");
}

/** <img src> 로 바로 쓸 수 있는 data URL */
export function garmentArtDataUrl(spec: ArtSpec): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(garmentArtSvg(spec))}`;
}

/** 생성된 아트인지 — 원본 사진과 구분해 UI 문구를 바꾼다 */
export const isGeneratedArt = (src: string) => src.startsWith("data:image/svg+xml");
