"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppContext, type AppContextValue } from "./app-context";
import { Icon } from "./Sprite";
import { initialItems, viewTitles, type Item, type ViewName } from "@/lib/data";
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

interface AppShellProps {
  toast: (msg: string) => void;
  onLogout: () => void;
}

export function AppShell({ toast, onLogout }: AppShellProps) {
  const [view, setView] = useState<ViewName>("home");
  const [closetQuery, setClosetQuery] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [reduced, setReduced] = useState(false);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [notifOpen, setNotifOpen] = useState(false);
  const idCounter = useRef(0);

  const addClothing = useCallback((item: Omit<Item, "id">) => {
    idCounter.current += 1;
    setItems((prev) => [{ ...item, id: `new-${idCounter.current}` }, ...prev]);
  }, []);

  const removeClothing = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  useEffect(() => {
    setReduced(prefersReduced());
  }, []);

  const switchView = useCallback((v: ViewName) => {
    setView(v);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const logout = useCallback(() => {
    toast("안전하게 로그아웃했어요");
    onLogout();
  }, [toast, onLogout]);

  // 뷰 진입 애니메이션
  useEffect(() => {
    const el = document.getElementById("view-" + view);
    if (!el) return;
    const ctx = playViewEntrance(el as HTMLElement, reduced);
    return () => {
      ctx?.revert();
    };
  }, [view, reduced]);

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
    }),
    [view, switchView, toast, closetQuery, reduced, logout, items, addClothing, removeClothing]
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
              const cnt = n.v === "closet" ? items.length : n.count;
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
                <span className="dot"></span>
              </button>
              {notifOpen && (
                <>
                  <div className="notif-backdrop" onClick={() => setNotifOpen(false)} />
                  <div className="notif-panel" role="menu">
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
                    <button className="notif-all" onClick={() => setNotifOpen(false)}>
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
