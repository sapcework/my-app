// 表示用の対応表が、Rust 側の名前と食い違っていないことを見る。
//
// 食い違っても画面は落ちず、生の識別子（`category_policy` など）がそのまま出る。
// 静かに読みにくくなるだけなので、テストで押さえておく。
// Rust 側の名前は src-tauri のテスト（`serde の名前が変わっていない`）が固定している。

import { describe, expect, it } from 'vitest';
import { formatTimestamp, labelFor, reasonLabel, stageLabel } from './labels';

const STAGES = [
  'emergency_block',
  'parent_block',
  'forced_category',
  'parent_allow',
  'time_window',
  'risk_ceiling',
  'category_policy',
  'unknown_policy',
  'profile_default',
];

const REASONS = [
  'emergency_block',
  'parent_block',
  'forced_category',
  'parent_allow',
  'time_window',
  'risk_ceiling',
  'category_policy',
  'unknown_domain',
  'profile_default',
];

describe('表示用の対応表', () => {
  it('判定 9 段すべてに日本語がある', () => {
    for (const stage of STAGES) {
      expect(stageLabel[stage], `${stage} の表示名が無い`).toBeDefined();
    }
  });

  it('判定理由すべてに説明がある', () => {
    for (const reason of REASONS) {
      expect(reasonLabel[reason], `${reason} の説明が無い`).toBeDefined();
    }
  });

  it('未知の識別子でも空欄にしない', () => {
    // 対応表に無い値が来ても、何も出ないより素の値のほうが手がかりになる
    expect(labelFor(stageLabel, 'brand_new_stage')).toBe('brand_new_stage');
  });
});

describe('時刻の表示', () => {
  it('解釈できない値はそのまま返す', () => {
    expect(formatTimestamp('こわれた値')).toBe('こわれた値');
  });

  it('RFC3339 を短い表記にする', () => {
    expect(formatTimestamp('2026-08-15T01:23:00Z')).not.toBe('2026-08-15T01:23:00Z');
  });
});
