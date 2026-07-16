package com.sapcework.memo.data.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index

/**
 * メモとタグの多対多を表す中間テーブル。
 *
 * 外部キーにCASCADEを設定し、メモまたはタグの物理削除時に関連を自動で解消する。
 * 参照だけが残る不整合をDBレベルで防ぐ。
 */
@Entity(
    tableName = "memo_tag_cross_ref",
    primaryKeys = ["memo_id", "tag_id"],
    foreignKeys = [
        ForeignKey(
            entity = MemoEntity::class,
            parentColumns = ["id"],
            childColumns = ["memo_id"],
            onDelete = ForeignKey.CASCADE,
        ),
        ForeignKey(
            entity = TagEntity::class,
            parentColumns = ["id"],
            childColumns = ["tag_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [Index("memo_id"), Index("tag_id")], // 双方向の結合を高速化する
)
data class MemoTagCrossRef(
    @ColumnInfo(name = "memo_id")
    val memoId: Long,

    @ColumnInfo(name = "tag_id")
    val tagId: Long,
)
