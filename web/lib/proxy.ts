// 프론트(same-origin) /api/* 요청을 Rust 백엔드로 프록시하면서 공유 시크릿 헤더를 주입한다.
// 이 헤더가 있어야 Rust 가 유료 GPT-4o 를 호출하므로, 백엔드를 직접 때리는 남용은 값싼 폴백만 받는다.
const RUST_API = process.env.RUST_API_URL || "https://closet-api-rs.vercel.app";

export async function proxyToRust(path: string, body: string): Promise<Response> {
  try {
    const upstream = await fetch(`${RUST_API}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-closet-proxy": process.env.CLOSET_PROXY_SECRET ?? "",
      },
      body,
      cache: "no-store",
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // 백엔드 도달 실패 — 클라이언트가 폴백/에러 처리를 하도록 502 반환
    return new Response(JSON.stringify({ error: "upstream_unreachable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
