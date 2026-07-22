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
        .timeout(Duration::from_secs(8)) // 플랫폼 함수 타임아웃(~10s)보다 짧게 → 폴백 확보
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
    if reasons_v.len() != 3 {
        return None; // '정확히 3개' 계약 미충족 → 폴백
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

/// 사진(data URL) → GPT-4o 비전으로 체형 맞춤 스타일 추천. 실패 시 None → 결정적 폴백.
pub async fn style_recommend(image_data_url: &str, body_type: &str, season: &str) -> Option<Value> {
    let key = api_key()?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(9))
        .build()
        .ok()?;
    let system = concat!(
        "너는 cloSET의 퍼스널 스타일리스트다. 사용자가 올린 사진에서 체형·실루엣·비율을 관찰해, ",
        "그 체형에 어울리는 옷 실루엣과 스타일링을 추천한다. 외모 평가·신원·얼굴 언급은 하지 말고 옷 실루엣 중심으로만 조언한다. ",
        "진단을 단정하지 말고 부드럽게 제안한다. 따뜻하고 담백한 한국어 존댓말, 이모지·과장 금지. ",
        "반드시 아래 JSON 으로만 답한다: {\"bodyType\": string(추정 체형 한 단어), \"summary\": string(2문장), ",
        "\"tips\": [{\"title\": string, \"detail\": string}] (정확히 4개), \"recommend\": [string] (추천 아이템/실루엣 4개)}"
    );
    let user_text = format!(
        "참고 프로필 — 체형 유형: {}, 시즌 컬러: {}. 사진 속 인물의 체형·어깨·허리 비율에 맞는 옷 실루엣과 코디를 추천해줘.",
        body_type, season
    );
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(&key)
        .json(&json!({
            "model": model_name(),
            "temperature": 0.5,
            "max_tokens": 700,
            "response_format": { "type": "json_object" },
            "messages": [
                { "role": "system", "content": system },
                { "role": "user", "content": [
                    { "type": "text", "text": user_text },
                    { "type": "image_url", "image_url": { "url": image_data_url } }
                ]}
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
    let parsed: Value = serde_json::from_str(content).ok()?;
    if parsed.get("summary").and_then(|v| v.as_str()).is_some()
        && parsed
            .get("tips")
            .and_then(|v| v.as_array())
            .map(|a| !a.is_empty())
            .unwrap_or(false)
    {
        Some(parsed)
    } else {
        None
    }
}

/// 사진 없음·키 없음·실패 시 체형별 결정적 추천
pub fn style_fallback(body_type: &str) -> Value {
    let bt = body_type.to_lowercase();
    let (label, summary, tips, recommend): (&str, &str, Vec<(&str, &str)>, Vec<&str>) =
        if bt.contains("wave") || bt.contains("웨이브") || bt.contains("곡선") {
            (
                "웨이브(곡선형)",
                "부드러운 곡선과 아담한 상체 실루엣에 어울리는 스타일을 모았어요. 허리를 살리는 핏이 잘 맞아요.",
                vec![
                    ("하이웨이스트로 다리 길이 강조", "허리선이 높은 팬츠·스커트로 비율을 살려요."),
                    ("상체는 가볍고 또렷하게", "얇은 니트·리브드 탑으로 상체 볼륨을 정돈해요."),
                    ("소프트한 드레이프 소재", "부드럽게 떨어지는 소재가 곡선과 잘 어울려요."),
                    ("발목을 드러내는 기장", "크롭·앵클 기장으로 가벼운 인상을 줘요."),
                ],
                vec!["하이웨이스트 와이드 팬츠", "리브드 니트", "랩 블라우스", "앵클 팬츠"],
            )
        } else if bt.contains("natural") || bt.contains("내추럴") || bt.contains("프레임") {
            (
                "내추럴(프레임형)",
                "골격이 또렷하고 프레임감이 있는 실루엣에 어울리는 여유로운 스타일이에요. 넉넉한 핏이 멋스러워요.",
                vec![
                    ("오버사이즈로 프레임을 살리기", "박시한 코트·셔츠가 자연스럽게 어울려요."),
                    ("두께감 있는 소재", "울·데님 등 텍스처가 있는 소재가 좋아요."),
                    ("레이어드로 리듬 주기", "가디건·셔츠를 겹쳐 입어 입체감을 더해요."),
                    ("직선적인 실루엣", "스트레이트 팬츠로 시원하게 떨어뜨려요."),
                ],
                vec!["오버사이즈 코트", "박시 셔츠", "스트레이트 데님", "청키 니트"],
            )
        } else {
            (
                "스트레이트(직선형)",
                "상체가 또렷하고 탄탄한 실루엣에 어울리는 깔끔한 스타일을 모았어요. 군더더기 없는 핏이 잘 맞아요.",
                vec![
                    ("V넥·오픈 네크로 목선 강조", "쇄골을 드러내면 상체가 시원해 보여요."),
                    ("정돈된 스트레이트 핏", "몸에 딱 붙지 않는 반듯한 실루엣이 좋아요."),
                    ("매끈하고 고급스러운 소재", "울·코튼처럼 표면이 정돈된 소재를 추천해요."),
                    ("아이템은 적게, 핏은 정확히", "레이어를 줄이고 핏으로 완성해요."),
                ],
                vec!["V넥 니트", "테일러드 코트", "스트레이트 슬랙스", "실키 셔츠"],
            )
        };
    json!({
        "bodyType": label,
        "summary": summary,
        "tips": tips.iter().map(|(t, d)| json!({"title": t, "detail": d})).collect::<Vec<_>>(),
        "recommend": recommend,
        "source": "fallback",
        "model": Value::Null,
    })
}

/// 사진(data URL) → GPT-4o 비전으로 옷장/갤러리 속 의류 아이템 목록 식별. 실패 시 None → 폴백.
pub async fn wardrobe_detect(image_data_url: &str) -> Option<Value> {
    let key = api_key()?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .ok()?;
    let system = concat!(
        "너는 cloSET의 옷장 정리 어시스턴트다. 사용자가 올린 사진(옷장 전체·옷걸이·개별 옷 사진 등)에서 ",
        "보이는 의류·패션 아이템을 하나씩 식별해 목록으로 만든다. 사람·얼굴·배경·가구·행거는 무시하고 착용 아이템만 담는다. ",
        "외모·신원 언급 금지. 확실하지 않은 항목은 넣지 말고(과분류 금지) 뚜렷이 보이는 것만 담는다. 최대 10개. ",
        "각 항목 필드 — name: 색과 종류를 담은 짧은 한국어 이름(예: '네이비 니트'), ",
        "category: 반드시 [상의, 하의, 아우터, 니트, 원피스, 신발, 가방, 액세서리] 중 하나, ",
        "color: 한국어 색 이름, material: 추정 소재(모르면 빈 문자열), ",
        "fit: 핏·실루엣을 한 단어로(슬림·레귤러·루즈·오버핏·와이드·크롭·롱·스트레이트·테이퍼드 등). ",
        "색과 종류가 비슷해도 핏이 다르면 서로 다른 옷이므로 fit 을 반드시 구분해 적어 두 옷을 식별할 수 있게 한다. 판단이 어려우면 빈 문자열. ",
        "반드시 아래 JSON 으로만 답한다: {\"items\": [{\"name\": string, \"category\": string, \"color\": string, \"material\": string, \"fit\": string}]}"
    );
    let user_text = "이 사진에서 보이는 옷과 패션 아이템을 모두 찾아 목록으로 만들어줘. 색·종류가 비슷한 옷은 핏(실루엣)으로 구분해줘.";
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(&key)
        .json(&json!({
            "model": model_name(),
            "temperature": 0.2,
            "max_tokens": 1200,
            "response_format": { "type": "json_object" },
            "messages": [
                { "role": "system", "content": system },
                { "role": "user", "content": [
                    { "type": "text", "text": user_text },
                    { "type": "image_url", "image_url": { "url": image_data_url } }
                ]}
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
    let parsed: Value = serde_json::from_str(content).ok()?;
    // items 배열이 존재해야 유효(빈 배열도 유효 — '옷을 못 찾음'을 뜻함)
    parsed.get("items").and_then(|v| v.as_array())?;
    Some(parsed)
}

/// 비전 실패·키 없음 시 — 사용자가 직접 채우도록 편집 가능한 초안 1점
pub fn wardrobe_fallback() -> Value {
    json!({
        "items": [ { "name": "새 옷", "category": "상의", "color": "", "material": "", "fit": "" } ],
        "source": "fallback",
        "model": Value::Null,
    })
}
