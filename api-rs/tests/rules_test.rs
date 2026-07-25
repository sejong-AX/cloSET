//! 결정적 판정 엔진 테스트 (web/tests/rules.test.ts 의 Rust 미러).
//! 차별점 검증: verdict 는 LLM 이 아니라 코드가 정한다.

use closet_api_rs::rules::{
    category_to_family, category_to_family_opt, color_closeness, duplication_risk, evaluate_care,
    evaluate_scan, evaluate_scan_v3, item_similarity, material_to_family, parse_price,
    type_to_family, CareFamily, Family, Verdict, WardrobeRef,
};

#[test]
fn knit_top_is_stop() {
    let f = evaluate_scan("니트 · 상의", "79,000원");
    assert_eq!(f.family, Family::Top);
    assert_eq!(f.verdict, Verdict::Stop);
    assert!(f.duplication_risk >= 70);
}

#[test]
fn outer_is_alternative() {
    let f = evaluate_scan("아우터", "150,000원");
    assert_eq!(f.family, Family::Outer);
    assert_eq!(f.verdict, Verdict::Alternative);
    assert!(f.duplication_risk >= 40 && f.duplication_risk < 70);
}

#[test]
fn bottom_is_buy() {
    let f = evaluate_scan("하의", "60,000원");
    assert_eq!(f.family, Family::Bottom);
    assert_eq!(f.verdict, Verdict::Buy);
    assert!(f.duplication_risk < 40);
}

#[test]
fn shoes_is_buy() {
    let f = evaluate_scan("신발", "120,000원");
    assert_eq!(f.family, Family::Shoes);
    assert_eq!(f.verdict, Verdict::Buy);
}

#[test]
fn cpw_is_deterministic() {
    let f = evaluate_scan("니트 · 상의", "90,000원");
    assert_eq!(f.expected_wears, 3);
    assert_eq!(f.expected_cpw, 30000);
}

#[test]
fn price_parsing() {
    assert_eq!(parse_price("79,000원"), 79000);
    assert_eq!(parse_price("₩1,250,000"), 1250000);
}

#[test]
fn category_mapping() {
    assert_eq!(category_to_family("니트 · 상의"), Family::Top);
    assert_eq!(category_to_family("아우터"), Family::Outer);
    assert_eq!(category_to_family("코트"), Family::Outer);
    assert_eq!(category_to_family("하의"), Family::Bottom);
    assert_eq!(category_to_family("신발"), Family::Shoes);
}

#[test]
fn material_mapping() {
    assert_eq!(material_to_family("네이비 울 니트"), CareFamily::Wool);
    assert_eq!(material_to_family("데님 팬츠"), CareFamily::Denim);
    assert_eq!(material_to_family("스웨이드 로퍼"), CareFamily::Leather);
    assert_eq!(material_to_family("폴리에스터 셔츠"), CareFamily::Synthetic);
    assert_eq!(material_to_family("코튼 티셔츠"), CareFamily::Cotton);
}

// ---------------- v3: 실옷장 기반 판정 ----------------

fn w(name: &str, type_key: &str, color: &str, wear: u32) -> WardrobeRef {
    WardrobeRef { name: name.into(), type_key: type_key.into(), color: color.into(), wear }
}

fn seed_wardrobe() -> Vec<WardrobeRef> {
    vec![
        w("네이비 울 니트", "top-g", "#233d56", 14),
        w("오프화이트 셔츠", "top-g", "#e7e5dc", 22),
        w("그레이 스페클 니트", "top-g", "#8a8f8c", 4),
        w("베이지 트렌치코트", "coat", "#8f806f", 12),
        w("크림 와이드 팬츠", "pants", "#d2cabc", 9),
        w("차콜 슬랙스", "pants", "#444b48", 18),
        w("스웨이드 로퍼", "shoe", "#765c48", 11),
    ]
}

#[test]
fn type_family_mapping() {
    assert_eq!(type_to_family("top-g"), Some(Family::Top));
    assert_eq!(type_to_family("coat"), Some(Family::Outer));
    assert_eq!(type_to_family("pants"), Some(Family::Bottom));
    assert_eq!(type_to_family("shoe"), Some(Family::Shoes));
    assert_eq!(type_to_family("bag"), None); // 가방·액세서리는 비교 제외
    assert_eq!(type_to_family("acc"), None);
}

#[test]
fn category_opt_excludes_non_clothing() {
    assert_eq!(category_to_family_opt("가방"), None);
    assert_eq!(category_to_family_opt("액세서리"), None);
    assert_eq!(category_to_family_opt("원피스"), None);
    assert_eq!(category_to_family_opt("니트"), Some(Family::Top));
}

#[test]
fn color_closeness_bounds() {
    assert!((color_closeness("#ffffff", "#ffffff").unwrap() - 1.0).abs() < 1e-9);
    assert!(color_closeness("#000000", "#ffffff").unwrap() < 0.01);
    assert!(color_closeness("잘못된값", "#ffffff").is_none());
    // #rgb 축약형도 파싱
    assert!((color_closeness("#fff", "#ffffff").unwrap() - 1.0).abs() < 1e-9);
}

#[test]
fn similarity_same_color_is_high_and_deterministic() {
    let a = item_similarity(Some("#233d56"), "#233d56");
    assert_eq!(a, 98); // 55 + 43 캡
    let b = item_similarity(Some("#233d56"), "#e7e5dc"); // 네이비 vs 오프화이트
    assert!(b < a && b >= 55);
    // 상품 색 미상 → 중간값(과신 방지)
    assert_eq!(item_similarity(None, "#233d56"), 75);
}

#[test]
fn risk_formula_clamped() {
    assert_eq!(duplication_risk(98, 9), (98.0f64 * 0.6).round() as u32 + 24);
    assert_eq!(duplication_risk(0, 0), 8); // 하한
    assert!(duplication_risk(98, 20) <= 96); // 상한
}

#[test]
fn v3_same_navy_knit_is_stop() {
    // 네이비 니트를 또 사려는 상황: 같은 색 니트 보유 → STOP
    let f = evaluate_scan_v3("니트", "79,000원", Some("#233d56"), &seed_wardrobe());
    assert_eq!(f.verdict, Verdict::Stop);
    assert_eq!(f.similar[0].name, "네이비 울 니트");
    assert!(f.similar[0].similarity >= 90);
    assert_eq!(f.similar[0].wardrobe_ref, 0); // 클라이언트 배열 인덱스 에코
    assert_eq!(f.rule_version, "v3.0");
}

#[test]
fn v3_empty_family_is_buy() {
    // 옷장에 원피스가 없음 → 실제 공백 → BUY, 위험 최저
    let f = evaluate_scan_v3("원피스", "120,000원", Some("#aa3344"), &seed_wardrobe());
    assert_eq!(f.verdict, Verdict::Buy);
    assert_eq!(f.duplication_risk, 8);
    assert_eq!(f.similar[0].similarity, 0);
    assert_eq!(f.similar[0].wardrobe_ref, -1);
}

#[test]
fn v3_without_wardrobe_falls_back_to_legacy() {
    let f = evaluate_scan_v3("니트 · 상의", "79,000원", None, &[]);
    assert_eq!(f.verdict, Verdict::Stop); // 레거시 시드 유지(dup_base 84)
    assert_eq!(f.duplication_risk, 84);
}

#[test]
fn v3_distinct_color_pants_is_alternative_or_buy() {
    // 밝은 노랑 팬츠: 보유 팬츠 2벌과 색이 멀다 → STOP은 아님
    let f = evaluate_scan_v3("하의", "60,000원", Some("#e8c521"), &seed_wardrobe());
    assert!(f.verdict != Verdict::Stop);
    assert!(f.similar.len() <= 3 && !f.similar.is_empty());
}

#[test]
fn v3_avg_wears_from_actual_wardrobe() {
    let f = evaluate_scan_v3("하의", "60,000원", None, &seed_wardrobe());
    // 팬츠 2벌(9, 18회) 평균 = 14 (반올림)
    assert_eq!(f.avg_wears_similar, 14);
}

#[test]
fn wool_guide_defaults() {
    let c = evaluate_care("네이비 울 니트");
    assert_eq!(c.family, CareFamily::Wool);
    assert_eq!(c.temp_c, 30);
    assert_eq!(c.symbols.len(), 4);
    assert!(c.base_guide.contains("손세탁") || c.base_guide.contains("찬물"));
}
