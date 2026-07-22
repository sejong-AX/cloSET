import gsap from "gsap";

export function prefersReduced(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// 숫자 카운트업 — 접두/접미(₩, %, kg, 벌 등)와 천단위 콤마를 보존한다.
export function countUp(el: Element) {
  const finalText = (el.textContent ?? "").trim();
  const m = finalText.match(/^(\D*)([\d,]+(?:\.\d+)?)(.*)$/);
  if (!m) return;
  const prefix = m[1];
  const numStr = m[2];
  const suffix = m[3];
  const hasComma = numStr.includes(",");
  const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
  const target = parseFloat(numStr.replace(/,/g, ""));
  if (!isFinite(target)) return;
  const obj = { v: 0 };
  gsap.to(obj, {
    v: target,
    duration: 1.05,
    ease: "power2.out",
    onUpdate() {
      let s = decimals ? obj.v.toFixed(decimals) : String(Math.round(obj.v));
      if (hasComma) {
        const parts = s.split(".");
        parts[0] = Number(parts[0]).toLocaleString("en-US");
        s = parts.join(".");
      }
      el.textContent = prefix + s + suffix;
    },
    onComplete() {
      el.textContent = finalText;
    },
  });
}

// 스파크라인 path 를 그려 넣는 애니메이션
export function drawSparks(scope: Element) {
  scope
    .querySelectorAll<SVGPathElement>(".spark svg path")
    .forEach((p) => {
      const len = p.getTotalLength();
      gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
      gsap.to(p, {
        strokeDashoffset: 0,
        duration: 1.2,
        ease: "power2.out",
      });
    });
}

// 뷰가 활성화될 때의 진입 애니메이션(카드 stagger + 특수 요소).
// StrictMode 이중 호출에도 안전하도록 fromTo 로 도착 상태를 명시한다.
export function playViewEntrance(viewEl: HTMLElement, reduced: boolean) {
  if (reduced) return undefined;
  const ctx = gsap.context(() => {
    const head = viewEl.querySelector(".page-head");
    if (head)
      gsap.fromTo(
        head,
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, ease: "power3.out" }
      );

    const rack = viewEl.querySelectorAll(".hero-outfit .rack .rack-item");
    if (rack.length) {
      gsap.fromTo(
        rack,
        { y: 26, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.09, duration: 0.5, ease: "back.out(1.5)", delay: 0.1 }
      );
    }

    const cards = viewEl.querySelectorAll(
      ":scope > .grid > .card, :scope > .grid > .side-stack > .card, :scope > .metrics > .card, :scope > .route-grid > .card, :scope > .card, :scope > .stat-chips"
    );
    if (cards.length) {
      gsap.fromTo(
        cards,
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.06, duration: 0.45, ease: "power3.out", delay: 0.05 }
      );
    }

    const bars = viewEl.querySelectorAll<HTMLElement>(".bar");
    if (bars.length) {
      bars.forEach((b) => {
        const h = b.style.height;
        gsap.fromTo(
          b,
          { height: 0 },
          { height: h, duration: 0.8, ease: "power2.out", delay: 0.15 }
        );
      });
    }

    viewEl
      .querySelectorAll(".metric strong, .donut-label strong")
      .forEach((el) => countUp(el));
    drawSparks(viewEl);
  }, viewEl);
  return ctx;
}
