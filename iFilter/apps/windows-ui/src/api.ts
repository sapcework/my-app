// Tauri コマンドの呼び出し口。ここを通さずに invoke を直接書かない。
// 引数名や戻り値の形が散らばると、Rust 側を変えたときに追いきれなくなる。

import { invoke } from '@tauri-apps/api/core';
import type {
  BlockedGroup,
  CategoryRule,
  DailySummary,
  DecisionRow,
  DomainCheck,
  DomainRecordRow,
  FilterStatus,
  OverrideInput,
  OverrideRow,
  Profile,
  RiskName,
  Verdict,
} from './types';

export const api = {
  getStatus: () => invoke<FilterStatus>('get_status'),

  setFilterEnabled: (enabled: boolean) => invoke<void>('set_filter_enabled', { enabled }),

  // 確認のための判定。履歴には残らない
  checkDomain: (domain: string, profile?: string) =>
    invoke<Verdict>('check_domain', { domain, profile: profile ?? null }),

  inspectDomain: (domain: string) => invoke<DomainCheck>('inspect_domain', { domain }),

  getProfiles: () => invoke<Profile[]>('get_profiles'),
  getActiveProfile: () => invoke<Profile>('get_active_profile'),
  setActiveProfile: (profile: string) => invoke<void>('set_active_profile', { profile }),
  updateProfile: (profile: Profile) => invoke<void>('update_profile', { profile }),

  getCategoryRules: (profile: string) => invoke<CategoryRule[]>('get_category_rules', { profile }),
  setCategoryRule: (profile: string, category: string, decision: string) =>
    invoke<void>('set_category_rule', { profile, category, decision }),

  getOverrides: () => invoke<OverrideRow[]>('get_overrides'),
  addOverride: (input: OverrideInput) => invoke<void>('add_override', { input }),
  removeOverride: (id: string) => invoke<void>('remove_override', { id }),

  getDomainRecords: () => invoke<DomainRecordRow[]>('get_domain_records'),
  classifyDomain: (domain: string, categories: string[], risk: RiskName) =>
    invoke<void>('classify_domain', { domain, categories, risk }),

  getRecentDecisions: (limit?: number) =>
    invoke<DecisionRow[]>('get_recent_decisions', { limit: limit ?? null }),
  getBlockedGroups: () => invoke<BlockedGroup[]>('get_blocked_groups'),
  getDailySummary: () => invoke<DailySummary>('get_daily_summary'),

  setBrowserDohDisabled: (disabled: boolean) =>
    invoke<string[]>('set_browser_doh_disabled', { disabled }),
};

// Tauri のコマンドは失敗を文字列で返す。画面に出せる形に整える
export function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return '不明なエラーが発生しました';
}
