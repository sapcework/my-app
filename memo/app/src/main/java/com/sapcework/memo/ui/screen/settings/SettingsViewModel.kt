package com.sapcework.memo.ui.screen.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sapcework.memo.domain.model.AppSettings
import com.sapcework.memo.domain.model.FontSize
import com.sapcework.memo.domain.model.ListStyle
import com.sapcework.memo.domain.model.ThemeMode
import com.sapcework.memo.domain.repository.SettingsRepository
import com.sapcework.memo.ui.whileScreenSubscribed
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(private val settingsRepository: SettingsRepository) : ViewModel() {

    val settings: StateFlow<AppSettings> = settingsRepository.settings
        .stateIn(
            scope = viewModelScope,
            started = whileScreenSubscribed,
            initialValue = AppSettings(),
        )

    fun onThemeModeChange(mode: ThemeMode) {
        viewModelScope.launch { settingsRepository.setThemeMode(mode) }
    }

    fun onFontSizeChange(size: FontSize) {
        viewModelScope.launch { settingsRepository.setFontSize(size) }
    }

    fun onListStyleChange(style: ListStyle) {
        viewModelScope.launch { settingsRepository.setListStyle(style) }
    }
}
