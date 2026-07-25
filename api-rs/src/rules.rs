//! 결정적 판정 엔진 (web/lib/rules.ts 의 Rust 포팅).
//! cloSET 원칙: BUY / STOP / ALTERNATIVE, 중복 위험, 회당 비용(CPW), 케어 심볼은
//! "코드"가 정한다. LLM 은 이 수치를 바꾸지 못하고 "표현(문장)"만 담당한다.

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Verdict {
    Stop,
    Buy,
    Alternative,
}

impl Verdict {
    pub fn as_str(&self) -> &'static str {
        match self {
            Verdict::Stop => "STOP",
            Verdict::Buy => "BUY",
            Verdict::Alternative => "ALTERNATIVE",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Family {
    Top,
    Outer,
    Bottom,
    Shoes,
}

impl Family {
    pub fn as_str(&self) -> &'static str {
        match self {
            Family::Top => "top",
            Family::Outer => "outer",
            Family::Bottom => "bottom",
            Family::Shoes => "shoes",
        }
    }
}

#[derive(Clone, Debug)]
pub struct SimilarItem {
    pub name: String,
    pub color: String,
    pub similarity: u32,
    /// 클라이언트가 보낸 wardrobe 배열의 인덱스(실제 옷 사진 매핑용). 레거시/합성 항목은 -1.
    pub wardrobe_ref: i32,
}

fn sim(name: &str, color: &str, similarity: u32) -> SimilarItem {
    SimilarItem { name: name.to_string(), color: color.to_string(), similarity, wardrobe_ref: -1 }
}

struct FamilyCfg {
    owned: Vec<SimilarItem>,
    dup_base: u32,
    wears: u32,
    avg_wears: u32,
}

fn family_cfg(f: Family) -> FamilyCfg {
    match f {
        Family::Top => FamilyCfg {
            owned: vec![
                sim("블랙 울 니트", "#1d2221", 91),
                sim("차콜 오버 니트", "#363b39", 86),
                sim("베이지 코튼 니트", "#c6bda8", 72),
            ],
            dup_base: 84,
            wears: 3,
            avg_wears: 2,
        },
        Family::Outer => FamilyCfg {
            owned: vec![
                sim("베이지 트렌치코트", "#8f806f", 64),
                sim("브라운 울 코트", "#887b6d", 58),
                sim("네이비 블레이저", "#233d56", 41),
            ],
            dup_base: 57,
            wears: 9,
            avg_wears: 6,
        },
        Family::Bottom => FamilyCfg {
            owned: vec![sim("차콜 슬랙스", "#444b48", 38), sim("크림 와이드 팬츠", "#d2cabc", 33)],
            dup_base: 29,
            wears: 12,
            avg_wears: 10,
        },
        Family::Shoes => FamilyCfg {
            owned: vec![sim("스웨이드 로퍼", "#765c48", 22)],
            dup_base: 18,
            wears: 14,
            avg_wears: 11,
        },
    }
}

pub fn category_to_family(category: &str) -> Family {
    let c = category.trim();
    if c.contains("아우터") || c.contains("코트") || c.contains("자켓") || c.contains("재킷") {
        Family::Outer
    } else if c.contains("하의") || c.contains("팬츠") || c.contains("슬랙스") || c.contains("스커트") {
        Family::Bottom
    } else if c.contains("신발") || c.contains("로퍼") || c.contains("스니커") {
        Family::Shoes
    } else {
        Family::Top
    }
}

pub fn parse_price(raw: &str) -> i64 {
    let digits: String = raw.chars().filter(|ch| ch.is_ascii_digit()).collect();
    digits.parse::<i64>().unwrap_or(0)
}

fn verdict_from_risk(risk: u32) -> Verdict {
    if risk >= 70 {
        Verdict::Stop
    } else if risk >= 40 {
        Verdict::Alternative
    } else {
        Verdict::Buy
    }
}

pub struct ScanFacts {
    pub category: String,
    pub family: Family,
    pub price: i64,
    pub verdict: Verdict,
    pub duplication_risk: u32,
    pub rule_version: &'static str,
    pub similar: Vec<SimilarItem>,
    pub expected_wears: u32,
    pub expected_cpw: i64,
    pub avg_wears_similar: u32,
    pub owned_count: u32,
}

pub fn evaluate_scan(category: &str, price_raw: &str) -> ScanFacts {
    let family = category_to_family(category);
    let price = parse_price(price_raw);
    let cfg = family_cfg(family);
    let duplication_risk = cfg.dup_base;
    let verdict = verdict_from_risk(duplication_risk);
    let expected_wears = cfg.wears;
    let expected_cpw = if expected_wears > 0 {
        (price as f64 / expected_wears as f64).round() as i64
    } else {
        price
    };
    let owned_count = {
        let c = cfg.owned.iter().filter(|s| s.similarity >= 80).count() as u32;
        if c == 0 {
            1
        } else {
            c
        }
    };
    ScanFacts {
        category: category.to_string(),
        family,
        price,
        verdict,
        duplication_risk,
        rule_version: "v2.1",
        similar: cfg.owned,
        expected_wears,
        expected_cpw,
        avg_wears_similar: cfg.avg_wears,
        owned_count,
    }
}

// ---------------- Snap & Check v3 — 실제 옷장 기반 판정 ----------------
// 클라이언트가 보낸 "내 옷장" 목록과 비전이 식별한 상품(카테고리·대표색)으로
// 유사도·중복 위험을 결정적으로 계산한다. LLM 은 여기서도 수치를 정하지 않는다.

/// 클라이언트 옷장 항목(요약). type_key 는 프론트 Item.type (top-g/pants/coat/shoe/bag/acc).
#[derive(Clone, Debug)]
pub struct WardrobeRef {
    pub name: String,
    pub type_key: String,
    pub color: String,
    pub wear: u32,
}

/// 프론트 Item.type → 판정 패밀리. 가방·액세서리 등은 대체재 비교 대상이 아니다.
pub fn type_to_family(type_key: &str) -> Option<Family> {
    match type_key {
        "coat" => Some(Family::Outer),
        "pants" => Some(Family::Bottom),
        "shoe" => Some(Family::Shoes),
        t if t.starts_with("top") => Some(Family::Top),
        _ => None,
    }
}

/// 카테고리 문자열 → 패밀리(옵션). 가방·액세서리·원피스처럼 비교 패밀리가 없으면 None.
pub fn category_to_family_opt(category: &str) -> Option<Family> {
    let c = category.trim();
    if c.contains("가방") || c.contains("백팩") || c.contains("액세서리") || c.contains("원피스") || c.contains("드레스") {
        None
    } else {
        Some(category_to_family(c))
    }
}

fn hex_rgb(s: &str) -> Option<(f64, f64, f64)> {
    let h = s.trim().trim_start_matches('#');
    let (r, g, b) = match h.len() {
        3 => (
            u8::from_str_radix(&h[0..1].repeat(2), 16).ok()?,
            u8::from_str_radix(&h[1..2].repeat(2), 16).ok()?,
            u8::from_str_radix(&h[2..3].repeat(2), 16).ok()?,
        ),
        6 => (
            u8::from_str_radix(&h[0..2], 16).ok()?,
            u8::from_str_radix(&h[2..4], 16).ok()?,
            u8::from_str_radix(&h[4..6], 16).ok()?,
        ),
        _ => return None,
    };
    Some((r as f64, g as f64, b as f64))
}

/// 두 hex 색의 근접도 0.0(전혀 다름)~1.0(동일). 파싱 실패 시 None.
pub fn color_closeness(a: &str, b: &str) -> Option<f64> {
    let (ar, ag, ab) = hex_rgb(a)?;
    let (br, bg, bb) = hex_rgb(b)?;
    let dist = ((ar - br).powi(2) + (ag - bg).powi(2) + (ab - bb).powi(2)).sqrt();
    Some((1.0 - dist / 441.673).clamp(0.0, 1.0))
}

/// 같은 패밀리 옷 한 벌과의 시각 유사도(0~98). 같은 패밀리 기본 55점 + 색 근접 최대 43점.
/// 상품 색을 모르면 중간값 20점(과신 방지).
pub fn item_similarity(product_color: Option<&str>, item_color: &str) -> u32 {
    let color_pts = product_color
        .and_then(|p| color_closeness(p, item_color))
        .map(|c| (c * 43.0).round() as u32)
        .unwrap_or(20);
    (55 + color_pts).min(98)
}

/// 중복 위험 = 최고 유사도 0.6 가중 + 같은 패밀리 보유 수(최대 6벌 반영) × 4, 8~96 클램프.
pub fn duplication_risk(top_similarity: u32, owned_same_family: u32) -> u32 {
    let raw = (top_similarity as f64 * 0.6).round() as u32 + 4 * owned_same_family.min(6);
    raw.clamp(8, 96)
}

/// v3 판정: 실제 옷장이 오면 그 목록으로, 없으면 레거시 시드로 계산한다.
pub fn evaluate_scan_v3(
    category: &str,
    price_raw: &str,
    product_color: Option<&str>,
    wardrobe: &[WardrobeRef],
) -> ScanFacts {
    let family_opt = category_to_family_opt(category);
    let family = family_opt.unwrap_or(Family::Top);
    let price = parse_price(price_raw);
    let legacy = family_cfg(family);

    let mut sims: Vec<SimilarItem> = match family_opt {
        Some(fam) => wardrobe
            .iter()
            .enumerate()
            .filter(|(_, w)| type_to_family(&w.type_key) == Some(fam))
            .map(|(i, w)| SimilarItem {
                name: w.name.clone(),
                color: w.color.clone(),
                similarity: item_similarity(product_color, &w.color),
                wardrobe_ref: i as i32,
            })
            .collect(),
        None => Vec::new(),
    };
    sims.sort_by(|a, b| b.similarity.cmp(&a.similarity).then(a.wardrobe_ref.cmp(&b.wardrobe_ref)));

    let same_family: Vec<&WardrobeRef> = match family_opt {
        Some(fam) => wardrobe.iter().filter(|w| type_to_family(&w.type_key) == Some(fam)).collect(),
        None => Vec::new(),
    };

    let (risk, similar, avg_wears) = if sims.is_empty() {
        if wardrobe.is_empty() {
            // 옷장 미제공(구버전 클라이언트) → 레거시 시드 유지
            (legacy.dup_base, legacy.owned.clone(), legacy.avg_wears)
        } else {
            // 옷장은 있으나 이 패밀리가 비어 있음 → 실제 공백, 위험 최저
            (8, vec![sim("겹치는 옷 없음", "#e8efe9", 0)], legacy.avg_wears)
        }
    } else {
        let top = sims[0].similarity;
        let avg = {
            let total: u32 = same_family.iter().map(|w| w.wear).sum();
            let n = same_family.len() as u32;
            if n > 0 { ((total as f64) / (n as f64)).round() as u32 } else { legacy.avg_wears }
        };
        sims.truncate(3);
        (duplication_risk(top, same_family.len() as u32), sims, avg)
    };

    let verdict = verdict_from_risk(risk);
    let expected_wears = if family_opt.is_some() { legacy.wears } else { 10 };
    let expected_cpw = if expected_wears > 0 {
        (price as f64 / expected_wears as f64).round() as i64
    } else {
        price
    };
    let owned_count = {
        let c = similar.iter().filter(|s| s.similarity >= 80).count() as u32;
        if c == 0 { 1 } else { c }
    };
    ScanFacts {
        category: category.to_string(),
        family,
        price,
        verdict,
        duplication_risk: risk,
        rule_version: "v3.0",
        similar,
        expected_wears,
        expected_cpw,
        avg_wears_similar: avg_wears,
        owned_count,
    }
}

// ---------------- Care Label AI ----------------

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum CareFamily {
    Wool,
    Cotton,
    Denim,
    Leather,
    Synthetic,
}

impl CareFamily {
    pub fn as_str(&self) -> &'static str {
        match self {
            CareFamily::Wool => "wool",
            CareFamily::Cotton => "cotton",
            CareFamily::Denim => "denim",
            CareFamily::Leather => "leather",
            CareFamily::Synthetic => "synthetic",
        }
    }
}

pub struct CareFacts {
    pub material: String,
    pub family: CareFamily,
    pub title: &'static str,
    pub temp_c: i32,
    pub symbols: Vec<&'static str>,
    pub base_guide: &'static str,
}

pub fn material_to_family(material: &str) -> CareFamily {
    let m = material.to_lowercase();
    if m.contains("울") || m.contains("니트") || m.contains("wool") || m.contains("캐시미어") {
        CareFamily::Wool
    } else if m.contains("데님") || m.contains("denim") || m.contains("청") {
        CareFamily::Denim
    } else if m.contains("가죽") || m.contains("스웨이드") || m.contains("leather") {
        CareFamily::Leather
    } else if m.contains("폴리") || m.contains("나일론") || m.contains("아크릴") || m.contains("synthetic") {
        CareFamily::Synthetic
    } else {
        CareFamily::Cotton
    }
}

pub fn evaluate_care(material: &str) -> CareFacts {
    let family = material_to_family(material);
    let (title, temp_c, symbols, base_guide): (&'static str, i32, Vec<&'static str>, &'static str) =
        match family {
            CareFamily::Wool => (
                "울 니트 안전 가이드",
                30,
                vec!["30°", "×△", "—", "●"],
                "찬물에서 울 전용 세제로 손세탁하고 비틀어 짜지 마세요. 평평하게 눕혀 그늘에서 말리는 것이 좋아요.",
            ),
            CareFamily::Cotton => (
                "코튼 케어 가이드",
                40,
                vec!["40°", "△", "▢", "●"],
                "미지근한 물에서 세탁하고 비슷한 색끼리 분류하세요. 직사광선은 변색을 부를 수 있어 그늘 건조를 권해요.",
            ),
            CareFamily::Denim => (
                "데님 케어 가이드",
                30,
                vec!["30°", "×△", "—", "◐"],
                "뒤집어서 단독 세탁하고 물 빠짐을 줄이려면 찬물을 사용하세요. 자연 건조로 형태를 유지하는 것이 좋아요.",
            ),
            CareFamily::Leather => (
                "스웨이드·가죽 케어 가이드",
                0,
                vec!["✋", "×○", "×△", "▤"],
                "물세탁 대신 전용 브러시로 결을 살려 관리하고, 젖으면 자연 건조 후 방수 스프레이를 뿌려 주세요.",
            ),
            CareFamily::Synthetic => (
                "합성 소재 케어 가이드",
                30,
                vec!["30°", "△", "▢", "◐"],
                "찬물 약한 세탁으로 보풀을 줄이고, 고온 건조는 피하세요. 낮은 온도로 다림질하는 것이 안전해요.",
            ),
        };
    CareFacts {
        material: material.to_string(),
        family,
        title,
        temp_c,
        symbols,
        base_guide,
    }
}

/// 천단위 콤마 (26333 -> "26,333")
pub fn comma(n: i64) -> String {
    let neg = n < 0;
    let s = n.abs().to_string();
    let len = s.len();
    let mut out = String::new();
    for (i, ch) in s.chars().enumerate() {
        if i > 0 && (len - i) % 3 == 0 {
            out.push(',');
        }
        out.push(ch);
    }
    if neg {
        format!("-{}", out)
    } else {
        out
    }
}

// ---- 의류 카테고리 결정적 재판정 (web/lib/garment.ts 의 Rust 미러) ----
//
// 왜 필요한가: 비전 모델이 카테고리를 틀리게 돌려주는 실제 사례가 있다.
// 대표 사례 — 옷걸이 바에 반으로 접혀 걸린 바지는 가로로 넓고 두 겹으로 보여 '상의'로 오인된다.
// 이름에 '슬랙스·바지·청바지'처럼 다른 카테고리로 읽힐 수 없는 확정 명사가 있으면
// 그 이름이 모델의 카테고리를 이긴다. 판정은 코드가, 표현은 LLM 이 담당한다는 원칙의 연장.

/// 사용자에게 보이는 카테고리 8종
pub const CATEGORIES: [&str; 8] = ["상의", "니트", "하의", "아우터", "원피스", "신발", "가방", "액세서리"];

const KW_BOTTOM: &[&str] = &[
    "바지", "팬츠", "슬랙스", "슬랙", "청바지", "진바지", "데님팬츠", "조거", "트라우저",
    "치마", "스커트", "반바지", "숏츠", "버뮤다", "레깅스", "스키니", "하의",
    "pants", "jeans", "slacks", "shorts", "skirt", "trousers", "jogger", "chinos",
];
const KW_DRESS: &[&str] = &["원피스", "드레스", "점프수트", "올인원", "dress", "jumpsuit"];
const KW_SHOE: &[&str] = &[
    "신발", "슈즈", "스니커", "운동화", "부츠", "로퍼", "구두", "샌들", "힐", "펌프스", "더비", "옥스퍼드",
    "shoes", "sneaker", "boots", "loafer", "sandal", "heel", "derby", "oxford",
];
const KW_BAG: &[&str] = &[
    "가방", "백팩", "숄더백", "토트", "크로스백", "클러치", "더플", "에코백",
    "bag", "backpack", "tote", "clutch",
];
const KW_ACC: &[&str] = &[
    "모자", "캡", "비니", "버킷햇", "스카프", "머플러", "목도리", "벨트", "장갑", "양말",
    "주얼리", "시계", "안경", "선글라스", "넥타이", "반지", "목걸이", "귀걸이", "액세서리",
    "hat", "cap", "beanie", "scarf", "belt", "socks", "watch", "glasses", "sunglasses", "tie",
];
/// 아우터 — 가디건은 니트로 분류하므로 여기 넣지 않는다
const KW_OUTER: &[&str] = &[
    "코트", "자켓", "재킷", "점퍼", "패딩", "블레이저", "바람막이", "아노락", "무스탕",
    "트렌치", "파카", "집업", "조끼", "베스트", "다운", "야상", "아우터",
    "coat", "jacket", "blazer", "parka", "vest", "windbreaker", "anorak", "puffer",
];
const KW_KNIT: &[&str] = &["니트", "스웨터", "풀오버", "가디건", "knit", "sweater", "pullover", "cardigan"];
const KW_TOP: &[&str] = &[
    "셔츠", "블라우스", "티셔츠", "반팔티", "긴팔티", "맨투맨", "스웨트", "후드티", "후디",
    "탱크톱", "폴로", "카라티", "나시",
    "shirt", "blouse", "tee", "t-shirt", "hoodie", "sweatshirt", "polo", "tank",
];

/// 소문자화 + 공백 제거 ("데님 자켓" == "데님자켓")
fn norm_kw(s: &str) -> String {
    s.to_lowercase().chars().filter(|c| !c.is_whitespace()).collect()
}

fn hit_kw(text: &str, words: &[&str]) -> bool {
    words.iter().any(|w| text.contains(w))
}

/// 키워드만으로 카테고리를 정한다(단서가 없으면 None)
fn category_from_keywords(text: &str) -> Option<&'static str> {
    if hit_kw(text, KW_BOTTOM) {
        return Some("하의");
    }
    // '슬림진·스키니진·블랙진'처럼 '진'으로 끝나면 청바지다(단독 '진'은 제외).
    // web/lib/garment.ts 의 resolveCategory 와 같은 규칙을 유지한다.
    if text.chars().count() >= 3 && text.ends_with('진') {
        return Some("하의");
    }
    if hit_kw(text, KW_DRESS) {
        return Some("원피스");
    }
    if hit_kw(text, KW_SHOE) {
        return Some("신발");
    }
    if hit_kw(text, KW_BAG) {
        return Some("가방");
    }
    if hit_kw(text, KW_ACC) {
        return Some("액세서리");
    }
    if hit_kw(text, KW_OUTER) {
        return Some("아우터");
    }
    if hit_kw(text, KW_KNIT) {
        return Some("니트");
    }
    if hit_kw(text, KW_TOP) {
        return Some("상의");
    }
    None
}

/// 이름 + 모델이 준 카테고리 → 최종 카테고리. 이름의 확정 명사가 우선한다.
pub fn resolve_garment_category(name: &str, raw_category: &str) -> String {
    let n = norm_kw(name);
    if let Some(c) = category_from_keywords(&n) {
        return c.to_string();
    }
    let r = raw_category.trim();
    if CATEGORIES.contains(&r) {
        return r.to_string();
    }
    let rn = norm_kw(r);
    category_from_keywords(&rn).unwrap_or("상의").to_string()
}

/// 사진 속 두 영역의 IoU (0.0~1.0). 백분율 좌표(x,y,w,h) 기준.
pub fn box_iou(a: (f64, f64, f64, f64), b: (f64, f64, f64, f64)) -> f64 {
    let (ax, ay, aw, ah) = a;
    let (bx, by, bw, bh) = b;
    if aw <= 0.0 || ah <= 0.0 || bw <= 0.0 || bh <= 0.0 {
        return 0.0;
    }
    let x1 = ax.max(bx);
    let y1 = ay.max(by);
    let x2 = (ax + aw).min(bx + bw);
    let y2 = (ay + ah).min(by + bh);
    let iw = (x2 - x1).max(0.0);
    let ih = (y2 - y1).max(0.0);
    let inter = iw * ih;
    let union = aw * ah + bw * bh - inter;
    if union <= 0.0 {
        0.0
    } else {
        inter / union
    }
}
