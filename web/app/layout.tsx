import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sprite } from "@/components/Sprite";

export const metadata: Metadata = {
  title: "cloSET — 옷의 전 주기를 함께하는 AI 디지털 옷장",
  description:
    "옷을 등록·관리·절제·순환으로 이어지는 상태 기반 자산으로 관리하는 AI 디지털 옷장. 오늘의 착장, Care Label AI, Smart Checker(Snap & Check), Re:Using.",
  applicationName: "cloSET",
  authors: [{ name: "세종AX" }],
  openGraph: {
    title: "cloSET — AI 디지털 옷장",
    description: "덜 사고, 덜 버리고, 더 오래 입게 하는 AI 디지털 옷장",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1f6a58",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body>
        <Sprite />
        {children}
      </body>
    </html>
  );
}
