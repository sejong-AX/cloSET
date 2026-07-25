import { handleProxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 비전+문구 생성이 이어질 수 있어 플랫폼 기본(10s)보다 여유 있게

// 옷장 일괄 등록은 한 번에 최대 20장 + '사진 더 넣기'를 감안해 여유 있게
export async function POST(req: Request) {
  return handleProxy(req, "/api/wardrobe", 60);
}
