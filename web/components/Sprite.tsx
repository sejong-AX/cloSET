// SVG 심볼 스프라이트 — mockup 의 <defs> 와 동일. 문서에 1회만 렌더한다.
export function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <symbol id="i-home" viewBox="0 0 24 24">
          <path d="M3 10.8 12 3l9 7.8v9.1a1.1 1.1 0 0 1-1.1 1.1H4.1A1.1 1.1 0 0 1 3 19.9z" fill="none" stroke="currentColor" />
          <path d="M9 21v-7h6v7" fill="none" stroke="currentColor" />
        </symbol>
        <symbol id="i-closet" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" />
          <path d="M12 3v18M9 11h.01M15 11h.01" stroke="currentColor" strokeLinecap="round" />
        </symbol>
        <symbol id="i-scan" viewBox="0 0 24 24">
          <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" fill="none" stroke="currentColor" />
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" />
        </symbol>
        <symbol id="i-care" viewBox="0 0 24 24">
          <path d="M4 7h16l-2 13H6zM8 7V4h8v3" fill="none" stroke="currentColor" />
          <path d="M8 12c2 2 6 2 8 0" fill="none" stroke="currentColor" />
        </symbol>
        <symbol id="i-reuse" viewBox="0 0 24 24">
          <path d="M7 7h10v10H7z" fill="none" stroke="currentColor" />
          <path d="m9 3-3 4 3 4M15 21l3-4-3-4" fill="none" stroke="currentColor" />
        </symbol>
        <symbol id="i-chart" viewBox="0 0 24 24">
          <path d="M4 20V9M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" />
        </symbol>
        <symbol id="i-set" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" />
          <path d="M19 13.5v-3l-2-.7-.6-1.4.9-2-2.1-2.1-2 .9-1.4-.6-.7-2h-3l-.7 2-1.4.6-2-.9-2.1 2.1.9 2-.6 1.4-2 .7v3l2 .7.6 1.4-.9 2 2.1 2.1 2-.9 1.4.6.7 2h3l.7-2 1.4-.6 2 .9 2.1-2.1-.9-2 .6-1.4z" fill="none" stroke="currentColor" />
        </symbol>
        <symbol id="i-search" viewBox="0 0 24 24">
          <circle cx="10.8" cy="10.8" r="6.8" fill="none" stroke="currentColor" />
          <path d="m16 16 5 5" stroke="currentColor" />
        </symbol>
        <symbol id="i-bell" viewBox="0 0 24 24">
          <path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 20h4" fill="none" stroke="currentColor" />
        </symbol>
        <symbol id="i-plus" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" stroke="currentColor" />
        </symbol>
        <symbol id="i-upload" viewBox="0 0 24 24">
          <path d="m12 16V4m0 0L7 9m5-5 5 5M5 15v4h14v-4" fill="none" stroke="currentColor" />
        </symbol>
      </defs>
    </svg>
  );
}

export function Icon({ id }: { id: string }) {
  return (
    <svg>
      <use href={`#${id}`} />
    </svg>
  );
}
