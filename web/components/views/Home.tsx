"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "../app-context";
import { Icon } from "../Sprite";
import { BodyStyleModal } from "../BodyStyleModal";
import { OutfitMannequin, type MannequinGender } from "../OutfitMannequin";
import { careNote } from "@/lib/data";

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
    title: "비 오는 날의 차분한 뉴트럴",
    desc: "생활 방수가 되는 트렌치에 여름 쿨톤과 잘 맞는 그레이 니트를 조합했어요. 저녁 기온이 내려가도 편안해요.",
    lens: [["96", "날씨"], ["92", "TPO"], ["91", "컬러"], ["88", "핏"]],
    rack: { coat: "/items/coat.jpg", top: "/items/knit.jpg", pants: "/items/pants.jpg", shoe: "/items/shoe.jpg" },
    alt: { coat: "베이지 트렌치코트", top: "그레이 울 니트", pants: "크림 와이드 팬츠", shoe: "스웨이드 로퍼" },
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

// 오늘 날짜 키(로컬 타임존) — 착장 중복 기록 방지용
const todayKey = () => new Date().toLocaleDateString("en-CA");
const WORN_KEY = "closet.wornLog";

// 날씨 → 어울리는 기본 코디 인덱스(사용자가 손대기 전까지만 적용)
function outfitForWeather(w: Weather): number {
  if (w.precip >= 50) return 0; // 비 — 생활 방수 트렌치
  if (w.apparent >= 27) return 1; // 더움 — 가장 가벼운 데님 캐주얼
  if (w.apparent >= 18) return 3; // 온화 — 데일리 레이어드
  return 2; // 쌀쌀 — 포근한 니트 무드
}

export function HomeView() {
  const { toast, switchView, items, wearOutfit } = useApp();
  const [saved, setSaved] = useState(false);
  const [outfitIdx, setOutfitIdx] = useState(0);
  const [tpoOpen, setTpoOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [weather, setWeather] = useState<Weather>(FALLBACK_WEATHER);
  // 오늘 이미 착용 기록한 코디(새로고침에도 유지 → 같은 코디 중복 기록 방지)
  const [wornLog, setWornLog] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(WORN_KEY);
      const parsed = raw ? (JSON.parse(raw) as { date: string; outfits: number[] }) : null;
      return parsed && parsed.date === todayKey() && Array.isArray(parsed.outfits)
        ? parsed.outfits
        : [];
    } catch {
      return [];
    }
  });
  // 마네킹 체형(여성/남성) — 기기별 저장
  const [gender, setGender] = useState<MannequinGender>(() => {
    try {
      return localStorage.getItem("closet.mannequin") === "male" ? "male" : "female";
    } catch {
      return "female";
    }
  });
  const outfit = OUTFITS[outfitIdx];
  const worn = wornLog.includes(outfitIdx);
  const touched = useRef(false); // 사용자가 코디를 직접 고르면 날씨 자동 선택을 멈춘다

  const pickGender = (g: MannequinGender) => {
    setGender(g);
    try {
      localStorage.setItem("closet.mannequin", g);
    } catch {
      /* 비필수 */
    }
  };

  // 세종시 실시간 날씨 로드 (실패 시 FALLBACK 유지, 10분 캐시) + 날씨 맞춤 기본 코디
  useEffect(() => {
    const apply = (w: Weather) => {
      setWeather(w);
      if (!touched.current) setOutfitIdx(outfitForWeather(w));
    };
    if (weatherCache && Date.now() - weatherCache.at < 600000) {
      apply(weatherCache.data);
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
        apply(w);
        weatherCache = { data: w, at: Date.now() };
      } catch {
        /* keep fallback */
      }
    })();
    return () => ctrl.abort();
  }, []);

  // 조합/체형 변경 시 마네킹 착장 등장 애니메이션은 OutfitMannequin의 CSS 스태거가
  // key 리마운트로 재생된다(reduced-motion은 CSS 미디어 쿼리에서 존중).

  const nextOutfit = () => {
    touched.current = true;
    setOutfitIdx((i) => (i + 1) % OUTFITS.length);
    setSaved(false);
    toast("다른 조합을 찾았어요");
  };

  const selectTpo = (i: number) => {
    touched.current = true;
    setOutfitIdx(i);
    setSaved(false);
    toast(`${OUTFITS[i].tpoLabel} 상황에 맞춰 추천했어요`);
  };

  // '오늘 입을게요' → 착장 구성 옷을 실제로 착용 처리(착용 +1 · 오늘) + 케어(세탁 대기열) 등록.
  // 같은 날 같은 코디는 중복 기록되지 않는다(wornLog, 새로고침에도 유지).
  const wearToday = () => {
    if (worn) return;
    touched.current = true;
    const rackImgs = Object.values(outfit.rack);
    const matched = items.filter((x) => rackImgs.includes(x.img));
    wearOutfit(rackImgs);
    const nextLog = [...wornLog, outfitIdx];
    setWornLog(nextLog);
    try {
      localStorage.setItem(WORN_KEY, JSON.stringify({ date: todayKey(), outfits: nextLog }));
    } catch {
      /* 저장 실패 시 세션 내 가드만 유지 */
    }
    toast(
      matched.length > 0
        ? `오늘 입은 ${matched.length}벌을 케어 대기열에 담았어요`
        : "오늘의 착장으로 선택했어요",
      matched.length > 0
        ? { label: "케어 보기", onAction: () => switchView("care") }
        : undefined
    );
  };

  // 케어 카드 — 옷장 실데이터(세탁 필요 상태)와 연동
  const careQueue = items.filter((x) => x.state === "laundry");
  const careTop = careQueue[0];

  // 이 코디에 세탁 대기 중인 옷이 섞여 있으면 미리 알려준다(입기 전에만)
  const rackImgs = Object.values(outfit.rack);
  const laundryInOutfit = worn
    ? 0
    : items.filter((x) => rackImgs.includes(x.img) && x.state === "laundry").length;

  // 상단 날짜·인사 — 하드코딩 대신 실제 시각(로그인 후 클라이언트에서만 렌더되므로 안전)
  const now = new Date();
  const eyebrow = `${now.toLocaleDateString("en-US", { weekday: "long" })} · ${now.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
  const hour = now.getHours();
  const greeting =
    hour >= 5 && hour < 11
      ? "좋은 아침이에요, 하늘님."
      : hour >= 11 && hour < 17
      ? "좋은 오후예요, 하늘님."
      : hour >= 17 && hour < 22
      ? "좋은 저녁이에요, 하늘님."
      : "늦은 밤이에요, 하늘님.";

  return (
    <section className="view active" id="view-home">
      <div className="page-head">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{greeting}</h1>
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
            <div className="gender-toggle" role="group" aria-label="마네킹 체형 선택">
              <button
                className={gender === "female" ? "active" : ""}
                aria-pressed={gender === "female"}
                onClick={() => pickGender("female")}
              >
                여성
              </button>
              <button
                className={gender === "male" ? "active" : ""}
                aria-pressed={gender === "male"}
                onClick={() => pickGender("male")}
              >
                남성
              </button>
            </div>
            <div className="rack mannequin-rack">
              {/* key 리마운트로 조합·체형 변경 시 착장 등장 스태거가 재생된다 */}
              <OutfitMannequin
                key={`${outfitIdx}-${gender}`}
                rack={outfit.rack}
                alt={outfit.alt}
                gender={gender}
              />
            </div>
            <div className="stage-items" aria-hidden="true">
              {(["coat", "top", "pants", "shoe"] as const).map((k) => (
                <div className="stage-chip" key={k} title={outfit.alt[k]}>
                  <img src={outfit.rack[k]} alt="" />
                </div>
              ))}
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
                disabled={worn}
                onClick={wearToday}
              >
                {worn ? "오늘 착용으로 기록됨" : "오늘 입을게요"}
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
            {laundryInOutfit > 0 && (
              <p className="outfit-warn">
                이 조합에는 세탁 대기 중인 옷 {laundryInOutfit}벌이 있어요 — 케어를 마치거나 다른
                조합을 살펴보세요.
              </p>
            )}
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
              <span>{careQueue.length}벌</span>
            </div>
            {careTop ? (
              <div className="care-line">
                <div className="care-ico">≈</div>
                <div>
                  <b>{careTop.name}</b>
                  <span>
                    {careTop.wear} 착용 · {careNote(careTop.name)}
                  </span>
                </div>
                <button className="btn" onClick={() => switchView("care")}>
                  확인
                </button>
              </div>
            ) : (
              <div className="care-line">
                <div className="care-ico">✓</div>
                <div>
                  <b>모든 옷이 준비됐어요</b>
                  <span>세탁 대기 중인 옷이 없어요</span>
                </div>
                <button className="btn" onClick={() => switchView("care")}>
                  케어 열기
                </button>
              </div>
            )}
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
