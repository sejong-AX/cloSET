//! cloSET Rust 백엔드 코어.
//! scan/care 응답 조립을 호스트(axum 서버 / Vercel 함수)와 무관하게 제공한다.

pub mod openai;
pub mod rules;

use serde_json::{json, Value};

/// 사용자 입력 길이 상한(프롬프트 인젝션·남용 완화)
fn cap(s: &str, max: usize) -> String {
    s.chars().take(max).collect()
}

/// 프록시 공유 시크릿 검증. 프론트 Route Handler 가 주입하는 x-closet-proxy 헤더가
/// 서버 env(CLOSET_PROXY_SECRET)와 일치할 때만 유료 GPT-4o 호출을 허용한다.
/// env 미설정이면 검사를 끈다(로컬/개발). 미인증 요청은 결정적 폴백만 받는다 → 비용/DoS 상한.
pub fn proxy_authorized(provided: Option<&str>) -> bool {
    match std::env::var("CLOSET_PROXY_SECRET") {
        Ok(secret) if !secret.trim().is_empty() => provided == Some(secret.as_str()),
        _ => true,
    }
}

/// Vercel/서버리스 요청 본문 상한(base64 data URL + JSON). Vercel 본문 한도(~4.5MB) 이내로 정렬.
const MAX_IMAGE_BYTES: usize = 4_000_000;

/// 클라이언트가 보낸 내 옷장 요약을 파싱한다(상한·필드 검증 포함).
fn parse_wardrobe(payload: &Value) -> Vec<rules::WardrobeRef> {
    let Some(arr) = payload.get("wardrobe").and_then(|v| v.as_array()) else {
        return Vec::new();
    };
    arr.iter()
        .take(48)
        .map(|it| {
            let color_raw = it.get("color").and_then(|v| v.as_str()).unwrap_or("");
            rules::WardrobeRef {
                name: cap(it.get("name").and_then(|v| v.as_str()).unwrap_or("이름 없는 옷"), 40),
                type_key: cap(it.get("type").and_then(|v| v.as_str()).unwrap_or(""), 12),
                color: if color_raw.starts_with('#') && color_raw.len() <= 9 {
                    color_raw.to_string()
                } else {
                    String::new()
                },
                wear: it
                    .get("wear")
                    .map(|v| match v {
                        Value::Number(n) => n.as_u64().unwrap_or(0) as u32,
                        Value::String(s) => s.chars().filter(|c| c.is_ascii_digit()).collect::<String>().parse().unwrap_or(0),
                        _ => 0,
                    })
                    .unwrap_or(0),
            }
        })
        .collect()
}

/// POST /api/scan 응답.
/// payload: { category?, price?, image?: data-url, wardrobe?: [{name,type,color,wear}] }
/// 사진이 있으면 비전으로 상품(이름·카테고리·대표색)을 식별하고, 실옷장 목록으로 결정적 판정한다.
pub async fn scan_response(payload: &Value, authorized: bool) -> Value {
    let category_in = cap(
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
    let wardrobe = parse_wardrobe(payload);

    // 1) 비전 상품 인식(사진이 있을 때) — 실패해도 입력 카테고리로 계속 진행
    let product = if authorized {
        match payload.get("image").and_then(|v| v.as_str()) {
            Some(img) if img.starts_with("data:image") && img.len() < MAX_IMAGE_BYTES => {
                openai::scan_detect_product(img).await
            }
            _ => None,
        }
    } else {
        None
    };
    let product_name = product.as_ref().and_then(|p| p.get("name")).and_then(|v| v.as_str()).map(|s| cap(s, 40));
    let product_category = product.as_ref().and_then(|p| p.get("category")).and_then(|v| v.as_str()).map(|s| cap(s, 20));
    let product_color = product
        .as_ref()
        .and_then(|p| p.get("colorHex"))
        .and_then(|v| v.as_str())
        .filter(|s| s.starts_with('#'))
        .map(|s| cap(s, 9));
    let product_color_label = product.as_ref().and_then(|p| p.get("color")).and_then(|v| v.as_str()).map(|s| cap(s, 20));

    // 2) 결정적 판정 — 사진에서 읽은 카테고리가 있으면 그것이 우선(사진과 다른 드롭다운 값 교정)
    let category_eff = product_category.clone().unwrap_or_else(|| category_in.clone());
    let facts = rules::evaluate_scan_v3(&category_eff, &price, product_color.as_deref(), &wardrobe);

    // 3) 이유 문장(LLM은 표현만)
    let llm = if authorized {
        openai::scan_llm_copy(&facts, product_name.as_deref()).await
    } else {
        None
    };
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
        "similar": facts.similar.iter().map(|s| json!({"name": s.name, "color": s.color, "similarity": s.similarity, "ref": s.wardrobe_ref})).collect::<Vec<_>>(),
        "product": match &product {
            Some(_) => json!({
                "name": product_name,
                "category": category_eff,
                "color": product_color_label,
                "colorHex": product_color,
            }),
            None => Value::Null,
        },
        "headline": headline,
        "reasons": reasons.iter().map(|(t, s)| json!({"title": t, "sub": s})).collect::<Vec<_>>(),
        "alt": alt,
        "source": source,
        "model": model,
    })
}

/// POST /api/care 응답. payload: { material?: string }
pub async fn care_response(payload: &Value, authorized: bool) -> Value {
    let material = cap(
        payload
            .get("material")
            .and_then(|v| v.as_str())
            .unwrap_or("네이비 울 니트"),
        60,
    );
    let facts = rules::evaluate_care(&material);
    let guide = if authorized {
        openai::care_llm_guide(&facts).await
    } else {
        None
    };
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
pub async fn style_response(payload: &Value, authorized: bool) -> Value {
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
    if authorized {
        if let Some(img) = payload.get("image").and_then(|v| v.as_str()) {
            if img.starts_with("data:image") && img.len() < MAX_IMAGE_BYTES {
                if let Some(v) = openai::style_recommend(img, &body_type, &season).await {
                    let mut out = v;
                    out["source"] = json!("openai");
                    out["model"] = json!(openai::model_name());
                    return out;
                }
            }
        }
    }
    openai::style_fallback(&body_type)
}

/// POST /api/wardrobe 응답. payload: { image?: data-url }
/// 사진(옷장·갤러리) 속 의류 아이템을 GPT-4o 비전으로 식별, 실패 시 편집용 초안 1점.
pub async fn wardrobe_response(payload: &Value, authorized: bool) -> Value {
    if authorized {
        if let Some(img) = payload.get("image").and_then(|v| v.as_str()) {
            if img.starts_with("data:image") && img.len() < MAX_IMAGE_BYTES {
                if let Some(v) = openai::wardrobe_detect(img).await {
                    let mut out = v;
                    out["source"] = json!("openai");
                    out["model"] = json!(openai::model_name());
                    return out;
                }
            }
        }
    }
    openai::wardrobe_fallback()
}
