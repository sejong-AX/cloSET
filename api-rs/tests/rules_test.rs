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

// ---- 의류 카테고리 결정적 재판정 (접혀 걸린 바지 오분류 회귀 테스트) ----

use closet_api_rs::rules::{box_iou, resolve_garment_category};

/// 핵심 회귀: 비전이 '상의'라고 답해도 이름에 바지 명사가 있으면 '하의'로 교정된다.
/// (옷걸이 바에 반으로 접힌 바지가 가로로 넓어 상의로 오인되던 실제 결함)
#[test]
fn folded_pants_misread_as_top_is_corrected() {
    for name in ["검정 슬랙스", "접힌 검정 바지", "연청 청바지", "회색 트레이닝 바지", "블랙 조거 팬츠"] {
        assert_eq!(resolve_garment_category(name, "상의"), "하의", "name={name}");
    }
}

#[test]
fn skirt_and_shorts_are_bottom() {
    assert_eq!(resolve_garment_category("플리츠 스커트", "상의"), "하의");
    assert_eq!(resolve_garment_category("데님 반바지", "니트"), "하의");
}

/// 이름에 상의 명사가 있으면 하의로 잘못 준 카테고리도 교정된다(역방향)
#[test]
fn shirt_misread_as_bottom_is_corrected() {
    assert_eq!(resolve_garment_category("화이트 코튼 셔츠", "하의"), "상의");
    assert_eq!(resolve_garment_category("회색 후드티", "하의"), "상의");
}

/// '데님 자켓'처럼 하의 수식어가 붙은 아우터를 하의로 끌어가지 않는다
#[test]
fn denim_jacket_stays_outer() {
    assert_eq!(resolve_garment_category("인디고 데님 자켓", "상의"), "아우터");
    assert_eq!(resolve_garment_category("카고 재킷", ""), "아우터");
    assert_eq!(resolve_garment_category("트렌치코트", "상의"), "아우터");
}

#[test]
fn cardigan_is_knit_not_outer() {
    assert_eq!(resolve_garment_category("아이보리 케이블 가디건", ""), "니트");
    assert_eq!(resolve_garment_category("그레이 울 니트", "상의"), "니트");
}

#[test]
fn shoes_bags_accessories_are_classified() {
    assert_eq!(resolve_garment_category("스웨이드 로퍼", "상의"), "신발");
    assert_eq!(resolve_garment_category("블랙 백팩", "상의"), "가방");
    assert_eq!(resolve_garment_category("검정 볼캡", "상의"), "액세서리");
    assert_eq!(resolve_garment_category("네이비 원피스", "상의"), "원피스");
}

/// 이름에 단서가 없으면 모델 카테고리를 그대로 쓴다
#[test]
fn falls_back_to_model_category() {
    assert_eq!(resolve_garment_category("무언가", "하의"), "하의");
    assert_eq!(resolve_garment_category("무언가", "패딩"), "아우터");
    assert_eq!(resolve_garment_category("무언가", ""), "상의");
}

/// 공백·대소문자 차이를 무시한다
#[test]
fn normalizes_spacing_and_case() {
    assert_eq!(resolve_garment_category("BLACK SLACKS", "상의"), "하의");
    assert_eq!(resolve_garment_category("데님 팬 츠", "상의"), "하의");
}

// ---- 겹쳐 걸린 옷 이중 검출 제거용 IoU ----

#[test]
fn iou_detects_same_region() {
    assert!(box_iou((10.0, 10.0, 20.0, 40.0), (10.0, 10.0, 20.0, 40.0)) > 0.99);
    assert!(box_iou((10.0, 10.0, 20.0, 40.0), (11.0, 11.0, 20.0, 40.0)) > 0.7);
}

#[test]
fn iou_keeps_neighbouring_garments_apart() {
    // 행거에 나란히 걸린 두 벌 — 살짝 겹쳐도 별개로 남아야 한다
    assert!(box_iou((10.0, 10.0, 20.0, 40.0), (28.0, 10.0, 20.0, 40.0)) < 0.7);
    assert_eq!(box_iou((0.0, 0.0, 10.0, 10.0), (50.0, 50.0, 10.0, 10.0)), 0.0);
    assert_eq!(box_iou((0.0, 0.0, 0.0, 0.0), (0.0, 0.0, 10.0, 10.0)), 0.0);
}

/// '진'으로 끝나는 이름은 청바지다 — web/lib/garment.ts 의 resolveCategory 와 같은 규칙.
/// (모델이 '인디고 슬림 진'을 상의로 돌려줘도 하의로 교정되어야 한다)
#[test]
fn names_ending_with_jin_are_bottoms() {
    for name in ["인디고 슬림 진", "블랙진", "와이드진", "스키니진"] {
        assert_eq!(resolve_garment_category(name, "상의"), "하의", "name={name}");
    }
    // 한 글자 '진'은 옷 이름으로 보지 않는다
    assert_eq!(resolve_garment_category("진", "상의"), "상의");
    // '가디건'처럼 다른 글자로 끝나는 이름은 영향받지 않는다
    assert_eq!(resolve_garment_category("아이보리 케이블 가디건", "상의"), "니트");
}
