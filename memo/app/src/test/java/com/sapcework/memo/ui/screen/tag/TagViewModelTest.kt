package com.sapcework.memo.ui.screen.tag

import app.cash.turbine.test
import com.sapcework.memo.domain.model.Tag
import com.sapcework.memo.domain.model.TagSaveResult
import com.sapcework.memo.domain.repository.TagRepository
import com.sapcework.memo.domain.usecase.SaveTagUseCase
import com.sapcework.memo.testutil.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

/**
 * [TagViewModel] のタグ一覧表示と、検証エラーのUI向け変換を検証する。
 */
@OptIn(ExperimentalCoroutinesApi::class) // runCurrent
class TagViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val tagsFlow = MutableStateFlow<List<Tag>>(emptyList())
    private val tagRepository = mock<TagRepository> {
        on { observeAll() } doReturn tagsFlow
    }
    private val saveTag = mock<SaveTagUseCase>()
    private val viewModel by lazy { TagViewModel(tagRepository, saveTag) }

    @Test
    fun `購読前は読み込み中で空`() = runTest {
        assertEquals(TagListUiState(), viewModel.uiState.value)
        assertTrue(viewModel.uiState.value.isLoading)
    }

    @Test
    fun `タグ一覧を流し読み込み中を解除する`() = runTest {
        tagsFlow.value = listOf(tag(ID, "仕事"))

        viewModel.uiState.test {
            assertTrue(awaitItem().isLoading) // stateInの初期値

            val loaded = awaitItem()
            assertEquals(listOf("仕事"), loaded.tags.map { it.name })
            assertEquals(false, loaded.isLoading)
        }
    }

    @Test
    fun `タグの追加を追従して流す`() = runTest {
        viewModel.uiState.test {
            skipItems(2) // 初期値と空の読み込み完了

            tagsFlow.value = listOf(tag(ID, "仕事"))

            assertEquals(listOf("仕事"), awaitItem().tags.map { it.name })
        }
    }

    @Test
    fun `初期状態では入力エラーを持たない`() = runTest {
        assertNull(viewModel.inputError.value)
    }

    @Test
    fun `保存に成功すればエラーを出さない`() = runTest {
        whenever(saveTag(anyOrNull(), any())).thenReturn(TagSaveResult.Success(ID))

        viewModel.onSave(id = null, name = "仕事")
        runCurrent()

        assertNull(viewModel.inputError.value)
        verify(saveTag).invoke(null, "仕事")
    }

    @Test
    fun `空の名前はBLANKエラーとして通知する`() = runTest {
        whenever(saveTag(anyOrNull(), any())).thenReturn(TagSaveResult.BlankName)

        viewModel.onSave(id = null, name = "")
        runCurrent()

        assertEquals(TagInputError.BLANK, viewModel.inputError.value)
    }

    @Test
    fun `長すぎる名前はTOO_LONGエラーとして通知する`() = runTest {
        whenever(saveTag(anyOrNull(), any())).thenReturn(TagSaveResult.TooLong)

        viewModel.onSave(id = null, name = "あ".repeat(100))
        runCurrent()

        assertEquals(TagInputError.TOO_LONG, viewModel.inputError.value)
    }

    @Test
    fun `保存に成功すると直前のエラーは消える`() = runTest {
        whenever(saveTag(anyOrNull(), any())).thenReturn(TagSaveResult.BlankName)
        viewModel.onSave(id = null, name = "")
        runCurrent()
        assertEquals(TagInputError.BLANK, viewModel.inputError.value)

        whenever(saveTag(anyOrNull(), any())).thenReturn(TagSaveResult.Success(ID))
        viewModel.onSave(id = null, name = "仕事")
        runCurrent()

        assertNull(viewModel.inputError.value)
    }

    @Test
    fun `onErrorShownでエラーを消す`() = runTest {
        whenever(saveTag(anyOrNull(), any())).thenReturn(TagSaveResult.BlankName)
        viewModel.onSave(id = null, name = "")
        runCurrent()

        viewModel.onErrorShown()

        assertNull(viewModel.inputError.value)
    }

    @Test
    fun `既存idを渡した保存はそのままUseCaseへ委譲する`() = runTest {
        whenever(saveTag(anyOrNull(), any())).thenReturn(TagSaveResult.Success(ID))

        viewModel.onSave(id = ID, name = "業務")
        runCurrent()

        verify(saveTag).invoke(ID, "業務")
    }

    @Test
    fun `onDeleteはリポジトリへ削除を委譲する`() = runTest {
        viewModel.onDelete(ID)
        runCurrent()

        verify(tagRepository).delete(ID)
    }

    private fun tag(id: Long, name: String) = Tag(id = id, name = name, createdAt = CREATED_AT)

    private companion object {
        const val ID = 7L
        const val CREATED_AT = 1_000L
    }
}
