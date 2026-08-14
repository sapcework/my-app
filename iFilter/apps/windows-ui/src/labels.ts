// 保護者に見せる日本語。
//
// **画面の表示を変えるためだけの対応表であり、判定には使わない。**
// ここに「このカテゴリは危ない」といった意味づけを持ち込むと、Rust 側の
// 判定と食い違ったときに気づけなくなる。

import type { DecisionName, RiskName } from './types';

export const decisionLabel: Record<DecisionName, string> = {
  allow: '許可',
  review: '要確認',
  block: '遮断',
};

export const riskLabel: Record<RiskName, string> = {
  safe: '安全',
  low: '低',
  medium: '中',
  high: '高',
  critical: '重大',
  unknown: '不明',
};

export const profileLabel: Record<string, string> = {
  beginner: 'はじめて',
  beginner_plus: 'すこし慣れた',
  standard: '標準',
  teen: '中高生',
};

// 判定 9 段の名前。Rust 側の Stage（snake_case）と対応する
export const stageLabel: Record<string, string> = {
  emergency_block: '緊急ブロック',
  parent_block: '保護者の拒否',
  forced_category: '解除不可カテゴリ',
  parent_allow: '保護者の許可',
  time_window: '時間帯',
  risk_ceiling: 'リスク上限',
  category_policy: 'サイトの種類',
  unknown_policy: '未分類の扱い',
  profile_default: 'プロファイル既定',
};

export const outcomeLabel: Record<string, string> = {
  hit: '該当',
  miss: '非該当',
  skip: '評価対象なし',
};

// なぜその判定になったかの説明。保護者がそのまま読める文にする
export const reasonLabel: Record<string, string> = {
  emergency_block: 'システムが緊急に遮断しているサイトです',
  parent_block: 'あなたが拒否に設定したサイトです',
  forced_category: '解除できない種類に含まれています',
  parent_allow: 'あなたが許可に設定したサイトです',
  time_window: '時間帯の設定によるものです',
  risk_ceiling: 'このプロファイルで許容する危険度を超えています',
  category_policy: 'サイトの種類に対する設定によるものです',
  unknown_domain: 'まだ分類されていないサイトです',
  profile_default: 'プロファイルの既定の扱いです',
};

export function labelFor(table: Record<string, string>, key: string): string {
  return table[key] ?? key; // 対応表に無くても素の値を出す。空欄にしない
}

// RFC3339 を画面用の短い表記にする
export function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
