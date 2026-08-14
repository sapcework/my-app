# ADR-0001: Policy Engine を Network Layer から完全に分離する

- 状態: 採用
- 日付: 2026-08-14

## 文脈

iFilter は Windows では DNS と WFP、Android では VpnService、将来はサーバー API から
同じ判定を行う。ネットワーク層に判定ロジックを書くと、層ごとに判定が分岐し、
「Windows と Android で結果が違う」という最悪の不具合を生む。

## 決定

`policy-engine` は **I/O を一切持たない純粋関数**として実装する。

- OS API・ファイル・DB・ネットワークに触れない
- **現在時刻も取得しない**。時刻は `Request.at` として引数で注入する
- `RequestSource`（Dns / Wfp / Cli / Ui）は記録用にのみ持ち、**判定に使わない**

ネットワーク層の責務は 2 つだけ:
1. ドメインを取り出して `Request` を組み立てる
2. 返ってきた `Verdict` を、その層なりの方法で実現する（DNS なら NXDOMAIN、
   WFP なら `FWP_ACTION_BLOCK`）

## 結果

- Android 移植時、判定ロジックを 1 行も書き直さなくてよい
- 判定のテストがネットワークもサービスも管理者権限も要らず、ミリ秒で回る
- 時間帯ルールを後から入れても純粋性が壊れない
- CI で `cargo tree -p policy-engine -i windows` と
  `cargo check -p policy-engine --target aarch64-linux-android` を回し、
  境界の破壊を機械的に検出する

## 却下した案

**ネットワーク層ごとに判定を持つ** — 短期的には速いが、Windows と Android で挙動が
分岐した時点で製品として破綻する。子供の安全にかかわる判定を二重管理してはならない。
