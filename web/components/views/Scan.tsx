"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "../app-context";
import { Icon } from "../Sprite";

interface ScanResult {
  verdict: "STOP" | "BUY" | "ALTERNATIVE";
  duplicationRisk: number;
  ruleVersion: string;
  expectedCpw: number;
  expectedWears: number;
  similar: { name: string; color: string; similarity: number }[];
  headline: string;
  reasons: { title: string; sub: string }[];
  alt: string;
  source: "openai" | "fallback";
}

export function ScanView() {
  const { toast } = useApp();
  const [productImg, setProductImg] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [category, setCategory] = useState("니트 · 상의");
  const [price, setPrice] = useState("79,000원");
  const [analyzeLabel, setAnalyzeLabel] = useState("내 옷장과 비교하기");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);

  // 업로드한 이미지 objectURL 정리(누수 방지)
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  // 실제로 추가(선택/드롭)한 이미지만 미리보기로 띄운다
  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("이미지 파일(JPG·PNG)만 올릴 수 있어요");
      return;
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    setProductImg(url);
    toast("상품 사진을 불러왔어요");
  };

  const analyze = async () => {
    if (busy) return;
    setBusy(true);
    setAnalyzeLabel("내 옷장과 비교 중…");
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, price }),
      });
      const data: ScanResult = await res.json();
      setResult(data);
      setAnalyzeLabel("다시 비교하기");
      toast(
        data.source === "openai"
          ? "GPT-4o가 결정 규칙 판정에 이유를 붙였어요"
          : "결정 규칙으로 판정을 완료했어요"
      );
    } catch {
      setAnalyzeLabel("다시 비교하기");
      toast("분석에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const markStyle =
    result?.verdict === "BUY"
      ? { background: "#e6f2ec", color: "var(--forest)" }
      : result?.verdict === "ALTERNATIVE"
      ? { background: "#f6efe0", color: "var(--warn)" }
      : undefined;

  return (
    <section className="view active" id="view-scan">
      <div className="page-head">
        <div>
          <div className="eyebrow">SMART CHECKER</div>
          <h1>Snap &amp; Check</h1>
          <p>사고 싶은 물건을 올리면 내 옷장과 비교해 드려요.</p>
        </div>
      </div>
      <div className="grid scan-layout">
        <article className="card upload-box">
          <div
            className={"dropzone" + (dragging ? " dragging" : "")}
            role="button"
            tabIndex={0}
            aria-label="상품 사진 올리기"
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
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
            <Icon id="i-upload" />
            <b>상품 사진을 놓거나 클릭하세요</b>
            <span>옷 · 신발 · 액세서리 JPG, PNG</span>
            {productImg && (
              <div className="scan-product show">
                <img src={productImg} alt="업로드한 상품" />
              </div>
            )}
          </div>
          <div className="scan-form">
            <div className="field">
              <label>카테고리</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>니트 · 상의</option>
                <option>아우터</option>
                <option>하의</option>
                <option>신발</option>
              </select>
            </div>
            <div className="field">
              <label>가격</label>
              <input value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          <button
            className="btn primary"
            style={{ width: "100%", marginTop: "11px" }}
            onClick={analyze}
            disabled={busy}
          >
            {analyzeLabel}
          </button>
        </article>
        <article className="card verdict">
          {!result && (
            <div className="verdict-empty">
              <Icon id="i-scan" />
              <b>분석 결과가 여기에 표시돼요</b>
              <p style={{ fontSize: "10px" }}>사진을 선택하고 비교를 시작해 주세요.</p>
            </div>
          )}
          {result && (
            <div className="result show">
              <div className="verdict-top">
                <div className="verdict-mark" style={markStyle}>
                  {result.verdict}
                </div>
                <div>
                  <h2>{result.headline}</h2>
                  <p>
                    중복 위험 {result.duplicationRisk}% · 결정 규칙 {result.ruleVersion}
                  </p>
                </div>
              </div>
              <div className="reason-list">
                {result.reasons.map((r, i) => (
                  <div className="reason" key={i}>
                    <div className="reason-num">{String(i + 1).padStart(2, "0")}</div>
                    <div>
                      <b>{r.title}</b>
                      <span>{r.sub}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="section-title">
                <h2>내 옷장 속 대체재</h2>
                <span>유사도순</span>
              </div>
              <div className="similar-strip">
                {result.similar.map((s, i) => (
                  <div className="similar" key={i}>
                    <div style={{ background: s.color }}></div>
                    <p>
                      {s.name} · {s.similarity}%
                    </p>
                  </div>
                ))}
              </div>
              <div className="alt-box">
                <b>대안 조합</b>
                <br />
                {result.alt}
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "13px" }}>
                <button className="btn soft" onClick={() => toast("대체 코디를 저장했어요")}>
                  대체 코디 저장
                </button>
                <button className="btn" onClick={() => toast("구매 보류로 기록했어요")}>
                  구매 보류
                </button>
              </div>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
