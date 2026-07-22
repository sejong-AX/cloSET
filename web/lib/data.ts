export type ClothState = "available" | "laundry" | "stored" | "reuse";

export interface Item {
  name: string;
  cat: string;
  state: ClothState;
  label: string;
  bg: string;
  type: string;
  color: string;
  wear: string;
  cpw: string;
  img: string;
}

// 샘플 옷장 — mockup/index.html 의 items 배열 기반 시드 데이터 + 실제 옷 사진(Pexels, public/items)
export const initialItems: Item[] = [
  { name: "베이지 트렌치코트", cat: "아우터 · 옷장 1", state: "available", label: "입을 수 있음", bg: "#e9e0d3", type: "coat", color: "#8f806f", wear: "12회", cpw: "₩10,750", img: "/items/coat.jpg" },
  { name: "네이비 울 니트", cat: "상의 · 옷장 2", state: "laundry", label: "세탁 필요", bg: "#dfe7e8", type: "top-g", color: "#233d56", wear: "14회", cpw: "₩6,350", img: "/items/knit.jpg" },
  { name: "크림 와이드 팬츠", cat: "하의 · 옷장 1", state: "available", label: "입을 수 있음", bg: "#ede9df", type: "pants", color: "#d2cabc", wear: "9회", cpw: "₩7,650", img: "/items/pants.jpg" },
  { name: "브라운 울 코트", cat: "아우터 · 계절 보관함", state: "reuse", label: "순환 후보", bg: "#e5ded6", type: "coat", color: "#887b6d", wear: "8회", cpw: "₩43,000", img: "/items/coat.jpg" },
  { name: "블랙 오버핏 니트", cat: "상의 · 옷장 2", state: "available", label: "입을 수 있음", bg: "#dadfdd", type: "top-g", color: "#171c1a", wear: "4회", cpw: "₩19,750", img: "/items/knit2.jpg" },
  { name: "차콜 슬랙스", cat: "하의 · 옷장 1", state: "available", label: "입을 수 있음", bg: "#e2e5e3", type: "pants", color: "#444b48", wear: "18회", cpw: "₩5,200", img: "/items/pants.jpg" },
  { name: "스웨이드 로퍼", cat: "신발 · 신발장", state: "stored", label: "우천 제외", bg: "#eee5da", type: "shoe", color: "#765c48", wear: "11회", cpw: "₩9,800", img: "/items/shoe.jpg" },
  { name: "오프화이트 셔츠", cat: "상의 · 옷장 1", state: "laundry", label: "세탁 중", bg: "#eef0ec", type: "top-g", color: "#e7e5dc", wear: "22회", cpw: "₩3,120", img: "/items/shirt.jpg" },
];

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
