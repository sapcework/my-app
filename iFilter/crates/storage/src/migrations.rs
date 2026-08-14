//! マイグレーション。
//!
//! `PRAGMA user_version` を適用済みの本数として使う。専用テーブルを作るより単純で、
//! SQLite に元から備わっているぶん壊れにくい。
//!
//! SQL は `include_str!` でバイナリに埋め込む。フィルターは Windows サービスとして
//! 単体で動くため、実行時に外部ファイルを探しにいく設計にはできない。

use rusqlite::Connection;

use crate::error::{Result, StorageError};

/// 適用順に並べたマイグレーション。**既存の要素を書き換えてはいけない。**
/// スキーマを変えるときは末尾に追加する。
const MIGRATIONS: &[Migration] = &[Migration {
    name: "001_initial",
    sql: include_str!("../migrations/001_initial.sql"),
}];

struct Migration {
    name: &'static str,
    sql: &'static str,
}

/// 未適用のマイグレーションを適用し、適用した本数を返す。
pub fn apply(conn: &Connection) -> Result<usize> {
    let applied: usize =
        conn.query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))? as usize;

    if applied > MIGRATIONS.len() {
        return Err(StorageError::Migration(format!(
            "DB は {applied} 本適用済みだが、このアプリは {} 本しか知らない。\
             新しいバージョンで作られた DB を開こうとしている",
            MIGRATIONS.len()
        )));
    }

    let pending = &MIGRATIONS[applied..];
    for (offset, migration) in pending.iter().enumerate() {
        let version = applied + offset + 1;
        conn.execute_batch(migration.sql).map_err(|err| {
            StorageError::Migration(format!("{} の適用に失敗: {err}", migration.name))
        })?;
        // PRAGMA はプレースホルダを受け付けないので直接埋め込む。version は内部の整数
        conn.execute_batch(&format!("PRAGMA user_version = {version}"))?;
    }

    Ok(pending.len())
}

/// このアプリが知っているマイグレーションの本数。
pub fn latest_version() -> usize {
    MIGRATIONS.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn memory() -> Connection {
        Connection::open_in_memory().expect("メモリ DB を開ける")
    }

    #[test]
    fn 空の_db_に適用できる() {
        let conn = memory();
        assert_eq!(apply(&conn).expect("適用できる"), latest_version());

        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .expect("読める");
        assert_eq!(version as usize, latest_version());
    }

    #[test]
    fn 二重適用しても壊れない() {
        let conn = memory();
        apply(&conn).expect("1 回目");
        assert_eq!(apply(&conn).expect("2 回目"), 0, "適用済みは再実行されない");
    }

    #[test]
    fn 未来のバージョンの_db_は開かない() {
        let conn = memory();
        conn.execute_batch("PRAGMA user_version = 99")
            .expect("設定できる");

        let err = apply(&conn).expect_err("エラーになる");
        assert!(matches!(err, StorageError::Migration(_)));
    }

    #[test]
    fn 期待するテーブルがそろう() {
        let conn = memory();
        apply(&conn).expect("適用できる");

        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
            .expect("準備できる");
        let tables: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .expect("実行できる")
            .filter_map(std::result::Result::ok)
            .filter(|name| !name.starts_with("sqlite_"))
            .collect();

        assert_eq!(
            tables,
            vec![
                "access_decisions",
                "categories",
                "domain_record_categories",
                "domain_records",
                "emergency_blocks",
                "parent_overrides",
                "profiles",
                "settings",
            ]
        );
    }

    #[test]
    fn 判定履歴に保存してよい列しか無い() {
        // プライバシー方針の防波堤。ページ本文・検索語・Cookie の列を足させない
        // （docs/POLICY_MODEL.md §5）
        let conn = memory();
        apply(&conn).expect("適用できる");

        let mut stmt = conn
            .prepare("SELECT name FROM pragma_table_info('access_decisions')")
            .expect("準備できる");
        let mut columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .expect("実行できる")
            .filter_map(std::result::Result::ok)
            .collect();
        columns.sort();

        assert_eq!(
            columns,
            vec![
                "category",
                "decision",
                "device_id",
                "domain",
                "id",
                "profile",
                "rule_id",
                "timestamp",
            ],
            "判定履歴の列が増えている。プライバシー方針を確認すること"
        );
    }
}
