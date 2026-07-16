package com.sapcework.memo.ui.screen.settings

import app.cash.turbine.test
import com.sapcework.memo.domain.model.AppSettings
import com.sapcework.memo.domain.model.FontSize
import com.sapcework.memo.domain.model.ListStyle
import com.sapcework.memo.domain.model.ThemeMode
import com.sapcework.memo.domain.repository.SettingsRepository
import com.sapcework.memo.testutil.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify

/**
 * [SettingsViewModel] が設定の購読と保存を仲介するだけであることを検証する。
 */
@OptIn(ExperimentalCoroutinesApi::class) // runCurrent
class SettingsViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val settingsFlow = MutableStateFlow(AppSettings())
    private val settingsRepository = mock<SettingsRepository> {
        on { settings } doReturn settingsFlow
    }
    private val viewModel by lazy { SettingsViewModel(settingsRepository) }

    @Test
    fun `購読前は既定値を保持する`() = runTest {
        assertEquals(AppSettings(), viewModel.settings.value)
    }

    @Test
    fun `リポジトリの設定を流す`() = runTest {
        settingsFlow.value = AppSettings(themeMode = ThemeMode.DARK, fontSize = FontSize.LARGE)

        viewModel.settings.test {
            assertEquals(AppSettings(), awaitItem()) // stateInの初期値
            val loaded = awaitItem()
            assertEquals(ThemeMode.DARK, loaded.themeMode)
            assertEquals(FontSize.LARGE, loaded.fontSize)
        }
    }

    @Test
    fun `設定の変更を追従して流す`() = runTest {
        viewModel.settings.test {
            assertEquals(ThemeMode.SYSTEM, awaitItem().themeMode)

            settingsFlow.value = AppSettings(themeMode = ThemeMode.LIGHT)

            assertEquals(ThemeMode.LIGHT, awaitItem().themeMode)
        }
    }

    @Test
    fun `onThemeModeChangeはリポジトリへ保存する`() = runTest {
        viewModel.onThemeModeChange(ThemeMode.DARK)
        runCurrent()

        verify(settingsRepository).setThemeMode(ThemeMode.DARK)
    }

    @Test
    fun `onFontSizeChangeはリポジトリへ保存する`() = runTest {
        viewModel.onFontSizeChange(FontSize.EXTRA_LARGE)
        runCurrent()

        verify(settingsRepository).setFontSize(FontSize.EXTRA_LARGE)
    }

    @Test
    fun `onListStyleChangeはリポジトリへ保存する`() = runTest {
        viewModel.onListStyleChange(ListStyle.GRID)
        runCurrent()

        verify(settingsRepository).setListStyle(ListStyle.GRID)
    }
}
