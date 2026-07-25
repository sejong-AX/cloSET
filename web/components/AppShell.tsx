"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppContext, type AppContextValue } from "./app-context";
import { Icon } from "./Sprite";
import {
  initialItems,
  viewTitles,
  STATE_LABEL,
  wearCount,
  type ClothState,
  type Item,
  type TrashEntry,
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
  { icon: "🧺", title: "그레이 울 니트가 세탁 임계(3회)에 도달했어요", time: "2시간 전", view: "care" },
  { icon: "♻️", title: "브라운 울 코트를 126일째 안 입었어요 — 순환을 제안해요", time: "어제", view: "reuse" },
  { icon: "🌤️", title: "오늘 세종시 날씨에 맞춰 추천 조합을 갱신했어요", time: "오전 8:10", view: "home" },
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
const TRASH_KEY = "closet.trash";
const TRASH_MAX = 20; // 사진 data URL 누적으로 저장소가 넘치지 않도록 상한

export function AppShell({ toast, onLogout }: AppShellProps) {
  const [view, setView] = useState<ViewName>("home");
  const [closetQuery, setClosetQuery] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  // 감속 선호를 동기 초기화 → 최초 진입 애니메이션도 즉시 존중
  const [reduced] = useState<boolean>(() => prefersReduced());
  const [items, setItems] = useState<Item[]>(initialItems);
  const [trash, setTrash] = useState<TrashEntry[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [notifOpen, setNotifOpen] = useState(false);
  // 알림별 읽음 상태 — 항목을 열거나 '모두 읽음'을 눌러야 읽음 처리된다(패널 열림만으로는 아님)
  const [notifRead, setNotifRead] = useState<Set<number>>(new Set());
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
      const rawT = localStorage.getItem(TRASH_KEY);
      const parsedT = rawT ? JSON.parse(rawT) : null;
      if (Array.isArray(parsedT)) setTrash(parsedT as TrashEntry[]);
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
      localStorage.setItem(TRASH_KEY, JSON.stringify(trash));
    } catch {
      // 용량 초과 등 저장 실패 — 사일런트 방지로 1회 안내(사진 일괄 등록 시 썸네일 누적)
      if (!quotaWarned.current) {
        quotaWarned.current = true;
        toast("옷장 저장 공간이 가득 찼어요. 최근 변경은 이번 세션에만 유지돼요.");
      }
    }
  }, [items, favorites, trash, hydrated, toast]);

  const addClothing = useCallback((item: Omit<Item, "id">) => {
    idCounter.current += 1;
    // id 는 호출 시점에 확정한다. updater 안에서 idCounter 를 읽으면 여러 건을
    // 한 배치로 추가할 때(사진 일괄 등록) 모든 updater 가 최종 카운터 값을 읽어 키가 충돌한다.
    const id = `new-${Date.now()}-${idCounter.current}`;
    setItems((prev) => [{ ...item, id }, ...prev]);
  }, []);

  // 삭제 = 휴지통으로 이동. 실수로 지운 옷을 복원할 수 있다(상한 초과 시 오래된 것부터 밀려남).
  const removeClothing = useCallback((item: Item) => {
    setItems((prev) => prev.filter((x) => x.id !== item.id));
    setTrash((prev) =>
      [{ item, deletedAt: Date.now() }, ...prev.filter((e) => e.item.id !== item.id)].slice(
        0,
        TRASH_MAX
      )
    );
    setFavorites((prev) => {
      if (!prev.has(item.id)) return prev;
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  }, []);

  const restoreClothing = useCallback((item: Item) => {
    setItems((prev) => (prev.some((x) => x.id === item.id) ? prev : [item, ...prev]));
    // 토스트 '되돌리기'로 복원돼도 휴지통에 남은 사본은 정리
    setTrash((prev) => prev.filter((e) => e.item.id !== item.id));
  }, []);

  const restoreFromTrash = useCallback(
    (id: string) => {
      const entry = trash.find((e) => e.item.id === id);
      if (!entry) return;
      setTrash((prev) => prev.filter((e) => e.item.id !== id));
      setItems((cur) => (cur.some((x) => x.id === entry.item.id) ? cur : [entry.item, ...cur]));
    },
    [trash]
  );

  const purgeTrash = useCallback((id?: string) => {
    setTrash((prev) => (id === undefined ? [] : prev.filter((e) => e.item.id !== id)));
  }, []);

  // '오늘 입을게요' — 착장에 포함된 옷(사진 경로 매칭)을 착용 +1, 오늘 착용, 세탁 대기열로.
  const wearOutfit = useCallback((imgs: string[]) => {
    setItems((prev) =>
      prev.map((x) =>
        imgs.includes(x.img)
          ? {
              ...x,
              wear: `${wearCount(x.wear) + 1}회`,
              daysAgo: 0,
              state: "laundry" as ClothState,
              label: STATE_LABEL.laundry,
            }
          : x
      )
    );
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

  // 알림 패널: Esc 닫기 + 첫 항목 포커스 (읽음 처리는 항목 클릭/모두 읽음에서만)
  useEffect(() => {
    if (!notifOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNotifOpen(false);
    };
    window.addEventListener("keydown", onKey);
    notifPanelRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [notifOpen]);

  const unreadCount = NOTIFS.length - notifRead.size;
  const markNotifRead = (i: number) =>
    setNotifRead((prev) => {
      if (prev.has(i)) return prev;
      const next = new Set(prev);
      next.add(i);
      return next;
    });

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
      wearOutfit,
      trash,
      restoreFromTrash,
      purgeTrash,
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
      wearOutfit,
      trash,
      restoreFromTrash,
      purgeTrash,
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
            <button
              className="brand-btn"
              aria-label="오늘의 착장으로 이동"
              onClick={() => switchView("home")}
            >
              <img className="brand-logo" src="/brand/closet-logo.png" alt="cloSET" />
            </button>
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
            <button
              className="mobile-logo brand-btn"
              aria-label="오늘의 착장으로 이동"
              onClick={() => switchView("home")}
            >
              <img className="mobile-brand-logo" src="/brand/closet-logo.png" alt="cloSET" />
            </button>
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
                aria-label={unreadCount > 0 ? `알림 ${unreadCount}건 안 읽음` : "알림"}
                aria-expanded={notifOpen}
                onClick={() => setNotifOpen((o) => !o)}
              >
                <Icon id="i-bell" />
                {unreadCount > 0 && <span className="dot"></span>}
              </button>
              {notifOpen && (
                <>
                  <div className="notif-backdrop" onClick={() => setNotifOpen(false)} />
                  <div className="notif-panel" role="dialog" aria-label="알림" ref={notifPanelRef}>
                    <div className="notif-head">
                      알림{" "}
                      <span>
                        {unreadCount > 0 ? `안 읽음 ${unreadCount}건` : "모두 읽음"}
                      </span>
                    </div>
                    {NOTIFS.map((n, i) => (
                      <button
                        className={"notif-item" + (notifRead.has(i) ? " read" : "")}
                        key={i}
                        onClick={() => {
                          markNotifRead(i);
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
                        {!notifRead.has(i) && <span className="notif-unread" aria-hidden="true" />}
                      </button>
                    ))}
                    <button
                      className="notif-all"
                      onClick={() => {
                        setNotifRead(new Set(NOTIFS.map((_, i) => i)));
                        setNotifOpen(false);
                        toast("알림을 모두 읽음으로 표시했어요");
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
