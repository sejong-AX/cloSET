import { handleProxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 비전+문구 생성이 이어질 수 있어 플랫폼 기본(10s)보다 여유 있게

export async function POST(req: Request) {
  return handleProxy(req, "/api/style", 30);
}
