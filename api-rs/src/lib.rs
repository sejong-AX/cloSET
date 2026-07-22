//! cloSET Rust 백엔드 코어.
//! scan/care 응답 조립을 호스트(axum 서버 / Vercel 함수)와 무관하게 제공한다.

pub mod openai;
pub mod rules;

use serde_json::{json, Value};

/// POST /api/scan 응답. payload: { category?: string, price?: string|number }
pub async fn scan_response(payload: &Value) -> Value {
    let category = payload
        .get("category")
        .and_then(|v| v.as_str())
        .unwrap_or("니트 · 상의");
    let price = match payload.get("price") {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Number(n)) => n.to_string(),
        _ => "79,000원".to_string(),
    };
    let facts = rules::evaluate_scan(category, &price);
    let llm = openai::scan_llm_copy(&facts).await;
    let (headline, reasons, alt, source, model) = match llm {
        Some((h, r, a)) => (h, r, a, "openai", Some(openai::model_name())),
        None => {
            let (h, r, a) = openai::fallback_copy(&facts);
            (h, r, a, "fallback", None)
        }
    };
    json!({
        "verdict": facts.verdict.as_str(),
        "duplicationRisk": facts.duplication_risk,
        "ruleVersion": facts.rule_version,
        "expectedCpw": facts.expected_cpw,
        "expectedWears": facts.expected_wears,
        "similar": facts.similar.iter().map(|s| json!({"name": s.name, "color": s.color, "similarity": s.similarity})).collect::<Vec<_>>(),
        "headline": headline,
        "reasons": reasons.iter().map(|(t, s)| json!({"title": t, "sub": s})).collect::<Vec<_>>(),
        "alt": alt,
        "source": source,
        "model": model,
    })
}

/// POST /api/care 응답. payload: { material?: string }
pub async fn care_response(payload: &Value) -> Value {
    let material = payload
        .get("material")
        .and_then(|v| v.as_str())
        .unwrap_or("네이비 울 니트");
    let facts = rules::evaluate_care(material);
    let guide = openai::care_llm_guide(&facts).await;
    let (body, source, model) = match guide {
        Some(b) => (b, "openai", Some(openai::model_name())),
        None => (facts.base_guide.to_string(), "fallback", None),
    };
    json!({
        "title": facts.title,
        "tempC": facts.temp_c,
        "symbols": facts.symbols,
        "body": body,
        "source": source,
        "model": model,
    })
}
