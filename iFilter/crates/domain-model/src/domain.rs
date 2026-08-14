//! ドメイン名の正規化と階層マッチ。
//!
//! ここは判定の入口であり、**実装で最も事故が起きやすい箇所**。
//! 規則の根拠は docs/adr/0006-domain-matching-and-categories.md を参照。

use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

const MAX_DOMAIN_LEN: usize = 253; // RFC 1035。表現形式での上限
const MAX_LABEL_LEN: usize = 63;

/// 正規化済みのドメイン名。
///
/// 小文字・末尾ドットなし・IDN は punycode（A-label）に統一済みであることが保証される。
/// 生の文字列から直接作ることはできず、必ず [`DomainName::parse`] を通す。
/// serde でのデシリアライズも同じ検証を通るため、DB や JSON から読んだ値も正規化済み。
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct DomainName(String);

/// ドメイン名のパースに失敗した理由。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DomainParseError {
    Empty,
    TooLong(usize),
    EmptyLabel,
    LabelTooLong(String),
    InvalidCharacter(char),
    HyphenAtLabelEdge(String),
    Idna,
}

impl fmt::Display for DomainParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Empty => write!(f, "ドメイン名が空です"),
            Self::TooLong(len) => write!(
                f,
                "ドメイン名が長すぎます（{len} バイト > {MAX_DOMAIN_LEN}）"
            ),
            Self::EmptyLabel => write!(f, "空のラベルが含まれています（例: a..com）"),
            Self::LabelTooLong(label) => {
                write!(
                    f,
                    "ラベルが長すぎます（{} バイト > {MAX_LABEL_LEN}）: {label}",
                    label.len()
                )
            }
            Self::InvalidCharacter(c) => write!(f, "ドメイン名に使えない文字です: {c:?}"),
            Self::HyphenAtLabelEdge(label) => {
                write!(f, "ラベルの先頭または末尾がハイフンです: {label}")
            }
            Self::Idna => write!(f, "IDN を punycode に変換できませんでした"),
        }
    }
}

impl std::error::Error for DomainParseError {}

impl DomainName {
    /// 文字列を正規化して `DomainName` を作る。
    ///
    /// 正規化の内容: 前後の空白除去 / 末尾ドット除去 / 小文字化 /
    /// IDN の punycode 変換 / 長さとラベルの検証。
    pub fn parse(input: &str) -> Result<Self, DomainParseError> {
        let trimmed = input.trim();
        let trimmed = trimmed.strip_suffix('.').unwrap_or(trimmed); // `example.com.` と `example.com` は同一
        if trimmed.is_empty() {
            return Err(DomainParseError::Empty);
        }

        let ascii = if trimmed.is_ascii() {
            trimmed.to_ascii_lowercase()
        } else {
            idna::domain_to_ascii(trimmed).map_err(|_| DomainParseError::Idna)? // 見た目が同じ別ドメインを別物として扱う
        };

        validate(&ascii)?;
        Ok(Self(ascii))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// eTLD+1（登録可能ドメイン）を返す。`co.jp` のような公開サフィックス自体には存在しない。
    pub fn registrable(&self) -> Option<Self> {
        psl::domain_str(&self.0).map(|d| Self(d.to_owned()))
    }

    /// Allowlist / Blocklist に登録してよいドメインか。
    ///
    /// `co.jp` や `jp` のような公開サフィックスは `false`。これを許すと
    /// 「co.jp を許可」で日本のほぼ全ドメインが通ってしまう。
    pub fn is_registrable(&self) -> bool {
        psl::domain_str(&self.0).is_some()
    }

    /// 判定時に照合するドメインを、**長い順**（具体的な順）に返す。
    ///
    /// `www.a.example.co.jp` なら
    /// `www.a.example.co.jp` → `a.example.co.jp` → `example.co.jp` の 3 件。
    /// **`co.jp` や `jp` へは降りない。**
    pub fn match_candidates(&self) -> Vec<Self> {
        let Some(registrable) = psl::domain_str(&self.0) else {
            return Vec::new(); // 公開サフィックスそのもの。照合対象にしない
        };

        let mut out = Vec::new();
        let mut current: &str = &self.0;
        loop {
            out.push(Self(current.to_owned()));
            if current == registrable {
                break; // eTLD+1 に到達したら打ち切る
            }
            match current.split_once('.') {
                Some((_, rest)) => current = rest,
                None => break,
            }
        }
        out
    }

    /// 自身が `other` と同一、または `other` のサブドメインか。
    ///
    /// 比較は**ラベル境界**で行う。`ends_with` による部分文字列一致にすると
    /// `example.com` の登録が `notexample.com` にヒットしてしまう。
    pub fn is_subdomain_of(&self, other: &Self) -> bool {
        if !other.is_registrable() {
            return false; // 公開サフィックス配下すべてに及ぶ照合は禁止
        }
        self.is_within(other)
    }

    /// 自身が `suffix` と同一、または `suffix` 配下か。**公開サフィックスも対象にできる。**
    ///
    /// [`Self::is_subdomain_of`] との違いは `co.jp` や `cloudfront.net` を渡せる点。
    /// 1 件で配下すべてに及ぶため、**保護者の Allowlist には使ってはいけない**
    /// （「`co.jp` を許可」で日本のほぼ全ドメインが通る）。用途は同梱の基盤ドメインだけで、
    /// [`crate::record::MatchScope::Suffix`] のレコードからのみ到達する
    /// （docs/adr/0008-infrastructure-suffix-records.md）。
    ///
    /// 比較はラベル境界で行う。`ends_with` だと `notexample.com` が
    /// `example.com` にヒットしてしまう。
    pub fn is_within(&self, suffix: &Self) -> bool {
        if self.0 == suffix.0 {
            return true;
        }
        let (s, o) = (self.0.as_str(), suffix.0.as_str());
        s.len() > o.len() && s.ends_with(o) && s.as_bytes()[s.len() - o.len() - 1] == b'.'
    }
}

fn validate(s: &str) -> Result<(), DomainParseError> {
    if s.len() > MAX_DOMAIN_LEN {
        return Err(DomainParseError::TooLong(s.len()));
    }
    for label in s.split('.') {
        if label.is_empty() {
            return Err(DomainParseError::EmptyLabel);
        }
        if label.len() > MAX_LABEL_LEN {
            return Err(DomainParseError::LabelTooLong(label.to_owned()));
        }
        if label.starts_with('-') || label.ends_with('-') {
            return Err(DomainParseError::HyphenAtLabelEdge(label.to_owned()));
        }
        for c in label.chars() {
            // `_` は `_dmarc` のような DNS 名で実在するため許可する
            if !(c.is_ascii_alphanumeric() || c == '-' || c == '_') {
                return Err(DomainParseError::InvalidCharacter(c));
            }
        }
    }
    Ok(())
}

impl fmt::Display for DomainName {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl FromStr for DomainName {
    type Err = DomainParseError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::parse(s)
    }
}

impl TryFrom<String> for DomainName {
    type Error = DomainParseError;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::parse(&value)
    }
}

impl From<DomainName> for String {
    fn from(value: DomainName) -> Self {
        value.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(s: &str) -> DomainName {
        DomainName::parse(s).expect("パースできるはず")
    }

    #[test]
    fn 正規化される() {
        assert_eq!(d("EXAMPLE.COM").as_str(), "example.com");
        assert_eq!(d("example.com.").as_str(), "example.com");
        assert_eq!(d("  example.com  ").as_str(), "example.com");
        assert_eq!(d("WwW.Example.Com.").as_str(), "www.example.com");
    }

    #[test]
    fn idn_は_punycode_に統一される() {
        let idn = d("日本.jp");
        assert_eq!(idn.as_str(), "xn--wgv71a.jp");
        assert_eq!(idn, d("xn--wgv71a.jp")); // A-label 登録と一致する
    }

    #[test]
    fn パースの冪等性() {
        for input in ["Example.COM.", "日本.jp", "a-b.example.co.jp"] {
            let once = d(input);
            let twice = d(once.as_str());
            assert_eq!(once, twice);
        }
    }

    #[test]
    fn 不正な入力は拒否される() {
        assert_eq!(DomainName::parse(""), Err(DomainParseError::Empty));
        assert_eq!(DomainName::parse("   "), Err(DomainParseError::Empty));
        assert_eq!(
            DomainName::parse("a..com"),
            Err(DomainParseError::EmptyLabel)
        );
        assert!(matches!(
            DomainName::parse("-bad.com"),
            Err(DomainParseError::HyphenAtLabelEdge(_))
        ));
        assert!(matches!(
            DomainName::parse("bad-.com"),
            Err(DomainParseError::HyphenAtLabelEdge(_))
        ));
        assert!(matches!(
            DomainName::parse("ex ample.com"),
            Err(DomainParseError::InvalidCharacter(' '))
        ));

        let long_label = "a".repeat(64);
        assert!(matches!(
            DomainName::parse(&format!("{long_label}.com")),
            Err(DomainParseError::LabelTooLong(_))
        ));

        let long_domain = std::iter::repeat_n("abcdefgh", 40)
            .collect::<Vec<_>>()
            .join(".");
        assert!(matches!(
            DomainName::parse(&long_domain),
            Err(DomainParseError::TooLong(_))
        ));
    }

    #[test]
    fn アンダースコアを含む名前は許可する() {
        assert_eq!(d("_dmarc.example.com").as_str(), "_dmarc.example.com");
    }

    #[test]
    fn 公開サフィックスは登録できない() {
        assert!(!d("co.jp").is_registrable());
        assert!(!d("jp").is_registrable());
        assert!(!d("com").is_registrable());
        assert!(d("example.co.jp").is_registrable());
        assert!(d("www.example.co.jp").is_registrable());
    }

    #[test]
    fn 階層マッチは_etld_で止まる() {
        let candidates = d("www.a.example.co.jp").match_candidates();
        let as_str: Vec<&str> = candidates.iter().map(DomainName::as_str).collect();
        assert_eq!(
            as_str,
            vec!["www.a.example.co.jp", "a.example.co.jp", "example.co.jp"]
        );

        // co.jp や jp が含まれていないこと（含まれると日本の全ドメインが通る）
        assert!(!as_str.contains(&"co.jp"));
        assert!(!as_str.contains(&"jp"));
    }

    #[test]
    fn 公開サフィックス自体には照合候補が無い() {
        assert!(d("co.jp").match_candidates().is_empty());
        assert!(d("com").match_candidates().is_empty());
    }

    #[test]
    fn 未知の_tld_でも_etld_plus1_として扱える() {
        let candidates = d("www.example.invalidtld").match_candidates();
        let as_str: Vec<&str> = candidates.iter().map(DomainName::as_str).collect();
        assert_eq!(as_str, vec!["www.example.invalidtld", "example.invalidtld"]);
    }

    #[test]
    fn サブドメイン判定はラベル境界で行う() {
        assert!(d("www.example.com").is_subdomain_of(&d("example.com")));
        assert!(d("example.com").is_subdomain_of(&d("example.com")));
        assert!(d("a.b.example.com").is_subdomain_of(&d("example.com")));

        // ends_with で書くと通ってしまう典型的なバグ
        assert!(!d("notexample.com").is_subdomain_of(&d("example.com")));
        assert!(!d("example.com").is_subdomain_of(&d("www.example.com")));
    }

    #[test]
    fn 公開サフィックスを親にしたサブドメイン判定は常に偽() {
        assert!(!d("example.co.jp").is_subdomain_of(&d("co.jp")));
    }

    #[test]
    fn serde_を通しても正規化される() {
        let parsed: DomainName = serde_json::from_str("\"EXAMPLE.COM.\"").expect("読める");
        assert_eq!(parsed.as_str(), "example.com");

        let bad = serde_json::from_str::<DomainName>("\"a..com\"");
        assert!(bad.is_err(), "不正な値は読み込み時点で弾く");
    }
}
