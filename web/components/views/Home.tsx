"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useApp } from "../app-context";
import { Icon } from "../Sprite";

interface Outfit {
  rank: string;
  pill: string;
  title: string;
  desc: string;
  lens: string[][];
  rack: { coat: string; top: string; pants: string; shoe: string };
  alt: { coat: string; top: string; pants: string; shoe: string };
}

// "다른 조합" 이 순환하는 실제 착장 조합들 (public/items 사진)
const OUTFITS: Outfit[] = [
  {
    rank: "BEST MATCH 01",
    pill: "51일 만에 다시 만난 니트",
    title: "비 오는 날의 차분한 네이비",
    desc: "생활 방수가 되는 트렌치에 여름 쿨톤과 잘 맞는 네이비 니트를 조합했어요. 저녁 기온이 내려가도 편안해요.",
    lens: [["96", "날씨"], ["92", "TPO"], ["91", "컬러"], ["88", "핏"]],
    rack: { coat: "/items/coat.jpg", top: "/items/knit.jpg", pants: "/items/pants.jpg", shoe: "/items/shoe.jpg" },
    alt: { coat: "베이지 트렌치코트", top: "네이비 울 니트", pants: "크림 와이드 팬츠", shoe: "스웨이드 로퍼" },
  },
  {
    rank: "BEST MATCH 02",
    pill: "이번 주 세 번째 데님",
    title: "선선한 오후의 데님 캐주얼",
    desc: "생활 방수 데님 자켓에 화이트 셔츠를 받쳐 캐주얼하게. 미팅 후 저녁 약속까지 부담 없어요.",
    lens: [["91", "날씨"], ["88", "TPO"], ["90", "컬러"], ["86", "핏"]],
    rack: { coat: "/items/denim-jacket.jpg", top: "/items/shirt-white.jpg", pants: "/items/jeans-blue.jpg", shoe: "/items/boots-chelsea.jpg" },
    alt: { coat: "인디고 데님 자켓", top: "화이트 코튼 셔츠", pants: "인디고 슬림 진", shoe: "탄 첼시 부츠" },
  },
  {
    rank: "BEST MATCH 03",
    pill: "42일 만에 꺼낸 가디건",
    title: "포근한 아이보리 니트 무드",
    desc: "아이보리 케이블 가디건에 크림 팬츠로 톤을 맞췄어요. 여름 쿨톤과 잘 어울리고 실내에서도 따뜻해요.",
    lens: [["89", "날씨"], ["90", "TPO"], ["93", "컬러"], ["85", "핏"]],
    rack: { coat: "/items/cardigan-ivory.jpg", top: "/items/knit-cream.jpg", pants: "/items/pants.jpg", shoe: "/items/boots-chelsea.jpg" },
    alt: { coat: "아이보리 케이블 가디건", top: "아이보리 케이블 니트", pants: "크림 와이드 팬츠", shoe: "탄 첼시 부츠" },
  },
  {
    rank: "BEST MATCH 04",
    pill: "톤온톤 브라운 데일리",
    title: "브라운 톤 데일리 레이어드",
    desc: "그레이 가디건에 오트밀 셔츠를 겹쳐 차분하게. 데님과 스니커즈로 활동성을 더했어요.",
    lens: [["90", "날씨"], ["87", "TPO"], ["89", "컬러"], ["88", "핏"]],
    rack: { coat: "/items/cardigan-gray.jpg", top: "/items/shirt-oatmeal.jpg", pants: "/items/jeans-blue.jpg", shoe: "/items/shoe.jpg" },
    alt: { coat: "그레이 리브드 가디건", top: "오트밀 린넨 셔츠", pants: "인디고 슬림 진", shoe: "스웨이드 로퍼" },
  },
];

export function HomeView() {
  const { toast, switchView } = useApp();
  const [wearLabel, setWearLabel] = useState("오늘 입을게요");
  const [worn, setWorn] = useState(false);
  const [saved, setSaved] = useState(false);
  const [outfitIdx, setOutfitIdx] = useState(0);
  const outfit = OUTFITS[outfitIdx];
  const rackRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // 조합이 바뀔 때 랙 이미지 재진입 애니메이션(최초 렌더는 뷰 진입 연출에 양보)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
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

  return (
    <section className="view active" id="view-home">
      <div className="page-head">
        <div>
          <div className="eyebrow">Tuesday · July 21</div>
          <h1>좋은 아침이에요, 하늘님.</h1>
          <p>비 오는 오후 미팅에 맞춘 조합을 준비했어요.</p>
        </div>
        <div className="head-actions">
          <button className="btn soft" onClick={nextOutfit}>
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
                <img src="/items/shirt.jpg" alt="오프화이트 셔츠" />
              </div>
              <div className="swatch-item">
                <img src="/items/knit2.jpg" alt="블랙 오버핏 니트" />
              </div>
              <div className="swatch-item">
                <img src="/items/pants.jpg" alt="차콜 슬랙스" />
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
    </section>
  );
}
