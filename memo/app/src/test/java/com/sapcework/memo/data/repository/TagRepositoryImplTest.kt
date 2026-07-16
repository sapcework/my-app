package com.sapcework.memo.data.repository

import com.sapcework.memo.testutil.FakeTimeProvider
import com.sapcework.memo.testutil.MemoDatabaseTestBase
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * [TagRepositoryImpl] を実DBに対して検証する。
 *
 * SQL自体の正しさはDAOテストが担保済みのため、ここではRepositoryの責務、
 * すなわち名前の整形・検索語のエスケープ・時刻の注入・存在しないidの扱いに絞る。
 */
@OptIn(ExperimentalCoroutinesApi::class) // UnconfinedTestDispatcher
class TagRepositoryImplTest : MemoDatabaseTestBase() {

    private val time = FakeTimeProvider(now = OLD)
    private lateinit var repository: TagRepositoryImpl

    @Before
    fun setUpRepository() {
        repository = TagRepositoryImpl(tagDao, time, UnconfinedTestDispatcher())
    }

    @Test
    fun `createは作成日にTimeProviderの時刻を入れる`() = runTest {
        time.advanceTo(NEW)

        val id = repository.create("仕事")

        assertEquals(NEW, repository.observeAll().first().single { it.id == id }.createdAt)
    }

    @Test
    fun `createはタグ名の前後の空白を落とす`() = runTest {
        val id = repository.create("  仕事  ")

        assertEquals("仕事", repository.observeAll().first().single { it.id == id }.name)
    }

    @Test
    fun `createは同名タグを重複させず既存のidを返す`() = runTest {
        val first = repository.create("仕事")

        val second = repository.create("仕事")

        assertEquals(first, second)
        assertEquals(1, repository.observeAll().first().size)
    }

    @Test
    fun `createは空白の有無が違うだけの名前を同じタグとして扱う`() = runTest {
        val first = repository.create("仕事")

        val second = repository.create("  仕事  ")

        assertEquals(first, second)
        assertEquals(1, repository.observeAll().first().size)
    }

    @Test
    fun `observeAllはドメインモデルへ変換して名前順で返す`() = runTest {
        repository.create("banana")
        repository.create("Apple")

        val tags = repository.observeAll().first()

        assertEquals(listOf("Apple", "banana"), tags.map { it.name })
    }

    @Test
    fun `observeAllはタグの追加を通知する`() = runTest {
        repository.create("仕事")
        assertEquals(1, repository.observeAll().first().size)

        repository.create("私用")

        assertEquals(listOf("仕事", "私用"), repository.observeAll().first().map { it.name })
    }

    @Test
    fun `searchは部分一致でタグを返す`() = runTest {
        repository.create("仕事")
        repository.create("仕事_至急")
        repository.create("私用")

        val found = repository.search("仕事").first()

        assertEquals(listOf("仕事", "仕事_至急"), found.map { it.name })
    }

    @Test
    fun `searchは検索語の前後の空白を無視する`() = runTest {
        repository.create("仕事")

        val found = repository.search("  仕事  ").first()

        assertEquals(listOf("仕事"), found.map { it.name })
    }

    @Test
    fun `searchは検索語のワイルドカードを文字として扱う`() = runTest {
        repository.create("a_b")
        repository.create("axb")

        val found = repository.search("a_b").first()

        assertEquals(listOf("a_b"), found.map { it.name })
    }

    @Test
    fun `renameはタグ名を変え前後の空白を落とす`() = runTest {
        val id = repository.create("仕事")

        repository.rename(id, "  業務  ")

        assertEquals("業務", repository.observeAll().first().single().name)
    }

    @Test
    fun `renameは作成日を保つ`() = runTest {
        val id = repository.create("仕事")
        time.advanceTo(NEW)

        repository.rename(id, "業務")

        assertEquals(OLD, repository.observeAll().first().single().createdAt)
    }

    @Test
    fun `renameは存在しないidを黙って無視する`() = runTest {
        repository.rename(MISSING_ID, "業務")

        assertTrue(repository.observeAll().first().isEmpty())
    }

    @Test
    fun `deleteはタグを消しメモとの関連も外す`() = runTest {
        val tagId = repository.create("仕事")
        val memoId = insertMemo(title = "メモ")
        repository.setTagsOfMemo(memoId, listOf(tagId))

        repository.delete(tagId)

        assertTrue(repository.observeAll().first().isEmpty())
        assertTrue(memoDao.findById(memoId)?.tags.orEmpty().isEmpty())
        assertEquals("メモ", memoDao.findById(memoId)?.memo?.title) // メモ自体は残る
    }

    @Test
    fun `deleteは存在しないidを黙って無視する`() = runTest {
        repository.create("仕事")

        repository.delete(MISSING_ID)

        assertEquals(1, repository.observeAll().first().size)
    }

    @Test
    fun `setTagsOfMemoはメモのタグを置き換える`() = runTest {
        val work = repository.create("仕事")
        val urgent = repository.create("至急")
        val private = repository.create("私用")
        val memoId = insertMemo()
        repository.setTagsOfMemo(memoId, listOf(work, urgent))

        repository.setTagsOfMemo(memoId, listOf(private))

        assertEquals(listOf("私用"), memoDao.findById(memoId)?.tags?.map { it.name })
    }

    @Test
    fun `setTagsOfMemoは空リストで全てのタグを外す`() = runTest {
        val work = repository.create("仕事")
        val memoId = insertMemo()
        repository.setTagsOfMemo(memoId, listOf(work))

        repository.setTagsOfMemo(memoId, emptyList())

        assertTrue(memoDao.findById(memoId)?.tags.orEmpty().isEmpty())
        assertEquals(1, repository.observeAll().first().size) // タグ自体は残る
    }

    @Test
    fun `observeMemoCountは付与されたメモの件数を返す`() = runTest {
        val tagId = repository.create("仕事")
        val first = insertMemo(title = "1件目")
        val second = insertMemo(title = "2件目")
        insertMemo(title = "タグ無し")
        repository.setTagsOfMemo(first, listOf(tagId))
        repository.setTagsOfMemo(second, listOf(tagId))

        assertEquals(2, repository.observeMemoCount(tagId).first())
    }

    @Test
    fun `observeMemoCountはゴミ箱のメモを数えない`() = runTest {
        val tagId = repository.create("仕事")
        val memoId = insertMemo()
        repository.setTagsOfMemo(memoId, listOf(tagId))

        memoDao.moveToTrash(memoId, NEW)

        assertEquals(0, repository.observeMemoCount(tagId).first())
    }

    @Test
    fun `異なる名前のタグには別のidが採番される`() = runTest {
        val work = repository.create("仕事")
        val private = repository.create("私用")

        assertNotEquals(work, private)
        assertNull(repository.observeAll().first().find { it.name == "存在しない" })
    }
}
