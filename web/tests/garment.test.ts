/**
 * 의류 분류 규칙 테스트 — api-rs/tests/rules_test.rs 의 TS 미러.
 * 차별점 검증: 카테고리·성별 적합도·보온/격식은 LLM 이 아니라 코드가 정한다.
 *
 * 실행: npm test  (node --test, tsx 로더)
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  categoryOfItem,
  formality,
  genderBias,
  hexToHsl,
  hueDistance,
  isNeutral,
  normalizeCategory,
  resolveCategory,
  slotOf,
  slotOfItem,
  toneLabel,
  warmth,
} from "../lib/garment";
import type { Item } from "../lib/data";

const item = (over: Partial<Item> & { name: string }): Item => ({
  id: "t",
  cat: "상의 · 옷장 1",
  state: "available",
  label: "입을 수 있음",
  bg: "#fff",
  type: "top-g",
  color: "#888888",
  wear: "0회",
  cpw: "—",
  img: "/x.jpg",
  daysAgo: 0,
  ...over,
});

// ---- 접힌 바지 오분류 회귀 (사용자 보고 결함) ----

test("옷걸이에 접힌 바지를 상의로 준 판정을 하의로 교정한다", () => {
  for (const name of ["검정 슬랙스", "접힌 검정 바지", "연청 청바지", "블랙 조거 팬츠", "회색 트레이닝 바지"]) {
    assert.equal(resolveCategory(name, "상의"), "하의", name);
  }
});

test("치마·반바지도 하의로 판정한다", () => {
  assert.equal(resolveCategory("플리츠 스커트", "상의"), "하의");
  assert.equal(resolveCategory("데님 반바지", "니트"), "하의");
});

test("역방향 — 셔츠를 하의로 준 판정도 교정한다", () => {
  assert.equal(resolveCategory("화이트 코튼 셔츠", "하의"), "상의");
  assert.equal(resolveCategory("회색 후드티", "하의"), "상의");
});

test("데님 자켓·카고 재킷은 하의로 끌려가지 않는다", () => {
  assert.equal(resolveCategory("인디고 데님 자켓", "상의"), "아우터");
  assert.equal(resolveCategory("카고 재킷", ""), "아우터");
  assert.equal(resolveCategory("트렌치코트", "상의"), "아우터");
});

test("가디건은 니트 카테고리지만 레이어는 겉옷이다", () => {
  assert.equal(resolveCategory("아이보리 케이블 가디건", ""), "니트");
  assert.equal(slotOf("아이보리 케이블 가디건", "니트"), "outer");
  assert.equal(slotOf("그레이 울 니트", "니트"), "top");
});

test("공백·대소문자를 무시한다", () => {
  assert.equal(resolveCategory("BLACK SLACKS", "상의"), "하의");
  assert.equal(resolveCategory("데님 팬 츠", "상의"), "하의");
});

test("이름에 단서가 없으면 모델 카테고리를 따른다", () => {
  assert.equal(resolveCategory("무언가", "하의"), "하의");
  assert.equal(normalizeCategory("패딩"), "아우터");
  assert.equal(normalizeCategory(""), "상의");
  assert.equal(normalizeCategory(undefined), "상의");
});

test("옷장 아이템의 cat 필드에서 슬롯을 읽는다", () => {
  assert.equal(slotOfItem(item({ name: "차콜 슬랙스", cat: "하의 · 옷장 1" })), "bottom");
  assert.equal(slotOfItem(item({ name: "스웨이드 로퍼", cat: "신발 · 신발장" })), "shoe");
  assert.equal(categoryOfItem(item({ name: "베이지 트렌치코트", cat: "아우터 · 옷장 1" })), "아우터");
});

// ---- 보온 · 격식 ----

test("보온력은 소재·종류 순서를 지킨다", () => {
  assert.ok(warmth("블랙 패딩") > warmth("울 니트"));
  assert.ok(warmth("울 니트") > warmth("코튼 셔츠"));
  assert.ok(warmth("코튼 셔츠") > warmth("린넨 반팔티"));
});

test("격식은 정장 > 셔츠 > 데님 > 후드 순이다", () => {
  assert.ok(formality("네이비 블레이저") > formality("화이트 셔츠"));
  assert.ok(formality("화이트 셔츠") > formality("인디고 데님 자켓"));
  assert.ok(formality("인디고 데님 자켓") > formality("회색 후드티"));
});

// ---- 성별 적합도 ----

test("남성 마네킹에서는 치마·원피스가 크게 감점된다", () => {
  assert.ok(genderBias("플리츠 스커트", "male") <= -50);
  assert.ok(genderBias("네이비 원피스", "male") <= -50);
  assert.ok(genderBias("플리츠 스커트", "female") > 0);
});

test("성별 중립 아이템은 두 성별에서 같은 보정치를 받는다", () => {
  assert.equal(genderBias("화이트 코튼 셔츠", "male"), genderBias("화이트 코튼 셔츠", "female"));
});

// ---- 색 ----

test("hex → HSL 파싱과 무채색 판정", () => {
  assert.equal(hexToHsl("nope"), null);
  assert.equal(hexToHsl(undefined), null);
  // 3자리 축약형은 확장해서 읽는다 (#bad = #bbaadd)
  assert.deepEqual(hexToHsl("#bad"), hexToHsl("#bbaadd"));
  const grey = hexToHsl("#888888")!;
  assert.equal(grey.s, 0);
  assert.ok(isNeutral(grey));
  assert.ok(!isNeutral(hexToHsl("#3a5573")));
});

test("hue 거리는 원형이다", () => {
  assert.equal(hueDistance(10, 350), 20);
  assert.equal(hueDistance(0, 180), 180);
});

test("톤 라벨은 대표 색에서 나온다", () => {
  assert.equal(toneLabel(["#3a5573"]), "데님 블루");
  assert.equal(toneLabel(["#888888", "#999999"]), "뉴트럴");
  assert.equal(toneLabel([]), "뉴트럴");
});
