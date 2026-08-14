//! iFilter のローカル DNS プロキシ。
//!
//! ネットワーク層なので **Windows 固有**の位置づけだが、中身は今のところ
//! `tokio` の UDP だけで OS 固有 API を呼んでいない。判定は `filter-core` に
//! 委ね、`Verdict` を DNS の応答としてどう実現するかだけを担当する
//! （docs/ARCHITECTURE.md §2）。
//!
//! DoH 対策のうちドメイン遮断ぶんは、ここではなく**同梱データ**にある。
//! `doh` カテゴリのドメイン（Firefox の canary を含む）が BLOCK → NXDOMAIN に
//! なることで成立するので、この層に特別扱いのコードは無い
//! （docs/adr/0007-doh-countermeasures-in-mvp.md）。
//!
//! ブラウザのポリシー設定（Chrome / Edge のレジストリ）は管理者権限が要るため
//! Windows サービス側（Step 7）の担当。

pub mod message;
pub mod server;
pub mod upstream;

pub use message::{ParseError, Query, ResponseCode};
pub use server::{DnsFilter, Outcome, serve};
pub use upstream::Upstream;
