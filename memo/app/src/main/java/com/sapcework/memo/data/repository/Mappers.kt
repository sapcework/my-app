package com.sapcework.memo.data.repository

import com.sapcework.memo.data.dao.MemoSortKey
import com.sapcework.memo.data.entity.MemoWithTags
import com.sapcework.memo.data.entity.TagEntity
import com.sapcework.memo.domain.model.Memo
import com.sapcework.memo.domain.model.MemoSortOrder
import com.sapcework.memo.domain.model.Tag

/**
 * Roomのエンティティとドメインモデルの相互変換。
 * この変換をRepositoryに閉じることで、上位層がRoomに依存しなくなる。
 */

internal fun MemoWithTags.toDomain(): Memo = Memo(
    id = memo.id,
    title = memo.title,
    content = memo.content,
    createdAt = memo.createdAt,
    updatedAt = memo.updatedAt,
    isPinned = memo.isPinned,
    isFavorite = memo.isFavorite,
    deletedAt = memo.deletedAt,
    tags = tags.map(TagEntity::toDomain),
)

internal fun TagEntity.toDomain(): Tag = Tag(
    id = id,
    name = name,
    createdAt = createdAt,
)

/** ドメインの並び順を、SQLへ束縛する定数へ変換する。 */
internal fun MemoSortOrder.toSortKey(): Int = when (this) {
    MemoSortOrder.UPDATED_DESC -> MemoSortKey.UPDATED_DESC
    MemoSortOrder.CREATED_DESC -> MemoSortKey.CREATED_DESC
    MemoSortOrder.TITLE_ASC -> MemoSortKey.TITLE_ASC
    MemoSortOrder.FAVORITE_FIRST -> MemoSortKey.FAVORITE_FIRST
}
