package com.sapcework.memo.data.dao

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.sapcework.memo.data.database.MemoDatabase
import com.sapcework.memo.data.entity.MemoEntity
import com.sapcework.memo.data.entity.MemoWithTags
import com.sapcework.memo.data.entity.TagEntity
import kotlinx.coroutines.flow.first
import org.junit.After
import org.junit.Before
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * DAOテストの共通土台。
 *
 * インメモリDBのため各テストは独立し、実行順に依存しない。
 * Robolectric上のJVMで動くため実機・エミュレータを必要としない。
 */
@RunWith(RobolectricTestRunner::class)
abstract class DaoTestBase {

    protected lateinit var db: MemoDatabase
    protected lateinit var memoDao: MemoDao
    protected lateinit var tagDao: TagDao

    @Before
    fun setUpDatabase() {
        db = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            MemoDatabase::class.java,
        ).build()
        memoDao = db.memoDao()
        tagDao = db.tagDao()
    }

    @After
    fun closeDatabase() {
        db.close()
    }

    /** 既定値を持つメモを1件作り、採番されたidを返す。 */
    protected suspend fun insertMemo(
        title: String = "タイトル",
        content: String = "本文",
        createdAt: Long = OLD,
        updatedAt: Long = createdAt,
        isPinned: Boolean = false,
        isFavorite: Boolean = false,
        deletedAt: Long? = null,
    ): Long = memoDao.insert(
        MemoEntity(
            title = title,
            content = content,
            createdAt = createdAt,
            updatedAt = updatedAt,
            isPinned = isPinned,
            isFavorite = isFavorite,
            deletedAt = deletedAt,
        ),
    )

    protected suspend fun insertTag(name: String): Long = tagDao.insert(TagEntity(name = name, createdAt = OLD))

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

    companion object {
        const val OLD = 1_000L // 古い時刻
        const val MIDDLE = 2_000L // OLDとNEWの中間。パージ閾値の検証に使う
        const val NEW = 3_000L // 新しい時刻
        const val MISSING_ID = 999L // 存在しないメモ/タグのid
    }
}
