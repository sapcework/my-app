package com.sapcework.memo.domain.usecase

import com.sapcework.memo.domain.repository.MemoRepository
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever

/**
 * [SaveMemoUseCase] の新規作成と更新の分岐を検証する。
 */
class SaveMemoUseCaseTest {

    private val memoRepository = mock<MemoRepository>()
    private val saveMemo = SaveMemoUseCase(memoRepository)

    @Test
    fun `idがnullで中身があれば新規作成し採番されたidを返す`() = runTest {
        whenever(memoRepository.create(any(), any())).thenReturn(NEW_ID)

        val id = saveMemo(id = null, title = "買い物", content = "牛乳")

        assertEquals(NEW_ID, id)
        verify(memoRepository).create(title = "買い物", content = "牛乳")
    }

    @Test
    fun `idがnullでタイトルだけあれば作成する`() = runTest {
        whenever(memoRepository.create(any(), any())).thenReturn(NEW_ID)

        val id = saveMemo(id = null, title = "買い物", content = "")

        assertEquals(NEW_ID, id)
        verify(memoRepository).create(title = "買い物", content = "")
    }

    @Test
    fun `idがnullで本文だけあれば作成する`() = runTest {
        whenever(memoRepository.create(any(), any())).thenReturn(NEW_ID)

        val id = saveMemo(id = null, title = "", content = "牛乳")

        assertEquals(NEW_ID, id)
        verify(memoRepository).create(title = "", content = "牛乳")
    }

    @Test
    fun `idがnullでタイトルも本文も空なら保存せずnullを返す`() = runTest {
        val id = saveMemo(id = null, title = "", content = "")

        assertNull(id) // 画面を開いただけで空のメモが増えないこと
        verifyNoInteractions(memoRepository)
    }

    @Test
    fun `idがnullで空白のみなら保存しない`() = runTest {
        val id = saveMemo(id = null, title = "   ", content = "\n\t ")

        assertNull(id)
        verifyNoInteractions(memoRepository)
    }

    @Test
    fun `既存idなら更新しそのidを返す`() = runTest {
        val id = saveMemo(id = EXISTING_ID, title = "新題", content = "新文")

        assertEquals(EXISTING_ID, id)
        verify(memoRepository).updateContent(id = EXISTING_ID, title = "新題", content = "新文")
        verify(memoRepository, never()).create(any(), any())
    }

    @Test
    fun `既存idなら中身が空でも更新する`() = runTest {
        // 既存メモの中身を消す操作は正当なため、空判定は新規作成にのみ効く
        val id = saveMemo(id = EXISTING_ID, title = "", content = "")

        assertEquals(EXISTING_ID, id)
        verify(memoRepository).updateContent(id = EXISTING_ID, title = "", content = "")
    }

    private companion object {
        const val NEW_ID = 42L
        const val EXISTING_ID = 7L
    }
}
