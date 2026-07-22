"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useApp } from "../app-context";
import { Icon } from "../Sprite";
import { BodyStyleModal } from "../BodyStyleModal";

interface Outfit {
  rank: string;
  pill: string;
  title: string;
  desc: string;
  lens: string[][];
  rack: { coat: string; top: string; pants: string; shoe: string };
  alt: { coat: string; top: string; pants: string; shoe: string };
  tpoLabel: string;
  tpoIcon: string;
  ctxTitle: string;
  ctxSub: string;
}

// TPO 상황별 착장 — "다른 조합" 은 순환, "TPO 추천" 확장 버튼은 상황을 직접 고른다
const OUTFITS: Outfit[] = [
  {
    rank: "BEST MATCH 01",
    pill: "51일 만에 다시 만난 니트",
    title: "비 오는 날의 차분한 네이비",
    desc: "생활 방수가 되는 트렌치에 여름 쿨톤과 잘 맞는 네이비 니트를 조합했어요. 저녁 기온이 내려가도 편안해요.",
    lens: [["96", "날씨"], ["92", "TPO"], ["91", "컬러"], ["88", "핏"]],
    rack: { coat: "/items/coat.jpg", top: "/items/knit.jpg", pants: "/items/pants.jpg", shoe: "/items/shoe.jpg" },
    alt: { coat: "베이지 트렌치코트", top: "네이비 울 니트", pants: "크림 와이드 팬츠", shoe: "스웨이드 로퍼" },
    tpoLabel: "출근·미팅",
    tpoIcon: "💼",
    ctxTitle: "오후 2시 · 고객 미팅",
    ctxSub: "비즈니스 캐주얼로 격식을 맞췄어요.",
  },
  {
    rank: "BEST MATCH 02",
    pill: "이번 주 세 번째 데님",
    title: "선선한 오후의 데님 캐주얼",
    desc: "생활 방수 데님 자켓에 화이트 셔츠를 받쳐 캐주얼하게. 미팅 후 저녁 약속까지 부담 없어요.",
    lens: [["91", "날씨"], ["88", "TPO"], ["90", "컬러"], ["86", "핏"]],
    rack: { coat: "/items/denim-jacket.jpg", top: "/items/shirt-white.jpg", pants: "/items/jeans-blue.jpg", shoe: "/items/boots-chelsea.jpg" },
    alt: { coat: "인디고 데님 자켓", top: "화이트 코튼 셔츠", pants: "인디고 슬림 진", shoe: "탄 첼시 부츠" },
    tpoLabel: "주말 나들이",
    tpoIcon: "🌿",
    ctxTitle: "토요일 · 브런치 약속",
    ctxSub: "편하게 움직이는 캐주얼로 맞췄어요.",
  },
  {
    rank: "BEST MATCH 03",
    pill: "42일 만에 꺼낸 가디건",
    title: "포근한 아이보리 니트 무드",
    desc: "아이보리 케이블 가디건에 크림 팬츠로 톤을 맞췄어요. 여름 쿨톤과 잘 어울리고 실내에서도 따뜻해요.",
    lens: [["89", "날씨"], ["90", "TPO"], ["93", "컬러"], ["85", "핏"]],
    rack: { coat: "/items/cardigan-ivory.jpg", top: "/items/knit-cream.jpg", pants: "/items/pants.jpg", shoe: "/items/boots-chelsea.jpg" },
    alt: { coat: "아이보리 케이블 가디건", top: "아이보리 케이블 니트", pants: "크림 와이드 팬츠", shoe: "탄 첼시 부츠" },
    tpoLabel: "저녁 약속",
    tpoIcon: "🍷",
    ctxTitle: "저녁 7시 · 다이닝",
    ctxSub: "은은한 톤의 스마트 캐주얼이에요.",
  },
  {
    rank: "BEST MATCH 04",
    pill: "톤온톤 브라운 데일리",
    title: "브라운 톤 데일리 레이어드",
    desc: "그레이 가디건에 오트밀 셔츠를 겹쳐 차분하게. 데님과 스니커즈로 활동성을 더했어요.",
    lens: [["90", "날씨"], ["87", "TPO"], ["89", "컬러"], ["88", "핏"]],
    rack: { coat: "/items/cardigan-gray.jpg", top: "/items/shirt-oatmeal.jpg", pants: "/items/jeans-blue.jpg", shoe: "/items/shoe.jpg" },
    alt: { coat: "그레이 리브드 가디건", top: "오트밀 린넨 셔츠", pants: "인디고 슬림 진", shoe: "스웨이드 로퍼" },
    tpoLabel: "데일리·재택",
    tpoIcon: "🏠",
    ctxTitle: "재택 근무 · 하루 종일",
    ctxSub: "포근하게 겹쳐 입는 릴랙스드 룩이에요.",
  },
];

// ---- 세종시 실시간 날씨 (Open-Meteo, 키 불필요·CORS 허용) ----
interface Weather {
  apparent: number;
  precip: number;
  max: number;
  min: number;
  label: string;
  icon: string;
}
const FALLBACK_WEATHER: Weather = {
  apparent: 26,
  precip: 20,
  max: 29,
  min: 21,
  label: "구름 조금",
  icon: "⛅",
};
function describeWeather(code: number): { label: string; icon: string } {
  if (code === 0) return { label: "맑음", icon: "☀️" };
  if (code <= 3) return { label: "구름 조금", icon: "⛅" };
  if (code <= 48) return { label: "안개", icon: "🌫️" };
  if (code <= 57) return { label: "이슬비", icon: "🌦️" };
  if (code <= 67) return { label: "비", icon: "🌧️" };
  if (code <= 77) return { label: "눈", icon: "🌨️" };
  if (code <= 82) return { label: "소나기", icon: "🌦️" };
  if (code <= 86) return { label: "눈", icon: "🌨️" };
  return { label: "뇌우", icon: "⛈️" };
}
// 홈 재방문마다 재요청하지 않도록 세션 캐시(10분)
let weatherCache: { data: Weather; at: number } | null = null;

export function HomeView() {
  const { toast, switchView } = useApp();
  const [wearLabel, setWearLabel] = useState("오늘 입을게요");
  const [worn, setWorn] = useState(false);
  const [saved, setSaved] = useState(false);
  const [outfitIdx, setOutfitIdx] = useState(0);
  const [tpoOpen, setTpoOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [weather, setWeather] = useState<Weather>(FALLBACK_WEATHER);
  const outfit = OUTFITS[outfitIdx];
  const rackRef = useRef<HTMLDivElement>(null);
  const prevOutfit = useRef(outfitIdx);

  // 세종시 실시간 날씨 로드 (실패 시 FALLBACK 유지, 10분 캐시)
  useEffect(() => {
    if (weatherCache && Date.now() - weatherCache.at < 600000) {
      setWeather(weatherCache.data);
      return;
    }
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=36.4801&longitude=127.2890&current=apparent_temperature,weather_code&hourly=precipitation_probability&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul&forecast_days=1",
          { signal: ctrl.signal }
        );
        const d = await res.json();
        const code = Number(d?.current?.weather_code ?? 2);
        const wx = describeWeather(code);
        const times: string[] = d?.hourly?.time ?? [];
        const hourKey = String(d?.current?.time ?? "").slice(0, 13);
        const idx = times.findIndex((t) => t.slice(0, 13) === hourKey);
        const precip = idx >= 0 ? Number(d?.hourly?.precipitation_probability?.[idx] ?? 0) : 0;
        const w: Weather = {
          apparent: Math.round(Number(d?.current?.apparent_temperature ?? 26)),
          precip,
          max: Math.round(Number(d?.daily?.temperature_2m_max?.[0] ?? 29)),
          min: Math.round(Number(d?.daily?.temperature_2m_min?.[0] ?? 21)),
          label: wx.label,
          icon: wx.icon,
        };
        setWeather(w);
        weatherCache = { data: w, at: Date.now() };
      } catch {
        /* keep fallback */
      }
    })();
    return () => ctrl.abort();
  }, []);

  // 조합이 실제로 바뀔 때만 랙 재진입 애니메이션(마운트·StrictMode 재실행엔 반응 안 함)
  useEffect(() => {
    if (prevOutfit.current === outfitIdx) return;
    prevOutfit.current = outfitIdx;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !rackRef.current) return;
    const items = rackRef.current.querySelectorAll(".rack-item");
    gsap.fromTo(
      items,
      { opacity: 0, scale: 0.92, y: 10 },
      { opacity: 1, scale: 1, y: 0, stagger: 0.07, duration: 0.4, ease: "back.out(1.4)" }
    );
  }, [outfitIdx]);

  const nextOutfit = () => {
    setOutfitIdx((i) => (i + 1) % OUTFITS.length);
    setWorn(false);
    setWearLabel("오늘 입을게요");
    setSaved(false);
    toast("다른 조합을 찾았어요");
  };

  const selectTpo = (i: number) => {
    setOutfitIdx(i);
    setWorn(false);
    setWearLabel("오늘 입을게요");
    setSaved(false);
    toast(`${OUTFITS[i].tpoLabel} 상황에 맞춰 추천했어요`);
  };

  return (
    <section className="view active" id="view-home">
      <div className="page-head">
        <div>
          <div className="eyebrow">Tuesday · July 21</div>
          <h1>좋은 아침이에요, 하늘님.</h1>
          <p>세종시 날씨와 오늘 일정에 맞춘 조합을 준비했어요.</p>
        </div>
        <div className="head-actions">
          <button className="btn soft" onClick={nextOutfit}>
            다른 조합
          </button>
          <button className="btn soft" onClick={() => setStyleOpen(true)}>
            <Icon id="i-scan" />
            체형 추천
          </button>
          <button className="btn primary" onClick={() => switchView("scan")}>
            <Icon id="i-scan" />
            상품 점검
          </button>
        </div>
      </div>
      <div className="context-strip">
        <div className="weather">
          <div className="weather-icon">{weather.icon}</div>
          <div>
            <strong>
              체감 {weather.apparent}° · {weather.label} {weather.precip}%
            </strong>
            <span>
              세종시 · 최고 {weather.max}° / 최저 {weather.min}°
            </span>
          </div>
        </div>
        <div className="sep"></div>
        <div className="context-text">
          <b>{outfit.ctxTitle}</b>
          <br />
          {outfit.ctxSub}
        </div>
        <div className="sync">방금 동기화</div>
      </div>
      <div className="tpo-bar">
        <button
          className="tpo-toggle"
          aria-expanded={tpoOpen}
          onClick={() => setTpoOpen((o) => !o)}
        >
          <span className="tpo-toggle-label">🎯 TPO 추천</span>
          <span className="tpo-toggle-cur">
            {outfit.tpoIcon} {outfit.tpoLabel}
          </span>
          <span className="tpo-caret">{tpoOpen ? "▲" : "▼"}</span>
        </button>
        {tpoOpen && (
          <div className="tpo-chips">
            {OUTFITS.map((o, i) => (
              <button
                key={i}
                className={"tpo-chip" + (outfitIdx === i ? " active" : "")}
                onClick={() => selectTpo(i)}
              >
                <span>{o.tpoIcon}</span> {o.tpoLabel}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid home-grid">
        <article className="card hero-outfit">
          <div className="outfit-stage">
            <div className="stage-pill">{outfit.pill}</div>
            <div className="rack" ref={rackRef}>
              <div className="rack-item coat-slot">
                <img src={outfit.rack.coat} alt={outfit.alt.coat} />
              </div>
              <div className="rack-col">
                <div className="rack-item top-slot">
                  <img src={outfit.rack.top} alt={outfit.alt.top} />
                </div>
                <div className="rack-item pants-slot">
                  <img src={outfit.rack.pants} alt={outfit.alt.pants} />
                </div>
              </div>
              <div className="rack-item shoe-slot">
                <img src={outfit.rack.shoe} alt={outfit.alt.shoe} />
              </div>
            </div>
          </div>
          <div className="outfit-info">
            <div className="rank">{outfit.rank}</div>
            <h2>{outfit.title}</h2>
            <p>{outfit.desc}</p>
            <div className="lens">
              {outfit.lens.map(([score, label], i) => (
                <div key={i}>
                  <b>{score}</b>
                  <span>{label}</span>
                </div>
              ))}
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
                  const next = !saved;
                  setSaved(next);
                  toast(next ? "코디를 저장했어요" : "저장을 해제했어요");
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
              <div className="swatch-item">
                <img src="/items/shirt.jpg" alt="화이트 셔츠" />
              </div>
              <div className="swatch-item">
                <img src="/items/knit2.jpg" alt="그레이 니트" />
              </div>
              <div className="swatch-item">
                <img src="/items/pants.jpg" alt="크림 와이드 팬츠" />
              </div>
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
      <BodyStyleModal
        open={styleOpen}
        onClose={() => setStyleOpen(false)}
        toast={toast}
        bodyType="Straight"
        season="여름 쿨"
      />
    </section>
  );
}
