//! 上流 DNS への転送。
//!
//! 許可された問い合わせは**生バイトのまま**上流へ渡し、返ってきた応答も
//! そのまま返す。中身を解釈しないので、新しいレコード種別が出ても壊れない。

use std::io;
use std::net::SocketAddr;
use std::time::Duration;

use tokio::net::UdpSocket;

use crate::message::MAX_MESSAGE_LEN;

/// 上流 DNS サーバー。
#[derive(Debug, Clone)]
pub struct Upstream {
    addr: SocketAddr,
    timeout: Duration,
}

impl Upstream {
    pub fn new(addr: SocketAddr, timeout: Duration) -> Self {
        Self { addr, timeout }
    }

    pub fn addr(&self) -> SocketAddr {
        self.addr
    }

    /// 問い合わせを転送し、応答をそのまま返す。
    ///
    /// 問い合わせごとに新しいソケットを開く。送信元ポートが毎回変わるので
    /// キャッシュポイズニングを狙った偽装応答が当てにくくなる。
    /// 家庭 1 台ぶんの流量ではソケット生成のコストは問題にならない。
    pub async fn forward(&self, query: &[u8]) -> io::Result<Vec<u8>> {
        // 上流が IPv6 なら送信側も IPv6 で開く必要がある
        let bind: SocketAddr = if self.addr.is_ipv4() {
            "0.0.0.0:0".parse().expect("固定文字列")
        } else {
            "[::]:0".parse().expect("固定文字列")
        };

        let socket = UdpSocket::bind(bind).await?;
        socket.connect(self.addr).await?;
        socket.send(query).await?;

        let mut buf = vec![0u8; MAX_MESSAGE_LEN];
        let len = tokio::time::timeout(self.timeout, socket.recv(&mut buf))
            .await
            .map_err(|_| {
                io::Error::new(
                    io::ErrorKind::TimedOut,
                    format!("上流 {} が {:?} 以内に応答しない", self.addr, self.timeout),
                )
            })??;

        buf.truncate(len);
        Ok(buf)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn 応答をそのまま返す() {
        let fake = UdpSocket::bind("127.0.0.1:0").await.expect("開ける");
        let addr = fake.local_addr().expect("取れる");

        tokio::spawn(async move {
            let mut buf = vec![0u8; MAX_MESSAGE_LEN];
            let (len, from) = fake.recv_from(&mut buf).await.expect("受け取れる");
            assert_eq!(&buf[..len], b"query");
            fake.send_to(b"response", from).await.expect("返せる");
        });

        let upstream = Upstream::new(addr, Duration::from_secs(2));
        assert_eq!(
            upstream.forward(b"query").await.expect("転送できる"),
            b"response"
        );
    }

    #[tokio::test]
    async fn 応答が無ければタイムアウトする() {
        // 上流が落ちているときに待ち続けないこと
        let silent = UdpSocket::bind("127.0.0.1:0").await.expect("開ける");
        let addr = silent.local_addr().expect("取れる");

        let upstream = Upstream::new(addr, Duration::from_millis(50));
        let err = upstream.forward(b"query").await.expect_err("失敗する");
        assert_eq!(err.kind(), io::ErrorKind::TimedOut);
    }
}
