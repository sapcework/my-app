package com.sapcework.memo.ui.screen.tag

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sapcework.memo.domain.model.Tag
import com.sapcework.memo.domain.model.TagSaveResult
import com.sapcework.memo.domain.repository.TagRepository
import com.sapcework.memo.domain.usecase.SaveTagUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TagListUiState(val tags: List<Tag> = emptyList(), val isLoading: Boolean = true)

/** タグ名の検証結果。UI側が文言を決める。 */
enum class TagInputError { BLANK, TOO_LONG }

@HiltViewModel
class TagViewModel @Inject constructor(private val tagRepository: TagRepository, private val saveTag: SaveTagUseCase) :
    ViewModel() {

    val uiState: StateFlow<TagListUiState> = tagRepository.observeAll()
        .map { TagListUiState(tags = it, isLoading = false) }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(SUBSCRIPTION_TIMEOUT_MS),
            initialValue = TagListUiState(),
        )

    private val _inputError = MutableStateFlow<TagInputError?>(null)
    val inputError: StateFlow<TagInputError?> = _inputError.asStateFlow()

    /** @param id nullなら新規作成、既存IDなら改名。 */
    fun onSave(id: Long?, name: String) {
        viewModelScope.launch {
            _inputError.update {
                when (saveTag(id = id, name = name)) {
                    is TagSaveResult.Success -> null
                    TagSaveResult.BlankName -> TagInputError.BLANK
                    TagSaveResult.TooLong -> TagInputError.TOO_LONG
                }
            }
        }
    }

    fun onDelete(id: Long) {
        viewModelScope.launch { tagRepository.delete(id) }
    }

    fun onErrorShown() = _inputError.update { null }

    private companion object {
        const val SUBSCRIPTION_TIMEOUT_MS = 5_000L
    }
}
