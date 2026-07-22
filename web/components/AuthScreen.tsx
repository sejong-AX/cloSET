"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Icon } from "./Sprite";

interface AuthScreenProps {
  onEnter: (message?: string) => void;
  toast: (msg: string) => void;
}

export function AuthScreen({ onEnter, toast }: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showError, setShowError] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [signupMode, setSignupMode] = useState(false);
  const [loginLabel, setLoginLabel] = useState("로그인");
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !rootRef.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".auth-logo", { y: -14, opacity: 0, duration: 0.5 })
        .from(".auth-kicker", { y: 12, opacity: 0, duration: 0.4 }, "-=0.25")
        .from(".auth-message h1", { y: 20, opacity: 0, duration: 0.55 }, "-=0.2")
        .from(".auth-message > p", { y: 14, opacity: 0, duration: 0.45 }, "-=0.3")
        .from(".auth-proof div", { y: 16, opacity: 0, stagger: 0.08, duration: 0.4 }, "-=0.2")
        .from(".auth-card", { y: 26, opacity: 0, duration: 0.55 }, "-=0.5")
        .from(
          ".auth-card > *",
          { y: 12, opacity: 0, stagger: 0.045, duration: 0.35 },
          "-=0.35"
        );
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mail = email.trim();
    if (!mail.includes("@") || password.length < 8) {
      setShowError(true);
      (!mail.includes("@") ? emailRef : pwRef).current?.focus();
      return;
    }
    setShowError(false);
    setBusy(true);
    const wasSignup = signupMode;
    setLoginLabel(wasSignup ? "계정을 만들고 있어요…" : "안전하게 로그인하고 있어요…");
    setTimeout(() => {
      setBusy(false);
      if (wasSignup) {
        // 회원가입 완료 → 앱에 바로 들어가지 않고 로그인 화면으로 복귀
        setSignupMode(false);
        setLoginLabel("로그인");
        setPassword("");
        toast("회원가입이 완료됐어요. 다시 로그인해 주세요.");
      } else {
        setLoginLabel("로그인");
        onEnter("로그인했어요. 오늘의 착장을 준비했어요.");
      }
    }, 550);
  };

  const social = (provider: string, el: HTMLButtonElement) => {
    el.textContent = provider + " 연결 중…";
    setTimeout(() => onEnter(provider + " 계정으로 로그인했어요"), 450);
  };

  const toggleSignup = () => {
    setSignupMode((m) => {
      const next = !m;
      setLoginLabel(next ? "계정 만들기" : "로그인");
      return next;
    });
    setShowError(false);
  };

  return (
    <section className="auth-screen" id="authScreen" aria-labelledby="authTitle" ref={rootRef}>
      <div className="auth-brand-panel">
        <div className="auth-logo">
          <div className="brandmark">
            <Icon id="i-closet" />
          </div>
          cloSET
        </div>
        <div className="auth-message">
          <div className="auth-kicker">REMEMBER · CARE · CIRCULATE</div>
          <h1>
            내 옷을 기억하면,
            <br />더 오래 입게 됩니다.
          </h1>
          <p>
            옷장에 있는 옷부터 살펴보고, 정말 필요한 순간에만 다음 선택을 제안하는 AI
            디지털 옷장입니다.
          </p>
          <div className="auth-proof">
            <div>
              <b>24벌</b>
              <span>살아 있는 옷장</span>
            </div>
            <div>
              <b>47.2kg</b>
              <span>탄소 감축 추정</span>
            </div>
            <div>
              <b>68%</b>
              <span>옷장 활성도</span>
            </div>
          </div>
        </div>
        <div className="auth-privacy">◉ AI 이미지 분석은 선택 동의이며, 수동 등록도 가능합니다.</div>
      </div>
      <div className="auth-main">
        <form className="auth-card" id="authForm" noValidate onSubmit={handleSubmit}>
          <div className="auth-badge">✓ 서버 세션 · 이미지 분석 선택 동의</div>
          <h2 id="authTitle">{signupMode ? "cloSET을 시작해 보세요." : "다시 만나서 반가워요."}</h2>
          <p className="auth-sub" id="authSub">
            {signupMode
              ? "AI 이미지 분석은 가입 후 따로 선택할 수 있어요."
              : "오늘의 날씨와 일정에 맞는 옷을 확인해 보세요."}
          </p>
          <div className="social-stack">
            <button
              type="button"
              className="social-btn"
              onClick={(e) => social("Google", e.currentTarget)}
            >
              G&nbsp; Google
            </button>
            <button
              type="button"
              className="social-btn"
              onClick={(e) => social("Apple", e.currentTarget)}
            >
              ● Apple
            </button>
            <button
              type="button"
              className="social-btn kakao"
              onClick={(e) => social("Kakao", e.currentTarget)}
            >
              Kakao
            </button>
          </div>
          <div className="auth-divider">또는 이메일로 계속</div>
          <div className={"auth-error" + (showError ? " show" : "")} id="authError" role="alert">
            이메일과 비밀번호를 확인해 주세요.
          </div>
          <div className="auth-field">
            <label htmlFor="loginEmail">이메일</label>
            <input
              id="loginEmail"
              ref={emailRef}
              type="email"
              autoComplete="username"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="loginPassword">비밀번호</label>
            <div className="auth-input-wrap">
              <input
                id="loginPassword"
                ref={pwRef}
                type={showPw ? "text" : "password"}
                autoComplete={signupMode ? "new-password" : "current-password"}
                placeholder="8자 이상 입력"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                aria-pressed={showPw}
                onClick={() => setShowPw((s) => !s)}
              >
                {showPw ? "숨김" : "표시"}
              </button>
            </div>
          </div>
          <div className="auth-options">
            <label>
              <input type="checkbox" /> 로그인 유지
            </label>
            <button
              type="button"
              className="auth-link"
              onClick={() => toast("계정 존재 여부와 관계없이 재설정 안내를 보냈어요")}
            >
              비밀번호 찾기
            </button>
          </div>
          <button className="auth-submit" id="loginBtn" type="submit" disabled={busy}>
            {loginLabel}
          </button>
          <p className="auth-switch">
            <span id="switchCopy">{signupMode ? "이미 계정이 있나요?" : "아직 계정이 없나요?"}</span>{" "}
            <button type="button" className="auth-link" onClick={toggleSignup}>
              {signupMode ? "로그인" : "회원가입"}
            </button>
          </p>
          <button
            type="button"
            className="demo-btn"
            onClick={() => onEnter("샘플 데이터로 둘러보는 중이에요")}
          >
            샘플 옷장으로 먼저 둘러보기 →
          </button>
          <p className="auth-legal">
            계속하면 <a href="#">이용약관</a>과 <a href="#">개인정보 처리방침</a>을 확인한 것으로
            간주됩니다.
          </p>
        </form>
      </div>
    </section>
  );
}
