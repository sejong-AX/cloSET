/**
 * 의류 분류 · 성별 적합도 · 보온/격식 점수 — 전부 결정적(LLM 무관).
 *
 * cloSET 원칙: 수치·등급 판정은 코드가 정한다. 비전 모델이 카테고리를 틀리게 돌려줘도
 * 여기서 이름의 결정적 키워드로 교정한다(예: 옷걸이에 반으로 접힌 바지를 '상의'로 오인).
 * 같은 규칙이 api-rs/src/rules.rs 의 resolve_garment_category 에도 있다(서버·클라 심층 방어).
 */

import type { Item } from "./data";

export type Slot = "outer" | "top" | "bottom" | "shoe" | "dress" | "bag" | "acc";
export type Gender = "female" | "male";

/** 사용자에게 보이는 카테고리 8종 */
export const CATEGORIES = ["상의", "니트", "하의", "아우터", "원피스", "신발", "가방", "액세서리"] as const;
export type Category = (typeof CATEGORIES)[number];

// ---- 결정적 키워드 표 (Rust 쪽과 동일 목록을 유지한다) ----

// '바지/치마'처럼 다른 카테고리로 읽힐 수 없는 확정 명사만 담는다.
// (카고·치노 같은 수식어는 자켓에도 붙으므로 넣지 않는다)
const KW_BOTTOM = [
  "바지", "팬츠", "슬랙스", "슬랙", "청바지", "진바지", "데님팬츠", "조거", "트라우저",
  "치마", "스커트", "반바지", "숏츠", "버뮤다", "레깅스", "스키니", "하의",
  "pants", "jeans", "slacks", "shorts", "skirt", "trousers", "jogger", "chinos",
];
const KW_DRESS = ["원피스", "드레스", "점프수트", "올인원", "dress", "jumpsuit"];
const KW_SHOE = [
  "신발", "슈즈", "스니커", "운동화", "부츠", "로퍼", "구두", "샌들", "힐", "펌프스", "더비", "옥스퍼드",
  "shoes", "sneaker", "boots", "loafer", "sandal", "heel", "derby", "oxford",
];
const KW_BAG = [
  "가방", "백팩", "숄더백", "토트", "크로스백", "클러치", "더플", "에코백",
  "bag", "backpack", "tote", "clutch",
];
const KW_ACC = [
  "모자", "캡", "비니", "버킷햇", "스카프", "머플러", "목도리", "벨트", "장갑", "양말",
  "주얼리", "시계", "안경", "선글라스", "넥타이", "반지", "목걸이", "귀걸이",
  "hat", "cap", "beanie", "scarf", "belt", "socks", "watch", "glasses", "sunglasses", "tie",
];
// 아우터 '카테고리' — 가디건은 니트로 분류하므로 여기 넣지 않는다.
const KW_OUTER = [
  "코트", "자켓", "재킷", "점퍼", "패딩", "블레이저", "바람막이", "아노락", "무스탕",
  "트렌치", "파카", "집업", "조끼", "베스트", "다운", "야상",
  "coat", "jacket", "blazer", "parka", "vest", "windbreaker", "anorak", "puffer",
];
const KW_KNIT = ["니트", "스웨터", "풀오버", "가디건", "knit", "sweater", "pullover", "cardigan"];
const KW_TOP = [
  "셔츠", "블라우스", "티셔츠", "반팔티", "긴팔티", "맨투맨", "스웨트", "후드티", "후디",
  "탱크톱", "폴로", "카라티", "나시",
  "shirt", "blouse", "tee", "t-shirt", "hoodie", "sweatshirt", "polo", "tank",
];
// 상의처럼 보이지만 레이어 위치는 아우터인 것들
const KW_LAYER_OUTER = ["가디건", "조끼", "베스트", "집업", "cardigan", "vest"];

const hit = (text: string, words: string[]) => words.some((w) => text.includes(w));

/** 검색용 정규화 — 소문자화 + 공백 제거(“데님 자켓” = “데님자켓”) */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/**
 * 이름과 (모델이 준) 카테고리로 최종 카테고리를 결정한다.
 * 이름에 확정 명사가 있으면 이름이 이긴다 — 비전이 카테고리를 틀려도 교정되는 지점.
 */
export function resolveCategory(name: string, rawCategory?: string): Category {
  const n = norm(name);
  if (hit(n, KW_BOTTOM)) return "하의";
  // '슬림진·스키니진·블랙진'처럼 '진'으로 끝나면 청바지다(단독 '진'은 제외)
  if (n.length >= 3 && n.endsWith("진")) return "하의";
  if (hit(n, KW_DRESS)) return "원피스";
  if (hit(n, KW_SHOE)) return "신발";
  if (hit(n, KW_BAG)) return "가방";
  if (hit(n, KW_ACC)) return "액세서리";
  if (hit(n, KW_OUTER)) return "아우터";
  if (hit(n, KW_KNIT)) return "니트";
  if (hit(n, KW_TOP)) return "상의";
  return normalizeCategory(rawCategory);
}

/** 모델이 준 카테고리 문자열을 8종으로 정규화(이름 단서가 없을 때의 폴백) */
export function normalizeCategory(raw?: string): Category {
  const r = norm(raw ?? "");
  if (!r) return "상의";
  if ((CATEGORIES as readonly string[]).includes(raw?.trim() ?? "")) return raw!.trim() as Category;
  if (hit(r, KW_BOTTOM) || r.includes("하의")) return "하의";
  if (hit(r, KW_DRESS)) return "원피스";
  if (hit(r, KW_SHOE)) return "신발";
  if (hit(r, KW_BAG)) return "가방";
  if (hit(r, KW_ACC) || r.includes("액세서리")) return "액세서리";
  if (hit(r, KW_OUTER) || r.includes("아우터")) return "아우터";
  if (hit(r, KW_KNIT)) return "니트";
  return "상의";
}

/** 카테고리·이름 → 마네킹 레이어 위치. 가디건·조끼는 니트로 분류되지만 겉에 입는다. */
export function slotOf(name: string, category: Category): Slot {
  const n = norm(name);
  switch (category) {
    case "하의":
      return "bottom";
    case "원피스":
      return "dress";
    case "신발":
      return "shoe";
    case "가방":
      return "bag";
    case "액세서리":
      return "acc";
    case "아우터":
      return "outer";
    default:
      return hit(n, KW_LAYER_OUTER) ? "outer" : "top";
  }
}

/** 옷장 아이템(`cat` = "하의 · 옷장 1" 형태) → 슬롯 */
export function slotOfItem(item: Item): Slot {
  const cat = resolveCategory(item.name, item.cat.split("·")[0]?.trim());
  return slotOf(item.name, cat);
}

export function categoryOfItem(item: Item): Category {
  return resolveCategory(item.name, item.cat.split("·")[0]?.trim());
}

// ---- 보온 · 격식 ----

const WARMTH: [string[], number][] = [
  [["패딩", "다운", "무스탕", "puffer", "야상"], 10],
  [["코트", "파카", "트렌치", "coat", "parka"], 8],
  [["울", "캐시미어", "기모", "플리스", "니트", "스웨터", "wool", "knit"], 7],
  [["가디건", "집업", "자켓", "재킷", "점퍼", "블레이저", "조끼", "베스트", "cardigan", "jacket"], 6],
  [["데님", "청", "denim", "코듀로이"], 5],
  [["맨투맨", "스웨트", "후드", "hoodie", "슬랙스", "치노"], 4],
  [["셔츠", "코튼", "shirt", "블라우스"], 3],
  [["린넨", "반팔", "반바지", "숏츠", "샌들", "나시", "탱크", "linen"], 1],
];

/** 옷 한 점의 보온력 0~10 (이름 기반, 결정적) */
export function warmth(name: string): number {
  const n = norm(name);
  for (const [words, score] of WARMTH) if (hit(n, words)) return score;
  return 4;
}

const FORMALITY: [string[], number][] = [
  [["블레이저", "정장", "수트", "구두", "옥스퍼드", "더비", "넥타이", "blazer", "suit"], 9],
  [["슬랙스", "트렌치", "로퍼", "셔츠", "블라우스", "코트", "slacks", "loafer", "shirt"], 7],
  [["니트", "가디건", "스웨터", "치노", "부츠", "knit", "cardigan"], 5],
  [["데님", "청바지", "자켓", "재킷", "스니커", "운동화", "denim", "sneaker"], 3],
  [["후드", "맨투맨", "조거", "반바지", "샌들", "트레이닝", "hoodie", "jogger"], 1],
];

/** 옷 한 점의 격식 0~10 */
export function formality(name: string): number {
  const n = norm(name);
  for (const [words, score] of FORMALITY) if (hit(n, words)) return score;
  return 4;
}

// ---- 성별 적합도 ----

// 남성 착장에서 강하게 배제(하드 제외가 아니라 큰 감점 — 옷장에 그것밖에 없으면 그래도 보여준다)
const FEMALE_LEANING = ["치마", "스커트", "원피스", "드레스", "블라우스", "힐", "펌프스", "플레어", "크롭", "skirt", "dress", "blouse", "heel"];
const MALE_LEANING = ["넥타이", "정장", "수트", "옥스퍼드", "더비", "카고", "tie", "suit"];

/**
 * 성별 적합도 보정치 (점수에 그대로 더한다).
 * 여성 마네킹은 여성향에 가점, 남성 마네킹은 여성향에 큰 감점 → 같은 옷장에서도 두 추천이 갈린다.
 */
export function genderBias(name: string, gender: Gender): number {
  const n = norm(name);
  const fem = hit(n, FEMALE_LEANING);
  const male = hit(n, MALE_LEANING);
  if (gender === "female") return (fem ? 8 : 0) + (male ? -6 : 0);
  return (fem ? -60 : 0) + (male ? 6 : 0);
}

/** 성별별 선호 실루엣 — 핏 조합 점수에 쓰인다 */
export const FIT_PREFERENCE: Record<Gender, { top: string[]; bottom: string[] }> = {
  female: { top: ["크롭", "슬림", "레귤러"], bottom: ["와이드", "롱", "스트레이트"] },
  male: { top: ["레귤러", "오버핏", "루즈"], bottom: ["스트레이트", "테이퍼드", "슬림"] },
};

// ---- 색 ----

export interface Hsl {
  h: number; // 0~360
  s: number; // 0~1
  l: number; // 0~1
}

/** #rrggbb / #rgb → HSL. 파싱 실패 시 null */
export function hexToHsl(hex?: string): Hsl | null {
  if (!hex) return null;
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue: number;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) hue = ((b - r) / d + 2) * 60;
  else hue = ((r - g) / d + 4) * 60;
  return { h: hue, s, l };
}

/** 무채색(뉴트럴) 판정 — 채도가 낮거나 아주 밝고 어두운 색 */
export function isNeutral(c: Hsl | null): boolean {
  if (!c) return true;
  return c.s < 0.18 || c.l > 0.9 || c.l < 0.1;
}

/** 두 색상 hue 의 원형 거리 0~180 */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** 색 이름 라벨 — 조합 카피에 쓰는 톤 이름 */
export function toneLabel(colors: (string | undefined)[]): string {
  const hsls = colors.map(hexToHsl).filter((c): c is Hsl => c !== null);
  if (hsls.length === 0) return "뉴트럴";
  const chromatic = hsls.filter((c) => !isNeutral(c));
  if (chromatic.length === 0) {
    const avgL = hsls.reduce((s, c) => s + c.l, 0) / hsls.length;
    return avgL > 0.62 ? "라이트 뉴트럴" : avgL < 0.3 ? "모노 다크" : "뉴트럴";
  }
  const h = chromatic[0].h;
  if (h >= 190 && h <= 250) return "데님 블루";
  if (h >= 20 && h < 45) return "얼씨 브라운";
  if (h >= 45 && h < 90) return "올리브";
  if (h >= 90 && h < 190) return "쿨 그린";
  if (h >= 250 && h < 320) return "플럼";
  return "웜 레드";
}
