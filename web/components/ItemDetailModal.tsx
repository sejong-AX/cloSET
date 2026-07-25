"use client";

/**
 * 옷 상세 — 내 옷장에서 옷 카드를 누르면 열린다.
 * 상태·착용·케어·코디 4개 탭. 목업 토스트가 아니라 실제로 상태를 바꾸고 코디를 적용한다.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "./app-context";
import { Icon } from "./Sprite";
import { Mannequin } from "./Mannequin";
import { careNote, objectParticle, wearCount, STATE_LABEL, type ClothState, type Item } from "@/lib/data";
import { categoryOfItem, slotOfItem } from "@/lib/garment";
import { buildOutfits, outfitsWithItem, type Outfit } from "@/lib/outfit";

interface Props {
  item: Item | null;
  onClose: () => void;
  /** 조합을 오늘의 착장으로 올릴 때 */
  onUseOutfit?: (outfit: Outfit) => void;
}

const TABS = ["개요", "케어", "코디"] as const;
type Tab = (typeof TABS)[number];

const STATES: { key: ClothState; label: string; hint: string }[] = [
  { key: "available", label: "입을 수 있음", hint: "지금 바로 꺼내 입을 수 있어요" },
  { key: "laundry", label: "세탁 필요", hint: "케어 대기열로 보내요" },
  { key: "stored", label: "보관", hint: "계절 보관함에 넣어둬요" },
  { key: "reuse", label: "순환 후보", hint: "나눔·판매·수선을 검토해요" },
];

interface Guide {
  title: string;
  tempC: number;
  symbols: string[];
  body: string;
  source?: string;
}

export function ItemDetailModal({ item, onClose, onUseOutfit }: Props) {
  const {
    toast,
    items,
    gender,
    favorites,
    toggleFavorite,
    setClothingState,
    bumpWear,
    removeClothing,
    restoreClothing,
    switchView,
  } = useApp();
  const [tab, setTab] = useState<Tab>("개요");
  const [guide, setGuide] = useState<Guide | null>(null);
  const [loadingGuide, setLoadingGuide] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // 항상 옷장의 최신 상태를 보여준다(상태를 바꾼 직후에도 즉시 반영)
  const live = useMemo(() => (item ? items.find((x) => x.id === item.id) ?? item : null), [item, items]);

  useEffect(() => {
    if (!item) return;
    setTab("개요");
    setGuide(null);
  }, [item?.id]);

  useEffect(() => {
    if (!item) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => dialogRef.current?.querySelector<HTMLElement>("button")?.focus(), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      const el = triggerRef.current;
      if (el && document.contains(el)) el.focus();
    };
  }, [item, onClose]);

  // 이 옷을 반드시 넣은 추천 조합 (결정적 엔진 재사용, anchor 고정)
  const outfits = useMemo(() => {
    if (!live) return [];
    // 날씨는 상세에서 알 수 없으니 평년 기준 고정값 — 조합 자체는 결정적으로 나온다
    const all = buildOutfits({ items, weather: { apparent: 20, precip: 10 }, gender, anchor: live });
    return outfitsWithItem(all, live.id);
  }, [items, gender, live]);

  const loadGuide = async () => {
    if (!live || loadingGuide) return;
    setLoadingGuide(true);
    try {
      const res = await fetch("/api/care", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ material: live.name }),
      });
      if (!res.ok) throw new Error("status");
      const d = await res.json();
      setGuide({ title: d.title, tempC: d.tempC, symbols: d.symbols, body: d.body, source: d.source });
    } catch {
      toast("케어 가이드를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoadingGuide(false);
    }
  };

  if (!live) return null;

  const fav = favorites.has(live.id);
  const cat = categoryOfItem(live);
  const slot = slotOfItem(live);
  const slotLabel: Record<string, string> = {
    outer: "겉옷 레이어",
    top: "상의 레이어",
    bottom: "하의 레이어",
    dress: "원피스",
    shoe: "신발",
    bag: "가방",
    acc: "액세서리",
  };

  return (
    <div
      className="modal-back show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detailTitle"
        ref={dialogRef}
      >
        <div className="detail-head">
          <div className="detail-photo" style={{ background: live.bg }}>
            <img src={live.img} alt={live.name} />
            <span className="state-badge">{live.label}</span>
          </div>
          <div className="detail-title">
            <div className="eyebrow">
              {cat} · {slotLabel[slot] ?? slot}
            </div>
            <h2 id="detailTitle">{live.name}</h2>
            <p>
              {live.cat}
              {live.fit ? <span className="fit-tag">{live.fit}</span> : null}
            </p>
            <div className="detail-quick">
              <button
                className={"btn" + (fav ? " soft" : "")}
                aria-pressed={fav}
                onClick={() => {
                  toggleFavorite(live.id);
                  toast(fav ? "즐겨찾기에서 뺐어요" : "즐겨찾기에 담았어요");
                }}
              >
                {fav ? "♥ 즐겨찾기" : "♡ 즐겨찾기"}
              </button>
              <button
                className="btn"
                onClick={() => {
                  bumpWear(live.id);
                  toast(`착용 기록을 ${wearCount(live.wear) + 1}회로 올렸어요`);
                }}
              >
                오늘 입었어요
              </button>
            </div>
          </div>
        </div>

        <div className="detail-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? "active" : ""}
              onClick={() => {
                setTab(t);
                if (t === "케어" && !guide) loadGuide();
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="detail-body">
          {tab === "개요" && (
            <>
              <div className="detail-stats">
                <div>
                  <span>착용</span>
                  <b>{live.wear}</b>
                </div>
                <div>
                  <span>회당 비용</span>
                  <b>{live.cpw}</b>
                </div>
                <div>
                  <span>마지막 착용</span>
                  <b>{live.daysAgo === 0 ? "오늘" : `${live.daysAgo}일 전`}</b>
                </div>
                <div>
                  <span>상태</span>
                  <b>{live.label}</b>
                </div>
              </div>
              <div className="detail-section">
                <h3>상태 바꾸기</h3>
                <div className="state-grid">
                  {STATES.map((s) => (
                    <button
                      key={s.key}
                      className={"state-btn" + (live.state === s.key ? " active" : "")}
                      aria-pressed={live.state === s.key}
                      onClick={() => {
                        if (live.state === s.key) return;
                        setClothingState(live.id, s.key);
                        toast(`'${live.name}'${objectParticle(live.name)} ${STATE_LABEL[s.key]}으로 바꿨어요`);
                      }}
                    >
                      <b>{s.label}</b>
                      <span>{s.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="detail-section">
                <h3>정리하기</h3>
                <div className="detail-actions-row">
                  <button
                    className="btn"
                    onClick={() => {
                      setClothingState(live.id, "reuse");
                      switchView("reuse");
                      onClose();
                    }}
                  >
                    <Icon id="i-reuse" />
                    순환 경로 보기
                  </button>
                  <button
                    className="btn danger"
                    onClick={() => {
                      removeClothing(live);
                      onClose();
                      toast(`'${live.name}'${objectParticle(live.name)} 휴지통으로 옮겼어요`, {
                        label: "되돌리기",
                        onAction: () => restoreClothing(live),
                      });
                    }}
                  >
                    <Icon id="i-trash" />
                    휴지통으로
                  </button>
                </div>
              </div>
            </>
          )}

          {tab === "케어" && (
            <>
              <div className="detail-care">
                <div className="guide-icon">{guide ? `${guide.tempC}°` : "≈"}</div>
                <div>
                  <h3>{guide?.title ?? "소재별 케어 기준"}</h3>
                  <p>
                    {loadingGuide
                      ? "케어라벨 기준을 불러오는 중이에요…"
                      : guide?.body ?? `${careNote(live.name)} — 자세한 기준을 불러올 수 있어요.`}
                  </p>
                  {guide && (
                    <div className="symbol-row">
                      {guide.symbols.map((sym, i) => (
                        <div className="wash-symbol" key={i}>
                          {sym}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="detail-actions-row">
                <button className="btn" onClick={loadGuide} disabled={loadingGuide}>
                  <Icon id="i-scan" />
                  {loadingGuide ? "분석 중…" : guide ? "다시 분석" : "케어 기준 불러오기"}
                </button>
                <button
                  className="btn primary"
                  onClick={() => {
                    setClothingState(live.id, "laundry");
                    switchView("care");
                    onClose();
                    toast("케어 대기열에 담았어요");
                  }}
                >
                  <Icon id="i-care" />
                  케어 대기열로 보내기
                </button>
              </div>
              {guide?.source === "fallback" && (
                <p className="detail-note">소재 규칙 기준으로 계산한 안내예요.</p>
              )}
            </>
          )}

          {tab === "코디" && (
            <>
              {outfits.length === 0 ? (
                <div className="mini-empty">
                  <b>이 옷으로 만들 조합이 아직 없어요</b>
                  <span>같이 입을 상의·하의·신발을 옷장에 더 등록하면 조합이 만들어져요.</span>
                </div>
              ) : (
                <div className="detail-outfits">
                  {outfits.map((o) => (
                    <div className="detail-outfit" key={o.sig}>
                      <div className="detail-outfit-mq">
                        <Mannequin slots={o.slots} gender={gender} uid={`d-${o.sig.length}-${o.tpo.key}`} showScale={false} />
                      </div>
                      <div className="detail-outfit-info">
                        <div className="eyebrow">
                          {o.tpo.icon} {o.tpo.label}
                        </div>
                        <b>{o.title}</b>
                        <span>{o.items.map((x) => x.name).join(" · ")}</span>
                        <button
                          className="btn primary"
                          onClick={() => {
                            onUseOutfit?.(o);
                            onClose();
                          }}
                        >
                          이 조합 입기
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn primary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
