"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Sprite";

interface Tip {
  title: string;
  detail: string;
}
interface StyleResult {
  bodyType: string;
  summary: string;
  tips: Tip[];
  recommend: string[];
  source: "openai" | "fallback";
}

interface Props {
  open: boolean;
  onClose: () => void;
  toast: (msg: string) => void;
  bodyType: string;
  season: string;
}

// 전송 payload 를 줄이려 캔버스로 다운스케일 후 data URL 로 변환
function fileToDataUrl(file: File, maxSize = 768): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("img"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const cctx = canvas.getContext("2d");
        if (!cctx) {
          resolve(reader.result as string);
          return;
        }
        cctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function BodyStyleModal({ open, onClose, toast, bodyType, season }: Props) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<StyleResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("이미지 파일(JPG·PNG)만 올릴 수 있어요");
      return;
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    setPhoto(url);
    setResult(null);
    try {
      setDataUrl(await fileToDataUrl(file));
    } catch {
      setDataUrl(null);
    }
  };

  const analyze = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14000);
    try {
      const res = await fetch("/api/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, bodyType, season }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("status");
      const data: StyleResult = await res.json();
      if (!data || !data.summary) throw new Error("shape");
      setResult(data);
      toast(
        data.source === "openai"
          ? "AI가 사진을 분석해 추천했어요"
          : "체형 기준으로 추천했어요"
      );
    } catch {
      toast("분석에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      clearTimeout(timer);
      setAnalyzing(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="modal-back show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal body-style" role="dialog" aria-modal="true" aria-labelledby="styleTitle">
        <h2 id="styleTitle">체형 맞춤 추천</h2>
        <p>
          사진을 올리면 AI가 체형·실루엣에 맞는 스타일을 추천해요. 사진은 분석에만 쓰이고 저장하지
          않아요.
        </p>
        {!result ? (
          <>
            <div
              className={"modal-photo bs-photo" + (photo ? " has" : "")}
              role="button"
              tabIndex={0}
              aria-label="사진 올리기"
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileRef.current?.click();
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files?.[0]);
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              {photo ? (
                <>
                  <img src={photo} alt="올린 사진" />
                  <span className="modal-photo-label">사진 변경</span>
                </>
              ) : (
                <>
                  <Icon id="i-upload" />
                  <span className="modal-photo-label">전신 사진 촬영·업로드 · 클릭 또는 드래그</span>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={onClose}>
                취소
              </button>
              <button className="btn primary" onClick={analyze} disabled={!dataUrl || analyzing}>
                {analyzing ? "분석 중…" : "체형 분석하기"}
              </button>
            </div>
          </>
        ) : (
          <div className="bs-result">
            <div className="bs-head">
              <span className="bs-badge">{result.bodyType}</span>
              {result.source === "openai" && <span className="bs-ai">AI 사진 분석</span>}
            </div>
            <p className="bs-summary">{result.summary}</p>
            <div className="bs-tips">
              {result.tips.map((t, i) => (
                <div className="bs-tip" key={i}>
                  <b>{t.title}</b>
                  <span>{t.detail}</span>
                </div>
              ))}
            </div>
            <div className="bs-reco-title">추천 아이템·실루엣</div>
            <div className="bs-reco">
              {result.recommend.map((r, i) => (
                <span className="bs-chip" key={i}>
                  {r}
                </span>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setResult(null)}>
                다시 분석
              </button>
              <button className="btn primary" onClick={onClose}>
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
