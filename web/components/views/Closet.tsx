"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../app-context";
import { Icon } from "../Sprite";
import type { ClothState, Item } from "@/lib/data";

const FILTER_DEFS: { key: string; name: string }[] = [
  { key: "all", name: "전체" },
  { key: "available", name: "입을 수 있음" },
  { key: "laundry", name: "세탁" },
  { key: "stored", name: "보관" },
  { key: "reuse", name: "순환 후보" },
  { key: "favorite", name: "즐겨찾기" },
];

// 새 옷 등록 시 카테고리별 기본 사진·표기
const CATEGORY_META: Record<string, { type: string; img: string; bg: string; color: string }> = {
  상의: { type: "top-g", img: "/items/shirt-white.jpg", bg: "#eef0ec", color: "#e7e5dc" },
  하의: { type: "pants", img: "/items/pants.jpg", bg: "#e2e7ec", color: "#6b83a0" },
  아우터: { type: "coat", img: "/items/cardigan-ivory.jpg", bg: "#efe9de", color: "#e3d8c2" },
  신발: { type: "shoe", img: "/items/shoe.jpg", bg: "#eee5da", color: "#765c48" },
};

const parsePrice = (s: string) => {
  const n = parseInt(s.replace(/[^\d]/g, ""), 10);
  return isFinite(n) ? n : 0;
};
const wearNum = (x: Item) => parseInt(x.wear.replace(/[^\d]/g, ""), 10) || 0;
const cpwNum = (x: Item) => (x.cpw.includes("—") ? Infinity : parsePrice(x.cpw));

type SortKey = null | "wear" | "cpw";

export function ClosetView() {
  const {
    toast,
    closetQuery,
    setClosetQuery,
    items,
    addClothing,
    removeClothing,
    restoreClothing,
    favorites,
    toggleFavorite,
  } = useApp();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("오프화이트 셔츠");
  const [category, setCategory] = useState("상의");
  const [location, setLocation] = useState("옷장 1");
  const [price, setPrice] = useState("59,000원");
  const [newPhoto, setNewPhoto] = useState<string | null>(null);
  const newFileRef = useRef<HTMLInputElement>(null);
  const pendingUrlRef = useRef<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // 모달에서 첨부한 사진(선택). 등록 시 아이템이 URL 을 소유하므로 그때는 revoke 하지 않는다.
  const handleNewPhoto = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("이미지 파일(JPG·PNG)만 첨부할 수 있어요");
      return;
    }
    if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
    const url = URL.createObjectURL(file);
    pendingUrlRef.current = url;
    setNewPhoto(url);
  };

  const closeModal = () => {
    if (pendingUrlRef.current) {
      URL.revokeObjectURL(pendingUrlRef.current);
      pendingUrlRef.current = null;
    }
    setNewPhoto(null);
    setModalOpen(false);
  };

  // 언마운트 시 미등록 사진 objectURL 정리
  useEffect(
    () => () => {
      if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
    },
    []
  );

  // 전역 검색(상단바)에서 넘어온 검색어 반영
  useEffect(() => {
    if (closetQuery) {
      setSearch(closetQuery);
      setFilter("all");
      setClosetQuery("");
    }
  }, [closetQuery, setClosetQuery]);

  // 모달 Esc 로 닫기
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  // 모달 열림: 포커스 이동 + 닫힘 시 트리거로 복귀
  useEffect(() => {
    if (!modalOpen) return;
    triggerRef.current = document.activeElement as HTMLElement | null;
    firstFieldRef.current?.focus();
    return () => {
      const t = triggerRef.current;
      if (t && document.contains(t)) t.focus();
    };
  }, [modalOpen]);

  const trapTab = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const nodes = modalRef.current?.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    );
    if (!nodes || nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length, favorite: favorites.size };
    for (const f of FILTER_DEFS) {
      if (f.key !== "all" && f.key !== "favorite")
        c[f.key] = items.filter((x) => x.state === f.key).length;
    }
    return c;
  }, [items, favorites]);

  const list = useMemo(() => {
    let out =
      filter === "all"
        ? items
        : filter === "favorite"
        ? items.filter((x) => favorites.has(x.id))
        : items.filter((x) => x.state === filter);
    if (search) out = out.filter((x) => (x.name + x.cat).includes(search));
    if (sort === "wear") out = [...out].sort((a, b) => wearNum(b) - wearNum(a));
    else if (sort === "cpw") out = [...out].sort((a, b) => cpwNum(a) - cpwNum(b));
    return out;
  }, [items, filter, search, sort, favorites]);

  const addItem = () => {
    const name = newName.trim() || "새 옷";
    const meta = CATEGORY_META[category] ?? CATEGORY_META["상의"];
    addClothing({
      name,
      cat: `${category} · ${location}`,
      state: "available" as ClothState,
      label: "입을 수 있음",
      bg: meta.bg,
      type: meta.type,
      color: meta.color,
      wear: "0회",
      cpw: "—", // 착용 전에는 회당 비용 미정(구매가를 회당 비용으로 오표기하지 않음)
      img: newPhoto ?? meta.img,
      daysAgo: 0,
    });
    pendingUrlRef.current = null; // 사진을 아이템이 소유
    setNewPhoto(null);
    setModalOpen(false);
    setFilter("all");
    setSearch("");
    toast(`'${name}'을(를) 옷장에 추가했어요`);
  };

  const deleteItem = (item: Item) => {
    removeClothing(item.id);
    toast(`'${item.name}'을(를) 옷장에서 삭제했어요`, {
      label: "되돌리기",
      onAction: () => restoreClothing(item),
    });
  };

  const toggleSort = (key: Exclude<SortKey, null>, onMsg: string) => {
    const next = sort === key ? null : key;
    setSort(next);
    toast(next ? onMsg : "기본 순서로 되돌렸어요");
  };

  return (
    <section className="view active" id="view-closet">
      <div className="page-head">
        <div>
          <div className="eyebrow">MY CLOSET · {items.length} ITEMS</div>
          <h1>내 옷장</h1>
          <p>상태와 위치가 연결된 살아 있는 옷장이에요.</p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => toast("구매내역 가져오기 화면을 열었어요")}>
            구매내역 가져오기
          </button>
          <button className="btn primary" onClick={() => setModalOpen(true)}>
            <Icon id="i-plus" />새 옷 등록
          </button>
        </div>
      </div>
      <div className="stat-chips">
        {FILTER_DEFS.map((f) => (
          <button
            key={f.key}
            className={"chip" + (filter === f.key ? " active" : "")}
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.name} {counts[f.key] ?? 0}
          </button>
        ))}
      </div>
      <div className="closet-tools">
        <label className="search">
          <Icon id="i-search" />
          <input
            aria-label="옷장 검색"
            placeholder="이름 · 카테고리 · 위치로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button
          className={"btn" + (sort === "wear" ? " active" : "")}
          aria-pressed={sort === "wear"}
          onClick={() => toggleSort("wear", "착용 많은 순으로 정렬했어요")}
        >
          착용 많은 순
        </button>
        <button
          className={"btn" + (sort === "cpw" ? " active" : "")}
          aria-pressed={sort === "cpw"}
          onClick={() => toggleSort("cpw", "회당 비용 낮은 순으로 정렬했어요")}
        >
          회당 비용 낮은 순
        </button>
      </div>
      {list.length === 0 ? (
        <div className="closet-empty">
          <Icon id="i-closet" />
          <b>{items.length === 0 ? "옷장이 비어 있어요" : "조건에 맞는 옷이 없어요"}</b>
          <p>
            {items.length === 0
              ? "새 옷을 등록해 옷장을 채워보세요."
              : "검색어나 필터를 바꿔보세요."}
          </p>
          {items.length === 0 ? (
            <button className="btn primary" onClick={() => setModalOpen(true)}>
              <Icon id="i-plus" />새 옷 등록
            </button>
          ) : (
            <button
              className="btn"
              onClick={() => {
                setSearch("");
                setFilter("all");
                setSort(null);
              }}
            >
              필터 초기화
            </button>
          )}
        </div>
      ) : (
        <div className="closet-grid" id="closetGrid">
          {list.map((x) => {
            const fav = favorites.has(x.id);
            return (
              <article
                className="card cloth-card"
                data-state={x.state}
                key={x.id}
                onClick={() => toast("옷 상세 목업: 상태·착용·케어·코디 탭으로 이동합니다")}
              >
                <div className="cloth-photo" style={{ background: x.bg }}>
                  <span className="state-badge">{x.label}</span>
                  <button
                    className="cloth-del"
                    aria-label={`${x.name} 삭제`}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteItem(x);
                    }}
                  >
                    <Icon id="i-trash" />
                  </button>
                  <img className="cloth-img" src={x.img} alt={x.name} loading="lazy" />
                </div>
                <div className="cloth-body">
                  <div className="cloth-title">
                    <b>{x.name}</b>
                    <button
                      aria-label={fav ? "즐겨찾기 해제" : "즐겨찾기"}
                      aria-pressed={fav}
                      className={fav ? "faved" : ""}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(x.id);
                        toast(fav ? "즐겨찾기에서 뺐어요" : "즐겨찾기에 담았어요");
                      }}
                    >
                      {fav ? "♥" : "♡"}
                    </button>
                  </div>
                  <p>{x.cat}</p>
                  <div className="cloth-stats">
                    <span>
                      착용<b>{x.wear}</b>
                    </span>
                    <span>
                      회당 비용<b>{x.cpw}</b>
                    </span>
                    <span>
                      마지막<b>{x.daysAgo === 0 ? "오늘" : `${x.daysAgo}일 전`}</b>
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div
        className={"modal-back" + (modalOpen ? " show" : "")}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeModal();
        }}
      >
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="addItemTitle"
          ref={modalRef}
          onKeyDown={trapTab}
        >
          <h2 id="addItemTitle">새 옷 등록</h2>
          <p>사진을 첨부하거나 없이도 등록할 수 있어요. 저장 후 AI 태그를 추가할 수 있어요.</p>
          <div
            className={"modal-photo" + (newPhoto ? " has" : "")}
            role="button"
            tabIndex={0}
            aria-label="사진 첨부"
            onClick={() => newFileRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                newFileRef.current?.click();
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleNewPhoto(e.dataTransfer.files?.[0]);
            }}
          >
            <input
              ref={newFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleNewPhoto(e.target.files?.[0])}
            />
            {newPhoto ? (
              <>
                <img src={newPhoto} alt="첨부한 사진" />
                <span className="modal-photo-label">사진 변경</span>
              </>
            ) : (
              <>
                <Icon id="i-upload" />
                <span className="modal-photo-label">사진 첨부 (선택) · 클릭 또는 드래그</span>
              </>
            )}
          </div>
          <div className="modal-form">
            <div className="field">
              <label htmlFor="newName">옷 이름</label>
              <input
                id="newName"
                ref={firstFieldRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="newCategory">카테고리</label>
              <select
                id="newCategory"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option>상의</option>
                <option>하의</option>
                <option>아우터</option>
                <option>신발</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="newLocation">위치</label>
              <select
                id="newLocation"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option>옷장 1</option>
                <option>옷장 2</option>
                <option>계절 보관함</option>
                <option>신발장</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="newPrice">구매 가격</label>
              <input id="newPrice" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={closeModal}>
              취소
            </button>
            <button className="btn primary" onClick={addItem}>
              옷장에 추가
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
