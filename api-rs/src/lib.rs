//! cloSET Rust 백엔드 코어.
//! scan/care 응답 조립을 호스트(axum 서버 / Vercel 함수)와 무관하게 제공한다.

pub mod openai;
pub mod rules;

use serde_json::{json, Value};

/// 사용자 입력 길이 상한(프롬프트 인젝션·남용 완화)
fn cap(s: &str, max: usize) -> String {
    s.chars().take(max).collect()
}

/// POST /api/scan 응답. payload: { category?: string, price?: string|number }
pub async fn scan_response(payload: &Value) -> Value {
    let category = cap(
        payload
            .get("category")
            .and_then(|v| v.as_str())
            .unwrap_or("니트 · 상의"),
        60,
    );
    let price = cap(
        &match payload.get("price") {
            Some(Value::String(s)) => s.clone(),
            Some(Value::Number(n)) => n.to_string(),
            _ => "79,000원".to_string(),
        },
        20,
    );
    let facts = rules::evaluate_scan(&category, &price);
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
    let material = cap(
        payload
            .get("material")
            .and_then(|v| v.as_str())
            .unwrap_or("네이비 울 니트"),
        60,
    );
    let facts = rules::evaluate_care(&material);
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

/// POST /api/style 응답. payload: { image?: data-url, bodyType?: string, season?: string }
/// 사진이 있으면 GPT-4o 비전으로 체형 맞춤 추천, 없거나 실패 시 체형별 결정적 폴백.
pub async fn style_response(payload: &Value) -> Value {
    let body_type = cap(
        payload
            .get("bodyType")
            .and_then(|v| v.as_str())
            .unwrap_or("Straight"),
        24,
    );
    let season = cap(
        payload
            .get("season")
            .and_then(|v| v.as_str())
            .unwrap_or("여름 쿨"),
        24,
    );
    if let Some(img) = payload.get("image").and_then(|v| v.as_str()) {
        if img.starts_with("data:image") && img.len() < 6_000_000 {
            if let Some(v) = openai::style_recommend(img, &body_type, &season).await {
                let mut out = v;
                out["source"] = json!("openai");
                out["model"] = json!(openai::model_name());
                return out;
            }
        }
    }
    openai::style_fallback(&body_type)
}

/// POST /api/wardrobe 응답. payload: { image?: data-url }
/// 사진(옷장·갤러리) 속 의류 아이템을 GPT-4o 비전으로 식별, 실패 시 편집용 초안 1점.
pub async fn wardrobe_response(payload: &Value) -> Value {
    if let Some(img) = payload.get("image").and_then(|v| v.as_str()) {
        if img.starts_with("data:image") && img.len() < 8_000_000 {
            if let Some(v) = openai::wardrobe_detect(img).await {
                let mut out = v;
                out["source"] = json!("openai");
                out["model"] = json!(openai::model_name());
                return out;
            }
        }
    }
    openai::wardrobe_fallback()
}
