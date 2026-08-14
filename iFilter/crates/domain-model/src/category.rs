//! カテゴリ。
//!
//! `enum` にせず文字列 ID にしてある。カテゴリは後から追加される前提で、
//! 追加にコード変更もアプリ更新も要らないようにするため
//! （docs/adr/0006-domain-matching-and-categories.md）。

use std::collections::BTreeMap;
use std::fmt;

use serde::{Deserialize, Serialize};

use crate::risk::RiskLevel;

/// カテゴリ ID。`[a-z0-9_]` のみからなる。
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct CategoryId(String);

/// カテゴリ ID として不正な文字列だった。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InvalidCategoryId(pub String);

impl fmt::Display for InvalidCategoryId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "カテゴリ ID として不正です（[a-z0-9_] のみ）: {}",
            self.0
        )
    }
}

impl std::error::Error for InvalidCategoryId {}

impl CategoryId {
    pub fn parse(input: &str) -> Result<Self, InvalidCategoryId> {
        let id = input.trim().to_ascii_lowercase();
        let valid = !id.is_empty()
            && id
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_');
        if valid {
            Ok(Self(id))
        } else {
            Err(InvalidCategoryId(input.to_owned()))
        }
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// 情報がないドメインに割り当てるカテゴリ。
    pub fn unknown() -> Self {
        Self("unknown".to_owned())
    }
}

impl fmt::Display for CategoryId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl TryFrom<String> for CategoryId {
    type Error = InvalidCategoryId;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::parse(&value)
    }
}

impl From<CategoryId> for String {
    fn from(value: CategoryId) -> Self {
        value.0
    }
}

/// カテゴリの付随情報。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CategoryInfo {
    pub id: CategoryId,
    pub display_name: String,
    pub default_risk: RiskLevel,
}

/// カテゴリ ID → 付随情報の対応表。
///
/// MVP では [`CategoryRegistry::builtin`] を使うが、実運用では DB から読む。
/// カテゴリの追加が設定変更だけで済むようにするため。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct CategoryRegistry {
    entries: BTreeMap<CategoryId, CategoryInfo>,
}

impl CategoryRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&mut self, info: CategoryInfo) {
        self.entries.insert(info.id.clone(), info);
    }

    pub fn get(&self, id: &CategoryId) -> Option<&CategoryInfo> {
        self.entries.get(id)
    }

    /// 未登録のカテゴリは `Unknown` を返す。安全側に倒すため。
    pub fn default_risk(&self, id: &CategoryId) -> RiskLevel {
        self.get(id)
            .map_or(RiskLevel::Unknown, |info| info.default_risk)
    }

    pub fn iter(&self) -> impl Iterator<Item = &CategoryInfo> {
        self.entries.values()
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// 同梱の初期カテゴリ。
    pub fn builtin() -> Self {
        use RiskLevel::{Critical, High, Low, Medium, Safe, Unknown};

        // (id, 表示名, 既定リスク)
        const BUILTIN: &[(&str, &str, RiskLevel)] = &[
            ("education", "学習", Safe),
            ("kids", "子供向け", Safe),
            ("reference", "辞書・百科事典", Safe),
            ("search", "検索", Low),
            // 単体では閲覧対象にならない基盤ドメイン（CDN・フォント・OCSP など）。
            // これが無いと、許可したページが部品の BLOCK で崩れる（ARCHITECTURE.md §7-1）
            ("infrastructure", "基盤・配信", Safe),
            ("news", "ニュース", Low),
            ("video", "動画", Medium),
            ("gaming", "ゲーム", Medium),
            ("shopping", "買い物", Medium),
            ("social", "SNS", High),
            ("forum", "掲示板", High),
            ("chat", "チャット", High),
            ("dating", "出会い系", Critical),
            ("adult", "成人向け", Critical),
            ("gambling", "ギャンブル", High),
            ("violence", "暴力", High),
            ("drugs", "薬物", High),
            ("weapons", "武器", High),
            ("self_harm", "自傷", Critical),
            ("malware", "マルウェア", Critical),
            ("phishing", "フィッシング", Critical),
            ("fraud", "詐欺", Critical),
            ("piracy", "著作権侵害", High),
            ("unknown", "未分類", Unknown),
        ];

        let mut registry = Self::new();
        for (id, display_name, default_risk) in BUILTIN {
            registry.insert(CategoryInfo {
                id: CategoryId::parse(id).expect("同梱カテゴリの ID は妥当"),
                display_name: (*display_name).to_owned(),
                default_risk: *default_risk,
            });
        }
        registry
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn id_の検証() {
        assert_eq!(
            CategoryId::parse("self_harm").expect("妥当").as_str(),
            "self_harm"
        );
        assert_eq!(CategoryId::parse("ADULT").expect("妥当").as_str(), "adult"); // 小文字化する
        assert!(CategoryId::parse("").is_err());
        assert!(CategoryId::parse("self-harm").is_err()); // ハイフンは使わない
        assert!(CategoryId::parse("成人").is_err());
    }

    #[test]
    fn 同梱カテゴリが揃っている() {
        let registry = CategoryRegistry::builtin();
        assert_eq!(registry.len(), 24); // 指示書 9 の 23 種 + infrastructure

        for id in [
            "education",
            "kids",
            "adult",
            "malware",
            "unknown",
            "infrastructure",
        ] {
            let id = CategoryId::parse(id).expect("妥当");
            assert!(registry.get(&id).is_some(), "{id} が同梱されていない");
        }
    }

    #[test]
    fn 未登録カテゴリのリスクは_unknown() {
        let registry = CategoryRegistry::builtin();
        let unlisted = CategoryId::parse("brand_new_category").expect("妥当");
        assert_eq!(registry.default_risk(&unlisted), RiskLevel::Unknown);
    }

    #[test]
    fn カテゴリは後から追加できる() {
        let mut registry = CategoryRegistry::builtin();
        registry.insert(CategoryInfo {
            id: CategoryId::parse("crypto").expect("妥当"),
            display_name: "暗号資産".to_owned(),
            default_risk: RiskLevel::High,
        });
        let id = CategoryId::parse("crypto").expect("妥当");
        assert_eq!(registry.default_risk(&id), RiskLevel::High);
    }
}
