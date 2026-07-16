package com.sapcework.memo.data.database

import androidx.room.Database
import androidx.room.RoomDatabase
import com.sapcework.memo.data.dao.MemoDao
import com.sapcework.memo.data.dao.TagDao
import com.sapcework.memo.data.entity.MemoEntity
import com.sapcework.memo.data.entity.MemoTagCrossRef
import com.sapcework.memo.data.entity.TagEntity

/**
 * アプリのローカルDB。
 *
 * スキーマ変更時は必ず [MemoDatabase.version] を上げ、[Migrations] にMigrationを追加すること。
 * fallbackToDestructiveMigration はユーザーのメモを消すため使用しない。
 * スキーマJSONは app/schemas/ に出力され、Migrationテストの入力になる。
 */
@Database(
    entities = [
        MemoEntity::class,
        TagEntity::class,
        MemoTagCrossRef::class,
    ],
    version = 1,
    exportSchema = true,
)
abstract class MemoDatabase : RoomDatabase() {

    abstract fun memoDao(): MemoDao

    abstract fun tagDao(): TagDao

    companion object {
        const val NAME = "memo.db"
    }
}
