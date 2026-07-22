"use client";

import { useState } from "react";
import { useApp } from "../app-context";
import { Icon } from "../Sprite";

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

const wearNum = (w: string) => parseInt(w.replace(/[^\d]/g, ""), 10) || 0;
const careNote = (name: string) => {
  if (/니트|울|캐시미어|스웨터|가디건/.test(name)) return "찬물 손세탁 권장";
  if (/데님|진|청/.test(name)) return "뒤집어 단독 세탁";
  if (/코트|트렌치|자켓|재킷|블레이저/.test(name)) return "부분 세탁·드라이 권장";
  if (/로퍼|부츠|신발|스니커/.test(name)) return "전용 클리너 관리";
  return "일반 세탁 가능";
};

export function CareView() {
  const { toast, items, setClothingState } = useApp();
  // 케어 큐 = 옷장에서 실제로 '세탁' 상태인 옷들 (하드코딩 아님 · 옷장과 연동)
  const queue = items.filter((x) => x.state === "laundry");
  const [washing, setWashing] = useState<Set<string>>(
    () => new Set(items.filter((x) => x.label === "세탁 중").map((x) => x.id))
  );
  const [guide, setGuide] = useState<Guide>(DEFAULT_GUIDE);
  const [scanning, setScanning] = useState(false);

  const startWash = (id: string) => {
    setWashing((prev) => new Set(prev).add(id));
    toast("세탁을 시작했어요");
  };

  const completeWash = (id: string, name: string) => {
    setWashing((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setClothingState(id, "available"); // 옷장 상태를 '입을 수 있음'으로 복귀
    toast(`'${name}'을(를) 다시 옷장에 넣었어요`);
  };

  const labelScan = async () => {
    if (scanning) return;
    setScanning(true);
    toast("케어라벨을 분석하고 있어요");
    try {
      const material = queue[0]?.name ?? "네이비 울 니트";
      const res = await fetch("/api/care", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ material }),
      });
      if (!res.ok) throw new Error("bad status");
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
            <h2>세탁 필요 · {queue.length}벌</h2>
            <span>소재별 임계 기준</span>
          </div>
          {queue.length === 0 ? (
            <div className="closet-empty" style={{ padding: "34px 10px" }}>
              <Icon id="i-care" />
              <b>세탁할 옷이 없어요</b>
              <p>옷장의 모든 옷이 입을 수 있는 상태예요.</p>
            </div>
          ) : (
            queue.map((q) => {
              const isWashing = washing.has(q.id);
              const progress = isWashing ? 100 : Math.min(96, 58 + wearNum(q.wear) * 2);
              return (
                <div className="queue-item" key={q.id}>
                  <div className="thumb">
                    <img src={q.img} alt={q.name} />
                  </div>
                  <div>
                    <b>{q.name}</b>
                    <p>
                      {q.wear} 착용 · {isWashing ? "세탁 중" : careNote(q.name)}
                    </p>
                    <div className="progress">
                      <i style={{ width: progress + "%" }}></i>
                    </div>
                  </div>
                  {isWashing ? (
                    <button className="btn primary" onClick={() => completeWash(q.id, q.name)}>
                      세탁 완료
                    </button>
                  ) : (
                    <button className="btn" onClick={() => startWash(q.id)}>
                      세탁 시작
                    </button>
                  )}
                </div>
              );
            })
          )}
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
