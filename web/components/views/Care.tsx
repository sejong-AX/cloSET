"use client";

import { useState } from "react";
import { useApp } from "../app-context";
import { Icon } from "../Sprite";

interface QueueRow {
  name: string;
  meta: string;
  progress: number;
  type: string;
  material: string;
}

const QUEUE: QueueRow[] = [
  { name: "네이비 울 니트", meta: "3회 착용 · 임계 3회 도달", progress: 100, type: "top-g", material: "네이비 울 니트" },
  { name: "베이지 트렌치코트", meta: "우천 착용 · 부분 세탁 권장", progress: 76, type: "coat", material: "코튼 개버딘 트렌치코트" },
  { name: "크림 와이드 팬츠", meta: "2회 착용 · 오염 기록 있음", progress: 82, type: "pants", material: "코튼 와이드 팬츠" },
];

interface Guide {
  title: string;
  tempC: number;
  symbols: string[];
  body: string;
}

const DEFAULT_GUIDE: Guide = {
  title: "울 니트 안전 가이드",
  tempC: 30,
  symbols: ["30°", "×△", "—", "●"],
  body: "찬물에서 울 전용 세제로 손세탁하고 비틀어 짜지 마세요. 평평하게 눕혀 그늘에서 말리는 것이 좋아요.",
};

export function CareView() {
  const { toast } = useApp();
  const [labels, setLabels] = useState<string[]>(QUEUE.map(() => "세탁 시작"));
  const [primary, setPrimary] = useState<boolean[]>(QUEUE.map(() => false));
  const [guide, setGuide] = useState<Guide>(DEFAULT_GUIDE);
  const [scanning, setScanning] = useState(false);

  const toggleCare = (i: number) => {
    const nextLabel = labels[i] === "세탁 시작" ? "세탁 완료" : "옷장 복귀 완료";
    setLabels((prev) => {
      const next = [...prev];
      next[i] = nextLabel;
      return next;
    });
    setPrimary((prev) => {
      const next = [...prev];
      next[i] = !prev[i];
      return next;
    });
    toast(nextLabel === "세탁 완료" ? "세탁 중 상태로 이동했어요" : "Available 상태로 돌아왔어요");
  };

  const labelScan = async () => {
    if (scanning) return;
    setScanning(true);
    toast("케어라벨을 분석하고 있어요");
    try {
      const res = await fetch("/api/care", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ material: QUEUE[0].material }),
      });
      const data = await res.json();
      setGuide({ title: data.title, tempC: data.tempC, symbols: data.symbols, body: data.body });
      toast(
        data.source === "openai"
          ? "GPT-4o가 소재에 맞는 케어 가이드를 정리했어요"
          : "소재 기준으로 케어 가이드를 불러왔어요"
      );
    } catch {
      toast("케어라벨 분석에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <section className="view active" id="view-care">
      <div className="page-head">
        <div>
          <div className="eyebrow">CARE LABEL AI</div>
          <h1>케어 허브</h1>
          <p>소재에 맞게 관리하고 다시 옷장으로 돌려보내세요.</p>
        </div>
        <button className="btn primary" onClick={labelScan} disabled={scanning}>
          <Icon id="i-scan" />
          {scanning ? "분석 중…" : "라벨 인식"}
        </button>
      </div>
      <div className="grid queue-layout">
        <article className="card queue">
          <div className="section-title" style={{ paddingTop: "14px" }}>
            <h2>세탁 필요 · 3벌</h2>
            <span>소재별 임계 기준</span>
          </div>
          {QUEUE.map((q, i) => (
            <div className="queue-item" key={q.name}>
              <div className="thumb">
                <div className={"garment " + q.type}></div>
              </div>
              <div>
                <b>{q.name}</b>
                <p>{q.meta}</p>
                <div className="progress">
                  <i style={{ width: q.progress + "%" }}></i>
                </div>
              </div>
              <button
                className={"btn" + (primary[i] ? " primary" : "")}
                onClick={() => toggleCare(i)}
              >
                {labels[i]}
              </button>
            </div>
          ))}
        </article>
        <aside className="card guide">
          <div className="guide-icon">{guide.tempC}°</div>
          <h3>{guide.title}</h3>
          <p>{guide.body}</p>
          <div className="symbol-row">
            {guide.symbols.map((s, i) => (
              <div className="wash-symbol" key={i}>
                {s}
              </div>
            ))}
          </div>
          <button
            className="btn soft"
            style={{ width: "100%" }}
            onClick={() => toast("가까운 전문 세탁소 4곳을 찾았어요")}
          >
            전문 세탁소 찾기
          </button>
        </aside>
      </div>
    </section>
  );
}
