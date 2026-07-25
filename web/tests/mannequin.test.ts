/**
 * 마네킹 기하 테스트.
 * 차별점 검증:
 *  1) 프로덕션에서 좌표가 깨진 사고(2026-07-25)가 회귀하지 않도록, 모든 착장 조합의 경로에
 *     NaN·undefined·Infinity 가 0건임을 브라우저 없이 확인한다
 *  2) 하의는 다리 두 짝으로 그려져 사이에 실제 틈이 남는다(치마처럼 보이던 문제)
 *  3) 아우터는 뒤판 + 좌·우 앞판으로 나뉘어, 가운데로 속 상의가 드러난다(열어 입은 레이어드)
 *  4) 상의 소매가 몸판과 따로 있어 팔을 감싼다(옷이 몸에서 떠 보이던 문제)
 */

import test from "node:test";
import assert from "node:assert/strict";
import { STATURE, anthro, armPath, buildOutfitPieces, footPath, legPath, neckPath, torsoPath } from "../lib/mannequin-geom";
import type { Item } from "../lib/data";
import { resolveCategory } from "../lib/garment";
import { resolveColor } from "../lib/garment-art";
import type { Gender } from "../lib/garment";

let seq = 0;
const mk = (name: string, cat: string, fit?: string): Item => {
  const category = resolveCategory(name, cat);
  return {
    id: `m-${seq++}`,
    name,
    cat: `${cat} · 옷장 1`,
    state: "available",
    label: "입을 수 있음",
    bg: "#eee",
    type: "top-g",
    color: resolveColor({ name, category }),
    wear: "2회",
    cpw: "₩9,000",
    img: "",
    daysAgo: 3,
    fit,
  };
};

const TOPS = ["검정 반팔 티셔츠", "흰색 셔츠", "아이보리 케이블 니트", "그레이 맨투맨", "검정 후드티"];
const OUTERS = ["네이비 가디건", "인디고 데님 자켓", "베이지 트렌치코트", "검정 패딩", "그레이 조끼"];
const BOTTOMS = ["검정 슬랙스", "연청 청바지", "그레이 트레이닝 바지", "검정 반바지", "블랙 플리츠 스커트"];
const SHOES = ["화이트 캔버스 스니커즈", "탄 첼시 부츠", "스웨이드 로퍼"];
const FITS = [undefined, "슬림", "레귤러", "오버핏", "와이드", "크롭", "테이퍼드", "루즈", "스트레이트"];
const GENDERS: Gender[] = ["female", "male"];

const bad = (d: string) => /NaN|undefined|Infinity/.test(d);

test("몸 실루엣 좌표에 NaN·undefined 가 없다", () => {
  for (const g of GENDERS) {
    const a = anthro(g);
    for (const d of [torsoPath(a), neckPath(a), legPath(a, -1), legPath(a, 1), footPath(a, -1), armPath(a, 1)]) {
      assert.ok(!bad(d), `${g}: ${d.slice(0, 60)}`);
    }
    assert.equal(a.H, STATURE[g]);
  }
});

test("모든 착장 조합의 옷 경로에 NaN·undefined 가 없다", () => {
  let checked = 0;
  for (const g of GENDERS) {
    for (const t of TOPS) {
      for (const b of BOTTOMS) {
        for (const o of [null, ...OUTERS]) {
          for (const fit of FITS) {
            const pieces = buildOutfitPieces(
              {
                top: mk(t, "상의", fit),
                bottom: mk(b, "하의", fit),
                outer: o ? mk(o, "아우터", fit) : undefined,
                shoe: mk(SHOES[checked % SHOES.length], "신발"),
              },
              g
            );
            for (const p of pieces) {
              assert.ok(!bad(p.d), `${g}/${t}/${b}/${o}/${fit} ${p.key}`);
              assert.ok(p.d.length > 20, `${p.key} 경로가 비었다`);
            }
            checked += 1;
          }
        }
      }
    }
  }
  assert.ok(checked >= 400, `조합 ${checked}건만 검사됐다`);
});

test("바지는 다리 두 짝으로 나뉘고 사이에 틈이 남는다", () => {
  const pieces = buildOutfitPieces({ bottom: mk("검정 슬랙스", "하의", "와이드") }, "female");
  const keys = pieces.map((p) => p.key);
  assert.ok(keys.includes("leg-l") && keys.includes("leg-r"), "다리 두 짝이 있어야 한다");
  // 두 짝의 x 좌표 범위가 중심(70)을 기준으로 갈라져 있어야 한다
  const xs = (d: string) => d.match(/-?\d+(\.\d+)?(?=,)/g)!.map(Number);
  const l = xs(pieces.find((p) => p.key === "leg-l")!.d);
  const r = xs(pieces.find((p) => p.key === "leg-r")!.d);
  assert.ok(Math.max(...l) <= 71, "왼쪽 다리가 중심을 넘어갔다");
  assert.ok(Math.min(...r) >= 69, "오른쪽 다리가 중심을 넘어갔다");
});

test("치마는 한 장으로, 다리 두 짝을 만들지 않는다", () => {
  const keys = buildOutfitPieces({ bottom: mk("블랙 플리츠 스커트", "하의") }, "female").map((p) => p.key);
  assert.ok(keys.includes("skirt"));
  assert.ok(!keys.includes("leg-l"));
});

test("아우터는 뒤판 + 좌우 앞판으로 나뉘어 가운데가 열린다", () => {
  const keys = buildOutfitPieces(
    { top: mk("흰색 셔츠", "상의"), outer: mk("네이비 가디건", "아우터"), bottom: mk("검정 슬랙스", "하의") },
    "male"
  ).map((p) => p.key);
  for (const k of ["outer-back", "outer-panel-l", "outer-panel-r", "outer-sleeve-l", "outer-collar"]) {
    assert.ok(keys.includes(k), `${k} 조각이 없다`);
  }
  // 속 상의가 아우터 앞판보다 먼저(아래에) 그려져야 가운데로 드러난다
  const order = (k: string) => keys.indexOf(k);
  assert.ok(order("top-body") < order("outer-panel-l"), "상의가 아우터 앞판 위에 그려진다");
});

test("조끼는 소매를 만들지 않는다", () => {
  const keys = buildOutfitPieces({ outer: mk("그레이 조끼", "아우터") }, "male").map((p) => p.key);
  assert.ok(keys.includes("outer-panel-l"));
  assert.ok(!keys.includes("outer-sleeve-l"));
});

test("상의는 몸판과 소매가 따로 있다(팔을 감싼다)", () => {
  const keys = buildOutfitPieces({ top: mk("아이보리 케이블 니트", "니트") }, "female").map((p) => p.key);
  assert.ok(keys.includes("top-body"));
  assert.ok(keys.includes("top-sleeve-l") && keys.includes("top-sleeve-r"));
});

test("셔츠는 칼라·앞단 조각이 붙는다", () => {
  const keys = buildOutfitPieces({ top: mk("흰색 셔츠", "상의") }, "male").map((p) => p.key);
  assert.ok(keys.includes("top-collar-l") && keys.includes("top-placket"));
  const teeKeys = buildOutfitPieces({ top: mk("검정 반팔 티셔츠", "상의") }, "male").map((p) => p.key);
  assert.ok(!teeKeys.includes("top-placket"), "티셔츠에 셔츠 앞단이 붙으면 안 된다");
});

test("옷이 없으면 조각도 없다 — 옷장을 비우면 마네킹만 남는다", () => {
  assert.deepEqual(buildOutfitPieces({}, "female"), []);
});

test("성별에 따라 같은 옷도 다른 치수로 그려진다", () => {
  const item = mk("검정 슬랙스", "하의");
  const f = buildOutfitPieces({ bottom: item }, "female").find((p) => p.key === "leg-l")!.d;
  const m = buildOutfitPieces({ bottom: item }, "male").find((p) => p.key === "leg-l")!.d;
  assert.notEqual(f, m);
});
