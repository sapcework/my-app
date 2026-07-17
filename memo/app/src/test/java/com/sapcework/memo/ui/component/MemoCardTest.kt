package com.sapcework.memo.ui.component

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.sapcework.memo.domain.model.Memo
import com.sapcework.memo.domain.model.Tag
import com.sapcework.memo.testutil.TEST_TIME
import com.sapcework.memo.testutil.testMemo
import com.sapcework.memo.testutil.testTag
import com.sapcework.memo.util.DateFormat
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * [MemoCard] の読み上げ内容と操作を検証する。
 *
 * カードは clearAndSetSemantics で全体を1つの説明にまとめている。
 * 行ごとに細切れに読まれると一覧を追う操作が著しく遅くなるための判断であり、
 * 「内部のテキストが個別に読まれないこと」まで含めてここで固定する。
 */
@RunWith(RobolectricTestRunner::class)
class MemoCardTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private val updatedText = DateFormat.format(UPDATED_AT)

    @Test
    fun `カード全体が1つの説明として読み上げられる`() {
        setContent(memo(title = "買い物"))

        composeTestRule.onNodeWithContentDescription("買い物、更新 $updatedText").assertIsDisplayed()
    }

    @Test
    fun `ピン留めとお気に入りは説明に含まれる`() {
        setContent(memo(title = "買い物", isPinned = true, isFavorite = true))

        composeTestRule
            .onNodeWithContentDescription("買い物、ピン留め済み、お気に入り、更新 $updatedText")
            .assertIsDisplayed()
    }

    @Test
    fun `ピン留めもお気に入りもなければ説明に含まれない`() {
        setContent(memo(title = "買い物"))

        composeTestRule.onNodeWithContentDescription("ピン留め済み", substring = true).assertDoesNotExist()
        composeTestRule.onNodeWithContentDescription("お気に入り", substring = true).assertDoesNotExist()
    }

    @Test
    fun `内部のテキストは個別に読み上げられない`() {
        setContent(memo(title = "買い物", content = "牛乳"))

        // カード全体の説明へまとめているため、行ごとのテキストは公開しない
        composeTestRule.onNodeWithText("牛乳").assertDoesNotExist()
        composeTestRule.onNodeWithText("買い物").assertDoesNotExist()
    }

    @Test
    fun `タイトルが空なら本文の先頭行を見出しにする`() {
        setContent(memo(title = "", content = "牛乳を買う\n卵も買う"))

        composeTestRule.onNodeWithContentDescription("牛乳を買う、更新 $updatedText").assertIsDisplayed()
    }

    @Test
    fun `タイトルも本文も空ならプレースホルダを見出しにする`() {
        setContent(memo(title = "", content = ""))

        composeTestRule.onNodeWithContentDescription("タイトル、更新 $updatedText").assertIsDisplayed()
    }

    @Test
    fun `タグを付けても読み上げは見出しと日付に絞る`() {
        setContent(memo(title = "買い物", tags = listOf(testTag(name = "仕事"))))

        // タグまで読み上げると一覧を追う速度が落ちるため、説明には含めない
        composeTestRule.onNodeWithContentDescription("買い物、更新 $updatedText").assertIsDisplayed()
    }

    @Test
    fun `クリックすると通知される`() {
        var clicked = 0
        setContent(memo(title = "買い物"), onClick = { clicked++ })

        composeTestRule.onNodeWithContentDescription("買い物、更新 $updatedText").performClick()

        assertEquals(1, clicked)
    }

    private fun setContent(memo: Memo, onClick: () -> Unit = {}) {
        composeTestRule.setContent {
            MaterialTheme {
                MemoCard(memo = memo, onClick = onClick)
            }
        }
    }

    private fun memo(
        title: String,
        content: String = "本文",
        isPinned: Boolean = false,
        isFavorite: Boolean = false,
        tags: List<Tag> = emptyList(),
    ) = testMemo(
        id = ID,
        title = title,
        content = content,
        isPinned = isPinned,
        isFavorite = isFavorite,
        tags = tags,
    )

    private companion object {
        const val ID = 7L
        const val UPDATED_AT = TEST_TIME
    }
}
