import OpenAI from "openai";

export function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey, timeout: 15000, maxRetries: 1 });
}

export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
