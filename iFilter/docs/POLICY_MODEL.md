# Policy Engine データモデルと判定順序

Policy Engine は iFilter の最重要コンポーネント。**I/O を持たない純粋な判定器**として
実装し、Windows / Android / サーバーで共有する。

---

## 1. 基本型

### 1-1. ドメイン

```rust
pub struct DomainName(String);          // 正規化済みの不変値。生の文字列は外に出さない
```

正規化規則（`DomainName::parse` が行う）:

- 小文字化、末尾ドット除去、前後の空白除去
- IDN は punycode（A-label）に統一する — 見た目が同じ別ドメインを別物として扱うため
- 空ラベル・256 バイト超・不正文字は `Err` にする

**階層マッチは eTLD+1 で止める。** `www.a.example.co.jp` の判定は
`www.a.example.co.jp` → `a.example.co.jp` → `example.co.jp` の順に探し、
`co.jp` / `jp` へは**降りない**。降りると「co.jp を許可」で日本のほぼ全ドメインが
通ってしまう。Public Suffix List で境界を判断する。

PSL の実装には **`psl` crate** を使う（リストを crate に埋め込むため実行時の取得が不要）。
`publicsuffix` crate はリストを実行時に読み込む方式なので採用しない。

### 1-2. カテゴリ

```rust
pub struct CategoryId(String);          // enum にしない。後から追加できるようにするため
```

指示書 9 のカテゴリを初期値として `CategoryRegistry` に登録する。`education` `kids`
`search` `reference` `news` `video` `gaming` `shopping` `social` `forum` `chat`
`dating` `adult` `gambling` `violence` `drugs` `weapons` `self_harm` `malware`
`phishing` `fraud` `piracy` `unknown` に加えて:

- `infrastructure` — CDN・フォント・OCSP など、単体では閲覧対象にならない基盤ドメイン
  （ARCHITECTURE.md §7-1 の対策。これが無いと許可したページが崩れる）

`CategoryRegistry` はカテゴリ ID → 既定 `RiskLevel` の対応も持つ。DB から読むため、
カテゴリ追加にコード変更が要らない。

### 1-3. リスクレベル

```rust
pub enum RiskLevel { Safe, Low, Medium, High, Critical, Unknown }
```

`Unknown` は「まだ判定していない」であって「安全」でも「危険」でもない。
順序比較のときは `Unknown` を `Critical` と同等に**厳しく**扱う（安全側に倒す）。

### `DomainRecord.risk_level` はカテゴリとは独立した評価

**カテゴリの既定リスクを `risk_level` に流し込んではいけない。** 流し込むと
「カテゴリ別ルール」と「リスク上限」が二重計上になり、カテゴリ別ルールが
到達不能になる。

具体例: `video` の既定リスクは Medium。BEGINNER のリスク上限は Low。
カテゴリ由来のリスクを見てしまうと、プロファイルが `video → Review` と定めていても
6 段目（Risk Ceiling）で先に止まる。同じ理由で **BEGINNER_PLUS の
「video を Allow」も STANDARD の「social を Review」も永久に効かなくなる**。

`risk_level` が表すのは「教育サイトに分類されているが、この特定のドメインは
マルウェア配布が確認されている」といった、**分類とは独立した危険度**。
評価が無いときは `Unknown` とし、6 段目を skip してカテゴリ判定に委ねる。

`CategoryRegistry.default_risk` は UI 表示と分類作業の補助に使うもので、
判定には流し込まない。

### 1-4. ドメインレコード

```rust
pub struct DomainRecord {
    pub id: Uuid,                       // サーバー同期のための安定 ID
    pub domain: DomainName,
    pub categories: Vec<CategoryId>,    // 複数持てる（kids かつ video など）
    pub risk_level: RiskLevel,
    pub confidence: f32,                // 0.0..=1.0
    pub source: Source,                 // Local / Bundled / Server / Parent
    pub status: RecordStatus,           // Active / Disabled
    pub version: u64,                   // サーバーとの差分同期用
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
    pub deleted_at: Option<OffsetDateTime>,  // 論理削除（同期で削除を伝えるため）
}
```

JSON は保存形式のひとつにすぎない。内部モデルは上記の型であり、`serde` で
JSON / SQLite の双方に出し入れする。

### 1-5. プロファイル

```rust
pub struct Profile {
    pub id: ProfileId,                              // Beginner / BeginnerPlus / Standard / Teen / Custom(Uuid)
    pub name: String,
    pub category_rules: BTreeMap<CategoryId, Decision>,
    pub forced_block_categories: BTreeSet<CategoryId>,  // 保護者の Allow でも解除できない（MVP では空）
    pub risk_ceiling: RiskLevel,                    // これを超える risk は問答無用で BLOCK
    pub unknown_policy: Decision,                   // BEGINNER = Block, STANDARD = Review
    pub review_as_block: bool,                      // BEGINNER = true（REVIEW を実質 BLOCK にする）
    pub time_rules: Vec<TimeRule>,                  // MVP では空のまま。段だけ用意する
    pub default_decision: Decision,                 // 9 段目。どれにも当たらなかった場合
    pub version: u64,
}
```

### 1-6. 保護者による上書き

```rust
pub struct ParentOverride {
    pub id: Uuid,
    pub domain: DomainName,
    pub action: OverrideAction,         // Allow / Block
    pub scope: OverrideScope,           // ExactDomain / IncludeSubdomains
    pub expires_at: Option<OffsetDateTime>,  // None = 常に。Some = 今回だけ／期限つき
    pub reason: String,
    pub version: u64,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
    pub deleted_at: Option<OffsetDateTime>,  // 論理削除。同期で「消した」ことを伝えるため
}
```

`expires_at` があることで「今回だけ許可」と「常に許可」を同じ型で表現できる。
期限切れの判定には `Request.at` を使う（engine は時計を持たない）。
論理削除された設定は `is_active_at` が false を返すので判定に影響しない。

### 1-7. 判定結果

```rust
pub enum Decision { Allow, Block, Review }

pub struct Verdict {
    pub decision: Decision,
    pub reason: Reason,
    pub matched_rule: RuleId,           // "beginner.unknown.block" のような安定 ID
    pub profile: ProfileId,
    pub matched_domain: Option<DomainName>,  // 階層マッチでどのドメインに当たったか
    pub trace: Vec<TraceStep>,          // 評価した各段とその結果
}

pub enum Reason {
    EmergencyBlock, ParentBlock, ForcedCategory, ParentAllow,
    TimeWindow, RiskCeiling, CategoryPolicy, UnknownDomain, ProfileDefault,
}
```

`Verdict` はデバッグ専用ではなく**保護者 UI の表示にそのまま使う**。
「なぜブロックされたか」を保護者が理解できることが、この製品の価値そのもの。

---

## 2. 判定の入力

```rust
pub struct Request {
    pub domain: DomainName,
    pub at: OffsetDateTime,             // 時刻は必ず注入する。engine は時計を持たない
    pub profile_id: ProfileId,
    pub source: RequestSource,          // Dns / Wfp / Cli / Ui。記録用であり判定には使わない
}

impl PolicyEngine {
    // 純粋関数。self を取らないのは状態を持たないことを型で示すため
    pub fn evaluate(request: &Request, ctx: &PolicyContext<'_>) -> Verdict;
}

// 判定 1 回ぶんの入力。すでにメモリ上にあるデータへの参照だけを持つ
pub struct PolicyContext<'a> {
    pub profile: &'a Profile,
    pub records: &'a DomainIndex,          // 階層マッチ込みの索引
    pub parent_overrides: &'a OverrideSet, // 期限判定込み
    pub emergency_blocks: &'a DomainSet,   // MVP では空
}
```

`RequestSource` を判定に使ってはいけない。「DNS から来たときだけ緩くする」といった
分岐を入れた瞬間に、Android 移植で挙動が変わる。

---

## 3. 判定順序（確定案）

上から評価し、**最初に確定した段で打ち切る**。各段の結果は `trace` に積む。

| # | 段 | 内容 | MVP |
| --- | --- | --- | --- |
| 1 | Emergency Block | システム定義の緊急停止リスト。保護者も解除できない | 段のみ（空） |
| 2 | Parent Block | 保護者の明示 Blocklist | 実装 |
| 3 | Forced Block Category | `profile.forced_block_categories` に該当 | 段のみ（空） |
| 4 | Parent Allow | 保護者の明示 Allowlist（期限切れは無視） | 実装 |
| 5 | Time Window | 時間帯・曜日・利用時間 | 段のみ（無効） |
| 6 | Risk Ceiling | `risk_level` が `profile.risk_ceiling` を超える | 実装 |
| 7 | Category Policy | カテゴリ別ルール。**最も制限的なカテゴリが勝つ** | 実装 |
| 8 | Unknown Policy | カテゴリが `unknown` または該当レコード無し | 実装 |
| 9 | Profile Default | どれにも当たらない場合 | 実装 |

最後に `profile.review_as_block == true` なら `Review` を `Block` に落とす
（`reason` は元の値を保持する。保護者 UI で「本来は要確認」と示せるようにするため）。

### 順序の根拠

- **Parent Block を Parent Allow より上に置く。** 保護者が明示的に止めたものは、
  他のどのルールより優先されるべき。
- **Forced Block Category を Parent Allow より上に置く。** ここが指示書 11 の
  「Allowlist だけでは解除できない設計」に対応する段。MVP では集合が空なので
  実質「保護者はすべて解除できる」となり、指示書の MVP 要件と一致する。
  後から `adult` `malware` などを集合に足すだけで挙動が変わる。
- **Time Window を Parent Allow より下に置く。** 保護者の明示許可が就寝時間を
  上書きできる方が直感に合う。「就寝時間は絶対」にしたい場合に備えて
  `TimeRule.hard` フラグを用意し、true のものだけ 1 番の段で評価できるようにする。
- **Risk Ceiling を Category Policy より上に置く。** カテゴリ判定が誤っていても、
  そのドメイン自身のリスク評価が critical なら止まる（安全側の二重化）。
  ここで見るのは `record.risk_level` **だけ**で、カテゴリの既定リスクは混ぜない
  （混ぜるとカテゴリ別ルールが到達不能になる。§1-3 参照）。

### 「最も制限的なカテゴリが勝つ」

`Block > Review > Allow` の順に強い。`kids` (Allow) かつ `video` (Review) のサイトは
`Review` になる。カテゴリ登録の粒度が荒くても危険側に倒れない。

---

## 4. Decision Trace の例

```
Decision:  BLOCK
Reason:    UNKNOWN_DOMAIN
Profile:   BEGINNER
Rule:      beginner.unknown.block
Domain:    example.com（完全一致するレコードなし）

Trace:
  1 emergency_block   … miss
  2 parent_block      … miss
  3 forced_category   … miss（集合が空）
  4 parent_allow      … miss
  5 time_window       … skip（ルール未設定）
  6 risk_ceiling      … skip（risk 不明）
  7 category_policy   … skip（カテゴリ不明）
  8 unknown_policy    … HIT → Block
```

```
Decision:  ALLOW
Reason:    PARENT_ALLOWLIST
Profile:   BEGINNER
Rule:      parent.allow
Domain:    school.example.jp（scope=IncludeSubdomains, 期限なし）
```

---

## 5. 永続化（Phase 2）

SQLite。すべてのテーブルに `id (UUID)` `version` `created_at` `updated_at`
`deleted_at` を持たせ、将来のサーバー同期で差分を計算できるようにする。

保存対象: Profile / Category / DomainRecord / ParentOverride / Settings /
AccessDecision（判定履歴）。

`AccessDecision` に保存するのは指示書 27 の項目のみ:
`timestamp` `device_id` `domain` `category` `decision` `profile` `rule_id`。

**保存しない**: ページ本文・入力内容・パスワード・検索語・通信本文・Cookie・
個人メッセージ。DNS フィルターという方式上そもそも取得できないが、
将来 WFP や本文解析を足すときに誤って混ぜないよう、テーブル定義の時点で
列を作らない。
