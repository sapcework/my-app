//! SQLite による [`PolicyStore`] の実装。

use std::collections::BTreeMap;
use std::path::Path;

use domain_model::{
    AccessDecision, CategoryId, CategoryInfo, CategoryRegistry, DomainName, DomainRecord,
    ParentOverride, Profile, ProfileId,
};
use rusqlite::{Connection, OptionalExtension, params};
use time::OffsetDateTime;

use crate::codec;
use crate::error::{Result, StorageError};
use crate::migrations;
use crate::store::PolicyStore;

/// ローカル DB。
pub struct SqliteStore {
    conn: Connection,
}

impl SqliteStore {
    /// ファイルを開き、必要なマイグレーションを適用する。
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let conn = Connection::open(path)?;
        Self::prepare(conn)
    }

    /// メモリ上の DB を開く。テスト用。
    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        Self::prepare(conn)
    }

    fn prepare(conn: Connection) -> Result<Self> {
        // 外部キーは既定で無効。有効にしないと ON DELETE CASCADE が効かない
        conn.execute_batch("PRAGMA foreign_keys = ON")?;
        migrations::apply(&conn)?;
        Ok(Self { conn })
    }

    /// 同梱のカテゴリ・プロファイル・ドメイン分類を書き込む。
    ///
    /// 何度呼んでも結果は同じ。同梱ドメインの ID はドメイン名から決定的に決まるので
    /// upsert で上書きされる（`domain_model::bundled`）。
    ///
    /// ドメイン分類を入れないと**あらゆるドメインが未分類**になり、BEGINNER では
    /// CDN もフォントも BLOCK されてページが表示できなくなる。
    pub fn seed_builtins(&mut self, at: OffsetDateTime) -> Result<()> {
        for info in CategoryRegistry::builtin().iter() {
            self.upsert_category(info, at)?;
        }
        for id in [
            ProfileId::Beginner,
            ProfileId::BeginnerPlus,
            ProfileId::Standard,
            ProfileId::Teen,
        ] {
            let profile = Profile::builtin(id).expect("同梱プロファイル");
            self.upsert_profile(&profile, at)?;
        }
        for record in domain_model::bundled_records(at) {
            self.upsert_domain_record(&record)?;
        }
        Ok(())
    }

    fn categories_of(&self, record_id: &str) -> Result<Vec<CategoryId>> {
        let mut stmt = self.conn.prepare(
            "SELECT category_id FROM domain_record_categories \
             WHERE record_id = ?1 ORDER BY category_id",
        )?;
        let rows = stmt.query_map([record_id], |row| row.get::<_, String>(0))?;

        let mut out = Vec::new();
        for row in rows {
            out.push(codec::decode_category("category_id", &row?)?);
        }
        Ok(out)
    }
}

impl PolicyStore for SqliteStore {
    fn profile(&self, id: ProfileId) -> Result<Option<Profile>> {
        let key = codec::encode_profile_id(id);
        let data: Option<String> = self
            .conn
            .query_row(
                "SELECT data FROM profiles WHERE id = ?1 AND deleted_at IS NULL",
                [&key],
                |row| row.get(0),
            )
            .optional()?;

        data.map(|json| {
            serde_json::from_str::<Profile>(&json).map_err(|err| StorageError::Decode {
                column: "profiles.data",
                value: json.clone(),
                cause: err.to_string(),
            })
        })
        .transpose()
    }

    fn profiles(&self) -> Result<Vec<Profile>> {
        let mut stmt = self
            .conn
            .prepare("SELECT data FROM profiles WHERE deleted_at IS NULL ORDER BY id")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;

        let mut out = Vec::new();
        for row in rows {
            let json = row?;
            out.push(serde_json::from_str::<Profile>(&json).map_err(|err| {
                StorageError::Decode {
                    column: "profiles.data",
                    value: json.clone(),
                    cause: err.to_string(),
                }
            })?);
        }
        Ok(out)
    }

    fn upsert_profile(&mut self, profile: &Profile, at: OffsetDateTime) -> Result<()> {
        let key = codec::encode_profile_id(profile.id);
        let json = serde_json::to_string(profile).map_err(|err| StorageError::Encode {
            field: "profile",
            cause: err.to_string(),
        })?;
        let now = codec::encode_time(at)?;

        self.conn.execute(
            "INSERT INTO profiles (id, name, data, version, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?5) \
             ON CONFLICT(id) DO UPDATE SET \
                 name = excluded.name, data = excluded.data, \
                 version = excluded.version, updated_at = excluded.updated_at, deleted_at = NULL",
            params![key, profile.name, json, profile.version as i64, now],
        )?;
        Ok(())
    }

    fn categories(&self) -> Result<CategoryRegistry> {
        let mut stmt = self.conn.prepare(
            "SELECT id, display_name, default_risk FROM categories \
             WHERE deleted_at IS NULL ORDER BY id",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?;

        let mut registry = CategoryRegistry::new();
        for row in rows {
            let (id, display_name, risk) = row?;
            registry.insert(CategoryInfo {
                id: codec::decode_category("categories.id", &id)?,
                display_name,
                default_risk: codec::decode_risk("categories.default_risk", &risk)?,
            });
        }
        Ok(registry)
    }

    fn upsert_category(&mut self, info: &CategoryInfo, at: OffsetDateTime) -> Result<()> {
        let now = codec::encode_time(at)?;
        self.conn.execute(
            "INSERT INTO categories (id, display_name, default_risk, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?4) \
             ON CONFLICT(id) DO UPDATE SET \
                 display_name = excluded.display_name, \
                 default_risk = excluded.default_risk, \
                 version = categories.version + 1, \
                 updated_at = excluded.updated_at, deleted_at = NULL",
            params![
                info.id.as_str(),
                info.display_name,
                info.default_risk.slug(),
                now
            ],
        )?;
        Ok(())
    }

    fn domain_records(&self) -> Result<Vec<DomainRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, domain, risk_level, confidence, source, status, scope, version, \
                    created_at, updated_at, deleted_at \
             FROM domain_records ORDER BY domain",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, String>(9)?,
                row.get::<_, Option<String>>(10)?,
            ))
        })?;

        let mut out = Vec::new();
        for row in rows {
            let (
                id,
                domain,
                risk,
                confidence,
                source,
                status,
                scope,
                version,
                created,
                updated,
                deleted,
            ) = row?;
            out.push(DomainRecord {
                id: codec::decode_uuid("domain_records.id", &id)?,
                categories: self.categories_of(&id)?,
                domain: codec::decode_domain("domain_records.domain", &domain)?,
                risk_level: codec::decode_risk("domain_records.risk_level", &risk)?,
                confidence: confidence as f32,
                source: codec::decode_source("domain_records.source", &source)?,
                status: codec::decode_status("domain_records.status", &status)?,
                scope: codec::decode_match_scope("domain_records.scope", &scope)?,
                version: version as u64,
                created_at: codec::decode_time("domain_records.created_at", &created)?,
                updated_at: codec::decode_time("domain_records.updated_at", &updated)?,
                deleted_at: codec::decode_time_opt("domain_records.deleted_at", deleted)?,
            });
        }
        Ok(out)
    }

    fn upsert_domain_record(&mut self, record: &DomainRecord) -> Result<()> {
        let id = record.id.to_string();
        let tx = self.conn.transaction()?;

        tx.execute(
            "INSERT INTO domain_records \
                 (id, domain, risk_level, confidence, source, status, scope, version, \
                  created_at, updated_at, deleted_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) \
             ON CONFLICT(id) DO UPDATE SET \
                 domain = excluded.domain, risk_level = excluded.risk_level, \
                 confidence = excluded.confidence, source = excluded.source, \
                 status = excluded.status, scope = excluded.scope, \
                 version = excluded.version, \
                 updated_at = excluded.updated_at, deleted_at = excluded.deleted_at",
            params![
                id,
                record.domain.as_str(),
                record.risk_level.slug(),
                f64::from(record.confidence),
                codec::encode_source(record.source),
                codec::encode_status(record.status),
                codec::encode_match_scope(record.scope),
                record.version as i64,
                codec::encode_time(record.created_at)?,
                codec::encode_time(record.updated_at)?,
                codec::encode_time_opt(record.deleted_at)?,
            ],
        )?;

        // カテゴリは差し替える。部分更新にすると消したカテゴリが残る
        tx.execute(
            "DELETE FROM domain_record_categories WHERE record_id = ?1",
            [&id],
        )?;
        for category in &record.categories {
            tx.execute(
                "INSERT INTO domain_record_categories (record_id, category_id) VALUES (?1, ?2)",
                params![id, category.as_str()],
            )?;
        }

        tx.commit()?;
        Ok(())
    }

    fn parent_overrides(&self) -> Result<Vec<ParentOverride>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, domain, action, scope, expires_at, reason, version, \
                    created_at, updated_at, deleted_at \
             FROM parent_overrides ORDER BY domain, id",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, Option<String>>(9)?,
            ))
        })?;

        let mut out = Vec::new();
        for row in rows {
            let (id, domain, action, scope, expires, reason, version, created, updated, deleted) =
                row?;
            out.push(ParentOverride {
                id: codec::decode_uuid("parent_overrides.id", &id)?,
                domain: codec::decode_domain("parent_overrides.domain", &domain)?,
                action: codec::decode_action("parent_overrides.action", &action)?,
                scope: codec::decode_scope("parent_overrides.scope", &scope)?,
                expires_at: codec::decode_time_opt("parent_overrides.expires_at", expires)?,
                reason,
                version: version as u64,
                created_at: codec::decode_time("parent_overrides.created_at", &created)?,
                updated_at: codec::decode_time("parent_overrides.updated_at", &updated)?,
                deleted_at: codec::decode_time_opt("parent_overrides.deleted_at", deleted)?,
            });
        }
        Ok(out)
    }

    fn upsert_parent_override(&mut self, entry: &ParentOverride) -> Result<()> {
        self.conn.execute(
            "INSERT INTO parent_overrides \
                 (id, domain, action, scope, expires_at, reason, version, \
                  created_at, updated_at, deleted_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) \
             ON CONFLICT(id) DO UPDATE SET \
                 domain = excluded.domain, action = excluded.action, scope = excluded.scope, \
                 expires_at = excluded.expires_at, reason = excluded.reason, \
                 version = excluded.version, updated_at = excluded.updated_at, \
                 deleted_at = excluded.deleted_at",
            params![
                entry.id.to_string(),
                entry.domain.as_str(),
                codec::encode_action(entry.action),
                codec::encode_scope(entry.scope),
                codec::encode_time_opt(entry.expires_at)?,
                entry.reason,
                entry.version as i64,
                codec::encode_time(entry.created_at)?,
                codec::encode_time(entry.updated_at)?,
                codec::encode_time_opt(entry.deleted_at)?,
            ],
        )?;
        Ok(())
    }

    fn emergency_blocks(&self) -> Result<Vec<DomainName>> {
        let mut stmt = self.conn.prepare(
            "SELECT domain FROM emergency_blocks WHERE deleted_at IS NULL ORDER BY domain",
        )?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;

        let mut out = Vec::new();
        for row in rows {
            out.push(codec::decode_domain("emergency_blocks.domain", &row?)?);
        }
        Ok(out)
    }

    fn upsert_emergency_block(&mut self, domain: &DomainName, at: OffsetDateTime) -> Result<()> {
        let now = codec::encode_time(at)?;
        self.conn.execute(
            "INSERT INTO emergency_blocks (domain, created_at, updated_at) VALUES (?1, ?2, ?2) \
             ON CONFLICT(domain) DO UPDATE SET \
                 version = emergency_blocks.version + 1, \
                 updated_at = excluded.updated_at, deleted_at = NULL",
            params![domain.as_str(), now],
        )?;
        Ok(())
    }

    fn record_decision(&mut self, entry: &AccessDecision) -> Result<()> {
        self.conn.execute(
            "INSERT INTO access_decisions \
                 (timestamp, device_id, domain, category, decision, profile, rule_id) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                codec::encode_time(entry.timestamp)?,
                entry.device_id,
                entry.domain.as_str(),
                entry.category.as_ref().map(CategoryId::as_str),
                entry.decision.slug(),
                codec::encode_profile_id(entry.profile),
                entry.rule_id.as_str(),
            ],
        )?;
        Ok(())
    }

    fn recent_decisions(&self, limit: usize) -> Result<Vec<AccessDecision>> {
        let mut stmt = self.conn.prepare(
            "SELECT timestamp, device_id, domain, category, decision, profile, rule_id \
             FROM access_decisions ORDER BY id DESC LIMIT ?1",
        )?;

        let rows = stmt.query_map([limit as i64], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
            ))
        })?;

        let mut out = Vec::new();
        for row in rows {
            let (timestamp, device_id, domain, category, decision, profile, rule_id) = row?;
            out.push(AccessDecision {
                timestamp: codec::decode_time("access_decisions.timestamp", &timestamp)?,
                device_id,
                domain: codec::decode_domain("access_decisions.domain", &domain)?,
                category: category
                    .map(|c| codec::decode_category("access_decisions.category", &c))
                    .transpose()?,
                decision: codec::decode_decision("access_decisions.decision", &decision)?,
                profile: codec::decode_profile_id("access_decisions.profile", &profile)?,
                rule_id: domain_model::RuleId::new(rule_id),
            });
        }
        Ok(out)
    }

    fn setting(&self, key: &str) -> Result<Option<String>> {
        Ok(self
            .conn
            .query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| {
                row.get(0)
            })
            .optional()?)
    }

    fn set_setting(&mut self, key: &str, value: &str, at: OffsetDateTime) -> Result<()> {
        self.conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3) \
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, \
                 updated_at = excluded.updated_at",
            params![key, value, codec::encode_time(at)?],
        )?;
        Ok(())
    }

    fn settings(&self) -> Result<BTreeMap<String, String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT key, value FROM settings ORDER BY key")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut out = BTreeMap::new();
        for row in rows {
            let (key, value) = row?;
            out.insert(key, value);
        }
        Ok(out)
    }
}
