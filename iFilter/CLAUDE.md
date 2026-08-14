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
```

`check` は終了コードで判定を返す（ALLOW=0 / BLOCK=1 / REVIEW=3）。
**PowerShell では BLOCK が「コマンド失敗」に見えるが正常。**

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

### リスク上限にカテゴリ由来の危険度を混ぜない

`DomainRecord.risk_level` は**そのドメイン自身**への評価であり、カテゴリの既定リスクを
流し込んではいけない。混ぜるとリスク上限（6 段目）がカテゴリ別ルール（7 段目）を
追い越し、**プロファイルのカテゴリ設定が永久に効かなくなる**
（`video` の既定リスク Medium が BEGINNER の上限 Low を超えるため、
`video → Review` も BEGINNER_PLUS の `video → Allow` も到達しない）。

`CategoryRegistry.default_risk` は UI 表示と分類作業の補助にだけ使う。

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
