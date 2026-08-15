//! 指定した IP への接続を Windows Filtering Platform で塞ぐ。
//!
//! DNS 層をすり抜ける経路をここで塞ぐ。ブラウザの DoH 設定に
//! `https://1.1.1.1/dns-query` と**数字で**書かれると名前解決が起きないため、
//! ドメイン名の遮断では止められない（docs/adr/0010-wfp-user-mode-doh-ip-block.md）。
//!
//! **判定は一切しない。** 塞ぐ相手は `domain-model` の同梱データが決め、ここは
//! 受け取った IP を実現するだけ（docs/adr/0001-policy-engine-network-separation.md）。
//!
//! # 設計上の要点
//!
//! - **ユーザーモードの ALE レイヤ**を使う。パケット本体を触らないので
//!   カーネル callout ドライバも WDK も要らない
//! - **v4 と v6 の両方**に入れる。主要な DoH プロバイダはどこも v6 を持っており、
//!   片方だけでは残った側でそのまま抜けられる
//! - **動的セッション**で開く。プロセスが死ねばフィルタも消える。静的に登録すると、
//!   異常終了したときに通信が塞がったまま残り、**保護者が復旧できない**。
//!   子供の PC がネットに繋がらず原因も見えない状態は、遮断漏れより重い事故になる

#![allow(unsafe_code)] // 生の Win32 API を呼ぶため。ラッパーの外へは unsafe を出さない

use std::fmt;
use std::net::IpAddr;

use windows::Win32::Foundation::HANDLE;
use windows::Win32::NetworkManagement::WindowsFilteringPlatform::*;
use windows::Win32::System::Rpc::RPC_C_AUTHN_DEFAULT;
use windows::core::{PWSTR, w};

/// WFP の操作に失敗した。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WfpError {
    /// どの操作で失敗したか。
    pub operation: &'static str,
    /// Win32 のエラーコード。
    pub code: u32,
}

/// 管理者権限が無いときに返るコード。
const ERROR_ACCESS_DENIED: u32 = 5;

impl fmt::Display for WfpError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let WfpError { operation, code } = self;
        if *code == ERROR_ACCESS_DENIED {
            // 権限不足は運用でいちばん起きやすい。原因が分かる形で出す
            write!(f, "{operation} に失敗しました（管理者権限が必要です）")
        } else {
            write!(
                f,
                "{operation} に失敗しました（コード {code} / 0x{code:08X}）"
            )
        }
    }
}

impl std::error::Error for WfpError {}

type Result<T> = std::result::Result<T, WfpError>;

/// 塞いでいる間だけ生きるハンドル。
///
/// 落とすとフィルタも消える（動的セッション）。**意図的にそうしてある**ので、
/// 塞ぎ続けたい間は保持し続けること。
pub struct AddressBlocker {
    engine: HANDLE,
    /// 実際に入れたフィルタの数。v4/v6 で 1 IP につき 1 つ。
    filters: usize,
}

impl AddressBlocker {
    /// 指定した IP への外向き接続を塞ぐ。
    ///
    /// 管理者権限が要る（エンジンを開くだけなら不要だが、フィルタの追加で
    /// `ERROR_ACCESS_DENIED` になる）。
    ///
    /// 空のリストを渡した場合もエンジンは開く。呼ぶ側で分岐させないため。
    pub fn block(addresses: &[IpAddr]) -> Result<Self> {
        let engine = open_engine()?;
        let mut blocker = Self { engine, filters: 0 };

        for address in addresses {
            // 1 件でも失敗したら、それまでに入れたぶんごと畳む。
            // 中途半端に効いている状態は「塞げているつもり」になって危ない
            blocker.add_filter(*address)?;
            blocker.filters += 1;
        }

        Ok(blocker)
    }

    /// 実際に入れたフィルタの数。
    pub fn filter_count(&self) -> usize {
        self.filters
    }

    fn add_filter(&self, address: IpAddr) -> Result<()> {
        let value = ConditionValue::new(address);
        let condition = FWPM_FILTER_CONDITION0 {
            fieldKey: FWPM_CONDITION_IP_REMOTE_ADDRESS,
            matchType: FWP_MATCH_EQUAL,
            conditionValue: value.as_condition_value(),
        };

        let filter = FWPM_FILTER0 {
            displayData: FWPM_DISPLAY_DATA0 {
                name: PWSTR(w!("iFilter: DoH プロバイダへの接続を遮断").as_ptr() as *mut u16),
                description: PWSTR::null(),
            },
            layerKey: layer_for(address),
            subLayerKey: FWPM_SUBLAYER_UNIVERSAL,
            weight: FWP_VALUE0 {
                r#type: FWP_EMPTY, // 重みは WFP に決めさせる
                ..Default::default()
            },
            numFilterConditions: 1,
            filterCondition: &raw const condition as *mut _,
            action: FWPM_ACTION0 {
                r#type: FWP_ACTION_BLOCK,
                ..Default::default()
            },
            ..Default::default()
        };

        // SAFETY: engine は open_engine が返した有効なハンドル。filter と condition は
        // この呼び出しのあいだ生きており、WFP は中身を複製して保持する
        let code = unsafe { FwpmFilterAdd0(self.engine, &raw const filter, None, None) };
        if code == 0 {
            Ok(())
        } else {
            Err(WfpError {
                operation: "遮断フィルタの追加",
                code,
            })
        }
    }
}

impl Drop for AddressBlocker {
    fn drop(&mut self) {
        // 動的セッションなので、閉じた時点でフィルタも消える。
        // 失敗しても伝える相手がいないため無視する
        // SAFETY: engine は open_engine が返した有効なハンドルで、閉じるのは 1 回だけ
        unsafe {
            let _ = FwpmEngineClose0(self.engine);
        }
    }
}

/// 動的セッションでエンジンを開く。
fn open_engine() -> Result<HANDLE> {
    let session = FWPM_SESSION0 {
        // プロセスが死んだらフィルタも消えてほしい。ADR-0010 の中心的な決定
        flags: FWPM_SESSION_FLAG_DYNAMIC,
        ..Default::default()
    };

    let mut engine = HANDLE::default();
    // SAFETY: session はこの呼び出しのあいだ生きている。engine は書き込み先として渡す
    let code = unsafe {
        FwpmEngineOpen0(
            None, // ローカルの WFP エンジン
            RPC_C_AUTHN_DEFAULT as u32,
            None,
            Some(&raw const session),
            &raw mut engine,
        )
    };

    if code == 0 {
        Ok(engine)
    } else {
        Err(WfpError {
            operation: "WFP エンジンの接続",
            code,
        })
    }
}

/// アドレス種別に応じた ALE レイヤ。
///
/// **両方に入れないと片方で抜けられる。**
fn layer_for(address: IpAddr) -> windows::core::GUID {
    match address {
        IpAddr::V4(_) => FWPM_LAYER_ALE_AUTH_CONNECT_V4,
        IpAddr::V6(_) => FWPM_LAYER_ALE_AUTH_CONNECT_V6,
    }
}

/// 条件値と、それが指すデータの持ち主。
///
/// v6 は 16 バイト配列への**ポインタ**を条件に渡すので、実体を借用が切れるまで
/// 保持していないと不正なメモリを読ませることになる。
struct ConditionValue {
    address: IpAddr,
    /// v6 のときだけ使う。WFP へ渡すポインタの指し先。
    v6: FWP_BYTE_ARRAY16,
}

impl ConditionValue {
    fn new(address: IpAddr) -> Self {
        let v6 = match address {
            IpAddr::V6(v6) => FWP_BYTE_ARRAY16 {
                byteArray16: v6.octets(),
            },
            IpAddr::V4(_) => FWP_BYTE_ARRAY16::default(),
        };
        Self { address, v6 }
    }

    fn as_condition_value(&self) -> FWP_CONDITION_VALUE0 {
        match self.address {
            // WFP の IPv4 はホストバイトオーダーの u32
            IpAddr::V4(v4) => FWP_CONDITION_VALUE0 {
                r#type: FWP_UINT32,
                Anonymous: FWP_CONDITION_VALUE0_0 {
                    uint32: u32::from(v4),
                },
            },
            IpAddr::V6(_) => FWP_CONDITION_VALUE0 {
                r#type: FWP_BYTE_ARRAY16_TYPE,
                Anonymous: FWP_CONDITION_VALUE0_0 {
                    byteArray16: &raw const self.v6 as *mut _,
                },
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use std::net::{Ipv4Addr, Ipv6Addr};

    use super::*;

    #[test]
    fn v4_と_v6_で別のレイヤを使う() {
        // 片方だけだと、残った側でそのまま抜けられる
        let v4 = layer_for(IpAddr::V4(Ipv4Addr::new(1, 1, 1, 1)));
        let v6 = layer_for(IpAddr::V6(Ipv6Addr::LOCALHOST));
        assert_eq!(v4, FWPM_LAYER_ALE_AUTH_CONNECT_V4);
        assert_eq!(v6, FWPM_LAYER_ALE_AUTH_CONNECT_V6);
        assert_ne!(v4, v6);
    }

    #[test]
    fn v4_はホストバイトオーダーの数値になる() {
        // ネットワークバイトオーダーで渡すと、まったく別の IP を塞ぐことになる
        let value = ConditionValue::new(IpAddr::V4(Ipv4Addr::new(1, 1, 1, 1)));
        let condition = value.as_condition_value();

        assert_eq!(condition.r#type, FWP_UINT32);
        // SAFETY: 直前で FWP_UINT32 だと確認している
        assert_eq!(unsafe { condition.Anonymous.uint32 }, 0x0101_0101);
    }

    #[test]
    fn v6_は_16_バイトの配列になる() {
        let address = "2606:4700:4700::1111".parse::<Ipv6Addr>().expect("妥当");
        let value = ConditionValue::new(IpAddr::V6(address));
        let condition = value.as_condition_value();

        assert_eq!(condition.r#type, FWP_BYTE_ARRAY16_TYPE);
        // SAFETY: 直前で FWP_BYTE_ARRAY16_TYPE だと確認しており、
        // 指し先は value が生きているあいだ有効
        let bytes = unsafe { (*condition.Anonymous.byteArray16).byteArray16 };
        assert_eq!(bytes, address.octets());
    }

    #[test]
    fn 権限不足は原因が分かる形で出る() {
        // サービスを非管理者で動かしたときにいちばん起きやすい失敗
        let error = WfpError {
            operation: "遮断フィルタの追加",
            code: ERROR_ACCESS_DENIED,
        };
        assert!(error.to_string().contains("管理者権限"));
    }

    #[test]
    fn 同梱の_doh_アドレスをすべて扱える() {
        // v4/v6 のどちらでも条件値を作れること。実際に塞ぐのは実機でしか試せない
        for address in domain_model::bundled_doh_addresses() {
            let value = ConditionValue::new(address);
            let condition = value.as_condition_value();
            let expected = if address.is_ipv4() {
                FWP_UINT32
            } else {
                FWP_BYTE_ARRAY16_TYPE
            };
            assert_eq!(condition.r#type, expected, "{address}");
        }
    }
}
