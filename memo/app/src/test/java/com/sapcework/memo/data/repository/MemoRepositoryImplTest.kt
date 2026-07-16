package com.sapcework.memo.data.repository

import app.cash.turbine.test
import com.sapcework.memo.domain.model.MemoFilter
import com.sapcework.memo.domain.model.MemoSortOrder
import com.sapcework.memo.testutil.FakeTimeProvider
import com.sapcework.memo.testutil.MemoDatabaseTestBase
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * [MemoRepositoryImpl] を実DBに対して検証する。
 *
 * SQL自体の正しさはDAOテストが担保済みのため、ここではRepositoryの責務、
 * すなわち検索語の整形・並び順の変換・時刻の注入・ドメインモデルへの変換に絞る。
 */
@OptIn(ExperimentalCoroutinesApi::class) // UnconfinedTestDispatcher
class MemoRepositoryImplTest : MemoDatabaseTestBase() {

    private val time = FakeTimeProvider(now = OLD)
    private lateinit var repository: MemoRepositoryImpl

    @Before
    fun setUpRepository() {
        repository = MemoRepositoryImpl(memoDao, time, UnconfinedTestDispatcher())
    }

    @Test
    fun `createは作成日と更新日にTimeProviderの時刻を入れる`() = runTest {
        time.advanceTo(NEW)

        val id = repository.create(title = "買い物", content = "牛乳")

        val memo = repository.findById(id)
        assertEquals(NEW, memo?.createdAt)
        assertEquals(NEW, memo?.updatedAt)
        assertNull(memo?.deletedAt)
    }

    @Test
    fun `findByIdはドメインモデルへ変換して返す`() = runTest {
        val id = repository.create(title = "買い物", content = "牛乳")

        val memo = repository.findById(id)

        assertEquals(id, memo?.id)
        assertEquals("買い物", memo?.title)
        assertEquals("牛乳", memo?.content)
        assertEquals(false, memo?.isInTrash)
        assertTrue(memo?.tags.orEmpty().isEmpty())
    }

    @Test
    fun `findByIdは存在しないidにnullを返す`() = runTest {
        assertNull(repository.findById(MISSING_ID))
    }

    @Test
    fun `observeMemosは検索語の前後の空白を無視する`() = runTest {
        repository.create(title = "会議メモ", content = "議事録")

        val found = repository.observeMemos(MemoFilter(query = "  会議  ")).first()

        assertEquals(listOf("会議メモ"), found.map { it.title })
    }

    @Test
    fun `observeMemosは検索語のワイルドカードを文字として扱う`() = runTest {
        repository.create(title = "100%達成", content = "")
        repository.create(title = "1000円", content = "")

        val found = repository.observeMemos(MemoFilter(query = "100%")).first()

        assertEquals(listOf("100%達成"), found.map { it.title })
    }

    @Test
    fun `observeMemosはタグをドメインモデルへ変換して返す`() = runTest {
        val id = repository.create(title = "タグ付き", content = "")
        val tagId = insertTag("仕事")
        tagDao.replaceTagsOfMemo(id, listOf(tagId))

        val memo = repository.observeMemos(MemoFilter()).first().single()

        assertEquals(listOf("仕事"), memo.tags.map { it.name })
        assertEquals(listOf(tagId), memo.tags.map { it.id })
    }

    @Test
    fun `observeMemosはゴミ箱のメモを含めない`() = runTest {
        val id = repository.create(title = "捨てる", content = "")
        repository.moveToTrash(id)

        assertTrue(repository.observeMemos(MemoFilter()).first().isEmpty())
    }

    @Test
    fun `observeMemosは並び順UPDATED_DESCを更新日の新しい順へ変換する`() = runTest {
        createAt(OLD, "古い")
        createAt(NEW, "新しい")

        val found = repository.observeMemos(MemoFilter(sortOrder = MemoSortOrder.UPDATED_DESC)).first()

        assertEquals(listOf("新しい", "古い"), found.map { it.title })
    }

    @Test
    fun `observeMemosは並び順CREATED_DESCを作成日の新しい順へ変換する`() = runTest {
        val early = createAt(OLD, "先に作成")
        createAt(MIDDLE, "後に作成")
        time.advanceTo(NEW)
        repository.updateContent(early, "先に作成", "更新して最新にする") // 更新日だけを新しくする

        val found = repository.observeMemos(MemoFilter(sortOrder = MemoSortOrder.CREATED_DESC)).first()

        assertEquals(listOf("後に作成", "先に作成"), found.map { it.title })
    }

    @Test
    fun `observeMemosは並び順TITLE_ASCをタイトル昇順へ変換する`() = runTest {
        createAt(NEW, "banana")
        createAt(OLD, "Apple")

        val found = repository.observeMemos(MemoFilter(sortOrder = MemoSortOrder.TITLE_ASC)).first()

        assertEquals(listOf("Apple", "banana"), found.map { it.title })
    }

    @Test
    fun `observeMemosは並び順FAVORITE_FIRSTをお気に入り優先へ変換する`() = runTest {
        createAt(NEW, "通常")
        val favorite = createAt(OLD, "お気に入り")
        repository.setFavorite(favorite, true)

        val found = repository.observeMemos(MemoFilter(sortOrder = MemoSortOrder.FAVORITE_FIRST)).first()

        assertEquals(listOf("お気に入り", "通常"), found.map { it.title })
    }

    @Test
    fun `observeMemoは対象メモの更新を通知する`() = runTest {
        val id = repository.create(title = "旧題", content = "")

        repository.observeMemo(id).test {
            assertEquals("旧題", awaitItem()?.title)

            repository.updateContent(id, "新題", "")

            assertEquals("新題", awaitItem()?.title)
        }
    }

    @Test
    fun `updateContentは更新日時を現在時刻へ進め作成日は保つ`() = runTest {
        val id = createAt(OLD, "旧題")
        time.advanceTo(NEW)

        repository.updateContent(id, "新題", "新文")

        val memo = repository.findById(id)
        assertEquals("新題", memo?.title)
        assertEquals("新文", memo?.content)
        assertEquals(NEW, memo?.updatedAt)
        assertEquals(OLD, memo?.createdAt)
    }

    @Test
    fun `moveToTrashは削除時刻を現在時刻にしてゴミ箱へ移す`() = runTest {
        val id = createAt(OLD, "捨てる")
        time.advanceTo(NEW)

        repository.moveToTrash(id)

        assertEquals(NEW, repository.findById(id)?.deletedAt)
        assertEquals(listOf("捨てる"), repository.observeTrash().first().map { it.title })
        assertEquals(true, repository.findById(id)?.isInTrash)
    }

    @Test
    fun `restoreは削除時刻を消し更新日時を現在時刻へ進める`() = runTest {
        val id = createAt(OLD, "復元する")
        repository.moveToTrash(id)
        time.advanceTo(NEW)

        repository.restore(id)

        val memo = repository.findById(id)
        assertNull(memo?.deletedAt)
        assertEquals(NEW, memo?.updatedAt)
        assertTrue(repository.observeTrash().first().isEmpty())
    }

    @Test
    fun `deletePermanentlyはメモを完全に消す`() = runTest {
        val id = repository.create(title = "消す", content = "")

        repository.deletePermanently(id)

        assertNull(repository.findById(id))
    }

    @Test
    fun `purgeTrashOlderThanは閾値より前に削除されたメモだけを消す`() = runTest {
        val expired = createAt(OLD, "期限切れ")
        val kept = createAt(OLD, "保持中")
        time.advanceTo(OLD)
        repository.moveToTrash(expired)
        time.advanceTo(NEW)
        repository.moveToTrash(kept)

        val purged = repository.purgeTrashOlderThan(MIDDLE)

        assertEquals(1, purged)
        assertNull(repository.findById(expired))
        assertEquals(listOf("保持中"), repository.observeTrash().first().map { it.title })
    }

    @Test
    fun `setPinnedとsetFavoriteはドメインモデルへ反映される`() = runTest {
        val id = repository.create(title = "メモ", content = "")

        repository.setPinned(id, true)
        repository.setFavorite(id, true)

        val memo = repository.findById(id)
        assertEquals(true, memo?.isPinned)
        assertEquals(true, memo?.isFavorite)
    }

    @Test
    fun `findAllForExportはゴミ箱を含む全件をドメインモデルで返す`() = runTest {
        val trashed = createAt(OLD, "1件目")
        createAt(OLD, "2件目")
        repository.moveToTrash(trashed)

        val all = repository.findAllForExport()

        assertEquals(listOf("1件目", "2件目"), all.map { it.title })
        assertEquals(listOf(true, false), all.map { it.isInTrash })
    }

    /** 指定時刻に作成されたメモを1件用意する。 */
    private suspend fun createAt(createdAt: Long, title: String): Long {
        time.advanceTo(createdAt)
        return repository.create(title = title, content = "")
    }
}
