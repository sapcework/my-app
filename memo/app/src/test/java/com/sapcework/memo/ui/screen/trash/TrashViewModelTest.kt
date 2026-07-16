package com.sapcework.memo.ui.screen.trash

import app.cash.turbine.test
import com.sapcework.memo.domain.model.Memo
import com.sapcework.memo.domain.repository.MemoRepository
import com.sapcework.memo.domain.usecase.DeleteMemoUseCase
import com.sapcework.memo.testutil.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify

/**
 * [TrashViewModel] のゴミ箱表示と、復元・完全削除の委譲を検証する。
 */
@OptIn(ExperimentalCoroutinesApi::class) // runCurrent
class TrashViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val trashFlow = MutableStateFlow<List<Memo>>(emptyList())
    private val memoRepository = mock<MemoRepository> {
        on { observeTrash() } doReturn trashFlow
    }
    private val deleteMemo = mock<DeleteMemoUseCase>()
    private val viewModel by lazy { TrashViewModel(memoRepository, deleteMemo) }

    @Test
    fun `購読前は読み込み中で空`() = runTest {
        assertEquals(TrashUiState(), viewModel.uiState.value)
        assertTrue(viewModel.uiState.value.isLoading)
    }

    @Test
    fun `ゴミ箱の中身を流し読み込み中を解除する`() = runTest {
        trashFlow.value = listOf(memo(ID, "捨てたメモ"))

        viewModel.uiState.test {
            assertTrue(awaitItem().isLoading) // stateInの初期値

            val loaded = awaitItem()
            assertEquals(listOf("捨てたメモ"), loaded.memos.map { it.title })
            assertEquals(false, loaded.isLoading)
        }
    }

    @Test
    fun `ゴミ箱が空でも読み込み完了を伝える`() = runTest {
        viewModel.uiState.test {
            assertTrue(awaitItem().isLoading)

            // 空の一覧と読み込み中が区別できること
            val loaded = awaitItem()
            assertTrue(loaded.memos.isEmpty())
            assertEquals(false, loaded.isLoading)
        }
    }

    @Test
    fun `保持日数はTrashPolicyの30日を出す`() = runTest {
        assertEquals(30L, viewModel.uiState.value.retentionDays)
    }

    @Test
    fun `onRestoreはリポジトリへ復元を委譲する`() = runTest {
        viewModel.onRestore(ID)
        runCurrent()

        verify(memoRepository).restore(ID)
    }

    @Test
    fun `onDeletePermanentlyはUseCaseへ委譲する`() = runTest {
        viewModel.onDeletePermanently(ID)
        runCurrent()

        // ゴミ箱内のメモに対して呼ぶため、UseCase側で完全削除になる
        verify(deleteMemo).invoke(ID)
    }

    @Test
    fun `onEmptyTrashはゴミ箱の全件を完全削除する`() = runTest {
        trashFlow.value = listOf(memo(ID, "1件目"), memo(OTHER_ID, "2件目"))

        viewModel.uiState.test {
            skipItems(2) // 初期値と読み込み後。stateInへ値が届いてから消す

            viewModel.onEmptyTrash()
            runCurrent()

            verify(memoRepository).deletePermanently(ID)
            verify(memoRepository).deletePermanently(OTHER_ID)
        }
    }

    private fun memo(id: Long, title: String) = Memo(
        id = id,
        title = title,
        content = "本文",
        createdAt = CREATED_AT,
        updatedAt = CREATED_AT,
        isPinned = false,
        isFavorite = false,
        deletedAt = DELETED_AT,
        tags = emptyList(),
    )

    private companion object {
        const val ID = 7L
        const val OTHER_ID = 8L
        const val CREATED_AT = 1_000L
        const val DELETED_AT = 2_000L
    }
}
