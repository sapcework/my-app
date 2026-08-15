# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

未成年者向けの Windows ネットワークフィルター。最初の対象は**初めてインターネットを
利用する小学生**。ブラウザ拡張ではなく PC 全体の通信を対象にする。

**これはペアレンタルコントロールであり、スパイウェアではない。**

## ドキュメントの分担

- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — レイヤ境界・crate 構成・
  Windows/Core の境界・Android 方針・**既知の設計上の問題点**
- **[docs/POLICY_MODEL.md](./docs/POLICY_MODEL.md)** — 型定義と判定順序 9 段。
  「この入力はどう判定されるのが正しいのか」はここを見る
- **[docs/TEST_PLAN.md](./docs/TEST_PLAN.md)** — テストケース設計
- **[docs/ROADMAP.md](./docs/ROADMAP.md)** — Step 1〜12 の実装手順と現在地
- **[docs/adr/](./docs/adr/)** — なぜその設計にしたか。設計を変えるときは必ず読む

## 動作確認

```bash
cargo run -p ifilter-cli -- --db <path> init
cargo run -p ifilter-cli -- --db <path> check example.com --profile beginner --trace

# DNS プロキシ。既定は 127.0.0.1:15353 なので非管理者で動く
cargo run -p ifilter-dns -- --db <path> --upstream 192.168.10.1:53 --verbose
```

`check` は終了コードで判定を返す（ALLOW=0 / BLOCK=1 / REVIEW=3）。
**PowerShell では BLOCK が「コマンド失敗」に見えるが正常。**

### UI の設定変更は必ず `filter-core` 経由で行う

DB を直接書くとポリシー版数（`policy.revision`）が進まず、**動いているサービスが
古いポリシーのまま動き続ける**。「UI で許可したのに繋がらない」という、原因の
分かりにくい形で出る。サービスは 2 秒ごとに版数だけを見て、変わっていれば読み直す。

### Tauri crate はルートの workspace に入れない

`tauri::generate_context!` がビルド時に `dist/` を要求するため、UI をビルドして
いない状態で `cargo build --workspace` が落ちる。ルート `Cargo.toml` で
`exclude` してあり、UI 側は `npm run verify` が自前で typecheck・lint・テストを回す。

### サービスは「準備できてから」実行中と報告する

起動から待ち受け開始まで DB の準備に約 0.6 秒かかる。先に `Running` と報告すると、
`start` の直後の問い合わせが**まだ誰も居ないポート**へ届いて失敗する。
`serve` の `bound` コールバックが「準備完了」の合図。ここより前に外へ知らせない。

### UDP の受信エラーで待ち受けを畳まない

Windows では、すでに閉じたクライアントのポートへ応答を返すと ICMP が返り、
**こちらの次の `recv` が WSAECONNRESET で失敗する**。問い合わせは常に別プロセスから
来るので日常的に起きる。ここで `?` を使うと、相手が 1 つ先に消えただけで
フィルターが黙って止まる（＝「効いているつもりで素通り」）。

### サービスの `println!` はどこにも出ない

SCM が起動したプロセスにはコンソールが付かない。失敗しても何も残らないので、
`log::write` でファイルに書く（DB の隣の `service.log`）。
**判定履歴はここに流さない** — `access_decisions` の担当で、保存してよい項目が違う。

### サービスの DB は CLI と別の場所が既定になる

サービスは LocalSystem で動くので既定が `%PROGRAMDATA%\iFilter`、CLI は
`%LOCALAPPDATA%\iFilter`。**そろえるには両方に `--db` を明示する。**
忘れると「CLI で許可したのにフィルターに反映されない」形で表面化する。

### DNS 差し替えは `--enforce-dns` を付けたときだけ

付けなければサービスは 53 番で待ち受けるだけで、端末の名前解決に影響しない。
有効にすると BEGINNER では未知が全部 BLOCK なので、**開発中のブラウザや cargo が
繋がらなくなる**。戻すのは `ifilter-service revert-dns`。

### UI の `npm run tauri dev` は管理者の PowerShell から実行する

UI は `requestedExecutionLevel = requireAdministrator`（`src-tauri/build.rs`）。
`cargo run` は `CreateProcess` で起動するため、**UAC ダイアログは出ずに
`os error 740`（要求された操作には管理者特権が必要です）で落ちる**。
ビルドは通ってから最後に失敗するので、原因がコードにあるように見える。

エクスプローラーやショートカットからの起動は `ShellExecute` なので UAC が出る。
**製品としての起動は正常で、困るのは開発時だけ。** マニフェストを外して回避しない
（子供が UI を開けないことが Filter OFF の保護そのもの — ARCHITECTURE.md §7-4）。

### 自前マニフェストは Common-Controls v6 の宣言ごと置き換わる

`WindowsAttributes::app_manifest` は tauri-build の既定マニフェストを**丸ごと差し替える**。
既定の中身は Common-Controls v6 の依存宣言だけなので、管理者権限の要求だけを書くと
その宣言が消える。すると comctl32 が v5 で読み込まれ、wry/tao が静的インポートしている
`SetWindowSubclass` `TaskDialogIndirect` が見つからず、**起動した瞬間に
`STATUS_ENTRYPOINT_NOT_FOUND`（0xC0000139）で落ちる**。

ビルドは通り、メッセージもコードと無関係な形で出るので原因が見えにくい。
`src-tauri/build.rs` の `MANIFEST` から `<dependency>` を消さないこと。

### DNS プロキシの動作確認に `nslookup` を使わない

PowerShell は `nslookup -port=15353 ...` の `-port=` を渡しそこねて 53 番に問い合わせ、
**「No response from server」＝サーバーが動いていないように見える**。UDP を直接叩く
スクリプトか、`windows/dns/tests/proxy.rs` の統合テストで確認すること。

## ビルド・検証コマンド

```bash
cargo build --workspace
cargo test --workspace
cargo fmt --all -- --check
cargo clippy --workspace --all-targets          # 警告ゼロ必須
cargo check -p policy-engine --target aarch64-linux-android   # Android 移植性ガード
```

lint は workspace の `Cargo.toml` で `deny` 済みなので `-D warnings` は不要。
Android ターゲットの `cargo check` はリンクしないため NDK なしで通る。

## 絶対に守る制約

### Policy Engine に I/O を入れない（最重要）

`policy-engine` と `domain-model` は OS API・ファイル・DB・ネットワークに触れない。
**現在時刻も取得しない** — 時刻は `Request.at` として引数で注入する。

この制約が Android 移植とテスト容易性の両方を支えている。破ると、判定ロジックが
Windows と Android で分岐し、子供の安全にかかわる判定を二重管理することになる。

```rust
// 悪い例: ネットワーク層が判定ロジックを持っている
if category == "adult" { return Action::Block; }   // Android に移植できない

// 良い例: ネットワーク層は Core に問い合わせ、結果の実現だけを担当
let verdict = core.decide(&request)?;              // 判定は Core が全部やる
```

`RequestSource`（Dns / Wfp / Cli / Ui）は記録用。**判定に使ってはいけない。**

### 実装してはいけないもの

HTTPS の MITM 復号 / 通信本文の保存 / パスワード取得 / キーロガー / 画面監視 /
Cookie 取得 / 個人メッセージ取得 / ステルス監視 / セキュリティソフトや
Windows Defender の無断停止。

ログに保存してよいのは `timestamp` `device_id` `domain` `category` `decision`
`profile` `rule_id` のみ。検索語・通信本文・ページ内容は保存しない。
将来 WFP を足すときに誤って混ぜないよう、**テーブル定義の時点で列を作らない**。

## 落とし穴

### ドメインマッチは階層を eTLD+1 で止める

`www.a.example.co.jp` は `example.co.jp` まで遡り、**`co.jp` や `jp` へは降りない**。
降りると「`co.jp` を許可」で日本のほぼ全ドメインが通る。

マッチは `ends_with` ではなく**ラベル境界**で行う。`ends_with` だと
`example.com` の登録が `notexample.com` にヒットする。

### CDN は「登録したのに一度もヒットしない」

`cloudfront.net` `akamaiedge.net` `googleapis.com` など大手 CDN は Public Suffix List に
載っている。`d111abc.cloudfront.net` の eTLD+1 は**それ自身**なので、上の規則により
`cloudfront.net` の登録には決して到達しない。しかもホスト名は顧客ごとのランダム文字列で
個別列挙もできない。**エラーは出ず、ページが崩れる形でだけ表面化する。**

`MatchScope::Suffix` を付けたレコードだけが配下すべてに及ぶ（ADR-0008）。付けてよいのは
**同梱の `infrastructure` レコードだけ**。`blogspot.com` や `github.io` も同じ公開
サフィックスだが、第三者が読めるサブドメインを取れるので付けてはいけない。

同梱ドメインを増やしたら `policy-engine/tests/bundled_domains.rs` の `SAMPLES` に
**ブラウザが実際に引くホスト名**を足すこと。登録しただけで効いていない状態を検出する。

### リスク上限にカテゴリ由来の危険度を混ぜない

`DomainRecord.risk_level` は**そのドメイン自身**への評価であり、カテゴリの既定リスクを
流し込んではいけない。混ぜるとリスク上限（6 段目）がカテゴリ別ルール（7 段目）を
追い越し、**プロファイルのカテゴリ設定が永久に効かなくなる**
（`video` の既定リスク Medium が BEGINNER の上限 Low を超えるため、
`video → Review` も BEGINNER_PLUS の `video → Allow` も到達しない）。

`CategoryRegistry.default_risk` は UI 表示と分類作業の補助にだけ使う。

### `doh` を保護者が解除できる状態に戻さない

`doh` は同梱プロファイルの `forced_block_categories` に入っている唯一のカテゴリ
（ADR-0009）。ここから外すと、保護者が許可リストに 1 件足しただけで
**DNS フィルターが丸ごと素通りになる**。しかも画面は「稼働中」のままで、
判定履歴が減るだけなので異常に見えない。

カテゴリ別ルール（7 段目）の `doh → Block` だけでは足りない。**保護者の許可は
4 段目**で、7 段目より先に効く。「遮断された記録」画面の「まとめて許可」は
まさにその動線なので、UI 側でも `cannot_allow` で選択対象から外してある。

### 未知ドメイン BLOCK は「ページが崩れる」形で出る

1 ページは CDN・フォント・API など多数の第三者ドメインを引く。しかも DNS クエリには
「本体か部品か」の情報が無いので Policy Engine 側でも区別できない。
基盤ドメインは `infrastructure` カテゴリで既定 allowlist に入れる。

### DNS フィルターだけでは DoH で素通りされる

Firefox は DoH を既定で使う設定を持ち、Chrome / Edge も子供が数クリックで有効にできる。
この状態では DNS プロキシにクエリが 1 件も来ない。**動いているように見えて素通りしている**
という最悪の失敗形になるため、DoH 対策は MVP に含める（ADR-0007）。

### `cargo tree -i windows` を CI ガードに使わない

依存が**存在しないとき**（＝正常時）にエラー終了するため、判定が逆になる。
ARCHITECTURE.md §5 の依存一覧方式を使う。

### WFP はユーザーモードから始める

`FwpmFilterAdd` / ALE レイヤなら**ドライバ不要**で Windows SDK だけでビルドできる。
カーネル callout ドライバは WDK と署名が必要で、必要と実証できるまで作らない。
Step 11 で実測済み（ADR-0010）。

`windows` crate で WFP を使うには feature が **3 つ**要る。
`Win32_NetworkManagement_WindowsFilteringPlatform` だけでは足りず、
`FWPM_SESSION0` に `Win32_Security`、`FwpmEngineOpen0` にはさらに
`Win32_System_Rpc` が要る。足りないと「関数が見つからない」という形の
コンパイルエラーになるので、**API 名を間違えたように見える**。

WFP フィルタは **v4 と v6 の両方**に入れる。`FWPM_LAYER_ALE_AUTH_CONNECT_V4`
だけでは、主要な DoH プロバイダはどこも IPv6 を持っているのでそのまま抜けられる。

### 日本語を含むファイルを PowerShell の文字列置換で書き換えない

`Get-Content -Raw` → `-replace` → `Set-Content` は UTF-8 の日本語を壊す。
編集は Edit / Write ツールで行うこと。

### 判定履歴のテーブルに列を足さない

`access_decisions` に保存してよいのは `timestamp` `device_id` `domain` `category`
`decision` `profile` `rule_id` だけ。列の集合はテストで固定してある
（`storage/src/migrations.rs`）。ページ本文・検索語・Cookie の列を作らない。

### Step 7 以降は管理者権限が要る

UDP 53 のバインドとサービス登録には昇格が必要。Step 6 の CLI までは非管理者で完結し、
そこでポリシーの正しさを全部検証できる。

## 進め方

機能ごとに **設計 → 実装 → テスト → ビルド → 確認** の順で進め、小さな単位で区切る。
既存コードを理由なく全面書き換えしない。

## コミット

`iFilter: 内容` の形式（リポジトリ共通の慣習）。
