package com.sapcework.memo.domain.repository

import com.sapcework.memo.domain.model.AppSettings
import com.sapcework.memo.domain.model.FontSize
import com.sapcework.memo.domain.model.ListStyle
import com.sapcework.memo.domain.model.MemoSortOrder
import com.sapcework.memo.domain.model.ThemeMode
import kotlinx.coroutines.flow.Flow

/**
 * 表示設定の永続化に対する抽象。実装は data 層が担う。
 */
interface SettingsRepository {

    /** 現在の設定を購読する。読み出しに失敗した場合は既定値を流す。 */
    val settings: Flow<AppSettings>

    suspend fun setThemeMode(mode: ThemeMode)

    suspend fun setFontSize(size: FontSize)

    suspend fun setListStyle(style: ListStyle)

    suspend fun setSortOrder(order: MemoSortOrder)
}
