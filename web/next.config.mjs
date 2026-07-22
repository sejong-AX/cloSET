// 백엔드(판정+GPT-4o)는 Rust 로 분리 배포됨. 프론트는 same-origin /api/* 를
// Rust API 로 프록시(rewrite)해 CORS 없이 호출한다. 로컬은 RUST_API_URL 로 오버라이드.
const RUST_API = process.env.RUST_API_URL || "https://closet-api-rs.vercel.app";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  async rewrites() {
    return [
      { source: "/api/scan", destination: `${RUST_API}/api/scan` },
      { source: "/api/care", destination: `${RUST_API}/api/care` },
    ];
  },
};

export default nextConfig;
