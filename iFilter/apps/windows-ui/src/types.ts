// Rust 側（src-tauri/src/dto.rs と domain-model）が返す形の写し。
// ここに判定ロジックは書かない。UI は受け取った結果を並べるだけ。

export type DecisionName = 'allow' | 'review' | 'block';

export type RiskName = 'safe' | 'low' | 'medium' | 'high' | 'critical' | 'unknown';

export type ProfileName = 'beginner' | 'beginner_plus' | 'standard' | 'teen';

export interface FilterStatus {
  running: boolean;
  installed: boolean;
  profile: string;
  databasePath: string;
  browserPolicies: BrowserPolicyStatus[];
}

export interface BrowserPolicyStatus {
  browser: string;
  disabled: boolean;
}

export interface DailySummary {
  allowed: number;
  blocked: number;
  review: number;
  topBlocked: DomainCount[];
}

export interface DomainCount {
  domain: string;
  count: number;
}

// 判定 9 段のうち 1 段ぶんの結果。
//
// outcome が入れ子になっているのは Rust 側の enum の持ち方による
// （hit のときだけ decision が付く）。ここで平らにせず、そのまま受ける。
export interface TraceStep {
  stage: string;
  outcome: { outcome: 'hit' | 'miss' | 'skip'; decision?: DecisionName };
}

// 「なぜそう判定されたか」。加工せずそのまま表示する。
export interface Verdict {
  decision: DecisionName;
  reason: string;
  matched_rule: string;
  profile: string;
  matched_domain: string | null;
  trace: TraceStep[];
}

export interface Profile {
  id: ProfileName | { custom: string };
  name: string;
  category_rules: Record<string, DecisionName>;
  forced_block_categories: string[];
  risk_ceiling: RiskName;
  unknown_policy: DecisionName;
  review_as_block: boolean;
  default_decision: DecisionName;
  version: number;
}

export interface CategoryRule {
  id: string;
  displayName: string;
  defaultRisk: RiskName;
  decision: DecisionName | null; // 未設定ならプロファイルの既定に落ちる
}

export interface DecisionRow {
  timestamp: string;
  domain: string;
  category: string | null;
  decision: DecisionName;
  profile: string;
  ruleId: string;
}

// 同じページ由来「かもしれない」まとまり。DNS からは確定できない推測。
export interface BlockedGroup {
  startedAt: string;
  domains: BlockedDomain[];
}

export interface BlockedDomain {
  domain: string;
  category: string | null;
  ruleId: string;
  decision: DecisionName;
  timestamp: string;
  alreadyAllowed: boolean;
  // 保護者の許可では解除できないカテゴリ（暗号化 DNS）。許可の対象から外す（ADR-0009）
  cannotAllow: boolean;
  // このまとまりで遮断された回数。同じドメインは 1 行にまとめてある
  count: number;
}

export interface OverrideRow {
  id: string;
  domain: string;
  action: 'allow' | 'block';
  includeSubdomains: boolean;
  reason: string;
  expiresAt: string | null;
}

export interface OverrideInput {
  domain: string;
  action: 'allow' | 'block';
  includeSubdomains: boolean;
  reason: string;
  expiresAt: string | null;
}

export interface DomainRecordRow {
  id: string;
  domain: string;
  categories: string[];
  riskLevel: RiskName;
  scope: 'domain' | 'suffix';
  source: string;
  editable: boolean;
}

export interface DomainCheck {
  normalized: string;
  registrable: boolean;
  registrableDomain: string | null; // eTLD+1。www.yahoo.co.jp なら yahoo.co.jp
}
