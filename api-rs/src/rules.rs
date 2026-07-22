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

#[derive(Clone)]
pub struct SimilarItem {
    pub name: &'static str,
    pub color: &'static str,
    pub similarity: u32,
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
                SimilarItem { name: "블랙 울 니트", color: "#1d2221", similarity: 91 },
                SimilarItem { name: "차콜 오버 니트", color: "#363b39", similarity: 86 },
                SimilarItem { name: "베이지 코튼 니트", color: "#c6bda8", similarity: 72 },
            ],
            dup_base: 84,
            wears: 3,
            avg_wears: 2,
        },
        Family::Outer => FamilyCfg {
            owned: vec![
                SimilarItem { name: "베이지 트렌치코트", color: "#8f806f", similarity: 64 },
                SimilarItem { name: "브라운 울 코트", color: "#887b6d", similarity: 58 },
                SimilarItem { name: "네이비 블레이저", color: "#233d56", similarity: 41 },
            ],
            dup_base: 57,
            wears: 9,
            avg_wears: 6,
        },
        Family::Bottom => FamilyCfg {
            owned: vec![
                SimilarItem { name: "차콜 슬랙스", color: "#444b48", similarity: 38 },
                SimilarItem { name: "크림 와이드 팬츠", color: "#d2cabc", similarity: 33 },
            ],
            dup_base: 29,
            wears: 12,
            avg_wears: 10,
        },
        Family::Shoes => FamilyCfg {
            owned: vec![SimilarItem { name: "스웨이드 로퍼", color: "#765c48", similarity: 22 }],
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
