package com.sapcework.memo.ui.screen.trash

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.sapcework.memo.domain.model.Memo
import com.sapcework.memo.domain.repository.MemoRepository
import com.sapcework.memo.domain.usecase.DeleteMemoUseCase
import com.sapcework.memo.testutil.testMemo
import com.sapcework.memo.ui.theme.MemoTheme
import kotlinx.coroutines.flow.MutableSharedFlow
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verifyBlocking
import org.robolectric.RobolectricTestRunner

/**
 * [TrashScreen] を検証する。
 *
 * 完全削除とゴミ箱を空にする操作は取り消せない。確認を挟まずに実行されないことが
 * この画面で最も守るべき性質のため、確認の前後を分けて固定する。
 */
@RunWith(RobolectricTestRunner::class)
class TrashScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    /** 値を持たない状態から始め、読み込み中を再現できるようにする。 */
    private val trashFlow = MutableSharedFlow<List<Memo>>(replay = 1)
    private val memoRepository = mock<MemoRepository> {
        on { observeTrash() } doReturn trashFlow
    }
    private val deleteMemo = mock<DeleteMemoUseCase>()

    @Test
    fun `保持期間を案内する`() {
        trashFlow.tryEmit(emptyList())

        setContent()

        composeTestRule.onNodeWithText("ゴミ箱のメモは 30 日後に完全に削除されます").assertIsDisplayed()
    }

    @Test
    fun `読み込み中は空の案内を出さない`() {
        setContent() // ゴミ箱の中身を流さないまま描画する

        composeTestRule.onNodeWithText("ゴミ箱は空です").assertDoesNotExist()
    }

    @Test
    fun `ゴミ箱が空ならその旨を伝える`() {
        trashFlow.tryEmit(emptyList())

        setContent()

        composeTestRule.onNodeWithText("ゴミ箱は空です").assertIsDisplayed()
    }

    @Test
    fun `空のときは ゴミ箱を空にする を出さない`() {
        trashFlow.tryEmit(emptyList())

        setContent()

        composeTestRule.onNodeWithText("ゴミ箱を空にする").assertDoesNotExist()
    }

    @Test
    fun `ゴミ箱の中身を一覧に表示する`() {
        trashFlow.tryEmit(listOf(memo(ID, "捨てたメモ")))

        setContent()

        composeTestRule.onNodeWithText("捨てたメモ").assertIsDisplayed()
        composeTestRule.onNodeWithText("ゴミ箱は空です").assertDoesNotExist()
    }

    @Test
    fun `タイトルが空なら本文の先頭行で表示する`() {
        trashFlow.tryEmit(listOf(memo(ID, "", content = "牛乳を買う")))

        setContent()

        composeTestRule.onNodeWithText("牛乳を買う").assertIsDisplayed()
    }

    @Test
    fun `復元は確認なしで実行する`() {
        trashFlow.tryEmit(listOf(memo(ID, "捨てたメモ")))
        setContent()

        composeTestRule.onNodeWithContentDescription("復元").performClick()

        // 取り消せる操作のため確認は挟まない
        verifyBlocking(memoRepository) { restore(ID) }
    }

    @Test
    fun `完全削除は確認を挟み 確認前は実行しない`() {
        trashFlow.tryEmit(listOf(memo(ID, "捨てたメモ")))
        setContent()

        composeTestRule.onNodeWithContentDescription("完全に削除").performClick()

        composeTestRule.onNodeWithText("完全に削除しますか").assertIsDisplayed()
        composeTestRule.onNodeWithText("この操作は取り消せません。").assertIsDisplayed()
        verifyBlocking(deleteMemo, never()) { invoke(any()) }
    }

    @Test
    fun `完全削除をキャンセルすると実行しない`() {
        trashFlow.tryEmit(listOf(memo(ID, "捨てたメモ")))
        setContent()
        composeTestRule.onNodeWithContentDescription("完全に削除").performClick()

        composeTestRule.onNodeWithText("キャンセル").performClick()

        verifyBlocking(deleteMemo, never()) { invoke(any()) }
        composeTestRule.onNodeWithText("完全に削除しますか").assertDoesNotExist()
    }

    @Test
    fun `完全削除を承認すると実行する`() {
        trashFlow.tryEmit(listOf(memo(ID, "捨てたメモ")))
        setContent()
        composeTestRule.onNodeWithContentDescription("完全に削除").performClick()

        composeTestRule.onNodeWithText("削除").performClick()

        verifyBlocking(deleteMemo) { invoke(ID) }
        composeTestRule.onNodeWithText("完全に削除しますか").assertDoesNotExist()
    }

    @Test
    fun `ゴミ箱を空にするは確認を挟み 確認前は実行しない`() {
        trashFlow.tryEmit(listOf(memo(ID, "捨てたメモ")))
        setContent()

        composeTestRule.onNodeWithText("ゴミ箱を空にする").performClick()

        composeTestRule.onNodeWithText("ゴミ箱を空にしますか").assertIsDisplayed()
        verifyBlocking(memoRepository, never()) { deletePermanently(any()) }
    }

    @Test
    fun `ゴミ箱を空にするを承認すると全件を消す`() {
        trashFlow.tryEmit(listOf(memo(ID, "1件目"), memo(OTHER_ID, "2件目")))
        setContent()
        composeTestRule.onNodeWithText("ゴミ箱を空にする").performClick()

        composeTestRule.onNodeWithText("削除").performClick()

        verifyBlocking(memoRepository) { deletePermanently(ID) }
        verifyBlocking(memoRepository) { deletePermanently(OTHER_ID) }
    }

    @Test
    fun `ゴミ箱を空にするをキャンセルすると実行しない`() {
        trashFlow.tryEmit(listOf(memo(ID, "捨てたメモ")))
        setContent()
        composeTestRule.onNodeWithText("ゴミ箱を空にする").performClick()

        composeTestRule.onNodeWithText("キャンセル").performClick()

        verifyBlocking(memoRepository, never()) { deletePermanently(any()) }
    }

    private fun setContent(onBack: () -> Unit = {}) {
        val viewModel = TrashViewModel(memoRepository, deleteMemo)
        composeTestRule.setContent {
            MemoTheme {
                TrashScreen(onBack = onBack, viewModel = viewModel)
            }
        }
    }

    /** ゴミ箱の中身のため、必ず削除済みで作る。 */
    private fun memo(id: Long, title: String, content: String = "本文") =
        testMemo(id = id, title = title, content = content, deletedAt = DELETED_AT)

    private companion object {
        const val ID = 7L
        const val OTHER_ID = 8L
        const val DELETED_AT = 1_600_000_000_000L
    }
}
