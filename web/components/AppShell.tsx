"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppContext, type AppContextValue } from "./app-context";
import { Icon } from "./Sprite";
import {
  initialItems,
  viewTitles,
  STATE_LABEL,
  type ClothState,
  type Item,
  type ViewName,
} from "@/lib/data";
import { playViewEntrance, prefersReduced } from "@/lib/anim";
import { HomeView } from "./views/Home";
import { ClosetView } from "./views/Closet";
import { ScanView } from "./views/Scan";
import { CareView } from "./views/Care";
import { ReuseView } from "./views/Reuse";
import { InsightsView } from "./views/Insights";
import { SettingsView } from "./views/Settings";

interface NavItem {
  v: ViewName;
  icon: string;
  label: string;
  count?: number;
}

const NAV1: NavItem[] = [
  { v: "home", icon: "i-home", label: "오늘의 착장" },
  { v: "closet", icon: "i-closet", label: "내 옷장", count: 24 },
  { v: "scan", icon: "i-scan", label: "Snap & Check" },
  { v: "care", icon: "i-care", label: "케어", count: 3 },
  { v: "reuse", icon: "i-reuse", label: "순환하기" },
];
const NAV2: NavItem[] = [
  { v: "insights", icon: "i-chart", label: "지출·탄소" },
  { v: "settings", icon: "i-set", label: "설정" },
];
const MNAV: NavItem[] = [
  { v: "home", icon: "i-home", label: "홈" },
  { v: "closet", icon: "i-closet", label: "옷장" },
  { v: "scan", icon: "i-scan", label: "스캔" },
  { v: "care", icon: "i-care", label: "케어" },
  { v: "settings", icon: "i-set", label: "마이" },
];

interface Notif {
  icon: string;
  title: string;
  time: string;
  view: ViewName;
}
const NOTIFS: Notif[] = [
  { icon: "🧺", title: "네이비 울 니트가 세탁 임계(3회)에 도달했어요", time: "2시간 전", view: "care" },
  { icon: "♻️", title: "브라운 울 코트를 126일째 안 입었어요 — 순환을 제안해요", time: "어제", view: "reuse" },
  { icon: "☂️", title: "오후 비 확률 70% — 트렌치가 포함된 조합을 추천했어요", time: "오전 8:10", view: "home" },
];

interface ToastAction {
  label: string;
  onAction: () => void;
}
interface AppShellProps {
  toast: (msg: string, action?: ToastAction) => void;
  onLogout: () => void;
}

const ITEMS_KEY = "closet.items";
const FAVS_KEY = "closet.favorites";

export function AppShell({ toast, onLogout }: AppShellProps) {
  const [view, setView] = useState<ViewName>("home");
  const [closetQuery, setClosetQuery] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  // 감속 선호를 동기 초기화 → 최초 진입 애니메이션도 즉시 존중
  const [reduced] = useState<boolean>(() => prefersReduced());
  const [items, setItems] = useState<Item[]>(initialItems);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifRead, setNotifRead] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const idCounter = useRef(0);
  const quotaWarned = useRef(false);
  const notifPanelRef = useRef<HTMLDivElement | null>(null);

  // 저장소 복원 (마운트 후 — SSR 하이드레이션 불일치 방지)
  useEffect(() => {
    try {
      const rawI = localStorage.getItem(ITEMS_KEY);
      const parsedI = rawI ? JSON.parse(rawI) : null;
      if (Array.isArray(parsedI) && parsedI.length) setItems(parsedI as Item[]);
      const rawF = localStorage.getItem(FAVS_KEY);
      const parsedF = rawF ? JSON.parse(rawF) : null;
      if (Array.isArray(parsedF)) setFavorites(new Set(parsedF as string[]));
    } catch {
      /* 손상된 저장소 무시 */
    }
    setHydrated(true);
  }, []);

  // 변경 저장 (복원 완료 후에만 → 시드가 저장값을 덮어쓰는 레이스 차단)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
      localStorage.setItem(FAVS_KEY, JSON.stringify([...favorites]));
    } catch {
      // 용량 초과 등 저장 실패 — 사일런트 방지로 1회 안내(사진 일괄 등록 시 썸네일 누적)
      if (!quotaWarned.current) {
        quotaWarned.current = true;
        toast("옷장 저장 공간이 가득 찼어요. 최근 변경은 이번 세션에만 유지돼요.");
      }
    }
  }, [items, favorites, hydrated, toast]);

  const addClothing = useCallback((item: Omit<Item, "id">) => {
    idCounter.current += 1;
    // id 는 호출 시점에 확정한다. updater 안에서 idCounter 를 읽으면 여러 건을
    // 한 배치로 추가할 때(사진 일괄 등록) 모든 updater 가 최종 카운터 값을 읽어 키가 충돌한다.
    const id = `new-${Date.now()}-${idCounter.current}`;
    setItems((prev) => [{ ...item, id }, ...prev]);
  }, []);

  const removeClothing = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    setFavorites((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const restoreClothing = useCallback((item: Item) => {
    setItems((prev) => (prev.some((x) => x.id === item.id) ? prev : [item, ...prev]));
  }, []);

  const setClothingState = useCallback((id: string, state: ClothState) => {
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, state, label: STATE_LABEL[state] } : x))
    );
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const switchView = useCallback(
    (v: ViewName) => {
      setView(v);
      if (typeof window !== "undefined")
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    },
    [reduced]
  );

  const logout = useCallback(() => {
    toast("안전하게 로그아웃했어요");
    onLogout();
  }, [toast, onLogout]);

  // 뷰 진입 애니메이션
  useEffect(() => {
    const el = document.getElementById("view-" + view);
    if (!el) return;
    const c = playViewEntrance(el as HTMLElement, reduced);
    return () => {
      c?.revert();
    };
  }, [view, reduced]);

  // 알림 패널: 열리면 읽음 처리(점 제거) + Esc 닫기 + 첫 항목 포커스
  useEffect(() => {
    if (!notifOpen) return;
    setNotifRead(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotifOpen(false);
    };
    window.addEventListener("keydown", onKey);
    notifPanelRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [notifOpen]);

  const laundryCount = useMemo(
    () => items.filter((x) => x.state === "laundry").length,
    [items]
  );

  const ctx: AppContextValue = useMemo(
    () => ({
      view,
      switchView,
      toast,
      closetQuery,
      setClosetQuery,
      reducedMotion: reduced,
      logout,
      items,
      addClothing,
      removeClothing,
      restoreClothing,
      setClothingState,
      favorites,
      toggleFavorite,
    }),
    [
      view,
      switchView,
      toast,
      closetQuery,
      reduced,
      logout,
      items,
      addClothing,
      removeClothing,
      restoreClothing,
      setClothingState,
      favorites,
      toggleFavorite,
    ]
  );

  const submitGlobalSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      switchView("closet");
      setClosetQuery(globalSearch);
      toast("옷장에서 검색했어요");
    }
  };

  return (
    <AppContext.Provider value={ctx}>
      <div className="app" id="appRoot">
        <aside className="sidebar">
          <div className="brand">
            <div className="brandmark">
              <Icon id="i-closet" />
            </div>
            <div className="brandtext">
              clo<b>SET</b>
            </div>
          </div>
          <div className="nav-label">My wardrobe</div>
          <nav className="nav">
            {NAV1.map((n) => {
              const cnt =
                n.v === "closet"
                  ? items.length
                  : n.v === "care"
                  ? laundryCount
                  : n.count;
              return (
                <button
                  key={n.v}
                  className={view === n.v ? "active" : ""}
                  onClick={() => switchView(n.v)}
                >
                  <Icon id={n.icon} />
                  {n.label}
                  {cnt !== undefined && <span className="count">{cnt}</span>}
                </button>
              );
            })}
          </nav>
          <div className="nav-label" style={{ marginTop: "20px" }}>
            Account
          </div>
          <nav className="nav">
            {NAV2.map((n) => (
              <button
                key={n.v}
                className={view === n.v ? "active" : ""}
                onClick={() => switchView(n.v)}
              >
                <Icon id={n.icon} />
                {n.label}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="eco-mini">
              <strong>47.2 kg</strong>
              <p>지금까지 줄인 것으로 추정되는 CO₂e예요. 계수 기준 v1.2</p>
            </div>
            <div className="profile-mini">
              <div className="avatar">하</div>
              <div>
                <b>김하늘</b>
                <span>여름 쿨 · Straight</span>
              </div>
            </div>
          </div>
        </aside>
        <main className="main">
          <header className="topbar">
            <div className="mobile-logo">
              <div className="brandmark">
                <Icon id="i-closet" />
              </div>
              cloSET
            </div>
            <div className="crumb" id="crumb">
              {viewTitles[view]}
            </div>
            <label className="search">
              <Icon id="i-search" />
              <input
                placeholder="옷, 소재, 위치를 검색해 보세요"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={submitGlobalSearch}
              />
            </label>
            <div className="notif-wrap">
              <button
                className="icon-btn"
                aria-label="알림"
                aria-expanded={notifOpen}
                onClick={() => setNotifOpen((o) => !o)}
              >
                <Icon id="i-bell" />
                {!notifRead && <span className="dot"></span>}
              </button>
              {notifOpen && (
                <>
                  <div className="notif-backdrop" onClick={() => setNotifOpen(false)} />
                  <div className="notif-panel" role="dialog" aria-label="알림" ref={notifPanelRef}>
                    <div className="notif-head">
                      알림 <span>{NOTIFS.length}건</span>
                    </div>
                    {NOTIFS.map((n, i) => (
                      <button
                        className="notif-item"
                        key={i}
                        onClick={() => {
                          setNotifOpen(false);
                          switchView(n.view);
                          toast("알림에서 이동했어요");
                        }}
                      >
                        <span className="notif-ico">{n.icon}</span>
                        <span className="notif-body">
                          <b>{n.title}</b>
                          <span>{n.time}</span>
                        </span>
                      </button>
                    ))}
                    <button
                      className="notif-all"
                      onClick={() => {
                        setNotifRead(true);
                        setNotifOpen(false);
                      }}
                    >
                      모두 읽음으로 표시
                    </button>
                  </div>
                </>
              )}
            </div>
          </header>
          <div className="content">
            {view === "home" && <HomeView />}
            {view === "closet" && <ClosetView />}
            {view === "scan" && <ScanView />}
            {view === "care" && <CareView />}
            {view === "reuse" && <ReuseView />}
            {view === "insights" && <InsightsView />}
            {view === "settings" && <SettingsView />}
          </div>
        </main>
        <nav className="mobile-nav">
          {MNAV.map((n) => (
            <button
              key={n.v}
              className={view === n.v ? "active" : ""}
              onClick={() => switchView(n.v)}
            >
              <Icon id={n.icon} />
              {n.label}
            </button>
          ))}
        </nav>
      </div>
    </AppContext.Provider>
  );
}
