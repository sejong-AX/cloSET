import { handleProxy } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleProxy(req, "/api/scan", 120);
}
