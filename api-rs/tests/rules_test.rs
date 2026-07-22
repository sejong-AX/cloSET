//! 결정적 판정 엔진 테스트 (web/tests/rules.test.ts 의 Rust 미러).
//! 차별점 검증: verdict 는 LLM 이 아니라 코드가 정한다.

use closet_api_rs::rules::{
    category_to_family, evaluate_care, evaluate_scan, material_to_family, parse_price, CareFamily,
    Family, Verdict,
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

#[test]
fn wool_guide_defaults() {
    let c = evaluate_care("네이비 울 니트");
    assert_eq!(c.family, CareFamily::Wool);
    assert_eq!(c.temp_c, 30);
    assert_eq!(c.symbols.len(), 4);
    assert!(c.base_guide.contains("손세탁") || c.base_guide.contains("찬물"));
}
