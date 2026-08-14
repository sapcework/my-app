# MVP 実装手順

指示書 41 の Step 1〜12 を、実際の環境（ARCHITECTURE.md §1）に合わせて具体化したもの。

各ステップは **設計 → 実装 → テスト → ビルド → 確認** の順で進め、
1 ステップ完了ごとに動作を確認してから次へ進む。

---

## 非管理者で進められる範囲 / 昇格が必要な範囲

| ステップ | 権限 |
| --- | --- |
| Step 1〜6（Core・Storage・CLI） | **非管理者で完結する** |
| Step 7 以降（サービス・DNS・WFP） | 管理者昇格が必要 |

Step 6 の CLI までで **ポリシーの正しさは全部検証できる**。ネットワーク層に入る前に
判定ロジックを固めきることで、後段のデバッグが「配線の問題」だけに絞られる。

---

## Step 1 — Rust workspace の初期構造 ✅ 完了（2026-08-14）

- ルート `Cargo.toml`（workspace, resolver = "3", edition 2024, lint は deny 設定）
- `crates/domain-model` `crates/policy-engine` の空 crate
- `rustfmt.toml` / `.gitignore` / `CLAUDE.md`
- **ネットワークフィルターは作らない**

確認済み: `cargo build` `cargo test` `cargo fmt --check` `cargo clippy` がすべて通る。
Android 移植性ガード `cargo check -p policy-engine --target aarch64-linux-android` も
NDK なしで通ることを実機確認した。

## Step 2 — 型を作る ✅ 完了（2026-08-14）

`domain-model` に Domain / Category / RiskLevel / DomainRecord / Profile /
ParentOverride / Decision / Verdict / Request を定義する（POLICY_MODEL.md §1）。

ここで**ドメイン正規化と階層マッチ**を作り込む。TEST_PLAN.md §1-5 を先に書く。

確認済み: ユニットテスト 39 件が通る。clippy 警告ゼロ。
`domain-model` が aarch64-linux-android でコンパイルできる（依存の psl / idna /
time / uuid いずれも移植の障害にならないことを確認）。

依存: `serde` `uuid` `time`（rfc3339 のため formatting/parsing 有効）`psl` `idna`。
`psl` は Public Suffix List を crate に埋め込むため、実行時のリスト取得が要らない。
設計時に想定していた `publicsuffix` crate はリストを実行時に読む方式なので採用しなかった。

## Step 3 — Policy Engine ✅ 完了（2026-08-14）

`policy-engine` に 9 段の判定順序（POLICY_MODEL.md §3）を実装する。
`evaluate()` は純粋関数。時計・DB・OS API を一切触らない。

確認済み: 統合テスト 19 件が通る。clippy 警告ゼロ。aarch64-linux-android で
コンパイルできる。依存は `domain-model` と `time` のみ。

実装中に見つかった設計の誤りを 1 件修正した。リスク上限（6 段目）にカテゴリの
既定リスクを流し込むと、カテゴリ別ルール（7 段目）が到達不能になる。
`risk_level` はドメイン自身への評価だけを見るようにした（POLICY_MODEL.md §1-3）。

`PolicyContext` から `categories` を外した。判定に使わないものを入力に置くと、
将来また混ぜてしまうため。

## Step 4 — Policy Engine のテストを大量に作る ✅ 完了（2026-08-14）

TEST_PLAN.md §1 の全ケース。優先順位テストとプロパティテストを含む。

確認済み: **合計 123 件が通る**。判定 9 段すべてに到達するケースがある。

| ファイル | 対応 | 件数 |
| --- | --- | --- |
| `policy-engine/tests/stages.rs` | 各段の基本動作 | 19 |
| `policy-engine/tests/precedence.rs` | §1-3 判定順序 | 11 |
| `policy-engine/tests/parent_overrides.rs` | §1-2 保護者の上書き | 10 |
| `policy-engine/tests/domain_matching.rs` | §1-5 階層マッチ（エンジン越し） | 9 |
| `policy-engine/tests/category_composition.rs` | §1-4 カテゴリ合成 | 8 |
| `policy-engine/tests/profile_categories.rs` | §1-1 Profile × カテゴリ | 7 |
| `policy-engine/tests/trace.rs` | §1-6 Decision Trace | 7 |
| `policy-engine/tests/properties.rs` | §1-7 プロパティテスト | 6 |
| `domain-model`（ユニット + `tests/domain_properties.rs`） | §1-5 §1-7 | 45 |
| doctest | 使い方の例 | 1 |

単調性テストが実際に機能することを確認した。STANDARD の `dating` を一時的に
`Allow` に変えたところ、`categories=["dating"]` まで縮小した反例を出して失敗した。

### 注意: 依存混入チェックは `--edges normal` が必須

`proptest` は dev-dependency 経由で `tempfile` → `windows-sys` を持ち込む。
`cargo tree` を既定のまま使うと**健全な状態でも OS 固有 crate を検出してしまう**。
ARCHITECTURE.md §5 のレシピを使うこと。

## Step 5 — SQLite Storage ✅ 完了（2026-08-14）

`storage` crate。マイグレーション、`PolicyStore` trait の実装。
全テーブルに `id` `version` `created_at` `updated_at` `deleted_at`。

確認済み: インメモリ SQLite でのテスト 31 件が通る（codec 4・migrations 5・
統合 21・doctest 1）。ワークスペース全体で **157 件**。

実装上の決定:

- `rusqlite` の `bundled` を使い、SQLite をソースから同梱する。システムの
  SQLite に依存しないので Windows での配布が楽になる
- マイグレーションは `PRAGMA user_version` で管理する。専用テーブルより単純で、
  SQLite に元からある機能なので壊れにくい
- プロファイルのカテゴリ別ルールは JSON 列で持つ。入れ子構造であり、
  「どのプロファイルが adult を許可しているか」のような横断検索は要件に無い
- `ParentOverride` に `updated_at` / `deleted_at` を追加した。Allowlist から
  1 件消したことを他の端末へ同期するには、物理削除では表現できないため

**`storage` は Android チェックの対象外**（ARCHITECTURE.md §5）。
`bundled` が SQLite を C からビルドするため NDK が要る。

## Step 6 — CLI ✅ 完了（2026-08-14）

```bash
ifilter init                                        # DB 作成 + 同梱データ投入
ifilter check example.com --profile beginner --trace
ifilter allow example.com --reason "学校の宿題"
ifilter block ads.example.com
ifilter classify school.example.jp --category education
ifilter list
ifilter log --limit 20
```

`filter-core` を作り、CLI から叩く。**MVP の最初の受け入れ確認点。**

確認済み: 実際にコマンドを実行して期待どおりの出力を得た。テストは
`filter-core` 10 件 + CLI 表示 5 件。ワークスペース全体で **172 件**。

- `check` の終了コードは ALLOW=0 / BLOCK=1 / REVIEW=3。スクリプトから使えるようにするため
- `check` は既定で履歴に残さない。診断で履歴を汚さないため、記録は `--log`
- `--json` で `Verdict` をそのまま出せる。UI や自動テストが読む用
- `allow` / `block` は公開サフィックス（`co.jp` など）を拒否する
- DB の既定位置は `%LOCALAPPDATA%\iFilter\ifilter.sqlite`。非管理者で書ける

`filter-core` は判定の唯一の入口。ポリシーはメモリ上の `PolicySnapshot` に載せ、
設定を書き換えたときだけ読み直す（DNS は 1 ページ表示で数十件飛ぶため、
問い合わせのたびに DB を読むわけにはいかない）。

## Step 6.5 — 同梱ドメインデータ ✅ 完了（2026-08-15）

Step 6 まででポリシーの正しさは検証できたが、**DB には `DomainRecord` が 1 件も
無かった**。この状態で DNS プロキシを繋ぐと全ドメインが未分類 → BEGINNER では
全部 BLOCK になり、CDN もフォントも止まって何も表示できない。

`domain-model/src/bundled.rs` に初期分類を同梱し、`seed_builtins` から投入する。

- 基盤（CDN・フォント・OCSP・NTP・OS 更新）／検索／学習・辞書／DoH プロバイダ
- `doh` カテゴリを新設。Firefox の canary ドメイン `use-application-dns.net` を
  ここに入れることで、**DNS 層に特別扱いを書かずに** BLOCK → NXDOMAIN が
  そのまま DoH 無効化として働く（Step 8 の DoH 対策の中核）
- 同梱レコードの ID はドメイン名からの UUID v5。`init` を繰り返しても重複しない

実装中に設計上の穴を 1 件見つけて対処した。大手 CDN 13 件は Public Suffix List に
載っているため、eTLD+1 で打ち切る階層マッチでは**登録しても一度もヒットしない**。
`MatchScope::Suffix` を追加した（ADR-0008・migration 002）。

確認済み: ワークスペース全体で **197 件**が通る。clippy 警告ゼロ。
`policy-engine/tests/bundled_domains.rs` が実在のホスト名
（`d111abcdef8.cloudfront.net` など）で照合を検査する。

---

## Step 7 — Windows サービス

`windows/service`。UI を終了してもフィルターが動き続ける。自動起動。
昇格が必要になるのはここから。

確認: サービスの登録・起動・停止・PC 再起動後の自動起動。

## Step 8 — DNS フィルター統合

`windows/dns`。UDP 53 でリッスンし、`filter-core` に問い合わせて
ALLOW は上流へフォワード、BLOCK は NXDOMAIN。

**あわせて DoH 対策を入れる**（ARCHITECTURE.md §7-2）。これが無いと
「ブラウザに依存しない遮断」という MVP の目的が達成できないため、後回しにしない。

- Firefox canary domain (`use-application-dns.net`) への NXDOMAIN 応答
- Chrome / Edge の DnsOverHttpsMode をポリシーで無効化
- 既知 DoH プロバイダのドメインを BLOCK

確認: TEST_PLAN.md §4。

## Step 9 — Tauri UI

`apps/windows-ui`。Tauri 2.11 + React 19 + TypeScript（fast-browser と同構成）。
Dashboard / Profile / Category / Allowlist / Blocklist / Requests / Settings。

Filter OFF は UAC 昇格で保護する（ARCHITECTURE.md §7-4）。

確認: Verdict の `reason` と `matched_rule` が保護者に読める形で表示される。

## Step 10 — ブラウザ統合テスト

Chrome / Edge / Firefox。TEST_PLAN.md §5。
**CDN・フォントを含む実サイトでページが崩れないこと**を必ず確認する。

## Step 11 — WFP の設計・検証

**ユーザーモード WFP（`FwpmFilterAdd` / ALE レイヤ）から始める。**
Windows SDK だけでビルドでき、現環境で着手できる（ARCHITECTURE.md §1）。
カーネル callout ドライバは、必要と実証できるまで作らない。

## Step 12 — 必要な WFP 機能だけ追加

DNS 回避（IP 直打ち・DoH の IP アクセス）を塞ぐ最小限に絞る。

---

## MVP のスコープ

**含む**: Rust workspace / Filter Core / Policy Engine / Profile / Category /
ALLOW・BLOCK・REVIEW / Allowlist / Blocklist / Unknown handling / Decision Trace /
SQLite / Windows Service / ローカル DNS フィルタリング / Tauri UI /
BEGINNER profile / ユニットテスト / 統合テスト
／**＋ DoH 対策**（ARCHITECTURE.md §7-2 により必須と判断）

**含まない**: WFP 高度化 / QUIC 対策 / Parent PIN（UAC で代替）/ 許可申請の承認フロー
（UI とデータモデルまで）/ AI 分類 / Android / クラウドサーバー / マルチデバイス
