"use client";

/**
 * 오늘의 착장 마네킹 — 각 옷 사진을 미리 생성한 '고스트 마네킹 컷아웃'(투명 PNG,
 * public/items/flat/*)으로 마네킹 위에 종이인형처럼 레이어링한다.
 * 원단 질감·실제 옷 모양이 그대로 보존되고, 런타임 AI 호출은 없다(정적 자산).
 * 여성/남성은 몸 실루엣과 의류 폭 배율로 구분한다.
 */

export type MannequinGender = "female" | "male";

interface Rack {
  coat: string;
  top: string;
  pants: string;
  shoe: string;
}
interface Alt {
  coat: string;
  top: string;
  pants: string;
  shoe: string;
}
interface Props {
  rack: Rack;
  alt: Alt;
  gender: MannequinGender;
}

const C = 120; // 중심축 (viewBox 0 0 240 470)
const f = (n: number) => n.toFixed(1);

/** "/items/coat.jpg" → "/items/flat/coat.png" (마네킹용 컷아웃) */
const flatSrc = (img: string) =>
  img.replace(/^\/items\//, "/items/flat/").replace(/\.(jpg|jpeg|webp)$/i, ".png");

// 체형 파라미터(중심 기준 half-width) — 몸 실루엣용
const DIMS: Record<MannequinGender, { sh: number; chest: number; waist: number; hip: number; scale: number }> = {
  female: { sh: 40, chest: 33, waist: 25, hip: 38, scale: 1 },
  male: { sh: 48, chest: 40, waist: 33, hip: 34, scale: 1.08 },
};

/** 드레스폼 몸통+다리 실루엣 */
function bodyPath(sh: number, chest: number, waist: number, hip: number): string {
  return [
    `M${f(C - sh + 7)},86`,
    `C${f(C - chest - 2)},110 ${f(C - waist - 1)},150 ${f(C - waist)},178`,
    `C${f(C - hip)},203 ${f(C - hip)},213 ${f(C - hip + 1)},224`,
    `C${f(C - hip + 2)},272 ${f(C - 19)},340 ${f(C - 15)},424`,
    `L${f(C - 5)},424`,
    `C${f(C - 7)},330 ${f(C - 3)},274 ${C},254`,
    `C${f(C + 3)},274 ${f(C + 7)},330 ${f(C + 5)},424`,
    `L${f(C + 15)},424`,
    `C${f(C + 19)},340 ${f(C + hip - 2)},272 ${f(C + hip - 1)},224`,
    `C${f(C + hip)},213 ${f(C + hip)},203 ${f(C + waist)},178`,
    `C${f(C + waist + 1)},150 ${f(C + chest + 2)},110 ${f(C + sh - 7)},86`,
    `Q${C},76 ${f(C - sh + 7)},86 Z`,
  ].join(" ");
}

/** 팔(캡슐) */
function armPath(x1: number, y1: number, x2: number, y2: number, r: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * r;
  const ny = (dx / len) * r;
  return `M${f(x1 + nx)},${f(y1 + ny)} A${r},${r} 0 0 1 ${f(x1 - nx)},${f(y1 - ny)} L${f(
    x2 - nx
  )},${f(y2 - ny)} A${r},${r} 0 0 1 ${f(x2 + nx)},${f(y2 + ny)} Z`;
}

/** 의류 레이어 배치 상자 — 실제 옷 컷아웃(PNG)이 이 상자 안에 비율 유지로 놓인다 */
function slotBoxes(scale: number) {
  const w = (n: number) => n * scale;
  return {
    coat: { x: C - w(88), y: 74, w: w(176), h: 268, align: "xMidYMin" },
    pants: { x: C - w(47), y: 198, w: w(94), h: 246, align: "xMidYMin" },
    top: { x: C - w(55), y: 92, w: w(110), h: 148, align: "xMidYMin" },
    shoe: { x: C - w(52), y: 398, w: w(104), h: 58, align: "xMidYMax" },
  } as const;
}

export function OutfitMannequin({ rack, alt, gender }: Props) {
  const { sh, chest, waist, hip, scale } = DIMS[gender];
  const boxes = slotBoxes(scale);
  // 레이어 순서: 아우터(맨 뒤) → 하의 → 상의 → 신발. 상의가 코트 앞판·바지 허리를 덮는다.
  const layers = [
    { key: "coat", src: flatSrc(rack.coat), box: boxes.coat },
    { key: "pants", src: flatSrc(rack.pants), box: boxes.pants },
    { key: "top", src: flatSrc(rack.top), box: boxes.top },
    { key: "shoe", src: flatSrc(rack.shoe), box: boxes.shoe },
  ] as const;

  return (
    <svg
      className="mannequin"
      viewBox="0 0 240 470"
      role="img"
      aria-label={`${gender === "female" ? "여성" : "남성"} 마네킹 착장: ${alt.coat}, ${alt.top}, ${alt.pants}, ${alt.shoe}`}
    >
      <defs>
        <filter id="garment-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="5" stdDeviation="7" floodColor="#1c2a24" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* 드레스폼 몸체 */}
      <g fill="#e7decd" stroke="rgba(31,42,38,.15)" strokeWidth="1.4">
        <circle cx={C} cy={38} r={17.5} />
        <rect x={C - 7.5} y={58} width={15} height={30} rx={6.5} />
        <path d={bodyPath(sh, chest, waist, hip)} />
        <path d={armPath(C - sh + 2, 96, C - sh - 8, 250, 7.5)} />
        <path d={armPath(C + sh - 2, 96, C + sh + 8, 250, 7.5)} />
      </g>

      {/* 실제 옷 컷아웃 레이어 */}
      {layers.map((l, i) => (
        <g
          className="doll-item"
          key={l.key}
          style={{ animationDelay: `${i * 90}ms` }}
          filter="url(#garment-shadow)"
          aria-hidden="true"
        >
          <image
            href={l.src}
            x={l.box.x}
            y={l.box.y}
            width={l.box.w}
            height={l.box.h}
            preserveAspectRatio={`${l.box.align} meet`}
          />
        </g>
      ))}

      {/* 바닥 그림자 */}
      <ellipse cx={C} cy={459} rx={60} ry={7} fill="rgba(31,42,38,.10)" />
    </svg>
  );
}
