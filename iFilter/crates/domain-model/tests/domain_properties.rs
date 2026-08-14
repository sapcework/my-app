//! TEST_PLAN.md §1-7: ドメイン名のプロパティテスト。

use domain_model::DomainName;
use proptest::prelude::*;

/// パースできるドメイン名を生成する。
fn arb_domain() -> impl Strategy<Value = String> {
    (
        prop::collection::vec("[a-z][a-z0-9]{0,7}", 1..5),
        prop::sample::select(vec!["com", "jp", "net", "co.jp", "example"]),
    )
        .prop_map(|(labels, tld)| format!("{}.{tld}", labels.join(".")))
}

/// 大文字・末尾ドット・空白を混ぜた表記ゆれを作る。
fn arb_messy_domain() -> impl Strategy<Value = (String, String)> {
    (arb_domain(), any::<bool>(), any::<bool>()).prop_map(|(domain, upper, trailing_dot)| {
        let mut messy = if upper {
            domain.to_uppercase()
        } else {
            domain.clone()
        };
        if trailing_dot {
            messy.push('.');
        }
        (domain, format!("  {messy}  "))
    })
}

/// 反例の保存先。統合テストは lib.rs を持たないため、明示しないと警告が出る。
fn config() -> ProptestConfig {
    ProptestConfig {
        failure_persistence: Some(Box::new(
            proptest::test_runner::FileFailurePersistence::Direct(
                "tests/proptest-regressions/domain_properties.txt",
            ),
        )),
        ..ProptestConfig::default()
    }
}

proptest! {
    #![proptest_config(config())]

    /// 正規化は冪等。二度通しても結果が変わらない。
    #[test]
    fn パースは冪等(input in arb_domain()) {
        let once = DomainName::parse(&input).expect("生成したドメインはパースできる");
        let twice = DomainName::parse(once.as_str()).expect("正規化済みも再パースできる");
        prop_assert_eq!(once, twice);
    }

    /// 表記ゆれは同じ値に正規化される。
    #[test]
    fn 表記ゆれを吸収する((canonical, messy) in arb_messy_domain()) {
        let a = DomainName::parse(&canonical).expect("パースできる");
        let b = DomainName::parse(&messy).expect("パースできる");
        prop_assert_eq!(a, b);
    }

    /// 自分自身は必ず自分のサブドメイン（同一を含む）。
    #[test]
    fn 自分自身との包含関係(input in arb_domain()) {
        let domain = DomainName::parse(&input).expect("パースできる");
        if domain.is_registrable() {
            prop_assert!(domain.is_subdomain_of(&domain));
        }
    }

    /// 照合候補は必ず自分自身から始まり、eTLD+1 で終わる。
    #[test]
    fn 照合候補の両端(input in arb_domain()) {
        let domain = DomainName::parse(&input).expect("パースできる");
        let candidates = domain.match_candidates();

        if let Some(registrable) = domain.registrable() {
            prop_assert_eq!(candidates.first(), Some(&domain));
            prop_assert_eq!(candidates.last(), Some(&registrable));
        } else {
            prop_assert!(candidates.is_empty());
        }
    }

    /// 照合候補はすべて自分自身の親（または自分）である。
    #[test]
    fn 照合候補はすべて親ドメイン(input in arb_domain()) {
        let domain = DomainName::parse(&input).expect("パースできる");
        for candidate in domain.match_candidates() {
            prop_assert!(
                domain.is_subdomain_of(&candidate),
                "{} は {} の子孫ではない",
                domain,
                candidate
            );
        }
    }

    /// 候補は長い順（＝具体的な順）に並ぶ。
    #[test]
    fn 照合候補は長い順(input in arb_domain()) {
        let domain = DomainName::parse(&input).expect("パースできる");
        let candidates = domain.match_candidates();
        for pair in candidates.windows(2) {
            prop_assert!(
                pair[0].as_str().len() > pair[1].as_str().len(),
                "候補が長い順に並んでいない: {:?}",
                candidates
            );
        }
    }
}
