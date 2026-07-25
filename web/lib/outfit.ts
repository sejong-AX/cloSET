/**
 * 오늘의 착장 추천 엔진 — 실제 옷장(items)에서 조합을 만든다. 전부 결정적.
 *
 * 왜 결정적인가: 같은 옷장·같은 날씨·같은 성별이면 항상 같은 조합·같은 점수가 나와야
 * 사용자가 추천을 신뢰할 수 있고, 모델을 바꿔도 결과가 흔들리지 않는다(cloSET 원칙).
 * LLM 은 여기에 개입하지 않는다. 문구도 아이템 이름·날씨에서 템플릿으로 만든다.
 *
 * 하드코딩된 예시 조합이 없기 때문에, 옷장을 비우면 추천도 비고 다시 채우면 새 옷으로 다시 만들어진다.
 */

import { directionParticle, objectParticle, wearCount, type Item } from "./data";
import {
  FIT_PREFERENCE,
  formality,
  genderBias,
  hexToHsl,
  hueDistance,
  isNeutral,
  slotOfItem,
  toneLabel,
  warmth,
  type Gender,
  type Slot,
} from "./garment";

export type TpoKey = "work" | "casual" | "dinner" | "home";

export interface TpoDef {
  key: TpoKey;
  label: string;
  icon: string;
  /** 목표 격식 0~10 */
  formality: number;
  noun: string;
  ctxTitle: string;
  ctxSub: string;
}

export const TPOS: TpoDef[] = [
  { key: "work", label: "출근·미팅", icon: "💼", formality: 8, noun: "오피스 룩", ctxTitle: "오후 2시 · 고객 미팅", ctxSub: "비즈니스 캐주얼로 격식을 맞췄어요." },
  { key: "casual", label: "주말 나들이", icon: "🌿", formality: 4, noun: "캐주얼", ctxTitle: "주말 · 브런치 약속", ctxSub: "편하게 움직이는 캐주얼로 맞췄어요." },
  { key: "dinner", label: "저녁 약속", icon: "🍷", formality: 6, noun: "저녁 무드", ctxTitle: "저녁 7시 · 다이닝", ctxSub: "은은한 톤의 스마트 캐주얼이에요." },
  { key: "home", label: "데일리·재택", icon: "🏠", formality: 2, noun: "데일리", ctxTitle: "재택 근무 · 하루 종일", ctxSub: "포근하게 겹쳐 입는 릴랙스드 룩이에요." },
];

export interface WeatherLike {
  apparent: number;
  precip: number;
}

export interface OutfitSlots {
  outer?: Item;
  top?: Item;
  bottom?: Item;
  shoe?: Item;
  dress?: Item;
}

export interface Outfit {
  /** 조합 서명 — 아이템 id 정렬 조인. 착용 로그·중복 방지 키 */
  sig: string;
  slots: OutfitSlots;
  items: Item[];
  tpo: TpoDef;
  gender: Gender;
  scores: { weather: number; tpo: number; color: number; fit: number };
  total: number;
  title: string;
  desc: string;
  pill: string;
  rank: string;
  /** 이 조합에 세탁 대기 중인 옷 수 */
  laundryCount: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round = (v: number) => Math.round(v);

/** 조합 서명 — 순서 무관, 아이템 구성이 같으면 같은 값 */
export function outfitSignature(items: (Item | undefined)[]): string {
  return items
    .filter((x): x is Item => !!x)
    .map((x) => x.id)
    .sort()
    .join("|");
}

// ---- 점수 ----

/** 기온 → 필요한 보온력 1~10 */
export function warmthTarget(apparent: number): number {
  return clamp((28 - apparent) / 2.8 + 1, 1, 10);
}

/** 착장의 실효 보온력 (아우터 없으면 상한이 낮다) */
export function outfitWarmth(s: OutfitSlots): number {
  const top = s.top ?? s.dress;
  const t = top ? warmth(top.name) : 0;
  const b = s.bottom ? warmth(s.bottom.name) : s.dress ? warmth(s.dress.name) : 0;
  const o = s.outer ? warmth(s.outer.name) : 0;
  return t * 0.45 + b * 0.25 + o * 0.3;
}

const RAIN_FRIENDLY = ["트렌치", "바람막이", "패딩", "파카", "코트", "부츠", "레인"];
const RAIN_HOSTILE = ["스웨이드", "린넨", "캔버스", "샌들", "니트"];

export function weatherScore(s: OutfitSlots, w: WeatherLike): number {
  let score = 100 - Math.abs(outfitWarmth(s) - warmthTarget(w.apparent)) * 11;
  if (w.precip >= 50) {
    const names = slotItems(s).map((x) => x.name).join(" ");
    if (RAIN_FRIENDLY.some((k) => names.includes(k))) score += 6;
    if (RAIN_HOSTILE.some((k) => names.includes(k))) score -= 8;
  }
  return round(clamp(score, 30, 99));
}

export function tpoScore(s: OutfitSlots, tpo: TpoDef): number {
  const items = slotItems(s);
  if (items.length === 0) return 30;
  const avg = items.reduce((sum, x) => sum + formality(x.name), 0) / items.length;
  return round(clamp(100 - Math.abs(avg - tpo.formality) * 9, 30, 99));
}

export function colorScore(s: OutfitSlots): number {
  const hsls = slotItems(s)
    .map((x) => hexToHsl(x.color))
    .filter((c): c is NonNullable<typeof c> => c !== null);
  const chromatic = hsls.filter((c) => !isNeutral(c));
  if (chromatic.length === 0) return 92; // 전부 뉴트럴 — 실패하지 않는 조합
  if (chromatic.length === 1) return 96; // 포인트 하나 — 가장 안전하게 세련된 구성
  if (chromatic.length >= 3) return 62;
  const d = hueDistance(chromatic[0].h, chromatic[1].h);
  if (d < 30) return 90; // 톤온톤
  if (d < 90) return 82; // 인접색
  if (d > 150) return 74; // 보색 — 의도적이면 좋지만 위험
  return 68;
}

const WIDE = ["오버핏", "루즈", "와이드"];
const LEAN = ["슬림", "스트레이트", "테이퍼드", "크롭"];

export function fitScore(s: OutfitSlots, gender: Gender): number {
  let score = 70;
  const pref = FIT_PREFERENCE[gender];
  const topFit = (s.top ?? s.dress)?.fit ?? "";
  const bottomFit = s.bottom?.fit ?? "";
  if (topFit && pref.top.includes(topFit)) score += 10;
  if (bottomFit && pref.bottom.includes(bottomFit)) score += 10;
  const topWide = WIDE.includes(topFit);
  const bottomWide = WIDE.includes(bottomFit);
  if (topWide && LEAN.includes(bottomFit)) score += 10; // 위 넉넉·아래 슬림 = 안정적인 실루엣
  else if (topWide && bottomWide) score -= 12; // 위아래 모두 넉넉 = 부해 보인다
  else if (LEAN.includes(topFit) && LEAN.includes(bottomFit)) score -= 4;
  return round(clamp(score, 30, 99));
}

const STATE_PENALTY: Record<Item["state"], number> = {
  available: 0,
  laundry: -18,
  stored: -6,
  reuse: -12,
};

export function slotItems(s: OutfitSlots): Item[] {
  return [s.outer, s.dress, s.top, s.bottom, s.shoe].filter((x): x is Item => !!x);
}

/** 아이템 한 점의 후보 점수 — 잊힌 옷을 끌어올리고, 과다 착용을 살짝 눌러 옷장을 골고루 쓴다 */
function itemAffinity(x: Item, gender: Gender): number {
  return (
    STATE_PENALTY[x.state] +
    genderBias(x.name, gender) +
    Math.min(x.daysAgo / 6, 8) -
    Math.min(wearCount(x.wear) / 8, 5)
  );
}

// ---- 조합 생성 ----

function bySlot(items: Item[]): Record<Slot, Item[]> {
  const out: Record<Slot, Item[]> = { outer: [], top: [], bottom: [], shoe: [], dress: [], bag: [], acc: [] };
  for (const x of items) out[slotOfItem(x)].push(x);
  return out;
}

/** 후보를 성별 적합도·상태 기준으로 줄인다(조합 폭발 방지, 결정적 정렬) */
function shortlist(list: Item[], gender: Gender, n: number): Item[] {
  return [...list]
    .sort((a, b) => {
      const d = itemAffinity(b, gender) - itemAffinity(a, gender);
      return d !== 0 ? d : a.id.localeCompare(b.id);
    })
    .slice(0, n);
}

interface Scored {
  slots: OutfitSlots;
  scores: Outfit["scores"];
  total: number;
}

function scoreCombo(slots: OutfitSlots, tpo: TpoDef, w: WeatherLike, gender: Gender): Scored {
  const scores = {
    weather: weatherScore(slots, w),
    tpo: tpoScore(slots, tpo),
    color: colorScore(slots),
    fit: fitScore(slots, gender),
  };
  const items = slotItems(slots);
  const extra = items.reduce((s, x) => s + STATE_PENALTY[x.state] + genderBias(x.name, gender), 0);
  const total =
    scores.weather * 0.34 + scores.tpo * 0.24 + scores.color * 0.22 + scores.fit * 0.2 + extra;
  return { slots, scores, total };
}

/**
 * 조합 후보 전체 열거 — 상의+하의(또는 원피스) 필수, 아우터·신발은 선택.
 * anchor 를 주면 그 옷이 반드시 들어간 조합만 만든다(옷 상세의 '이 옷으로 만든 코디').
 */
function enumerate(pool: Record<Slot, Item[]>, gender: Gender, anchor?: Item): OutfitSlots[] {
  const anchorSlot = anchor ? slotOfItem(anchor) : null;
  const pick = (slot: Slot, n: number): Item[] =>
    anchorSlot === slot && anchor ? [anchor] : shortlist(pool[slot], gender, n);
  const tops = pick("top", 6);
  const bottoms = pick("bottom", 6);
  const outers = pick("outer", 5);
  const shoes = pick("shoe", 4);
  const dresses = pick("dress", 3);
  // 앵커가 아우터/신발이면 '없음' 후보를 빼서 반드시 포함되게 한다
  const outerOpts: (Item | undefined)[] =
    anchorSlot === "outer" ? outers : [undefined, ...outers];
  const shoeOpts: (Item | undefined)[] =
    anchorSlot === "shoe" ? shoes : shoes.length ? shoes : [undefined];

  const out: OutfitSlots[] = [];
  if (anchorSlot !== "dress") {
    for (const top of tops)
      for (const bottom of bottoms)
        for (const outer of outerOpts) for (const shoe of shoeOpts) out.push({ top, bottom, outer, shoe });
  }
  if (anchorSlot === null || anchorSlot === "dress" || anchorSlot === "outer" || anchorSlot === "shoe") {
    for (const dress of dresses)
      for (const outer of outerOpts) for (const shoe of shoeOpts) out.push({ dress, outer, shoe });
  }
  // 상의만 / 하의만 있는 옷장에서도 무언가는 보여준다
  if (out.length === 0) {
    for (const top of tops) for (const shoe of shoeOpts) out.push({ top, shoe });
    for (const bottom of bottoms) for (const shoe of shoeOpts) out.push({ bottom, shoe });
  }
  return out;
}

// ---- 문구 ----

function weatherPrefix(w: WeatherLike): string {
  if (w.precip >= 50) return "비 오는 날의 ";
  if (w.apparent >= 27) return "더운 날의 ";
  if (w.apparent <= 8) return "추운 날의 ";
  return "";
}

function weatherClause(w: WeatherLike): string {
  if (w.precip >= 50) return "비에 대비했어요.";
  if (w.apparent >= 27) return "더위에 부담 없게 가볍게 뒀어요.";
  if (w.apparent <= 12) return "쌀쌀한 기온을 막아줘요.";
  return "지금 기온에 잘 맞아요.";
}

function buildTitle(s: OutfitSlots, tpo: TpoDef, w: WeatherLike): string {
  const tone = toneLabel(slotItems(s).map((x) => x.color));
  return `${weatherPrefix(w)}${tone} ${tpo.noun}`;
}

function buildDesc(s: OutfitSlots, w: WeatherLike): string {
  const parts: string[] = [];
  if (s.dress) {
    parts.push(`${s.dress.name} 한 장으로 정리했어요.`);
  } else if (s.top && s.bottom) {
    parts.push(`${s.top.name}에 ${s.bottom.name}${objectParticle(s.bottom.name)} 맞췄어요.`);
  } else if (s.top) {
    parts.push(`${s.top.name}${objectParticle(s.top.name)} 중심으로 잡았어요.`);
  } else if (s.bottom) {
    parts.push(`${s.bottom.name}${objectParticle(s.bottom.name)} 중심으로 잡았어요.`);
  }
  if (s.outer) {
    parts.push(`${s.outer.name}${objectParticle(s.outer.name)} 겉에 걸쳐 ${weatherClause(w)}`);
  } else {
    parts.push(weatherClause(w));
  }
  if (s.shoe) parts.push(`${s.shoe.name}${directionParticle(s.shoe.name)} 마무리했어요.`);
  return parts.join(" ");
}

function buildPill(s: OutfitSlots): string {
  const items = slotItems(s);
  if (items.length === 0) return "새 조합";
  const oldest = items.reduce((a, b) => (a.daysAgo >= b.daysAgo ? a : b));
  if (oldest.daysAgo >= 30) return `${oldest.daysAgo}일 만에 다시 꺼낸 ${oldest.name}`;
  const unworn = items.find((x) => wearCount(x.wear) === 0);
  if (unworn) return `아직 안 입어본 ${unworn.name}`;
  return `${toneLabel(items.map((x) => x.color))} 톤온톤`;
}

// ---- 진입점 ----

export interface BuildOptions {
  items: Item[];
  weather: WeatherLike;
  gender: Gender;
  /** 이 옷이 반드시 들어간 조합만 만든다(옷 상세용). 가방·액세서리면 빈 배열. */
  anchor?: Item;
}

/**
 * TPO 4종에 대해 각각 최적 조합을 만든다(총점 높은 순). 옷장이 비었으면 빈 배열.
 * 같은 조합·같은 상의가 여러 카드에 반복되지 않도록 결정적으로 눌러 카드마다 다르게 보인다.
 */
export function buildOutfits({ items, weather, gender, anchor }: BuildOptions): Outfit[] {
  const wearable = items.filter((x) => {
    const s = slotOfItem(x);
    return s !== "bag" && s !== "acc";
  });
  if (wearable.length === 0) return [];
  if (anchor) {
    const s = slotOfItem(anchor);
    if (s === "bag" || s === "acc") return [];
  }
  const pool = bySlot(wearable);
  const combos = enumerate(pool, gender, anchor);
  if (combos.length === 0) return [];

  const usedSigs = new Set<string>();
  const usedTops = new Set<string>();
  const outfits: Outfit[] = [];

  for (const tpo of TPOS) {
    let best: Scored | null = null;
    let bestSig = "";
    for (const slots of combos) {
      const sig = outfitSignature(slotItems(slots));
      const scored = scoreCombo(slots, tpo, weather, gender);
      let total = scored.total;
      if (usedSigs.has(sig)) total -= 40; // 이미 다른 카드가 쓴 조합
      const topId = (slots.top ?? slots.dress)?.id;
      if (topId && usedTops.has(topId)) total -= 6; // 같은 상의 반복은 살짝만 감점
      if (
        !best ||
        total > best.total ||
        (total === best.total && sig.localeCompare(bestSig) < 0) // 동점은 서명 순 — 결정적
      ) {
        best = { ...scored, total };
        bestSig = sig;
      }
    }
    if (!best) continue;
    usedSigs.add(bestSig);
    const topId = (best.slots.top ?? best.slots.dress)?.id;
    if (topId) usedTops.add(topId);
    const list = slotItems(best.slots);
    outfits.push({
      sig: bestSig,
      slots: best.slots,
      items: list,
      tpo,
      gender,
      scores: best.scores,
      total: best.total,
      title: buildTitle(best.slots, tpo, weather),
      desc: buildDesc(best.slots, weather),
      pill: buildPill(best.slots),
      rank: "",
      laundryCount: list.filter((x) => x.state === "laundry").length,
    });
  }

  // 총점 높은 순으로 카드 순서를 정하고 BEST MATCH 번호를 붙인다
  outfits.sort((a, b) => (b.total !== a.total ? b.total - a.total : a.sig.localeCompare(b.sig)));
  return outfits.map((o, i) => ({ ...o, rank: `BEST MATCH 0${i + 1}` }));
}

/** 날씨에 가장 잘 맞는 조합의 인덱스 — 사용자가 손대기 전 기본 선택 */
export function defaultOutfitIndex(outfits: Outfit[]): number {
  if (outfits.length === 0) return 0;
  let best = 0;
  for (let i = 1; i < outfits.length; i += 1) {
    if (outfits[i].scores.weather > outfits[best].scores.weather) best = i;
  }
  return best;
}

/** 특정 옷이 들어간 조합만 골라낸다(옷 상세 → '이 옷으로 만든 코디') */
export function outfitsWithItem(outfits: Outfit[], itemId: string): Outfit[] {
  return outfits.filter((o) => o.items.some((x) => x.id === itemId));
}

// ---- 착장 기록 ----

export interface OutfitLogEntry {
  sig: string;
  ids: string[];
  at: number;
  tpo: TpoKey;
  gender: Gender;
  title: string;
}

/** 기록에서 지금도 유효한(모든 옷이 옷장에 남아 있는) 항목만 남긴다 — 옷장을 비우면 기록도 정리된다 */
export function pruneLog(log: OutfitLogEntry[], items: Item[]): OutfitLogEntry[] {
  const live = new Set(items.map((x) => x.id));
  return log.filter((e) => e.ids.length > 0 && e.ids.every((id) => live.has(id)));
}

/** 로컬 날짜 키(YYYY-MM-DD) */
export const dayKey = (t: number | Date = Date.now()) =>
  new Date(t).toLocaleDateString("en-CA");

/**
 * '지난주 그 조합' 후보 — 오늘이 아닌 최근 기록 중 5~14일 전을 우선, 없으면 가장 최근.
 * 유효한 기록이 없으면 null(카드는 빈 상태를 보여준다).
 */
export function pickPastOutfit(log: OutfitLogEntry[], items: Item[], now = Date.now()): OutfitLogEntry | null {
  const valid = pruneLog(log, items).filter((e) => dayKey(e.at) !== dayKey(now));
  if (valid.length === 0) return null;
  const day = 86400000;
  const preferred = valid.filter((e) => {
    const d = (now - e.at) / day;
    return d >= 5 && d <= 14;
  });
  const pickFrom = preferred.length > 0 ? preferred : valid;
  return pickFrom.reduce((a, b) => (b.at > a.at ? b : a));
}

/** 오늘 이미 기록한 조합 서명 집합 */
export function wornTodaySigs(log: OutfitLogEntry[], now = Date.now()): Set<string> {
  return new Set(log.filter((e) => dayKey(e.at) === dayKey(now)).map((e) => e.sig));
}
