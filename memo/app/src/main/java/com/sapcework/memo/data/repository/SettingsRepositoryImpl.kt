package com.sapcework.memo.data.repository

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import com.sapcework.memo.di.IoDispatcher
import com.sapcework.memo.domain.model.AppSettings
import com.sapcework.memo.domain.model.FontSize
import com.sapcework.memo.domain.model.ListStyle
import com.sapcework.memo.domain.model.MemoSortOrder
import com.sapcework.memo.domain.model.ThemeMode
import com.sapcework.memo.domain.repository.SettingsRepository
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.map
import timber.log.Timber
import java.io.IOException
import javax.inject.Inject

/**
 * [SettingsRepository] のDataStore実装。
 *
 * 設定は端末内にのみ保存する。列挙値は名前で保存し、
 * 読めない値（旧バージョンの値や破損）に当たっても例外を投げず既定値へ落とす。
 * 設定ひとつのために起動不能になる方が損害が大きいため。
 */
class SettingsRepositoryImpl @Inject constructor(
    private val dataStore: DataStore<Preferences>,
    @param:IoDispatcher private val ioDispatcher: CoroutineDispatcher,
) : SettingsRepository {

    override val settings: Flow<AppSettings> = dataStore.data
        .catch { cause ->
            // DataStoreの読み出し失敗は既定値で継続する（IOException以外は想定外なので投げ直す）
            if (cause is IOException) {
                Timber.w(cause, "設定の読み出しに失敗したため既定値を使用します")
                emit(emptyPreferences())
            } else {
                throw cause
            }
        }
        .map { prefs ->
            AppSettings(
                themeMode = prefs[keyThemeMode].toEnumOr(ThemeMode.SYSTEM),
                fontSize = prefs[keyFontSize].toEnumOr(FontSize.MEDIUM),
                listStyle = prefs[keyListStyle].toEnumOr(ListStyle.LIST),
                sortOrder = prefs[keySortOrder].toEnumOr(MemoSortOrder.UPDATED_DESC),
            )
        }
        .flowOn(ioDispatcher)

    override suspend fun setThemeMode(mode: ThemeMode) = put(keyThemeMode, mode.name)

    override suspend fun setFontSize(size: FontSize) = put(keyFontSize, size.name)

    override suspend fun setListStyle(style: ListStyle) = put(keyListStyle, style.name)

    override suspend fun setSortOrder(order: MemoSortOrder) = put(keySortOrder, order.name)

    private suspend fun put(key: Preferences.Key<String>, value: String) {
        dataStore.edit { it[key] = value }
    }

    private companion object {
        val keyThemeMode = stringPreferencesKey("theme_mode")
        val keyFontSize = stringPreferencesKey("font_size")
        val keyListStyle = stringPreferencesKey("list_style")
        val keySortOrder = stringPreferencesKey("sort_order")

        /** 保存名から列挙値へ戻す。未知の値なら既定値を返す。 */
        inline fun <reified T : Enum<T>> String?.toEnumOr(default: T): T =
            this?.let { name -> enumValues<T>().firstOrNull { it.name == name } } ?: default
    }
}
