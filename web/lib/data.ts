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
  // 예시 옷 15종 추가 (실제 옷 사진)
  { name: "아이보리 케이블 니트", cat: "상의 · 옷장 2", state: "available", label: "입을 수 있음", bg: "#efe9dd", type: "top-g", color: "#e8ddc8", wear: "7회", cpw: "₩8,300", img: "/items/knit-cream.jpg" },
  { name: "브라운 울 스웨터", cat: "상의 · 옷장 2", state: "available", label: "입을 수 있음", bg: "#e6ddd0", type: "top-g", color: "#8a6b4f", wear: "5회", cpw: "₩12,400", img: "/items/knit-brown.jpg" },
  { name: "오트밀 라운드 니트", cat: "상의 · 옷장 2", state: "laundry", label: "세탁 필요", bg: "#ece7db", type: "top-g", color: "#cbbfa6", wear: "9회", cpw: "₩6,900", img: "/items/knit-tan.jpg" },
  { name: "아이보리 케이블 가디건", cat: "아우터 · 옷장 1", state: "available", label: "입을 수 있음", bg: "#efe9de", type: "coat", color: "#e3d8c2", wear: "6회", cpw: "₩11,200", img: "/items/cardigan-ivory.jpg" },
  { name: "그레이 리브드 가디건", cat: "아우터 · 옷장 1", state: "available", label: "입을 수 있음", bg: "#e4e6e4", type: "coat", color: "#a9adaa", wear: "10회", cpw: "₩7,500", img: "/items/cardigan-gray.jpg" },
  { name: "인디고 데님 자켓", cat: "아우터 · 옷장 1", state: "available", label: "입을 수 있음", bg: "#dbe0e6", type: "coat", color: "#3a5573", wear: "13회", cpw: "₩6,100", img: "/items/denim-jacket.jpg" },
  { name: "인디고 슬림 진", cat: "하의 · 옷장 1", state: "available", label: "입을 수 있음", bg: "#dbe0e6", type: "pants", color: "#33455c", wear: "20회", cpw: "₩4,200", img: "/items/jeans-blue.jpg" },
  { name: "라이트 워시 데님", cat: "하의 · 옷장 1", state: "laundry", label: "세탁 중", bg: "#e2e7ec", type: "pants", color: "#6b83a0", wear: "15회", cpw: "₩5,300", img: "/items/jeans-blue.jpg" },
  { name: "화이트 코튼 셔츠", cat: "상의 · 옷장 1", state: "available", label: "입을 수 있음", bg: "#eef0ec", type: "top-g", color: "#f2f0ea", wear: "18회", cpw: "₩3,600", img: "/items/shirt-white.jpg" },
  { name: "오트밀 린넨 셔츠", cat: "상의 · 옷장 1", state: "available", label: "입을 수 있음", bg: "#ece7db", type: "top-g", color: "#d9cdb4", wear: "8회", cpw: "₩7,800", img: "/items/shirt-oatmeal.jpg" },
  { name: "레드 스트라이프 셔츠", cat: "상의 · 옷장 2", state: "stored", label: "보관", bg: "#efe6e2", type: "top-g", color: "#b24a44", wear: "4회", cpw: "₩14,500", img: "/items/shirt-stripe.jpg" },
  { name: "화이트 캔버스 스니커즈", cat: "신발 · 신발장", state: "available", label: "입을 수 있음", bg: "#eceae4", type: "shoe", color: "#e9e6df", wear: "16회", cpw: "₩5,900", img: "/items/sneakers-white.jpg" },
  { name: "블랙 로우 스니커즈", cat: "신발 · 신발장", state: "available", label: "입을 수 있음", bg: "#e4e4e2", type: "shoe", color: "#20232a", wear: "12회", cpw: "₩7,100", img: "/items/sneakers-black.jpg" },
  { name: "탄 첼시 부츠", cat: "신발 · 신발장", state: "stored", label: "우천 제외", bg: "#e9ddd0", type: "shoe", color: "#c99a75", wear: "9회", cpw: "₩13,800", img: "/items/boots-chelsea.jpg" },
  { name: "카멜 오버 니트", cat: "상의 · 계절 보관함", state: "reuse", label: "순환 후보", bg: "#e6ddcf", type: "top-g", color: "#a07b52", wear: "3회", cpw: "₩24,000", img: "/items/knit-brown.jpg" },
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
