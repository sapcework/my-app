package com.sapcework.memo.ui.screen.tag

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import com.sapcework.memo.domain.model.Tag
import com.sapcework.memo.domain.model.TagSaveResult
import com.sapcework.memo.domain.repository.TagRepository
import com.sapcework.memo.domain.usecase.SaveTagUseCase
import com.sapcework.memo.ui.theme.MemoTheme
import kotlinx.coroutines.flow.MutableSharedFlow
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

/**
 * [TagScreen] を検証する。
 *
 * タグ削除はメモから外れる副作用を伴うため確認を挟む。
 * 検証エラーはダイアログを閉じずに提示し、入力をやり直せることも確かめる。
 */
@RunWith(RobolectricTestRunner::class)
class TagScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    /** 値を持たない状態から始め、読み込み中を再現できるようにする。 */
    private val tagsFlow = MutableSharedFlow<List<Tag>>(replay = 1)
    private val tagRepository = mock<TagRepository> {
        on { observeAll() } doReturn tagsFlow
    }
    private val saveTag = mock<SaveTagUseCase>()

    @Test
    fun `読み込み中は空の案内を出さない`() {
        setContent() // タグを流さないまま描画する

        composeTestRule.onNodeWithText("タグがありません").assertDoesNotExist()
    }

    @Test
    fun `タグが無ければその旨を伝える`() {
        tagsFlow.tryEmit(emptyList())

        setContent()

        composeTestRule.onNodeWithText("タグがありません").assertIsDisplayed()
    }

    @Test
    fun `タグ一覧を表示する`() {
        tagsFlow.tryEmit(listOf(tag(ID, "仕事"), tag(OTHER_ID, "私用")))

        setContent()

        composeTestRule.onNodeWithText("仕事").assertIsDisplayed()
        composeTestRule.onNodeWithText("私用").assertIsDisplayed()
    }

    @Test
    fun `作成ボタンで空の作成ダイアログを開く`() {
        tagsFlow.tryEmit(emptyList())
        setContent()

        composeTestRule.onNodeWithContentDescription("タグを作成").performClick()

        composeTestRule.onNodeWithText("タグ名").assertIsDisplayed() // プレースホルダ＝空で始まる
    }

    @Test
    fun `新しいタグを入力して保存できる`() {
        tagsFlow.tryEmit(emptyList())
        stubSaveResult(TagSaveResult.Success(ID))
        setContent()
        composeTestRule.onNodeWithContentDescription("タグを作成").performClick()

        composeTestRule.onNodeWithText("タグ名").performTextInput("仕事")
        composeTestRule.onNodeWithText("保存").performClick()

        verifyBlocking(saveTag) { invoke(null, "仕事") }
    }

    @Test
    fun `保存に成功するとダイアログを閉じる`() {
        tagsFlow.tryEmit(emptyList())
        stubSaveResult(TagSaveResult.Success(ID))
        setContent()
        composeTestRule.onNodeWithContentDescription("タグを作成").performClick()

        composeTestRule.onNode(hasSetTextAction()).performTextInput("仕事")
        composeTestRule.onNodeWithText("保存").performClick()

        composeTestRule.onNodeWithText("保存").assertDoesNotExist()
    }

    @Test
    fun `編集ボタンは既存の名前を入れたダイアログを開く`() {
        tagsFlow.tryEmit(listOf(tag(ID, "仕事")))
        setContent()

        composeTestRule.onNodeWithText("タグ名を変更").assertDoesNotExist()
        composeTestRule.onNodeWithContentDescription("タグ名を変更").performClick()

        composeTestRule.onNodeWithText("タグ名を変更").assertIsDisplayed()
    }

    @Test
    fun `改名は既存のidを渡して保存する`() {
        tagsFlow.tryEmit(listOf(tag(ID, "仕事")))
        stubSaveResult(TagSaveResult.Success(ID))
        setContent()
        composeTestRule.onNodeWithContentDescription("タグ名を変更").performClick()

        // 背後の一覧にも同名のタグが居るため、入力欄そのものを指す
        composeTestRule.onNode(hasSetTextAction()).performTextReplacement("業務")
        composeTestRule.onNodeWithText("保存").performClick()

        verifyBlocking(saveTag) { invoke(ID, "業務") }
    }

    @Test
    fun `空の名前で保存するとエラーを提示する`() {
        tagsFlow.tryEmit(emptyList())
        stubSaveResult(TagSaveResult.BlankName)
        setContent()
        composeTestRule.onNodeWithContentDescription("タグを作成").performClick()

        composeTestRule.onNodeWithText("保存").performClick()

        // ダイアログは閉じず、入力をやり直せること
        composeTestRule.onNodeWithText("タグ名を入力してください").assertIsDisplayed()
        composeTestRule.onNodeWithText("保存").assertIsDisplayed()
    }

    @Test
    fun `長すぎる名前は上限を添えてエラーを提示する`() {
        tagsFlow.tryEmit(emptyList())
        stubSaveResult(TagSaveResult.TooLong)
        setContent()
        composeTestRule.onNodeWithContentDescription("タグを作成").performClick()

        composeTestRule.onNodeWithText("タグ名").performTextInput("あ".repeat(60))
        composeTestRule.onNodeWithText("保存").performClick()

        composeTestRule.onNodeWithText("タグ名は 50 文字以内で入力してください").assertIsDisplayed()
    }

    @Test
    fun `作成をキャンセルすると保存しない`() {
        tagsFlow.tryEmit(emptyList())
        setContent()
        composeTestRule.onNodeWithContentDescription("タグを作成").performClick()

        composeTestRule.onNodeWithText("キャンセル").performClick()

        verifyBlocking(saveTag, never()) { invoke(anyOrNull(), any()) }
        composeTestRule.onNodeWithText("タグ名").assertDoesNotExist()
    }

    @Test
    fun `削除は確認を挟み 確認前は実行しない`() {
        tagsFlow.tryEmit(listOf(tag(ID, "仕事")))
        setContent()

        composeTestRule.onNodeWithContentDescription("タグを削除").performClick()

        composeTestRule.onNodeWithText("タグを削除しますか").assertIsDisplayed()
        // メモ自体は消えないことを利用者へ伝える
        composeTestRule
            .onNodeWithText("メモからこのタグが外れます。メモ自体は削除されません。")
            .assertIsDisplayed()
        verifyBlocking(tagRepository, never()) { delete(any()) }
    }

    @Test
    fun `削除を承認すると実行する`() {
        tagsFlow.tryEmit(listOf(tag(ID, "仕事")))
        setContent()
        composeTestRule.onNodeWithContentDescription("タグを削除").performClick()

        composeTestRule.onNodeWithText("削除").performClick()

        verifyBlocking(tagRepository) { delete(ID) }
    }

    @Test
    fun `削除をキャンセルすると実行しない`() {
        tagsFlow.tryEmit(listOf(tag(ID, "仕事")))
        setContent()
        composeTestRule.onNodeWithContentDescription("タグを削除").performClick()

        composeTestRule.onNodeWithText("キャンセル").performClick()

        verifyBlocking(tagRepository, never()) { delete(any()) }
        composeTestRule.onNodeWithText("タグを削除しますか").assertDoesNotExist()
    }

    private fun stubSaveResult(result: TagSaveResult) {
        saveTag.stub { on { invoke(anyOrNull(), any()) } doReturn result }
    }

    private fun setContent(onBack: () -> Unit = {}) {
        val viewModel = TagViewModel(tagRepository, saveTag)
        composeTestRule.setContent {
            MemoTheme {
                TagScreen(onBack = onBack, viewModel = viewModel)
            }
        }
    }

    private fun tag(id: Long, name: String) = Tag(id = id, name = name, createdAt = CREATED_AT)

    private companion object {
        const val ID = 7L
        const val OTHER_ID = 8L
        const val CREATED_AT = 1_600_000_000_000L
    }
}
