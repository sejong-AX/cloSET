"use client";

/**
 * 오늘의 착장 마네킹 — 실제 디스플레이 마네킹처럼 보이는 인체에 옷을 "입힌다".
 *
 * 설계
 * - 좌표계 1단위 = 1cm. 여성 160cm · 남성 180cm 를 같은 바닥선에 세우므로 키 차이가 실제 비율로 보인다.
 * - 기하 계산은 전부 lib/mannequin-geom.ts 의 순수 함수 — `npm test` 에서 NaN 0건을 검증한다
 *   (프로덕션 미니파이 인라이닝으로 좌표가 깨진 2026-07-25 사고 재발 방지).
 * - 옷은 사진을 얹지 않는다. 옷장 썸네일(lib/garment-art.ts)과 같은 색·같은 패턴 어휘로 칠해
 *   "옷장에 있는 그 옷"이 마네킹 위에서도 같은 옷으로 보이게 한다.
 * - 아우터는 뒤판 → 하의 → 상의 → 아우터 소매·앞판(가운데를 비움)·칼라 순으로 겹쳐,
 *   겉옷을 열어 걸친 레이어드가 된다(속 상의가 가운데로 보인다).
 * - 런타임 AI 호출 0. 전부 결정적 SVG 계산.
 */

import { useMemo } from "react";
import type { Item } from "@/lib/data";
import type { Gender } from "@/lib/garment";
import type { OutfitSlots } from "@/lib/outfit";
import type { GarmentPattern } from "@/lib/garment-art";
import { paletteOf } from "@/lib/garment-art";
import {
  CX,
  FLOOR,
  STATURE,
  anthro,
  armPath,
  buildOutfitPieces,
  footPath,
  legPath,
  lookOf,
  neckPath,
  outfitItems,
  textureBoxes,
  torsoPath,
} from "@/lib/mannequin-geom";

/**
 * 마네킹에 입힐 실사 원단 — 그 옷의 실제 단품 사진(배경이 지워진 컷)만 쓴다.
 * 만들어낸 그림(data:image/svg+xml)은 평면 도식이라 옷에 채우면 어색하므로 색·패턴으로 칠한다.
 */
function photoTexture(item: Item): string | null {
  return item.img && item.img.startsWith("/items/") ? item.img : null;
}

/** 사진의 가운데(원단이 확실한 부분)만 보이도록 확대해서 채운다 — 잘린 배경이 비치지 않는다 */
const TEXTURE_ZOOM = 1.55;

export type MannequinGender = Gender;
export { STATURE };

interface Props {
  slots: OutfitSlots;
  gender: Gender;
  /** 마스크·그라디언트 id 충돌 방지용 접두사(같은 화면에 여러 개 놓을 때) */
  uid?: string;
  /** 키 눈금자·라벨 표시 */
  showScale?: boolean;
}

/** 옷 한 점의 원단 def — 색 + 패턴(스트라이프·데님·케이블…) */
function FabricDefs({ item, uid }: { item: Item; uid: string }) {
  const look = lookOf(item);
  const { pal } = look;
  const id = `${uid}-pat-${item.id}`;
  const p: GarmentPattern = look.pattern;
  if (p === "stripe") {
    return (
      <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse">
        <rect width="4" height="1.9" fill={pal.deep} opacity="0.45" />
      </pattern>
    );
  }
  if (p === "check") {
    return (
      <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse">
        <rect width="5" height="1.1" fill={pal.deep} opacity="0.38" />
        <rect width="1.1" height="5" fill={pal.deep} opacity="0.38" />
      </pattern>
    );
  }
  if (p === "denim") {
    return (
      <pattern id={id} width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(34)">
        <line x1="0" y1="0" x2="0" y2="2.6" stroke={pal.light} strokeWidth="0.9" opacity="0.35" />
      </pattern>
    );
  }
  if (p === "cable") {
    return (
      <pattern id={id} width="4.2" height="4.2" patternUnits="userSpaceOnUse">
        <line x1="1" y1="0" x2="1" y2="4.2" stroke={pal.light} strokeWidth="1.5" opacity="0.34" />
        <line x1="3" y1="0" x2="3" y2="4.2" stroke={pal.deep} strokeWidth="0.8" opacity="0.24" />
      </pattern>
    );
  }
  // solid·graphic — 밋밋하지 않게 미세한 직조 결만
  return (
    <pattern id={id} width="1.5" height="1.5" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
      <line x1="0" y1="0" x2="0" y2="1.5" stroke="rgba(255,255,255,.1)" strokeWidth="0.6" />
      <line x1="0.75" y1="0" x2="0.75" y2="1.5" stroke="rgba(0,0,0,.05)" strokeWidth="0.5" />
    </pattern>
  );
}

export function Mannequin({ slots, gender, uid = "mq", showScale = true }: Props) {
  const a = useMemo(() => anthro(gender), [gender]);
  const H = STATURE[gender];

  const pieces = useMemo(() => buildOutfitPieces(slots, gender), [slots, gender]);
  const items = useMemo(() => outfitItems(slots), [slots]);
  // 옷 단위 원단 상자 — 몸판·소매가 같은 사진을 나눠 쓰므로 무늬가 이어진다
  const boxes = useMemo(() => textureBoxes(pieces), [pieces]);
  const palettes = useMemo(() => {
    const m = new Map<string, ReturnType<typeof paletteOf>>();
    for (const it of items) m.set(it.id, paletteOf(it.color || "#cfd6d0"));
    return m;
  }, [items]);

  const label = items.map((x) => x.name).join(", ");

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
          <stop offset="0" stopColor="#cdbfa6" />
          <stop offset="0.28" stopColor="#efe6d6" />
          <stop offset="0.58" stopColor="#e4d9c4" />
          <stop offset="1" stopColor="#bfb096" />
        </linearGradient>
        <linearGradient id={`${uid}-round`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0e1a16" stopOpacity="0.3" />
          <stop offset="0.18" stopColor="#0e1a16" stopOpacity="0.06" />
          <stop offset="0.42" stopColor="#ffffff" stopOpacity="0.09" />
          <stop offset="0.76" stopColor="#0e1a16" stopOpacity="0.05" />
          <stop offset="1" stopColor="#0e1a16" stopOpacity="0.28" />
        </linearGradient>
        <linearGradient id={`${uid}-plate`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9aa39e" />
          <stop offset="0.42" stopColor="#d6dbd8" />
          <stop offset="1" stopColor="#8b938f" />
        </linearGradient>
        <filter id={`${uid}-soft`} x="-30%" y="-15%" width="160%" height="140%">
          <feDropShadow dx="0" dy="1.3" stdDeviation="1.7" floodColor="#16241f" floodOpacity="0.22" />
        </filter>
        {items.map((it) => (
          <FabricDefs key={it.id} item={it} uid={uid} />
        ))}
        {pieces.map((p) => (
          <clipPath id={`${uid}-c-${p.key}`} key={p.key}>
            <path d={p.d} />
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

      {/* 몸 — 다리·발 → 몸통 → 목·머리 → 팔.
          팔을 마지막에 그려야 몸통 위로 윤곽선이 보인다(몸통 뒤에 두면 한 덩어리로 뭉쳐 보인다). */}
      <g stroke="rgba(31,42,38,.2)" strokeWidth="0.55" filter={`url(#${uid}-soft)`}>
        <g fill={`url(#${uid}-body)`}>
          <path d={legPath(a, -1)} />
          <path d={legPath(a, 1)} />
          <path d={footPath(a, -1)} />
          <path d={footPath(a, 1)} />
          <path d={torsoPath(a)} />
          <path d={neckPath(a)} />
          {/* 얼굴 없는 추상 마네킹 헤드(달걀형) */}
          <ellipse
            cx={CX}
            cy={(a.y.vertex + a.y.chin) / 2}
            rx={a.w.head}
            ry={(a.y.chin - a.y.vertex) / 2}
          />
          <path d={armPath(a, -1)} />
          <path d={armPath(a, 1)} />
        </g>
      </g>

      {/* 착장 — 아우터 뒤판 → 하의 → 상의 → 아우터 앞판·소매·칼라 → 신발 */}
      {pieces.map((p) => {
        const pal = palettes.get(p.itemId) ?? paletteOf("#cfd6d0");
        if (p.role === "sole") {
          return (
            <path
              className="doll-item"
              key={p.key}
              style={{ animationDelay: `${p.order * 80}ms` }}
              d={p.d}
              fill="#2c332f"
            />
          );
        }
        if (p.role === "shade" || p.role === "line") {
          return (
            <path
              className="doll-item"
              key={p.key}
              style={{ animationDelay: `${p.order * 80}ms` }}
              d={p.d}
              fill={p.role === "line" ? "none" : p.fill ?? pal.shade}
              fillOpacity={p.opacity ?? 0.5}
              stroke={p.role === "line" ? pal.line : "none"}
              strokeWidth={p.strokeWidth ?? 0.6}
            />
          );
        }
        const item = items.find((x) => x.id === p.itemId);
        const photo = item ? photoTexture(item) : null;
        const box = boxes.get(p.itemId);
        return (
          <g
            className="doll-item"
            key={p.key}
            style={{ animationDelay: `${p.order * 80}ms` }}
            filter={`url(#${uid}-soft)`}
          >
            {/* 옷 색 바탕 — 사진에 여백·투명 영역이 있어도 옷으로 읽히게 */}
            <path d={p.d} fill={pal.base} />
            <g clipPath={`url(#${uid}-c-${p.key})`}>
              {photo && box ? (
                // 실사 원단: 그 옷의 실제 사진을 옷 모양 안에 채운다(가운데를 확대해 배경을 피한다)
                <image
                  href={photo}
                  x={box.x - (box.w * (TEXTURE_ZOOM - 1)) / 2}
                  y={box.y - (box.h * (TEXTURE_ZOOM - 1)) / 2}
                  width={box.w * TEXTURE_ZOOM}
                  height={box.h * TEXTURE_ZOOM}
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <path d={p.d} fill={`url(#${uid}-pat-${p.itemId})`} />
              )}
              {p.lining && <path d={p.d} fill="rgba(16,28,23,.26)" />}
              <path d={p.d} fill={`url(#${uid}-round)`} />
            </g>
            <path d={p.d} fill="none" stroke={pal.line} strokeWidth="0.6" strokeOpacity="0.9" />
          </g>
        );
      })}

      {/* 바닥 접지 그림자 */}
      <ellipse cx={CX} cy={FLOOR + 5} rx={H * 0.13} ry={H * 0.017} fill="rgba(31,42,38,.12)" />
    </svg>
  );
}
