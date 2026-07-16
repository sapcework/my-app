package com.sapcework.memo.data.database

import androidx.room.migration.Migration

/**
 * スキーマ変更の履歴。
 *
 * 追加手順:
 *  1. [MemoDatabase] の version を上げる
 *  2. 対応する [Migration] をここに追加し [ALL] に登録する
 *  3. app/schemas/ に出力されたJSONを用いてMigrationテストを追加する
 *
 * データ損失を招くため fallbackToDestructiveMigration は使用しない。
 */
object Migrations {

    /** 登録済みのMigration。v1のみのため現時点では空。 */
    val ALL: Array<Migration> = emptyArray()
}
