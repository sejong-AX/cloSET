import { NextResponse } from "next/server";
import { evaluateCare, type CareFacts } from "@/lib/rules";
import { getOpenAI, OPENAI_MODEL } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function llmGuide(f: CareFacts): Promise<string | null> {
  const client = getOpenAI();
  if (!client) return null;
  try {
    const system = [
      "너는 cloSET의 Care Label AI 어시스턴트다. 소재에 맞는 세탁·관리법을 알려준다.",
      "따뜻하고 담백한 한국어 존댓말로, 2~3문장, 90자 내외로 실용적인 관리 팁을 쓴다.",
      "온도·건조·세탁 방식은 주어진 사실과 어긋나지 않게 쓴다. 이모지·과장 금지.",
      '반드시 JSON 으로만 답한다: {"body": string}',
    ].join("\n");
    const user =
      "다음 소재 정보로 케어 가이드 본문을 써줘.\n" +
      JSON.stringify({ material: f.material, family: f.family, tempC: f.tempC }, null, 2);
    const res = await client.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = res.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { body?: unknown };
    return typeof parsed.body === "string" && parsed.body.trim().length > 0
      ? parsed.body.trim()
      : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: { material?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body ok */
  }
  const facts = evaluateCare(body.material ?? "네이비 울 니트");
  const guide = await llmGuide(facts);
  return NextResponse.json({
    title: facts.title,
    tempC: facts.tempC,
    symbols: facts.symbols,
    body: guide ?? facts.baseGuide,
    source: guide ? "openai" : "fallback",
    model: guide ? OPENAI_MODEL : null,
  });
}
