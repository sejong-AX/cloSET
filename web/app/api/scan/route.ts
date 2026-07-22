import { proxyToRust } from "@/lib/proxy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return proxyToRust("/api/scan", await req.text());
}
