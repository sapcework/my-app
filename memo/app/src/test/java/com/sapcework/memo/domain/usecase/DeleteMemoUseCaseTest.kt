package com.sapcework.memo.domain.usecase

import com.sapcework.memo.domain.repository.MemoRepository
import com.sapcework.memo.testutil.testMemo
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

/**
 * [DeleteMemoUseCase] の「1回目はゴミ箱、2回目で完全削除」を検証する。
 * 復元可能性が要件の中核のため、この分岐の取り違えは実害が大きい。
 */
class DeleteMemoUseCaseTest {

    private val memoRepository = mock<MemoRepository>()
    private val deleteMemo = DeleteMemoUseCase(memoRepository)

    @Test
    fun `ゴミ箱にないメモはゴミ箱へ移しfalseを返す`() = runTest {
        whenever(memoRepository.findById(ID)).thenReturn(memo(deletedAt = null))

        val purged = deleteMemo(ID)

        assertEquals(false, purged) // 取り消し導線を出せること
        verify(memoRepository).moveToTrash(ID)
        verify(memoRepository, never()).deletePermanently(any())
    }

    @Test
    fun `ゴミ箱にあるメモは完全削除しtrueを返す`() = runTest {
        whenever(memoRepository.findById(ID)).thenReturn(memo(deletedAt = DELETED_AT))

        val purged = deleteMemo(ID)

        assertEquals(true, purged)
        verify(memoRepository).deletePermanently(ID)
        verify(memoRepository, never()).moveToTrash(any())
    }

    @Test
    fun `存在しないメモはfalseを返し何も削除しない`() = runTest {
        whenever(memoRepository.findById(ID)).thenReturn(null)

        val purged = deleteMemo(ID)

        assertEquals(false, purged)
        verify(memoRepository, never()).moveToTrash(any())
        verify(memoRepository, never()).deletePermanently(any())
    }

    @Test
    fun `削除の可否は渡されたidに対するDBの現在値で判断する`() = runTest {
        whenever(memoRepository.findById(ID)).thenReturn(memo(deletedAt = null))

        deleteMemo(ID)

        // 画面が持つ古い状態ではなくDBを引くこと
        verify(memoRepository).findById(ID)
    }

    private fun memo(deletedAt: Long?) = testMemo(id = ID, deletedAt = deletedAt)

    private companion object {
        const val ID = 7L
        const val DELETED_AT = 2_000L
    }
}
