package com.sapcework.memo.data.repository

import com.sapcework.memo.data.dao.MemoDao
import com.sapcework.memo.data.entity.MemoEntity
import com.sapcework.memo.data.entity.MemoWithTags
import com.sapcework.memo.di.IoDispatcher
import com.sapcework.memo.domain.model.Memo
import com.sapcework.memo.domain.model.MemoFilter
import com.sapcework.memo.domain.model.TrashPolicy
import com.sapcework.memo.domain.repository.MemoRepository
import com.sapcework.memo.util.TimeProvider
import com.sapcework.memo.util.escapeLikeWildcards
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * [MemoRepository] のRoom実装。
 *
 * RoomのsuspendクエリとFlowは自前のexecutorでIOスレッドへ切り替わるため、
 * DAO呼び出し自体をwithContextで包む必要はない。
 * 一方、エンティティからドメインモデルへの変換は購読側のコンテキストで走るため、
 * 10,000件規模ではメインスレッドを塞ぎうる。変換を含む箇所は明示的にIOへ逃がす。
 */
class MemoRepositoryImpl @Inject constructor(
    private val memoDao: MemoDao,
    private val timeProvider: TimeProvider,
    // 将来のKotlinで既定の適用対象が変わるため、対象をパラメータに固定する(KT-73255)
    @param:IoDispatcher private val ioDispatcher: CoroutineDispatcher,
) : MemoRepository {

    override fun observeMemos(filter: MemoFilter): Flow<List<Memo>> {
        val keyword = filter.query.trim().escapeLikeWildcards()
        return memoDao.observeMemos(
            query = keyword,
            titleOnly = filter.titleOnly,
            onlyFavorite = filter.onlyFavorite,
            tagIds = filter.tagIds,
            tagCount = filter.tagIds.size,
            sortKey = filter.sortOrder.toSortKey(),
        ).map { rows -> rows.map(MemoWithTags::toDomain) }
            .flowOn(ioDispatcher)
    }

    override fun observeMemo(id: Long): Flow<Memo?> = memoDao.observeById(id)
        .map { it?.toDomain() }
        .flowOn(ioDispatcher)

    override fun observeTrash(): Flow<List<Memo>> = memoDao.observeTrash()
        .map { rows -> rows.map(MemoWithTags::toDomain) }
        .flowOn(ioDispatcher)

    override suspend fun findById(id: Long): Memo? = memoDao.findById(id)?.toDomain()

    override suspend fun create(title: String, content: String): Long {
        val now = timeProvider.nowMillis()
        return memoDao.insert(
            MemoEntity(
                title = title,
                content = content,
                createdAt = now,
                updatedAt = now,
            ),
        )
    }

    override suspend fun updateContent(id: Long, title: String, content: String) = memoDao.updateContent(
        id = id,
        title = title,
        content = content,
        updatedAt = timeProvider.nowMillis(),
    )

    override suspend fun moveToTrash(id: Long) = memoDao.moveToTrash(id = id, deletedAt = timeProvider.nowMillis())

    override suspend fun restore(id: Long) = memoDao.restoreFromTrash(id = id, updatedAt = timeProvider.nowMillis())

    override suspend fun deletePermanently(id: Long) = memoDao.deletePermanently(id)

    override suspend fun purgeExpiredTrash(): Int =
        memoDao.purgeExpired(TrashPolicy.expiryThreshold(timeProvider.nowMillis()))

    override suspend fun setPinned(id: Long, pinned: Boolean) = memoDao.setPinned(id, pinned)

    override suspend fun setFavorite(id: Long, favorite: Boolean) = memoDao.setFavorite(id, favorite)

    override suspend fun findAllForExport(): List<Memo> = withContext(ioDispatcher) {
        memoDao.findAllForExport().map(MemoWithTags::toDomain) // 全件変換はCPU負荷が高いためIOへ逃がす
    }
}
