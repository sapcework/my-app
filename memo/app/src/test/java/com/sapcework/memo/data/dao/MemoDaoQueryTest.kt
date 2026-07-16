package com.sapcework.memo.data.dao

import com.sapcework.memo.util.escapeLikeWildcards
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * [MemoDao.observeMemos] の検索・絞り込み・並び替えを検証する。
 * 登録や更新そのものの振る舞いは [MemoDaoTest] が受け持つ。
 */
class MemoDaoQueryTest : DaoTestBase() {

    @Test
    fun `observeMemosはゴミ箱のメモを除外する`() = runTest {
        insertMemo(title = "通常")
        insertMemo(title = "削除済み", deletedAt = NEW)

        assertEquals(listOf("通常"), titlesOf(observeVisible()))
    }

    @Test
    fun `observeMemosは検索語が空なら絞り込まない`() = runTest {
        insertMemo(title = "1件目")
        insertMemo(title = "2件目")

        assertEquals(2, observeVisible(query = "").size)
    }

    @Test
    fun `observeMemosはタイトルと本文の両方を検索する`() = runTest {
        insertMemo(title = "会議メモ", content = "議事録")
        insertMemo(title = "買い物", content = "会議のあとに寄る")
        insertMemo(title = "無関係", content = "無関係")

        val found = observeVisible(query = "会議")

        assertEquals(setOf("会議メモ", "買い物"), titlesOf(found).toSet())
    }

    @Test
    fun `titleOnlyがtrueなら本文は検索対象にならない`() = runTest {
        insertMemo(title = "会議メモ", content = "議事録")
        insertMemo(title = "買い物", content = "会議のあとに寄る")

        val found = observeVisible(query = "会議", titleOnly = true)

        assertEquals(listOf("会議メモ"), titlesOf(found))
    }

    @Test
    fun `observeMemosはお気に入りのみに絞れる`() = runTest {
        insertMemo(title = "お気に入り", isFavorite = true)
        insertMemo(title = "通常")

        assertEquals(listOf("お気に入り"), titlesOf(observeVisible(onlyFavorite = true)))
    }

    @Test
    fun `observeMemosは指定タグをすべて持つメモのみ返す`() = runTest {
        val work = insertTag("仕事")
        val urgent = insertTag("至急")
        val both = insertMemo(title = "両方")
        val workOnly = insertMemo(title = "仕事のみ")
        insertMemo(title = "タグ無し")
        tagDao.replaceTagsOfMemo(both, listOf(work, urgent))
        tagDao.replaceTagsOfMemo(workOnly, listOf(work))

        val found = observeVisible(tagIds = listOf(work, urgent))

        assertEquals(listOf("両方"), titlesOf(found))
    }

    @Test
    fun `observeMemosはタグ未指定なら絞り込まない`() = runTest {
        val work = insertTag("仕事")
        val tagged = insertMemo(title = "タグ付き")
        insertMemo(title = "タグ無し")
        tagDao.replaceTagsOfMemo(tagged, listOf(work))

        assertEquals(2, observeVisible(tagIds = emptyList()).size)
    }

    @Test
    fun `observeMemosは検索とタグ絞り込みを組み合わせられる`() = runTest {
        val work = insertTag("仕事")
        val hit = insertMemo(title = "会議メモ")
        val tagMismatch = insertMemo(title = "会議の準備")
        val queryMismatch = insertMemo(title = "買い物")
        tagDao.replaceTagsOfMemo(hit, listOf(work))
        tagDao.replaceTagsOfMemo(queryMismatch, listOf(work))
        tagDao.replaceTagsOfMemo(tagMismatch, emptyList())

        val found = observeVisible(query = "会議", tagIds = listOf(work))

        assertEquals(listOf("会議メモ"), titlesOf(found))
    }

    @Test
    fun `observeMemosは付与済みのタグを含めて返す`() = runTest {
        val id = insertMemo(title = "タグ付き")
        val work = insertTag("仕事")
        tagDao.replaceTagsOfMemo(id, listOf(work))

        val found = observeVisible().single()

        assertEquals(listOf("仕事"), found.tags.map { it.name })
    }

    @Test
    fun `observeMemosはピン留めを常に先頭へ置く`() = runTest {
        insertMemo(title = "新しい", updatedAt = NEW)
        insertMemo(title = "ピン留め", updatedAt = OLD, isPinned = true)

        assertEquals(listOf("ピン留め", "新しい"), titlesOf(observeVisible()))
    }

    @Test
    fun `ピン留めは並び替えの指定より優先される`() = runTest {
        insertMemo(title = "あ", isPinned = false)
        insertMemo(title = "ん", isPinned = true)

        val found = observeVisible(sortKey = MemoSortKey.TITLE_ASC)

        assertEquals(listOf("ん", "あ"), titlesOf(found))
    }

    @Test
    fun `sortKeyがUPDATED_DESCなら更新日の新しい順`() = runTest {
        insertMemo(title = "古い", updatedAt = OLD)
        insertMemo(title = "新しい", updatedAt = NEW)

        val found = observeVisible(sortKey = MemoSortKey.UPDATED_DESC)

        assertEquals(listOf("新しい", "古い"), titlesOf(found))
    }

    @Test
    fun `sortKeyがCREATED_DESCなら作成日の新しい順`() = runTest {
        insertMemo(title = "先に作成", createdAt = OLD, updatedAt = NEW)
        insertMemo(title = "後に作成", createdAt = NEW, updatedAt = OLD)

        val found = observeVisible(sortKey = MemoSortKey.CREATED_DESC)

        assertEquals(listOf("後に作成", "先に作成"), titlesOf(found))
    }

    @Test
    fun `sortKeyがTITLE_ASCならタイトル昇順で大文字小文字を区別しない`() = runTest {
        insertMemo(title = "banana")
        insertMemo(title = "Apple")
        insertMemo(title = "cherry")

        val found = observeVisible(sortKey = MemoSortKey.TITLE_ASC)

        assertEquals(listOf("Apple", "banana", "cherry"), titlesOf(found))
    }

    @Test
    fun `sortKeyがFAVORITE_FIRSTならお気に入りを先に置く`() = runTest {
        insertMemo(title = "通常", updatedAt = NEW)
        insertMemo(title = "お気に入り", updatedAt = OLD, isFavorite = true)

        val found = observeVisible(sortKey = MemoSortKey.FAVORITE_FIRST)

        assertEquals(listOf("お気に入り", "通常"), titlesOf(found))
    }

    @Test
    fun `検索語のパーセントはエスケープすればワイルドカードにならない`() = runTest {
        insertMemo(title = "100%達成")
        insertMemo(title = "1000円")

        val found = observeVisible(query = "100%".escapeLikeWildcards())

        assertEquals(listOf("100%達成"), titlesOf(found))
    }

    @Test
    fun `検索語のアンダースコアはエスケープすれば1文字ワイルドカードにならない`() = runTest {
        insertMemo(title = "a_b")
        insertMemo(title = "axb")

        val found = observeVisible(query = "a_b".escapeLikeWildcards())

        assertEquals(listOf("a_b"), titlesOf(found))
    }
}
