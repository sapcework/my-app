# iFilter アーキテクチャ設計（MVP）

未成年者向け Windows ネットワークフィルター。最初の対象は「初めてインターネットを
利用する小学生」。最重要コンポーネントは Policy Engine。

このドキュメントは実装開始前の設計レビュー資料であり、実装の進行にあわせて更新する。

---

## 1. 開発環境（2026-08-14 実測）

| 項目 | 実測値 | 判定 |
| --- | --- | --- |
| OS | Windows 11 Pro 10.0.26200 | OK |
| Rust | 1.96.0 stable / cargo 1.96.0 | OK |
| ツールチェーン | `x86_64-pc-windows-msvc`（default host） | OK |
| C++ ビルド環境 | Visual Studio Community 2026 (18.6) | OK |
| Windows SDK | 10.0.26100.0 | OK |
| WDK | **未インストール** | Phase 5 で要検討（後述） |
| Node.js | v24.15.0 / npm 11.12.1 | OK |
| Tauri CLI | 未インストール | プロジェクトの devDependency で導入（fast-browser と同方式） |
| 現在のシェル権限 | **非管理者** | サービス登録・53番バインドには昇格が必要 |
| UDP 53番ポート | 空き | ローカル DNS プロキシを配置可能 |
| 現在の DNS | 192.168.10.1（ルータ） | 上流 DNS として利用 |

同一リポジトリの `fast-browser` が Tauri 2.11 + React 19 + TypeScript 6 で稼働しており、
UI スタックはこれに揃えるのが最短。

### WDK 未インストールの影響（重要）

WFP には 2 通りの使い方があり、必要な環境が違う。

- **ユーザーモード WFP**（`fwpuclnt.dll` / `FwpmFilterAdd`）— ドライバ不要。ALE レイヤで
  「どのプロセスが、どの宛先 IP/ポートへ接続するか」を許可・拒否できる。
  **Windows SDK だけでビルドでき、現環境でそのまま着手できる。**
- **カーネルモード callout ドライバ** — パケット本体の検査・書き換えが必要な場合のみ。
  WDK とドライバ署名が必要で、開発・配布のコストが跳ね上がる。

MVP および Phase 5 の第一段はユーザーモード WFP で足りる。カーネルドライバは
「本当に必要と実証できたときだけ」着手する（指示書 21 の「最初から複雑なカーネル
ドライバを作らない」に一致）。

**2026-08-16 に実測で確認した**（Step 11・ADR-0010）。WDK なしでビルドでき、
ALE レイヤのフィルタが実際に接続を止め、プロセス終了で自動的に元へ戻る。
フィルタの追加には管理者権限が要る（エンジンを開くだけなら非管理者でもできる）。

---

## 2. レイヤ境界（最重要の設計判断）

Network Layer と Policy Layer を絶対に混ぜない。

```
[ Network Layer ]  Windows / Android 固有。判定ロジックを一切持たない
   DNS Proxy        ─┐
   WFP (ALE)         ├─→  Request { domain, at, profile_id, source }
   Android VpnService─┘
                            │
                            ▼
[ Core Layer ]     プラットフォーム非依存。I/O を持たない
                       Policy Engine
                            │
                            ▼
                     Verdict { decision, reason, matched_rule, trace }
                            │
                            ▼
[ Network Layer ]  Verdict を「どう実現するか」だけを担当
   DNS: NXDOMAIN / sinkhole IP を返す
   WFP: FWP_ACTION_BLOCK を返す
```

禁止する実装の形:

```rust
// 悪い例: ネットワーク層が判定ロジックを持っている
if category == "adult" { return Action::Block; }        // Android に移植できない

// 良い例: ネットワーク層は Core に問い合わせ、結果の実現だけを担当
let verdict = core.decide(&request)?;                   // 判定は Core が全部やる
match verdict.decision {
    Decision::Allow => respond_with_upstream(query).await,
    _ => respond_nxdomain(query),                       // BLOCK / REVIEW の実現方法は層ごとに違う
}
```

---

## 3. crate 構成

| crate | 責務 | 依存してよいもの | 禁止 |
| --- | --- | --- | --- |
| `domain-model` | 型定義のみ（Domain / Category / Risk / Profile / Decision / Verdict）とドメイン正規化 | serde, uuid, time, psl, idna | I/O、OS API |
| `policy-engine` | 判定ロジック。純粋関数 | `domain-model` のみ | I/O、時刻取得、OS API、DB |
| `storage` | SQLite 永続化。`PolicyStore` trait の実装 | rusqlite(bundled), `domain-model` | 判定ロジック |
| `filter-core` | 上記を束ねる唯一の入口。キャッシュ・ロード・ログ記録 | 上記 3 つ | OS 固有 API |
| `ifilter-cli` | 検証用 CLI（`ifilter check example.com --profile beginner`） | `filter-core` | — |
| `ifilter-dns` | ローカル DNS プロキシ（`windows/dns`）。`Verdict` を DNS 応答として実現する | `filter-core`, `storage`, tokio | 判定ロジック |
| `ifilter-service` | Windows サービスとしての常駐・DNS 設定差し替え・ブラウザポリシー（`windows/service`） | `ifilter-dns`, windows-service, windows-registry | 判定ロジック |

`policy-engine` が I/O も時刻取得もしないのは、テスト容易性のため。現在時刻は
`Request.at` として**引数で注入する**（時間帯ルールを後から入れても純粋性を保てる）。

指示書 35 にあった `common` crate は作らない。中身が「ドメイン正規化」だけになり、
`domain-model` に置くのが自然なため。必要になった時点で切り出す。

---

## 4. ディレクトリ構成（MVP）

```
iFilter/
├── Cargo.toml                  # workspace ルート
├── CLAUDE.md                   # 実装時の決まりごと・落とし穴
├── SPEC.md                     # 仕様書（何ができるアプリか）
├── docs/
│   ├── ARCHITECTURE.md         # このファイル
│   ├── POLICY_MODEL.md         # データモデルと判定順序
│   ├── TEST_PLAN.md            # テスト設計
│   ├── ROADMAP.md              # MVP 実装手順
│   └── adr/                    # Architecture Decision Record
├── crates/
│   ├── domain-model/
│   ├── policy-engine/
│   │   └── tests/              # 判定の統合テストはここ
│   ├── storage/
│   │   └── migrations/         # SQL。include_str! でバイナリに埋め込む
│   ├── filter-core/
│   └── ifilter-cli/
├── windows/
│   ├── service/                # Windows サービス（UI とは独立して常駐）
│   ├── dns/                    # ローカル DNS プロキシ
│   └── wfp/                    # 第2段（Phase 5、ユーザーモードから）
├── apps/
│   └── windows-ui/             # Tauri + React + TypeScript
```

指示書 35 からの変更点と理由:

- **ルート直下の `tests/` は作らない。** Cargo の統合テストは crate 内の `tests/` に
  置かないと実行されない。ルートに置くとどの crate にも属さず、走らないテストが残る。
- **`server/` と `apps/android/` は MVP では作らない。** git は空ディレクトリを追跡しない
  ため、実体のないディレクトリは同期されず「あるはずのものが無い」状態になる。
  将来の拡張性は crate 分割（§2, §6）で担保済みで、空箱は不要。
- **マイグレーションはルートの `database/` ではなく `crates/storage/migrations/` に置く。**
  フィルターは Windows サービスとして単体で動くため、SQL を実行時に外部ファイルとして
  探しにいく設計にはできない。`include_str!` で埋め込む以上、crate 内にある必要がある。

---

## 5. Windows 固有と共通 Core の境界

| 関心事 | 置き場所 | 理由 |
| --- | --- | --- |
| Profile / Category / Risk / Rule / Decision | `policy-engine` | Android・サーバーと共有する |
| ドメイン正規化・階層マッチ | `domain-model` | 判定結果に直結するので共有必須 |
| Allowlist / Blocklist / Parent Override | `policy-engine` + `storage` | 共有 |
| Decision Trace | `policy-engine` | 保護者 UI にも出すので共有 |
| SQLite スキーマ | `storage` | Android でもそのまま使える |
| DNS プロキシ | `windows/dns` | Windows 固有 |
| WFP | `windows/wfp` | Windows 固有 |
| サービス登録・昇格・自動起動 | `windows/service` | Windows 固有 |
| DNS 設定の差し替え | `windows/service` | Windows 固有 |
| VpnService | 将来 `apps/android` | Android 固有 |

境界を守るための**機械的な検査**を CI に入れる:

```powershell
# 1. Core に OS 固有 crate が混入していないこと
#    --edges normal は必須。付けないと dev-dependency（proptest → tempfile → windows-sys）
#    まで数えてしまい、健全な状態でも誤検知する
$deps = cargo tree -p policy-engine --edges normal --prefix none --format "{p}" | Sort-Object -Unique
if ($deps | Select-String -Pattern '^(windows|winapi)') { throw "policy-engine に OS 固有 crate が混入" }

# 2. Android ターゲットでコンパイルできること
rustup target add aarch64-linux-android
cargo check -p policy-engine --target aarch64-linux-android
```

`cargo check` はリンクしないため **NDK なしで通る**（2026-08-14 に実機確認済み）。
境界が壊れた瞬間に CI が落ちる。

**Android チェックの対象は `domain-model` と `policy-engine` だけ。**
`storage` は `rusqlite` の `bundled` で SQLite を C からビルドするため、
`cargo check` でもビルドスクリプトが走り、NDK（clang）が無いと失敗する。
移植性の検証は Android 対応に着手する時点で NDK を入れて行う。
判定ロジックの移植性は上記 2 crate で担保できている。

`cargo tree -i windows` は使わない。**依存が存在しないとき**（＝正常時）に
`package ID specification did not match any packages` でエラー終了するため、
CI の判定が逆になる。上記のように依存一覧を取って検査する。

---

## 6. Android 移植方針

- `domain-model` / `policy-engine` / `storage` / `filter-core` をそのまま共有し、
  UniFFI で Kotlin バインディングを生成する。
- Android 側は `VpnService` でパケットを受け、DNS クエリからドメインを取り出して
  `filter-core` に渡す。**判定ロジックは 1 行も書かない。**
- SQLite は `rusqlite` の bundled 機能で NDK ビルドできるため、スキーマも共有できる。
- 制約: Core の 4 crate は `std` のみ・OS 固有 crate 依存禁止・時刻は引数注入（§3）。

---

## 7. 設計上の問題点（実装前に方針を決めるべきもの）

### 7-1. 未知ドメイン BLOCK は、DNS レイヤでは「ページが壊れる」形で表面化する【最重要】

1 つの Web ページは、本体のドメイン以外に CDN・フォント・API・画像配信など多数の
第三者ドメインを引く。保護者が `example.com` を許可しても `cdn.example.net` が
unknown で BLOCK なら、ページは表示されるが崩れる・動かない。しかも **DNS クエリには
「これはユーザーが開こうとしたページか、その中の部品か」という情報が無い**ため、
Policy Engine 側でも区別できない。

対策（MVP に含めるべき）:

- `infrastructure` カテゴリを新設し、CDN・フォント・証明書検証(OCSP)・NTP など
  「単体では閲覧対象にならない基盤ドメイン」を既定 allowlist として同梱する。
- 保護者 UI の「許可申請」画面に、**そのページで BLOCK された関連ドメインを併記**し、
  まとめて許可できるようにする（1 件ずつの許可では運用が破綻する）。
- ブロック件数ログは「ナビゲーション由来かどうか不明」である前提で見せる。

### 7-2. DoH（DNS over HTTPS）で DNS フィルターは素通りされる【MVP 必須】

Firefox は既定で DoH を使う設定があり、Chrome / Edge も「セキュア DNS」を
ユーザーが有効にできる。この状態では DNS プロキシに一切クエリが来ない。
指示書 40 では DoH 対策を「MVP 後」に置いているが、**対策が無いと MVP の主目的
（ブラウザに依存しない遮断）が成立しない**。最低限、以下を MVP に含めることを提案する。

- Firefox: canary domain `use-application-dns.net` に NXDOMAIN を返して DoH を自動無効化する。
- Chrome / Edge: グループポリシー（レジストリ `DnsOverHttpsMode = off`）で無効に固定する。
  Windows 11 Pro なので設定可能。
- 既知 DoH プロバイダのドメインを BLOCK する（IP 直打ちは Phase 5 の WFP で塞ぐ）。

### 7-3. Fail Closed は「PC が一切ネットに繋がらない」事故になりうる

DNS プロキシが落ちた場合に全通信を止めると、保護者自身も復旧手順を調べられない。
復旧手段を**先に**設計する必要がある。提案:

- 既定は Fail Closed だが、サービス異常終了時は「iFilter の管理 UI とヘルプページだけ
  通す」限定 Allow 状態にフォールバックする。
- 保護者が Windows 管理者権限で解除できる経路（サービス停止）を必ず残す。

### 7-4. 「Filter OFF を子供が押せない」保証が MVP に無い

指示書 40 では Parent PIN が MVP 後だが、UI に OFF ボタンがある以上、MVP でも保護が要る。

**決定（2026-08-14）**: 子供のアカウントを Windows の標準ユーザーにし、設定変更操作を
管理者昇格（UAC）で守る。実装コストがほぼゼロで確実。Parent PIN は MVP 後に
利便性向上として足す。

### 7-5. 「Emergency Block」と「保護者が critical を解除できる」が矛盾している

指示書 11 は「critical は Allowlist だけで解除できない設計も検討」、
かつ「MVP では保護者が明示的に解除できる仕様でよい」としている。
判定順序に **Forced Block Category** の段を用意し、MVP ではその集合を空にすることで
両立させる（§ POLICY_MODEL.md）。後から集合に足すだけで挙動が変わる。

### 7-6. カテゴリは 1 サイト 1 個では足りない

子供向け動画サイトは `kids` かつ `video`。ニュースサイトは `news` かつ `video`。
単一カテゴリだと、どちらで登録するかで結果が変わってしまう。
`DomainRecord.categories` を**複数**にし、判定は「最も制限的なカテゴリが勝つ」とする。

### 7-7. DNS 設定の差し替えは漏れる

`Set-DnsClientServerAddress` で全インターフェースに `127.0.0.1` を設定しても、
VPN 接続・USB テザリング・新しい Wi-Fi アダプタなど**後から増えたインターフェースは
元の DNS のまま**になる。定期的な再適用、または NRPT（Name Resolution Policy Table）で
名前解決ポリシーごと固定する方式を検討する。

### 7-8. 管理者権限が必要な操作が開発フローに入る

53番へのバインドとサービス登録には昇格が必要で、現在の開発シェルは非管理者。
CLI（Step 6）までは非管理者で開発・テストでき、Step 7 以降で昇格が要る。
この境界を意識して実装順を組む（§ ROADMAP.md）。

### 7-9. サイト全体を許可すると、そのサイトの中身は選べない【実機で確認済み】

DNS には「どのページか」の情報が無い。許可の単位はドメインなので、**あるサイトを
許可することは、そのサイトが出す広告枠や記事枠まで含めて許可すること**になる。

2026-08-23 の Edge / Firefox 確認で実際に起きた。`www.yahoo.co.jp` の許可では
記事一覧（`quriosity.yahoo.co.jp`）に届かず、eTLD+1 の `yahoo.co.jp` を許可した。
それ自体は正しい直し方（7-1 と同じ問題）だが、その結果**トップページの記事・広告枠に
小学生に見せたくない見出しが並んだ**。外部の広告配信元（`ib.adnxs.com`・
`criteo.com`）は BLOCK のままだったので、それらは `yahoo.co.jp` 自身の配信である。

つまりこれは遮断漏れではなく、**フィルターの粒度そのもの**の限界である。

- **BEGINNER で大手ポータルを丸ごと許可する運用は成立しない。** 許可するなら
  `kids.yahoo.co.jp` のような子供向けの入口に絞る
- 保護者 UI が eTLD+1 を提案するとき「サイト全体が対象になります」と明示しているのは
  このため。**提案は「届かない」を直す一方で、広く許可させる方向にも働く**
- ページ単位の判断が要るなら DNS より上の層（HTTP）が必要になるが、それは
  MITM 復号を意味するので**この製品では採らない**（CLAUDE.md「実装してはいけないもの」）。
  この限界は設計として受け入れ、運用（何を許可するか）で吸収する
