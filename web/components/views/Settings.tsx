"use client";

import { useState } from "react";
import { useApp } from "../app-context";

const NAV = ["개인화 프로필", "외부 연동", "알림", "공유 옷장", "개인정보·데이터"];

export function SettingsView() {
  const { toast, logout } = useApp();
  const [navIdx, setNavIdx] = useState(0);
  const [toggles, setToggles] = useState<boolean[]>([true, true, true]);

  const toggle = (i: number) => {
    const next = !toggles[i];
    setToggles((prev) => {
      const n = [...prev];
      n[i] = next;
      return n;
    });
    toast(next ? "연동을 켰어요" : "연동을 껐어요");
  };

  return (
    <section className="view active" id="view-settings">
      <div className="page-head">
        <div>
          <div className="eyebrow">PROFILE &amp; PRIVACY</div>
          <h1>설정</h1>
          <p>개인화와 데이터 권한을 직접 통제하세요.</p>
        </div>
      </div>
      <div className="grid settings-layout">
        <nav className="card settings-nav">
          {NAV.map((label, i) => (
            <button
              key={label}
              className={navIdx === i ? "active" : ""}
              onClick={() => setNavIdx(i)}
            >
              {label}
            </button>
          ))}
        </nav>
        <article className="card settings-panel">
          <h2>개인화 프로필</h2>
          <p>추천에 사용하는 색, 핏, 위치와 일정 정보를 관리해요.</p>
          <div className="setting-row">
            <div className="avatar">하</div>
            <div>
              <b>김하늘</b>
              <span>여름 쿨 · Straight · 2026.06.14 진단</span>
            </div>
            <button className="btn" onClick={() => toast("개인화 프로필 편집 화면을 열었어요")}>
              편집
            </button>
          </div>
          <div className="setting-row">
            <div>
              <b>날씨 위치</b>
              <span>서울 성동구 · 정확한 좌표는 저장하지 않음</span>
            </div>
            <button
              className={"toggle" + (toggles[0] ? " on" : "")}
              aria-label="날씨 위치"
              aria-pressed={toggles[0]}
              onClick={() => toggle(0)}
            ></button>
          </div>
          <div className="setting-row">
            <div>
              <b>캘린더 TPO</b>
              <span>일정 원문이 아닌 분류 결과만 저장</span>
            </div>
            <button
              className={"toggle" + (toggles[1] ? " on" : "")}
              aria-label="캘린더"
              aria-pressed={toggles[1]}
              onClick={() => toggle(1)}
            ></button>
          </div>
          <div className="setting-row">
            <div>
              <b>온디바이스 체형 분석</b>
              <span>원본 사진 미보관 · 수치 프로필만 저장</span>
            </div>
            <button
              className={"toggle" + (toggles[2] ? " on" : "")}
              aria-label="체형 분석"
              aria-pressed={toggles[2]}
              onClick={() => toggle(2)}
            ></button>
          </div>
          <div className="setting-row">
            <div>
              <b>구매내역 자동 가져오기</b>
              <span>연결되지 않음 · 이메일 원문은 추출 후 삭제</span>
            </div>
            <button className="btn soft" onClick={() => toast("구매내역 연결 화면을 열었어요")}>
              연결
            </button>
          </div>
          <div className="setting-row">
            <div>
              <b>내 데이터 다운로드</b>
              <span>옷장, 착용, 원장과 동의 기록을 내려받아요.</span>
            </div>
            <button className="btn" onClick={() => toast("데이터 내보내기를 요청했어요")}>
              요청
            </button>
          </div>
          <div className="setting-row">
            <div>
              <b>로그아웃</b>
              <span>현재 브라우저의 cloSET 세션을 안전하게 종료해요.</span>
            </div>
            <button className="btn" onClick={logout}>
              로그아웃
            </button>
          </div>
          <div className="setting-row">
            <div>
              <b style={{ color: "var(--danger)" }}>계정과 데이터 삭제</b>
              <span>재인증 후 복구 기간과 보존 항목을 확인해요.</span>
            </div>
            <button className="btn danger" onClick={() => toast("삭제 전 재인증이 필요해요")}>
              삭제
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
