package com.sapcework.memo.data.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * メモ本体。
 *
 * 論理削除を採用し、ゴミ箱は [deletedAt] が非NULLの行として表現する。
 * 物理削除は30日経過後のパージ、またはユーザーによる完全削除でのみ行う。
 */
@Entity(
    tableName = "memos",
    indices = [
        Index("deleted_at"), // 一覧・ゴミ箱の絞り込みに常時使う
        Index("updated_at"),
        Index("created_at"),
        Index("is_pinned"),
        Index("is_favorite"),
        Index("title"),
    ],
)
data class MemoEntity(
    @PrimaryKey(autoGenerate = true)
    @ColumnInfo(name = "id")
    val id: Long = 0L,

    @ColumnInfo(name = "title")
    val title: String,

    @ColumnInfo(name = "content")
    val content: String,

    @ColumnInfo(name = "created_at")
    val createdAt: Long,

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long,

    @ColumnInfo(name = "is_pinned", defaultValue = "0")
    val isPinned: Boolean = false,

    @ColumnInfo(name = "is_favorite", defaultValue = "0")
    val isFavorite: Boolean = false,

    /** ゴミ箱へ移動した時刻。NULLなら通常のメモ。 */
    @ColumnInfo(name = "deleted_at")
    val deletedAt: Long? = null,
)
