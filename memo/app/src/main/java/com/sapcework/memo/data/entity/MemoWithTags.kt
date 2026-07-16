package com.sapcework.memo.data.entity

import androidx.room.Embedded
import androidx.room.Junction
import androidx.room.Relation

/**
 * メモと、それに紐づくタグ群をまとめて取得するための関連定義。
 * Roomが中間テーブルを解決するため、N+1クエリを避けられる。
 */
data class MemoWithTags(
    @Embedded
    val memo: MemoEntity,

    @Relation(
        parentColumn = "id",
        entityColumn = "id",
        associateBy = Junction(
            value = MemoTagCrossRef::class,
            parentColumn = "memo_id",
            entityColumn = "tag_id",
        ),
    )
    val tags: List<TagEntity>,
)
