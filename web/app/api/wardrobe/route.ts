import { handleProxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

// 옷장 일괄 등록은 한 번에 최대 20장 + '사진 더 넣기'를 감안해 여유 있게
export async function POST(req: Request) {
  return handleProxy(req, "/api/wardrobe", 60);
}
