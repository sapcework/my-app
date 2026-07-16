package com.sapcework.memo.domain.usecase

import com.sapcework.memo.domain.repository.TagRepository
import kotlinx.coroutines.test.runTest
import org.junit.Test
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

/**
 * [SetMemoTagsUseCase] の名前解決と正規化を検証する。
 * 表記ゆれのタグが増えないことがこのUseCaseの存在理由のため、正規化を重点的に確かめる。
 */
class SetMemoTagsUseCaseTest {

    private val tagRepository = mock<TagRepository>()
    private val setMemoTags = SetMemoTagsUseCase(tagRepository)

    @Test
    fun `タグ名からidを解決して関連を張る`() = runTest {
        whenever(tagRepository.create("仕事")).thenReturn(WORK_ID)
        whenever(tagRepository.create("至急")).thenReturn(URGENT_ID)

        setMemoTags(memoId = MEMO_ID, tagNames = listOf("仕事", "至急"))

        verify(tagRepository).setTagsOfMemo(memoId = MEMO_ID, tagIds = listOf(WORK_ID, URGENT_ID))
    }

    @Test
    fun `タグ名の前後の空白を落として解決する`() = runTest {
        whenever(tagRepository.create("仕事")).thenReturn(WORK_ID)

        setMemoTags(memoId = MEMO_ID, tagNames = listOf("  仕事  "))

        verify(tagRepository).create("仕事")
        verify(tagRepository).setTagsOfMemo(memoId = MEMO_ID, tagIds = listOf(WORK_ID))
    }

    @Test
    fun `空の名前は除外する`() = runTest {
        whenever(tagRepository.create("仕事")).thenReturn(WORK_ID)

        setMemoTags(memoId = MEMO_ID, tagNames = listOf("仕事", "", "   "))

        verify(tagRepository, never()).create("")
        verify(tagRepository).setTagsOfMemo(memoId = MEMO_ID, tagIds = listOf(WORK_ID))
    }

    @Test
    fun `同名を複数渡されても関連は1本にする`() = runTest {
        whenever(tagRepository.create("仕事")).thenReturn(WORK_ID)

        setMemoTags(memoId = MEMO_ID, tagNames = listOf("仕事", "仕事"))

        verify(tagRepository).setTagsOfMemo(memoId = MEMO_ID, tagIds = listOf(WORK_ID))
    }

    @Test
    fun `重複の判定は空白を落とした後の名前で行う`() = runTest {
        whenever(tagRepository.create("仕事")).thenReturn(WORK_ID)

        setMemoTags(memoId = MEMO_ID, tagNames = listOf("仕事", "  仕事  "))

        verify(tagRepository).setTagsOfMemo(memoId = MEMO_ID, tagIds = listOf(WORK_ID))
    }

    @Test
    fun `空リストなら全てのタグを外す`() = runTest {
        setMemoTags(memoId = MEMO_ID, tagNames = emptyList())

        verify(tagRepository).setTagsOfMemo(memoId = MEMO_ID, tagIds = emptyList())
    }

    @Test
    fun `名前が全て空なら全てのタグを外す`() = runTest {
        setMemoTags(memoId = MEMO_ID, tagNames = listOf("", "   "))

        verify(tagRepository).setTagsOfMemo(memoId = MEMO_ID, tagIds = emptyList())
    }

    @Test
    fun `渡された順序どおりに関連を張る`() = runTest {
        whenever(tagRepository.create("至急")).thenReturn(URGENT_ID)
        whenever(tagRepository.create("仕事")).thenReturn(WORK_ID)

        setMemoTags(memoId = MEMO_ID, tagNames = listOf("至急", "仕事"))

        verify(tagRepository).setTagsOfMemo(memoId = MEMO_ID, tagIds = listOf(URGENT_ID, WORK_ID))
    }

    private companion object {
        const val MEMO_ID = 7L
        const val WORK_ID = 1L
        const val URGENT_ID = 2L
    }
}
