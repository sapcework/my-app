# ADR-0002: 未知ドメインは BEGINNER で BLOCK にする

- 状態: 採用
- 日付: 2026-08-14

## 文脈

「危険なサイトを全部見つけてブロックする」方式は原理的に破綻する。新しい有害サイトは
毎日生まれ、ブラックリストは常に後追いになる。対象が「初めてインターネットを使う
小学生」である以上、取りこぼしのコストが高すぎる。

## 決定

**安全と確認できたサイトだけを通す。** 情報のないドメインは
`category = unknown` / `risk = unknown` として扱い、Profile ごとに既定を変える。

| Profile | unknown の扱い |
| --- | --- |
| BEGINNER | BLOCK |
| BEGINNER_PLUS | BLOCK |
| STANDARD | REVIEW |
| TEEN | REVIEW |

`RiskLevel::Unknown` は順序比較で `Critical` と同等に厳しく扱う。
「わからない」を「たぶん安全」と読み替えない。

## 結果

- 未知の有害サイトに先回りできる
- **副作用として実用性が落ちる。** これを保護者の Allowlist と許可申請フローで補う
- **DNS レイヤでは、ページ内の CDN・フォント・API ドメインまで BLOCK される。**
  許可したページが崩れる形で表面化するため、`infrastructure` カテゴリを新設して
  基盤ドメインを既定 allowlist に入れる（ARCHITECTURE.md §7-1）

## 却下した案

**完全な Allowlist 方式** — 保護者の運用負荷が高すぎて使われなくなる。
実質的な結果は「フィルターを OFF にされる」ことであり、安全性はむしろ下がる。
