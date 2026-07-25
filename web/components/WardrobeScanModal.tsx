"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "./app-context";
import { Icon } from "./Sprite";
import type { ClothState } from "@/lib/data";
import { cropDataUrl, loadOriented, scaleImage, type Box } from "@/lib/image";
import { resolveCategory } from "@/lib/garment";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

interface RawItem {
  name?: string;
  category?: string;
  color?: string;
  material?: string;
  fit?: string;
  /** 접혀 있거나 개켜져 있는지 — 접힌 바지를 상의로 오인하지 않게 서버가 함께 판단한다 */
  folded?: boolean;
  /** 서버가 카테고리를 교정했을 때의 원래 값 */
  categoryFrom?: string;
  box?: Box; // 품목이 사진에서 차지하는 영역(백분율) — 품목별 썸네일 크롭에 사용
}
interface Draft {
  id: string;
  thumb: string;
  name: string;
  category: string;
  color: string;
  material: string;
  fit: string;
  checked: boolean;
  folded: boolean;
  /** 카테고리가 교정됐다면 원래 판정 (사용자에게 근거를 보여준다) */
  correctedFrom?: string;
}

// 액세서리(선글라스 포함)는 분석·등록 대상에서 제외한다
const CATEGORY_OPTIONS = ["상의", "니트", "하의", "아우터", "원피스", "신발", "가방"];
// 색·종류가 비슷한 옷을 핏으로 구분한다
const FIT_OPTIONS = [
  "",
  "레귤러",
  "슬림",
  "루즈",
  "오버핏",
  "와이드",
  "크롭",
  "롱",
  "스트레이트",
  "테이퍼드",
];

const CAT_META: Record<string, { type: string; bg: string; color: string }> = {
  상의: { type: "top-g", bg: "#eef0ec", color: "#cfd6d0" },
  니트: { type: "top-g", bg: "#ece7db", color: "#cbbfa6" },
  하의: { type: "pants", bg: "#e2e7ec", color: "#6b83a0" },
  아우터: { type: "coat", bg: "#efe9de", color: "#d8c9ad" },
  원피스: { type: "top-g", bg: "#efe6e2", color: "#c8a9a0" },
  신발: { type: "shoe", bg: "#eee5da", color: "#9a7d63" },
  가방: { type: "bag", bg: "#e9e2d8", color: "#9a8a72" },
  액세서리: { type: "acc", bg: "#e8e4ea", color: "#9a90a8" },
};

// 카테고리 판정은 lib/garment 의 결정적 규칙을 그대로 쓴다(서버 rules.rs 와 동일 규칙).
// 이름에 '슬랙스·바지' 같은 확정 명사가 있으면 모델이 준 카테고리를 이긴다.
function normalizeCat(raw?: string, name?: string): string {
  return resolveCategory(name ?? "", raw);
}

// 비전이 돌려준 핏 표현을 편집 가능한 선택지로 정규화(모르면 빈 값)
function normalizeFit(raw?: string): string {
  const r = (raw ?? "").trim();
  if (FIT_OPTIONS.includes(r)) return r;
  if (/오버|박시|루즈핏|오버사이즈/.test(r)) return "오버핏";
  if (/슬림|스키니|타이트|핏된/.test(r)) return "슬림";
  if (/루즈|릴렉스|여유/.test(r)) return "루즈";
  if (/와이드|통넓은/.test(r)) return "와이드";
  if (/크롭|짧은 기장/.test(r)) return "크롭";
  if (/롱|긴 기장|롱기장/.test(r)) return "롱";
  if (/스트레이트|일자/.test(r)) return "스트레이트";
  if (/테이퍼|아래로 좁아/.test(r)) return "테이퍼드";
  if (/레귤러|스탠다드|기본|보통/.test(r)) return "레귤러";
  return "";
}

// 한 번의 이미지 로드로 분석용(큰)·썸네일용(작은) data URL 두 개 생성.
// EXIF 회전을 먼저 반영해 누운 사진이 그대로 분석되지 않게 한다(옷 종류 오인 방지).
async function downscale(file: File): Promise<{ analyzeUrl: string; thumbUrl: string }> {
  if (!file.type.startsWith("image/")) throw new Error("type");
  const img = await loadOriented(file);
  const analyzeUrl = scaleImage(img, 1024, 0.82);
  const thumbUrl = scaleImage(img, 384, 0.62);
  if (!analyzeUrl) throw new Error("canvas");
  return { analyzeUrl, thumbUrl };
}

const POOL = 3; // 동시 분석 상한(rate-limit·부하 완화)

export function WardrobeScanModal({ open, onClose, onAdded }: Props) {
  const { addClothing, toast } = useApp();
  const [phase, setPhase] = useState<"pick" | "analyzing" | "review">("pick");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [aiCount, setAiCount] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [accSkipped, setAccSkipped] = useState(0); // 액세서리로 판정되어 제외한 수
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const seq = useRef(0);
  const busy = useRef(false);
  const appendRef = useRef(false); // '사진 더 넣기' 로 이어붙일지

  const reset = () => {
    setPhase("pick");
    setProgress({ done: 0, total: 0 });
    setDrafts([]);
    setAiCount(0);
    setSkipped(0);
    setAccSkipped(0);
    seq.current = 0;
    busy.current = false;
    appendRef.current = false;
  };

  const closeAll = () => {
    reset();
    onClose();
  };

  // Esc 로 닫기(분석 중에는 무시) — reset 을 거쳐 stale draft 재추가 방지
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "analyzing") closeAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase]);

  // 열림: 포커스 이동 + 닫힘 시 트리거로 복귀
  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(
      () => dialogRef.current?.querySelector<HTMLElement>("button,input,select")?.focus(),
      0
    );
    return () => {
      clearTimeout(t);
      const el = triggerRef.current;
      if (el && document.contains(el)) el.focus();
    };
  }, [open]);

  const trapTab = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    );
    if (!nodes || nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  async function detect(dataUrl: string): Promise<RawItem[]> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch("/api/wardrobe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error("status");
      const data = await res.json();
      const items: RawItem[] = Array.isArray(data?.items) ? data.items : [];
      // 옷장 전체 사진 한 장에 여러 벌이 담기므로 상한을 넉넉히 둔다(서버도 24개로 제한)
      return items.slice(0, 24).filter((x) => x && typeof x.name === "string" && x.name.trim());
    } finally {
      clearTimeout(timer);
    }
  }

  const makeDraft = (thumb: string, it: RawItem): Draft => {
    const name = (it.name ?? "").trim() || "새 옷";
    const category = normalizeCat(it.category, name);
    const from = (it.categoryFrom ?? it.category ?? "").trim();
    return {
      id: `d-${seq.current++}`,
      thumb,
      name,
      category,
      color: (it.color ?? "").trim(),
      material: (it.material ?? "").trim(),
      fit: normalizeFit(it.fit),
      checked: true,
      folded: it.folded === true,
      correctedFrom: from && from !== category ? from : undefined,
    };
  };

  const runAnalyze = async (files: File[], append: boolean) => {
    if (busy.current || files.length === 0) return;
    busy.current = true;
    setPhase("analyzing");
    setProgress({ done: 0, total: files.length });
    // append 면 기존 검수 목록·편집을 보존한 채 이어붙인다
    const collected: Draft[] = append ? [...drafts] : [];
    if (!append) {
      setDrafts([]);
      setAiCount(0);
      setSkipped(0);
      setAccSkipped(0);
      seq.current = 0;
    }
    let done = 0;
    let detected = 0;
    let localSkipped = 0;
    let localAcc = 0;

    const worker = async (start: number) => {
      for (let i = start; i < files.length; i += POOL) {
        const file = files[i];
        try {
          const { analyzeUrl, thumbUrl } = await downscale(file);
          let items: RawItem[] = [];
          try {
            items = await detect(analyzeUrl);
          } catch {
            items = [];
          }
          // 액세서리(선글라스·모자 등)는 등록 대상이 아니다 — 모델이 걸러도 한 번 더 방어
          const kept = items.filter((it) => normalizeCat(it.category, it.name) !== "액세서리");
          localAcc += items.length - kept.length;
          if (items.length === 0) {
            // 옷을 못 찾았거나 분석 실패 → 사진을 잃지 않도록 편집 초안 1점
            collected.push(makeDraft(thumbUrl, { name: "새 옷", category: "상의" }));
          } else if (kept.length > 0) {
            detected += kept.length;
            // 품목별로 사진에서 해당 영역만 잘라 각자의 썸네일을 만든다(실패 시 원본 축소본)
            for (const it of kept) {
              // 한 장에서 최대 24벌이 나올 수 있으므로 썸네일을 조금 작게 — 저장 용량 보호
              const cropped = await cropDataUrl(analyzeUrl, it.box, { outMax: 320, quality: 0.62 });
              collected.push(makeDraft(cropped ?? thumbUrl, it));
            }
          }
          // items 는 있었지만 전부 액세서리 → 초안을 만들지 않고 제외 집계만
        } catch {
          // 이미지가 아니거나(HEIC 등) 로드 실패 → 건너뛰고 집계
          localSkipped += 1;
        } finally {
          done += 1;
          setProgress({ done, total: files.length });
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(POOL, files.length) }, (_, k) => worker(k))
    );
    setDrafts(collected);
    setAiCount((prev) => (append ? prev : 0) + detected);
    setSkipped((prev) => (append ? prev : 0) + localSkipped);
    setAccSkipped((prev) => (append ? prev : 0) + localAcc);
    if (localSkipped > 0) {
      toast(`${localSkipped}장은 읽을 수 없는 형식이라 건너뛰었어요`);
    } else if (localAcc > 0) {
      toast(`액세서리 ${localAcc}점은 등록 대상에서 제외했어요`);
    }
    setPhase("review");
    busy.current = false;
  };

  const onPick = (list: FileList | null) => {
    const files = list ? Array.from(list).slice(0, 24) : [];
    const append = appendRef.current;
    appendRef.current = false;
    if (files.length) runAnalyze(files, append);
  };

  const checkedCount = drafts.filter((d) => d.checked).length;
  const allChecked = drafts.length > 0 && checkedCount === drafts.length;

  const patch = (id: string, up: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...up } : d)));

  const addSelected = () => {
    const chosen = drafts.filter((d) => d.checked);
    if (!chosen.length) {
      toast("추가할 옷을 하나 이상 선택해 주세요");
      return;
    }
    for (const d of chosen) {
      const meta = CAT_META[d.category] ?? CAT_META["상의"];
      addClothing({
        name: d.name.trim() || "새 옷",
        cat: `${d.category} · 옷장 1`,
        state: "available" as ClothState,
        label: "입을 수 있음",
        bg: meta.bg,
        type: meta.type,
        color: meta.color,
        wear: "0회",
        cpw: "—",
        img: d.thumb,
        daysAgo: 0,
        fit: d.fit || undefined,
      });
    }
    toast(`${chosen.length}점을 옷장에 추가했어요`);
    onAdded?.();
    reset();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="modal-back show"
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== "analyzing") closeAll();
      }}
    >
      <div
        className="modal wardrobe-scan"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wsTitle"
        ref={dialogRef}
        onKeyDown={trapTab}
      >
        <h2 id="wsTitle">사진으로 옷장 채우기</h2>
        <p>
          옷장을 한 장에 담아 찍어도 옷을 한 벌씩 분리해 품목별로 잘라낸 썸네일과 함께 목록으로
          만들어요(한 장 최대 24벌). 접혀 걸린 바지는 이름·형태 단서로 하의로 교정하고, 누운 사진은
          자동으로 바로 세워 분석해요. 썸네일은 이 기기에만 저장되고 원본 사진은 분석에만 쓰여요.
          액세서리(선글라스 등)는 등록하지 않아요.
        </p>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            onPick(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            onPick(e.target.files);
            e.target.value = "";
          }}
        />

        {phase === "pick" && (
          <>
            <div className="ws-pick">
              <button className="ws-pick-card" onClick={() => cameraRef.current?.click()}>
                <span className="ws-emoji">📷</span>
                <b>옷장 촬영</b>
                <span>한 장에서 여러 벌을 각각 아이템으로</span>
              </button>
              <button className="ws-pick-card" onClick={() => galleryRef.current?.click()}>
                <span className="ws-emoji">🖼️</span>
                <b>갤러리에서 선택</b>
                <span>여러 장을 골라 한꺼번에 등록</span>
              </button>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={closeAll}>
                {drafts.length ? "검수로 돌아가기" : "닫기"}
              </button>
            </div>
          </>
        )}

        {phase === "analyzing" && (
          <div className="ws-analyzing" role="status" aria-live="polite">
            <div className="ws-spinner" aria-hidden="true" />
            <b>사진을 분석하고 있어요…</b>
            <span>
              {progress.done} / {progress.total} 장 완료
            </span>
            <div className="ws-bar">
              <i
                style={{
                  width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {phase === "review" &&
          (drafts.length === 0 ? (
            <div className="ws-empty">
              <b>
                {skipped > 0
                  ? "사진을 읽을 수 없어요"
                  : accSkipped > 0
                  ? "등록할 옷을 찾지 못했어요"
                  : "사진에서 옷을 찾지 못했어요"}
              </b>
              <p>
                {skipped > 0
                  ? "HEIC 등 지원하지 않는 형식일 수 있어요. JPG·PNG 사진으로 다시 시도해 보세요."
                  : accSkipped > 0
                  ? `액세서리 ${accSkipped}점만 인식됐어요. 액세서리는 등록 대상이 아니에요.`
                  : "옷이 잘 보이는 사진으로 다시 시도해 보세요."}
              </p>
              <div className="modal-actions">
                <button className="btn" onClick={closeAll}>
                  닫기
                </button>
                <button className="btn primary" onClick={() => setPhase("pick")}>
                  다시 시도
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="ws-review-head" role="status" aria-live="polite">
                <span>
                  {aiCount > 0
                    ? `옷 ${drafts.length}점을 찾았어요`
                    : "인식이 어려워 초안을 만들었어요"}{" "}
                  · <b>{checkedCount}</b>점 선택됨
                  {skipped > 0 && ` · ${skipped}장 건너뜀`}
                  {accSkipped > 0 && ` · 액세서리 ${accSkipped}점 제외`}
                </span>
                <button
                  className="text-link"
                  onClick={() =>
                    setDrafts((prev) => prev.map((d) => ({ ...d, checked: !allChecked })))
                  }
                >
                  {allChecked ? "전체 해제" : "전체 선택"}
                </button>
              </div>
              <div className="ws-grid">
                {drafts.map((d) => (
                  <div className={"ws-card" + (d.checked ? " on" : "")} key={d.id}>
                    <label className="ws-check">
                      <input
                        type="checkbox"
                        checked={d.checked}
                        onChange={(e) => patch(d.id, { checked: e.target.checked })}
                        aria-label={`${d.name} 선택`}
                      />
                    </label>
                    <div className="ws-thumb">
                      <img src={d.thumb} alt={d.name} />
                      {(d.folded || d.correctedFrom) && (
                        <div className="ws-flags">
                          {d.folded && <span className="ws-flag">접힘</span>}
                          {d.correctedFrom && (
                            <span className="ws-flag fix">{d.correctedFrom}→{d.category}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="ws-fields">
                      <input
                        className="ws-name"
                        value={d.name}
                        aria-label="옷 이름"
                        onChange={(e) => patch(d.id, { name: e.target.value })}
                      />
                      <div className="ws-row">
                        <select
                          className="ws-cat"
                          value={d.category}
                          aria-label="카테고리"
                          onChange={(e) => patch(d.id, { category: e.target.value })}
                        >
                          {CATEGORY_OPTIONS.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                        <select
                          className="ws-cat ws-fit"
                          value={d.fit}
                          aria-label="핏"
                          onChange={(e) => patch(d.id, { fit: e.target.value })}
                        >
                          {FIT_OPTIONS.map((f) => (
                            <option key={f || "none"} value={f}>
                              {f || "핏 미지정"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="modal-actions">
                <button
                  className="btn"
                  onClick={() => {
                    appendRef.current = true;
                    setPhase("pick");
                  }}
                >
                  사진 더 넣기
                </button>
                <button className="btn primary" onClick={addSelected}>
                  선택 {checkedCount}점 옷장에 추가
                </button>
              </div>
            </>
          ))}
      </div>
    </div>
  );
}
