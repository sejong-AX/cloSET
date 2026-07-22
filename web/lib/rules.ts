// 결정적 판정 엔진.
// cloSET 원칙: BUY / STOP / ALTERNATIVE, 중복 위험, 회당 비용(CPW)은 "코드"가 정한다.
// LLM 은 이 수치를 바꾸지 못하고 "표현(이유 문장)"만 담당한다.

export type Verdict = "STOP" | "BUY" | "ALTERNATIVE";
export type Family = "top" | "outer" | "bottom" | "shoes";

export interface SimilarItem {
  name: string;
  color: string;
  similarity: number;
}

export interface ScanFacts {
  category: string;
  family: Family;
  price: number;
  verdict: Verdict;
  duplicationRisk: number;
  ruleVersion: string;
  similar: SimilarItem[];
  expectedWears: number;
  expectedCpw: number;
  avgWearsSimilar: number;
  ownedCount: number;
}

const CLOSET: Record<
  Family,
  { owned: SimilarItem[]; dupBase: number; wears: number; avgWears: number }
> = {
  top: {
    owned: [
      { name: "블랙 울 니트", color: "#1d2221", similarity: 91 },
      { name: "차콜 오버 니트", color: "#363b39", similarity: 86 },
      { name: "베이지 코튼 니트", color: "#c6bda8", similarity: 72 },
    ],
    dupBase: 84,
    wears: 3,
    avgWears: 2,
  },
  outer: {
    owned: [
      { name: "베이지 트렌치코트", color: "#8f806f", similarity: 64 },
      { name: "브라운 울 코트", color: "#887b6d", similarity: 58 },
      { name: "네이비 블레이저", color: "#233d56", similarity: 41 },
    ],
    dupBase: 57,
    wears: 9,
    avgWears: 6,
  },
  bottom: {
    owned: [
      { name: "차콜 슬랙스", color: "#444b48", similarity: 38 },
      { name: "크림 와이드 팬츠", color: "#d2cabc", similarity: 33 },
    ],
    dupBase: 29,
    wears: 12,
    avgWears: 10,
  },
  shoes: {
    owned: [{ name: "스웨이드 로퍼", color: "#765c48", similarity: 22 }],
    dupBase: 18,
    wears: 14,
    avgWears: 11,
  },
};

export function categoryToFamily(category: string): Family {
  const c = category.trim();
  if (c.includes("아우터") || c.includes("코트") || c.includes("자켓") || c.includes("재킷"))
    return "outer";
  if (c.includes("하의") || c.includes("팬츠") || c.includes("슬랙스") || c.includes("스커트"))
    return "bottom";
  if (c.includes("신발") || c.includes("로퍼") || c.includes("스니커")) return "shoes";
  return "top";
}

export function parsePrice(raw: string | number): number {
  if (typeof raw === "number") return raw;
  const n = parseInt(String(raw).replace(/[^\d]/g, ""), 10);
  return isFinite(n) ? n : 0;
}

function verdictFromRisk(risk: number): Verdict {
  if (risk >= 70) return "STOP";
  if (risk >= 40) return "ALTERNATIVE";
  return "BUY";
}

export function evaluateScan(categoryRaw: string, priceRaw: string | number): ScanFacts {
  const family = categoryToFamily(categoryRaw);
  const price = parsePrice(priceRaw);
  const cfg = CLOSET[family];
  const duplicationRisk = cfg.dupBase;
  const verdict = verdictFromRisk(duplicationRisk);
  const expectedWears = cfg.wears;
  const expectedCpw = expectedWears > 0 ? Math.round(price / expectedWears) : price;
  return {
    category: categoryRaw,
    family,
    price,
    verdict,
    duplicationRisk,
    ruleVersion: "v2.1",
    similar: cfg.owned,
    expectedWears,
    expectedCpw,
    avgWearsSimilar: cfg.avgWears,
    ownedCount: cfg.owned.filter((s) => s.similarity >= 80).length || 1,
  };
}

// ---------------- Care Label AI ----------------

export type CareFamily = "wool" | "cotton" | "denim" | "leather" | "synthetic";

export interface CareFacts {
  material: string;
  family: CareFamily;
  title: string;
  tempC: number;
  symbols: string[];
  baseGuide: string;
}

const CARE: Record<CareFamily, Omit<CareFacts, "material" | "family">> = {
  wool: {
    title: "울 니트 안전 가이드",
    tempC: 30,
    symbols: ["30°", "×△", "—", "●"],
    baseGuide:
      "찬물에서 울 전용 세제로 손세탁하고 비틀어 짜지 마세요. 평평하게 눕혀 그늘에서 말리는 것이 좋아요.",
  },
  cotton: {
    title: "코튼 케어 가이드",
    tempC: 40,
    symbols: ["40°", "△", "▢", "●"],
    baseGuide:
      "미지근한 물에서 세탁하고 비슷한 색끼리 분류하세요. 직사광선은 변색을 부를 수 있어 그늘 건조를 권해요.",
  },
  denim: {
    title: "데님 케어 가이드",
    tempC: 30,
    symbols: ["30°", "×△", "—", "◐"],
    baseGuide:
      "뒤집어서 단독 세탁하고 물 빠짐을 줄이려면 찬물을 사용하세요. 자연 건조로 형태를 유지하는 것이 좋아요.",
  },
  leather: {
    title: "스웨이드·가죽 케어 가이드",
    tempC: 0,
    symbols: ["✋", "×○", "×△", "▤"],
    baseGuide:
      "물세탁 대신 전용 브러시로 결을 살려 관리하고, 젖으면 자연 건조 후 방수 스프레이를 뿌려 주세요.",
  },
  synthetic: {
    title: "합성 소재 케어 가이드",
    tempC: 30,
    symbols: ["30°", "△", "▢", "◐"],
    baseGuide:
      "찬물 약한 세탁으로 보풀을 줄이고, 고온 건조는 피하세요. 낮은 온도로 다림질하는 것이 안전해요.",
  },
};

export function materialToFamily(material: string): CareFamily {
  const m = material.toLowerCase();
  if (m.includes("울") || m.includes("니트") || m.includes("wool") || m.includes("캐시미어"))
    return "wool";
  if (m.includes("데님") || m.includes("denim") || m.includes("청")) return "denim";
  if (m.includes("가죽") || m.includes("스웨이드") || m.includes("leather")) return "leather";
  if (
    m.includes("폴리") ||
    m.includes("나일론") ||
    m.includes("아크릴") ||
    m.includes("synthetic")
  )
    return "synthetic";
  return "cotton";
}

export function evaluateCare(material: string): CareFacts {
  const family = materialToFamily(material);
  const base = CARE[family];
  return { material, family, ...base };
}
