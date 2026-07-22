"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "../app-context";
import { Icon } from "../Sprite";
import type { ClothState } from "@/lib/data";

const FILTER_DEFS: { key: string; name: string }[] = [
  { key: "all", name: "전체" },
  { key: "available", name: "입을 수 있음" },
  { key: "laundry", name: "세탁" },
  { key: "stored", name: "보관" },
  { key: "reuse", name: "순환 후보" },
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

export function ClosetView() {
  const { toast, closetQuery, setClosetQuery, items, addClothing, removeClothing } = useApp();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("오프화이트 셔츠");
  const [category, setCategory] = useState("상의");
  const [location, setLocation] = useState("옷장 1");
  const [price, setPrice] = useState("59,000원");

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
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  // 칩 라벨 수치를 실제 데이터에서 계산(하드코딩 24/17… 불일치 제거)
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const f of FILTER_DEFS) {
      if (f.key !== "all") c[f.key] = items.filter((x) => x.state === f.key).length;
    }
    return c;
  }, [items]);

  const list = useMemo(() => {
    let out = filter === "all" ? items : items.filter((x) => x.state === filter);
    if (search) out = out.filter((x) => (x.name + x.cat).includes(search));
    return out;
  }, [items, filter, search]);

  const addItem = () => {
    const name = newName.trim() || "새 옷";
    const meta = CATEGORY_META[category] ?? CATEGORY_META["상의"];
    const won = parsePrice(price);
    addClothing({
      name,
      cat: `${category} · ${location}`,
      state: "available" as ClothState,
      label: "입을 수 있음",
      bg: meta.bg,
      type: meta.type,
      color: meta.color,
      wear: "0회",
      cpw: `₩${won.toLocaleString("en-US")}`,
      img: meta.img,
    });
    setModalOpen(false);
    setFilter("all");
    setSearch("");
    toast(`'${name}'을(를) 옷장에 추가했어요`);
  };

  const deleteItem = (id: string, name: string) => {
    removeClothing(id);
    toast(`'${name}'을(를) 옷장에서 삭제했어요`);
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
            placeholder="브랜드, 색상, 소재로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button className="btn" onClick={() => toast("최근 착용순으로 정렬했어요")}>
          최근 착용순
        </button>
        <button className="btn" onClick={() => toast("필터 패널을 열었어요")}>
          필터
        </button>
      </div>
      <div className="closet-grid" id="closetGrid">
        {list.map((x, i) => (
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
                  deleteItem(x.id, x.name);
                }}
              >
                <Icon id="i-trash" />
              </button>
              <img className="cloth-img" src={x.img} alt={x.name} loading="lazy" />
            </div>
            <div className="cloth-body">
              <div className="cloth-title">
                <b>{x.name}</b>
                <button aria-label="즐겨찾기" onClick={(e) => e.stopPropagation()}>
                  {i % 3 === 0 ? "♥" : "♡"}
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
                  마지막<b>{i + 2}일 전</b>
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div
        className={"modal-back" + (modalOpen ? " show" : "")}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModalOpen(false);
        }}
      >
        <div className="modal">
          <h2>새 옷 등록</h2>
          <p>사진 없이도 등록할 수 있어요. 저장 후 AI 태그를 추가할 수 있어요.</p>
          <div className="modal-form">
            <div className="field">
              <label>옷 이름</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="field">
              <label>카테고리</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>상의</option>
                <option>하의</option>
                <option>아우터</option>
                <option>신발</option>
              </select>
            </div>
            <div className="field">
              <label>위치</label>
              <select value={location} onChange={(e) => setLocation(e.target.value)}>
                <option>옷장 1</option>
                <option>옷장 2</option>
                <option>계절 보관함</option>
                <option>신발장</option>
              </select>
            </div>
            <div className="field">
              <label>구매 가격</label>
              <input value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setModalOpen(false)}>
              취소
            </button>
            <button className="btn primary" onClick={addItem}>
              Available로 등록
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
