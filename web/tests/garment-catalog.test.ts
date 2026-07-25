/**
 * 실제 사진 카탈로그 매칭 테스트.
 * 차별점 검증: 옷 한 점의 이미지는 "실제 단품 사진 우선, 없으면 비슷한 그림" 순서로 정해진다.
 *  1) 종류가 맞고 색이 가까우면 실제 사진을 고른다
 *  2) 밝기가 완전히 다른 색(검정 ↔ 아이보리)으로는 절대 매칭되지 않는다
 *  3) 종류가 다른 옷(셔츠 ↔ 청바지)끼리 섞이지 않는다
 *  4) 못 찾으면 null → 호출부가 그림을 만든다
 */

import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG, colorDistance, matchGarmentPhoto, type CatalogEntry } from "../lib/garment-catalog";
import { resolveColor } from "../lib/garment-art";
import { resolveCategory } from "../lib/garment";

const match = (name: string, catalog?: CatalogEntry[]) => {
  const category = resolveCategory(name);
  return matchGarmentPhoto({ name, category, color: resolveColor({ name, category }), catalog });
};

test("카탈로그 항목은 모두 단품 컷 경로와 색을 갖는다", () => {
  assert.ok(CATALOG.length > 0);
  for (const e of CATALOG) {
    assert.match(e.src, /^\/items\/.+\.(png|jpg)$/, e.src);
    assert.match(e.color, /^#[0-9a-f]{6}$/, `${e.src} 색 형식`);
  }
  // 같은 사진이 두 번 등록되면 매칭이 흔들린다
  assert.equal(new Set(CATALOG.map((e) => e.src)).size, CATALOG.length);
});

test("종류·색이 맞으면 실제 사진을 고른다", () => {
  assert.equal(match("아이보리 케이블 니트"), "/items/flat/knit-cream.png");
  assert.equal(match("아이보리 케이블 가디건"), "/items/flat/cardigan-ivory.png");
  assert.equal(match("그레이 리브드 가디건"), "/items/flat/cardigan-gray.png");
  // 청바지 사진은 여러 장이라 어느 것이든 청바지면 된다(가장 가까운 색이 뽑힌다)
  assert.match(String(match("인디고 슬림 진")), /jeans/);
});

test("밝기가 완전히 다른 색으로는 매칭하지 않는다", () => {
  // 검정 니트를 아이보리 니트 사진으로 대체하면 다른 옷이 된다
  const ivoryOnly = [{ src: "/items/flat/knit-cream.png", kind: "knit" as const, color: "#e4d8bd" }];
  assert.equal(match("검정 니트", ivoryOnly), null);
  assert.equal(match("검정 가디건"), null); // 검정 가디건 사진은 카탈로그에 없다
});

test("유채색 옷을 무채색 사진으로 대체하지 않는다", () => {
  // 와인색 티를 차콜 티 사진으로 바꾸면 색이 다른 옷이 된다 — 차라리 그림을 그린다
  assert.equal(match("와인색 반팔 티셔츠"), null);
  assert.equal(match("빨간 셔츠"), null);
});

test("종류가 다른 옷끼리 섞이지 않는다", () => {
  const only = [{ src: "/items/flat/jeans-blue.png", kind: "jeans" as const, color: "#154672" }];
  assert.equal(match("네이비 셔츠", only), null);
});

test("카탈로그에 없는 옷은 null — 호출부가 그림을 만든다", () => {
  assert.equal(match("와인색 반팔 티셔츠"), null); // 와인색 티 사진은 아직 없다
  assert.equal(match("형광 그린 후드티"), null);
  assert.equal(match("네이비 원피스"), null); // 원피스 사진 자체가 없다
});

test("색 거리는 대칭이고 같은 색이면 0", () => {
  assert.equal(colorDistance("#123456", "#123456"), 0);
  assert.equal(
    Math.round(colorDistance("#000000", "#ffffff")),
    Math.round(colorDistance("#ffffff", "#000000"))
  );
  assert.ok(colorDistance("#000000", "#111111") < colorDistance("#000000", "#eeeeee"));
});

test("매칭은 결정적이다 — 같은 입력이면 항상 같은 사진", () => {
  const a = match("아이보리 케이블 니트");
  for (let i = 0; i < 5; i += 1) assert.equal(match("아이보리 케이블 니트"), a);
});

test("사용자 옷장에 흔한 옷은 실제 사진으로 채워진다", () => {
  // 사용자가 올린 옷장 사진에서 실제로 인식된 이름들
  assert.equal(match("검정 반팔 티셔츠"), "/items/catalog/tee-black.png");
  assert.equal(match("차콜 반팔 티셔츠"), "/items/catalog/tee-charcoal.png");
  // 흰 셔츠는 후보 사진이 여러 장이라 어느 것이든 실제 사진이면 된다(가장 가까운 색이 뽑힌다)
  assert.match(String(match("흰색 셔츠")), /^\/items\/(catalog|flat)\/shirt-/);
  assert.equal(match("검정 슬랙스"), "/items/catalog/pants-black.png");
  assert.equal(match("검정 후드티"), "/items/catalog/hoodie-black.png");
  assert.equal(match("검정 맨투맨"), "/items/catalog/sweat-black.png");
});

test("카탈로그 사진 경로는 실제 파일과 이름이 맞아야 한다", () => {
  // 오타로 깨진 이미지가 배포되지 않게 — 경로 규칙만 검사(파일 존재는 빌드가 잡는다)
  for (const e of CATALOG) {
    assert.ok(e.src.startsWith("/items/catalog/") || e.src.startsWith("/items/flat/"), e.src);
  }
});
