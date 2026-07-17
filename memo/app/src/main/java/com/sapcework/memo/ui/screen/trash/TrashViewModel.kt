package com.sapcework.memo.ui.screen.trash

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sapcework.memo.domain.model.Memo
import com.sapcework.memo.domain.model.TrashPolicy
import com.sapcework.memo.domain.repository.MemoRepository
import com.sapcework.memo.domain.usecase.DeleteMemoUseCase
import com.sapcework.memo.ui.whileScreenSubscribed
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TrashUiState(val memos: List<Memo> = emptyList(), val isLoading: Boolean = true) {
    /** 画面に出す保持日数。ポリシー変更が表示へ自動で反映されるようここから引く。 */
    val retentionDays: Long get() = TrashPolicy.retention.inWholeDays
}

@HiltViewModel
class TrashViewModel @Inject constructor(
    private val memoRepository: MemoRepository,
    private val deleteMemo: DeleteMemoUseCase,
) : ViewModel() {

    val uiState: StateFlow<TrashUiState> = memoRepository.observeTrash()
        .map { TrashUiState(memos = it, isLoading = false) }
        .stateIn(
            scope = viewModelScope,
            started = whileScreenSubscribed,
            initialValue = TrashUiState(),
        )

    fun onRestore(id: Long) {
        viewModelScope.launch { memoRepository.restore(id) }
    }

    /** ゴミ箱内のメモに対して呼ぶため、完全削除になる。復元は不可能。 */
    fun onDeletePermanently(id: Long) {
        viewModelScope.launch { deleteMemo(id) }
    }

    fun onEmptyTrash() {
        viewModelScope.launch {
            uiState.value.memos.forEach { memoRepository.deletePermanently(it.id) }
        }
    }
}
