# ADR-0008: 基盤ドメインだけ「公開サフィックスとして照合する」レコードを許す

- 状態: 採用
- 日付: 2026-08-15
- 関連: ADR-0006（階層マッチは eTLD+1 で止める）、ARCHITECTURE.md §7-1

## 文脈

ADR-0006 で「階層マッチは eTLD+1 で止める」と決めた。`co.jp` を許可したときに
日本のほぼ全ドメインが通ってしまう事故を防ぐためで、この判断自体は変えない。

同梱の基盤ドメイン（ARCHITECTURE.md §7-1 の対策）を実装したところ、
**この規則のせいで CDN の登録が一度も効かない**ことが分かった。

大手 CDN の多くは Public Suffix List の PRIVATE セクションに載っている。

```
googleapis.com  cloudflare.net  akamai.net    akamaiedge.net  akamaihd.net
akamaized.net   edgekey.net     edgesuite.net fastly.net      fastlylb.net
cloudfront.net  azureedge.net   azurefd.net
```

`d111abcdef8.cloudfront.net` の eTLD+1 は**それ自身**なので、照合候補は 1 件だけになり、
`cloudfront.net` の登録には決して到達しない。しかも CloudFront や Akamai のホスト名は
顧客ごとのランダム文字列なので、**個別に列挙して登録することもできない**。

結果として ARCHITECTURE.md §7-1 の対策（基盤ドメインを既定 allowlist に入れて
ページが崩れないようにする）が、これらの CDN については機能しない。

## 検討した案

### 案 A: 該当ドメインを同梱から外す

安全側だが、CloudFront / Akamai / Azure CDN を使うサイトは必ず崩れる。
保護者がランダムなホスト名を都度許可する運用になり、実質破綻する。**却下。**

### 案 B: PSL の ICANN / PRIVATE セクションで扱いを変える

`psl` は両者を区別できる。「PRIVATE なら丸ごと許可してよい」とすれば実装は単純。

しかし成立しない。`blogspot.com` や `github.io` も PRIVATE セクションであり、
これらは**第三者が人の読めるサブドメインを自由に取得できる**。丸ごと許可すると
`co.jp` を許可するのと同じ事故になる。**却下。**

### 案 C: ドメインごとに照合範囲を明示する（採用）

## 決定

`DomainRecord` に照合範囲を持たせる。

```rust
pub enum MatchScope {
    Domain,   // 既定。ドメイン自身とサブドメイン。eTLD+1 で打ち切る（ADR-0006 のまま）
    Suffix,   // 公開サフィックスとして扱い、配下すべてに及ぶ
}
```

制約:

1. **`Suffix` を持てるのは同梱の `infrastructure` レコードだけ。**
   単体テストで検査する（`bundled.rs` の `suffix_スコープは基盤カテゴリだけ`）。
2. **保護者の Allowlist / Blocklist（`ParentOverride`）は対象外。**
   従来どおり公開サフィックスの登録を拒否する。ADR-0006 §3 は変わらない。
3. **CLI から `Suffix` レコードを新規作成できない。** `classify` は既存レコードの
   照合範囲を引き継ぐだけ。
4. 照合の優先順位は **階層マッチが先、サフィックスが後**。
   `evil.cloudfront.net` に付けた個別の分類が、CDN の一括許可に勝つ。
5. サフィックス照合も**ラベル境界**で行う。`notcloudfront.net` は
   `cloudfront.net` にヒットしない。

## 受け入れたリスク

`cloudfront.net` を丸ごと許可すると、CloudFront 上の任意のコンテンツが DNS を通る。

「`co.jp` を許可」と同列には扱わない。到達するには**ランダムなホスト名を知っている
必要がある**ため、子供が URL を打ち込んで辿り着く経路にはならない。
一方で「許可したページが崩れる」は日常的に、確実に起きる。

このリスクを下げる手段は別にある。

- 上位の入口ドメイン（`example.com`）は別レコードとして分類されるので、
  サイト本体の遮断はそちらで効く
- 個別の分類がサフィックス許可に勝つ（決定 4）ので、問題のあるホスト名は
  見つけ次第 `classify` で塞げる
- IP 直打ちによる回避は WFP（Step 11〜12）の担当で、この ADR の範囲外

## 結果

- ARCHITECTURE.md §7-1 の対策が実際に機能するようになった
- ADR-0006 の「eTLD+1 で止める」は既定として維持される。例外は同梱データが
  明示的に宣言したものだけ
- 「登録してあるのに一度もヒットしない」というクラスの不具合は
  `policy-engine/tests/bundled_domains.rs` が実在のホスト名で検査する。
  同梱データを増やすときは、そこに代表的なホスト名を足すこと
- DB スキーマに `domain_records.scope` 列が増えた（migration 002）。
  既存行の既定は `domain` なので、従来の挙動は変わらない
