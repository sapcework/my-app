//! サービスの動作ログ。
//!
//! **サービスの標準出力はどこにも出ない。** SCM が起動したプロセスにはコンソールが
//! 付かないので、`println!` は捨てられる。失敗しても何も残らないと
//! 「サービスは実行中なのに効いていない」を追う手段が無くなるため、ファイルに書く。
//!
//! ここに書くのは**動作の記録だけ**。判定履歴は `access_decisions` テーブルが持ち、
//! そちらに保存してよい項目は決まっている（docs/POLICY_MODEL.md §5）。
//! 問い合わせられたドメインをこのログに流し込まないこと。

use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;

/// 書き込み先。`init` で決める。
static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();

/// 肥大化を防ぐ上限。超えたら作り直す。
///
/// 世代管理はしない。障害を追うのに要るのは直近だけで、
/// 保護者の PC に無限にファイルを増やす理由が無い。
const MAX_BYTES: u64 = 1024 * 1024;

/// 書き込み先を決める。DB と同じ場所に置く。
pub fn init(db_path: &Path) {
    let path = db_path.with_file_name("service.log");
    let _ = LOG_PATH.set(path);
}

/// 1 行書く。書けなくても失敗にはしない。
///
/// ログが書けないことを理由にフィルターを止めると、権限や空き容量の問題が
/// そのまま「ネットに繋がらない」事故になる。
pub fn write(message: &str) {
    let Some(path) = LOG_PATH.get() else {
        return;
    };

    if let Ok(meta) = std::fs::metadata(path)
        && meta.len() > MAX_BYTES
    {
        let _ = std::fs::remove_file(path);
    }

    let now = OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| "?".to_owned());

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{now} {message}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ログは_db_と同じ場所に置く() {
        // 探し回らずに済むよう、DB の隣に固定する
        let db = Path::new(r"C:\ProgramData\iFilter\ifilter.sqlite");
        assert_eq!(
            db.with_file_name("service.log"),
            Path::new(r"C:\ProgramData\iFilter\service.log")
        );
    }

    #[test]
    fn 書き込み先が未設定でも落ちない() {
        // init より前に呼ばれても、そこで停止させない
        write("初期化前のメッセージ");
    }
}
