package com.sapcework.memo.ui.screen.edit

import androidx.lifecycle.SavedStateHandle
import com.sapcework.memo.domain.model.Memo
import com.sapcework.memo.domain.model.Tag
import com.sapcework.memo.domain.repository.MemoRepository
import com.sapcework.memo.domain.repository.TagRepository
import com.sapcework.memo.domain.usecase.DeleteMemoUseCase
import com.sapcework.memo.domain.usecase.SaveMemoUseCase
import com.sapcework.memo.domain.usecase.SaveTagUseCase
import com.sapcework.memo.domain.usecase.SetMemoTagsUseCase
import com.sapcework.memo.testutil.FakeTimeProvider
import com.sapcework.memo.testutil.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
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
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

/**
 * [MemoEditViewModel] の自動保存とUndo/Redoを検証する。
 *
 * 「開いただけで更新日時が変わる」「新規のはずが二重に作成される」は
 * この画面で最も起こりやすい実害のため、境界を仮想時間で明示的に固定する。
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MemoEditViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val tagsFlow = MutableStateFlow<List<Tag>>(emptyList())
    private val memoRepository = mock<MemoRepository>()
    private val tagRepository = mock<TagRepository> {
        on { observeAll() } doReturn tagsFlow
    }
    private val saveMemo = mock<SaveMemoUseCase>()
    private val setMemoTags = mock<SetMemoTagsUseCase>()
    private val saveTag = mock<SaveTagUseCase>()
    private val deleteMemo = mock<DeleteMemoUseCase>()
    private val time = FakeTimeProvider(now = SAVED_AT)

    @Test
    fun `新規作成なら読み込み中を解除して空で始まる`() = runTest {
        val viewModel = newMemoViewModel()
        runCurrent()

        val state = viewModel.uiState.value
        assertEquals("", state.title)
        assertEquals("", state.content)
        assertEquals(false, state.isLoading)
        assertNull(state.savedAt)
    }

    @Test
    fun `既存メモを読み込んで画面へ反映する`() = runTest {
        whenever(memoRepository.findById(EXISTING_ID)).thenReturn(existingMemo())

        val viewModel = existingMemoViewModel()
        runCurrent()

        val state = viewModel.uiState.value
        assertEquals("旧題", state.title)
        assertEquals("旧文", state.content)
        assertEquals(true, state.isPinned)
        assertEquals(listOf("仕事"), state.tags.map { it.name })
        assertEquals(UPDATED_AT, state.savedAt)
        assertEquals(false, state.isLoading)
    }

    @Test
    fun `存在しないメモを開いても落ちず空の新規として扱う`() = runTest {
        whenever(memoRepository.findById(EXISTING_ID)).thenReturn(null)

        val viewModel = existingMemoViewModel()
        runCurrent()

        assertEquals("", viewModel.uiState.value.title)
        assertEquals(false, viewModel.uiState.value.isLoading)
    }

    @Test
    fun `開いただけでは自動保存しない`() = runTest {
        whenever(memoRepository.findById(EXISTING_ID)).thenReturn(existingMemo())

        existingMemoViewModel()
        advanceTimeBy(AUTO_SAVE_DEBOUNCE_MS * 2)

        // 開いただけで更新日時が変わらないこと
        verify(saveMemo, never()).invoke(anyOrNull(), any(), any())
    }

    @Test
    fun `入力はデバウンス経過後に自動保存される`() = runTest {
        whenever(saveMemo(anyOrNull(), any(), any())).thenReturn(NEW_ID)
        val viewModel = newMemoViewModel()
        runCurrent()

        viewModel.onContentChange("牛乳")
        advancePastAutoSave()

        verify(saveMemo).invoke(null, "", "牛乳")
    }

    @Test
    fun `デバウンス経過前は保存しない`() = runTest {
        whenever(saveMemo(anyOrNull(), any(), any())).thenReturn(NEW_ID)
        val viewModel = newMemoViewModel()
        runCurrent()

        viewModel.onContentChange("牛")
        advanceTimeBy(AUTO_SAVE_DEBOUNCE_MS - 1)

        // 打鍵ごとに書き込まないこと
        verify(saveMemo, never()).invoke(anyOrNull(), any(), any())
    }

    @Test
    fun `初回保存でIDが確定し二度目以降は更新になる`() = runTest {
        whenever(saveMemo(anyOrNull(), any(), any())).thenReturn(NEW_ID)
        val viewModel = newMemoViewModel()
        runCurrent()

        viewModel.onContentChange("牛乳")
        advancePastAutoSave()
        viewModel.onContentChange("牛乳とパン")
        advancePastAutoSave()

        verify(saveMemo).invoke(null, "", "牛乳") // 1回目は新規
        verify(saveMemo).invoke(NEW_ID, "", "牛乳とパン") // 2回目は確定したIDで更新
    }

    @Test
    fun `保存すると保存時刻を現在時刻へ更新する`() = runTest {
        whenever(saveMemo(anyOrNull(), any(), any())).thenReturn(NEW_ID)
        val viewModel = newMemoViewModel()
        runCurrent()

        viewModel.onContentChange("牛乳")
        advancePastAutoSave()

        assertEquals(SAVED_AT, viewModel.uiState.value.savedAt)
    }

    @Test
    fun `保存に失敗しても入力内容は画面に残る`() = runTest {
        whenever(saveMemo(anyOrNull(), any(), any())).thenThrow(RuntimeException("保存に失敗"))
        val viewModel = newMemoViewModel()
        runCurrent()

        viewModel.onContentChange("牛乳")
        advancePastAutoSave()

        assertEquals("牛乳", viewModel.uiState.value.content)
        assertNull(viewModel.uiState.value.savedAt) // 保存できていないので時刻は出さない
    }

    @Test
    fun `Undoで直前の内容へ戻る`() = runTest {
        whenever(saveMemo(anyOrNull(), any(), any())).thenReturn(NEW_ID)
        val viewModel = newMemoViewModel()
        runCurrent()
        viewModel.onContentChange("牛乳")
        advancePastAutoSave()
        viewModel.onContentChange("牛乳とパン")
        advancePastAutoSave()

        viewModel.onUndo()

        assertEquals("牛乳", viewModel.uiState.value.content)
        assertEquals(true, viewModel.uiState.value.canRedo)
    }

    @Test
    fun `Redoで取り消した内容へ進む`() = runTest {
        whenever(saveMemo(anyOrNull(), any(), any())).thenReturn(NEW_ID)
        val viewModel = newMemoViewModel()
        runCurrent()
        viewModel.onContentChange("牛乳")
        advancePastAutoSave()
        viewModel.onContentChange("牛乳とパン")
        advancePastAutoSave()
        viewModel.onUndo()

        viewModel.onRedo()

        assertEquals("牛乳とパン", viewModel.uiState.value.content)
    }

    @Test
    fun `Undo直後の自動保存はRedoを失わせない`() = runTest {
        whenever(saveMemo(anyOrNull(), any(), any())).thenReturn(NEW_ID)
        val viewModel = newMemoViewModel()
        runCurrent()
        viewModel.onContentChange("牛乳")
        advancePastAutoSave()
        viewModel.onContentChange("牛乳とパン")
        advancePastAutoSave()

        viewModel.onUndo()
        advancePastAutoSave() // Undoの結果が履歴へ積み直されないこと

        assertEquals(true, viewModel.uiState.value.canRedo)
    }

    @Test
    fun `編集していなければUndoできない`() = runTest {
        val viewModel = newMemoViewModel()
        runCurrent()

        assertEquals(false, viewModel.uiState.value.canUndo)
        assertEquals(false, viewModel.uiState.value.canRedo)
    }

    @Test
    fun `タグ一覧の変更を購読する`() = runTest {
        val viewModel = newMemoViewModel()
        runCurrent()

        tagsFlow.value = listOf(tag(TAG_ID, "仕事"))
        runCurrent()

        assertEquals(listOf("仕事"), viewModel.uiState.value.allTags.map { it.name })
    }

    @Test
    fun `onDeleteは未保存ならUseCaseを呼ばずに閉じる`() = runTest {
        val viewModel = newMemoViewModel()
        runCurrent()

        viewModel.onDelete()
        runCurrent()

        assertTrue(viewModel.isDeleted.value)
        verify(deleteMemo, never()).invoke(any())
    }

    @Test
    fun `onDeleteは保存済みならUseCaseへ委譲して閉じる`() = runTest {
        whenever(memoRepository.findById(EXISTING_ID)).thenReturn(existingMemo())
        val viewModel = existingMemoViewModel()
        runCurrent()

        viewModel.onDelete()
        runCurrent()

        verify(deleteMemo).invoke(EXISTING_ID)
        assertTrue(viewModel.isDeleted.value)
    }

    @Test
    fun `onDeleteは失敗しても画面を閉じられる`() = runTest {
        whenever(memoRepository.findById(EXISTING_ID)).thenReturn(existingMemo())
        whenever(deleteMemo(EXISTING_ID)).thenThrow(RuntimeException("削除に失敗"))
        val viewModel = existingMemoViewModel()
        runCurrent()

        viewModel.onDelete()
        runCurrent()

        assertTrue(viewModel.isDeleted.value)
    }

    @Test
    fun `onPinnedChangeは未保存なら何もしない`() = runTest {
        val viewModel = newMemoViewModel()
        runCurrent()

        viewModel.onPinnedChange(true)
        runCurrent()

        verify(memoRepository, never()).setPinned(any(), any())
        assertEquals(false, viewModel.uiState.value.isPinned)
    }

    @Test
    fun `onPinnedChangeは保存済みならリポジトリへ委譲する`() = runTest {
        whenever(memoRepository.findById(EXISTING_ID)).thenReturn(existingMemo(isPinned = false))
        val viewModel = existingMemoViewModel()
        runCurrent()

        viewModel.onPinnedChange(true)
        runCurrent()

        verify(memoRepository).setPinned(EXISTING_ID, true)
        assertEquals(true, viewModel.uiState.value.isPinned)
    }

    @Test
    fun `onTagsChangeは未保存でも先に保存してからタグを付ける`() = runTest {
        whenever(saveMemo(anyOrNull(), any(), any())).thenReturn(NEW_ID)
        whenever(memoRepository.findById(NEW_ID)).thenReturn(existingMemo(id = NEW_ID))
        val viewModel = newMemoViewModel()
        runCurrent()
        viewModel.onTitleChange("買い物")

        viewModel.onTagsChange(listOf("仕事"))
        runCurrent()

        // タグ付けにはIDが要るため、先に保存してIDを確定させること
        verify(saveMemo).invoke(null, "買い物", "")
        verify(setMemoTags).invoke(NEW_ID, listOf("仕事"))
    }

    @Test
    fun `文字数は本文のみを数える`() = runTest {
        val viewModel = newMemoViewModel()
        runCurrent()

        viewModel.onTitleChange("タイトル")
        viewModel.onContentChange("12345")

        assertEquals(5, viewModel.uiState.value.characterCount)
    }

    /**
     * 自動保存のデバウンスを跨がせる。
     * advanceTimeByは「現在時刻＋指定時間」ちょうどに積まれたタスクを実行しないため、1ms余分に進める。
     */
    private fun TestScope.advancePastAutoSave() = advanceTimeBy(AUTO_SAVE_DEBOUNCE_MS + 1)

    private fun newMemoViewModel() = createViewModel(SavedStateHandle())

    private fun existingMemoViewModel() = createViewModel(
        SavedStateHandle(mapOf(MemoEditViewModel.ARG_MEMO_ID to EXISTING_ID)),
    )

    private fun createViewModel(savedStateHandle: SavedStateHandle) = MemoEditViewModel(
        memoRepository = memoRepository,
        tagRepository = tagRepository,
        saveMemo = saveMemo,
        setMemoTags = setMemoTags,
        saveTag = saveTag,
        deleteMemo = deleteMemo,
        timeProvider = time,
        savedStateHandle = savedStateHandle,
    )

    private fun existingMemo(id: Long = EXISTING_ID, isPinned: Boolean = true) = Memo(
        id = id,
        title = "旧題",
        content = "旧文",
        createdAt = CREATED_AT,
        updatedAt = UPDATED_AT,
        isPinned = isPinned,
        isFavorite = false,
        deletedAt = null,
        tags = listOf(tag(TAG_ID, "仕事")),
    )

    private fun tag(id: Long, name: String) = Tag(id = id, name = name, createdAt = CREATED_AT)

    private companion object {
        const val EXISTING_ID = 7L
        const val NEW_ID = 42L
        const val TAG_ID = 1L
        const val CREATED_AT = 1_000L
        const val UPDATED_AT = 2_000L
        const val SAVED_AT = 3_000L

        /** ViewModelが持つ自動保存デバウンスと同じ値。 */
        const val AUTO_SAVE_DEBOUNCE_MS = 500L
    }
}
