//! GPT-4o 호출 + 결정적 폴백 (web/app/api/*/route.ts 의 Rust 포팅).
//! 판정 수치는 rules 가 정하고, 여기서는 "이유 문장"만 생성한다. 키/네트워크 실패 시 폴백.

use crate::rules::{comma, CareFacts, ScanFacts, Verdict};
use serde_json::{json, Value};
use std::time::Duration;

pub type Reason = (String, String); // (title, sub)
pub type ScanCopy = (String, Vec<Reason>, String); // (headline, reasons, alt)

pub fn model_name() -> String {
    std::env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-4o".to_string())
}

fn api_key() -> Option<String> {
    match std::env::var("OPENAI_API_KEY") {
        Ok(k) if !k.trim().is_empty() => Some(k),
        _ => None,
    }
}

/// 결정적 폴백 — OpenAI 가 없거나 실패해도 올바른 판정 문구를 반환한다.
pub fn fallback_copy(f: &ScanFacts) -> ScanCopy {
    let top = &f.similar[0];
    match f.verdict {
        Verdict::Stop => (
            "잠깐, 비슷한 옷이 있어요.".to_string(),
            vec![
                (
                    format!("{} 계열이 이미 {}벌 있어요.", top.name, f.owned_count),
                    format!("시각 유사도 {}% · 같은 카테고리와 실루엣", top.similarity),
                ),
                (
                    format!("비슷한 스타일은 평균 {}회만 입었어요.", f.avg_wears_similar),
                    "최근 구매 3건의 확정 착용 로그 기준".to_string(),
                ),
                (
                    format!("예상 회당 비용이 {}원이에요.", comma(f.expected_cpw)),
                    format!("예상 착용 {}회 기준이며 추정치예요.", f.expected_wears),
                ),
            ],
            format!("{} + 크림 와이드 팬츠를 입으면 촬영한 룩과 93% 비슷해요.", top.name),
        ),
        Verdict::Alternative => (
            "비슷하게 대체할 수 있어요.".to_string(),
            vec![
                (
                    format!("{}로 비슷한 무드를 낼 수 있어요.", top.name),
                    format!("시각 유사도 {}% · 옷장 보유 아이템", top.similarity),
                ),
                (
                    format!("이 카테고리는 평균 {}회 착용했어요.", f.avg_wears_similar),
                    "확정 착용 로그 기준으로 활용 여지가 남아 있어요.".to_string(),
                ),
                (
                    format!("새로 사면 예상 회당 비용은 {}원이에요.", comma(f.expected_cpw)),
                    format!("예상 착용 {}회 기준 추정치예요.", f.expected_wears),
                ),
            ],
            format!("{} + 차콜 슬랙스 조합으로 먼저 시도해 보는 걸 추천해요.", top.name),
        ),
        Verdict::Buy => (
            "지금은 사도 괜찮아요.".to_string(),
            vec![
                (
                    "옷장에 겹치는 아이템이 거의 없어요.".to_string(),
                    format!("가장 비슷한 옷도 유사도 {}%로 낮아요.", top.similarity),
                ),
                (
                    format!("예상 회당 비용이 {}원으로 합리적이에요.", comma(f.expected_cpw)),
                    format!("예상 착용 {}회 기준 추정치예요.", f.expected_wears),
                ),
                (
                    "실제 옷장 공백을 채우는 선택이에요.".to_string(),
                    "중복 위험이 낮아 활용도가 높을 가능성이 커요.".to_string(),
                ),
            ],
            format!("구매 후 {}와 번갈아 입으면 회당 비용을 더 낮출 수 있어요.", top.name),
        ),
    }
}

fn facts_json(f: &ScanFacts) -> Value {
    json!({
        "category": f.category,
        "family": f.family.as_str(),
        "verdict": f.verdict.as_str(),
        "duplicationRisk": f.duplication_risk,
        "ruleVersion": f.rule_version,
        "similar": f.similar.iter().map(|s| json!({"name": s.name, "color": s.color, "similarity": s.similarity})).collect::<Vec<_>>(),
        "expectedWears": f.expected_wears,
        "expectedCpw": f.expected_cpw,
        "avgWearsSimilar": f.avg_wears_similar,
        "ownedCount": f.owned_count,
    })
}

async fn chat_json(system: &str, user: &str, temperature: f32) -> Option<Value> {
    let key = api_key()?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .ok()?;
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(&key)
        .json(&json!({
            "model": model_name(),
            "temperature": temperature,
            "response_format": { "type": "json_object" },
            "messages": [
                { "role": "system", "content": system },
                { "role": "user", "content": user }
            ]
        }))
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let data: Value = resp.json().await.ok()?;
    let content = data["choices"][0]["message"]["content"].as_str()?;
    serde_json::from_str::<Value>(content).ok()
}

/// scan 이유 문장 생성. 실패 시 None → 호출부에서 fallback.
pub async fn scan_llm_copy(f: &ScanFacts) -> Option<ScanCopy> {
    let system = concat!(
        "너는 cloSET의 카피라이터다. cloSET은 '덜 사고 덜 버리고 더 오래 입게' 돕는 AI 디지털 옷장이다.\n",
        "말투는 따뜻하고 담백한 한국어 존댓말. 과장·이모지·느낌표 남발 금지.\n",
        "핵심 규칙: 판정(verdict), 중복 위험(duplicationRisk), 회당 비용(expectedCpw), 유사도(similarity)는 이미 코드가 계산한 확정 수치다.\n",
        "너는 이 수치를 절대 바꾸지 말고, 주어진 값만 사용해 이유를 자연스럽게 설명한다. 새로운 수치를 지어내지 않는다.\n",
        "반드시 아래 JSON 스키마로만 답한다: {\"headline\": string, \"reasons\": [{\"title\": string, \"sub\": string}] (정확히 3개), \"alt\": string}"
    );
    let user = format!(
        "다음 확정 사실로 구매 점검 결과 문구를 작성해줘.\n{}",
        serde_json::to_string_pretty(&facts_json(f)).ok()?
    );
    let parsed = chat_json(system, &user, 0.6).await?;
    let headline = parsed["headline"].as_str()?.to_string();
    let reasons_v = parsed["reasons"].as_array()?;
    if reasons_v.is_empty() {
        return None;
    }
    let mut reasons: Vec<Reason> = Vec::new();
    for r in reasons_v {
        let t = r["title"].as_str()?;
        let s = r["sub"].as_str()?;
        reasons.push((t.to_string(), s.to_string()));
    }
    let alt = parsed["alt"].as_str()?.to_string();
    Some((headline, reasons, alt))
}

/// care 가이드 본문 생성. 실패 시 None → base_guide.
pub async fn care_llm_guide(f: &CareFacts) -> Option<String> {
    let system = concat!(
        "너는 cloSET의 Care Label AI 어시스턴트다. 소재에 맞는 세탁·관리법을 알려준다.\n",
        "따뜻하고 담백한 한국어 존댓말로, 2~3문장, 90자 내외로 실용적인 관리 팁을 쓴다.\n",
        "온도·건조·세탁 방식은 주어진 사실과 어긋나지 않게 쓴다. 이모지·과장 금지.\n",
        "반드시 JSON 으로만 답한다: {\"body\": string}"
    );
    let user = format!(
        "다음 소재 정보로 케어 가이드 본문을 써줘.\n{}",
        serde_json::to_string_pretty(&json!({
            "material": f.material,
            "family": f.family.as_str(),
            "tempC": f.temp_c
        }))
        .ok()?
    );
    let parsed = chat_json(system, &user, 0.5).await?;
    let body = parsed["body"].as_str()?.trim().to_string();
    if body.is_empty() {
        None
    } else {
        Some(body)
    }
}
