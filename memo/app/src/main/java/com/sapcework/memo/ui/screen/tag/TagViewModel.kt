package com.sapcework.memo.ui.screen.tag

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sapcework.memo.domain.model.Tag
import com.sapcework.memo.domain.model.TagSaveResult
import com.sapcework.memo.domain.repository.TagRepository
import com.sapcework.memo.domain.usecase.SaveTagUseCase
import com.sapcework.memo.ui.component.TagInputError
import com.sapcework.memo.ui.whileScreenSubscribed
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TagListUiState(val tags: List<Tag> = emptyList(), val isLoading: Boolean = true)

/** 入力中のタグ。[tag] がnullなら新規作成、非nullならその改名。 */
data class TagEditTarget(val tag: Tag?)

@HiltViewModel
class TagViewModel @Inject constructor(private val tagRepository: TagRepository, private val saveTag: SaveTagUseCase) :
    ViewModel() {

    val uiState: StateFlow<TagListUiState> = tagRepository.observeAll()
        .map { TagListUiState(tags = it, isLoading = false) }
        .stateIn(
            scope = viewModelScope,
            started = whileScreenSubscribed,
            initialValue = TagListUiState(),
        )

    private val _inputError = MutableStateFlow<TagInputError?>(null)
    val inputError: StateFlow<TagInputError?> = _inputError.asStateFlow()

    /** 入力中の対象。nullなら入力していない。検証を通るまで閉じないため、開閉はここが持つ。 */
    private val _editTarget = MutableStateFlow<TagEditTarget?>(null)
    val editTarget: StateFlow<TagEditTarget?> = _editTarget.asStateFlow()

    fun onCreateClick() = _editTarget.update { TagEditTarget(tag = null) }

    fun onEditClick(tag: Tag) = _editTarget.update { TagEditTarget(tag = tag) }

    fun onEditDismiss() {
        _editTarget.update { null }
        _inputError.update { null }
    }

    /** 入力中の対象へ保存する。新規作成か改名かは[editTarget]が決める。 */
    fun onSave(name: String) {
        viewModelScope.launch {
            when (saveTag(id = _editTarget.value?.tag?.id, name = name)) {
                is TagSaveResult.Success -> {
                    _inputError.update { null }
                    _editTarget.update { null } // 通ったときだけ畳む
                }

                // 弾いた場合は開いたままにし、入力をやり直せるようにする
                TagSaveResult.BlankName -> _inputError.update { TagInputError.BLANK }
                TagSaveResult.TooLong -> _inputError.update { TagInputError.TOO_LONG }
            }
        }
    }

    fun onDelete(id: Long) {
        viewModelScope.launch { tagRepository.delete(id) }
    }
}
