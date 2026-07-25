"use client";

/**
 * 오늘의 착장 마네킹 — 실제 디스플레이 마네킹처럼 보이는 인체 실루엣에 옷을 "입힌다".
 *
 * 설계
 * - 좌표계 1단위 = 1cm. 여성 160cm · 남성 180cm 를 같은 바닥선(FLOOR)에 세우므로
 *   두 마네킹의 키 차이가 화면에서도 실제 비율로 보인다(옆에 눈금자·키 라벨).
 * - 몸은 인체 계측 랜드마크(어깨·가슴·허리·엉덩이·가랑이·무릎·발목)를 신장 비율로 배치해 만든다.
 * - 옷은 사진을 그대로 얹지 않는다. 그 몸에 맞춰 만든 '착장 실루엣'으로 마스킹하고
 *   그 안을 실제 옷 사진으로 채운다 → 사용자가 직접 찍은 사진도 실제로 입은 것처럼 보인다.
 * - 원단 텍스처 박스는 '옷 단위'로 공유한다(아우터 뒤판·앞판·소매가 같은 원단으로 이어져 보이게).
 * - 아우터는 뒤판(몸 뒤) → 하의 → 상의 → 아우터 앞판·소매 순으로 겹쳐 열어 입은 레이어드를 만든다.
 * - 런타임 AI 호출 0. 전부 결정적 SVG 계산.
 *
 * 주의: 프로덕션 미니파이 인라이닝 사고(2026-07-25) 재발 방지로 배율은 평문 곱셈만 쓴다.
 */

import { useMemo } from "react";
import type { Item } from "@/lib/data";
import type { Gender } from "@/lib/garment";
import type { OutfitSlots } from "@/lib/outfit";

export type MannequinGender = Gender;

interface Props {
  slots: OutfitSlots;
  gender: Gender;
  /** 마스크·그라디언트 id 충돌 방지용 접두사(같은 화면에 여러 개 놓을 때) */
  uid?: string;
  /** 키 눈금자·라벨 표시 */
  showScale?: boolean;
}

/** 원단 텍스처로 쓸 고스트 컷아웃(있으면 배경이 없어 더 깔끔하다) */
const FLAT_CUTOUT: Record<string, string> = {
  "/items/coat.jpg": "/items/flat/coat.png",
  "/items/knit.jpg": "/items/flat/knit.png",
  "/items/knit-cream.jpg": "/items/flat/knit-cream.png",
  "/items/pants.jpg": "/items/flat/pants.png",
  "/items/shirt-white.jpg": "/items/flat/shirt-white.png",
  "/items/shirt-oatmeal.jpg": "/items/flat/shirt-oatmeal.png",
  "/items/shoe.jpg": "/items/flat/shoe.png",
  "/items/boots-chelsea.jpg": "/items/flat/boots-chelsea.png",
  "/items/cardigan-ivory.jpg": "/items/flat/cardigan-ivory.png",
  "/items/cardigan-gray.jpg": "/items/flat/cardigan-gray.png",
  "/items/denim-jacket.jpg": "/items/flat/denim-jacket.png",
  "/items/jeans-blue.jpg": "/items/flat/jeans-blue.png",
};

/**
 * 원단 텍스처 결정 — 옷 한 점만 담긴 사진일 때만 사진을 쓴다.
 * 시드 사진 일부는 여러 옷을 함께 찍은 플랫레이(예: slacks-gray.jpg = 바지+티셔츠+부츠)라
 * 그대로 마스킹하면 엉뚱한 옷이 비친다. 그런 경우는 옷 색 + 직조 패턴으로 대체한다.
 * 사용자가 등록한 옷은 품목별로 잘라낸 사진(data URL)이라 항상 실제 원단이 보인다.
 */
function textureSrc(item: Item): string | null {
  const flat = FLAT_CUTOUT[item.img];
  if (flat) return flat;
  if (item.img.startsWith("data:") || item.img.startsWith("blob:")) return item.img;
  return null;
}

// ---- 인체 계측 ----

const CX = 70; // 중심축 (viewBox 0 0 140 210)
const FLOOR = 196;

/** 신장 대비 세로 랜드마크 비율 (바닥=0, 정수리=1) */
const V = {
  vertex: 1.0,
  chin: 0.868,
  neck: 0.812,
  shoulder: 0.802,
  bust: 0.722,
  waist: 0.618,
  hip: 0.522,
  crotch: 0.478,
  knee: 0.285,
  ankle: 0.043,
  elbow: 0.632,
  wrist: 0.487,
};

/** 신장 대비 반너비 비율 — 여성은 허리가 좁고 엉덩이가 넓고, 남성은 어깨가 넓다 */
const W = {
  female: {
    head: 0.049, neck: 0.027, shoulder: 0.1130, chest: 0.0985, waist: 0.0790, hip: 0.1130,
    thigh: 0.0545, knee: 0.0345, calf: 0.0400, ankle: 0.0230,
    armUpper: 0.0320, armElbow: 0.0265, armWrist: 0.0195,
  },
  male: {
    head: 0.050, neck: 0.0305, shoulder: 0.1240, chest: 0.1090, waist: 0.0930, hip: 0.1010,
    thigh: 0.0575, knee: 0.0360, calf: 0.0425, ankle: 0.0245,
    armUpper: 0.0355, armElbow: 0.0290, armWrist: 0.0215,
  },
} as const;

export const STATURE: Record<Gender, number> = { female: 160, male: 180 };

interface Anthro {
  H: number;
  y: Record<keyof typeof V, number>;
  w: Record<keyof (typeof W)["female"], number>;
  /** 다리 중심선은 아래로 갈수록 모인다(엉덩이 → 무릎 → 발목) — 실제 서 있는 자세 */
  legOff: number;
  legOffKnee: number;
  legOffAnkle: number;
  /** 팔 중심선(어깨·팔꿈치·손목) — 소매는 이 선을 감싸야 팔이 밖으로 새지 않는다 */
  armC: { sh: number; el: number; wr: number };
}

function anthro(gender: Gender): Anthro {
  const H = STATURE[gender];
  const y = {} as Anthro["y"];
  for (const k of Object.keys(V) as (keyof typeof V)[]) y[k] = FLOOR - H * V[k];
  const w = {} as Anthro["w"];
  const src = W[gender];
  for (const k of Object.keys(src) as (keyof typeof src)[]) w[k] = H * src[k];
  const legOff = w.hip * 0.46;
  return {
    H,
    y,
    w,
    legOff,
    legOffKnee: legOff * 0.82,
    legOffAnkle: legOff * 0.62,
    armC: {
      sh: w.shoulder - w.armUpper * 0.75,
      el: w.shoulder - w.armUpper * 0.5,
      wr: w.shoulder - w.armUpper * 0.8,
    },
  };
}

const n = (v: number) => Math.round(v * 10) / 10;
const P = (x: number, yy: number) => `${n(x)},${n(yy)}`;
/** 중심축 기준 좌우 반전 x */
const mx = (x: number) => 2 * CX - x;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const box = (x1: number, y1: number, x2: number, y2: number): Box => ({
  x: x1,
  y: y1,
  w: x2 - x1,
  h: y2 - y1,
});

// ---- 몸 실루엣 ----

/** 몸통: 어깨 → 가슴 → 허리 → 엉덩이 → 가랑이 */
function torsoPath(a: Anthro): string {
  const { y, w, legOff } = a;
  const shY = y.shoulder;
  const { bust, waist, hip, crotch } = y;
  return [
    `M${P(CX - w.shoulder, shY + 1)}`,
    `C${P(CX - w.chest - 1.5, shY + (bust - shY) * 0.5)} ${P(CX - w.chest, bust - 2)} ${P(CX - w.chest, bust)}`,
    `C${P(CX - w.chest, bust + (waist - bust) * 0.55)} ${P(CX - w.waist - 1, waist - 3)} ${P(CX - w.waist, waist)}`,
    `C${P(CX - w.waist - 0.5, waist + (hip - waist) * 0.45)} ${P(CX - w.hip, hip - 5)} ${P(CX - w.hip, hip)}`,
    `C${P(CX - w.hip, hip + 3)} ${P(CX - w.hip + 1, crotch - 3)} ${P(CX - legOff - w.thigh, crotch)}`,
    `L${P(CX - legOff + w.thigh * 0.35, crotch + 2)}`,
    `C${P(CX, crotch - 1.5)} ${P(CX, crotch - 1.5)} ${P(CX + legOff - w.thigh * 0.35, crotch + 2)}`,
    `L${P(CX + legOff + w.thigh, crotch)}`,
    `C${P(CX + w.hip - 1, crotch - 3)} ${P(CX + w.hip, hip + 3)} ${P(CX + w.hip, hip)}`,
    `C${P(CX + w.hip, hip - 5)} ${P(CX + w.waist + 0.5, waist + (hip - waist) * 0.45)} ${P(CX + w.waist, waist)}`,
    `C${P(CX + w.waist + 1, waist - 3)} ${P(CX + w.chest, bust + (waist - bust) * 0.55)} ${P(CX + w.chest, bust)}`,
    `C${P(CX + w.chest, bust - 2)} ${P(CX + w.chest + 1.5, shY + (bust - shY) * 0.5)} ${P(CX + w.shoulder, shY + 1)}`,
    `Q${P(CX, shY - 3)} ${P(CX - w.shoulder, shY + 1)}`,
    "Z",
  ].join(" ");
}

/** 다리 한 짝 (sign = -1 왼쪽 / +1 오른쪽) */
function legPath(a: Anthro, sign: number): string {
  const { y, w } = a;
  const hx = CX + sign * a.legOff;
  const kx = CX + sign * a.legOffKnee;
  const ax = CX + sign * a.legOffAnkle;
  const top = y.crotch - 3;
  const { knee, ankle } = y;
  return [
    `M${P(hx - w.thigh, top)}`,
    `C${P(hx - w.thigh, top + (knee - top) * 0.5)} ${P(kx - w.knee - 0.8, knee - 6)} ${P(kx - w.knee, knee)}`,
    `C${P(kx - w.calf, knee + (ankle - knee) * 0.3)} ${P(ax - w.ankle - 0.8, ankle - 7)} ${P(ax - w.ankle, ankle)}`,
    `L${P(ax + w.ankle, ankle)}`,
    `C${P(ax + w.ankle + 0.8, ankle - 7)} ${P(kx + w.calf, knee + (ankle - knee) * 0.3)} ${P(kx + w.knee, knee)}`,
    `C${P(kx + w.knee + 0.8, knee - 6)} ${P(hx + w.thigh, top + (knee - top) * 0.5)} ${P(hx + w.thigh, top)}`,
    "Z",
  ].join(" ");
}

/** 발 — 발목에서 앞으로 뻗은 낮은 쐐기 */
function footPath(a: Anthro, sign: number): string {
  const { y, w } = a;
  const cx = CX + sign * a.legOffAnkle;
  const ank = y.ankle;
  const toe = sign * (w.ankle + 6.5);
  return [
    `M${P(cx - w.ankle, ank - 1)}`,
    `L${P(cx + w.ankle, ank - 1)}`,
    `L${P(cx + toe, FLOOR - 2.5)}`,
    `Q${P(cx + toe, FLOOR)} ${P(cx + toe - sign * 1.6, FLOOR)}`,
    `L${P(cx - w.ankle - 1.2, FLOOR)}`,
    `Q${P(cx - w.ankle - 2, FLOOR - 1)} ${P(cx - w.ankle - 1.6, ank + 1)}`,
    "Z",
  ].join(" ");
}

/** 팔 한 짝 — 어깨에서 손목까지 완만한 테이퍼(몸통과 살짝 벌어짐) */
function armPath(a: Anthro, sign: number): string {
  const { y, w } = a;
  // 팔은 어깨 끝(견봉) 안쪽에 붙어 내려온다 — 밖에 두면 옷 어깨선이 비현실적으로 넓어진다
  const sx = CX + sign * a.armC.sh;
  const ex = CX + sign * a.armC.el;
  const wx = CX + sign * a.armC.wr;
  // 어깨관절은 어깨선보다 조금 아래에서 시작한다 — 옷 어깨선 위로 팔이 삐져나오지 않게
  const top = y.shoulder + 4;
  return [
    `M${P(sx - sign * w.armUpper, top)}`,
    `C${P(ex - sign * w.armElbow - sign * 0.5, y.elbow - 8)} ${P(ex - sign * w.armElbow, y.elbow)} ${P(wx - sign * w.armWrist, y.wrist)}`,
    `Q${P(wx, y.wrist + w.armWrist * 1.5)} ${P(wx + sign * w.armWrist, y.wrist)}`,
    `C${P(ex + sign * w.armElbow, y.elbow)} ${P(ex + sign * w.armElbow + sign * 0.5, y.elbow - 8)} ${P(sx + sign * w.armUpper, top)}`,
    `Q${P(sx, top - w.armUpper * 0.55)} ${P(sx - sign * w.armUpper, top)}`,
    "Z",
  ].join(" ");
}

// ---- 착장 실루엣 ----

/** 핏 표기 → 옷 폭 배율 */
function widthK(fit?: string): number {
  const f = fit ?? "";
  if (f === "와이드") return 1.32;
  if (f === "오버핏") return 1.24;
  if (f === "루즈") return 1.16;
  if (f === "슬림") return 0.94;
  if (f === "테이퍼드") return 0.98;
  if (f === "크롭") return 1.06;
  return 1.1; // 레귤러·미지정 — 옷은 몸보다 약간 여유가 있다
}

const has = (name: string, words: string[]) => words.some((k) => name.includes(k));

/** 핏 배율을 완만하게 적용한 옷 폭 — 몸 치수에 여유(add)를 더한다 */
const ease = (bodyHalf: number, k: number, add: number) => bodyHalf * (1 + (k - 1) * 0.6) + add;

interface TopGeom {
  hemY: number;
  shW: number;
  bodyW: number;
  sleeveEnd: number;
}
function topGeom(a: Anthro, item: Item): TopGeom {
  const { y, w } = a;
  const k = widthK(item.fit);
  const short = has(item.name, ["반팔", "티셔츠", "탱크", "나시", "폴로"]);
  const long = has(item.name, ["니트", "스웨터", "셔츠", "맨투맨", "후드", "긴팔", "가디건"]);
  return {
    hemY: item.fit === "크롭" ? y.waist - 2 : y.hip + 1,
    // 어깨선은 마네킹 어깨 + 팔 두께를 덮어야 한다
    shW: Math.max(ease(w.shoulder, k, 0.8), a.armC.sh + w.armUpper + 0.8),
    bodyW: ease(w.chest, k, 2.2),
    sleeveEnd: short && !long ? y.elbow - 3 : y.wrist + 2,
  };
}

/** 상의 — 넥라인 + 어깨 + 소매 + 몸판 + 밑단 */
function topPath(a: Anthro, item: Item): string {
  const { y, w } = a;
  const g = topGeom(a, item);
  const k = widthK(item.fit);
  const waistW = Math.max(ease(w.waist, k, 2.6), g.bodyW * 0.86);
  const hemW = Math.max(waistW, ease(w.hip, k, 0.4));
  const neckHalf = w.neck * 1.6;
  const neckTop = y.neck + 1;
  const neckDepth = has(item.name, ["니트", "스웨터", "브이", "V넥"]) ? 5.5 : 3.2;
  const armpit = y.bust + 2;
  // 소매 바깥선은 팔을 감싸야 한다 — 팔 중심선 + 팔 두께 + 여유
  const sleeveOut = CX - Math.max(g.shW + 0.6, a.armC.el + w.armElbow + 1.2);
  const sleeveIn = CX - g.bodyW - 0.5;
  const midSleeve = y.shoulder + (g.sleeveEnd - y.shoulder) * 0.5;
  const midBody = armpit + (y.waist - armpit) * 0.6;
  const midHem = y.waist + (g.hemY - y.waist) * 0.5;
  return [
    `M${P(CX - neckHalf, neckTop)}`,
    `Q${P(CX - g.shW * 0.62, y.shoulder - 1.5)} ${P(CX - g.shW, y.shoulder + 1.5)}`,
    `C${P(sleeveOut - 1, midSleeve)} ${P(sleeveOut, g.sleeveEnd - 5)} ${P(sleeveOut + 0.8, g.sleeveEnd)}`,
    `L${P(sleeveIn + 1.5, g.sleeveEnd - 1)}`,
    `C${P(sleeveIn + 1, g.sleeveEnd - 8)} ${P(CX - g.bodyW - 0.5, armpit + 3)} ${P(CX - g.bodyW, armpit)}`,
    `C${P(CX - g.bodyW, midBody)} ${P(CX - waistW, y.waist - 3)} ${P(CX - waistW, y.waist)}`,
    `C${P(CX - hemW, midHem)} ${P(CX - hemW, g.hemY - 3)} ${P(CX - hemW, g.hemY)}`,
    `Q${P(CX, g.hemY + 2.5)} ${P(CX + hemW, g.hemY)}`,
    `C${P(CX + hemW, g.hemY - 3)} ${P(CX + hemW, midHem)} ${P(CX + waistW, y.waist)}`,
    `C${P(CX + waistW, y.waist - 3)} ${P(CX + g.bodyW, midBody)} ${P(CX + g.bodyW, armpit)}`,
    `C${P(CX + g.bodyW + 0.5, armpit + 3)} ${P(mx(sleeveIn + 1), g.sleeveEnd - 8)} ${P(mx(sleeveIn + 1.5), g.sleeveEnd - 1)}`,
    `L${P(mx(sleeveOut + 0.8), g.sleeveEnd)}`,
    `C${P(mx(sleeveOut), g.sleeveEnd - 5)} ${P(mx(sleeveOut - 1), midSleeve)} ${P(CX + g.shW, y.shoulder + 1.5)}`,
    `Q${P(CX + g.shW * 0.62, y.shoulder - 1.5)} ${P(CX + neckHalf, neckTop)}`,
    `Q${P(CX, neckTop + neckDepth)} ${P(CX - neckHalf, neckTop)}`,
    "Z",
  ].join(" ");
}
function topBox(a: Anthro, item: Item): Box {
  const g = topGeom(a, item);
  return box(CX - g.shW - 3, a.y.neck - 1, CX + g.shW + 3, g.hemY + 3);
}

interface OuterGeom {
  hemY: number;
  shW: number;
  bodyW: number;
  hemW: number;
  sleeveEnd: number;
  long: boolean;
}
function outerGeom(a: Anthro, item: Item): OuterGeom {
  const { y, w } = a;
  const k = widthK(item.fit) + 0.04; // 상의 위에 걸치므로 한 겹 더 여유
  const long = has(item.name, ["코트", "트렌치", "파카", "롱", "야상", "무스탕"]);
  const vest = has(item.name, ["조끼", "베스트", "vest"]);
  const bodyW = ease(w.chest, k, 3.4);
  return {
    hemY: long ? y.knee + 12 : y.hip - 3,
    shW: Math.max(ease(w.shoulder, k, 2.2), a.armC.sh + w.armUpper + 1.4),
    bodyW,
    hemW: Math.max(ease(w.hip, k, 2.2), bodyW),
    sleeveEnd: vest ? y.bust + 3 : y.wrist - 1,
    long,
  };
}
function outerBox(a: Anthro, item: Item): Box {
  const g = outerGeom(a, item);
  return box(CX - g.shW - 6, a.y.shoulder - 4, CX + g.shW + 6, g.hemY + 3);
}

/** 아우터 뒤판 — 몸 뒤에 깔리는 넓은 실루엣(어깨선·밑단이 보인다) */
function outerBackPath(a: Anthro, item: Item): string {
  const { y } = a;
  const g = outerGeom(a, item);
  return [
    `M${P(CX - g.shW, y.shoulder + 1)}`,
    `C${P(CX - g.bodyW - 1, y.bust)} ${P(CX - g.hemW, y.waist)} ${P(CX - g.hemW, g.hemY - 4)}`,
    `Q${P(CX - g.hemW + 0.5, g.hemY)} ${P(CX - g.hemW + 4, g.hemY)}`,
    `L${P(CX + g.hemW - 4, g.hemY)}`,
    `Q${P(CX + g.hemW - 0.5, g.hemY)} ${P(CX + g.hemW, g.hemY - 4)}`,
    `C${P(CX + g.hemW, y.waist)} ${P(CX + g.bodyW + 1, y.bust)} ${P(CX + g.shW, y.shoulder + 1)}`,
    `Q${P(CX, y.neck - 2)} ${P(CX - g.shW, y.shoulder + 1)}`,
    "Z",
  ].join(" ");
}

/** 아우터 앞판 — 상의 위로 겹치는 좌/우 여밈 패널(열어 입은 모습) */
function outerPanelPath(a: Anthro, item: Item, sign: number): string {
  const { y, w } = a;
  const g = outerGeom(a, item);
  const outer = CX + sign * g.bodyW;
  const hemOuter = CX + sign * g.hemW;
  const lapelTop = CX + sign * w.neck * 1.65;
  const innerTop = CX + sign * g.bodyW * 0.42;
  const innerHem = CX + sign * g.hemW * 0.4;
  return [
    `M${P(lapelTop, y.neck + 1)}`,
    `L${P(CX + sign * (g.shW - 1), y.shoulder + 2)}`,
    `C${P(outer, y.bust)} ${P(hemOuter, y.waist)} ${P(hemOuter, g.hemY - 4)}`,
    `Q${P(hemOuter - sign * 0.5, g.hemY)} ${P(hemOuter - sign * 4, g.hemY)}`,
    `L${P(innerHem, g.hemY - 1)}`,
    `C${P(innerHem, y.waist)} ${P(innerTop, y.bust + 6)} ${P(innerTop, y.bust - 4)}`,
    `L${P(lapelTop, y.neck + 1)}`,
    "Z",
  ].join(" ");
}

/** 아우터 소매 — 상의 소매를 덮는다 */
function outerSleevePath(a: Anthro, item: Item, sign: number): string {
  const { y, w } = a;
  const g = outerGeom(a, item);
  const shoulderX = CX + sign * (g.shW - 0.5);
  const outerX = CX + sign * Math.max(a.armC.el + w.armElbow + 2.5, g.bodyW + 3);
  const innerX = CX + sign * (g.bodyW - 1.5);
  return [
    `M${P(shoulderX, y.shoulder + 1.5)}`,
    `C${P(outerX + sign * 1, y.elbow - 10)} ${P(outerX, y.elbow + 4)} ${P(outerX - sign * 1, g.sleeveEnd)}`,
    `Q${P(outerX - sign * 3, g.sleeveEnd + 2.5)} ${P(innerX + sign * 1, g.sleeveEnd - 1)}`,
    `C${P(innerX, y.elbow)} ${P(innerX + sign * 0.5, y.bust + 4)} ${P(innerX + sign * 2, y.bust - 2)}`,
    `L${P(shoulderX, y.shoulder + 1.5)}`,
    "Z",
  ].join(" ");
}

/** 아우터 칼라 — 목 뒤를 감싸 실제로 걸친 느낌을 준다 */
function outerCollarPath(a: Anthro, item: Item): string {
  const { y, w } = a;
  const g = outerGeom(a, item);
  const half = w.neck * 1.9;
  const outerHalf = Math.min(g.shW * 0.55, w.shoulder * 0.75);
  return [
    `M${P(CX - outerHalf, y.shoulder + 2.5)}`,
    `Q${P(CX - half - 0.5, y.neck - 1)} ${P(CX - half, y.neck + 2.5)}`,
    `Q${P(CX, y.neck + 6)} ${P(CX + half, y.neck + 2.5)}`,
    `Q${P(CX + half + 0.5, y.neck - 1)} ${P(CX + outerHalf, y.shoulder + 2.5)}`,
    `Q${P(CX, y.shoulder - 2.5)} ${P(CX - outerHalf, y.shoulder + 2.5)}`,
    "Z",
  ].join(" ");
}

interface BottomGeom {
  hemY: number;
  waistW: number;
  hipW: number;
  thighW: number;
  hemHalf: number;
  skirt: boolean;
  waistY: number;
}
function bottomGeom(a: Anthro, item: Item): BottomGeom {
  const { y, w } = a;
  const k = widthK(item.fit);
  const skirt = has(item.name, ["치마", "스커트", "skirt"]);
  const shorts = has(item.name, ["반바지", "숏츠", "버뮤다", "shorts"]);
  const cropped = item.fit === "크롭" || has(item.name, ["앵클", "크롭"]);
  const thighW = w.thigh * k + 2;
  const hipW = w.hip * k + 2;
  // 밑단 반너비 — 발목 중심선(legOffAnkle)까지 모이므로 이 값이면 두 다리통이 가운데서 만난다.
  // 핏 차이는 바깥선에서 드러난다: 슬림은 다리에 붙고 와이드는 밖으로 퍼진다.
  const legHalf = Math.max(
    w.ankle * k + 3.4,
    thighW * (item.fit === "와이드" ? 1.0 : item.fit === "슬림" ? 0.52 : 0.66),
    a.legOffAnkle + 1
  );
  return {
    hemY: shorts ? y.knee + 12 : cropped ? y.ankle + 9 : y.ankle - 1,
    waistW: w.waist * k + 2,
    hipW,
    thighW,
    hemHalf: skirt ? hipW * 1.18 : legHalf,
    skirt,
    waistY: y.waist + 1,
  };
}
function bottomBox(a: Anthro, item: Item): Box {
  const g = bottomGeom(a, item);
  const half = Math.max(g.hipW, a.legOffAnkle + g.hemHalf) + 3;
  return box(CX - half, g.waistY - 3, CX + half, g.hemY + 3);
}

/** 하의 — 허리밴드 + 엉덩이 + 두 다리통(가랑이에서 갈라진다) */
function bottomPath(a: Anthro, item: Item): string {
  const { y } = a;
  const g = bottomGeom(a, item);
  const legOff = a.legOff;
  const kneeOff = a.legOffKnee;
  const ankOff = a.legOffAnkle;
  if (g.skirt) {
    return [
      `M${P(CX - g.waistW, g.waistY)}`,
      `C${P(CX - g.hipW, y.hip - 4)} ${P(CX - g.hemHalf, y.crotch)} ${P(CX - g.hemHalf, g.hemY)}`,
      `Q${P(CX, g.hemY + 4)} ${P(CX + g.hemHalf, g.hemY)}`,
      `C${P(CX + g.hemHalf, y.crotch)} ${P(CX + g.hipW, y.hip - 4)} ${P(CX + g.waistW, g.waistY)}`,
      `Q${P(CX, g.waistY - 3)} ${P(CX - g.waistW, g.waistY)}`,
      "Z",
    ].join(" ");
  }
  const s = inseam(a, item);
  return [
    `M${P(CX - g.waistW, g.waistY)}`,
    `C${P(CX - g.hipW, y.hip - 5)} ${P(CX - g.hipW, y.hip + 2)} ${P(CX - legOff - g.thighW, s.crotchY)}`,
    `C${P(CX - kneeOff - g.thighW * 0.9, y.knee - 6)} ${P(CX - ankOff - g.hemHalf - 1, y.knee + 8)} ${P(CX - ankOff - g.hemHalf, g.hemY)}`,
    `Q${P(CX - ankOff, g.hemY + 3)} ${P(CX - s.hemGap, g.hemY)}`,
    // 인심: 밑단 안쪽에서 무릎쪽으로 벌어졌다가 가랑이에서 다시 모인다 → 두 다리통이 갈라져 보인다
    `C${P(CX - s.kneeGap, y.knee + 4)} ${P(CX - s.kneeGap, y.knee - 10)} ${P(CX - s.topGap, s.inseamTop)}`,
    `Q${P(CX, s.inseamTop - 1.5)} ${P(CX + s.topGap, s.inseamTop)}`,
    `C${P(CX + s.kneeGap, y.knee - 10)} ${P(CX + s.kneeGap, y.knee + 4)} ${P(CX + s.hemGap, g.hemY)}`,
    `Q${P(CX + ankOff, g.hemY + 3)} ${P(CX + ankOff + g.hemHalf, g.hemY)}`,
    `C${P(CX + ankOff + g.hemHalf + 1, y.knee + 8)} ${P(CX + kneeOff + g.thighW * 0.9, y.knee - 6)} ${P(CX + legOff + g.thighW, s.crotchY)}`,
    `C${P(CX + g.hipW, y.hip + 2)} ${P(CX + g.hipW, y.hip - 5)} ${P(CX + g.waistW, g.waistY)}`,
    `Q${P(CX, g.waistY - 3)} ${P(CX - g.waistW, g.waistY)}`,
    "Z",
  ].join(" ");
}

/** 인심(두 다리통 사이) 파라미터 — 하의 실루엣과 그 사이 그늘이 같은 값을 쓴다 */
function inseam(a: Anthro, item: Item) {
  const g = bottomGeom(a, item);
  const crotchY = a.y.crotch + 3;
  return {
    crotchY,
    inseamTop: crotchY + 1,
    topGap: 0.8,
    kneeGap: Math.max(1.6, Math.min(5.4, a.legOffKnee - g.thighW * 0.42)),
    hemGap: 0.7,
  };
}

/** 다리 사이로 보이는 옷 안쪽 그늘 — 하의가 이 위에 그려지며 실제 인심 틈만 남는다.
 *  (마네킹 맨다리·배경이 바지 사이로 비쳐 금속봉처럼 보이던 문제를 막는다) */
function bottomGapPath(a: Anthro, item: Item): string {
  const g = bottomGeom(a, item);
  if (g.skirt) return "";
  const s = inseam(a, item);
  const half = a.legOffAnkle + 1.5;
  return [
    `M${P(CX - half, s.crotchY)}`,
    `L${P(CX + half, s.crotchY)}`,
    `L${P(CX + half, g.hemY + 1)}`,
    `L${P(CX - half, g.hemY + 1)}`,
    "Z",
  ].join(" ");
}

/** 신발 한 켤레 — 뒤꿈치는 안쪽, 앞코는 바깥쪽으로 살짝 벌어진다 */
function shoePath(a: Anthro, item: Item, sign: number): string {
  const { y, w } = a;
  const cx = CX + sign * a.legOffAnkle;
  const boot = has(item.name, ["부츠", "boots", "첼시"]);
  const topY = boot ? y.ankle - 10 : y.ankle - 1.5;
  const half = w.ankle + 1.2;
  const toeX = cx + sign * (w.ankle + 5.2);
  const heelX = cx - sign * (half + 1.2);
  const sole = FLOOR - 1.2;
  return [
    `M${P(heelX, topY + 2)}`,
    `Q${P(cx - sign * half * 0.2, topY - 1)} ${P(cx + sign * half, topY)}`,
    `C${P(cx + sign * (half + 2), y.ankle + 2)} ${P(toeX - sign * 0.8, sole - 3)} ${P(toeX, sole - 0.8)}`,
    `Q${P(toeX + sign * 0.4, sole)} ${P(toeX - sign * 1.2, sole)}`,
    `L${P(heelX + sign * 0.6, sole)}`,
    `Q${P(heelX - sign * 0.5, sole - 0.7)} ${P(heelX, topY + 2)}`,
    "Z",
  ].join(" ");
}
/** 밑창 — 접지면 띠 */
function solePath(a: Anthro, item: Item, sign: number): string {
  const { w } = a;
  const cx = CX + sign * a.legOffAnkle;
  const half = w.ankle + 1.2;
  const toeX = cx + sign * (w.ankle + 5.2);
  const heelX = cx - sign * (half + 1.4);
  const sole = FLOOR - 1.2;
  return [
    `M${P(heelX, sole - 0.3)}`,
    `L${P(toeX, sole - 0.9)}`,
    `Q${P(toeX + sign * 0.5, FLOOR)} ${P(toeX - sign * 1.4, FLOOR)}`,
    `L${P(heelX + sign * 0.6, FLOOR)}`,
    `Q${P(heelX - sign * 0.6, FLOOR - 0.4)} ${P(heelX, sole - 0.3)}`,
    "Z",
  ].join(" ");
}
function shoeBox(a: Anthro, item: Item): Box {
  const boot = has(item.name, ["부츠", "boots", "첼시"]);
  const half = a.legOffAnkle + a.w.ankle + 7;
  return box(CX - half, boot ? a.y.ankle - 11 : a.y.ankle - 3, CX + half, FLOOR);
}

/** 원피스 — 어깨선에서 무릎 위까지 떨어지는 한 장 실루엣 */
function dressPath(a: Anthro, item: Item): string {
  const { y, w } = a;
  const k = widthK(item.fit);
  const shW = w.shoulder * k + 0.5;
  const bodyW = w.chest * k + 1.5;
  const waistW = w.waist * k + 2;
  const hemY = y.knee + 10;
  const hemW = w.hip * k + 7;
  const neckHalf = w.neck * 1.6;
  const sleeveEnd = y.bust + 4;
  return [
    `M${P(CX - neckHalf, y.neck + 1)}`,
    `Q${P(CX - shW * 0.6, y.shoulder - 1.5)} ${P(CX - shW, y.shoulder + 2)}`,
    `L${P(CX - bodyW - 3, sleeveEnd)}`,
    `L${P(CX - bodyW, y.bust + 2)}`,
    `C${P(CX - bodyW, y.bust + 8)} ${P(CX - waistW, y.waist - 4)} ${P(CX - waistW, y.waist)}`,
    `C${P(CX - hemW, y.hip + 4)} ${P(CX - hemW, hemY - 8)} ${P(CX - hemW, hemY)}`,
    `Q${P(CX, hemY + 4)} ${P(CX + hemW, hemY)}`,
    `C${P(CX + hemW, hemY - 8)} ${P(CX + hemW, y.hip + 4)} ${P(CX + waistW, y.waist)}`,
    `C${P(CX + waistW, y.waist - 4)} ${P(CX + bodyW, y.bust + 8)} ${P(CX + bodyW, y.bust + 2)}`,
    `L${P(CX + bodyW + 3, sleeveEnd)}`,
    `L${P(CX + shW, y.shoulder + 2)}`,
    `Q${P(CX + shW * 0.6, y.shoulder - 1.5)} ${P(CX + neckHalf, y.neck + 1)}`,
    `Q${P(CX, y.neck + 6)} ${P(CX - neckHalf, y.neck + 1)}`,
    "Z",
  ].join(" ");
}
function dressBox(a: Anthro, item: Item): Box {
  const k = widthK(item.fit);
  const half = a.w.hip * k + 10;
  return box(CX - half, a.y.neck - 1, CX + half, a.y.knee + 13);
}

// ---- 렌더 ----

interface Layer {
  key: string;
  d: string;
  item: Item;
  /** 원단 텍스처 박스 — 같은 옷의 조각들은 같은 박스를 공유해 원단이 이어져 보인다 */
  box: Box;
  order: number;
  /** 안감처럼 그늘지게(아우터 뒤판) */
  lining?: boolean;
  /** 밑창 — 원단 대신 어둡게 채운다 */
  sole?: boolean;
  /** 다리 사이 그늘 — 원단 없이 어둡게만 */
  gap?: boolean;
}

export function Mannequin({ slots, gender, uid = "mq", showScale = true }: Props) {
  const a = useMemo(() => anthro(gender), [gender]);
  const H = STATURE[gender];

  const { behind, front } = useMemo(() => {
    const behindL: Layer[] = [];
    const frontL: Layer[] = [];
    if (slots.outer) {
      const b = outerBox(a, slots.outer);
      behindL.push({ key: "outer-back", d: outerBackPath(a, slots.outer), item: slots.outer, box: b, order: 0, lining: true });
    }
    if (slots.bottom) {
      const gap = bottomGapPath(a, slots.bottom);
      if (gap) {
        behindL.push({ key: "bottom-gap", d: gap, item: slots.bottom, box: bottomBox(a, slots.bottom), order: 1, gap: true });
      }
      behindL.push({ key: "bottom", d: bottomPath(a, slots.bottom), item: slots.bottom, box: bottomBox(a, slots.bottom), order: 1 });
    }
    if (slots.dress) {
      behindL.push({ key: "dress", d: dressPath(a, slots.dress), item: slots.dress, box: dressBox(a, slots.dress), order: 2 });
    } else if (slots.top) {
      behindL.push({ key: "top", d: topPath(a, slots.top), item: slots.top, box: topBox(a, slots.top), order: 2 });
    }
    if (slots.outer) {
      const b = outerBox(a, slots.outer);
      const o = slots.outer;
      frontL.push({ key: "outer-sleeve-l", d: outerSleevePath(a, o, -1), item: o, box: b, order: 3 });
      frontL.push({ key: "outer-sleeve-r", d: outerSleevePath(a, o, 1), item: o, box: b, order: 3 });
      frontL.push({ key: "outer-panel-l", d: outerPanelPath(a, o, -1), item: o, box: b, order: 4 });
      frontL.push({ key: "outer-panel-r", d: outerPanelPath(a, o, 1), item: o, box: b, order: 4 });
      frontL.push({ key: "outer-collar", d: outerCollarPath(a, o), item: o, box: b, order: 4 });
    }
    if (slots.shoe) {
      const b = shoeBox(a, slots.shoe);
      frontL.push({ key: "shoe-l", d: shoePath(a, slots.shoe, -1), item: slots.shoe, box: b, order: 5 });
      frontL.push({ key: "shoe-r", d: shoePath(a, slots.shoe, 1), item: slots.shoe, box: b, order: 5 });
      frontL.push({ key: "sole-l", d: solePath(a, slots.shoe, -1), item: slots.shoe, box: b, order: 5, sole: true });
      frontL.push({ key: "sole-r", d: solePath(a, slots.shoe, 1), item: slots.shoe, box: b, order: 5, sole: true });
    }
    return { behind: behindL, front: frontL };
  }, [a, slots]);

  const all = [...behind, ...front];
  const label = [slots.outer, slots.dress, slots.top, slots.bottom, slots.shoe]
    .filter((x): x is Item => !!x)
    .map((x) => x.name)
    .join(", ");

  const renderLayer = (l: Layer) => {
    if (l.gap) {
      return (
        <path
          className="doll-item"
          key={l.key}
          style={{ animationDelay: `${l.order * 80}ms` }}
          d={l.d}
          fill="#25322c"
          fillOpacity="0.6"
        />
      );
    }
    const src = l.sole ? null : textureSrc(l.item);
    return (
      <g
        className="doll-item"
        key={l.key}
        style={{ animationDelay: `${l.order * 80}ms` }}
        filter={`url(#${uid}-soft)`}
      >
        {/* 옷 색 바탕 — 사진에 여백·투명 영역이 있어도 옷으로 읽히게 */}
        <path d={l.d} fill={l.sole ? "#2c332f" : l.item.color || "#cfd6d0"} />
        <g clipPath={`url(#${uid}-c-${l.key})`}>
          {src ? (
            // 원단 텍스처: 이 옷의 박스에 맞춰 실제 옷 사진을 채운다
            <image
              href={src}
              x={l.box.x}
              y={l.box.y}
              width={l.box.w}
              height={l.box.h}
              preserveAspectRatio="xMidYMid slice"
            />
          ) : (
            // 사진을 쓸 수 없을 때 — 옷 색 위에 직조 결만 얹는다
            !l.sole && <path d={l.d} fill={`url(#${uid}-weave)`} />
          )}
          {l.lining && <path d={l.d} fill="rgba(16,28,23,.22)" />}
          {/* 몸의 입체감 — 가장자리 그늘 + 중앙 하이라이트 */}
          <path d={l.d} fill={`url(#${uid}-round)`} />
        </g>
        <path d={l.d} fill="none" stroke="rgba(24,38,32,.24)" strokeWidth="0.5" />
      </g>
    );
  };

  return (
    <svg
      className="mannequin"
      viewBox="0 0 140 210"
      preserveAspectRatio="xMidYMax meet"
      role="img"
      aria-label={`${gender === "female" ? "여성" : "남성"} ${H}cm 마네킹 착장${label ? `: ${label}` : " (옷 없음)"}`}
    >
      <defs>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d5c8b1" />
          <stop offset="0.3" stopColor="#f1e9db" />
          <stop offset="0.6" stopColor="#e6dcc8" />
          <stop offset="1" stopColor="#c9bca3" />
        </linearGradient>
        <linearGradient id={`${uid}-round`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0e1a16" stopOpacity="0.32" />
          <stop offset="0.16" stopColor="#0e1a16" stopOpacity="0.07" />
          <stop offset="0.4" stopColor="#ffffff" stopOpacity="0.15" />
          <stop offset="0.74" stopColor="#0e1a16" stopOpacity="0.06" />
          <stop offset="1" stopColor="#0e1a16" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={`${uid}-plate`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9aa39e" />
          <stop offset="0.42" stopColor="#d6dbd8" />
          <stop offset="1" stopColor="#8b938f" />
        </linearGradient>
        {/* 직조 결 — 사진 없이 색만 있는 옷도 원단처럼 보이게 */}
        <pattern id={`${uid}-weave`} width="1.5" height="1.5" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
          <line x1="0" y1="0" x2="0" y2="1.5" stroke="rgba(255,255,255,.09)" strokeWidth="0.6" />
          <line x1="0.75" y1="0" x2="0.75" y2="1.5" stroke="rgba(0,0,0,.06)" strokeWidth="0.5" />
        </pattern>
        <filter id={`${uid}-soft`} x="-30%" y="-15%" width="160%" height="140%">
          <feDropShadow dx="0" dy="1.4" stdDeviation="1.9" floodColor="#16241f" floodOpacity="0.24" />
        </filter>
        {all.map((l) => (
          <clipPath id={`${uid}-c-${l.key}`} key={l.key}>
            <path d={l.d} />
          </clipPath>
        ))}
      </defs>

      {/* 마네킹 받침 원판 */}
      <ellipse cx={CX} cy={FLOOR + 2} rx={H * 0.115} ry={H * 0.021} fill="#c4ccc7" />
      <ellipse cx={CX} cy={FLOOR + 0.6} rx={H * 0.115} ry={H * 0.021} fill={`url(#${uid}-plate)`} />

      {/* 키 눈금자 — 여성 160 / 남성 180 이 실제 비율로 다르게 보이는 지점 */}
      {showScale && (
        <g className="mq-scale" aria-hidden="true">
          <line x1={13} y1={FLOOR} x2={13} y2={FLOOR - 190} stroke="rgba(31,106,88,.22)" strokeWidth="0.5" />
          {[20, 40, 60, 80, 100, 120, 140, 160, 180].map((cm) => (
            <line
              key={cm}
              x1={13}
              y1={FLOOR - cm}
              x2={cm % 60 === 0 ? 17.5 : 15.5}
              y2={FLOOR - cm}
              stroke="rgba(31,106,88,.26)"
              strokeWidth="0.5"
            />
          ))}
          <line
            x1={13}
            y1={FLOOR - H}
            x2={CX - a.w.head - 2}
            y2={FLOOR - H}
            stroke="rgba(31,106,88,.42)"
            strokeWidth="0.6"
            strokeDasharray="2 1.6"
          />
          <text x={14.5} y={FLOOR - H - 3.5} fontSize="6.6" fill="#1f6a58" fontWeight="800">
            {H}cm
          </text>
        </g>
      )}

      {/* 몸 */}
      <g stroke="rgba(31,42,38,.16)" strokeWidth="0.5" filter={`url(#${uid}-soft)`}>
        <g fill={`url(#${uid}-body)`}>
          <path d={armPath(a, -1)} />
          <path d={armPath(a, 1)} />
          <path d={legPath(a, -1)} />
          <path d={legPath(a, 1)} />
          <path d={footPath(a, -1)} />
          <path d={footPath(a, 1)} />
          <path d={torsoPath(a)} />
          <rect
            x={CX - a.w.neck}
            y={a.y.chin - 1}
            width={a.w.neck * 2}
            height={a.y.shoulder - a.y.chin + 5}
            rx={a.w.neck}
          />
          {/* 얼굴 없는 추상 마네킹 헤드(달걀형) */}
          <ellipse
            cx={CX}
            cy={(a.y.vertex + a.y.chin) / 2}
            rx={a.w.head}
            ry={(a.y.chin - a.y.vertex) / 2}
          />
        </g>
      </g>

      {/* 착장 레이어: 아우터 뒤판 → 하의 → 상의 → 아우터 앞판·소매·칼라 → 신발 */}
      {behind.map(renderLayer)}
      {front.map(renderLayer)}

      {/* 바닥 접지 그림자 */}
      <ellipse cx={CX} cy={FLOOR + 5} rx={H * 0.13} ry={H * 0.017} fill="rgba(31,42,38,.12)" />
    </svg>
  );
}
