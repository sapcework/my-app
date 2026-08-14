//! 中核層のエラー。

use std::fmt;

use domain_model::ProfileId;
use storage::StorageError;

#[derive(Debug)]
pub enum CoreError {
    Storage(StorageError),
    /// 指定したプロファイルが DB に無い。同梱データの書き込み漏れを示す。
    ProfileNotFound(ProfileId),
}

impl fmt::Display for CoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Storage(err) => write!(f, "{err}"),
            Self::ProfileNotFound(id) => {
                write!(
                    f,
                    "プロファイル {id} が見つかりません（同梱データが未書き込みの可能性）"
                )
            }
        }
    }
}

impl std::error::Error for CoreError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::Storage(err) => Some(err),
            Self::ProfileNotFound(_) => None,
        }
    }
}

impl From<StorageError> for CoreError {
    fn from(err: StorageError) -> Self {
        Self::Storage(err)
    }
}

pub type Result<T> = std::result::Result<T, CoreError>;
