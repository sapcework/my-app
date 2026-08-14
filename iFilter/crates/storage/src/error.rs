//! 永続化まわりのエラー。

use std::fmt;

/// 保存・読み出しの失敗。
#[derive(Debug)]
pub enum StorageError {
    /// SQLite 自体のエラー。
    Sqlite(rusqlite::Error),
    /// DB に入っていた値を型に戻せなかった。スキーマとコードの不一致を示す。
    Decode {
        column: &'static str,
        value: String,
        cause: String,
    },
    /// 型を DB の表現に変換できなかった。
    Encode { field: &'static str, cause: String },
    /// マイグレーションの整合性が取れていない。
    Migration(String),
}

impl fmt::Display for StorageError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Sqlite(err) => write!(f, "SQLite エラー: {err}"),
            Self::Decode {
                column,
                value,
                cause,
            } => {
                write!(f, "列 {column} の値 {value:?} を読み取れません: {cause}")
            }
            Self::Encode { field, cause } => {
                write!(f, "{field} を保存形式に変換できません: {cause}")
            }
            Self::Migration(message) => write!(f, "マイグレーション異常: {message}"),
        }
    }
}

impl std::error::Error for StorageError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::Sqlite(err) => Some(err),
            _ => None,
        }
    }
}

impl From<rusqlite::Error> for StorageError {
    fn from(err: rusqlite::Error) -> Self {
        Self::Sqlite(err)
    }
}

pub type Result<T> = std::result::Result<T, StorageError>;
