// 프로세스 인메모리 고정창(fixed-window) 레이트리밋 — 베스트에포트 방어심층.
// 분산 저장이 아니므로 "warm 인스턴스 단위"로만 동작한다: 단일 출처의 순진한 flood를
// 상당 부분 억제하지만, 여러 인스턴스로 분산되면 완전히 막지는 못한다.
// 완전한 분산 제한은 KV/upstash(외부 리소스) 필요 — 프록시 공유 시크릿과 함께 계층 방어로 쓴다.

type Bucket = { count: number; reset: number };
const store = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of store) if (now >= b.reset) store.delete(k);
}

export interface RateResult {
  ok: boolean;
  retryAfter: number; // seconds
}

/** key(경로+IP) 기준 windowMs 동안 limit 회 허용. 초과 시 ok=false. */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  sweep(now);
  const b = store.get(key);
  if (!b || now >= b.reset) {
    store.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((b.reset - now) / 1000)) };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}

/** Vercel/프록시가 세팅한 헤더에서 클라이언트 IP 추출 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
