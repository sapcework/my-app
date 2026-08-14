-- iFilter ローカル DB の初期スキーマ。
--
-- 設計の約束:
--   * すべてのテーブルに id / version / created_at / updated_at / deleted_at を持たせる。
--     将来サーバーと差分同期するため、削除は物理削除ではなく deleted_at で表す。
--   * 時刻は RFC3339 の TEXT で持つ。人が読めて、タイムゾーンの取り違えが起きにくい。

-- カテゴリ。コードに埋め込まずデータとして持つので、追加にアプリ更新が要らない
CREATE TABLE categories (
    id           TEXT    PRIMARY KEY NOT NULL,
    display_name TEXT    NOT NULL,
    default_risk TEXT    NOT NULL,
    version      INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL,
    deleted_at   TEXT
);

-- プロファイル。
-- カテゴリ別ルール・強制ブロック集合・時間帯ルールは入れ子構造なので JSON で持つ。
-- 「どのプロファイルが adult を許可しているか」のような横断検索は要件に無く、
-- 正規化してもテーブルが増えるだけで得がない。
CREATE TABLE profiles (
    id         TEXT    PRIMARY KEY NOT NULL,  -- "beginner" / "custom:<uuid>"
    name       TEXT    NOT NULL,
    data       TEXT    NOT NULL,              -- Profile の JSON
    version    INTEGER NOT NULL DEFAULT 1,
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL,
    deleted_at TEXT
);

-- ドメインの分類情報
CREATE TABLE domain_records (
    id         TEXT    PRIMARY KEY NOT NULL,
    domain     TEXT    NOT NULL UNIQUE,
    risk_level TEXT    NOT NULL,
    confidence REAL    NOT NULL,
    source     TEXT    NOT NULL,
    status     TEXT    NOT NULL,
    version    INTEGER NOT NULL DEFAULT 1,
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL,
    deleted_at TEXT
);

CREATE INDEX idx_domain_records_domain ON domain_records (domain);

-- 1 ドメインは複数カテゴリを持てる（kids かつ video など）
CREATE TABLE domain_record_categories (
    record_id   TEXT NOT NULL REFERENCES domain_records (id) ON DELETE CASCADE,
    category_id TEXT NOT NULL,
    PRIMARY KEY (record_id, category_id)
);

-- 保護者の Allowlist / Blocklist
CREATE TABLE parent_overrides (
    id         TEXT    PRIMARY KEY NOT NULL,
    domain     TEXT    NOT NULL,
    action     TEXT    NOT NULL,
    scope      TEXT    NOT NULL,
    expires_at TEXT,                          -- NULL なら「常に」。値があれば「今回だけ／期限つき」
    reason     TEXT    NOT NULL,
    version    INTEGER NOT NULL DEFAULT 1,
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL,
    deleted_at TEXT
);

CREATE INDEX idx_parent_overrides_domain ON parent_overrides (domain);

-- システム定義の緊急ブロック。保護者も解除できない
CREATE TABLE emergency_blocks (
    domain     TEXT    PRIMARY KEY NOT NULL,
    version    INTEGER NOT NULL DEFAULT 1,
    created_at TEXT    NOT NULL,
    updated_at TEXT    NOT NULL,
    deleted_at TEXT
);

-- アプリの設定値
CREATE TABLE settings (
    key        TEXT PRIMARY KEY NOT NULL,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 判定履歴。
--
-- ★ここに列を足すときは docs/POLICY_MODEL.md §5 のプライバシー方針を必ず読むこと。
--   ページ本文・入力フォームの内容・パスワード・検索語・通信本文・Cookie・
--   個人メッセージを保存する列を作ってはいけない。
--   この製品はペアレンタルコントロールであり、監視ツールではない。
CREATE TABLE access_decisions (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT    NOT NULL,
    device_id TEXT    NOT NULL,
    domain    TEXT    NOT NULL,
    category  TEXT,
    decision  TEXT    NOT NULL,
    profile   TEXT    NOT NULL,
    rule_id   TEXT    NOT NULL
);

CREATE INDEX idx_access_decisions_timestamp ON access_decisions (timestamp DESC);
