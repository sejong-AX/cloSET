"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../app-context";
import { Icon } from "../Sprite";
import { BodyStyleModal } from "../BodyStyleModal";
import { Mannequin, STATURE } from "../Mannequin";
import { PastOutfitsModal } from "../PastOutfitsModal";
import { careNote, type Item } from "@/lib/data";
import type { Gender } from "@/lib/garment";
import {
  buildOutfitVariants,
  buildOutfits,
  dayKey,
  defaultOutfitIndex,
  pickPastOutfit,
  wornTodaySigs,
  type Outfit,
  type WeatherLike,
} from "@/lib/outfit";

// ---- 세종시 실시간 날씨 (Open-Meteo, 키 불필요·CORS 허용) ----
interface Weather extends WeatherLike {
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
  const { toast, switchView, items, wearItems, gender, setGender, outfitLog, logOutfit } = useApp();
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [outfitIdx, setOutfitIdx] = useState(0); // 어떤 TPO 카드인지
  const [variantIdx, setVariantIdx] = useState(0); // 그 TPO 안에서 몇 번째 조합인지
  const [tpoOpen, setTpoOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [weather, setWeather] = useState<Weather>(FALLBACK_WEATHER);
  const touched = useRef(false); // 사용자가 조합을 직접 고르면 날씨 자동 선택을 멈춘다

  // 추천은 실제 옷장에서 만든다 — 옷장을 비우면 추천도 비고, 새로 채우면 새 옷으로 다시 만들어진다
  const outfits = useMemo(
    () => buildOutfits({ items, weather, gender }),
    [items, weather, gender]
  );
  const tpoIdx = Math.min(outfitIdx, Math.max(0, outfits.length - 1));
  const activeTpo = outfits[tpoIdx]?.tpo;

  // '다른 조합' — 지금 TPO 안에서 내 옷장 옷만으로 매번 다른 조합을 만들어 둔다(저장된 착장 재사용 아님)
  const variants = useMemo(
    () => (activeTpo ? buildOutfitVariants({ items, weather, gender, tpo: activeTpo, limit: 8 }) : []),
    [items, weather, gender, activeTpo]
  );
  // 반대 성별의 같은 순번 조합 — 같으면 '공용', 다르면 '전용 추천' 배지를 붙인다
  const otherGender: Gender = gender === "female" ? "male" : "female";
  const otherVariants = useMemo(
    () =>
      activeTpo
        ? buildOutfitVariants({ items, weather, gender: otherGender, tpo: activeTpo, limit: 8 })
        : [],
    [items, weather, otherGender, activeTpo]
  );

  const vIdx = Math.min(variantIdx, Math.max(0, variants.length - 1));
  const outfit: Outfit | undefined = variants[vIdx] ?? outfits[tpoIdx];
  const wornSigs = useMemo(() => wornTodaySigs(outfitLog), [outfitLog]);
  const worn = outfit ? wornSigs.has(outfit.sig) : false;

  const shared = useMemo(() => {
    if (!outfit) return true;
    const counterpart = otherVariants[vIdx];
    return !counterpart || counterpart.sig === outfit.sig;
  }, [outfit, otherVariants, vIdx]);

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

  // 날씨에 가장 맞는 조합을 기본 선택 (사용자가 손대기 전까지만)
  useEffect(() => {
    if (touched.current || outfits.length === 0) return;
    setOutfitIdx(defaultOutfitIndex(outfits));
    setVariantIdx(0);
  }, [outfits]);

  // 내 옷장 안에서 실제로 다른 조합을 짜서 넘긴다(다음 순번의 조합 — 저장된 착장이 아니다)
  const nextOutfit = () => {
    if (variants.length < 2) {
      toast("다른 조합을 만들려면 상의·하의가 더 필요해요");
      return;
    }
    touched.current = true;
    const next = (vIdx + 1) % variants.length;
    setVariantIdx(next);
    toast(`내 옷장으로 만든 ${next + 1}번째 조합이에요 · ${variants[next].title}`);
  };

  const selectTpo = (i: number) => {
    touched.current = true;
    setOutfitIdx(i);
    setVariantIdx(0);
    toast(`${outfits[i].tpo.label} 상황에 맞춰 다시 조합했어요`);
  };

  const pickGender = (g: Gender) => {
    if (g === gender) return;
    setGender(g);
    setVariantIdx(0);
    touched.current = false;
    toast(`${g === "female" ? "여성" : "남성"} ${STATURE[g]}cm 기준으로 다시 코디했어요`);
  };

  /** '오늘 입을게요' → 구성 옷을 착용 처리 + 케어 등록 + 기록 저장 */
  const wearToday = () => {
    if (!outfit || worn) return;
    touched.current = true;
    const ids = outfit.items.map((x) => x.id);
    wearItems(ids);
    logOutfit({
      sig: outfit.sig,
      ids,
      at: Date.now(),
      tpo: outfit.tpo.key,
      gender,
      title: outfit.title,
    });
    toast(`오늘 입은 ${ids.length}벌을 케어 대기열에 담았어요`, {
      label: "케어 보기",
      onAction: () => switchView("care"),
    });
  };

  // 지난주 그 조합 — 기록에서 가져온다(오늘이 아닌 최근 착장, 5~14일 전 우선)
  const past = useMemo(() => pickPastOutfit(outfitLog, items), [outfitLog, items]);
  const pastItems: Item[] = useMemo(
    () => (past ? (past.ids.map((id) => items.find((x) => x.id === id)).filter(Boolean) as Item[]) : []),
    [past, items]
  );
  const wearPastAgain = () => {
    if (!past) return;
    const idx = variants.findIndex((o) => o.sig === past.sig);
    if (idx >= 0) {
      touched.current = true;
      setVariantIdx(idx);
      toast("지난 착장을 오늘의 착장으로 올렸어요");
      return;
    }
    // 지금 추천 목록에 없으면(계절·상태가 달라졌을 때) 그 옷들만 바로 착용 처리
    wearItems(past.ids);
    logOutfit({ ...past, at: Date.now() });
    toast(`지난 착장 ${past.ids.length}벌을 다시 입은 것으로 기록했어요`, {
      label: "케어 보기",
      onAction: () => switchView("care"),
    });
  };

  // 케어 카드 — 옷장 실데이터(세탁 필요 상태)와 연동
  const careQueue = items.filter((x) => x.state === "laundry");
  const careTop = careQueue[0];

  // 상단 날짜·인사 — 실제 시각(로그인 후 클라이언트에서만 렌더되므로 안전)
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

  const savedOn = outfit ? saved.has(outfit.sig) : false;
  const toggleSave = () => {
    if (!outfit) return;
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(outfit.sig)) next.delete(outfit.sig);
      else next.add(outfit.sig);
      return next;
    });
    toast(savedOn ? "저장을 해제했어요" : "코디를 저장했어요");
  };

  const genderToggle = (
    <div className="gender-toggle" role="group" aria-label="마네킹 체형 선택">
      {(["female", "male"] as const).map((g) => (
        <button
          key={g}
          className={gender === g ? "active" : ""}
          aria-pressed={gender === g}
          onClick={() => pickGender(g)}
        >
          {g === "female" ? "여성" : "남성"} {STATURE[g]}
        </button>
      ))}
    </div>
  );

  return (
    <section className="view active" id="view-home">
      <div className="page-head">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{greeting}</h1>
          <p>세종시 날씨와 오늘 일정에 맞춰 내 옷장에서 조합했어요.</p>
        </div>
        <div className="head-actions">
          <button className="btn soft" onClick={nextOutfit} title="내 옷장 옷으로 다른 조합을 짜요">
            다른 조합
            {variants.length > 1 && ` ${vIdx + 1}/${variants.length}`}
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
          <b>{outfit ? outfit.tpo.ctxTitle : "추천할 옷이 없어요"}</b>
          <br />
          {outfit ? outfit.tpo.ctxSub : "내 옷장에 옷을 등록하면 조합을 만들어드려요."}
        </div>
        <div className="sync">방금 동기화</div>
      </div>
      {outfits.length > 0 && (
        <div className="tpo-bar">
          <button
            className="tpo-toggle"
            aria-expanded={tpoOpen}
            onClick={() => setTpoOpen((o) => !o)}
          >
            <span className="tpo-toggle-label">🎯 TPO 추천</span>
            <span className="tpo-toggle-cur">
              {outfit?.tpo.icon} {outfit?.tpo.label}
            </span>
            <span className="tpo-caret">{tpoOpen ? "▲" : "▼"}</span>
          </button>
          {tpoOpen && (
            <div className="tpo-chips">
              {outfits.map((o, i) => (
                <button
                  key={o.tpo.key}
                  className={"tpo-chip" + (tpoIdx === i ? " active" : "")}
                  onClick={() => selectTpo(i)}
                >
                  <span>{o.tpo.icon}</span> {o.tpo.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="grid home-grid">
        <article className="card hero-outfit">
          <div className="outfit-stage">
            {outfit && <div className="stage-pill">{outfit.pill}</div>}
            {genderToggle}
            <div className="rack mannequin-rack">
              {/* key 리마운트로 조합·체형 변경 시 착장 등장 스태거가 재생된다 */}
              <Mannequin
                key={`${outfit?.sig ?? "empty"}-${gender}`}
                slots={outfit?.slots ?? {}}
                gender={gender}
                uid={`hero-${gender}`}
              />
            </div>
            {outfit && (
              <div className="stage-items" aria-hidden="true">
                {outfit.items.map((x) => (
                  <div className="stage-chip" key={x.id} title={x.name}>
                    <img src={x.img} alt="" />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="outfit-info">
            {outfit ? (
              <>
                <div className="rank">
                  {outfit.rank}
                  <span className={"gender-tag" + (shared ? " shared" : "")}>
                    {shared ? "여성·남성 공용" : `${gender === "female" ? "여성" : "남성"} 전용 추천`}
                  </span>
                </div>
                <h2>{outfit.title}</h2>
                <p>{outfit.desc}</p>
                <div className="lens">
                  {([
                    [outfit.scores.weather, "날씨"],
                    [outfit.scores.tpo, "TPO"],
                    [outfit.scores.color, "컬러"],
                    [outfit.scores.fit, "핏"],
                  ] as const).map(([score, label]) => (
                    <div key={label}>
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
                  <button className="icon-btn" aria-label="코디 저장" onClick={toggleSave}>
                    {savedOn ? "♥" : "♡"}
                  </button>
                </div>
                {outfit.laundryCount > 0 && !worn && (
                  <p className="outfit-warn">
                    이 조합에는 세탁 대기 중인 옷 {outfit.laundryCount}벌이 있어요 — 케어를 마치거나
                    다른 조합을 살펴보세요.
                  </p>
                )}
              </>
            ) : (
              <div className="outfit-empty">
                <Icon id="i-closet" />
                <b>{items.length === 0 ? "옷장이 비어 있어요" : "조합할 옷이 부족해요"}</b>
                <p>
                  {items.length === 0
                    ? "내 옷장에서 사진으로 옷을 등록하면 오늘의 착장을 만들어드려요."
                    : "상의와 하의가 각각 한 점 이상 있으면 조합을 만들 수 있어요."}
                </p>
                <button className="btn primary" onClick={() => switchView("closet")}>
                  <Icon id="i-plus" />
                  내 옷장 열기
                </button>
              </div>
            )}
          </div>
        </article>
        <div className="side-stack">
          <article className="card mini-outfit">
            <div className="section-title">
              <h2>지난주 그 조합</h2>
              <button className="text-link" onClick={() => setPastOpen(true)}>
                모두 보기
              </button>
            </div>
            {past && pastItems.length > 0 ? (
              <>
                <div className="outfit-row">
                  {pastItems.slice(0, 4).map((x) => (
                    <div className="swatch-item" key={x.id}>
                      <img src={x.img} alt={x.name} />
                    </div>
                  ))}
                </div>
                <div className="saved-meta">
                  <span>
                    {past.title} · {daysAgoLabel(past.at)}
                  </span>
                  <button className="text-link" onClick={wearPastAgain}>
                    다시 입기 →
                  </button>
                </div>
              </>
            ) : (
              <div className="mini-empty">
                <b>아직 기록된 착장이 없어요</b>
                <span>
                  {outfitLog.length > 0
                    ? "기록에 있던 옷이 옷장에서 사라져 초기화했어요."
                    : "‘오늘 입을게요’를 누르면 여기에 쌓여요."}
                </span>
              </div>
            )}
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
          <strong>{weekWearCount(outfitLog)}벌</strong>
          <small>착장 기록 기준</small>
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
      <PastOutfitsModal
        open={pastOpen}
        onClose={() => setPastOpen(false)}
        onWear={(entry) => {
          const idx = variants.findIndex((o) => o.sig === entry.sig);
          if (idx >= 0) {
            touched.current = true;
            setVariantIdx(idx);
            toast("저장 코디를 오늘의 착장으로 올렸어요");
          } else {
            wearItems(entry.ids);
            logOutfit({ ...entry, at: Date.now() });
            toast("다시 입은 것으로 기록했어요");
          }
          setPastOpen(false);
        }}
      />
    </section>
  );
}

function daysAgoLabel(at: number): string {
  const d = Math.round((Date.now() - at) / 86400000);
  if (dayKey(at) === dayKey()) return "오늘";
  if (d <= 1) return "어제";
  if (d < 7) return `${d}일 전`;
  if (d < 14) return "지난주";
  return `${Math.floor(d / 7)}주 전`;
}

/** 최근 7일 착장 기록에 담긴 옷 수 */
function weekWearCount(log: { at: number; ids: string[] }[]): number {
  const since = Date.now() - 7 * 86400000;
  return log.filter((e) => e.at >= since).reduce((s, e) => s + e.ids.length, 0);
}
