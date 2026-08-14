# ADR-0006: ドメイン階層マッチは eTLD+1 で止め、カテゴリは複数持てるようにする

- 状態: 採用
- 日付: 2026-08-14

## 文脈

判定の入口はドメイン名。ここのマッチ規則を間違えると、**判定ロジックが正しくても
結果が全部おかしくなる**。実装で最も事故が起きやすい箇所。

## 決定

### 1. カテゴリは文字列 ID にする

`CategoryId(String)` とし、Rust の `enum` にしない。カテゴリは後から追加される前提で、
`CategoryRegistry`（DB から読む）がカテゴリ ID → 既定 `RiskLevel` を持つ。
カテゴリ追加にコード変更もアプリ更新も要らない。

### 2. 1 ドメインが複数カテゴリを持てる

`DomainRecord.categories: Vec<CategoryId>`。子供向け動画サイトは `kids` かつ `video`。
判定は **最も制限的なカテゴリが勝つ**（Block > Review > Allow）。
カテゴリ登録の粒度が荒くても危険側に倒れる。

### 3. 階層マッチは eTLD+1 で止める

`www.a.example.co.jp` の判定は
`www.a.example.co.jp` → `a.example.co.jp` → `example.co.jp` の順に探し、
**`co.jp` や `jp` へは降りない。** Public Suffix List で境界を判断する。
`co.jp` を Allowlist に登録する操作自体を拒否する。

降りると「`co.jp` を許可」で日本のほぼ全ドメインが通ってしまう。

### 4. マッチはラベル境界で行う

`ends_with` による部分文字列一致にしない。`example.com` の登録が
`notexample.com` にヒットしてはならない。

### 5. 正規化してから比較する

小文字化・末尾ドット除去・空白除去・IDN の punycode 統一。
`DomainName` は正規化済みの不変値とし、生の文字列を判定に流さない。

## 結果

- カテゴリ追加が設定変更だけで済む
- カテゴリ登録の精度が低い初期段階でも安全側に倒れる
- ドメインマッチのバグは TEST_PLAN.md §1-5 で個別に検査する。
  とくに `co.jp` ケースと `notexample.com` ケースは必ずテストを置く
