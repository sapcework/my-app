package com.sapcework.memo.ui.component

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * [EmptyState] の表示を検証する。
 */
@RunWith(RobolectricTestRunner::class)
class EmptyStateTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun `メッセージを表示する`() {
        composeTestRule.setContent {
            MaterialTheme { EmptyState(message = "メモがありません") }
        }

        composeTestRule.onNodeWithText("メモがありません").assertIsDisplayed()
    }

    @Test
    fun `補足を渡せば併せて表示する`() {
        composeTestRule.setContent {
            MaterialTheme {
                EmptyState(message = "メモがありません", hint = "右下のボタンから作成できます")
            }
        }

        composeTestRule.onNodeWithText("メモがありません").assertIsDisplayed()
        composeTestRule.onNodeWithText("右下のボタンから作成できます").assertIsDisplayed()
    }

    @Test
    fun `補足が無ければ何も足さない`() {
        composeTestRule.setContent {
            MaterialTheme { EmptyState(message = "メモがありません") }
        }

        composeTestRule.onNodeWithText("右下のボタンから作成できます").assertDoesNotExist()
    }
}
