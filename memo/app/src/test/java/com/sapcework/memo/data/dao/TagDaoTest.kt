package com.sapcework.memo.data.dao

import com.sapcework.memo.data.entity.MemoTagCrossRef
import com.sapcework.memo.data.entity.TagEntity
import com.sapcework.memo.util.escapeLikeWildcards
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * [TagDao] のタグ操作と、メモ-タグ関連の振る舞いを検証する。
 */
class TagDaoTest : DaoTestBase() {

    @Test
    fun `insertしたタグをfindByIdで取得できる`() = runTest {
        val id = insertTag("仕事")

        assertEquals("仕事", tagDao.findById(id)?.name)
    }

    @Test
    fun `findByIdは存在しないidにnullを返す`() = runTest {
        assertNull(tagDao.findById(MISSING_ID))
    }

    @Test
    fun `findByNameは完全一致で取得する`() = runTest {
        insertTag("仕事")

        assertEquals("仕事", tagDao.findByName("仕事")?.name)
        assertNull(tagDao.findByName("仕")) // 部分一致では取得しない
    }

    @Test
    fun `observeAllは名前の昇順で大文字小文字を区別しない`() = runTest {
        insertTag("banana")
        insertTag("Apple")
        insertTag("cherry")

        val names = tagDao.observeAll().first().map { it.name }

        assertEquals(listOf("Apple", "banana", "cherry"), names)
    }

    @Test
    fun `同名タグのinsertはIGNOREされ-1を返す`() = runTest {
        insertTag("仕事")

        val inserted = tagDao.insert(TagEntity(name = "仕事", createdAt = NEW))

        assertEquals(-1L, inserted)
        assertEquals(1, tagDao.observeAll().first().size)
    }

    @Test
    fun `insertOrGetは新規なら採番したidを返す`() = runTest {
        val id = tagDao.insertOrGet(TagEntity(name = "仕事", createdAt = OLD))

        assertTrue(id > 0)
        assertEquals("仕事", tagDao.findById(id)?.name)
    }

    @Test
    fun `insertOrGetは同名が既にあれば既存のidを返す`() = runTest {
        val existing = insertTag("仕事")

        val id = tagDao.insertOrGet(TagEntity(name = "仕事", createdAt = NEW))

        assertEquals(existing, id)
        assertEquals(1, tagDao.observeAll().first().size)
        assertEquals(OLD, tagDao.findById(id)?.createdAt) // 既存の作成日を保つ
    }

    @Test
    fun `updateはタグ名を変更する`() = runTest {
        val id = insertTag("仕事")

        tagDao.update(TagEntity(id = id, name = "業務", createdAt = OLD))

        assertEquals("業務", tagDao.findById(id)?.name)
    }

    @Test
    fun `deleteはタグを消しメモとの関連もCASCADEで消える`() = runTest {
        val tagId = insertTag("仕事")
        val memoId = insertMemo(title = "メモ")
        tagDao.replaceTagsOfMemo(memoId, listOf(tagId))

        tagDao.delete(TagEntity(id = tagId, name = "仕事", createdAt = OLD))

        assertNull(tagDao.findById(tagId))
        assertTrue(memoDao.findById(memoId)?.tags.orEmpty().isEmpty())
        assertEquals("メモ", memoDao.findById(memoId)?.memo?.title) // メモ自体は残る
    }

    @Test
    fun `searchByNameは部分一致で返す`() = runTest {
        insertTag("仕事")
        insertTag("仕事_至急")
        insertTag("私用")

        val names = tagDao.searchByName("仕事").first().map { it.name }

        assertEquals(listOf("仕事", "仕事_至急"), names)
    }

    @Test
    fun `searchByNameのアンダースコアはエスケープすればワイルドカードにならない`() = runTest {
        insertTag("a_b")
        insertTag("axb")

        val names = tagDao.searchByName("a_b".escapeLikeWildcards()).first().map { it.name }

        assertEquals(listOf("a_b"), names)
    }

    @Test
    fun `addTagToMemoでメモにタグが付く`() = runTest {
        val tagId = insertTag("仕事")
        val memoId = insertMemo()

        tagDao.addTagToMemo(MemoTagCrossRef(memoId = memoId, tagId = tagId))

        assertEquals(listOf("仕事"), memoDao.findById(memoId)?.tags?.map { it.name })
    }

    @Test
    fun `addTagToMemoの重複付与はIGNOREされ二重に付かない`() = runTest {
        val tagId = insertTag("仕事")
        val memoId = insertMemo()
        val crossRef = MemoTagCrossRef(memoId = memoId, tagId = tagId)

        tagDao.addTagToMemo(crossRef)
        tagDao.addTagToMemo(crossRef)

        assertEquals(1, memoDao.findById(memoId)?.tags?.size)
    }

    @Test
    fun `removeTagFromMemoで関連だけが消える`() = runTest {
        val tagId = insertTag("仕事")
        val memoId = insertMemo()
        val crossRef = MemoTagCrossRef(memoId = memoId, tagId = tagId)
        tagDao.addTagToMemo(crossRef)

        tagDao.removeTagFromMemo(crossRef)

        assertTrue(memoDao.findById(memoId)?.tags.orEmpty().isEmpty())
        assertEquals("仕事", tagDao.findById(tagId)?.name) // タグ自体は残る
    }

    @Test
    fun `clearTagsOfMemoは対象メモのタグだけを外す`() = runTest {
        val tagId = insertTag("仕事")
        val target = insertMemo(title = "対象")
        val other = insertMemo(title = "他")
        tagDao.replaceTagsOfMemo(target, listOf(tagId))
        tagDao.replaceTagsOfMemo(other, listOf(tagId))

        tagDao.clearTagsOfMemo(target)

        assertTrue(memoDao.findById(target)?.tags.orEmpty().isEmpty())
        assertEquals(listOf("仕事"), memoDao.findById(other)?.tags?.map { it.name })
    }

    @Test
    fun `replaceTagsOfMemoは既存のタグを置き換える`() = runTest {
        val work = insertTag("仕事")
        val urgent = insertTag("至急")
        val private = insertTag("私用")
        val memoId = insertMemo()
        tagDao.replaceTagsOfMemo(memoId, listOf(work, urgent))

        tagDao.replaceTagsOfMemo(memoId, listOf(private))

        assertEquals(listOf("私用"), memoDao.findById(memoId)?.tags?.map { it.name })
    }

    @Test
    fun `observeMemoCountは付与されたメモの件数を返す`() = runTest {
        val tagId = insertTag("仕事")
        val first = insertMemo(title = "1件目")
        val second = insertMemo(title = "2件目")
        insertMemo(title = "タグ無し")
        tagDao.replaceTagsOfMemo(first, listOf(tagId))
        tagDao.replaceTagsOfMemo(second, listOf(tagId))

        assertEquals(2, tagDao.observeMemoCount(tagId).first())
    }

    @Test
    fun `observeMemoCountはゴミ箱のメモを数えない`() = runTest {
        val tagId = insertTag("仕事")
        val memoId = insertMemo()
        tagDao.replaceTagsOfMemo(memoId, listOf(tagId))

        memoDao.moveToTrash(memoId, NEW)

        assertEquals(0, tagDao.observeMemoCount(tagId).first())
    }
}
