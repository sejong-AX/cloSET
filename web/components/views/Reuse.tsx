"use client";

import { useState } from "react";
import { useApp } from "../app-context";
import { directionParticle } from "@/lib/data";

// 각 경로는 실제 서비스로 연결된다(새 탭)
const ROUTES = [
  {
    icon: "↗",
    name: "중고 판매",
    desc: "상태와 비슷한 거래를 기준으로 예상 가격을 확인해요.",
    stat: "₩62,000 예상",
    partner: "당근",
    url: "https://www.daangn.com",
  },
  {
    icon: "♡",
    name: "기부",
    desc: "가까운 수거처와 필요한 계절 품목을 연결해요.",
    stat: "수거처 3곳",
    partner: "아름다운가게",
    url: "https://www.beautifulstore.org",
  },
  {
    icon: "✦",
    name: "수선 후 재착용",
    desc: "단추와 안감을 보완하면 다음 겨울까지 입을 수 있어요.",
    stat: "수선 ₩24,000 예상",
    partner: "카카오맵 · 내 주변 수선샵",
    url: "https://map.kakao.com/?q=" + encodeURIComponent("옷수선"),
  },
  {
    icon: "∞",
    name: "업사이클",
    desc: "울 소재를 활용하는 지역 공방에 전달할 수 있어요.",
    stat: "파트너 2곳",
    partner: "서울새활용플라자",
    url: "https://www.seoulup.or.kr",
  },
];

export function ReuseView() {
  const { toast } = useApp();
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <section className="view active" id="view-reuse">
      <div className="page-head">
        <div>
          <div className="eyebrow">RE:USING</div>
          <h1>다음 쓰임을 찾아주세요.</h1>
          <p>안 입는 옷을 버리기 전에 가장 좋은 다음 상태를 비교해요.</p>
        </div>
      </div>
      <article className="card reuse-hero">
        <div className="reuse-visual">
          <img src="/items/coat-brown.jpg" alt="브라운 울 코트" />
        </div>
        <div className="reuse-copy">
          <div className="rank">CANDIDATE 01</div>
          <h2>브라운 울 코트</h2>
          <p>
            최근 126일 동안 입지 않았고 회당 비용은 43,000원이에요. 바로 떠나보내지 않아도
            괜찮아요. 수선해서 다시 입거나 다음 사람에게 연결할 수 있어요.
          </p>
          <div className="lens" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            <div>
              <b>126일</b>
              <span>미착용</span>
            </div>
            <div>
              <b>8회</b>
              <span>누적 착용</span>
            </div>
            <div>
              <b>양호</b>
              <span>현재 상태</span>
            </div>
          </div>
          <button className="btn" onClick={() => toast("30일 재착용 계획에 추가했어요")}>
            조금 더 입어볼게요
          </button>
        </div>
      </article>
      <div className="route-grid">
        {ROUTES.map((r, i) => {
          const select = () => {
            setSelected(i);
            window.open(r.url, "_blank", "noopener,noreferrer");
            toast(`${r.partner}${directionParticle(r.partner)} 연결했어요`);
          };
          return (
            <article
              className={"card route-card" + (selected === i ? " selected" : "")}
              key={r.name}
              role="link"
              tabIndex={0}
              aria-label={`${r.name} — ${r.partner} 새 탭으로 열기`}
              onClick={select}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  select();
                }
              }}
            >
              <div className="route-icon">{r.icon}</div>
              <b>{r.name}</b>
              <p>{r.desc}</p>
              <strong>{r.stat}</strong>
              <span className="route-partner">{r.partner} ↗</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
