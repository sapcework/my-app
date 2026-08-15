# ADR-0005: Decision の判定順序を 9 段で固定する

- 状態: 採用（3 段目の集合のみ ADR-0009 で更新。`doh` が入っている）
- 日付: 2026-08-14

## 文脈

指示書 11 の優先順位は 6 段だが、2 つの要求が衝突している。

- 「危険度 critical のサイトは Allowlist だけで解除できない設計も検討する」
- 「最初の MVP では、保護者が明示的に解除できる仕様としてよい」

また時間制限（指示書 15）を後から入れる余地も必要。

## 決定

9 段に拡張し、**上から評価して最初に確定した段で打ち切る**。

| # | 段 | MVP |
| --- | --- | --- |
| 1 | Emergency Block | 段のみ（空） |
| 2 | Parent Block | 実装 |
| 3 | Forced Block Category | 段のみ（空） |
| 4 | Parent Allow | 実装 |
| 5 | Time Window | 段のみ（無効） |
| 6 | Risk Ceiling | 実装 |
| 7 | Category Policy | 実装 |
| 8 | Unknown Policy | 実装 |
| 9 | Profile Default | 実装 |

最後に `profile.review_as_block` が true なら REVIEW を BLOCK に落とす。
このとき `reason` は元の値を保持し、保護者 UI で「本来は要確認」と示せるようにする。

### 各判断の根拠

- **Forced Block Category を Parent Allow の上に置く。** これが指示書 11 の衝突を
  解消する仕掛け。MVP では集合を空にするので「保護者はすべて解除できる」となり
  MVP 要件を満たす。将来 `adult` `malware` を集合に足すだけで解除不可になり、
  判定順序のコードは変更不要
  （**2026-08-15 追記**: 集合は空ではなく `doh` の 1 件だけ入れることにした。
  ADR-0009 を参照。`adult` などが解除できる点は変わらない）
- **Parent Block を Parent Allow の上に置く。** 保護者が明示的に止めたものが最優先
- **Time Window を Parent Allow の下に置く。** 保護者の明示許可が就寝時間を上書きできる
  方が直感に合う。「就寝時間は絶対」にしたい場合に備え `TimeRule.hard` を用意し、
  true のものだけ 1 段目で評価できるようにする
- **Risk Ceiling を Category Policy の上に置く。** カテゴリ登録が誤っていても
  リスク評価で止まる二重の安全網
- **Category Policy は最も制限的なカテゴリが勝つ**（Block > Review > Allow）。
  1 サイトが複数カテゴリを持つため（ADR-0006）

## 結果

- 空の段を 3 つ抱えるが、後から機能を足すときに判定順序を組み替えずに済む
- 優先順位テスト（TEST_PLAN.md §1-3）で「各段が 1 つ上の段に負ける」ことを個別に検証する
- `Verdict.trace` に各段の評価結果が積まれ、保護者 UI で理由を説明できる
