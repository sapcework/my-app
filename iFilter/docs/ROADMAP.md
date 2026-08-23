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

## Step 7 — Windows サービス ✅ 完了（2026-08-15）

`windows/service`。UI を終了してもフィルターが動き続ける。自動起動。
**Step 8 を先に済ませてある**ので、ここでやったのは常駐と昇格が要る配線だけ。

```powershell
# 管理者の PowerShell で
ifilter-service install --db C:\ProgramData\iFilter\ifilter.sqlite --upstream 192.168.10.1:53
ifilter-service start / stop / status / uninstall
ifilter-service console --db ...        # サービスにせず前面で動かす（デバッグ用）
```

実装上の決定:

- **設定はサービスの ImagePath 引数に持つ。** DB の場所を DB から読むことはできず
  どこかに置く必要があるが、レジストリを増やすより `sc qc iFilter` で全部見えるほうが
  追いやすい。`install` 時に `%PROGRAMDATA%` を解決してから書き込むので、
  登録時と起動時で解釈がずれる余地が無い
- **DB の既定は `%PROGRAMDATA%\iFilter`。** サービスは LocalSystem で動くので
  CLI の既定（`%LOCALAPPDATA%`）は使えない。**両者をそろえるには `--db` を明示する**
- **`run` と `console` は同じ経路を通る。** 「サービスだと動かない」をデバッグしづらい
  形で作り込まないため
- サービスは `SERVICE_CONTROL_SHUTDOWN` も受ける。止め損ねると次回起動時に
  53 番が空かない
- **DNS 設定の差し替えは `--enforce-dns` を付けたときだけ。** 既定では 53 番で
  待ち受けるだけで端末の名前解決に影響しない。有効化は「ネットに繋がらない」事故に
  直結するので、意図しない有効化が起きない形にした

### DNS 設定の差し替え（ARCHITECTURE.md §7-7）

**インターフェース個別に設定し、30 秒ごとに再適用する。** VPN・USB テザリング・
新しい Wi-Fi アダプタが後から現れても次の巡回で拾う。最悪 30 秒の窓が残るが、
そこを完全に塞ぐのは WFP（Step 11〜12）の仕事。

読み取りと書き込みで手段を分けてある。

- **現状の把握はレジストリ。** 日本語 Windows でも表示文字列に左右されず、
  30 秒ごとに呼んでも軽い（`netsh show` の出力解析はロケール依存で壊れる）
- **変更は PowerShell の `Set-DnsClientServerAddress`。** DHCP へ戻す操作が
  `-ResetServerAddresses` 一発で正しくできる

元の設定は `settings` テーブルに JSON で残し、`revert-dns` で戻せる。
**記録は上書きしない** — 2 回目の巡回で「iFilter に向いた状態」を元の設定として
記録すると二度と戻せなくなるため。

「DNS が 1 件目だけ iFilter」では不十分で、予備が並んでいたら差し替える。
遮断した瞬間にクライアントが 2 番目へ問い合わせて素通りするため。

### ブラウザの DoH をポリシーで無効化

`apply-browser-policy` で Chrome / Edge の `DnsOverHttpsMode = off`、
Firefox の `DNSOverHTTPS\Enabled = 0` / `Locked = 1` を `HKLM\SOFTWARE\Policies` に書く。

同梱データの `doh` カテゴリと**二重**にかける。役割が違う。

- 同梱データ: 既知のプロバイダを名前で止める。知らないプロバイダは抜ける
- ポリシー: ブラウザに「DoH を使うな」と設定させる。プロバイダを問わず効く

取り消しはキーごとではなく **iFilter が書いた値だけ**消す。他の管理設定が
同じキーに同居している場合にまとめて消さないため。

### 異常終了時のフォールバック（ARCHITECTURE.md §7-3）

- SCM の失敗時アクションで 10 秒後に再起動（3 回まで、24 時間で数え直し）。
  フィルターが黙って止まったままだと「効いているつもりで素通り」になる
- サービス終了時は必ず DNS 設定を元に戻す。戻さないと名前解決ができないまま残る
- 保護者（管理者）の復旧経路は `revert-dns`。サービスが起動できない状態でも
  単体で実行できる

### 実機確認で見つかった不具合 2 件

どちらも「サービスは実行中なのに効いていない」という、この製品で最も避けたい
失敗形につながるもの。**テストだけでは出ず、実際にサービスとして動かして初めて出た。**

**1. 待ち受け前に SCM へ実行中と報告していた**

起動から待ち受け開始まで DB の準備に約 0.6 秒かかる。その前に `Running` と
報告していたため、`start` の直後に投げた問い合わせが**まだ誰も居ないポート**へ
届いて失敗していた（Windows では ICMP が返り WSAECONNRESET になる）。

まず `StartPending` を報告し、**ソケットを確保してから** `Running` にする。
`serve` の `bound` コールバックを「準備完了」の合図として使う。

**2. 受信エラーで待ち受けごと終了していた**

Windows では、すでに閉じたクライアントのポートへ応答を返すと ICMP が返り、
**こちらの次の受信が失敗する**（WSAECONNRESET）。問い合わせは常に別プロセスから
来るので日常的に起きるが、`recv_from` のエラーをそのまま返して待ち受けを畳んでいた。
相手が 1 つ先に消えただけでフィルター全体が黙って止まる。

エラーは読み飛ばして続け、連続 100 回で初めてソケットが壊れているとみなす。
より確実にするなら `SIO_UDP_CONNRESET` を無効化する手もあるが、WSAIoctl が要るので
今は見送っている。

**あわせてサービスの動作ログを追加した**（DB の隣の `service.log`）。SCM が起動した
プロセスにはコンソールが付かず `println!` が捨てられるため、失敗しても何も
残らなかった。この 2 件も、ログを入れて初めて切り分けられた。

判定履歴は `access_decisions` テーブルが持つので、**問い合わせられたドメインを
このログに流さない**（docs/POLICY_MODEL.md §5）。

### 確認済み（2026-08-15・管理者権限で実施）

テスト 21 件（設定 5 / DNS 差し替え 12 / ブラウザポリシー 4）。
ワークスペース全体で **250 件**。clippy 警告ゼロ。

実機での通し確認:

| 項目 | 結果 |
| --- | --- |
| 登録・`sc qc` の内容 | ImagePath・自動起動・LocalSystem とも意図どおり |
| 開始と 53 番の待ち受け | `127.0.0.1:53` を `ifilter-service` が保持 |
| `ja.wikipedia.org` | NOERROR（上流へ転送） |
| `d111abcdef8.cloudfront.net` | 転送（CDN のサフィックス照合が効いている） |
| `use-application-dns.net` | NXDOMAIN（Firefox の DoH 無効化が成立） |
| `some-unclassified-site.com` | NXDOMAIN（未知は遮断） |
| 停止・登録削除 | 正常。停止後は応答しない |
| 判定履歴 | 4 件とも `access_decisions` に記録されている |

**未確認**: PC 再起動後の自動起動。DNS 差し替え（`--enforce-dns`）と
ブラウザポリシーは実装のみで、開発機には適用していない。

## Step 8 — DNS フィルター統合 ⚠️ 大半完了（2026-08-15）

`windows/dns`。UDP でリッスンし、`filter-core` に問い合わせて
ALLOW は上流へフォワード、BLOCK / REVIEW は NXDOMAIN。

**Step 7 より先に着手した。** 高位ポート（既定 `127.0.0.1:15353`）で動く
コンソール版なら非管理者でテストまで完結し、53 番と常駐は「配線」だけになるため。

```bash
cargo run -p ifilter-dns -- --db <path> --upstream 192.168.10.1:53 --verbose
```

実装上の決定:

- **DNS メッセージは自前で最小限だけ扱う。** 問い合わせから名前を取り出すことと、
  遮断の応答を組み立てることだけ。ALLOW は生バイトのまま転送して応答も
  そのまま返すので、応答の解析が要らない。新しいレコード種別が出ても壊れない
- 質問セクションの圧縮ポインタは**追いかけずに拒否する**。細工されたパケットで
  無限ループしうるうえ、問い合わせには本来現れない
- QTYPE で判定を変えない。HTTPS(65) レコードは ECH や代替接続先の広告に使われ、
  A だけ見て通すと遮断を迂回される
- 上流障害は **SERVFAIL** で返す。NXDOMAIN にすると否定応答がキャッシュされ、
  上流が復旧しても引けない状態が続く
- 履歴の書き込みに失敗しても判定は続ける。記録できないことを理由に通信を止めると、
  DB の不調が「ネットに繋がらない」事故になる
- REVIEW も通さない。DNS の応答に「確認中」を表す手段が無いため。履歴には
  REVIEW として残るので、保護者 UI の許可申請に出せる

DoH 対策（ARCHITECTURE.md §7-2）のうち、ドメイン遮断ぶんは **Step 6.5 の同梱データ**で
実現済み。`doh` カテゴリが BLOCK → NXDOMAIN になるだけなので、DNS 層に特別扱いの
コードは無い。Firefox の canary も同じ経路で無効化される。

確認済み: テスト 29 件（`message` 16 / `upstream` 2 / 統合 11）。ワークスペース全体で
**226 件**。実機でルータを上流に指定し、期待どおりの応答を確認した。

### 残り（管理者権限が要るので Step 7 に回す）

- UDP 53 番でのバインド
- Windows の DNS 設定を `127.0.0.1` に差し替える（ARCHITECTURE.md §7-7 の
  インターフェース漏れ対策を含む）
- Chrome / Edge の `DnsOverHttpsMode` をレジストリで無効化

確認: TEST_PLAN.md §4。

## Step 9 — Tauri UI ✅ 完了（2026-08-15）

`apps/windows-ui`。Tauri 2.11 + React 19 + TypeScript 6 + Vite 8（fast-browser と同構成）。

```bash
cd apps/windows-ui
npm install
npm run verify      # typecheck / lint / vitest / cargo fmt / clippy / cargo test
npm run tauri dev   # 管理者の PowerShell から実行する（下記）
```

**`npm run tauri dev` は管理者の PowerShell から実行する。** `cargo run` は
`CreateProcess` で exe を起動するため、`requireAdministrator` のマニフェストが
あると **UAC ダイアログが出ないまま `os error 740` で落ちる**。ビルドが全部
通ってから最後に失敗するので、コードの問題に見える。エクスプローラーからの
起動は `ShellExecute` なので UAC が出る（製品としての起動は正常）。

### 画面

| 画面 | 中身 |
| --- | --- |
| ホーム | 稼働状態・24 時間の集計・**「このサイトは見られる？」**（判定と 9 段のトレース）・最近の記録 |
| 遮断された記録 | 時間の近いものをまとめて表示し、選んでまとめて許可する |
| プロファイル | 4 つから選ぶ。未分類の扱い・リスク上限・要確認の扱いを表示 |
| サイトの種類 | カテゴリごとの Allow / Review / Block をプロファイル別に編集 |
| 許可リスト / 拒否リスト | 保護者の上書き。サブドメイン適用の有無つき |
| 設定 | フィルター ON/OFF・ブラウザの DoH 無効化・DB の場所 |

### 実装上の決定

- **起動時に管理者権限を必須にする**（`build.rs` のマニフェスト）。UAC は起動時の
  1 回だけで、以降は全機能が使える。子供のアカウントを標準ユーザーにしておけば
  保護者の資格情報なしには開けない。DB も `%PROGRAMDATA%` にあり標準ユーザーには
  書けないので、要求する権限と実際に必要な権限が一致している（ARCHITECTURE.md §7-4）
- **`Verdict` は加工せずそのまま渡す。** 「なぜブロックされたか」を保護者が読めることが
  この製品の価値そのもので、要約すると意味が薄れる（POLICY_MODEL.md §1-6）
- **判定ロジックは Rust 側にも React 側にも書かない。** コマンドは `filter-core` の
  薄い包み。書いた瞬間に「UI では許可なのに DNS では遮断」が起こりうる状態になる
- 設定の書き換えは必ず `filter-core` 経由。DB を直接触ると版数が進まず、
  動いているサービスが古いポリシーのまま動き続ける
- **Tauri crate はルートの workspace から `exclude` する。** `generate_context!` が
  ビルド時に `dist/` を要求するため、UI をビルドしていない状態で
  `cargo build --workspace` が失敗してしまう。UI 側は `npm run verify` が自前で回す
- サービス制御は `windows/service` を lib 化して共有する。手順を 2 か所に書くと
  片方だけ直して食い違う

### 遮断された記録のまとめ方

ARCHITECTURE.md §7-1 は「そのページで BLOCK された関連ドメインを併記してまとめて許可」を
求めているが、**DNS には「どのページ由来か」の情報が無い**。時間の近さ（5 秒以内）で
まとめた**推測**にしてあり、画面でもそう伝えている。1 件ずつ許可させると、CDN や
フォントを含むページでは運用が破綻するため、推測でもまとめる価値が勝ると判断した。

### 表示名の食い違いを検出する

`Stage` や `Reason` の serde 名が変わると、画面には生の識別子がそのまま出る。
エラーにならず静かに読みにくくなるだけなので、
`src-tauri/src/dto.rs` のテストが名前を固定してある。変えるときは
`src/labels.ts` も一緒に直すこと。

### 実機確認で見つかった不具合 3 件（2026-08-15）

**1. マニフェストの差し替えで起動できなかった**

`WindowsAttributes::app_manifest` は tauri-build の既定マニフェストを丸ごと
置き換える。既定の中身は Common-Controls v6 の依存宣言だけなので、管理者権限の
要求だけを書いたことでその宣言が消え、comctl32 が v5 で読み込まれていた。
wry/tao が静的インポートしている `SetWindowSubclass` `TaskDialogIndirect` は
v6 にしかないため、**起動した瞬間に `STATUS_ENTRYPOINT_NOT_FOUND` で落ちる**。

ビルドは通り、メッセージもコードと無関係な形で出る。`dumpbin /imports` で
comctl32 から何を引いているかを見て特定した。

**2. スクロールすると左のメニューが消えた**

`.nav` に固定指定が無く、ページ全体が一体でスクロールしていた。「遮断された
記録」のように縦に長い画面では、スクロールした先から他の画面へ移動できない。
`position: sticky` + `align-self: start` + `height: 100vh` で固定した。

**3. 保護者が DoH プロバイダを許可できてしまった**（最も重い）

「遮断された記録」は近い時刻の遮断を**既定で全件チェック**して「まとめて許可」
ボタンを出す。そこに `use-application-dns.net` が混ざっていた。保護者の許可は
4 段目で `doh` のカテゴリルール（7 段目）より先に効くため、**押した瞬間に DNS
フィルターごと素通りになる**。画面は「稼働中」のままで異常に見えない。

`doh` を全プロファイルの `forced_block_categories` に入れて Policy Engine で
塞ぎ（ADR-0009）、UI でも `cannot_allow` で選択対象から外して理由を表示する。
CLI の `allow` も同じ場合に警告を出す（登録は拒否しない。判定は 3 段目が
単独で行うので、警告が出なくても素通りにはならない）。

### 確認済み（2026-08-15・管理者権限で実施）

TypeScript テスト 5 件 + Rust テスト 18 件。typecheck・lint・fmt・clippy
すべてクリーン。ワークスペース側は **260 件**。

| 画面 | 結果 |
| --- | --- |
| ホーム | 稼働状態・24 時間の集計・最近の記録が表示される |
| ホーム「このサイトは見られる？」 | `use-application-dns.net` で遮断と 6 段のトレースが出る |
| 遮断された記録 | 07:12 と 07:19 の 2 つのまとまりに分かれて表示される |
| プロファイル | 4 つが並び、選択中と各プロファイルの扱いが出る |
| サイトの種類 | カテゴリ一覧と Allow / Review / Block の切り替えが出る |
| 許可リスト / 拒否リスト | 追加欄と登録済み一覧が出る |
| 設定 | 未設置の案内・ブラウザ DoH の状態・DB の場所が出る |

**未確認**: アイコンは仮のもの（青地に白い盾）。

## Step 10 — ブラウザ統合テスト ✅ 完了（2026-08-16）

Chrome で実施。TEST_PLAN.md §5。

### 確認できたこと

| 項目 | 結果 |
| --- | --- |
| 許可サイトが表示できる | Wikipedia・Google が崩れずに表示 |
| 未知サイトが表示できない | `www.yahoo.co.jp` が遮断 |
| 許可した直後に反映される | 数秒で反映（サービスは 2 秒ごとに版数を見る） |
| CDN・書体を含むページが崩れない | まとめて許可で復旧 |
| **DoH を有効にしても素通りしない** | `dns.google` 指定でも遮断された |
| **DoH の URL に IP を直接書いても塞がる** | `1.1.1.1` 指定でも遮断された（WFP） |
| サービス再起動で復旧する | 停止で元の DNS に戻り、起動で再び差し替わる |

**未確認**: PC 再起動後の自動起動。Edge / Firefox での確認。

### 見つかった不具合 5 件

**どれも実機で動かさなければ気づけなかった。** 特に 1 件目は
「サービスは動いているのに DNS が 1 つも差し替わっていない」という、
この製品で最も避けたい失敗形だった。

**1. DNS 差し替えが全く効いていなかった（最も重い）**

レジストリには、いま存在しないアダプタの記録が残っている（一度接続した
USB イーサネットなど）。`apply()` はそこへの設定に失敗した時点で `?` で返るため、
**本命の Wi-Fi に一度も到達していなかった**。

しかも失敗は `eprintln!` で出していた。CLAUDE.md に「サービスの `println!` は
どこにも出ない」と書いた落とし穴を、この経路だけが踏んでいた。
Step 7 で他は直したが、DNS 差し替えの中が残っていた。**成功も失敗も記録されず、
黙って何も起きない**状態だった。

1 件失敗しても残りを続けるようにし（`Outcome` 型）、すべて `log::write` にした。

**2. 「まとめて許可」が重複で埋まる**

`s.yimg.jp` が 7 行、`quriosity.yahoo.co.jp` が 4 行……と並び、
**20 行の中身が 4 種類しかなかった**。1 ページの読み込みで同じ配信元へ
何十回も問い合わせるので当然だが、これでは必要なドメインが枠からあふれる。
同じドメインは 1 行にまとめ、回数を表示するようにした。

**3. セキュリティソフトの通信を遮断していた**

`update.eset.com` `livegrid.eset.systems` `signals.urs.microsoft.com` が
未分類として遮断されていた。CLAUDE.md が禁じている「セキュリティソフトの
無断停止」に、意図せず該当していた。**ページは崩れないので記録を見なければ
気づけない**形の問題。`security` カテゴリを新設して既定で許可する。

**4. `pki.goog` が遮断されていた**

Google の証明書失効確認。同梱データには DigiCert などを入れていたが
Google の PKI が抜けていた。ページは崩れないが接続のたびに待たされる。

**5. サービスログの PowerShell エラーが文字化けしていた**

日本語 Windows のコードページで返るため、ログに載せると読めなかった。
出力を UTF-8 に固定し、十数行あるエラーは要点の 1 行だけ載せるようにした。

### 許可ドメインの選び方 ✅ 対応済み（2026-08-23）

`www.yahoo.co.jp` を許可しても `quriosity.yahoo.co.jp` には届かない。
「サブドメインを含む」は**配下**に及ぶだけで、兄弟には及ばないため。
正しくは `yahoo.co.jp` を許可する必要がある。**保護者も同じ間違いをする。**

許可リスト・拒否リストの入力欄で、入力が落ち着いた時点（250ms）で
`inspect_domain` に尋ね、その場で助言を出すようにした。

| 入力 | 画面に出るもの |
| --- | --- |
| `www.yahoo.co.jp` | 「`www.` 以外で始まる名前には許可が届きません」＋**`yahoo.co.jp` にする** |
| `yahoo.co.jp` | 「その下のすべての名前が対象になります」 |
| `co.jp` | 追加ボタンを止める（Rust 側も同じ理由で断る） |
| `YAHOO.co.jp.` | 「`yahoo.co.jp` として登録されます」 |

- **種類は見出しの言葉で伝える**（「届かない名前があります」「登録できません」など）。
  色と左の線は補強でしかない。開発機が電子ペーパーで、注意（`--review`）と
  危険（`--block`）が同じ濃さに潰れて**区別できないことが実機確認で分かった**
- **提案を受け入れたら「下の階層も」も一緒に入れる。** eTLD+1 を単体で登録しても
  `www.` すら対象にならず、提案の意味（サイト全体）が果たせない
- eTLD+1 の算出は Rust 側（`DomainCheck.registrableDomain`）。公開サフィックス表を
  持っているのはそちらだけで、**UI に似た処理を書くと判定と食い違う**
- 文言の組み立ては `src/domainHint.ts` に純粋関数として分けた。助言が実際の照合規則と
  食い違っても画面は落ちず、「助言どおりに登録したのに見られない」形でしか出ないので、
  文言の中身までテストで押さえる（`domainHint.test.ts` 9 件）
- 拒否リストでも同じ助言を出す。こちらは間違えると**通ってしまう**側に倒れる

### Edge / Firefox での確認 ✅ 完了（2026-08-23）

Step 10 は Chrome だけだった。DoH の扱いが最も違う Firefox を含めて確認した
（Firefox はこの時点で未インストールだったので winget で入れた）。

**ブラウザポリシー**（`apply-browser-policy`。3 ブラウザとも「無効化済み」）

| ブラウザ | 見たところ | 結果 |
| --- | --- | --- |
| Edge | `edge://policy` | `DnsOverHttpsMode = off` |
| Firefox | `about:config` の `network.trr.mode` | `5`（完全無効）で**編集できない**＝ `Locked` が効いている |

**DNS**（`--enforce-dns` で `Wi-Fi 2 → 127.0.0.1`。6 項目とも期待どおり）

| ドメイン | 結果 | ルール |
| --- | --- | --- |
| `use-application-dns.net` | 遮断 | `beginner.forced.doh`（canary。NXDOMAIN で Firefox が DoH をやめる） |
| `dns.google` / `cloudflare-dns.com` | 遮断 | `beginner.forced.doh` |
| `example.org` | 遮断 | `beginner.unknown.block` |
| `www.yahoo.co.jp` / `github.com` | 通る | `parent.allow` |

`i1.livegrid.eset.systems` が `beginner.category.security` で ALLOW、Windows の
テレメトリ（`v10.events.data.microsoft.com` など）が BLOCK として履歴に出ており、
**ブラウザ以外も含めて PC 全体が通っている**ことも確認できた。

`イーサネット 2`（実在しないアダプタ）の差し替えは今回も失敗したが、そこで止まらず
本命の `Wi-Fi 2` に到達している。Step 10 で入れた `Outcome` 型がそのまま働いた。

#### 確認手順で分かったこと

**`start` の直後に DNS を読んでも、まだ差し替わっていない。** サービスは
「待ち受けを始めてから」差し替える（先に向けると、その隙間で端末の名前解決が
丸ごと失敗するため）。3 秒待って読む手順では**差し替えが効いていないように見える**。
確認スクリプトは 127.0.0.1 になるまで最大 40 秒待つようにした。

#### 後始末で見つかった不具合（修正済み）

`revert-browser-policy` は「取り消しました」と表示するのに、**レジストリに値が
残っていた**。`LOCAL_MACHINE.open()` は読み取り専用で開くため `remove_value` が
アクセス拒否で失敗し、その失敗を `let _ =` で捨てていた。

保護者から見ると「解除したのに DoH が使えないまま」になる。エラーは出ないので
気づけない。ここまで確認してきた「動いているつもり」の失敗形と同じ。

- 読み書き両方で開くようにした（`options().read().write().open()`）
- **消したあとに読み返して確かめる**（`remains`）。消えていなければ失敗として返す
- 回帰テストを足した。HKLM は管理者権限が要るので、HKCU の専用の置き場を根にして
  同じ道を通す。直す前の書き方に戻すと落ちることも確認した

#### 見つかった限界（不具合ではない）

`www.yahoo.co.jp` の許可では記事一覧（`quriosity.yahoo.co.jp`）に届かず、
eTLD+1 の `yahoo.co.jp` を許可した。**直し方としては正しく、当日実装した提案機能が
そのまま効くことの実証**にもなった。

ただしその結果、トップページの記事・広告枠に小学生に見せたくない見出しが並んだ。
外部の広告配信元（`ib.adnxs.com`・`criteo.com`）は BLOCK のままだったので、
**それらは `yahoo.co.jp` 自身の配信**である。サイト全体を許可する以上、DNS の粒度では
分離できない。**ARCHITECTURE.md §7-9** に記録した。

## Step 11 — WFP の設計・検証 ✅ 完了（2026-08-16）

**ユーザーモード WFP（`FwpmFilterAdd` / ALE レイヤ）から始める。**
Windows SDK だけでビルドでき、現環境で着手できる（ARCHITECTURE.md §1）。
カーネル callout ドライバは、必要と実証できるまで作らない。

設計は **ADR-0010** にまとめた。実装は Step 12。

### 使い捨ての PoC で先に確かめたこと

「ユーザーモードで足りる見込み」は ARCHITECTURE.md §1 の**見込みでしかなかった**ので、
方式を決める前に実際に動かした。`1.1.1.1:443` への TCP 接続が、フィルタの前後で
どうなるかを見るだけの短いコード。

| 確かめたこと | 結果 |
| --- | --- |
| WDK なし・Windows SDK だけでビルドできるか | できた |
| 非管理者でエンジンを開けるか | **開けた** |
| 非管理者でフィルタを追加できるか | できない（`ERROR_ACCESS_DENIED`） |
| ALE レイヤのフィルタが実際に効くか | **効いた**（接続可 → 接続不可） |
| プロセス終了でフィルタが消えるか | **消えた**（接続不可 → 接続可） |

`windows` crate 0.62 で必要な feature は 3 つ。
`Win32_NetworkManagement_WindowsFilteringPlatform` だけでは**足りない**（
`FWPM_SESSION0` は `Win32_Security`、`FwpmEngineOpen0` は加えて `Win32_System_Rpc`
に依存する）。関数が「見つからない」形でコンパイルエラーになるので、
API 名を間違えたように見える。

PoC はリポジトリに残していない。

## Step 12 — 必要な WFP 機能だけ追加 ✅ 完了（2026-08-16）

DNS 回避のうち、**既知 DoH プロバイダの IP アクセス**を塞ぐ最小限に絞った
（ADR-0010）。一般サイトへの IP 直打ちは対象外。強い方式（DNS 由来 IP の
許可制）は副作用が重く、「特定のアプリだけ原因不明で繋がらない」を招くため。

- `windows/wfp` を新設。生の Win32 API を呼ぶので `unsafe` はこの crate に閉じる
- ALE レイヤは v4 と **v6 の両方**。片方だけでは残った側で抜けられる
- 動的セッション（fail-open）。異常終了で通信が塞がったまま残ると復旧できない
- 同梱データの `doh` に対応する IP を列挙する。ハードコードする以外にない
  （その名前は iFilter 自身が BLOCK しているので起動時に解決できない）

### IP は記憶で書かず実測した

`Resolve-DnsName` で 1 件ずつ引いた。そこで**載せてはいけない IP** が見つかった。

`cloudflare-dns.com` は `1.1.1.1` **ではなく** `104.16.249.249` に解決される。
Cloudflare の**共有 CDN レンジ**で、無関係な顧客サイトが多数同居している。
塞いでいたら「なぜか一部のサイトだけ見られない」を作り込んでいた。
`dns.nextdns.io` も解決先が地域ごとに変わり専用とは言えない。

**載せるのは DNS 提供専用の anycast IP だけ**にした。この 2 つはドメイン名では
遮断されるので無防備にはならない（数字で直接指定された場合だけが抜ける）。

混入を機械的に止めるテストを置いてある。プライベート IP・ループバック・
Cloudflare 共有レンジのいずれかが入ると落ちる。

### WFP の適用は `--enforce-dns` に連動させる

フラグを増やすと「どれを付ければ守られるのか」が分かりにくくなる。
どちらも「遮断を実際に強制する」モードなのでまとめた。

**WFP が失敗しても待ち受けは続ける。** ここが効かなくてもドメイン名の遮断は
働いており、サービスごと落とすと DNS フィルタまで失う。害の大きいほうを避けた。
ただし黙って進むと「効いているつもり」になるので `service.log` に必ず残す。

### 確認済み（2026-08-16・管理者権限で実施）

テスト 11 件（`domain-model` の IP 検査 5 / `windows/wfp` 5 / doctest 1）。
ワークスペース全体で **273 件**。clippy 警告ゼロ。Android 移植性も維持。

`cargo run -p ifilter-wfp --example block_doh` で通しの確認をした。
サービスの `--enforce-dns` は DNS 差し替えも同時に行うため、WFP だけを試す入口として
example を用意してある。

| 段階 | `1.1.1.1` / `8.8.8.8` への接続 |
| --- | --- |
| 塞ぐ前 | できる |
| 塞いだ後（フィルタ 24 件） | **できない** |
| 解除した後 | **できる**（動的セッションが自動で解けた） |

**未確認**: サービス経由（`--enforce-dns` 付き）での適用。DNS 差し替えを伴い
端末の名前解決ごと iFilter を通るため、Step 10 と合わせて確認する。

---

## MVP のスコープ

**含む**: Rust workspace / Filter Core / Policy Engine / Profile / Category /
ALLOW・BLOCK・REVIEW / Allowlist / Blocklist / Unknown handling / Decision Trace /
SQLite / Windows Service / ローカル DNS フィルタリング / Tauri UI /
BEGINNER profile / ユニットテスト / 統合テスト
／**＋ DoH 対策**（ARCHITECTURE.md §7-2 により必須と判断）

**含まない**: WFP 高度化 / QUIC 対策 / Parent PIN（UAC で代替）/ 許可申請の承認フロー
（UI とデータモデルまで）/ AI 分類 / Android / クラウドサーバー / マルチデバイス
