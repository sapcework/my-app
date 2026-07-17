package com.sapcework.memo.ui.screen.settings

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.sapcework.memo.domain.model.AppSettings
import com.sapcework.memo.domain.model.FontSize
import com.sapcework.memo.domain.model.ListStyle
import com.sapcework.memo.domain.model.ThemeMode
import com.sapcework.memo.domain.repository.SettingsRepository
import com.sapcework.memo.ui.theme.MemoTheme
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.verifyBlocking
import org.robolectric.RobolectricTestRunner

/**
 * [SettingsScreen] を検証する。
 *
 * 各項目は単一選択のため、現在値が選択状態として読み上げに現れることまで確かめる。
 */
@RunWith(RobolectricTestRunner::class)
class SettingsScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    private val settingsFlow = MutableStateFlow(AppSettings())
    private val settingsRepository = mock<SettingsRepository> {
        on { settings } doReturn settingsFlow
    }

    @Test
    fun `テーマと文字サイズと表示形式の選択肢を並べる`() {
        setContent()

        // 画面に収まらない項目もスクロールで到達できること
        composeTestRule.onNodeWithText("テーマ").assertIsDisplayed()
        composeTestRule.onNodeWithText("端末の設定に従う").assertIsDisplayed()
        composeTestRule.onNodeWithText("文字の大きさ").performScrollTo().assertIsDisplayed()
        composeTestRule.onNodeWithText("特大").performScrollTo().assertIsDisplayed()
        composeTestRule.onNodeWithText("一覧の表示形式").performScrollTo().assertIsDisplayed()
        composeTestRule.onNodeWithText("タイル").performScrollTo().assertIsDisplayed()
    }

    @Test
    fun `現在のテーマが選択状態になる`() {
        settingsFlow.value = AppSettings(themeMode = ThemeMode.DARK)

        setContent()

        composeTestRule.onNodeWithText("ダーク").assertIsSelected()
        composeTestRule.onNodeWithText("ライト").assertIsNotSelected()
        composeTestRule.onNodeWithText("端末の設定に従う").assertIsNotSelected()
    }

    @Test
    fun `現在の文字サイズが選択状態になる`() {
        settingsFlow.value = AppSettings(fontSize = FontSize.LARGE)

        setContent()

        composeTestRule.onNodeWithText("大").assertIsSelected()
        composeTestRule.onNodeWithText("標準").assertIsNotSelected()
    }

    @Test
    fun `現在の表示形式が選択状態になる`() {
        settingsFlow.value = AppSettings(listStyle = ListStyle.GRID)

        setContent()

        composeTestRule.onNodeWithText("タイル").assertIsSelected()
        composeTestRule.onNodeWithText("リスト").assertIsNotSelected()
    }

    @Test
    fun `テーマを選ぶと保存する`() {
        setContent()

        composeTestRule.onNodeWithText("ダーク").performClick()

        verifyBlocking(settingsRepository) { setThemeMode(ThemeMode.DARK) }
    }

    @Test
    fun `文字サイズを選ぶと保存する`() {
        setContent()

        composeTestRule.onNodeWithText("特大").performScrollTo().performClick()

        verifyBlocking(settingsRepository) { setFontSize(FontSize.EXTRA_LARGE) }
    }

    @Test
    fun `表示形式を選ぶと保存する`() {
        setContent()

        composeTestRule.onNodeWithText("タイル").performScrollTo().performClick()

        verifyBlocking(settingsRepository) { setListStyle(ListStyle.GRID) }
    }

    @Test
    fun `設定の変更が選択状態へ反映される`() {
        setContent()
        composeTestRule.onNodeWithText("端末の設定に従う").assertIsSelected()

        settingsFlow.value = AppSettings(themeMode = ThemeMode.LIGHT)

        composeTestRule.onNodeWithText("ライト").assertIsSelected()
        composeTestRule.onNodeWithText("端末の設定に従う").assertIsNotSelected()
    }

    @Test
    fun `戻るを押すと通知する`() {
        var backs = 0
        setContent(onBack = { backs++ })

        composeTestRule.onNodeWithContentDescription("戻る").performClick()

        assertEquals(1, backs)
    }

    private fun setContent(onBack: () -> Unit = {}) {
        val viewModel = SettingsViewModel(settingsRepository)
        composeTestRule.setContent {
            MemoTheme {
                SettingsScreen(onBack = onBack, viewModel = viewModel)
            }
        }
    }
}
