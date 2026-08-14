//! UDP の DNS プロキシ本体。
//!
//! **判定は一切しない。** `filter-core` に問い合わせ、返ってきた `Verdict` を
//! DNS の応答としてどう実現するかだけを担当する
//! （docs/adr/0001-policy-engine-network-separation.md）。
//!
//! ```text
//! ALLOW           → 上流へ転送し、応答をそのまま返す
//! BLOCK / REVIEW  → NXDOMAIN
//! ```
//!
//! REVIEW も通さない。DNS の応答には「保護者に確認中」を表す手段が無く、
//! 待たせることもできないため。履歴には REVIEW として残るので、
//! 保護者 UI の許可申請に出せる。

use std::io;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use domain_model::{Decision, DomainName, RequestSource, Verdict};
use filter_core::FilterCore;
use storage::PolicyStore;
use time::OffsetDateTime;
use tokio::net::UdpSocket;

use crate::message::{self, MAX_MESSAGE_LEN, ParseError, Query, ResponseCode};
use crate::upstream::Upstream;

/// 1 件の問い合わせをどう処理したか。ログとテストのために返す。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Outcome {
    /// 上流へ転送した。
    Forwarded,
    /// 遮断した（NXDOMAIN を返した）。
    Blocked,
    /// 保護者の確認待ち。DNS 層では遮断と同じ扱い。
    Review,
    /// 判定に載せられなかった。
    Rejected(ResponseCode),
}

/// フィルターの本体。
///
/// `FilterCore` は `decide_and_log` で `&mut` を要るので `Mutex` で包む。
/// ロックを握るのは判定と履歴書き込みのあいだだけで、上流への転送中は握らない。
pub struct DnsFilter<S: PolicyStore> {
    core: Mutex<FilterCore<S>>,
    upstream: Upstream,
    verbose: bool,
}

impl<S: PolicyStore> DnsFilter<S> {
    pub fn new(core: FilterCore<S>, upstream: Upstream, verbose: bool) -> Self {
        Self {
            core: Mutex::new(core),
            upstream,
            verbose,
        }
    }

    /// 問い合わせ 1 件を処理し、返すべき応答を組み立てる。
    pub async fn handle(&self, datagram: &[u8]) -> (Vec<u8>, Outcome) {
        let query = match message::parse_query(datagram) {
            Ok(query) => query,
            Err(err) => {
                let rcode = rcode_for(err);
                self.log_raw(&format!("解釈できない問い合わせ: {err}"));
                return (
                    message::error_response(datagram, rcode),
                    Outcome::Rejected(rcode),
                );
            }
        };

        // 通常の問い合わせ以外（更新・状態確認）は扱わない
        if query.opcode() != 0 {
            return self.reject(&query, ResponseCode::NotImp, "通常の問い合わせではない");
        }
        // IN 以外のクラス（CHAOS など）は名前解決に使わない
        if query.qclass != 1 {
            return self.reject(&query, ResponseCode::NotImp, "IN クラスではない");
        }

        let Ok(domain) = DomainName::parse(&query.name) else {
            // ルート（`.`）や不正な名前。分類できないので通さない
            return self.reject(&query, ResponseCode::Refused, "名前を解釈できない");
        };

        let verdict = self.decide(&domain);
        self.log(&query, &domain, &verdict);

        match verdict.decision {
            Decision::Allow => match self.upstream.forward(datagram).await {
                Ok(response) => (response, Outcome::Forwarded),
                Err(err) => {
                    // 上流が落ちているのを「その名前は無い」と答えると、
                    // 復旧後もクライアントが否定応答をキャッシュし続ける
                    self.log_raw(&format!("上流への転送に失敗: {err}"));
                    (
                        query.respond(ResponseCode::ServFail),
                        Outcome::Rejected(ResponseCode::ServFail),
                    )
                }
            },
            Decision::Block => (query.respond(ResponseCode::NxDomain), Outcome::Blocked),
            Decision::Review => (query.respond(ResponseCode::NxDomain), Outcome::Review),
        }
    }

    /// 判定して履歴に残す。ロックを握るのはこの中だけ。
    fn decide(&self, domain: &DomainName) -> Verdict {
        let at = OffsetDateTime::now_utc();
        let mut core = self
            .core
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        match core.decide_and_log(domain, at, RequestSource::Dns) {
            Ok(verdict) => verdict,
            Err(err) => {
                // 履歴を書けなくても判定は続ける。記録できないことを理由に
                // 通信を止めると、DB の不調が「ネットに繋がらない」事故になる
                self.log_raw(&format!("履歴を保存できませんでした: {err}"));
                core.decide(domain, at, RequestSource::Dns)
            }
        }
    }

    /// 設定を読み直す。UI や CLI が DB を書き換えたあとに呼ぶ。
    pub fn reload(&self) -> filter_core::Result<()> {
        let at = OffsetDateTime::now_utc();
        self.core
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .reload(at)
    }

    fn reject(&self, query: &Query, rcode: ResponseCode, why: &str) -> (Vec<u8>, Outcome) {
        self.log_raw(&format!("{why}: {}", query.name));
        (query.respond(rcode), Outcome::Rejected(rcode))
    }

    fn log(&self, query: &Query, domain: &DomainName, verdict: &Verdict) {
        if !self.verbose && verdict.decision == Decision::Allow {
            return; // 1 ページで数十件飛ぶので、既定では遮断だけ出す
        }
        println!(
            "{:<6} {domain} ({}) {}",
            verdict.decision.slug().to_uppercase(),
            message::qtype_name(query.qtype),
            verdict.matched_rule,
        );
    }

    fn log_raw(&self, text: &str) {
        if self.verbose {
            println!("{text}");
        }
    }
}

fn rcode_for(err: ParseError) -> ResponseCode {
    match err {
        // 「読めない」系は書式エラー
        ParseError::TooShort
        | ParseError::UnexpectedEnd
        | ParseError::CompressionPointer
        | ParseError::NameTooLong
        | ParseError::NonAsciiName
        | ParseError::NoQuestion => ResponseCode::FormErr,
        // 応答が送られてきた場合。処理する筋合いが無い
        ParseError::NotQuery => ResponseCode::Refused,
    }
}

/// 連続でこれだけ受信に失敗したら、ソケットが壊れているとみなして諦める。
///
/// 1 件ずつのエラーは無視するが、無視し続けると壊れたソケットを相手に
/// 延々と空回りする。どこかで見切る必要がある。
const MAX_CONSECUTIVE_RECV_ERRORS: u32 = 100;

/// 待ち受けを開始し、`shutdown` が完了するまで処理を続ける。
///
/// `bound` は**ソケットを確保できた時点**で呼ばれる。ここより前は問い合わせを
/// 受け取れないので、呼び出し側が「準備完了」を外に知らせるのはこの合図のあと。
/// 実際に確保できたアドレスを渡すので、ポート 0 を指定したときの接続先も分かる。
pub async fn serve<S>(
    filter: Arc<DnsFilter<S>>,
    listen: SocketAddr,
    bound: impl FnOnce(SocketAddr),
    shutdown: impl std::future::Future<Output = ()>,
) -> io::Result<()>
where
    S: PolicyStore + Send + 'static,
{
    let socket = Arc::new(UdpSocket::bind(listen).await?);
    bound(socket.local_addr()?);

    tokio::pin!(shutdown);
    let mut buf = vec![0u8; MAX_MESSAGE_LEN];
    let mut consecutive_errors = 0u32;

    loop {
        let received = tokio::select! {
            result = socket.recv_from(&mut buf) => result,
            () = &mut shutdown => return Ok(()),
        };

        let (len, from) = match received {
            Ok(pair) => {
                consecutive_errors = 0;
                pair
            }
            Err(err) => {
                // Windows では、すでに閉じたクライアントのポートへ応答を返すと
                // ICMP が返り、**こちらの次の受信が失敗する**（WSAECONNRESET）。
                // 相手が 1 つ先に消えただけで待ち受け全体を落とすわけにはいかない。
                // 問い合わせは常に別プロセスから来るので、これは日常的に起きる
                consecutive_errors += 1;
                if consecutive_errors >= MAX_CONSECUTIVE_RECV_ERRORS {
                    return Err(err);
                }
                continue;
            }
        };

        // 問い合わせごとに切り離す。1 件の上流待ちで他が止まらないようにする
        let datagram = buf[..len].to_vec();
        let filter = Arc::clone(&filter);
        let socket = Arc::clone(&socket);
        tokio::spawn(async move {
            let (response, _) = filter.handle(&datagram).await;
            let _ = socket.send_to(&response, from).await;
        });
    }
}
