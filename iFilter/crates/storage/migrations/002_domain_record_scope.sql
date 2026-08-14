-- ドメイン分類の照合範囲。
--
-- CDN の多くは Public Suffix List に載っており（cloudfront.net / akamaiedge.net など）、
-- eTLD+1 で打ち切る通常の階層マッチでは配下のホスト名に一度もヒットしない。
-- ホスト名は顧客ごとのランダム文字列なので個別列挙もできないため、
-- 「配下すべてに及ぶ」登録を表す列を足す（docs/adr/0008-infrastructure-suffix-records.md）。
--
-- 既定は 'domain'（従来どおりの挙動）。既存行はすべてこれになる。

ALTER TABLE domain_records ADD COLUMN scope TEXT NOT NULL DEFAULT 'domain';
