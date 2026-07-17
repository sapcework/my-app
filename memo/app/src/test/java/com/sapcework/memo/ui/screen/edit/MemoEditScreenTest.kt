package com.sapcework.memo.ui.screen.edit

import android.os.Looper
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.lifecycle.SavedStateHandle
import com.sapcework.memo.domain.model.Memo
import com.sapcework.memo.domain.model.Tag
import com.sapcework.memo.domain.model.TagSaveResult
import com.sapcework.memo.domain.repository.MemoRepository
import com.sapcework.memo.domain.repository.TagRepository
import com.sapcework.memo.domain.usecase.DeleteMemoUseCase
import com.sapcework.memo.domain.usecase.SaveMemoUseCase
import com.sapcework.memo.domain.usecase.SaveTagUseCase
import com.sapcework.memo.domain.usecase.SetMemoTagsUseCase
import com.sapcework.memo.testutil.FakeTimeProvider
import com.sapcework.memo.ui.theme.MemoTheme
import com.sapcework.memo.util.DateFormat
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.stub
import org.mockito.kotlin.verifyBlocking
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import java.time.Duration

/**
 * [MemoEditScreen] を検証する。
 *
 * 自動保存の結果（保存時刻・Undo可否）が画面へ現れるまでを通しで確かめる。
 * 削除の完了は状態で伝わり、遷移の判断は画面側が持つ設計もここで固定する。
 */
@RunWith(RobolectricTestRunner::class)
class MemoEditScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

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
    fun `新規作成は未保存で文字数0から始まる`() {
        setContent()

        composeTestRule.onNodeWithText("未保存").assertIsDisplayed()
        composeTestRule.onNodeWithText("0 文字").assertIsDisplayed()
    }

    @Test
    fun `新規作成はタイトルと本文のプレースホルダを出す`() {
        setContent()

        composeTestRule.onNodeWithText("タイトル").assertIsDisplayed()
        composeTestRule.onNodeWithText("本文").assertIsDisplayed()
    }

    @Test
    fun `既存メモの内容と保存時刻を表示する`() {
        stubExistingMemo()

        setContent(memoId = EXISTING_ID)

        composeTestRule.onNodeWithText("旧題").assertIsDisplayed()
        composeTestRule.onNodeWithText("旧文").assertIsDisplayed()
        composeTestRule.onNodeWithText("${DateFormat.format(UPDATED_AT)} に保存").assertIsDisplayed()
    }

    @Test
    fun `本文を入力すると文字数へ反映する`() {
        setContent()

        composeTestRule.onNodeWithText("本文").performTextInput("12345")

        composeTestRule.onNodeWithText("5 文字").assertIsDisplayed()
    }

    @Test
    fun `文字数はタイトルを数えない`() {
        setContent()

        composeTestRule.onNodeWithText("タイトル").performTextInput("長いタイトル")

        composeTestRule.onNodeWithText("0 文字").assertIsDisplayed()
    }

    @Test
    fun `編集前はUndoもRedoも押せない`() {
        setContent()

        composeTestRule.onNodeWithContentDescription("元に戻す").assertIsNotEnabled()
        composeTestRule.onNodeWithContentDescription("やり直す").assertIsNotEnabled()
    }

    @Test
    fun `自動保存が走るとUndoが押せるようになる`() {
        stubSaveResult(NEW_ID)
        setContent()

        composeTestRule.onNodeWithText("本文").performTextInput("牛乳")
        advancePastAutoSave()

        composeTestRule.onNodeWithContentDescription("元に戻す").assertIsEnabled()
    }

    @Test
    fun `自動保存が済むと保存時刻を表示する`() {
        stubSaveResult(NEW_ID)
        setContent()

        composeTestRule.onNodeWithText("本文").performTextInput("牛乳")
        advancePastAutoSave()

        composeTestRule.onNodeWithText("${DateFormat.format(SAVED_AT)} に保存").assertIsDisplayed()
        composeTestRule.onNodeWithText("未保存").assertDoesNotExist()
    }

    @Test
    fun `Undoを押すと直前の内容へ戻る`() {
        stubSaveResult(NEW_ID)
        setContent()
        composeTestRule.onNodeWithText("本文").performTextInput("牛乳")
        advancePastAutoSave()

        composeTestRule.onNodeWithContentDescription("元に戻す").performClick()

        composeTestRule.onNodeWithText("牛乳").assertDoesNotExist()
        composeTestRule.onNodeWithContentDescription("やり直す").assertIsEnabled()
    }

    @Test
    fun `削除すると画面を閉じるよう通知する`() {
        stubExistingMemo()
        var deleted = 0
        setContent(memoId = EXISTING_ID, onDeleted = { deleted++ })

        composeTestRule.onNodeWithContentDescription("削除").performClick()
        composeTestRule.waitForIdle()

        // 遷移の判断は画面側が持つため、ViewModelは状態で知らせるだけ
        assertEquals(1, deleted)
    }

    @Test
    fun `戻るを押すと通知する`() {
        var backs = 0
        setContent(onBack = { backs++ })

        composeTestRule.onNodeWithContentDescription("戻る").performClick()

        assertEquals(1, backs)
    }

    @Test
    fun `既存メモのピン留め状態を操作に反映する`() {
        stubExistingMemo(isPinned = true)

        setContent(memoId = EXISTING_ID)

        // ピン留め済みなら次の操作は解除になる
        composeTestRule.onNodeWithContentDescription("ピン留めを解除").assertIsDisplayed()
    }

    @Test
    fun `タグが1件も無くても追加の導線を出す`() {
        setContent()

        // ここが唯一の入口になる利用者がいるため、行ごと消してはいけない
        composeTestRule.onNodeWithText("タグを追加").assertIsDisplayed()
    }

    @Test
    fun `タグを追加すると名前で作成しメモへ付ける`() {
        stubSaveResult(NEW_ID)
        stubTagSaveResult(TagSaveResult.Success(TAG_ID))
        memoRepository.stub { on { findById(NEW_ID) } doReturn memoWithTag() }
        setContent()

        composeTestRule.onNodeWithText("タグを追加").performClick()
        composeTestRule.onNodeWithText("タグ名").performTextInput("仕事")
        composeTestRule.onNodeWithText("保存").performClick()
        composeTestRule.waitForIdle()

        verifyBlocking(setMemoTags) { invoke(NEW_ID, listOf("仕事")) }
    }

    @Test
    fun `タグ追加が通るとダイアログを閉じる`() {
        stubSaveResult(NEW_ID)
        stubTagSaveResult(TagSaveResult.Success(TAG_ID))
        memoRepository.stub { on { findById(NEW_ID) } doReturn memoWithTag() }
        setContent()
        composeTestRule.onNodeWithText("タグを追加").performClick()

        composeTestRule.onNodeWithText("タグ名").performTextInput("仕事")
        composeTestRule.onNodeWithText("保存").performClick()
        composeTestRule.waitForIdle()

        composeTestRule.onNodeWithText("保存").assertDoesNotExist()
    }

    @Test
    fun `長すぎるタグ名はタグ画面と同じ文言で弾く`() {
        stubTagSaveResult(TagSaveResult.TooLong)
        setContent()
        composeTestRule.onNodeWithText("タグを追加").performClick()

        composeTestRule.onNodeWithText("タグ名").performTextInput("あ".repeat(60))
        composeTestRule.onNodeWithText("保存").performClick()
        composeTestRule.waitForIdle()

        // 検証はSaveTagUseCaseへ集約したため、タグ画面と食い違わない
        composeTestRule.onNodeWithText("タグ名は 50 文字以内で入力してください").assertIsDisplayed()
        verifyBlocking(setMemoTags, never()) { invoke(any(), any()) }
    }

    @Test
    fun `弾かれた間はダイアログを開いたままにする`() {
        stubTagSaveResult(TagSaveResult.BlankName)
        setContent()
        composeTestRule.onNodeWithText("タグを追加").performClick()

        composeTestRule.onNodeWithText("保存").performClick()
        composeTestRule.waitForIdle()

        // 閉じてしまうと入力をやり直せない
        composeTestRule.onNodeWithText("タグ名を入力してください").assertIsDisplayed()
        composeTestRule.onNodeWithText("保存").assertIsDisplayed()
    }

    private fun stubTagSaveResult(result: TagSaveResult) {
        saveTag.stub { on { invoke(anyOrNull(), any()) } doReturn result }
    }

    private fun memoWithTag() = Memo(
        id = NEW_ID,
        title = "",
        content = "",
        createdAt = CREATED_AT,
        updatedAt = UPDATED_AT,
        isPinned = false,
        isFavorite = false,
        deletedAt = null,
        tags = listOf(Tag(id = TAG_ID, name = "仕事", createdAt = CREATED_AT)),
    )

    private fun stubExistingMemo(isPinned: Boolean = false) {
        memoRepository.stub {
            on { findById(EXISTING_ID) } doReturn Memo(
                id = EXISTING_ID,
                title = "旧題",
                content = "旧文",
                createdAt = CREATED_AT,
                updatedAt = UPDATED_AT,
                isPinned = isPinned,
                isFavorite = false,
                deletedAt = null,
                tags = emptyList(),
            )
        }
    }

    private fun stubSaveResult(id: Long) {
        saveMemo.stub { on { invoke(anyOrNull(), any(), any()) } doReturn id }
    }

    /**
     * 自動保存のデバウンスを跨がせる。
     * Dispatchers.Mainを差し替えていないため、viewModelScopeのdelayはメインLooperへ積まれる。
     */
    private fun advancePastAutoSave() {
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(AUTO_SAVE_DEBOUNCE_MS + 1))
        composeTestRule.waitForIdle()
    }

    private fun setContent(memoId: Long? = null, onBack: () -> Unit = {}, onDeleted: () -> Unit = {}) {
        val savedStateHandle = memoId
            ?.let { SavedStateHandle(mapOf(MemoEditViewModel.ARG_MEMO_ID to it)) }
            ?: SavedStateHandle()
        val viewModel = MemoEditViewModel(
            memoRepository = memoRepository,
            tagRepository = tagRepository,
            saveMemo = saveMemo,
            setMemoTags = setMemoTags,
            saveTag = saveTag,
            deleteMemo = deleteMemo,
            timeProvider = time,
            savedStateHandle = savedStateHandle,
        )
        composeTestRule.setContent {
            MemoTheme {
                MemoEditScreen(onBack = onBack, onDeleted = onDeleted, viewModel = viewModel)
            }
        }
    }

    private companion object {
        const val EXISTING_ID = 7L
        const val NEW_ID = 42L
        const val TAG_ID = 1L
        const val CREATED_AT = 1_600_000_000_000L
        const val UPDATED_AT = 1_600_000_000_000L
        const val SAVED_AT = 1_600_000_060_000L // UPDATED_ATより後。保存で時刻が変わることを見る
        const val AUTO_SAVE_DEBOUNCE_MS = 500L // ViewModelが持つ自動保存デバウンスと同じ値
    }
}
