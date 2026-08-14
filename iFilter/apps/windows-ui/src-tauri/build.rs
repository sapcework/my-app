//! ビルド時の設定。
//!
//! **管理者権限を必須にする。** 子供のアカウントを標準ユーザーにしておけば、
//! 保護者の資格情報なしにはこの UI を起動できない。フィルターの停止も設定変更も
//! ここからしか行えないので、これが「子供が Filter OFF を押せない」保証になる
//! （docs/ARCHITECTURE.md §7-4）。
//!
//! DB も `%PROGRAMDATA%` にあり標準ユーザーには書けないため、権限の要求と
//! 実際に必要な権限が一致している。

/// 管理者として実行することを要求するマニフェスト。
const MANIFEST: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="requireAdministrator" uiAccess="false" />
      </requestedPrivileges>
    </security>
  </trustInfo>
</assembly>
"#;

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .windows_attributes(tauri_build::WindowsAttributes::new().app_manifest(MANIFEST)),
    )
    .expect("tauri のビルド設定に失敗しました");
}
