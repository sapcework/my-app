//! 同梱するドメイン分類データ。
//!
//! DB が空のままだと**あらゆるドメインが未分類**になる。BEGINNER は未知を BLOCK
//! するので、CDN・フォント・証明書検証まで止まり「ページが真っ白になる」形で
//! 表面化する（docs/ARCHITECTURE.md §7-1）。初期状態で使える最低限を同梱する。
//!
//! ここは**データであって判定ロジックではない**。ドメインをカテゴリに割り当てる
//! だけで、どう扱うかは Profile が決める。
//!
//! DoH 対策の中核もここにある。既知の DoH プロバイダを `doh` カテゴリに入れると、
//! DNS 層は BLOCK を NXDOMAIN として返すだけで対策が成立する。ネットワーク層に
//! 特別扱いを書かずに済む（docs/adr/0007-doh-countermeasures-in-mvp.md）。

use std::net::IpAddr;

use time::OffsetDateTime;
use uuid::Uuid;

use crate::category::CategoryId;
use crate::domain::DomainName;
use crate::record::{DomainRecord, MatchScope, RecordStatus, Source};
use crate::risk::RiskLevel;

/// 同梱ドメインの UUID を導く名前空間（ASCII で `iFilter\0Bundled\0`）。
///
/// ドメイン名から決定的に ID を作る。`init` を何度実行しても同じ ID になるので、
/// `domain` の UNIQUE 制約と衝突せずに upsert できる。
const BUNDLED_NAMESPACE: Uuid = Uuid::from_u128(0x6946_696c_7465_7200_4275_6e64_6c65_6400);

/// 同梱データの分類確信度。人手で決めた分類なので最大にする。
const BUNDLED_CONFIDENCE: f32 = 1.0;

/// (ドメイン, カテゴリ, **そのドメイン自身**のリスク)
///
/// リスクはカテゴリの既定値を流し込まず 1 件ずつ書く。混ぜるとリスク上限（6 段目）が
/// カテゴリ別ルール（7 段目）を追い越す（CLAUDE.md「リスク上限にカテゴリ由来の
/// 危険度を混ぜない」）。
type Entry = (&'static str, &'static [&'static str], RiskLevel);

/// 基盤ドメイン。単体では閲覧対象にならず、止めると他のページが壊れるもの。
const INFRASTRUCTURE: &[Entry] = &[
    // Google が配信する静的資源。fonts.gstatic.com などを含む
    ("gstatic.com", &["infrastructure"], RiskLevel::Safe),
    (
        "googleusercontent.com",
        &["infrastructure"],
        RiskLevel::Safe,
    ),
    ("gvt1.com", &["infrastructure"], RiskLevel::Safe),
    ("gvt2.com", &["infrastructure"], RiskLevel::Safe),
    ("ggpht.com", &["infrastructure"], RiskLevel::Safe),
    ("cloudflare.com", &["infrastructure"], RiskLevel::Safe),
    ("jsdelivr.net", &["infrastructure"], RiskLevel::Safe),
    ("unpkg.com", &["infrastructure"], RiskLevel::Safe),
    ("bootstrapcdn.com", &["infrastructure"], RiskLevel::Safe),
    ("typekit.net", &["infrastructure"], RiskLevel::Safe),
    // 証明書の失効確認。止めると HTTPS の接続確立そのものが遅くなる・失敗する
    ("digicert.com", &["infrastructure"], RiskLevel::Safe),
    ("globalsign.com", &["infrastructure"], RiskLevel::Safe),
    ("sectigo.com", &["infrastructure"], RiskLevel::Safe),
    ("letsencrypt.org", &["infrastructure"], RiskLevel::Safe),
    // OS・ブラウザの更新と接続性チェック。止めると Windows が「インターネットなし」と表示する
    ("windowsupdate.com", &["infrastructure"], RiskLevel::Safe),
    ("msftconnecttest.com", &["infrastructure"], RiskLevel::Safe),
    ("msftncsi.com", &["infrastructure"], RiskLevel::Safe),
    ("mozilla.net", &["infrastructure"], RiskLevel::Safe),
    // 更新の**確認**は microsoft.com 側に来る。download.windowsupdate.com だけ通しても
    // 「更新を確認できません」で止まる。microsoft.com 全体は通さない
    // （OneDrive・Teams・Xbox まで巻き込む）ので、更新に使うホストだけ個別に挙げる
    ("update.microsoft.com", &["infrastructure"], RiskLevel::Safe),
    (
        "windowsupdate.microsoft.com",
        &["infrastructure"],
        RiskLevel::Safe,
    ),
    (
        "delivery.mp.microsoft.com",
        &["infrastructure"],
        RiskLevel::Safe,
    ),
    // 時刻同期。ずれると証明書が「期限切れ」に見えて HTTPS が全部壊れる。
    // **Windows の既定は time.windows.com**。ntp.org だけでは、この最も引かれる
    // 名前が通らず、登録した意図が実現しない（eTLD+1 は windows.com で別物）
    ("ntp.org", &["infrastructure"], RiskLevel::Safe),
    ("time.windows.com", &["infrastructure"], RiskLevel::Safe),
];

/// 配下すべてに及ぶ基盤ドメイン（[`MatchScope::Suffix`]）。
///
/// これらは Public Suffix List に載っているため、通常の階層マッチでは
/// **一度もヒットしない**（`d111abc.cloudfront.net` の eTLD+1 は自分自身）。
/// しかもホスト名は顧客ごとのランダム文字列なので個別登録もできない。
///
/// 配下に任意のコンテンツを置ける点は承知のうえで許可している。ランダムな
/// ホスト名を知らないと到達できないため、「`co.jp` を許可」とは危険度が異なる
/// （docs/adr/0008-infrastructure-suffix-records.md）。
///
/// **ここに足してよいのは基盤配信専用のドメインだけ。** `blogspot.com` や
/// `github.io` のように人が読めるサブドメインを第三者が取得できるものは、
/// 同じ公開サフィックスでも足してはいけない。
const INFRASTRUCTURE_SUFFIXES: &[Entry] = &[
    ("googleapis.com", &["infrastructure"], RiskLevel::Safe),
    ("cloudflare.net", &["infrastructure"], RiskLevel::Safe),
    ("akamai.net", &["infrastructure"], RiskLevel::Safe),
    ("akamaiedge.net", &["infrastructure"], RiskLevel::Safe),
    ("akamaihd.net", &["infrastructure"], RiskLevel::Safe),
    ("akamaized.net", &["infrastructure"], RiskLevel::Safe),
    ("edgekey.net", &["infrastructure"], RiskLevel::Safe),
    ("edgesuite.net", &["infrastructure"], RiskLevel::Safe),
    ("fastly.net", &["infrastructure"], RiskLevel::Safe),
    ("fastlylb.net", &["infrastructure"], RiskLevel::Safe),
    ("cloudfront.net", &["infrastructure"], RiskLevel::Safe),
    ("azureedge.net", &["infrastructure"], RiskLevel::Safe),
    ("azurefd.net", &["infrastructure"], RiskLevel::Safe),
    // 逆引き（IP → 名前）。IANA 管理で第三者が登録できず、閲覧経路にならない。
    // 止めると OS やアプリの名前解決が無用に遅くなるだけなので通す
    ("in-addr.arpa", &["infrastructure"], RiskLevel::Safe),
    ("ip6.arpa", &["infrastructure"], RiskLevel::Safe),
];

/// 検索。SafeSearch の強制は将来の課題で、ここでは分類だけ行う。
const SEARCH: &[Entry] = &[
    ("google.com", &["search"], RiskLevel::Low),
    ("google.co.jp", &["search"], RiskLevel::Low),
    ("bing.com", &["search"], RiskLevel::Low),
    ("duckduckgo.com", &["search"], RiskLevel::Low),
];

/// 学習・辞書。BEGINNER でも許可される想定のもの。
const LEARNING: &[Entry] = &[
    ("wikipedia.org", &["reference"], RiskLevel::Low),
    ("wikimedia.org", &["reference"], RiskLevel::Low),
    ("weblio.jp", &["reference"], RiskLevel::Low),
    ("kotobank.jp", &["reference"], RiskLevel::Low),
    ("mext.go.jp", &["education"], RiskLevel::Safe),
    ("khanacademy.org", &["education"], RiskLevel::Safe),
    ("scratch.mit.edu", &["education", "kids"], RiskLevel::Safe),
    ("code.org", &["education", "kids"], RiskLevel::Safe),
];

/// DoH プロバイダと Firefox の canary ドメイン。
///
/// canary は「NXDOMAIN が返ってきたら DoH を使わない」という Firefox の規約なので、
/// BLOCK → NXDOMAIN がそのまま正しい応答になる。
///
/// IP 直打ち（`8.8.8.8` など）はここでは塞げない。DNS を経由しないため。
/// WFP（Step 11〜12）の担当。IP は [`DOH_ADDRESSES`] にある。
const DOH: &[Entry] = &[
    ("use-application-dns.net", &["doh"], RiskLevel::High),
    ("dns.google", &["doh"], RiskLevel::High),
    ("cloudflare-dns.com", &["doh"], RiskLevel::High),
    ("one.one.one.one", &["doh"], RiskLevel::High),
    ("quad9.net", &["doh"], RiskLevel::High),
    ("opendns.com", &["doh"], RiskLevel::High),
    ("nextdns.io", &["doh"], RiskLevel::High),
    ("adguard-dns.com", &["doh"], RiskLevel::High),
    ("cleanbrowsing.org", &["doh"], RiskLevel::High),
    ("controld.com", &["doh"], RiskLevel::High),
    ("dnscrypt.info", &["doh"], RiskLevel::High),
    ("doh.sb", &["doh"], RiskLevel::High),
];

/// DoH プロバイダの IP アドレス。ブラウザの DoH 設定に
/// `https://1.1.1.1/dns-query` と**数字で**書かれる形を塞ぐためのもの。
/// 名前解決が起きないので [`DOH`] のドメイン遮断では止められない（ADR-0010）。
///
/// # ここに載せてよい IP の条件
///
/// **DNS 提供専用のアドレスだけ。** 一般の Web サイトと共有している IP を
/// 載せると、無関係なサイトが巻き添えで見られなくなる。
///
/// 実際 `cloudflare-dns.com` は `1.1.1.1` ではなく `104.16.249.249`
/// （Cloudflare の**共有 CDN レンジ**）に解決される。多数の顧客サイトが同じ IP に
/// 載っているので、ここには入れない。Cloudflare の DoH は DNS 専用 anycast の
/// `1.1.1.1` 側で塞ぐ。`dns.nextdns.io` も解決先が地域ごとに変わり専用とは
/// 言えないため入れていない。
///
/// どちらもドメイン名では [`DOH`] が遮断するので、**無防備にはならない**。
/// 数字で直接指定された場合だけが抜ける。
///
/// 2026-08-16 に実測して確認した（`Resolve-DnsName`）。
type AddressEntry = (&'static str, &'static [&'static str]);
const DOH_ADDRESSES: &[AddressEntry] = &[
    (
        "Google Public DNS",
        &[
            "8.8.8.8",
            "8.8.4.4",
            "2001:4860:4860::8888",
            "2001:4860:4860::8844",
        ],
    ),
    // one.one.one.one。DNS 専用 anycast なので全ポート塞いでよい
    (
        "Cloudflare DNS",
        &[
            "1.1.1.1",
            "1.0.0.1",
            "2606:4700:4700::1111",
            "2606:4700:4700::1001",
        ],
    ),
    (
        "Quad9",
        &["9.9.9.9", "149.112.112.112", "2620:fe::fe", "2620:fe::9"],
    ),
    // doh.opendns.com 専用。従来 DNS の 208.67.222.222 とは別のアドレス
    ("Cisco OpenDNS", &["146.112.41.2", "2620:119:fc::2"]),
    (
        "AdGuard DNS",
        &[
            "94.140.14.14",
            "94.140.15.15",
            "2a10:50c0::ad1:ff",
            "2a10:50c0::ad2:ff",
        ],
    ),
    // AAAA を持たない
    ("CleanBrowsing", &["185.228.168.168", "185.228.168.10"]),
    (
        "DNS.SB",
        &["185.222.222.222", "45.11.45.11", "2a09::", "2a11::"],
    ),
];

/// 塞ぐべき DoH プロバイダの IP を返す。
///
/// ネットワーク層（Windows なら `windows/wfp`）が「どう塞ぐか」を担当する。
/// ここは**データを返すだけ**で、OS API には触れない（ADR-0001）。
///
/// ```
/// use domain_model::bundled_doh_addresses;
///
/// let addresses = bundled_doh_addresses();
/// assert!(addresses.iter().any(|ip| ip.to_string() == "1.1.1.1"));
/// ```
pub fn bundled_doh_addresses() -> Vec<IpAddr> {
    DOH_ADDRESSES
        .iter()
        .flat_map(|(_, addresses)| addresses.iter())
        .map(|raw| raw.parse().expect("同梱の DoH アドレスは妥当"))
        .collect()
}

/// 同梱データ全体を照合範囲つきで返す。
fn entries() -> impl Iterator<Item = (&'static Entry, MatchScope)> {
    INFRASTRUCTURE
        .iter()
        .chain(SEARCH)
        .chain(LEARNING)
        .chain(DOH)
        .map(|entry| (entry, MatchScope::Domain))
        .chain(
            INFRASTRUCTURE_SUFFIXES
                .iter()
                .map(|entry| (entry, MatchScope::Suffix)),
        )
}

/// 同梱ドメインを [`DomainRecord`] にして返す。
///
/// `at` は作成・更新時刻として入る。時刻を取得しないのがこの crate の制約
/// （docs/adr/0001-policy-engine-network-separation.md）。
///
/// ```
/// use domain_model::bundled_records;
/// use time::OffsetDateTime;
///
/// let records = bundled_records(OffsetDateTime::UNIX_EPOCH);
/// // 同じ入力なら ID も同じ。init を繰り返しても行が増えない
/// assert_eq!(records[0].id, bundled_records(OffsetDateTime::UNIX_EPOCH)[0].id);
/// ```
pub fn bundled_records(at: OffsetDateTime) -> Vec<DomainRecord> {
    entries()
        .map(|((domain, categories, risk_level), scope)| {
            let domain = DomainName::parse(domain).expect("同梱ドメインは妥当");
            DomainRecord {
                id: Uuid::new_v5(&BUNDLED_NAMESPACE, domain.as_str().as_bytes()),
                domain,
                categories: categories
                    .iter()
                    .map(|c| CategoryId::parse(c).expect("同梱カテゴリの ID は妥当"))
                    .collect(),
                risk_level: *risk_level,
                confidence: BUNDLED_CONFIDENCE,
                source: Source::Bundled,
                status: RecordStatus::Active,
                scope,
                version: 1,
                created_at: at,
                updated_at: at,
                deleted_at: None,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::*;
    use crate::category::CategoryRegistry;
    use crate::decision::Decision;
    use crate::profile::Profile;

    fn records() -> Vec<DomainRecord> {
        bundled_records(OffsetDateTime::UNIX_EPOCH)
    }

    #[test]
    fn doh_の_ip_はすべて解釈できる() {
        // parse に expect を使っているので、書き間違いはここで落とす
        assert!(!bundled_doh_addresses().is_empty());
    }

    #[test]
    fn doh_の_ip_に重複がない() {
        let addresses = bundled_doh_addresses();
        let unique: HashSet<_> = addresses.iter().collect();
        assert_eq!(
            unique.len(),
            addresses.len(),
            "同じ IP を 2 回塞ごうとしている"
        );
    }

    #[test]
    fn doh_の_ip_に自分の側のアドレスを混ぜない() {
        // ループバックやプライベート IP を塞ぐと、LAN のプリンタ・NAS や
        // iFilter 自身の 127.0.0.1:53 まで止まる。**PC が壊れたように見える**
        for ip in bundled_doh_addresses() {
            assert!(!ip.is_loopback(), "{ip} はループバック");
            assert!(!ip.is_unspecified(), "{ip} は未指定アドレス");
            assert!(!ip.is_multicast(), "{ip} はマルチキャスト");
            if let IpAddr::V4(v4) = ip {
                assert!(!v4.is_private(), "{ip} はプライベート IP");
                assert!(!v4.is_link_local(), "{ip} はリンクローカル");
            }
        }
    }

    #[test]
    fn doh_の_ip_は_v4_と_v6_の両方を持つ() {
        // v4 だけ塞いでも、主要プロバイダはどこも v6 を持っているので抜けられる
        let addresses = bundled_doh_addresses();
        assert!(addresses.iter().any(IpAddr::is_ipv4));
        assert!(addresses.iter().any(IpAddr::is_ipv6));
    }

    #[test]
    fn 共有_cdn_の_ip_を塞がない() {
        // cloudflare-dns.com は 1.1.1.1 ではなく Cloudflare の共有 CDN レンジに
        // 解決される。塞ぐと無関係の顧客サイトが巻き添えになる（ADR-0010）
        for ip in bundled_doh_addresses() {
            let IpAddr::V4(v4) = ip else { continue };
            let [a, b, ..] = v4.octets();
            assert!(
                !(a == 104 && (16..=31).contains(&b)),
                "{ip} は Cloudflare の共有 CDN レンジ"
            );
        }
    }

    #[test]
    fn すべてのドメインが解釈できる() {
        assert_eq!(records().len(), entries().count()); // parse で panic しない
    }

    #[test]
    fn ドメインが重複していない() {
        let records = records();
        let unique: HashSet<_> = records.iter().map(|r| r.domain.clone()).collect();
        assert_eq!(unique.len(), records.len(), "同じドメインが 2 回入っている");
    }

    #[test]
    fn id_はドメインから決定的に決まる() {
        // init を繰り返しても行が重複しないことの根拠
        let first = records();
        let second = bundled_records(OffsetDateTime::from_unix_timestamp(1_000_000).expect("妥当"));
        for (a, b) in first.iter().zip(&second) {
            assert_eq!(a.id, b.id, "{} の ID が実行ごとに変わる", a.domain);
        }
    }

    #[test]
    fn 未登録のカテゴリを使っていない() {
        let registry = CategoryRegistry::builtin();
        for record in records() {
            for category in &record.categories {
                assert!(
                    registry.get(category).is_some(),
                    "{} が未登録のカテゴリ {category} を使っている",
                    record.domain
                );
            }
        }
    }

    #[test]
    fn 公開サフィックスは_suffix_スコープでしか登録しない() {
        // Domain スコープで公開サフィックスを登録しても `match_candidates` が空になり、
        // 配下のドメインには**一度もヒットしない**。同梱した意味がなくなる
        let offenders: Vec<_> = records()
            .into_iter()
            .filter(|r| r.scope == MatchScope::Domain && !r.domain.is_registrable())
            .map(|r| r.domain.to_string())
            .collect();
        assert!(
            offenders.is_empty(),
            "公開サフィックスを Domain スコープで登録している: {}",
            offenders.join(", ")
        );
    }

    #[test]
    fn suffix_スコープは基盤カテゴリだけ() {
        // 配下すべてに及ぶ強い設定なので、対象を基盤配信に限る。
        // adult や search をサフィックスで登録すると影響範囲が読めなくなる
        let infrastructure = CategoryId::parse("infrastructure").expect("妥当");
        for record in records() {
            if record.scope == MatchScope::Suffix {
                assert_eq!(
                    record.categories,
                    vec![infrastructure.clone()],
                    "{} が infrastructure 以外で Suffix スコープになっている",
                    record.domain
                );
            }
        }
    }

    #[test]
    fn 分類済みとして扱われる() {
        // unknown だけのレコードがあると未知扱いに落ちて同梱した意味がなくなる
        for record in records() {
            assert!(!record.is_unclassified(), "{} が未分類扱い", record.domain);
        }
    }

    #[test]
    fn doh_はすべてのプロファイルで_block() {
        // 1 つでも通ると DNS フィルターごと素通りされる
        let doh = CategoryId::parse("doh").expect("妥当");
        for profile in [
            Profile::beginner(),
            Profile::beginner_plus(),
            Profile::standard(),
            Profile::teen(),
        ] {
            assert_eq!(
                profile.category_rule(&doh),
                Some(Decision::Block),
                "{} で doh が BLOCK になっていない",
                profile.id
            );
        }
    }

    #[test]
    fn firefox_の_canary_ドメインが入っている() {
        // これが無いと Firefox は既定で DoH を有効にし、DNS フィルターに何も届かない
        let canary = DomainName::parse("use-application-dns.net").expect("妥当");
        let record = records()
            .into_iter()
            .find(|r| r.domain == canary)
            .expect("canary ドメインが同梱されていない");
        assert!(
            record
                .categories
                .contains(&CategoryId::parse("doh").expect("妥当"))
        );
    }

    #[test]
    fn 基盤ドメインは_beginner_のリスク上限を超えない() {
        // 超えるとリスク上限（6 段目）で BLOCK され、カテゴリ Allow に到達しない
        let ceiling = Profile::beginner().risk_ceiling;
        let infrastructure = CategoryId::parse("infrastructure").expect("妥当");
        for record in records() {
            if record.categories.contains(&infrastructure) {
                assert!(
                    !record.risk_level.exceeds(ceiling),
                    "{} のリスクが BEGINNER の上限を超えている",
                    record.domain
                );
            }
        }
    }
}
