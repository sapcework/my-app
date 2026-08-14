# テスト計画

Policy Engine は I/O を持たない純粋関数なので、**大量のユニットテストを高速に回せる**。
これがレイヤ分離（ARCHITECTURE.md §2）の最大の実利。

---

## 1. Policy Engine ユニットテスト（`crates/policy-engine/tests/`）

### 1-1. Profile × カテゴリ（指示書 38 の必須ケース）

| Profile | 入力 | 期待 |
| --- | --- | --- |
| BEGINNER | adult | BLOCK |
| BEGINNER | gambling | BLOCK |
| BEGINNER | malware | BLOCK |
| BEGINNER | phishing | BLOCK |
| BEGINNER | education | ALLOW |
| BEGINNER | kids | ALLOW |
| BEGINNER | unknown | BLOCK |
| BEGINNER | social | BLOCK |
| BEGINNER | news | BLOCK（REVIEW を review_as_block で落とす） |
| STANDARD | unknown | REVIEW |
| TEEN | unknown | REVIEW |

### 1-2. 保護者による上書き

| ケース | 期待 |
| --- | --- |
| parent allow + unknown | ALLOW |
| parent block + education | BLOCK |
| parent block + adult | BLOCK |
| parent allow（期限切れ）+ unknown | BLOCK（期限切れは無視される） |
| parent allow（scope=ExactDomain）で `sub.example.com` を要求 | BLOCK（サブドメインに及ばない） |
| parent allow（scope=IncludeSubdomains）で `sub.example.com` を要求 | ALLOW |

期限切れテストは `Request.at` を動かして検証する。**システム時刻に依存させない。**

### 1-3. 判定順序（指示書 38 後半）

各段が「1 つ上の段に負ける」ことを 1 ケースずつ確認する。

```
emergency block   >  parent allow          … ALLOW 指定でも BLOCK
parent block      >  parent allow          … 両方登録したら BLOCK
forced category   >  parent allow          … 集合に adult を入れると解除不可
parent allow      >  time window           … 就寝時間でも ALLOW
parent allow      >  risk ceiling          … critical でも ALLOW
risk ceiling      >  category policy       … education でも risk critical なら BLOCK
category policy   >  unknown policy        … カテゴリがあれば unknown 段に落ちない
unknown policy    >  profile default       … unknown が先に確定する
```

### 1-4. カテゴリの合成

| 入力 | 期待 |
| --- | --- |
| `kids`(Allow) + `video`(Review) | REVIEW（制限的な方が勝つ） |
| `education`(Allow) + `adult`(Block) | BLOCK |
| `news`(Review) + `adult`(Block) | BLOCK |

### 1-5. ドメイン正規化と階層マッチ（ここが一番バグる）

| 入力 | 期待 |
| --- | --- |
| `EXAMPLE.COM` / `example.com.` / ` example.com ` | すべて `example.com` に正規化 |
| `www.a.example.co.jp` に対し `example.co.jp` を登録 | HIT する |
| `www.a.example.co.jp` に対し `co.jp` を登録 | **HIT しない**（eTLD を超えない） |
| `co.jp` を parent allow に登録 | 登録自体を拒否する（eTLD は指定できない） |
| IDN `日本.jp` | punycode に統一され、A-label 登録と一致する |
| 空ラベル `a..com` / 256 バイト超 | パースエラー |
| `example.com` を登録し `notexample.com` を要求 | HIT しない（部分文字列一致にしない） |

`notexample.com` のケースは、ドメインマッチを文字列の `ends_with` で書くと必ず通って
しまう典型的なバグ。ラベル境界で比較していることを保証する。

### 1-6. Decision Trace

- BLOCK 時に `reason` `matched_rule` `matched_domain` が期待どおり入る
- `review_as_block` で BLOCK に落ちた場合も `reason` は元の値を保持する
- `trace` に評価した段が順番どおり並ぶ

### 1-7. プロパティテスト（proptest）

- **単調性**: 同じドメインに対し BEGINNER の判定が STANDARD より緩くなることはない。
  プロファイルを厳しい順に並べ、任意の入力で順序が逆転しないことを検査する。
  カテゴリ表を編集したときの事故をこれ 1 本で捕まえられる。
- **決定性**: 同じ `Request` と `PolicyContext` なら常に同じ `Verdict` を返す。
- **パースの冪等性**: `parse(parse(s)) == parse(s)`。

---

## 2. Storage テスト（`crates/storage/tests/`）

- マイグレーションが空 DB に対して通る／二重適用しても壊れない
- `deleted_at` が入ったレコードが判定に使われない
- `version` がインクリメントされる
- インメモリ SQLite（`:memory:`）で実行し、ファイルを汚さない

---

## 3. CLI 検証（Step 6 の受け入れ確認）

```bash
ifilter check example.com --profile beginner
# BLOCK
# reason=UNKNOWN_DOMAIN
# rule=beginner.unknown.block
```

`--trace` で全段の評価結果を出せること。CLI は非管理者で動くので、
**Windows サービスを作る前にポリシーの正しさを完全に検証できる**。

---

## 4. DNS レイヤ統合テスト（Phase 3）

DNS プロキシに直接クエリを投げて検証する（ブラウザを使わない）。

```powershell
Resolve-DnsName -Server 127.0.0.1 -Name example.com        # BLOCK → NXDOMAIN
Resolve-DnsName -Server 127.0.0.1 -Name school.example.jp  # ALLOW → 上流の応答
```

- ALLOW ドメインは上流 DNS の応答がそのまま返る
- BLOCK ドメインは NXDOMAIN（または sinkhole IP）が返る
- 上流 DNS が無応答のときの挙動が定義どおり（ARCHITECTURE.md §7-3）
- 大量の同時クエリでハングしない

---

## 5. ブラウザ統合テスト（指示書 39）

Chrome / Edge / Firefox の 3 つで同じ手順を実施する。

| 確認項目 | 期待 |
| --- | --- |
| 許可サイト | 表示できる |
| ブロックサイト | 表示できない |
| 未知サイト（BEGINNER） | 表示できない |
| Allowlist に追加した直後 | 表示できる（DNS キャッシュの扱いを確認） |
| Blocklist に追加した直後 | 表示できない |
| **DoH を有効にしたブラウザ** | **素通りしないこと**（ARCHITECTURE.md §7-2） |
| サービス再起動 | 正しく復旧する |
| PC 再起動 | フィルターが自動起動する |
| 許可したページ内の CDN・フォント | ページが崩れない（ARCHITECTURE.md §7-1） |

DoH の行と CDN の行は、指示書 39 には無いが**これが通らないと製品として成立しない**
ため追加した。

ブラウザ側の DNS キャッシュがあるため、設定変更の反映確認では
`ipconfig /flushdns` とブラウザの内部キャッシュ（`chrome://net-internals/#dns`）の
両方をクリアしてから測る。

---

## 6. CI

同一リポジトリの `fast-browser-ci.yml` に倣い、`iFilter/**` の変更で起動する
`windows-latest` のワークフローを用意する。

```yaml
- cargo fmt --all -- --check
- cargo clippy --workspace --all-targets        # 警告ゼロ必須（lint は Cargo.toml で deny 済み）
- cargo test --workspace
- Core への OS 固有 crate 混入チェック          # ARCHITECTURE.md §5 のレシピ
- cargo check -p policy-engine --target aarch64-linux-android   # Android 移植性の常時保証
```

混入チェックに `cargo tree -i windows` を使ってはいけない。依存が**無いとき**に
エラー終了するため判定が逆になる。ARCHITECTURE.md §5 の依存一覧方式を使う。

UI 追加後は `npm run verify`（typecheck / eslint / vitest）を足す。
