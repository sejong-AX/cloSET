/**
 * 마네킹 기하 — 몸(인체 계측)과 그 몸에 "입힌" 옷의 SVG 경로를 전부 순수 함수로 만든다.
 *
 * 왜 컴포넌트에서 분리했나: 프로덕션 미니파이 인라이닝으로 좌표가 NaN 이 되어 마네킹이
 * 깨진 사고(2026-07-25, PR #2)가 있었다. 순수 모듈이면 `npm test` 에서 모든 조합의 경로에
 * NaN·undefined 가 없는지 결정적으로 검증할 수 있다(브라우저 없이).
 *
 * 착장 원칙 (사용자 요구: "아우터가 동떨어져 보이지 않고 실제로 입고 있는 모습"):
 * - 상의 몸판과 소매를 나눠 그린다 → 소매가 팔을 감싸고 어깨에서 이어진다.
 * - 아우터는 뒤판(몸 뒤) → 앞판 좌·우(가운데를 비워 속 상의가 보인다) → 소매 → 칼라 순.
 *   가운데가 열려 있어야 "겉옷을 걸쳐 입은" 것으로 읽힌다(참고: 셔츠 위에 오픈 가디건).
 * - 하의는 다리 두 짝을 따로 그린다 → 사이에 실제 틈이 남아 치마가 아니라 바지로 보인다.
 */

import { categoryOfItem, type Gender } from "./garment";
import {
  garmentKind,
  garmentPattern,
  isLongSleeve,
  paletteOf,
  type GarmentKind,
  type GarmentPattern,
  type Palette,
} from "./garment-art";
import type { Item } from "./data";

// ---- 좌표계 ----

export const CX = 70; // 중심축 (viewBox 0 0 140 210)
export const FLOOR = 196;

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
    head: 0.049, neck: 0.028, shoulder: 0.1130, chest: 0.0985, waist: 0.0790, hip: 0.1130,
    thigh: 0.0545, knee: 0.0345, calf: 0.0400, ankle: 0.0230,
    armUpper: 0.0290, armElbow: 0.0245, armWrist: 0.0185,
  },
  male: {
    head: 0.050, neck: 0.0315, shoulder: 0.1240, chest: 0.1090, waist: 0.0930, hip: 0.1010,
    thigh: 0.0575, knee: 0.0360, calf: 0.0425, ankle: 0.0245,
    armUpper: 0.0320, armElbow: 0.0270, armWrist: 0.0200,
  },
} as const;

export const STATURE: Record<Gender, number> = { female: 160, male: 180 };

export interface Anthro {
  H: number;
  y: Record<keyof typeof V, number>;
  w: Record<keyof (typeof W)["female"], number>;
  /** 다리 중심선 — 아래로 갈수록 모이지만, 옷이 갈라져 보일 만큼의 간격은 남긴다 */
  legOff: number;
  legOffKnee: number;
  legOffAnkle: number;
  /** 팔 중심선(어깨·팔꿈치·손목) */
  armC: { sh: number; el: number; wr: number };
}

export function anthro(gender: Gender): Anthro {
  const H = STATURE[gender];
  const y = {} as Anthro["y"];
  for (const k of Object.keys(V) as (keyof typeof V)[]) y[k] = FLOOR - H * V[k];
  const w = {} as Anthro["w"];
  const src = W[gender];
  for (const k of Object.keys(src) as (keyof typeof src)[]) w[k] = H * src[k];
  const legOff = w.hip * 0.5;
  return {
    H,
    y,
    w,
    legOff,
    legOffKnee: legOff * 0.86,
    legOffAnkle: legOff * 0.74,
    // 팔은 어깨 끝에서 시작해 아래로 갈수록 몸통에서 조금씩 벌어진다.
    // (몸통에 딱 붙이면 앞모습에서 팔·몸통이 한 덩어리로 보인다 — 실제 디스플레이 마네킹도 살짝 벌어져 있다)
    armC: {
      sh: w.shoulder - w.armUpper * 0.55,
      el: w.shoulder + w.armElbow * 0.30,
      wr: w.shoulder + w.armWrist * 0.55,
    },
  };
}

const n1 = (v: number) => Math.round(v * 10) / 10;
const P = (x: number, y: number) => `${n1(x)},${n1(y)}`;
const mx = (x: number) => 2 * CX - x;

// ---- 몸 실루엣 ----

export function torsoPath(a: Anthro): string {
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

export function legPath(a: Anthro, sign: number): string {
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

export function footPath(a: Anthro, sign: number): string {
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

export function armPath(a: Anthro, sign: number): string {
  const { y, w } = a;
  const sx = CX + sign * a.armC.sh;
  const ex = CX + sign * a.armC.el;
  const wx = CX + sign * a.armC.wr;
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

/** 목 — 턱 아래에서 어깨 안쪽까지 살짝 좁아지는 기둥(머리가 떠 보이지 않게 몸통에 묻는다) */
export function neckPath(a: Anthro): string {
  const { y, w } = a;
  const top = y.chin - 0.5;
  const bot = y.shoulder + 4;
  const tw = w.neck * 0.92;
  return [
    `M${P(CX - tw, top)}`,
    `C${P(CX - tw - 0.4, top + (bot - top) * 0.55)} ${P(CX - w.neck * 1.35, bot - 3)} ${P(CX - w.neck * 1.7, bot)}`,
    `L${P(CX + w.neck * 1.7, bot)}`,
    `C${P(CX + w.neck * 1.35, bot - 3)} ${P(CX + tw + 0.4, top + (bot - top) * 0.55)} ${P(CX + tw, top)}`,
    `Q${P(CX, top - 1.5)} ${P(CX - tw, top)}`,
    "Z",
  ].join(" ");
}

// ---- 옷 공통 ----

/** 핏 표기 → 옷 폭 배율 */
export function widthK(fit?: string): number {
  switch (fit) {
    case "와이드": return 1.32;
    case "오버핏": return 1.24;
    case "루즈": return 1.16;
    case "슬림": return 0.94;
    case "테이퍼드": return 0.98;
    case "크롭": return 1.06;
    default: return 1.1; // 레귤러·미지정 — 옷은 몸보다 약간 여유가 있다
  }
}

/** 핏 배율을 완만하게 적용한 옷 폭 */
const ease = (bodyHalf: number, k: number, add: number) => bodyHalf * (1 + (k - 1) * 0.6) + add;

export interface GarmentLook {
  kind: GarmentKind;
  pattern: GarmentPattern;
  pal: Palette;
  long: boolean;
}

export function lookOf(item: Item): GarmentLook {
  const kind = garmentKind(item.name, categoryOfItem(item));
  return {
    kind,
    pattern: garmentPattern(item.name, kind),
    pal: paletteOf(item.color || "#cfd6d0"),
    long: isLongSleeve(kind, item.name),
  };
}

// ---- 상의 ----

interface TopGeom {
  hemY: number;
  shW: number;
  bodyW: number;
  waistW: number;
  hemW: number;
  armpitY: number;
  neckHalf: number;
  neckDepth: number;
  sleeveEndY: number;
}

function topGeom(a: Anthro, item: Item, look: GarmentLook, outer = false): TopGeom {
  const { y, w } = a;
  const k = widthK(item.fit) + (outer ? 0.06 : 0);
  const longHem =
    look.kind === "coat" ? y.knee + 10 : look.kind === "padding" ? y.hip - 8 : null;
  const hemY = outer
    ? longHem ?? y.hip - 2
    : item.fit === "크롭"
    ? y.waist - 1
    : y.hip + 1;
  const bodyW = ease(w.chest, k, outer ? 3.2 : 2.0);
  return {
    hemY,
    shW: Math.max(ease(w.shoulder, k, outer ? 2.0 : 0.9), a.armC.sh + w.armUpper + (outer ? 1.4 : 0.8)),
    bodyW,
    waistW: Math.max(ease(w.waist, k, outer ? 3.4 : 2.6), bodyW * 0.86),
    hemW: Math.max(ease(w.hip, k, outer ? 2.4 : 0.6), bodyW * 0.9),
    armpitY: y.bust + 2,
    neckHalf: w.neck * (look.kind === "shirt" ? 1.75 : 1.6),
    neckDepth: look.kind === "knit" || look.kind === "sweat" ? 5.5 : 3.2,
    sleeveEndY: look.long ? y.wrist + 2 : y.elbow - 3,
  };
}

/** 상의 몸판 — 소매 없이 몸통만(소매는 따로 그려 팔을 감싼다) */
function topBodyPath(a: Anthro, g: TopGeom): string {
  const { y } = a;
  const neckTop = y.neck + 1;
  const midBody = g.armpitY + (y.waist - g.armpitY) * 0.6;
  const midHem = y.waist + (g.hemY - y.waist) * 0.5;
  return [
    `M${P(CX - g.neckHalf, neckTop)}`,
    `Q${P(CX - g.shW * 0.62, y.shoulder - 1.5)} ${P(CX - g.shW, y.shoulder + 2)}`,
    `C${P(CX - g.bodyW - 1.5, y.shoulder + 8)} ${P(CX - g.bodyW, g.armpitY - 5)} ${P(CX - g.bodyW, g.armpitY)}`,
    `C${P(CX - g.bodyW, midBody)} ${P(CX - g.waistW, y.waist - 3)} ${P(CX - g.waistW, y.waist)}`,
    `C${P(CX - g.hemW, midHem)} ${P(CX - g.hemW, g.hemY - 3)} ${P(CX - g.hemW, g.hemY)}`,
    `Q${P(CX, g.hemY + 2.5)} ${P(CX + g.hemW, g.hemY)}`,
    `C${P(CX + g.hemW, g.hemY - 3)} ${P(CX + g.hemW, midHem)} ${P(CX + g.waistW, y.waist)}`,
    `C${P(CX + g.waistW, y.waist - 3)} ${P(CX + g.bodyW, midBody)} ${P(CX + g.bodyW, g.armpitY)}`,
    `C${P(CX + g.bodyW, g.armpitY - 5)} ${P(CX + g.bodyW + 1.5, y.shoulder + 8)} ${P(CX + g.shW, y.shoulder + 2)}`,
    `Q${P(CX + g.shW * 0.62, y.shoulder - 1.5)} ${P(CX + g.neckHalf, neckTop)}`,
    `Q${P(CX, neckTop + g.neckDepth)} ${P(CX - g.neckHalf, neckTop)}`,
    "Z",
  ].join(" ");
}

/** 소매 — 어깨에서 시작해 팔 중심선을 감싸고 내려간다 */
function sleevePath(a: Anthro, g: TopGeom, sign: number, endY: number, ease2: number): string {
  const { y, w } = a;
  const shoulderOut = CX + sign * g.shW;
  const shoulderIn = CX + sign * (g.bodyW - 1);
  const elbowOut = CX + sign * Math.max(a.armC.el + w.armElbow + ease2, g.bodyW * 0.86);
  const endOut = CX + sign * Math.max(a.armC.wr + w.armWrist + ease2 * 0.8, g.bodyW * 0.62);
  const endIn = CX + sign * Math.max(a.armC.wr - w.armWrist - 0.4, 2);
  const elbowIn = CX + sign * Math.max(a.armC.el - w.armElbow - 0.6, 3);
  const shortEnd = endY < y.elbow;
  const eOut = shortEnd ? CX + sign * (a.armC.el + w.armElbow + ease2) : elbowOut;
  const eIn = shortEnd ? CX + sign * (a.armC.el - w.armElbow * 0.2) : elbowIn;
  return [
    `M${P(shoulderOut, y.shoulder + 2)}`,
    `C${P(eOut + sign * 0.8, y.elbow - 12)} ${P(eOut, y.elbow - 2)} ${P(shortEnd ? eOut : endOut, endY)}`,
    `Q${P(CX + sign * a.armC.wr, endY + 2.2)} ${P(shortEnd ? eIn : endIn, endY)}`,
    `C${P(eIn, y.elbow - 4)} ${P(shoulderIn - sign * 0.5, g.armpitY + 4)} ${P(shoulderIn, g.armpitY - 2)}`,
    `L${P(shoulderOut, y.shoulder + 2)}`,
    "Z",
  ].join(" ");
}

// ---- 아우터 ----

/** 아우터 뒤판 — 몸 뒤에 깔려 어깨선·밑단이 보인다 */
function outerBackPath(a: Anthro, g: TopGeom): string {
  const { y } = a;
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

/**
 * 아우터 앞판 — 가운데를 비워 속 상의가 드러나게 좌·우로 나눠 그린다.
 * (열어 입은 가디건·자켓처럼 보이는 핵심)
 */
function outerPanelPath(a: Anthro, g: TopGeom, sign: number, gapHalf: number): string {
  const { y } = a;
  const outer = CX + sign * g.bodyW;
  const hemOuter = CX + sign * g.hemW;
  const innerTop = CX + sign * (gapHalf + 2.5);
  const innerHem = CX + sign * gapHalf;
  return [
    `M${P(CX + sign * g.neckHalf, y.neck + 1.5)}`,
    `L${P(CX + sign * (g.shW - 0.8), y.shoulder + 2)}`,
    `C${P(outer, y.bust)} ${P(hemOuter, y.waist)} ${P(hemOuter, g.hemY - 4)}`,
    `Q${P(hemOuter - sign * 0.5, g.hemY)} ${P(hemOuter - sign * 4, g.hemY)}`,
    `L${P(innerHem, g.hemY - 0.5)}`,
    `C${P(innerHem, y.waist)} ${P(innerTop, y.bust + 4)} ${P(innerTop, y.bust - 6)}`,
    `L${P(CX + sign * g.neckHalf, y.neck + 1.5)}`,
    "Z",
  ].join(" ");
}

/** 라펠 — 자켓·코트의 목 아래 접힘 */
function lapelPath(a: Anthro, g: TopGeom, sign: number, gapHalf: number): string {
  const { y } = a;
  return [
    `M${P(CX + sign * g.neckHalf, y.neck + 1.5)}`,
    `L${P(CX + sign * (g.neckHalf + 7), y.shoulder + 4)}`,
    `L${P(CX + sign * (gapHalf + 1.5), y.bust + 6)}`,
    `L${P(CX + sign * (gapHalf + 2.5), y.shoulder + 4)}`,
    "Z",
  ].join(" ");
}

/** 칼라 — 목 뒤를 감싼다 */
function collarPath(a: Anthro, g: TopGeom): string {
  const { y, w } = a;
  const half = w.neck * 1.95;
  const outerHalf = Math.min(g.shW * 0.55, w.shoulder * 0.78);
  return [
    `M${P(CX - outerHalf, y.shoulder + 2.5)}`,
    `Q${P(CX - half - 0.5, y.neck - 1)} ${P(CX - half, y.neck + 2.5)}`,
    `Q${P(CX, y.neck + 6)} ${P(CX + half, y.neck + 2.5)}`,
    `Q${P(CX + half + 0.5, y.neck - 1)} ${P(CX + outerHalf, y.shoulder + 2.5)}`,
    `Q${P(CX, y.shoulder - 2.5)} ${P(CX - outerHalf, y.shoulder + 2.5)}`,
    "Z",
  ].join(" ");
}

// ---- 하의 ----

interface BottomGeom {
  waistY: number;
  waistW: number;
  hipW: number;
  thighW: number;
  kneeW: number;
  hemW: number;
  hemY: number;
  skirt: boolean;
}

function bottomGeom(a: Anthro, item: Item, look: GarmentLook): BottomGeom {
  const { y, w } = a;
  const k = widthK(item.fit);
  const skirt = look.kind === "skirt";
  const shorts = look.kind === "shorts";
  const cropped = item.fit === "크롭" || item.name.includes("앵클");
  return {
    waistY: y.waist + 1,
    waistW: w.waist * k + 2,
    hipW: w.hip * k + 2,
    thighW: w.thigh * k + 2.2,
    kneeW: w.knee * k + 2,
    hemW: Math.max(w.ankle * k + 1.8, w.ankle * 1.3),
    hemY: shorts ? y.knee + 10 : cropped ? y.ankle + 9 : y.ankle - 1,
    skirt,
  };
}

function skirtPath(a: Anthro, g: BottomGeom): string {
  const { y } = a;
  const hemHalf = g.hipW * 1.3;
  const hemY = y.knee + 6;
  return [
    `M${P(CX - g.waistW, g.waistY)}`,
    `C${P(CX - g.hipW, y.hip - 4)} ${P(CX - hemHalf, y.crotch)} ${P(CX - hemHalf, hemY)}`,
    `Q${P(CX, hemY + 4)} ${P(CX + hemHalf, hemY)}`,
    `C${P(CX + hemHalf, y.crotch)} ${P(CX + g.hipW, y.hip - 4)} ${P(CX + g.waistW, g.waistY)}`,
    `Q${P(CX, g.waistY - 3)} ${P(CX - g.waistW, g.waistY)}`,
    "Z",
  ].join(" ");
}

/**
 * 바지 한 짝 — 바깥선은 핏대로 퍼지고, 안쪽선은 가운데에 틈을 남긴다.
 * 두 짝 사이에 틈이 없으면 치마처럼 보인다(이전 버전의 문제).
 */
function legGarmentPath(a: Anthro, g: BottomGeom, sign: number): string {
  const { y } = a;
  const kneeC = CX + sign * a.legOffKnee;
  const ankC = CX + sign * a.legOffAnkle;
  const crotchY = y.crotch + 2;
  // 안쪽 반너비는 중심에서 최소 0.9 는 떨어지게 잘라 둔다 → 두 다리통 사이에 항상 틈이 남는다
  const innerKnee = Math.min(g.kneeW, a.legOffKnee - 1.2);
  const innerHem = Math.min(g.hemW, a.legOffAnkle - 0.9);
  return [
    `M${P(CX + sign * 0.5, g.waistY)}`,
    `L${P(CX + sign * g.waistW, g.waistY)}`,
    `C${P(CX + sign * g.hipW, y.hip)} ${P(kneeC + sign * (g.kneeW + 1), y.knee - 12)} ${P(kneeC + sign * g.kneeW, y.knee)}`,
    `C${P(ankC + sign * (g.hemW + 1), y.knee + 14)} ${P(ankC + sign * g.hemW, g.hemY - 8)} ${P(ankC + sign * g.hemW, g.hemY)}`,
    `Q${P(ankC, g.hemY + 2.2)} ${P(ankC - sign * innerHem, g.hemY)}`,
    `C${P(ankC - sign * innerHem, g.hemY - 8)} ${P(kneeC - sign * innerKnee, y.knee + 14)} ${P(kneeC - sign * innerKnee, y.knee)}`,
    `C${P(kneeC - sign * innerKnee, y.knee - 14)} ${P(CX + sign * 2.2, crotchY + 6)} ${P(CX + sign * 0.5, crotchY)}`,
    "Z",
  ].join(" ");
}

// ---- 신발 ----

function shoePath(a: Anthro, look: GarmentLook, sign: number): string {
  const { y, w } = a;
  const cx = CX + sign * a.legOffAnkle;
  const boot = look.kind === "boots";
  const topY = boot ? y.ankle - 10 : y.ankle - 1.5;
  const half = w.ankle + 1.4;
  const toeX = cx + sign * (w.ankle + 5.6);
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

function solePath(a: Anthro, sign: number): string {
  const { y, w } = a;
  const cx = CX + sign * a.legOffAnkle;
  const half = w.ankle + 1.4;
  const toeX = cx + sign * (w.ankle + 5.6);
  const heelX = cx - sign * (half + 1.4);
  const sole = FLOOR - 1.2;
  void y;
  return [
    `M${P(heelX, sole - 0.3)}`,
    `L${P(toeX, sole - 0.9)}`,
    `Q${P(toeX + sign * 0.5, FLOOR)} ${P(toeX - sign * 1.4, FLOOR)}`,
    `L${P(heelX + sign * 0.6, FLOOR)}`,
    `Q${P(heelX - sign * 0.6, FLOOR - 0.4)} ${P(heelX, sole - 0.3)}`,
    "Z",
  ].join(" ");
}

// ---- 원피스 ----

function dressPath(a: Anthro, item: Item, g: TopGeom): string {
  const { y, w } = a;
  const k = widthK(item.fit);
  const hemY = y.knee + 8;
  const hemW = w.hip * k + 7;
  return [
    `M${P(CX - g.neckHalf, y.neck + 1)}`,
    `Q${P(CX - g.shW * 0.6, y.shoulder - 1.5)} ${P(CX - g.shW, y.shoulder + 2)}`,
    `C${P(CX - g.bodyW - 1, y.shoulder + 8)} ${P(CX - g.bodyW, g.armpitY - 4)} ${P(CX - g.bodyW, g.armpitY)}`,
    `C${P(CX - g.bodyW, y.bust + 8)} ${P(CX - g.waistW, y.waist - 4)} ${P(CX - g.waistW, y.waist)}`,
    `C${P(CX - hemW, y.hip + 4)} ${P(CX - hemW, hemY - 8)} ${P(CX - hemW, hemY)}`,
    `Q${P(CX, hemY + 4)} ${P(CX + hemW, hemY)}`,
    `C${P(CX + hemW, hemY - 8)} ${P(CX + hemW, y.hip + 4)} ${P(CX + g.waistW, y.waist)}`,
    `C${P(CX + g.waistW, y.waist - 4)} ${P(CX + g.bodyW, y.bust + 8)} ${P(CX + g.bodyW, g.armpitY)}`,
    `C${P(CX + g.bodyW, g.armpitY - 4)} ${P(CX + g.bodyW + 1, y.shoulder + 8)} ${P(CX + g.shW, y.shoulder + 2)}`,
    `Q${P(CX + g.shW * 0.6, y.shoulder - 1.5)} ${P(CX + g.neckHalf, y.neck + 1)}`,
    `Q${P(CX, y.neck + 6)} ${P(CX - g.neckHalf, y.neck + 1)}`,
    "Z",
  ].join(" ");
}

// ---- 착장 조립 ----

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 경로 문자열의 좌표를 훑어 외접 사각형을 구한다(원단 사진을 어디에 채울지 정할 때 쓴다) */
export function pathBBox(d: string): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const m of d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    if (!isFinite(x) || !isFinite(y)) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!isFinite(minX)) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

/** 여러 사각형을 합친다 — 한 옷의 조각들이 같은 원단 상자를 공유해 무늬가 이어져 보인다 */
export function unionBox(boxes: Box[]): Box {
  if (boxes.length === 0) return { x: 0, y: 0, w: 1, h: 1 };
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.w));
  const b2 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: Math.max(1, r - x), h: Math.max(1, b2 - y) };
}

export interface MqPiece {
  key: string;
  d: string;
  /** 원단 조각 = 옷 색으로 채우고 패턴·음영을 얹는다. 장식 조각은 fill 을 직접 준다. */
  role: "fabric" | "shade" | "line" | "sole";
  itemId: string;
  fill?: string;
  opacity?: number;
  strokeWidth?: number;
  order: number;
  /** 이 조각에 얹을 원단 패턴(원단 조각만) */
  pattern?: GarmentPattern;
  /** 뒤판·안감처럼 그늘지게 */
  lining?: boolean;
}

export interface OutfitSlotsLike {
  outer?: Item;
  top?: Item;
  bottom?: Item;
  shoe?: Item;
  dress?: Item;
}

/**
 * 착장 전체를 그릴 조각 목록(몸 뒤 → 앞 순서).
 * 옷을 안 입은 슬롯은 그냥 빠진다(빈 옷장이면 빈 배열).
 */
export function buildOutfitPieces(slots: OutfitSlotsLike, gender: Gender): MqPiece[] {
  const a = anthro(gender);
  const out: MqPiece[] = [];

  const outerLook = slots.outer ? lookOf(slots.outer) : null;
  const outerG = slots.outer && outerLook ? topGeom(a, slots.outer, outerLook, true) : null;

  // 0. 아우터 뒤판 — 몸 뒤에 깔린다
  if (slots.outer && outerG) {
    out.push({ key: "outer-back", d: outerBackPath(a, outerG), role: "fabric", itemId: slots.outer.id, order: 0, lining: true, pattern: outerLook!.pattern });
  }

  // 1. 하의
  if (slots.bottom) {
    const look = lookOf(slots.bottom);
    const g = bottomGeom(a, slots.bottom, look);
    if (g.skirt) {
      out.push({ key: "skirt", d: skirtPath(a, g), role: "fabric", itemId: slots.bottom.id, order: 1, pattern: look.pattern });
    } else {
      // 두 다리통 사이의 그늘 — 하의보다 먼저 깔아 둔다.
      // (이게 없으면 바지 사이로 마네킹 맨다리가 밝게 비쳐 바지가 갈라진 것처럼 보인다)
      const gapHalf = a.legOffAnkle + 1.5;
      out.push({
        key: "bottom-gap",
        d: `M${P(CX - gapHalf, a.y.crotch)} L${P(CX + gapHalf, a.y.crotch)} L${P(CX + gapHalf, g.hemY + 1)} L${P(CX - gapHalf, g.hemY + 1)} Z`,
        role: "shade",
        itemId: slots.bottom.id,
        order: 1,
        fill: "#22302b",
        opacity: 0.72,
      });
      out.push({ key: "leg-l", d: legGarmentPath(a, g, -1), role: "fabric", itemId: slots.bottom.id, order: 1, pattern: look.pattern });
      out.push({ key: "leg-r", d: legGarmentPath(a, g, 1), role: "fabric", itemId: slots.bottom.id, order: 1, pattern: look.pattern });
      // 허리 밴드
      out.push({
        key: "waistband",
        d: `M${P(CX - g.waistW, g.waistY)} L${P(CX + g.waistW, g.waistY)} L${P(CX + g.waistW * 1.02, g.waistY + 4)} L${P(CX - g.waistW * 1.02, g.waistY + 4)} Z`,
        role: "shade",
        itemId: slots.bottom.id,
        order: 1,
        opacity: 0.45,
      });
    }
  }

  // 2. 원피스 또는 상의
  if (slots.dress) {
    const look = lookOf(slots.dress);
    const g = topGeom(a, slots.dress, look);
    out.push({ key: "dress", d: dressPath(a, slots.dress, g), role: "fabric", itemId: slots.dress.id, order: 2, pattern: look.pattern });
  } else if (slots.top) {
    const look = lookOf(slots.top);
    const g = topGeom(a, slots.top, look);
    // 몸판을 먼저, 소매를 그 위에 — 소매 진동(armhole) 솔기가 보여야 팔이 몸통과 구분된다
    out.push({ key: "top-body", d: topBodyPath(a, g), role: "fabric", itemId: slots.top.id, order: 2, pattern: look.pattern });
    out.push({ key: "top-sleeve-l", d: sleevePath(a, g, -1, g.sleeveEndY, 1.2), role: "fabric", itemId: slots.top.id, order: 2, pattern: look.pattern });
    out.push({ key: "top-sleeve-r", d: sleevePath(a, g, 1, g.sleeveEndY, 1.2), role: "fabric", itemId: slots.top.id, order: 2, pattern: look.pattern });
    // 셔츠는 칼라·앞단이 있어야 셔츠로 읽힌다
    if (look.kind === "shirt" || look.kind === "polo") {
      const nh = g.neckHalf;
      out.push({
        key: "top-collar-l",
        d: `M${P(CX - nh, a.y.neck + 1)} L${P(CX - 1.2, a.y.neck + 7)} L${P(CX - nh - 3.2, a.y.neck + 5)} Z`,
        role: "shade", itemId: slots.top.id, order: 2, opacity: 0.5,
      });
      out.push({
        key: "top-collar-r",
        d: `M${P(CX + nh, a.y.neck + 1)} L${P(CX + 1.2, a.y.neck + 7)} L${P(CX + nh + 3.2, a.y.neck + 5)} Z`,
        role: "shade", itemId: slots.top.id, order: 2, opacity: 0.5,
      });
      out.push({
        key: "top-placket",
        d: `M${P(CX - 1.4, a.y.neck + 3)} L${P(CX + 1.4, a.y.neck + 3)} L${P(CX + 1.4, g.hemY - 1)} L${P(CX - 1.4, g.hemY - 1)} Z`,
        role: "shade", itemId: slots.top.id, order: 2, opacity: 0.4,
      });
    }
  }

  // 3. 아우터 앞 — 소매 → 앞판 좌우(가운데를 비운다) → 라펠·칼라
  if (slots.outer && outerG && outerLook) {
    const id = slots.outer.id;
    const gapHalf = Math.max(outerG.bodyW * 0.3, 3.2);
    const vest = outerLook.kind === "vest";
    out.push({ key: "outer-panel-l", d: outerPanelPath(a, outerG, -1, gapHalf), role: "fabric", itemId: id, order: 3, pattern: outerLook.pattern });
    out.push({ key: "outer-panel-r", d: outerPanelPath(a, outerG, 1, gapHalf), role: "fabric", itemId: id, order: 3, pattern: outerLook.pattern });
    if (!vest) {
      out.push({ key: "outer-sleeve-l", d: sleevePath(a, outerG, -1, a.y.wrist - 1, 2.4), role: "fabric", itemId: id, order: 4, pattern: outerLook.pattern });
      out.push({ key: "outer-sleeve-r", d: sleevePath(a, outerG, 1, a.y.wrist - 1, 2.4), role: "fabric", itemId: id, order: 4, pattern: outerLook.pattern });
    }
    if (outerLook.kind === "jacket" || outerLook.kind === "coat") {
      out.push({ key: "outer-lapel-l", d: lapelPath(a, outerG, -1, gapHalf), role: "shade", itemId: id, order: 4, opacity: 0.42 });
      out.push({ key: "outer-lapel-r", d: lapelPath(a, outerG, 1, gapHalf), role: "shade", itemId: id, order: 4, opacity: 0.42 });
    }
    out.push({ key: "outer-collar", d: collarPath(a, outerG), role: "fabric", itemId: id, order: 4, pattern: outerLook.pattern });
  }

  // 4. 신발
  if (slots.shoe) {
    const look = lookOf(slots.shoe);
    out.push({ key: "shoe-l", d: shoePath(a, look, -1), role: "fabric", itemId: slots.shoe.id, order: 5, pattern: "solid" });
    out.push({ key: "shoe-r", d: shoePath(a, look, 1), role: "fabric", itemId: slots.shoe.id, order: 5, pattern: "solid" });
    out.push({ key: "sole-l", d: solePath(a, -1), role: "sole", itemId: slots.shoe.id, order: 5 });
    out.push({ key: "sole-r", d: solePath(a, 1), role: "sole", itemId: slots.shoe.id, order: 5 });
  }

  return out;
}

/** 착장에 쓰인 옷들 — 색·패턴 def 를 만들 때 쓴다 */
export function outfitItems(slots: OutfitSlotsLike): Item[] {
  return [slots.outer, slots.dress, slots.top, slots.bottom, slots.shoe].filter(
    (x): x is Item => !!x
  );
}

/**
 * 옷 한 점이 마네킹에서 차지하는 전체 영역 — 그 옷의 조각들을 합친 사각형.
 * 실사 원단 사진을 이 상자에 맞춰 채우면 몸판·소매의 무늬가 끊기지 않고 이어진다.
 */
export function textureBoxes(pieces: MqPiece[]): Map<string, Box> {
  const byItem = new Map<string, Box[]>();
  for (const p of pieces) {
    if (p.role !== "fabric") continue;
    const list = byItem.get(p.itemId) ?? [];
    list.push(pathBBox(p.d));
    byItem.set(p.itemId, list);
  }
  const out = new Map<string, Box>();
  for (const [id, boxes] of byItem) out.set(id, unionBox(boxes));
  return out;
}
