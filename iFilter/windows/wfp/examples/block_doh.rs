//! 同梱の DoH プロバイダ IP を実際に塞いで、効いていることを確かめる。
//!
//! ```powershell
//! # 管理者の PowerShell で
//! cargo run -p ifilter-wfp --example block_doh
//! ```
//!
//! サービスの `--enforce-dns` は DNS 設定の差し替えも同時に行うため、
//! WFP だけを確かめたいときに端末の名前解決ごと巻き込んでしまう。
//! これはその確認のためだけの入口で、**塞ぐのは DoH プロバイダの IP だけ**。
//! 終了すれば動的セッションが解けて元に戻る。

use std::net::{IpAddr, SocketAddr, TcpStream};
use std::time::Duration;

use ifilter_wfp::AddressBlocker;

/// 見て分かるように、代表的な 2 つで前後を比べる。
const SAMPLES: &[&str] = &["1.1.1.1", "8.8.8.8"];

/// 塞いだままにしておく時間。確認のあいだブラウザで試せる程度。
const HOLD: Duration = Duration::from_secs(20);

fn reachable(raw: &str) -> bool {
    let ip: IpAddr = raw.parse().expect("代表アドレスは妥当");
    TcpStream::connect_timeout(&SocketAddr::new(ip, 443), Duration::from_secs(2)).is_ok()
}

fn report(label: &str) {
    println!("--- {label} ---");
    for raw in SAMPLES {
        println!("  {raw}:443 に接続できる: {}", reachable(raw));
    }
}

fn main() {
    let addresses = domain_model::bundled_doh_addresses();
    println!("同梱の DoH アドレス: {} 件", addresses.len());

    report("塞ぐ前");

    let blocker = match AddressBlocker::block(&addresses) {
        Ok(blocker) => blocker,
        Err(err) => {
            eprintln!("塞げませんでした: {err}");
            return;
        }
    };
    println!("フィルタを {} 件入れました", blocker.filter_count());

    report("塞いだ後");

    println!(
        "{} 秒このまま保持します（ブラウザで試すならいま）",
        HOLD.as_secs()
    );
    std::thread::sleep(HOLD);

    drop(blocker); // 動的セッションが解けてフィルタも消える
    report("解除した後");
}
