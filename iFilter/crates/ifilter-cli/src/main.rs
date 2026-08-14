//! iFilter の検証用 CLI。
//!
//! ネットワーク層（DNS・WFP・Windows サービス）を作る前に、
//! **ポリシーの正しさをここで確かめきる**のが狙い。
//! すべて非管理者権限で動く。

mod app;
mod format;

use std::process::ExitCode;

use clap::Parser;

use crate::app::Cli;

fn main() -> ExitCode {
    let cli = Cli::parse();

    match cli.run() {
        Ok(code) => code,
        Err(err) => {
            eprintln!("エラー: {err}");
            // 原因の連鎖も出す。DB の値が壊れたときに列名まで分かるようにするため
            let mut source = std::error::Error::source(&*err);
            while let Some(cause) = source {
                eprintln!("  原因: {cause}");
                source = cause.source();
            }
            ExitCode::from(2)
        }
    }
}
