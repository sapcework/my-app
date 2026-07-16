package com.sapcework.memo.data.dao

import app.cash.turbine.test
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * [MemoDao] のうち、登録・更新・ゴミ箱・エクスポートの振る舞いを検証する。
 * 一覧の検索・絞り込み・並び替えは [MemoDaoQueryTest] が受け持つ。
 */
class MemoDaoTest : DaoTestBase() {

    @Test
    fun `insertしたメモをfindByIdで取得できる`() = runTest {
        val id = insertMemo(title = "買い物", content = "牛乳")

        val found = memoDao.findById(id)

        assertEquals("買い物", found?.memo?.title)
        assertEquals("牛乳", found?.memo?.content)
        assertTrue(found?.tags.orEmpty().isEmpty())
    }

    @Test
    fun `findByIdは存在しないidにnullを返す`() = runTest {
        assertNull(memoDao.findById(MISSING_ID))
    }

    @Test
    fun `updateContentはタイトル本文更新日時のみを書き換える`() = runTest {
        val id = insertMemo(title = "旧題", content = "旧文", createdAt = OLD, isPinned = true)

        memoDao.updateContent(id = id, title = "新題", content = "新文", updatedAt = NEW)

        val memo = memoDao.findById(id)?.memo
        assertEquals("新題", memo?.title)
        assertEquals("新文", memo?.content)
        assertEquals(NEW, memo?.updatedAt)
        assertEquals(OLD, memo?.createdAt) // 作成日は書き換えない
        assertEquals(true, memo?.isPinned) // ピン留めも維持する
    }

    @Test
    fun `observeByIdは内容の更新を通知する`() = runTest {
        val id = insertMemo(title = "旧題")

        memoDao.observeById(id).test {
            assertEquals("旧題", awaitItem()?.memo?.title)

            memoDao.updateContent(id = id, title = "新題", content = "本文", updatedAt = NEW)

            assertEquals("新題", awaitItem()?.memo?.title)
        }
    }

    @Test
    fun `moveToTrashしたメモは一覧から消えゴミ箱に現れる`() = runTest {
        val id = insertMemo(title = "捨てる")

        memoDao.moveToTrash(id, NEW)

        assertTrue(observeVisible().isEmpty())
        assertEquals(listOf("捨てる"), titlesOf(memoDao.observeTrash().first()))
        assertEquals(NEW, memoDao.findById(id)?.memo?.deletedAt)
    }

    @Test
    fun `observeTrashは削除が新しい順に並べる`() = runTest {
        val firstDeleted = insertMemo(title = "先に削除")
        val lastDeleted = insertMemo(title = "後に削除")
        memoDao.moveToTrash(firstDeleted, OLD)
        memoDao.moveToTrash(lastDeleted, NEW)

        val trash = memoDao.observeTrash().first()

        assertEquals(listOf("後に削除", "先に削除"), titlesOf(trash))
    }

    @Test
    fun `restoreFromTrashで一覧へ戻り更新日時が更新される`() = runTest {
        val id = insertMemo(title = "復元する")
        memoDao.moveToTrash(id, OLD)

        memoDao.restoreFromTrash(id, NEW)

        assertEquals(listOf("復元する"), titlesOf(observeVisible()))
        assertTrue(memoDao.observeTrash().first().isEmpty())
        assertNull(memoDao.findById(id)?.memo?.deletedAt)
        assertEquals(NEW, memoDao.findById(id)?.memo?.updatedAt)
    }

    @Test
    fun `deletePermanentlyはタグとの関連をCASCADEで消すがタグ自体は残す`() = runTest {
        val tagId = insertTag("仕事")
        val id = insertMemo(title = "消す")
        tagDao.replaceTagsOfMemo(id, listOf(tagId))

        memoDao.deletePermanently(id)

        assertNull(memoDao.findById(id))
        assertEquals(0, crossRefCount())
        assertEquals("仕事", tagDao.findById(tagId)?.name)
    }

    @Test
    fun `purgeExpiredは閾値より前に削除されたメモだけを物理削除する`() = runTest {
        val expired = insertMemo(title = "期限切れ")
        val kept = insertMemo(title = "保持中")
        memoDao.moveToTrash(expired, OLD)
        memoDao.moveToTrash(kept, NEW)

        val purged = memoDao.purgeExpired(MIDDLE)

        assertEquals(1, purged)
        assertNull(memoDao.findById(expired))
        assertEquals(listOf("保持中"), titlesOf(memoDao.observeTrash().first()))
    }

    @Test
    fun `purgeExpiredはゴミ箱に入っていないメモを消さない`() = runTest {
        insertMemo(title = "通常")

        val purged = memoDao.purgeExpired(NEW)

        assertEquals(0, purged)
        assertEquals(listOf("通常"), titlesOf(observeVisible()))
    }

    @Test
    fun `setPinnedはピン留めを切り替える`() = runTest {
        val id = insertMemo()

        memoDao.setPinned(id, true)
        assertEquals(true, memoDao.findById(id)?.memo?.isPinned)

        memoDao.setPinned(id, false)
        assertEquals(false, memoDao.findById(id)?.memo?.isPinned)
    }

    @Test
    fun `setFavoriteはお気に入りを切り替える`() = runTest {
        val id = insertMemo()

        memoDao.setFavorite(id, true)
        assertEquals(true, memoDao.findById(id)?.memo?.isFavorite)

        memoDao.setFavorite(id, false)
        assertEquals(false, memoDao.findById(id)?.memo?.isFavorite)
    }

    @Test
    fun `findAllForExportはゴミ箱を含む全件をid順に返す`() = runTest {
        val first = insertMemo(title = "1件目")
        insertMemo(title = "2件目")
        memoDao.moveToTrash(first, NEW)

        val all = memoDao.findAllForExport()

        assertEquals(listOf("1件目", "2件目"), titlesOf(all))
    }

    @Test
    fun `findAllForExportは付与済みのタグを含めて返す`() = runTest {
        val id = insertMemo(title = "タグ付き")
        val work = insertTag("仕事")
        val urgent = insertTag("至急")
        tagDao.replaceTagsOfMemo(id, listOf(work, urgent))

        val exported = memoDao.findAllForExport().single()

        assertEquals(setOf("仕事", "至急"), exported.tags.map { it.name }.toSet())
    }

    /** 中間テーブルはDAOに参照口が無いため、CASCADEの確認だけ生SQLで行う。 */
    private fun crossRefCount(): Int =
        db.openHelper.readableDatabase.query("SELECT COUNT(*) FROM memo_tag_cross_ref").use { cursor ->
            cursor.moveToFirst()
            cursor.getInt(0)
        }
}
