package com.sapcework.memo.data.repository

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import app.cash.turbine.test
import com.sapcework.memo.domain.model.FontSize
import com.sapcework.memo.domain.model.ListStyle
import com.sapcework.memo.domain.model.MemoSortOrder
import com.sapcework.memo.domain.model.ThemeMode
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File

/**
 * [SettingsRepositoryImpl] を一時ファイル上の実DataStoreに対して検証する。
 *
 * 保存形式（列挙値を名前で持つこと）と、読めない値を既定値へ落とす復旧の振る舞いを確かめる。
 */
@RunWith(RobolectricTestRunner::class)
@OptIn(ExperimentalCoroutinesApi::class) // UnconfinedTestDispatcher
class SettingsRepositoryImplTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private val dataStoreScope = CoroutineScope(UnconfinedTestDispatcher() + Job())
    private lateinit var dataStore: DataStore<Preferences>
    private lateinit var repository: SettingsRepositoryImpl

    @Before
    fun setUp() {
        dataStore = PreferenceDataStoreFactory.create(
            scope = dataStoreScope,
            // DataStoreが自前で作るため、ここではパスを渡すだけに留める
            produceFile = { File(tempFolder.root, "settings.preferences_pb") },
        )
        repository = SettingsRepositoryImpl(dataStore, UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        dataStoreScope.cancel()
    }

    @Test
    fun `何も保存していなければ既定値を返す`() = runTest {
        val settings = repository.settings.first()

        assertEquals(ThemeMode.SYSTEM, settings.themeMode)
        assertEquals(FontSize.MEDIUM, settings.fontSize)
        assertEquals(ListStyle.LIST, settings.listStyle)
        assertEquals(MemoSortOrder.UPDATED_DESC, settings.sortOrder)
    }

    @Test
    fun `setThemeModeは保存され読み出せる`() = runTest {
        repository.setThemeMode(ThemeMode.DARK)

        assertEquals(ThemeMode.DARK, repository.settings.first().themeMode)
    }

    @Test
    fun `setFontSizeは保存され読み出せる`() = runTest {
        repository.setFontSize(FontSize.EXTRA_LARGE)

        assertEquals(FontSize.EXTRA_LARGE, repository.settings.first().fontSize)
    }

    @Test
    fun `setListStyleは保存され読み出せる`() = runTest {
        repository.setListStyle(ListStyle.GRID)

        assertEquals(ListStyle.GRID, repository.settings.first().listStyle)
    }

    @Test
    fun `setSortOrderは保存され読み出せる`() = runTest {
        repository.setSortOrder(MemoSortOrder.TITLE_ASC)

        assertEquals(MemoSortOrder.TITLE_ASC, repository.settings.first().sortOrder)
    }

    @Test
    fun `各設定は互いに影響しない`() = runTest {
        repository.setThemeMode(ThemeMode.LIGHT)
        repository.setFontSize(FontSize.SMALL)
        repository.setListStyle(ListStyle.GRID)
        repository.setSortOrder(MemoSortOrder.FAVORITE_FIRST)

        val settings = repository.settings.first()
        assertEquals(ThemeMode.LIGHT, settings.themeMode)
        assertEquals(FontSize.SMALL, settings.fontSize)
        assertEquals(ListStyle.GRID, settings.listStyle)
        assertEquals(MemoSortOrder.FAVORITE_FIRST, settings.sortOrder)
    }

    @Test
    fun `同じ設定を上書きすると最後の値が残る`() = runTest {
        repository.setThemeMode(ThemeMode.DARK)

        repository.setThemeMode(ThemeMode.LIGHT)

        assertEquals(ThemeMode.LIGHT, repository.settings.first().themeMode)
    }

    @Test
    fun `列挙値は名前で保存される`() = runTest {
        repository.setThemeMode(ThemeMode.DARK)

        val stored = dataStore.data.first()[stringPreferencesKey("theme_mode")]

        assertEquals("DARK", stored)
    }

    @Test
    fun `読めない値が保存されていても既定値へ落とす`() = runTest {
        // 旧バージョンの値や破損を模す。設定ひとつで起動不能にならないことを確かめる
        dataStore.edit { it[stringPreferencesKey("theme_mode")] = "NEON" }

        assertEquals(ThemeMode.SYSTEM, repository.settings.first().themeMode)
    }

    @Test
    fun `読めない値があっても他の設定は読み出せる`() = runTest {
        repository.setFontSize(FontSize.LARGE)

        dataStore.edit { it[stringPreferencesKey("theme_mode")] = "NEON" }

        val settings = repository.settings.first()
        assertEquals(ThemeMode.SYSTEM, settings.themeMode)
        assertEquals(FontSize.LARGE, settings.fontSize)
    }

    @Test
    fun `settingsは設定の変更を通知する`() = runTest {
        repository.settings.test {
            assertEquals(ThemeMode.SYSTEM, awaitItem().themeMode)

            repository.setThemeMode(ThemeMode.DARK)

            assertEquals(ThemeMode.DARK, awaitItem().themeMode)
        }
    }
}
