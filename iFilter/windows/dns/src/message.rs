//! DNS のワイヤーフォーマット。
//!
//! **必要な最小限しか扱わない。** 問い合わせから名前を取り出すことと、
//! 遮断の応答を組み立てることだけ。許可した問い合わせは上流へ生バイトのまま
//! 転送し、返ってきた応答もそのまま返すので、応答の解析は一切しない。
//!
//! このモジュールは I/O を持たない純粋な変換で、判定にも関与しない
//! （docs/adr/0001-policy-engine-network-separation.md）。

use std::fmt;

/// DNS ヘッダの長さ。
pub const HEADER_LEN: usize = 12;

/// 受信バッファの大きさ。EDNS0 で 4096 を広告するクライアントに合わせる。
pub const MAX_MESSAGE_LEN: usize = 4096;

/// ドメイン名全体の上限（RFC 1035）。
const MAX_NAME_LEN: usize = 255;

/// 応答コード。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResponseCode {
    NoError = 0,
    FormErr = 1,
    ServFail = 2,
    /// 遮断はこれで表す。「そんな名前は無い」と答えるのが DNS 層での BLOCK の実現方法。
    NxDomain = 3,
    NotImp = 4,
    Refused = 5,
}

/// 問い合わせを解釈できなかった理由。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParseError {
    /// ヘッダに満たない長さ。
    TooShort,
    /// QR ビットが立っている（応答が送られてきた）。
    NotQuery,
    /// 質問が 0 件。
    NoQuestion,
    /// 質問セクションに圧縮ポインタがある。問い合わせには現れないので拒否する。
    CompressionPointer,
    /// 名前が 255 バイトを超えている。
    NameTooLong,
    /// 途中で終わっている。
    UnexpectedEnd,
    /// 名前に ASCII 以外のバイトが含まれる。IDN は punycode で来るはずなので異常。
    NonAsciiName,
}

impl fmt::Display for ParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let text = match self {
            Self::TooShort => "ヘッダに満たない長さ",
            Self::NotQuery => "問い合わせではなく応答",
            Self::NoQuestion => "質問が 0 件",
            Self::CompressionPointer => "質問セクションに圧縮ポインタ",
            Self::NameTooLong => "名前が長すぎる",
            Self::UnexpectedEnd => "途中で終わっている",
            Self::NonAsciiName => "名前に ASCII 以外のバイト",
        };
        f.write_str(text)
    }
}

impl std::error::Error for ParseError {}

/// 問い合わせのうち、判定と応答に必要な部分。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Query {
    pub id: u16,
    flags: u16,
    /// ドット区切りの名前。ルート（`.`）なら空文字列。
    pub name: String,
    pub qtype: u16,
    pub qclass: u16,
    /// 質問セクションの生バイト。応答にそのまま写す。
    ///
    /// 自前で組み立て直さないのは、写すだけなら**取り違えようがない**ため。
    question: Vec<u8>,
}

impl Query {
    /// 演算子コード。0 が通常の問い合わせ。
    pub fn opcode(&self) -> u8 {
        ((self.flags >> 11) & 0x0F) as u8
    }

    /// 再帰要求ビット。応答に写して返す。
    pub fn recursion_desired(&self) -> bool {
        self.flags & 0x0100 != 0
    }

    /// 応答を組み立てる。回答は付けない（遮断・エラー用）。
    pub fn respond(&self, rcode: ResponseCode) -> Vec<u8> {
        let mut out = Vec::with_capacity(HEADER_LEN + self.question.len());
        out.extend_from_slice(&self.id.to_be_bytes());

        let mut flags = 0x8000; // QR = 1（これは応答）
        flags |= u16::from(self.opcode()) << 11; // Opcode は写す
        flags |= 0x0400; // AA = 1。この名前についてはこのサーバーが権威
        if self.recursion_desired() {
            flags |= 0x0100; // RD は写す
        }
        flags |= 0x0080; // RA = 1。再帰は提供している
        flags |= rcode as u16;
        out.extend_from_slice(&flags.to_be_bytes());

        out.extend_from_slice(&1u16.to_be_bytes()); // QDCOUNT
        out.extend_from_slice(&[0; 6]); // ANCOUNT / NSCOUNT / ARCOUNT
        out.extend_from_slice(&self.question);
        out
    }
}

/// 問い合わせを解釈する。**最初の質問 1 件だけ**を見る。
///
/// 実運用の DNS クライアントは質問を 1 件しか入れない（複数質問は仕様上可能だが
/// 応答コードが 1 つしかないため実装されていない）。
pub fn parse_query(bytes: &[u8]) -> Result<Query, ParseError> {
    if bytes.len() < HEADER_LEN {
        return Err(ParseError::TooShort);
    }

    let id = u16::from_be_bytes([bytes[0], bytes[1]]);
    let flags = u16::from_be_bytes([bytes[2], bytes[3]]);
    if flags & 0x8000 != 0 {
        return Err(ParseError::NotQuery);
    }
    if u16::from_be_bytes([bytes[4], bytes[5]]) == 0 {
        return Err(ParseError::NoQuestion);
    }

    let (name, after_name) = read_name(bytes, HEADER_LEN)?;
    let end = after_name
        .checked_add(4)
        .filter(|end| *end <= bytes.len())
        .ok_or(ParseError::UnexpectedEnd)?;

    Ok(Query {
        id,
        flags,
        name,
        qtype: u16::from_be_bytes([bytes[after_name], bytes[after_name + 1]]),
        qclass: u16::from_be_bytes([bytes[after_name + 2], bytes[after_name + 3]]),
        question: bytes[HEADER_LEN..end].to_vec(),
    })
}

/// 解釈できなかった問い合わせに返す応答。
///
/// 質問セクションを写せないので付けない。ID だけは拾えるなら拾う
/// （拾えないとクライアントは応答を紐づけられず、待ち続ける）。
pub fn error_response(bytes: &[u8], rcode: ResponseCode) -> Vec<u8> {
    let id = if bytes.len() >= 2 {
        u16::from_be_bytes([bytes[0], bytes[1]])
    } else {
        0
    };

    let mut out = Vec::with_capacity(HEADER_LEN);
    out.extend_from_slice(&id.to_be_bytes());
    out.extend_from_slice(&(0x8000u16 | rcode as u16).to_be_bytes());
    out.extend_from_slice(&[0; 8]); // QD/AN/NS/AR すべて 0
    out
}

/// 名前を読み、次の位置を返す。
fn read_name(bytes: &[u8], start: usize) -> Result<(String, usize), ParseError> {
    let mut pos = start;
    let mut label_bytes = Vec::new();
    let mut total = 0usize;

    loop {
        let len = *bytes.get(pos).ok_or(ParseError::UnexpectedEnd)? as usize;
        pos += 1;
        if len == 0 {
            break;
        }
        // 上位 2 ビットが立っているのは圧縮ポインタか予約値。問い合わせの質問
        // セクションには現れない。追いかけると細工されたパケットで無限ループしうる
        if len & 0xC0 != 0 {
            return Err(ParseError::CompressionPointer);
        }

        total += len + 1;
        if total > MAX_NAME_LEN {
            return Err(ParseError::NameTooLong);
        }

        let end = pos + len;
        let label = bytes.get(pos..end).ok_or(ParseError::UnexpectedEnd)?;
        if !label_bytes.is_empty() {
            label_bytes.push(b'.');
        }
        label_bytes.extend_from_slice(label);
        pos = end;
    }

    if !label_bytes.is_ascii() {
        // IDN はワイヤー上では punycode（ASCII）になっている。非 ASCII は異常
        return Err(ParseError::NonAsciiName);
    }
    let name = String::from_utf8(label_bytes).map_err(|_| ParseError::NonAsciiName)?;
    Ok((name, pos))
}

/// ログに出すためのレコード種別名。判定には使わない。
pub fn qtype_name(qtype: u16) -> &'static str {
    match qtype {
        1 => "A",
        2 => "NS",
        5 => "CNAME",
        12 => "PTR",
        15 => "MX",
        16 => "TXT",
        28 => "AAAA",
        33 => "SRV",
        64 => "SVCB",
        65 => "HTTPS",
        255 => "ANY",
        _ => "?",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `example.com` の A 問い合わせ。
    fn query_bytes(name: &str, qtype: u16) -> Vec<u8> {
        let mut out = vec![
            0x12, 0x34, // ID
            0x01, 0x00, // RD = 1
            0x00, 0x01, // QDCOUNT = 1
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        ];
        if !name.is_empty() {
            for label in name.split('.') {
                out.push(label.len() as u8);
                out.extend_from_slice(label.as_bytes());
            }
        }
        out.push(0);
        out.extend_from_slice(&qtype.to_be_bytes());
        out.extend_from_slice(&1u16.to_be_bytes()); // IN
        out
    }

    #[test]
    fn 問い合わせから名前を取り出せる() {
        let query = parse_query(&query_bytes("example.com", 1)).expect("読める");
        assert_eq!(query.id, 0x1234);
        assert_eq!(query.name, "example.com");
        assert_eq!(query.qtype, 1);
        assert_eq!(query.qclass, 1);
        assert!(query.recursion_desired());
        assert_eq!(query.opcode(), 0);
    }

    #[test]
    fn 深い階層の名前も読める() {
        let query = parse_query(&query_bytes("d111abcdef8.cloudfront.net", 65)).expect("読める");
        assert_eq!(query.name, "d111abcdef8.cloudfront.net");
        assert_eq!(query.qtype, 65); // HTTPS レコード
    }

    #[test]
    fn ルートの問い合わせは空の名前になる() {
        let query = parse_query(&query_bytes("", 2)).expect("読める");
        assert_eq!(query.name, "");
    }

    #[test]
    fn 遮断の応答は_nxdomain_で質問を写す() {
        let raw = query_bytes("example.com", 1);
        let query = parse_query(&raw).expect("読める");
        let response = query.respond(ResponseCode::NxDomain);

        assert_eq!(&response[0..2], &raw[0..2], "ID が一致しない");

        let flags = u16::from_be_bytes([response[2], response[3]]);
        assert_eq!(flags & 0x8000, 0x8000, "QR が立っていない");
        assert_eq!(flags & 0x000F, 3, "RCODE が NXDOMAIN でない");
        assert_eq!(flags & 0x0100, 0x0100, "RD が写っていない");

        assert_eq!(u16::from_be_bytes([response[4], response[5]]), 1); // QDCOUNT
        assert_eq!(u16::from_be_bytes([response[6], response[7]]), 0); // ANCOUNT
        assert_eq!(
            &response[HEADER_LEN..],
            &raw[HEADER_LEN..],
            "質問セクションが写っていない"
        );
    }

    #[test]
    fn 再帰要求が無ければ写さない() {
        let mut raw = query_bytes("example.com", 1);
        raw[2] = 0x00; // RD = 0
        let query = parse_query(&raw).expect("読める");
        let response = query.respond(ResponseCode::NxDomain);
        let flags = u16::from_be_bytes([response[2], response[3]]);
        assert_eq!(flags & 0x0100, 0);
    }

    #[test]
    fn 短すぎる入力は拒否する() {
        assert_eq!(parse_query(&[]), Err(ParseError::TooShort));
        assert_eq!(parse_query(&[0; 11]), Err(ParseError::TooShort));
    }

    #[test]
    fn 応答が送られてきたら拒否する() {
        let mut raw = query_bytes("example.com", 1);
        raw[2] |= 0x80; // QR = 1
        assert_eq!(parse_query(&raw), Err(ParseError::NotQuery));
    }

    #[test]
    fn 質問が_0_件なら拒否する() {
        let mut raw = query_bytes("example.com", 1);
        raw[5] = 0;
        assert_eq!(parse_query(&raw), Err(ParseError::NoQuestion));
    }

    #[test]
    fn 圧縮ポインタは追いかけない() {
        // 自分自身を指すポインタ。追いかけると無限ループする
        let mut raw = query_bytes("example.com", 1);
        raw[HEADER_LEN] = 0xC0;
        raw[HEADER_LEN + 1] = HEADER_LEN as u8;
        assert_eq!(parse_query(&raw), Err(ParseError::CompressionPointer));
    }

    #[test]
    fn 途中で切れた入力は拒否する() {
        let raw = query_bytes("example.com", 1);
        for cut in HEADER_LEN..raw.len() {
            assert!(
                parse_query(&raw[..cut]).is_err(),
                "{cut} バイトで切っても読めてしまう"
            );
        }
    }

    #[test]
    fn 終端の無い名前は拒否する() {
        let mut raw = vec![
            0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        ];
        raw.push(3);
        raw.extend_from_slice(b"abc"); // 終端の 0 が無い
        assert_eq!(parse_query(&raw), Err(ParseError::UnexpectedEnd));
    }

    #[test]
    fn 長すぎる名前は拒否する() {
        let mut raw = vec![
            0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        ];
        for _ in 0..10 {
            raw.push(63);
            raw.extend_from_slice(&[b'a'; 63]);
        }
        raw.push(0);
        raw.extend_from_slice(&[0, 1, 0, 1]);
        assert_eq!(parse_query(&raw), Err(ParseError::NameTooLong));
    }

    #[test]
    fn 非_ascii_の名前は拒否する() {
        let mut raw = vec![
            0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        ];
        raw.push(3);
        raw.extend_from_slice(&[0xE3, 0x81, 0x82]); // UTF-8 の「あ」
        raw.push(0);
        raw.extend_from_slice(&[0, 1, 0, 1]);
        assert_eq!(parse_query(&raw), Err(ParseError::NonAsciiName));
    }

    #[test]
    fn 解釈できない入力にも_id_付きで応答する() {
        // ID を返さないとクライアントは紐づけられず、タイムアウトまで待つ
        let response = error_response(&[0xAB, 0xCD, 0xFF], ResponseCode::FormErr);
        assert_eq!(&response[0..2], &[0xAB, 0xCD]);
        assert_eq!(response.len(), HEADER_LEN);
        let flags = u16::from_be_bytes([response[2], response[3]]);
        assert_eq!(flags & 0x8000, 0x8000);
        assert_eq!(flags & 0x000F, 1);
    }

    #[test]
    fn id_が読めない入力でも応答を作れる() {
        let response = error_response(&[0x01], ResponseCode::FormErr);
        assert_eq!(response.len(), HEADER_LEN);
    }

    #[test]
    fn 種別名はログ用に引ける() {
        assert_eq!(qtype_name(1), "A");
        assert_eq!(qtype_name(28), "AAAA");
        assert_eq!(qtype_name(65), "HTTPS");
        assert_eq!(qtype_name(9999), "?");
    }
}
