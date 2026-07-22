import { NextResponse } from "next/server";
import { evaluateScan, type ScanFacts } from "@/lib/rules";
import { getOpenAI, OPENAI_MODEL } from "@/lib/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ScanCopy {
  headline: string;
  reasons: { title: string; sub: string }[];
  alt: string;
}

const won = (n: number) => "₩" + n.toLocaleString("en-US");

// 결정적 폴백 — OpenAI 가 없거나 실패해도 UI 는 올바른 판정 문구를 보여준다.
function fallbackCopy(f: ScanFacts): ScanCopy {
  const top = f.similar[0];
  if (f.verdict === "STOP") {
    return {
      headline: "잠깐, 비슷한 옷이 있어요.",
      reasons: [
        {
          title: `${top.name} 계열이 이미 ${f.ownedCount}벌 있어요.`,
          sub: `시각 유사도 ${top.similarity}% · 같은 카테고리와 실루엣`,
        },
        {
          title: `비슷한 스타일은 평균 ${f.avgWearsSimilar}회만 입었어요.`,
          sub: "최근 구매 3건의 확정 착용 로그 기준",
        },
        {
          title: `예상 회당 비용이 ${f.expectedCpw.toLocaleString("en-US")}원이에요.`,
          sub: `예상 착용 ${f.expectedWears}회 기준이며 추정치예요.`,
        },
      ],
      alt: `${top.name} + 크림 와이드 팬츠를 입으면 촬영한 룩과 93% 비슷해요.`,
    };
  }
  if (f.verdict === "ALTERNATIVE") {
    return {
      headline: "비슷하게 대체할 수 있어요.",
      reasons: [
        {
          title: `${top.name}로 비슷한 무드를 낼 수 있어요.`,
          sub: `시각 유사도 ${top.similarity}% · 옷장 보유 아이템`,
        },
        {
          title: `이 카테고리는 평균 ${f.avgWearsSimilar}회 착용했어요.`,
          sub: "확정 착용 로그 기준으로 활용 여지가 남아 있어요.",
        },
        {
          title: `새로 사면 예상 회당 비용은 ${f.expectedCpw.toLocaleString("en-US")}원이에요.`,
          sub: `예상 착용 ${f.expectedWears}회 기준 추정치예요.`,
        },
      ],
      alt: `${top.name} + 차콜 슬랙스 조합으로 먼저 시도해 보는 걸 추천해요.`,
    };
  }
  return {
    headline: "지금은 사도 괜찮아요.",
    reasons: [
      {
        title: `옷장에 겹치는 아이템이 거의 없어요.`,
        sub: `가장 비슷한 옷도 유사도 ${top.similarity}%로 낮아요.`,
      },
      {
        title: `예상 회당 비용이 ${f.expectedCpw.toLocaleString("en-US")}원으로 합리적이에요.`,
        sub: `예상 착용 ${f.expectedWears}회 기준 추정치예요.`,
      },
      {
        title: `실제 옷장 공백을 채우는 선택이에요.`,
        sub: "중복 위험이 낮아 활용도가 높을 가능성이 커요.",
      },
    ],
    alt: `구매 후 ${top.name}와 번갈아 입으면 회당 비용을 더 낮출 수 있어요.`,
  };
}

function validCopy(x: unknown): x is ScanCopy {
  if (!x || typeof x !== "object") return false;
  const c = x as ScanCopy;
  return (
    typeof c.headline === "string" &&
    Array.isArray(c.reasons) &&
    c.reasons.length >= 1 &&
    c.reasons.every((r) => r && typeof r.title === "string" && typeof r.sub === "string") &&
    typeof c.alt === "string"
  );
}

async function llmCopy(f: ScanFacts): Promise<ScanCopy | null> {
  const client = getOpenAI();
  if (!client) return null;
  try {
    const system = [
      "너는 cloSET의 카피라이터다. cloSET은 '덜 사고 덜 버리고 더 오래 입게' 돕는 AI 디지털 옷장이다.",
      "말투는 따뜻하고 담백한 한국어 존댓말. 과장·이모지·느낌표 남발 금지.",
      "핵심 규칙: 판정(verdict), 중복 위험(duplicationRisk), 회당 비용(expectedCpw), 유사도(similarity)는 이미 코드가 계산한 확정 수치다.",
      "너는 이 수치를 절대 바꾸지 말고, 주어진 값만 사용해 이유를 자연스럽게 설명한다. 새로운 수치를 지어내지 않는다.",
      '반드시 아래 JSON 스키마로만 답한다: {"headline": string, "reasons": [{"title": string, "sub": string}] (정확히 3개), "alt": string}',
    ].join("\n");
    const user =
      "다음 확정 사실로 구매 점검 결과 문구를 작성해줘.\n" + JSON.stringify(f, null, 2);
    const res = await client.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const raw = res.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return validCopy(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: { category?: string; price?: string | number } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body ok */
  }
  const facts = evaluateScan(body.category ?? "니트 · 상의", body.price ?? "79,000원");
  const llm = await llmCopy(facts);
  const copy = llm ?? fallbackCopy(facts);
  return NextResponse.json({
    verdict: facts.verdict,
    duplicationRisk: facts.duplicationRisk,
    ruleVersion: facts.ruleVersion,
    expectedCpw: facts.expectedCpw,
    expectedWears: facts.expectedWears,
    similar: facts.similar,
    headline: copy.headline,
    reasons: copy.reasons,
    alt: copy.alt,
    source: llm ? "openai" : "fallback",
    model: llm ? OPENAI_MODEL : null,
  });
}
