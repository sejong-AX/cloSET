"use client";

/** 저장·기록된 착장 전체 보기 — '지난주 그 조합 > 모두 보기'에서 열린다. */

import { useEffect } from "react";
import { useApp } from "./app-context";
import { Icon } from "./Sprite";
import { dayKey, pruneLog, type OutfitLogEntry } from "@/lib/outfit";

interface Props {
  open: boolean;
  onClose: () => void;
  onWear: (entry: OutfitLogEntry) => void;
}

const label = (at: number) => {
  const d = Math.round((Date.now() - at) / 86400000);
  if (dayKey(at) === dayKey()) return "오늘";
  if (d <= 1) return "어제";
  if (d < 7) return `${d}일 전`;
  return new Date(at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
};

export function PastOutfitsModal({ open, onClose, onWear }: Props) {
  const { outfitLog, items, clearHistory, toast } = useApp();
  const log = pruneLog(outfitLog, items);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-back show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal past-modal" role="dialog" aria-modal="true" aria-labelledby="pastTitle">
        <h2 id="pastTitle">착장 기록</h2>
        <p>
          ‘오늘 입을게요’로 기록한 착장이 최신순으로 쌓여요. 옷장에서 옷을 지우면 그 옷이 들어간
          기록은 자동으로 정리돼요.
        </p>
        {log.length === 0 ? (
          <div className="trash-empty">
            <Icon id="i-home" />
            <b>아직 기록이 없어요</b>
            <span>오늘의 착장에서 ‘오늘 입을게요’를 눌러보세요.</span>
          </div>
        ) : (
          <div className="past-list">
            {log.map((e) => {
              const list = e.ids
                .map((id) => items.find((x) => x.id === id))
                .filter((x): x is NonNullable<typeof x> => !!x);
              return (
                <div className="past-row" key={`${e.sig}-${e.at}`}>
                  <div className="past-thumbs">
                    {list.slice(0, 4).map((x) => (
                      <span key={x.id}>
                        <img src={x.img} alt={x.name} />
                      </span>
                    ))}
                  </div>
                  <div className="past-info">
                    <b>{e.title}</b>
                    <span>
                      {label(e.at)} · {e.gender === "male" ? "남성" : "여성"} 기준 · {list.length}벌
                    </span>
                  </div>
                  <button className="btn primary" onClick={() => onWear(e)}>
                    다시 입기
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="modal-actions">
          {log.length > 0 && (
            <button
              className="btn danger"
              onClick={() => {
                clearHistory();
                toast("착장 기록을 초기화했어요");
                onClose();
              }}
            >
              기록 초기화
            </button>
          )}
          <button className="btn primary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
