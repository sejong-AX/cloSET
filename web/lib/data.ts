import { resolveCategory } from "./garment";
import { garmentArtDataUrl, resolveColor } from "./garment-art";
import { matchGarmentPhoto } from "./garment-catalog";

export type ClothState = "available" | "laundry" | "stored" | "reuse";

export interface Item {
  id: string;
  name: string;
  cat: string;
  state: ClothState;
  label: string;
  bg: string;
  type: string;
  color: string;
  wear: string;
  cpw: string;
  /** 옷장·마네킹에 보이는 이미지 — 옷 한 점만 담긴 그림(lib/garment-art) */
  img: string;
  daysAgo: number; // 마지막 착용일(안정값, 렌더 인덱스 아님)
  fit?: string; // 핏·실루엣(슬림·오버핏 등) — 색·종류가 비슷한 옷을 구분
  /** 등록에 쓴 원본 사진(품목 크롭) — 근거로만 보여준다. 목록 썸네일로는 쓰지 않는다 */
  photo?: string;
}

// 상태 → 라벨 매핑(케어 완료 등 상태 변경 시 라벨 일관성 유지)
export const STATE_LABEL: Record<ClothState, string> = {
  available: "입을 수 있음",
  laundry: "세탁 필요",
  stored: "보관",
  reuse: "순환 후보",
};

/** "12회" → 12. 숫자가 없으면 0. */
export const wearCount = (wear: string) => parseInt(wear.replace(/[^\d]/g, ""), 10) || 0;

/** 옷 이름으로 케어 방법 한 줄 안내(홈 케어 카드·케어 허브 공용) */
export const careNote = (name: string) => {
  if (/니트|울|캐시미어|스웨터|가디건/.test(name)) return "찬물 손세탁 권장";
  if (/데님|진|청/.test(name)) return "뒤집어 단독 세탁";
  if (/코트|트렌치|자켓|재킷|블레이저/.test(name)) return "부분 세탁·드라이 권장";
  if (/로퍼|부츠|신발|스니커/.test(name)) return "전용 클리너 관리";
  return "일반 세탁 가능";
};

/** 휴지통 항목 — 삭제된 옷과 삭제 시각(복원 기능용) */
export interface TrashEntry {
  item: Item;
  deletedAt: number;
}

/** 받침 유무에 맞는 목적격 조사: 니트→를, 가디건→을. 한글이 아니면 '을(를)'. */
export const objectParticle = (word: string) => {
  const code = word.charCodeAt(word.length - 1);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 ? "을" : "를";
  return "을(를)";
};

/** 방향격 조사: 당근→으로, 아름다운가게→로 (받침 ㄹ은 '로'). 한글이 아니면 '(으)로'. */
export const directionParticle = (word: string) => {
  const code = word.charCodeAt(word.length - 1);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return jong === 0 || jong === 8 ? "로" : "으로";
  }
  return "(으)로";
};

// 샘플 옷장 — mockup/index.html 의 items 배열 기반 시드 데이터 + 실제 옷 사진(Pexels, public/items)
const SEED: Omit<Item, "id" | "daysAgo">[] = [
  { name: "베이지 트렌치코트", cat: "아우터 · 옷장 1", state: "available", label: "입을 수 있음", bg: "#e9e0d3", type: "coat", color: "#8f806f", wear: "12회", cpw: "₩10,750", img: "/items/coat.jpg" },
  { name: "그레이 울 니트", cat: "상의 · 옷장 2", state: "laundry", label: "세탁 필요", bg: "#dfe7e8", type: "top-g", color: "#8a8478", wear: "14회", cpw: "₩6,350", img: "/items/knit.jpg" },
  { name: "크림 와이드 팬츠", cat: "하의 · 옷장 1", state: "available", label: "입을 수 있음", bg: "#ede9df", type: "pants", color: "#d2cabc", wear: "9회", cpw: "₩7,650", img: "/items/pants.jpg" },
  { name: "브라운 울 코트", cat: "아우터 · 계절 보관함", state: "reuse", label: "순환 후보", bg: "#e5ded6", type: "coat", color: "#887b6d", wear: "8회", cpw: "₩43,000", img: "/items/coat-brown.jpg" },
  { name: "그레이 스페클 니트", cat: "상의 · 옷장 2", state: "available", label: "입을 수 있음", bg: "#dadfdd", type: "top-g", color: "#8a8f8c", wear: "4회", cpw: "₩19,750", img: "/items/knit-speckle.jpg" },
  { name: "차콜 슬랙스", cat: "하의 · 옷장 1", state: "available", label: "입을 수 있음", bg: "#e2e5e3", type: "pants", color: "#444b48", wear: "18회", cpw: "₩5,200", img: "/items/slacks-gray.jpg" },
  { name: "스웨이드 로퍼", cat: "신발 · 신발장", state: "stored", label: "우천 제외", bg: "#eee5da", type: "shoe", color: "#765c48", wear: "11회", cpw: "₩9,800", img: "/items/shoe.jpg" },
  { name: "오프화이트 셔츠", cat: "상의 · 옷장 1", state: "laundry", label: "세탁 중", bg: "#eef0ec", type: "top-g", color: "#e7e5dc", wear: "22회", cpw: "₩3,120", img: "/items/shirt.jpg" },
  // 예시 옷 15종 추가 (실제 옷 사진)
  { name: "아이보리 케이블 니트", cat: "상의 · 옷장 2", state: "available", label: "입을 수 있음", bg: "#efe9dd", type: "top-g", color: "#e8ddc8", wear: "7회", cpw: "₩8,300", img: "/items/knit-cream.jpg" },
  { name: "브라운 울 스웨터", cat: "상의 · 옷장 2", state: "available", label: "입을 수 있음", bg: "#e6ddd0", type: "top-g", color: "#8a6b4f", wear: "5회", cpw: "₩12,400", img: "/items/knit-brown.jpg" },
  { name: "오트밀 라운드 니트", cat: "상의 · 옷장 2", state: "laundry", label: "세탁 필요", bg: "#ece7db", type: "top-g", color: "#cbbfa6", wear: "9회", cpw: "₩6,900", img: "/items/knit-tan.jpg" },
  { name: "아이보리 케이블 가디건", cat: "아우터 · 옷장 1", state: "available", label: "입을 수 있음", bg: "#efe9de", type: "coat", color: "#e3d8c2", wear: "6회", cpw: "₩11,200", img: "/items/cardigan-ivory.jpg" },
  { name: "그레이 리브드 가디건", cat: "아우터 · 옷장 1", state: "available", label: "입을 수 있음", bg: "#e4e6e4", type: "coat", color: "#a9adaa", wear: "10회", cpw: "₩7,500", img: "/items/cardigan-gray.jpg" },
  { name: "인디고 데님 자켓", cat: "아우터 · 옷장 1", state: "available", label: "입을 수 있음", bg: "#dbe0e6", type: "coat", color: "#3a5573", wear: "13회", cpw: "₩6,100", img: "/items/denim-jacket.jpg" },
  { name: "인디고 슬림 진", cat: "하의 · 옷장 1", state: "available", label: "입을 수 있음", bg: "#dbe0e6", type: "pants", color: "#33455c", wear: "20회", cpw: "₩4,200", img: "/items/jeans-blue.jpg" },
  { name: "라이트 워시 데님", cat: "하의 · 옷장 1", state: "laundry", label: "세탁 중", bg: "#e2e7ec", type: "pants", color: "#6b83a0", wear: "15회", cpw: "₩5,300", img: "/items/jeans-light.jpg" },
  { name: "화이트 코튼 셔츠", cat: "상의 · 옷장 1", state: "available", label: "입을 수 있음", bg: "#eef0ec", type: "top-g", color: "#f2f0ea", wear: "18회", cpw: "₩3,600", img: "/items/shirt-white.jpg" },
  { name: "오트밀 린넨 셔츠", cat: "상의 · 옷장 1", state: "available", label: "입을 수 있음", bg: "#ece7db", type: "top-g", color: "#d9cdb4", wear: "8회", cpw: "₩7,800", img: "/items/shirt-oatmeal.jpg" },
  { name: "레드 스트라이프 셔츠", cat: "상의 · 옷장 2", state: "stored", label: "보관", bg: "#efe6e2", type: "top-g", color: "#b24a44", wear: "4회", cpw: "₩14,500", img: "/items/shirt-stripe.jpg" },
  { name: "화이트 캔버스 스니커즈", cat: "신발 · 신발장", state: "available", label: "입을 수 있음", bg: "#eceae4", type: "shoe", color: "#e9e6df", wear: "16회", cpw: "₩5,900", img: "/items/sneakers-white.jpg" },
  { name: "블랙 로우 스니커즈", cat: "신발 · 신발장", state: "available", label: "입을 수 있음", bg: "#e4e4e2", type: "shoe", color: "#20232a", wear: "12회", cpw: "₩7,100", img: "/items/sneakers-black.jpg" },
  { name: "탄 첼시 부츠", cat: "신발 · 신발장", state: "stored", label: "우천 제외", bg: "#e9ddd0", type: "shoe", color: "#c99a75", wear: "9회", cpw: "₩13,800", img: "/items/boots-chelsea.jpg" },
  { name: "카멜 오버 니트", cat: "상의 · 계절 보관함", state: "reuse", label: "순환 후보", bg: "#e6ddcf", type: "top-g", color: "#a07b52", wear: "3회", cpw: "₩24,000", img: "/items/knit-camel.jpg" },
];

/**
 * 시드 옷장도 '옷 한 점 = 이미지 한 장' 규칙을 따른다.
 * 원래 시드 사진 일부는 여러 벌을 함께 찍은 플랫레이라 목록 썸네일로 쓸 수 없어서,
 * 종류·색이 맞는 단품 사진(카탈로그)을 찾고 없으면 비슷한 그림을 만든다. 원본은 photo 로 남긴다.
 */
export const initialItems: Item[] = SEED.map((it, i) => {
  const category = resolveCategory(it.name, it.cat.split("·")[0]?.trim());
  const color = resolveColor({ name: it.name, hex: it.color, category });
  const photo = matchGarmentPhoto({ name: it.name, category, color });
  return {
    ...it,
    color,
    img: photo ?? garmentArtDataUrl({ name: it.name, category, color, fit: it.fit }),
    photo: it.img,
    id: `seed-${i}`,
    daysAgo: 1 + ((i * 5 + 2) % 40), // 결정적·안정적인 마지막 착용일
  };
});

export type ViewName = "home" | "closet" | "scan" | "care" | "reuse" | "insights" | "settings";

export const viewTitles: Record<ViewName, string> = {
  home: "오늘의 착장",
  closet: "내 옷장",
  scan: "Snap & Check",
  care: "케어",
  reuse: "순환하기",
  insights: "지출·탄소",
  settings: "설정",
};
