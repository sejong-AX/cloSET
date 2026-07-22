"use client";

import { useState } from "react";
import { useApp } from "../app-context";
import { Icon } from "../Sprite";

export function HomeView() {
  const { toast, switchView } = useApp();
  const [wearLabel, setWearLabel] = useState("오늘 입을게요");
  const [worn, setWorn] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <section className="view active" id="view-home">
      <div className="page-head">
        <div>
          <div className="eyebrow">Tuesday · July 21</div>
          <h1>좋은 아침이에요, 하늘님.</h1>
          <p>비 오는 오후 미팅에 맞춘 세 가지 조합을 준비했어요.</p>
        </div>
        <div className="head-actions">
          <button className="btn soft" onClick={() => toast("새로운 조합을 만들고 있어요")}>
            다른 조합
          </button>
          <button className="btn primary" onClick={() => switchView("scan")}>
            <Icon id="i-scan" />
            상품 점검
          </button>
        </div>
      </div>
      <div className="context-strip">
        <div className="weather">
          <div className="weather-icon">☂</div>
          <div>
            <strong>체감 21° · 비 70%</strong>
            <span>성동구 · 최고 24° / 최저 17°</span>
          </div>
        </div>
        <div className="sep"></div>
        <div className="context-text">
          <b>오후 2시 · 고객 미팅</b>
          <br />
          비즈니스 캐주얼로 격식을 맞췄어요.
        </div>
        <div className="sync">방금 동기화</div>
      </div>
      <div className="grid home-grid">
        <article className="card hero-outfit">
          <div className="outfit-stage">
            <div className="stage-pill">51일 만에 다시 만난 니트</div>
            <div className="rack">
              <div className="garment coat"></div>
              <div>
                <div className="garment top-g"></div>
                <div className="garment pants"></div>
              </div>
              <div className="garment shoe"></div>
            </div>
          </div>
          <div className="outfit-info">
            <div className="rank">BEST MATCH 01</div>
            <h2>비 오는 날의 차분한 네이비</h2>
            <p>
              생활 방수가 되는 트렌치에 여름 쿨톤과 잘 맞는 네이비 니트를 조합했어요. 저녁
              기온이 내려가도 편안해요.
            </p>
            <div className="lens">
              <div>
                <b>96</b>
                <span>날씨</span>
              </div>
              <div>
                <b>92</b>
                <span>TPO</span>
              </div>
              <div>
                <b>91</b>
                <span>컬러</span>
              </div>
              <div>
                <b>88</b>
                <span>핏</span>
              </div>
            </div>
            <div className="outfit-actions">
              <button
                className="btn primary"
                style={worn ? { background: "#173e34" } : undefined}
                onClick={() => {
                  setWorn(true);
                  setWearLabel("착용 예정으로 선택됨");
                  toast("오늘의 착장으로 선택했어요. 저녁에 착용을 확인할게요.");
                }}
              >
                {wearLabel}
              </button>
              <button
                className="icon-btn"
                aria-label="코디 저장"
                onClick={() => {
                  setSaved((s) => {
                    const next = !s;
                    toast(next ? "코디를 저장했어요" : "저장을 해제했어요");
                    return next;
                  });
                }}
              >
                {saved ? "♥" : "♡"}
              </button>
            </div>
          </div>
        </article>
        <div className="side-stack">
          <article className="card mini-outfit">
            <div className="section-title">
              <h2>지난주 그 조합</h2>
              <button className="text-link" onClick={() => toast("저장 코디 전체를 열었어요")}>
                모두 보기
              </button>
            </div>
            <div className="outfit-row">
              <div className="swatch-item" style={{ background: "#e9e2d6" }}></div>
              <div className="swatch-item" style={{ background: "#53635e" }}></div>
              <div className="swatch-item" style={{ background: "#282e2d" }}></div>
            </div>
            <div className="saved-meta">
              <span>출근 · 3회 착용</span>
              <button
                className="text-link"
                onClick={() => toast("저장 코디를 오늘의 착장으로 선택했어요")}
              >
                다시 입기 →
              </button>
            </div>
          </article>
          <article className="card care-card">
            <div className="section-title">
              <h2>케어가 필요해요</h2>
              <span>3벌</span>
            </div>
            <div className="care-line">
              <div className="care-ico">≈</div>
              <div>
                <b>네이비 울 니트</b>
                <span>3회 착용 · 찬물 손세탁</span>
              </div>
              <button className="btn" onClick={() => switchView("care")}>
                확인
              </button>
            </div>
          </article>
        </div>
      </div>
      <div className="metrics">
        <article className="card metric">
          <span className="label">옷장 활성도 · WAR</span>
          <strong>68%</strong>
          <small>↑ 지난달보다 6%</small>
          <div className="spark">
            <svg viewBox="0 0 160 30">
              <path
                d="M2 25 30 21 53 23 79 14 105 16 132 8 158 5"
                fill="none"
                stroke="#1f6a58"
                strokeWidth="2"
              />
            </svg>
          </div>
        </article>
        <article className="card metric">
          <span className="label">이번 주 착용</span>
          <strong>11벌</strong>
          <small>잊힌 옷 2벌 포함</small>
          <div className="spark">
            <svg viewBox="0 0 160 30">
              <path
                d="M2 24 27 24 27 18 53 18 53 20 80 20 80 10 106 10 106 7 135 7 135 4 158 4"
                fill="none"
                stroke="#497787"
                strokeWidth="2"
              />
            </svg>
          </div>
        </article>
        <article className="card metric">
          <span className="label">평균 회당 비용</span>
          <strong>₩8,420</strong>
          <small className="down">↓ ₩1,120 개선</small>
          <div className="spark">
            <svg viewBox="0 0 160 30">
              <path
                d="M2 5 27 8 53 7 80 14 106 15 132 21 158 24"
                fill="none"
                stroke="#497787"
                strokeWidth="2"
              />
            </svg>
          </div>
        </article>
        <article className="card metric">
          <span className="label">탄소 감축 추정</span>
          <strong>47.2kg</strong>
          <small>계수와 산정 범위 보기</small>
          <div className="spark">
            <svg viewBox="0 0 160 30">
              <path
                d="M2 26 35 25 58 19 82 17 109 11 132 9 158 3"
                fill="none"
                stroke="#1f6a58"
                strokeWidth="2"
              />
            </svg>
          </div>
        </article>
      </div>
    </section>
  );
}
