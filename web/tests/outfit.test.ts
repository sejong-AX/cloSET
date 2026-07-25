/**
 * 착장 추천 엔진 테스트.
 * 차별점 검증:
 *  1) 추천은 실제 옷장에서만 나온다(하드코딩 예시 없음) → 옷장을 비우면 추천도 빈다
 *  2) 같은 입력이면 항상 같은 결과 (모델 무관 결정성)
 *  3) 성별에 따라 조합이 갈린다 (남성 마네킹은 치마·원피스를 피한다)
 *  4) 착장 기록은 옷장에서 사라진 옷을 담은 항목을 스스로 정리한다
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  TPOS,
  buildOutfitVariants,
  buildOutfits,
  colorScore,
  dayKey,
  defaultOutfitIndex,
  outfitSignature,
  outfitsWithItem,
  pickPastOutfit,
  pruneLog,
  warmthTarget,
  weatherScore,
  wornTodaySigs,
  type OutfitLogEntry,
} from "../lib/outfit";
import type { Item } from "../lib/data";

let seq = 0;
const mk = (name: string, cat: string, over: Partial<Item> = {}): Item => ({
  id: `i-${seq++}`,
  name,
  cat,
  state: "available",
  label: "입을 수 있음",
  bg: "#eee",
  type: "top-g",
  color: "#8a8478",
  wear: "3회",
  cpw: "₩9,000",
  img: `/items/${name}.jpg`,
  daysAgo: 5,
  ...over,
});

const closet = (): Item[] => {
  seq = 0;
  return [
    mk("화이트 코튼 셔츠", "상의 · 옷장 1", { color: "#f2f0ea" }),
    mk("그레이 울 니트", "상의 · 옷장 2", { color: "#8a8478" }),
    mk("차콜 슬랙스", "하의 · 옷장 1", { color: "#444b48", fit: "스트레이트" }),
    mk("인디고 슬림 진", "하의 · 옷장 1", { color: "#33455c", fit: "슬림" }),
    mk("베이지 트렌치코트", "아우터 · 옷장 1", { color: "#8f806f" }),
    mk("스웨이드 로퍼", "신발 · 신발장", { color: "#765c48" }),
  ];
};

const weather = { apparent: 20, precip: 10 };

// ---- 1) 실옷장 기반 · 빈 옷장 처리 ----

test("옷장이 비면 추천도 빈다 (하드코딩 예시 조합이 남지 않는다)", () => {
  assert.deepEqual(buildOutfits({ items: [], weather, gender: "female" }), []);
});

test("상의만 있으면 상의 중심 조합이라도 만든다", () => {
  const out = buildOutfits({
    items: [mk("화이트 코튼 셔츠", "상의 · 옷장 1")],
    weather,
    gender: "female",
  });
  assert.ok(out.length > 0);
  assert.equal(out[0].slots.top?.name, "화이트 코튼 셔츠");
  assert.equal(out[0].slots.bottom, undefined);
});

test("추천에 쓰인 옷은 모두 옷장에 있는 옷이다", () => {
  const items = closet();
  const ids = new Set(items.map((x) => x.id));
  for (const o of buildOutfits({ items, weather, gender: "female" })) {
    for (const x of o.items) assert.ok(ids.has(x.id), `${x.name} 은 옷장에 없다`);
  }
});

test("가방·액세서리는 착장 슬롯에 들어가지 않는다", () => {
  const items = [...closet(), mk("블랙 백팩", "가방 · 옷장 1"), mk("검정 볼캡", "액세서리 · 옷장 1")];
  for (const o of buildOutfits({ items, weather, gender: "female" })) {
    for (const x of o.items) {
      assert.ok(!x.name.includes("백팩") && !x.name.includes("볼캡"));
    }
  }
});

// ---- 2) 결정성 ----

test("같은 입력이면 같은 조합·같은 점수가 나온다", () => {
  const a = buildOutfits({ items: closet(), weather, gender: "female" });
  const b = buildOutfits({ items: closet(), weather, gender: "female" });
  assert.equal(a.length, b.length);
  a.forEach((o, i) => {
    assert.equal(o.sig, b[i].sig);
    assert.deepEqual(o.scores, b[i].scores);
    assert.equal(o.title, b[i].title);
  });
});

test("조합 서명은 순서에 무관하다", () => {
  const items = closet();
  assert.equal(
    outfitSignature([items[0], items[2]]),
    outfitSignature([items[2], items[0]])
  );
  assert.equal(outfitSignature([items[0], undefined]), items[0].id);
});

test("TPO 4종에 대해 서로 다른 조합을 내놓는다", () => {
  const out = buildOutfits({ items: closet(), weather, gender: "female" });
  assert.equal(out.length, 4);
  assert.equal(new Set(out.map((o) => o.tpo.key)).size, 4);
  assert.ok(new Set(out.map((o) => o.sig)).size > 1, "네 카드가 모두 같은 조합이면 안 된다");
});

// ---- 3) 성별 분기 ----

test("남성 추천은 치마를 고르지 않는다(대안이 있을 때)", () => {
  const items = [...closet(), mk("플리츠 스커트", "하의 · 옷장 2", { color: "#c8a9a0" })];
  for (const o of buildOutfits({ items, weather, gender: "male" })) {
    assert.ok(!o.items.some((x) => x.name.includes("스커트")), o.title);
  }
});

test("여성 옷장에서는 치마 조합이 후보로 살아난다", () => {
  const items = [...closet(), mk("플리츠 스커트", "하의 · 옷장 2", { color: "#c8a9a0" })];
  const f = buildOutfits({ items, weather, gender: "female" });
  assert.ok(f.some((o) => o.items.some((x) => x.name.includes("스커트"))));
});

test("성별이 바뀌면 조합이 달라질 수 있고, 같을 수도 있다", () => {
  const items = [...closet(), mk("플리츠 스커트", "하의 · 옷장 2"), mk("네이비 원피스", "원피스 · 옷장 2")];
  const f = buildOutfits({ items, weather, gender: "female" });
  const m = buildOutfits({ items, weather, gender: "male" });
  const same = f.filter((o) => m.some((x) => x.tpo.key === o.tpo.key && x.sig === o.sig)).length;
  assert.ok(same < f.length, "여성·남성 추천이 전부 동일하면 성별 분기가 동작하지 않는 것");
});

test("남성 마네킹도 원피스만 있는 옷장에서는 무언가를 보여준다", () => {
  const out = buildOutfits({
    items: [mk("네이비 원피스", "원피스 · 옷장 1"), mk("스웨이드 로퍼", "신발 · 신발장")],
    weather,
    gender: "male",
  });
  assert.ok(out.length > 0);
  assert.ok(out[0].items.length > 0);
});

// ---- 점수 ----

test("기온이 낮을수록 필요한 보온력이 커진다", () => {
  assert.ok(warmthTarget(0) > warmthTarget(15));
  assert.ok(warmthTarget(15) > warmthTarget(30));
  assert.ok(warmthTarget(40) >= 1 && warmthTarget(-20) <= 10);
});

test("더운 날엔 가벼운 조합이, 추운 날엔 두꺼운 조합이 높은 날씨 점수를 받는다", () => {
  const light = { top: mk("린넨 반팔티", "상의 · 옷장 1"), bottom: mk("데님 반바지", "하의 · 옷장 1") };
  const heavy = {
    outer: mk("블랙 패딩", "아우터 · 옷장 1"),
    top: mk("울 니트", "상의 · 옷장 2"),
    bottom: mk("기모 슬랙스", "하의 · 옷장 1"),
  };
  const hot = { apparent: 30, precip: 0 };
  const cold = { apparent: 0, precip: 0 };
  assert.ok(weatherScore(light, hot) > weatherScore(heavy, hot));
  assert.ok(weatherScore(heavy, cold) > weatherScore(light, cold));
});

test("색 점수는 뉴트럴·포인트 하나를 선호하고 다색을 감점한다", () => {
  const grey = mk("그레이 니트", "상의 · 옷장 1", { color: "#8a8a8a" });
  const grey2 = mk("차콜 슬랙스", "하의 · 옷장 1", { color: "#3a3a3a" });
  const red = mk("레드 셔츠", "상의 · 옷장 1", { color: "#b24a44" });
  const blue = mk("블루 팬츠", "하의 · 옷장 1", { color: "#33455c" });
  const green = mk("그린 코트", "아우터 · 옷장 1", { color: "#4a7a44" });
  assert.ok(colorScore({ top: grey, bottom: grey2 }) >= 90);
  assert.ok(colorScore({ top: red, bottom: grey2 }) >= 90);
  assert.ok(colorScore({ top: red, bottom: blue, outer: green }) < 70);
});

test("날씨 점수가 가장 높은 조합이 기본 선택된다", () => {
  const out = buildOutfits({ items: closet(), weather, gender: "female" });
  const idx = defaultOutfitIndex(out);
  const best = Math.max(...out.map((o) => o.scores.weather));
  assert.equal(out[idx].scores.weather, best);
  assert.equal(defaultOutfitIndex([]), 0);
});

test("세탁 대기 중인 옷이 섞이면 개수를 알려준다", () => {
  const items = closet().map((x) =>
    x.name === "차콜 슬랙스" ? { ...x, state: "laundry" as const, label: "세탁 필요" } : x
  );
  const out = buildOutfits({ items, weather, gender: "female" });
  for (const o of out) {
    assert.equal(o.laundryCount, o.items.filter((x) => x.state === "laundry").length);
  }
});

test("특정 옷이 들어간 조합만 골라낸다", () => {
  const items = closet();
  const out = buildOutfits({ items, weather, gender: "female" });
  const target = items[0];
  const filtered = outfitsWithItem(out, target.id);
  for (const o of filtered) assert.ok(o.items.some((x) => x.id === target.id));
});

test("설명 문구에 실제 옷 이름이 들어간다", () => {
  const out = buildOutfits({ items: closet(), weather, gender: "female" });
  const o = out[0];
  const first = o.slots.top ?? o.slots.dress ?? o.slots.bottom!;
  assert.ok(o.desc.includes(first.name), o.desc);
  assert.ok(o.title.length > 0 && o.pill.length > 0);
});

// ---- 4) 착장 기록 ----

const day = 86400000;

test("옷장에서 사라진 옷이 섞인 기록은 정리된다", () => {
  const items = closet();
  const log: OutfitLogEntry[] = [
    { sig: "a", ids: [items[0].id, items[2].id], at: Date.now() - 3 * day, tpo: "work", gender: "female", title: "A" },
    { sig: "b", ids: ["gone-1"], at: Date.now() - 2 * day, tpo: "casual", gender: "female", title: "B" },
    { sig: "c", ids: [], at: Date.now() - day, tpo: "home", gender: "female", title: "C" },
  ];
  const kept = pruneLog(log, items);
  assert.deepEqual(kept.map((e) => e.sig), ["a"]);
  assert.deepEqual(pruneLog(log, []), []);
});

test("지난주 그 조합은 5~14일 전 기록을 우선한다", () => {
  const items = closet();
  const ids = [items[0].id];
  const now = Date.now();
  const log: OutfitLogEntry[] = [
    { sig: "yesterday", ids, at: now - day, tpo: "work", gender: "female", title: "어제" },
    { sig: "lastweek", ids, at: now - 7 * day, tpo: "work", gender: "female", title: "지난주" },
    { sig: "old", ids, at: now - 40 * day, tpo: "work", gender: "female", title: "옛날" },
  ];
  assert.equal(pickPastOutfit(log, items, now)?.sig, "lastweek");
});

test("오늘 기록만 있으면 지난주 조합은 없다", () => {
  const items = closet();
  const log: OutfitLogEntry[] = [
    { sig: "today", ids: [items[0].id], at: Date.now(), tpo: "work", gender: "female", title: "오늘" },
  ];
  assert.equal(pickPastOutfit(log, items), null);
});

test("5~14일 구간이 없으면 가장 최근 기록을 쓴다", () => {
  const items = closet();
  const now = Date.now();
  const log: OutfitLogEntry[] = [
    { sig: "old", ids: [items[0].id], at: now - 40 * day, tpo: "work", gender: "female", title: "옛날" },
    { sig: "yesterday", ids: [items[0].id], at: now - day, tpo: "work", gender: "female", title: "어제" },
  ];
  assert.equal(pickPastOutfit(log, items, now)?.sig, "yesterday");
});

test("오늘 입은 조합 서명 집합은 오늘 기록만 담는다", () => {
  const now = Date.now();
  const log: OutfitLogEntry[] = [
    { sig: "t", ids: ["x"], at: now, tpo: "work", gender: "female", title: "오늘" },
    { sig: "y", ids: ["x"], at: now - 2 * day, tpo: "work", gender: "female", title: "그제" },
  ];
  const sigs = wornTodaySigs(log, now);
  assert.ok(sigs.has("t"));
  assert.ok(!sigs.has("y"));
});

test("날짜 키는 로컬 기준 YYYY-MM-DD", () => {
  assert.match(dayKey(), /^\d{4}-\d{2}-\d{2}$/);
});

// ---- 앵커(옷 상세의 '이 옷으로 만든 코디') ----

test("앵커로 지정한 옷은 모든 조합에 들어간다", () => {
  const items = closet();
  for (const anchor of items) {
    const out = buildOutfits({ items, weather, gender: "female", anchor });
    assert.ok(out.length > 0, `${anchor.name} 조합이 없다`);
    for (const o of out) {
      assert.ok(o.items.some((x) => x.id === anchor.id), `${anchor.name} 이 빠진 조합: ${o.title}`);
    }
  }
});

test("가방·액세서리를 앵커로 주면 조합을 만들지 않는다", () => {
  const items = closet();
  const bag = mk("블랙 백팩", "가방 · 옷장 1");
  assert.deepEqual(buildOutfits({ items: [...items, bag], weather, gender: "female", anchor: bag }), []);
});

test("원피스를 앵커로 주면 상의·하의 조합이 아니라 원피스 착장이 나온다", () => {
  const dress = mk("네이비 원피스", "원피스 · 옷장 2");
  const out = buildOutfits({ items: [...closet(), dress], weather, gender: "female", anchor: dress });
  assert.ok(out.length > 0);
  for (const o of out) {
    assert.equal(o.slots.dress?.id, dress.id);
    assert.equal(o.slots.top, undefined);
  }
});

// ---- 6) '다른 조합' — 내 옷장 옷으로 매번 실제 다른 조합을 짠다 ----

test("다른 조합은 서로 다른 착장이고, 전부 내 옷장 옷으로만 만들어진다", () => {
  const items = closet();
  const ids = new Set(items.map((x) => x.id));
  const variants = buildOutfitVariants({ items, weather, gender: "female", tpo: TPOS[1], limit: 6 });
  assert.ok(variants.length >= 3, `조합이 ${variants.length}개뿐`);
  // 서명이 전부 달라야 '다른 조합'이다
  assert.equal(new Set(variants.map((o) => o.sig)).size, variants.length);
  for (const o of variants) {
    assert.ok(o.items.length > 0);
    for (const x of o.items) assert.ok(ids.has(x.id), `옷장에 없는 옷: ${x.name}`);
  }
});

test("연속한 두 조합은 최소 한 벌 이상 다르다", () => {
  const variants = buildOutfitVariants({ items: closet(), weather, gender: "female", tpo: TPOS[0], limit: 6 });
  for (let i = 1; i < variants.length; i += 1) {
    const prev = new Set(variants[i - 1].items.map((x) => x.id));
    const changed = variants[i].items.filter((x) => !prev.has(x.id));
    assert.ok(changed.length > 0, `${i}번째 조합이 이전과 완전히 같다`);
  }
});

test("다른 조합도 결정적이다 — 같은 옷장·날씨면 순서까지 같다", () => {
  const a = buildOutfitVariants({ items: closet(), weather, gender: "male", tpo: TPOS[2], limit: 5 });
  const b = buildOutfitVariants({ items: closet(), weather, gender: "male", tpo: TPOS[2], limit: 5 });
  assert.deepEqual(a.map((o) => o.sig), b.map((o) => o.sig));
});

test("옷장이 비면 다른 조합도 비고, 저장된 착장이 되살아나지 않는다", () => {
  assert.deepEqual(buildOutfitVariants({ items: [], weather, gender: "female", tpo: TPOS[0] }), []);
});

test("가방·액세서리는 조합에 들어가지 않는다", () => {
  const bag = mk("블랙 백팩", "가방 · 옷장 1");
  const variants = buildOutfitVariants({
    items: [...closet(), bag],
    weather,
    gender: "female",
    tpo: TPOS[1],
    limit: 6,
  });
  for (const o of variants) assert.ok(!o.items.some((x) => x.id === bag.id));
});

test("첫 조합은 BEST MATCH, 이후는 '다른 조합' 번호가 붙는다", () => {
  const variants = buildOutfitVariants({ items: closet(), weather, gender: "female", tpo: TPOS[1], limit: 4 });
  assert.equal(variants[0].rank, "BEST MATCH 01");
  assert.match(variants[1].rank, /^다른 조합 02$/);
});
