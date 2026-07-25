/**
 * 의류 아트·색 판정 테스트.
 * 차별점 검증:
 *  1) 옷 한 점은 그 옷만 담긴 이미지 한 장이 된다 — 종류를 이름에서 결정적으로 뽑는다
 *     ('티셔츠'가 '셔츠'를 포함해 칼라 달린 셔츠로 그려지던 버그가 회귀하지 않는지 포함)
 *  2) 색은 이름의 색 단어 → 모델 hex → 사진에서 잰 색 순으로 결정적으로 정해진다
 *  3) 그려낸 SVG 에 NaN·undefined 가 절대 없다(프로덕션 미니파이 사고 재발 방지와 같은 규칙)
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  colorFromWords,
  garmentArtDataUrl,
  garmentArtSvg,
  garmentKind,
  garmentPattern,
  isLongSleeve,
  kindSlot,
  normalizeHex,
  paletteOf,
  resolveColor,
} from "../lib/garment-art";
import { resolveCategory } from "../lib/garment";

const kindOf = (name: string) => garmentKind(name, resolveCategory(name));

test("이름의 종류 명사로 그림 종류가 결정된다", () => {
  assert.equal(kindOf("검정 반팔 티셔츠"), "tee");
  assert.equal(kindOf("흰색 반팔 티셔츠"), "tee");
  assert.equal(kindOf("티셔츠"), "tee");
  assert.equal(kindOf("긴팔 티셔츠"), "longtee");
  assert.equal(kindOf("흰색 셔츠"), "shirt");
  assert.equal(kindOf("검정 셔츠"), "shirt");
  assert.equal(kindOf("아이보리 케이블 니트"), "knit");
  assert.equal(kindOf("그레이 맨투맨"), "sweat");
  assert.equal(kindOf("검정 후드티"), "hoodie");
  assert.equal(kindOf("네이비 가디건"), "cardigan");
  assert.equal(kindOf("인디고 데님 자켓"), "jacket");
  assert.equal(kindOf("베이지 트렌치코트"), "coat");
  assert.equal(kindOf("검정 슬랙스"), "pants");
  assert.equal(kindOf("연청 청바지"), "jeans");
  assert.equal(kindOf("그레이 트레이닝 바지"), "jogger");
  assert.equal(kindOf("검정 반바지"), "shorts");
  assert.equal(kindOf("블랙 플리츠 스커트"), "skirt");
  assert.equal(kindOf("네이비 원피스"), "dress");
  assert.equal(kindOf("화이트 캔버스 스니커즈"), "sneakers");
  assert.equal(kindOf("탄 첼시 부츠"), "boots");
  assert.equal(kindOf("스웨이드 로퍼"), "loafers");
});

test("'티셔츠'가 '셔츠'로 오인되지 않는다(회귀)", () => {
  // '티셔츠'.includes('셔츠') 라서 순서를 잘못 두면 칼라·단추가 붙은 셔츠로 그려졌다
  for (const n of ["검정 반팔 티셔츠", "와인색 반팔 티셔츠", "네이비 반팔 티셔츠"]) {
    assert.equal(kindOf(n), "tee", n);
    assert.equal(isLongSleeve(kindOf(n), n), false, n);
  }
});

test("종류 → 마네킹 레이어 위치", () => {
  assert.equal(kindSlot("tee"), "top");
  assert.equal(kindSlot("knit"), "top");
  assert.equal(kindSlot("cardigan"), "outer"); // 니트로 분류돼도 겉에 입는다
  assert.equal(kindSlot("coat"), "outer");
  assert.equal(kindSlot("jeans"), "bottom");
  assert.equal(kindSlot("skirt"), "bottom");
  assert.equal(kindSlot("dress"), "dress");
  assert.equal(kindSlot("boots"), "shoe");
});

test("색 단어 사전 — 앞에 나온 색이 이긴다", () => {
  assert.equal(colorFromWords("검정 반팔 티셔츠"), "#23252a");
  assert.equal(colorFromWords("흰색 셔츠"), "#f3f1ec");
  assert.equal(colorFromWords("와인색 반팔 티셔츠"), "#6e2b38");
  assert.equal(colorFromWords("네이비 가디건"), "#26314e");
  assert.equal(colorFromWords("곤색 반팔티"), "#26314e"); // 사용자가 실제로 쓴 표현
  assert.equal(colorFromWords("연청 청바지"), "#9dbcd8"); // '연청'이 '청'보다 먼저
  assert.equal(colorFromWords("이름없음"), null);
  assert.equal(colorFromWords(undefined, ""), null);
});

test("색 우선순위: 이름 → 모델 hex → 사진에서 잰 색 → 카테고리 기본", () => {
  assert.equal(resolveColor({ name: "검정 반팔 티셔츠", hex: "#ff0000", sampled: "#00ff00" }), "#23252a");
  assert.equal(resolveColor({ name: "새 옷", hex: "#Ff0000", sampled: "#00ff00" }), "#ff0000");
  assert.equal(resolveColor({ name: "새 옷", sampled: "#00ff00" }), "#00ff00");
  assert.equal(resolveColor({ name: "새 옷", category: "하의" }), "#4a5361");
  assert.equal(normalizeHex("검정"), null);
  assert.equal(normalizeHex("#12345"), null);
  assert.equal(normalizeHex("#abc"), "#aabbcc"); // 3자리 축약형은 확장한다
});

test("패턴은 이름에서 결정적으로 나온다", () => {
  assert.equal(garmentPattern("회색 스트라이프 티셔츠", "tee"), "stripe");
  assert.equal(garmentPattern("체크 셔츠", "shirt"), "check");
  assert.equal(garmentPattern("연청 청바지", "jeans"), "denim");
  assert.equal(garmentPattern("아이보리 케이블 니트", "knit"), "cable");
  assert.equal(garmentPattern("로고 포인트 검정 반팔 티셔츠", "tee"), "graphic");
  assert.equal(garmentPattern("검정 반팔 티셔츠", "tee"), "solid");
});

const SAMPLES = [
  "검정 반팔 티셔츠", "흰색 셔츠", "아이보리 케이블 니트", "그레이 맨투맨", "검정 후드티",
  "네이비 가디건", "인디고 데님 자켓", "베이지 트렌치코트", "검정 패딩", "그레이 조끼",
  "검정 슬랙스", "연청 청바지", "그레이 트레이닝 바지", "검정 반바지", "블랙 플리츠 스커트",
  "네이비 원피스", "화이트 캔버스 스니커즈", "탄 첼시 부츠", "스웨이드 로퍼", "블랙 토트백",
];
const FITS = [undefined, "슬림", "레귤러", "오버핏", "와이드", "크롭", "테이퍼드", "루즈"];

test("모든 옷·핏 조합의 그림에 NaN·undefined 가 없다", () => {
  for (const name of SAMPLES) {
    const category = resolveCategory(name);
    const color = resolveColor({ name, category });
    for (const fit of FITS) {
      const svg = garmentArtSvg({ name, category, color, fit });
      assert.ok(!svg.includes("NaN"), `${name}/${fit}: NaN`);
      assert.ok(!svg.includes("undefined"), `${name}/${fit}: undefined`);
      assert.ok(!svg.includes("Infinity"), `${name}/${fit}: Infinity`);
      assert.ok(svg.startsWith("<svg") && svg.endsWith("</svg>"), name);
      // 옷은 한 점만 — 실루엣 채움 path 는 정확히 한 번 등장한다
      assert.equal((svg.match(/<rect width="200" height="200"/g) ?? []).length, 1, name);
    }
  }
});

test("그림은 결정적이고, 종류·색이 다르면 결과도 다르다", () => {
  const a = garmentArtSvg({ name: "검정 반팔 티셔츠", category: "상의", color: "#23252a" });
  const b = garmentArtSvg({ name: "검정 반팔 티셔츠", category: "상의", color: "#23252a" });
  const c = garmentArtSvg({ name: "흰색 반팔 티셔츠", category: "상의", color: "#f3f1ec" });
  const d = garmentArtSvg({ name: "검정 슬랙스", category: "하의", color: "#23252a" });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, d);
});

test("data URL 은 img src 로 바로 쓸 수 있다", () => {
  const url = garmentArtDataUrl({ name: "검정 반팔 티셔츠", category: "상의", color: "#23252a" });
  assert.ok(url.startsWith("data:image/svg+xml;charset=utf-8,"));
  assert.ok(!url.includes("#")); // 인코딩되지 않은 # 는 data URL 을 잘라먹는다
  assert.ok(decodeURIComponent(url.split(",")[1]).startsWith("<svg"));
});

test("어두운 색도 형태가 보이도록 팔레트를 만든다", () => {
  const dark = paletteOf("#101114");
  assert.notEqual(dark.base, dark.light);
  assert.notEqual(dark.base, dark.line);
  // 검정 계열은 밝은 쪽으로 음영을 만든다 — 어둡게만 하면 형태가 사라진다
  const lum = (h: string) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
  assert.ok(lum(dark.light) > lum(dark.base));
});

test("이름에 위험 문자가 있어도 SVG 가 깨지지 않는다", () => {
  const svg = garmentArtSvg({ name: '<script>&"위험"</script> 티셔츠', category: "상의", color: "#23252a" });
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("&lt;script&gt;"));
});
