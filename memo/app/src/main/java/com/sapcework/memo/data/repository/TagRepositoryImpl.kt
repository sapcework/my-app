package com.sapcework.memo.data.repository

import com.sapcework.memo.data.dao.TagDao
import com.sapcework.memo.data.entity.TagEntity
import com.sapcework.memo.di.IoDispatcher
import com.sapcework.memo.domain.model.Tag
import com.sapcework.memo.domain.repository.TagRepository
import com.sapcework.memo.util.TimeProvider
import com.sapcework.memo.util.escapeLikeWildcards
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.map
import javax.inject.Inject

/**
 * [TagRepository] のRoom実装。
 */
class TagRepositoryImpl @Inject constructor(
    private val tagDao: TagDao,
    private val timeProvider: TimeProvider,
    // 将来のKotlinで既定の適用対象が変わるため、対象をパラメータに固定する(KT-73255)
    @param:IoDispatcher private val ioDispatcher: CoroutineDispatcher,
) : TagRepository {

    override fun observeAll(): Flow<List<Tag>> = tagDao.observeAll()
        .map { rows -> rows.map(TagEntity::toDomain) }
        .flowOn(ioDispatcher)

    override fun search(query: String): Flow<List<Tag>> = tagDao.searchByName(query.trim().escapeLikeWildcards())
        .map { rows -> rows.map(TagEntity::toDomain) }
        .flowOn(ioDispatcher)

    override fun observeMemoCount(tagId: Long): Flow<Int> = tagDao.observeMemoCount(tagId).flowOn(ioDispatcher)

    override suspend fun create(name: String): Long = tagDao.insertOrGet(
        TagEntity(name = name.trim(), createdAt = timeProvider.nowMillis()),
    )

    override suspend fun rename(id: Long, name: String) {
        val existing = tagDao.findById(id) ?: return
        tagDao.update(existing.copy(name = name.trim()))
    }

    override suspend fun delete(id: Long) {
        val existing = tagDao.findById(id) ?: return
        tagDao.delete(existing)
    }

    override suspend fun setTagsOfMemo(memoId: Long, tagIds: List<Long>) = tagDao.replaceTagsOfMemo(memoId, tagIds)
}
