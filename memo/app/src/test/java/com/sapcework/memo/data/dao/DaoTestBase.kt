package com.sapcework.memo.data.dao

import com.sapcework.memo.data.entity.MemoWithTags
import com.sapcework.memo.testutil.MemoDatabaseTestBase
import kotlinx.coroutines.flow.first

/**
 * DAOテストの共通土台。DB構築は [MemoDatabaseTestBase] に任せ、
 * ここではDAO層の検証で繰り返し使う読み出しヘルパーだけを持つ。
 */
abstract class DaoTestBase : MemoDatabaseTestBase() {

    /** ゴミ箱を除いた一覧を、既定の絞り込み無しで1回だけ取得する。 */
    protected suspend fun observeVisible(
        query: String = "",
        titleOnly: Boolean = false,
        onlyFavorite: Boolean = false,
        tagIds: List<Long> = emptyList(),
        sortKey: Int = MemoSortKey.UPDATED_DESC,
    ): List<MemoWithTags> = memoDao
        .observeMemos(
            query = query,
            titleOnly = titleOnly,
            onlyFavorite = onlyFavorite,
            tagIds = tagIds,
            tagCount = tagIds.size,
            sortKey = sortKey,
        ).first()

    protected fun titlesOf(memos: List<MemoWithTags>): List<String> = memos.map { it.memo.title }
}
