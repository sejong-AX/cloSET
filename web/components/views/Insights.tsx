"use client";

import { useApp } from "../app-context";

const BARS = [
  { m: "2월", h: 42 },
  { m: "3월", h: 75 },
  { m: "4월", h: 35 },
  { m: "5월", h: 63 },
  { m: "6월", h: 28 },
  { m: "7월", h: 18 },
];

export function InsightsView() {
  const { toast } = useApp();
  return (
    <section className="view active" id="view-insights">
      <div className="page-head">
        <div>
          <div className="eyebrow">WARDROBE INSIGHTS</div>
          <h1>지출과 탄소 가계부</h1>
          <p>숫자의 원천과 추정 범위를 함께 확인하세요.</p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => toast("최근 6개월 구간으로 바꿨어요")}>
            최근 6개월
          </button>
          <button className="btn" onClick={() => toast("현재 필터의 CSV를 준비했어요")}>
            내보내기
          </button>
        </div>
      </div>
      <div className="metrics" style={{ marginTop: 0 }}>
        <article className="card metric">
          <span className="label">WAR · 30일</span>
          <strong>68%</strong>
          <small>활성 옷 24벌 중 16벌</small>
        </article>
        <article className="card metric">
          <span className="label">평균 CPW</span>
          <strong>₩8,420</strong>
          <small className="down">↓ 11.7% 개선</small>
        </article>
        <article className="card metric">
          <span className="label">구매 회피 기록</span>
          <strong>5건</strong>
          <small>Smart Checker 결과 기록</small>
        </article>
        <article className="card metric">
          <span className="label">탄소 감축 추정</span>
          <strong>47.2kg</strong>
          <small>계수 v1.2 · 추정치</small>
        </article>
      </div>
      <div className="grid insight-grid">
        <article className="card chart-card">
          <div className="section-title">
            <h2>월별 의류 지출</h2>
            <span>₩438,000 · 6개월</span>
          </div>
          <div className="chart-area">
            <div className="bar-chart">
              {BARS.map((b) => (
                <div className="bar-col" key={b.m}>
                  <div className="bar" style={{ height: b.h + "%" }}></div>
                  <span>{b.m}</span>
                </div>
              ))}
            </div>
          </div>
        </article>
        <article className="card chart-card">
          <div className="section-title">
            <h2>옷장 구성</h2>
            <span>24벌</span>
          </div>
          <div className="donut-wrap">
            <div className="donut">
              <div className="donut-label">
                <strong>68%</strong>
                <span>활성 옷장</span>
              </div>
            </div>
          </div>
        </article>
      </div>
      <article className="card ledger">
        <div className="section-title" style={{ padding: "18px 18px 4px" }}>
          <h2>최근 원장</h2>
          <span>계수·원천 보기</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>날짜</th>
              <th>행동</th>
              <th>근거</th>
              <th>변화</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>07.20</td>
              <td>잊힌 옷 재착용</td>
              <td>51일 미착용 니트</td>
              <td className="pos">+1.8kg 추정</td>
              <td>확정 착용</td>
            </tr>
            <tr>
              <td>07.18</td>
              <td>구매 회피 기록</td>
              <td>검정 코트 중복 84%</td>
              <td className="pos">+12.4kg 추정</td>
              <td>사용자 기록</td>
            </tr>
            <tr>
              <td>07.14</td>
              <td>순환 완료</td>
              <td>데님 팬츠 기부</td>
              <td className="pos">+6.2kg 추정</td>
              <td>완료</td>
            </tr>
          </tbody>
        </table>
      </article>
    </section>
  );
}
