//! UI が持つ状態。
//!
//! **判定は `filter-core` に任せる。** ここが持つのはその入口と DB の場所だけで、
//! 「このカテゴリなら遮断」のような条件分岐は 1 つも書かない
//! （docs/adr/0001-policy-engine-network-separation.md）。

use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use domain_model::ProfileId;
use filter_core::FilterCore;
use storage::SqliteStore;
use time::OffsetDateTime;
use time::format_description::well_known::Rfc3339;

/// UI が使う DB の既定位置。
///
/// **サービスと同じ場所を見る。** ここがずれると「UI で許可したのに効かない」
/// という、原因の分かりにくい不具合になる。サービスは LocalSystem で動くので
/// `%LOCALAPPDATA%` ではなく `%PROGRAMDATA%`。
pub fn default_database_path() -> Result<PathBuf, String> {
    let base = std::env::var_os("PROGRAMDATA")
        .map(PathBuf::from)
        .ok_or_else(|| "DB の置き場所を決められません".to_owned())?;
    Ok(base.join("iFilter").join("ifilter.sqlite"))
}

pub struct AppState {
    core: Mutex<FilterCore<SqliteStore>>,
    database_path: PathBuf,
}

impl AppState {
    /// DB を開いて読み込む。無ければ作って同梱データを入れる。
    ///
    /// UI から先に起動された場合でも使える状態にする。サービスの
    /// `ensure_database` と同じ考え方。
    pub fn load(path: &Path) -> Result<Self, String> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|err| {
                format!(
                    "{} を作れません: {err}\n管理者として実行してください。",
                    dir.display()
                )
            })?;
        }

        let mut store = SqliteStore::open(path).map_err(|err| {
            format!(
                "DB を開けません（{}）: {err}\n管理者として実行してください。",
                path.display()
            )
        })?;
        store
            .seed_builtins(OffsetDateTime::now_utc())
            .map_err(|err| format!("同梱データを書き込めません: {err}"))?;

        let profile = active_profile(&store);
        let core = FilterCore::load(store, profile, "ui", OffsetDateTime::now_utc())
            .map_err(|err| format!("ポリシーを読み込めません: {err}"))?;

        Ok(Self {
            core: Mutex::new(core),
            database_path: path.to_path_buf(),
        })
    }

    /// 中核への参照。ロックが壊れていても使い続ける。
    ///
    /// 保護者の設定画面が「ロックが壊れています」で操作不能になるより、
    /// 続行できるほうがましな場面しかない。
    pub fn core(&self) -> MutexGuard<'_, FilterCore<SqliteStore>> {
        self.core
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn database_path(&self) -> &Path {
        &self.database_path
    }
}

/// 保存されている「使用中のプロファイル」。無ければ BEGINNER。
///
/// 迷ったら**最も厳しい側**に倒す。設定が読めないことを理由に緩めない。
fn active_profile(store: &SqliteStore) -> ProfileId {
    use storage::PolicyStore;

    store
        .setting(ACTIVE_PROFILE_KEY)
        .ok()
        .flatten()
        .and_then(|raw| parse_profile(&raw))
        .unwrap_or(ProfileId::Beginner)
}

/// 使用中プロファイルを保存する `settings` のキー。
pub const ACTIVE_PROFILE_KEY: &str = "filter.profile";

pub fn parse_profile(raw: &str) -> Option<ProfileId> {
    match raw {
        "beginner" => Some(ProfileId::Beginner),
        "beginner_plus" => Some(ProfileId::BeginnerPlus),
        "standard" => Some(ProfileId::Standard),
        "teen" => Some(ProfileId::Teen),
        _ => None,
    }
}

/// 時刻を UI に渡す形（RFC3339）にする。
pub fn format_time(value: OffsetDateTime) -> String {
    value.format(&Rfc3339).unwrap_or_else(|_| String::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn プロファイル名を解釈できる() {
        assert_eq!(parse_profile("beginner"), Some(ProfileId::Beginner));
        assert_eq!(
            parse_profile("beginner_plus"),
            Some(ProfileId::BeginnerPlus)
        );
        assert_eq!(parse_profile("standard"), Some(ProfileId::Standard));
        assert_eq!(parse_profile("teen"), Some(ProfileId::Teen));
    }

    #[test]
    fn 未知のプロファイル名は受け付けない() {
        // 呼び出し側で BEGINNER に倒す。緩い側に倒さない
        assert_eq!(parse_profile("grown_up"), None);
        assert_eq!(parse_profile(""), None);
    }

    #[test]
    fn 保存表現は_slug_と一致する() {
        // DB・ルール ID・UI で表記が食い違うと追跡できなくなる
        for id in [
            ProfileId::Beginner,
            ProfileId::BeginnerPlus,
            ProfileId::Standard,
            ProfileId::Teen,
        ] {
            assert_eq!(parse_profile(id.slug()), Some(id));
        }
    }

    #[test]
    fn 時刻は_rfc3339_で渡す() {
        assert_eq!(
            format_time(OffsetDateTime::UNIX_EPOCH),
            "1970-01-01T00:00:00Z"
        );
    }
}
