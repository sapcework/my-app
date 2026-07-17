package com.sapcework.memo.testutil

import com.sapcework.memo.domain.model.Memo
import com.sapcework.memo.domain.model.Tag

/**
 * ドメインモデルのテスト用ファクトリ。
 *
 * 9個の引数を各テストで並べると、その検証が何に依存しているのかが埋もれる。
 * 既定値を与え、テストが本当に気にしている項目だけを明示できるようにする。
 */

/** 既定は「ゴミ箱に入っていない、ピン留めもお気に入りもされていないメモ」。 */
fun testMemo(
    id: Long = 1L,
    title: String = "タイトル",
    content: String = "本文",
    createdAt: Long = TEST_TIME,
    updatedAt: Long = createdAt,
    isPinned: Boolean = false,
    isFavorite: Boolean = false,
    deletedAt: Long? = null,
    tags: List<Tag> = emptyList(),
): Memo = Memo(
    id = id,
    title = title,
    content = content,
    createdAt = createdAt,
    updatedAt = updatedAt,
    isPinned = isPinned,
    isFavorite = isFavorite,
    deletedAt = deletedAt,
    tags = tags,
)

fun testTag(id: Long = 1L, name: String = "仕事", createdAt: Long = TEST_TIME): Tag =
    Tag(id = id, name = name, createdAt = createdAt)

/** 2020年の固定時刻。過去日のため DateFormat の「当日」判定に左右されない。 */
const val TEST_TIME = 1_600_000_000_000L
