// 백엔드(판정+GPT-4o)는 Rust 로 분리 배포됨. 프론트는 same-origin /api/* 를
// Route Handler(app/api/*/route.ts)로 프록시하며 공유 시크릿 헤더를 주입해
// 백엔드 직접 남용을 차단한다(rewrite 는 헤더 주입이 불가해 대체). 로컬은 RUST_API_URL 로 오버라이드.

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
