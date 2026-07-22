import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateScan,
  categoryToFamily,
  parsePrice,
  evaluateCare,
  materialToFamily,
} from "../lib/rules.ts";

// --- 차별점 검증: 판정(verdict)은 LLM 이 아니라 결정적 코드가 정한다 ---

test("니트/상의는 중복 위험이 높아 STOP 판정", () => {
  const f = evaluateScan("니트 · 상의", "79,000원");
  assert.equal(f.family, "top");
  assert.equal(f.verdict, "STOP");
  assert.ok(f.duplicationRisk >= 70, "STOP 은 중복 위험 70 이상이어야 한다");
});

test("아우터는 대체 가능 → ALTERNATIVE 판정", () => {
  const f = evaluateScan("아우터", "150,000원");
  assert.equal(f.family, "outer");
  assert.equal(f.verdict, "ALTERNATIVE");
  assert.ok(f.duplicationRisk >= 40 && f.duplicationRisk < 70);
});

test("하의는 옷장 공백 → BUY 판정", () => {
  const f = evaluateScan("하의", "60,000원");
  assert.equal(f.family, "bottom");
  assert.equal(f.verdict, "BUY");
  assert.ok(f.duplicationRisk < 40);
});

test("신발도 겹침이 적어 BUY 판정", () => {
  const f = evaluateScan("신발", "120,000원");
  assert.equal(f.family, "shoes");
  assert.equal(f.verdict, "BUY");
});

test("CPW 는 가격/예상착용으로 결정적으로 계산된다", () => {
  const f = evaluateScan("니트 · 상의", "90,000원");
  // 예상 착용 3회 → 30,000
  assert.equal(f.expectedWears, 3);
  assert.equal(f.expectedCpw, 30000);
});

test("가격 파싱은 콤마·원 표기를 숫자로 변환", () => {
  assert.equal(parsePrice("79,000원"), 79000);
  assert.equal(parsePrice("₩1,250,000"), 1250000);
  assert.equal(parsePrice(45000), 45000);
});

test("카테고리 → 패밀리 매핑", () => {
  assert.equal(categoryToFamily("니트 · 상의"), "top");
  assert.equal(categoryToFamily("아우터"), "outer");
  assert.equal(categoryToFamily("코트"), "outer");
  assert.equal(categoryToFamily("하의"), "bottom");
  assert.equal(categoryToFamily("신발"), "shoes");
});

// --- Care Label AI 결정적 매핑 ---

test("소재 → 케어 패밀리 매핑", () => {
  assert.equal(materialToFamily("네이비 울 니트"), "wool");
  assert.equal(materialToFamily("데님 팬츠"), "denim");
  assert.equal(materialToFamily("스웨이드 로퍼"), "leather");
  assert.equal(materialToFamily("폴리에스터 셔츠"), "synthetic");
  assert.equal(materialToFamily("코튼 티셔츠"), "cotton");
});

test("울 케어 가이드는 30도·손세탁 기준을 유지한다", () => {
  const c = evaluateCare("네이비 울 니트");
  assert.equal(c.family, "wool");
  assert.equal(c.tempC, 30);
  assert.equal(c.symbols.length, 4);
  assert.match(c.baseGuide, /손세탁|찬물/);
});
