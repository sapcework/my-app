//! DNS プロキシを実際に動かして確かめる。
//!
//! 高位ポート（OS 任せの空きポート）で待ち受けるので**管理者権限は要らない**。
//! 上流も偽物を立てるので、外部ネットワークにも依存しない。

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use domain_model::ProfileId;
use filter_core::FilterCore;
use ifilter_dns::{DnsFilter, Outcome, ResponseCode, Upstream, serve};
use storage::SqliteStore;
use time::OffsetDateTime;
use tokio::net::UdpSocket;
use tokio::sync::oneshot;

const UPSTREAM_REPLY: &[u8] = b"UPSTREAM-ANSWER";

/// 問い合わせのバイト列を組み立てる。
fn query(name: &str, qtype: u16) -> Vec<u8> {
    let mut out = vec![
        0xAB, 0xCD, // ID
        0x01, 0x00, // RD = 1
        0x00, 0x01, // QDCOUNT = 1
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ];
    for label in name.split('.') {
        out.push(u8::try_from(label.len()).expect("ラベルは 63 バイト以下"));
        out.extend_from_slice(label.as_bytes());
    }
    out.push(0);
    out.extend_from_slice(&qtype.to_be_bytes());
    out.extend_from_slice(&1u16.to_be_bytes()); // IN
    out
}

fn rcode_of(response: &[u8]) -> u16 {
    u16::from_be_bytes([response[2], response[3]]) & 0x000F
}

/// 何を受け取っても固定の応答を返す偽の上流。
async fn fake_upstream() -> SocketAddr {
    let socket = UdpSocket::bind("127.0.0.1:0").await.expect("開ける");
    let addr = socket.local_addr().expect("取れる");

    tokio::spawn(async move {
        let mut buf = vec![0u8; 4096];
        while let Ok((_, from)) = socket.recv_from(&mut buf).await {
            let _ = socket.send_to(UPSTREAM_REPLY, from).await;
        }
    });

    addr
}

async fn filter(profile: ProfileId) -> Arc<DnsFilter<SqliteStore>> {
    let mut store = SqliteStore::open_in_memory().expect("開ける");
    store
        .seed_builtins(OffsetDateTime::now_utc())
        .expect("同梱データを書ける");

    let core = FilterCore::load(store, profile, "test", OffsetDateTime::now_utc()).expect("読める");
    let upstream = Upstream::new(fake_upstream().await, Duration::from_secs(2));
    Arc::new(DnsFilter::new(core, upstream, false))
}

#[tokio::test]
async fn 許可したドメインは上流へ転送する() {
    let filter = filter(ProfileId::Beginner).await;
    let (response, outcome) = filter.handle(&query("ja.wikipedia.org", 1)).await;

    assert_eq!(outcome, Outcome::Forwarded);
    assert_eq!(response, UPSTREAM_REPLY, "上流の応答をそのまま返していない");
}

#[tokio::test]
async fn cdn_のランダムなホスト名も通る() {
    // ここが通らないと、許可したページが部品の遮断で崩れる
    let filter = filter(ProfileId::Beginner).await;
    let (_, outcome) = filter.handle(&query("d111abcdef8.cloudfront.net", 1)).await;
    assert_eq!(outcome, Outcome::Forwarded);
}

#[tokio::test]
async fn 未知のドメインは_nxdomain_を返す() {
    let filter = filter(ProfileId::Beginner).await;
    let raw = query("some-unclassified-site.com", 1);
    let (response, outcome) = filter.handle(&raw).await;

    assert_eq!(outcome, Outcome::Blocked);
    assert_eq!(rcode_of(&response), 3);
    assert_eq!(&response[0..2], &raw[0..2], "ID が一致しない");
    assert_eq!(&response[12..], &raw[12..], "質問セクションを写していない");
}

#[tokio::test]
async fn firefox_の_canary_ドメインは_nxdomain_になる() {
    // NXDOMAIN を返すことで Firefox は DoH を自動的に無効にする。
    // ここが通ると DNS プロキシに問い合わせが 1 件も来なくなる
    let filter = filter(ProfileId::Beginner).await;
    let (response, outcome) = filter.handle(&query("use-application-dns.net", 1)).await;

    assert_eq!(outcome, Outcome::Blocked);
    assert_eq!(rcode_of(&response), 3);
}

#[tokio::test]
async fn doh_プロバイダは_teen_でも遮断する() {
    let filter = filter(ProfileId::Teen).await;
    for name in ["dns.google", "cloudflare-dns.com", "one.one.one.one"] {
        let (response, outcome) = filter.handle(&query(name, 1)).await;
        assert_eq!(outcome, Outcome::Blocked, "{name} が遮断されていない");
        assert_eq!(rcode_of(&response), 3);
    }
}

#[tokio::test]
async fn https_レコードも同じ判定を通る() {
    // HTTPS(65) レコードは ECH や代替接続先の広告に使われる。
    // A だけ見て通すと、ここから遮断を迂回される
    let filter = filter(ProfileId::Beginner).await;
    let (_, blocked) = filter
        .handle(&query("some-unclassified-site.com", 65))
        .await;
    assert_eq!(blocked, Outcome::Blocked);

    let (_, allowed) = filter.handle(&query("fonts.gstatic.com", 65)).await;
    assert_eq!(allowed, Outcome::Forwarded);
}

#[tokio::test]
async fn review_も通さないが遮断とは区別する() {
    // STANDARD は未知を REVIEW にする。DNS には「確認中」を表す手段が無いので
    // 通さないが、履歴には REVIEW として残り許可申請に出せる
    let filter = filter(ProfileId::Standard).await;
    let (response, outcome) = filter.handle(&query("some-unclassified-site.com", 1)).await;

    assert_eq!(outcome, Outcome::Review);
    assert_eq!(rcode_of(&response), 3);
}

#[tokio::test]
async fn 逆引きは通す() {
    // 止めても閲覧は防げず、OS の名前解決が遅くなるだけ
    let filter = filter(ProfileId::Beginner).await;
    let (_, outcome) = filter.handle(&query("1.0.0.127.in-addr.arpa", 12)).await;
    assert_eq!(outcome, Outcome::Forwarded);
}

#[tokio::test]
async fn 解釈できない問い合わせにも応答する() {
    // 無応答にするとクライアントがタイムアウトまで待ち、体感が悪くなる
    let filter = filter(ProfileId::Beginner).await;

    let (response, outcome) = filter.handle(&[0xAB, 0xCD, 0x00]).await;
    assert_eq!(outcome, Outcome::Rejected(ResponseCode::FormErr));
    assert_eq!(&response[0..2], &[0xAB, 0xCD]);

    // 圧縮ポインタ入り
    let mut malformed = query("example.com", 1);
    malformed[12] = 0xC0;
    malformed[13] = 12;
    let (_, outcome) = filter.handle(&malformed).await;
    assert_eq!(outcome, Outcome::Rejected(ResponseCode::FormErr));
}

#[tokio::test]
async fn 上流が落ちていても_nxdomain_は返さない() {
    // NXDOMAIN を返すとクライアントが否定応答をキャッシュし、
    // 上流が復旧しても引けない状態が続く
    let mut store = SqliteStore::open_in_memory().expect("開ける");
    store
        .seed_builtins(OffsetDateTime::now_utc())
        .expect("書ける");
    let core = FilterCore::load(
        store,
        ProfileId::Beginner,
        "test",
        OffsetDateTime::now_utc(),
    )
    .expect("読める");

    // 誰も応答しないアドレスを上流にする
    let silent = UdpSocket::bind("127.0.0.1:0").await.expect("開ける");
    let upstream = Upstream::new(
        silent.local_addr().expect("取れる"),
        Duration::from_millis(50),
    );
    let filter = DnsFilter::new(core, upstream, false);

    let (response, outcome) = filter.handle(&query("ja.wikipedia.org", 1)).await;
    assert_eq!(outcome, Outcome::Rejected(ResponseCode::ServFail));
    assert_eq!(rcode_of(&response), 2);
}

#[tokio::test]
async fn udp_で待ち受けて応答を返す() {
    // handle() だけでなく、ソケットまで含めた配線が通っていることの確認
    let filter = filter(ProfileId::Beginner).await;
    let (addr_tx, addr_rx) = oneshot::channel();
    let (stop_tx, stop_rx) = oneshot::channel();

    let server = tokio::spawn(async move {
        serve(
            filter,
            "127.0.0.1:0".parse().expect("妥当"),
            |bound| {
                let _ = addr_tx.send(bound);
            },
            async {
                let _ = stop_rx.await;
            },
        )
        .await
    });

    let server_addr = addr_rx.await.expect("待ち受けアドレスが分かる");
    let client = UdpSocket::bind("127.0.0.1:0").await.expect("開ける");
    let mut buf = vec![0u8; 4096];

    client
        .send_to(&query("some-unclassified-site.com", 1), server_addr)
        .await
        .expect("送れる");
    let (len, _) = tokio::time::timeout(Duration::from_secs(3), client.recv_from(&mut buf))
        .await
        .expect("応答が返る")
        .expect("受け取れる");
    assert_eq!(rcode_of(&buf[..len]), 3);

    client
        .send_to(&query("ja.wikipedia.org", 1), server_addr)
        .await
        .expect("送れる");
    let (len, _) = tokio::time::timeout(Duration::from_secs(3), client.recv_from(&mut buf))
        .await
        .expect("応答が返る")
        .expect("受け取れる");
    assert_eq!(&buf[..len], UPSTREAM_REPLY);

    let _ = stop_tx.send(());
    server.await.expect("止まる").expect("エラーなく終わる");
}
