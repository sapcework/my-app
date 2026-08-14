//! サービスの設定。
//!
//! 設定は**サービスの ImagePath 引数として持つ**。DB の場所を DB から読むことは
//! できない以上どこかに置く必要があり、レジストリを増やすより登録内容そのものに
//! 書いてあるほうが `sc qc iFilter` で全部見えて追いやすい。

use std::ffi::OsString;
use std::net::SocketAddr;
use std::path::PathBuf;

use clap::{Args, ValueEnum};
use domain_model::ProfileId;

/// サービス名。SCM 上の識別子。
pub const SERVICE_NAME: &str = "iFilter";

/// サービスの表示名。
pub const DISPLAY_NAME: &str = "iFilter ネットワークフィルター";

/// サービスの説明。
pub const DESCRIPTION: &str = "子供向けのネットワークフィルター。DNS の問い合わせを判定し、許可されたものだけを上流へ転送します。";

/// フィルターの動作設定。`install` と `run` で共有する。
#[derive(Debug, Clone, Args)]
pub struct FilterConfig {
    /// 使用する DB ファイル。省略時は %PROGRAMDATA%\iFilter\ifilter.sqlite
    ///
    /// サービスは LocalSystem で動くので、既定値に %LOCALAPPDATA% は使えない。
    #[arg(long)]
    pub db: Option<PathBuf>,

    /// 待ち受けアドレス。既定は 53 番なので管理者権限が要る
    #[arg(long, default_value = "127.0.0.1:53")]
    pub listen: SocketAddr,

    /// 転送先の DNS サーバー
    #[arg(long, default_value = "1.1.1.1:53")]
    pub upstream: SocketAddr,

    /// 上流の応答を待つ秒数
    #[arg(long, default_value_t = 3)]
    pub timeout: u64,

    /// 使用するプロファイル
    #[arg(long, value_enum, default_value_t = ProfileArg::Beginner)]
    pub profile: ProfileArg,

    /// この端末の識別子。判定履歴に残る
    #[arg(long, default_value = "local")]
    pub device_id: String,

    /// Windows の DNS 設定を iFilter に向け、定期的に再適用する
    ///
    /// **既定では行わない。** これを有効にすると端末の名前解決がすべて iFilter を
    /// 通るようになり、フィルターが止まると名前が引けなくなる。まず 53 番での
    /// 待ち受けだけを確認し、納得してから有効にする。
    #[arg(long)]
    pub enforce_dns: bool,

    /// 許可した問い合わせもログに出す
    #[arg(long)]
    pub verbose: bool,
}

/// プロファイルの指定。
#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub enum ProfileArg {
    Beginner,
    BeginnerPlus,
    Standard,
    Teen,
}

impl ProfileArg {
    /// `--profile` に渡す文字列。`install` が引数を組み立てるときに使う。
    pub fn as_arg(self) -> &'static str {
        match self {
            Self::Beginner => "beginner",
            Self::BeginnerPlus => "beginner-plus",
            Self::Standard => "standard",
            Self::Teen => "teen",
        }
    }
}

impl From<ProfileArg> for ProfileId {
    fn from(value: ProfileArg) -> Self {
        match value {
            ProfileArg::Beginner => Self::Beginner,
            ProfileArg::BeginnerPlus => Self::BeginnerPlus,
            ProfileArg::Standard => Self::Standard,
            ProfileArg::Teen => Self::Teen,
        }
    }
}

impl FilterConfig {
    /// DB の場所を決める。
    ///
    /// サービスは LocalSystem で動くため、ユーザーごとの `%LOCALAPPDATA%` ではなく
    /// 全ユーザー共通の `%PROGRAMDATA%` に置く。CLI（`ifilter`）の既定とは別の場所に
    /// なるので、**`--db` で明示的にそろえるのが基本**。
    pub fn db_path(&self) -> Result<PathBuf, String> {
        if let Some(path) = &self.db {
            return Ok(path.clone());
        }
        let base = std::env::var_os("PROGRAMDATA")
            .map(PathBuf::from)
            .ok_or_else(|| "DB の置き場所を決められません。--db で指定してください".to_owned())?;
        Ok(base.join("iFilter").join("ifilter.sqlite"))
    }

    /// サービス登録に埋め込む引数を組み立てる。
    ///
    /// `db_path()` を解決してから書く。登録時と起動時で `%PROGRAMDATA%` の解釈が
    /// ずれる余地を無くすため。
    pub fn to_launch_arguments(&self) -> Result<Vec<OsString>, String> {
        let mut args: Vec<OsString> = vec!["run".into()];

        args.push("--db".into());
        args.push(self.db_path()?.into_os_string());
        args.push("--listen".into());
        args.push(self.listen.to_string().into());
        args.push("--upstream".into());
        args.push(self.upstream.to_string().into());
        args.push("--timeout".into());
        args.push(self.timeout.to_string().into());
        args.push("--profile".into());
        args.push(self.profile.as_arg().into());
        args.push("--device-id".into());
        args.push(self.device_id.clone().into());

        if self.enforce_dns {
            args.push("--enforce-dns".into());
        }
        if self.verbose {
            args.push("--verbose".into());
        }

        Ok(args)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> FilterConfig {
        FilterConfig {
            db: Some(PathBuf::from(r"C:\ProgramData\iFilter\ifilter.sqlite")),
            listen: "127.0.0.1:53".parse().expect("妥当"),
            upstream: "192.168.10.1:53".parse().expect("妥当"),
            timeout: 3,
            profile: ProfileArg::Beginner,
            device_id: "local".to_owned(),
            enforce_dns: false,
            verbose: false,
        }
    }

    fn args_of(config: &FilterConfig) -> Vec<String> {
        config
            .to_launch_arguments()
            .expect("組み立てられる")
            .into_iter()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect()
    }

    #[test]
    fn 登録引数は_run_で始まる() {
        // SCM はこの引数列でプロセスを起動する。先頭が run でないとサービスにならない
        assert_eq!(args_of(&config())[0], "run");
    }

    #[test]
    fn 設定が引数に写る() {
        let args = args_of(&config()).join(" ");
        assert!(args.contains(r"--db C:\ProgramData\iFilter\ifilter.sqlite"));
        assert!(args.contains("--listen 127.0.0.1:53"));
        assert!(args.contains("--upstream 192.168.10.1:53"));
        assert!(args.contains("--profile beginner"));
    }

    #[test]
    fn dns_強制は既定で付かない() {
        // 付いていると端末の名前解決が丸ごと iFilter 経由になる。
        // 意図しない有効化は「ネットに繋がらない」事故に直結する
        assert!(!args_of(&config()).contains(&"--enforce-dns".to_owned()));

        let mut enforced = config();
        enforced.enforce_dns = true;
        assert!(args_of(&enforced).contains(&"--enforce-dns".to_owned()));
    }

    #[test]
    fn db_の場所は登録時に解決する() {
        // %PROGRAMDATA% のまま埋めると、登録時と起動時で解釈がずれる余地が残る
        let mut config = config();
        config.db = None;
        let args = args_of(&config);
        let db = args
            .iter()
            .position(|a| a == "--db")
            .and_then(|i| args.get(i + 1))
            .expect("--db がある");
        assert!(!db.contains('%'), "環境変数が展開されていない: {db}");
        assert!(db.ends_with("ifilter.sqlite"));
    }

    #[test]
    fn プロファイル名が引数と型で一致する() {
        for profile in [
            ProfileArg::Beginner,
            ProfileArg::BeginnerPlus,
            ProfileArg::Standard,
            ProfileArg::Teen,
        ] {
            // clap の ValueEnum が受け取れる綴りであること
            let parsed = ProfileArg::from_str(profile.as_arg(), false).expect("解釈できる");
            assert_eq!(parsed, profile);
        }
    }
}
