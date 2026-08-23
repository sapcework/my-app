# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

未成年者向けの Windows ネットワークフィルター。最初の対象は**初めてインターネットを
利用する小学生**。ブラウザ拡張ではなく PC 全体の通信を対象にする。

**これはペアレンタルコントロールであり、スパイウェアではない。**

## ドキュメントの分担

- **[docs/SYSTEM_OVERVIEW.md](./docs/SYSTEM_OVERVIEW.md)** — **初めて読む人の入口。**
  何がどう動いているかを順を追って解説する。他の文書は前提を知っている人向けなので、
  まずここを読む
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

### DNS 差し替えは 1 件の失敗で打ち切らない

レジストリには、**いま存在しないアダプタの記録が残っている**（一度接続した
USB イーサネットなど）。そこへ `Set-DnsClientServerAddress` を実行すると
「オブジェクトが見つかりません」で失敗する。

ここで `?` を使うと**本命の Wi-Fi に到達しないまま終わる**。Step 10 の実機確認では、
これで DNS が 1 つも差し替わっていなかった。成功と失敗を分けて集める
（`dns_settings::Outcome`）。`revert` 側も同じ。

### サービスの `println!` はどこにも出ない

SCM が起動したプロセスにはコンソールが付かない。失敗しても何も残らないので、
`log::write` でファイルに書く（DB の隣の `service.log`）。
**判定履歴はここに流さない** — `access_decisions` の担当で、保存してよい項目が違う。

`service.log` を読むときは `Get-Content -Encoding UTF8`。**Windows PowerShell 5.1 の
既定は CP932** なので、付けないと日本語が化け、ログ側の不具合のように見える。

### 巡回の中で「毎回失敗すること」をそのままログに書かない

30 秒ごとの巡回（`enforce_dns_loop`）には、**直らない失敗が混ざる**。レジストリに
記録だけ残った実在しないアダプタがそれで、毎回必ず失敗する。1 行 250 バイトで
120 行/時になり、`log::write` の上限 1MB に 2 日足らずで達する。上限に達すると
ファイルごと作り直されるので、**起動時の記録が消える** — 「サービスは実行中なのに
効いていない」を追う手段が無くなる。ログが埋まるだけの問題に見えて、実際に失うのは
診断能力のほう。

かといって黙らせると、本命のアダプタが落ちた合図まで消える。`DnsReporter` が
**前回から変わったことだけ**を書く（新しい失敗・理由の変化・解消）。
巡回の中で繰り返しログを足すときは、ここを通すこと。

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

### 遮断する IP に共有 CDN のアドレスを混ぜない

`cloudflare-dns.com` は `1.1.1.1` **ではなく** `104.16.249.249`（Cloudflare の
共有 CDN レンジ）に解決される。ここを塞ぐと**無関係な顧客サイトが道連れになる**。
DoH の IP 遮断に載せてよいのは **DNS 提供専用の anycast だけ**（ADR-0010）。

同梱の IP を増やすときは、記憶で書かず `Resolve-DnsName` で引いて確かめること。
混入は `domain-model` のテストが止める（プライベート IP・ループバック・
Cloudflare 共有レンジ）。

### WFP の確認に `--enforce-dns` を使わない

サービスの `--enforce-dns` は DNS 設定の差し替えも同時に行うため、WFP だけを
試したいときに**端末の名前解決ごと巻き込む**。
`cargo run -p ifilter-wfp --example block_doh` を使う（管理者権限が要る）。

### `windows-registry` の `open` は読み取り専用

`LOCAL_MACHINE.open()` は `KEY_READ` だけで開く。そこから `remove_value` を呼ぶと
**アクセス拒否で失敗する**。書き換えるなら `create()` か
`options().read().write().open()` を使う。

しかも失敗を `let _ =` で捨てると、**「取り消しました」と表示しながら設定が残る**。
2026-08-23 の Edge / Firefox 確認の後始末で実際に起きた。保護者から見ると
「解除したのに DoH が使えないまま」という、原因の分からない形になる。

**レジストリを書き換えたら読み返して確かめる**（`browser_policy::remains`）。
成功したと報告してよいのは、消えたことを確認できたときだけ。

### 日本語を含むファイルを PowerShell の文字列置換で書き換えない

`Get-Content -Raw` → `-replace` → `Set-Content` は UTF-8 の日本語を壊す。
編集は Edit / Write ツールで行うこと。

### アイコンは `icons/` ではなく `app-icon.svg` を直す

`src-tauri/icons/` は生成物。直接編集しても**次の `npm run icon` で消える**。
原本は `src-tauri/app-icon.svg` の 1 枚だけ。

`npm run icon` は Android / iOS / macOS の分も作るので、スクリプトの後半で消している
（この製品は Windows だけを対象にする。Android 対応は Policy Engine の移植性として
用意してあるだけで、`apps/android/` は作らない）。

盾は **16x16 まで縮む**。縁取りや模様を足すと潰れて「何か青いもの」になる。
意匠を変えたら、生成後に `icon.ico` の 16px を取り出して目で見ること。

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
