package com.sapcework.memo.ui.screen.edit

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sapcework.memo.domain.repository.MemoRepository
import com.sapcework.memo.domain.repository.TagRepository
import com.sapcework.memo.domain.usecase.SaveMemoUseCase
import com.sapcework.memo.domain.usecase.SetMemoTagsUseCase
import com.sapcework.memo.util.EditHistory
import com.sapcework.memo.util.EditSnapshot
import com.sapcework.memo.util.TimeProvider
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/**
 * 編集画面。
 *
 * 自動保存とUndo/Redoはどちらも「入力が落ち着いた時点」を境界にする。
 * 打鍵ごとに保存すると書き込みが過剰になり、打鍵ごとに履歴を積むと
 * Undo1回で1文字しか戻らず実用にならないため、同じデバウンスに揃えている。
 *
 * 入力内容の情報源は [_uiState] ただ1つとする。別に控えを持つと
 * Undo直後の入力で古い値が復活するなど、同期ずれの不具合を生むため。
 */
@HiltViewModel
class MemoEditViewModel @Inject constructor(
    private val memoRepository: MemoRepository,
    private val tagRepository: TagRepository,
    private val saveMemo: SaveMemoUseCase,
    private val setMemoTags: SetMemoTagsUseCase,
    private val timeProvider: TimeProvider,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    /** 新規作成なら null。初回保存でIDが確定する。 */
    private var memoId: Long? = savedStateHandle.get<Long>(ARG_MEMO_ID)?.takeIf { it != NEW_MEMO_ID }

    private var history = EditHistory(present = EditSnapshot(title = "", content = ""))

    private val _uiState = MutableStateFlow(MemoEditUiState())
    val uiState: StateFlow<MemoEditUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            // 読み込みが終わってから監視を始める。読み込みによる状態変化で
            // 自動保存が走ると、開いただけで更新日時が変わってしまう。
            loadMemo()
            startAutoSave()
        }
        observeTags()
    }

    private suspend fun loadMemo() {
        val id = memoId
        if (id == null) {
            _uiState.update { it.copy(isLoading = false) }
            return
        }
        val memo = memoRepository.findById(id)
        if (memo == null) {
            // 遷移直後に他所で削除された場合。空の新規として扱い、画面を落とさない。
            memoId = null
            _uiState.update { it.copy(isLoading = false) }
            return
        }
        history = EditHistory(present = EditSnapshot(title = memo.title, content = memo.content))
        _uiState.update {
            it.copy(
                title = memo.title,
                content = memo.content,
                isPinned = memo.isPinned,
                isFavorite = memo.isFavorite,
                tags = memo.tags,
                savedAt = memo.updatedAt,
                isLoading = false,
            )
        }
    }

    private fun observeTags() {
        tagRepository.observeAll()
            .onEach { tags -> _uiState.update { it.copy(allTags = tags) } }
            .launchIn(viewModelScope)
    }

    @OptIn(FlowPreview::class)
    private fun startAutoSave() {
        _uiState
            .map { EditSnapshot(title = it.title, content = it.content) }
            .distinctUntilChanged()
            .drop(1) // 監視開始時点の内容（＝読み込み済みの内容）は保存しない
            .debounce(AUTO_SAVE_DEBOUNCE_MS)
            .onEach { snapshot ->
                // Undo/Redo直後は present と一致するため record は何もしない。
                // これによりUndoの結果が履歴へ積み直されず、Redoが失われない。
                recordHistory(snapshot)
                save(snapshot)
            }
            .launchIn(viewModelScope)
    }

    private fun recordHistory(snapshot: EditSnapshot) {
        history = history.record(snapshot)
        _uiState.update { it.copy(canUndo = history.canUndo, canRedo = history.canRedo) }
    }

    private suspend fun save(snapshot: EditSnapshot) {
        runCatching {
            val savedId = saveMemo(id = memoId, title = snapshot.title, content = snapshot.content)
            if (savedId != null) {
                memoId = savedId // 初回保存で確定したIDを以降の更新に使う
                _uiState.update { it.copy(savedAt = timeProvider.nowMillis()) }
            }
        }.onFailure {
            // 保存できなくても入力中の内容は画面に残す。次の変更で再試行される。
            Timber.w(it, "メモの自動保存に失敗しました")
        }
    }

    fun onTitleChange(value: String) = _uiState.update { it.copy(title = value) }

    fun onContentChange(value: String) = _uiState.update { it.copy(content = value) }

    fun onUndo() = applyHistory(history.undo())

    fun onRedo() = applyHistory(history.redo())

    /** 履歴の内容を画面へ戻す。保存は[startAutoSave]の監視が拾うため、ここでは行わない。 */
    private fun applyHistory(next: EditHistory) {
        history = next
        _uiState.update {
            it.copy(
                title = next.present.title,
                content = next.present.content,
                canUndo = next.canUndo,
                canRedo = next.canRedo,
            )
        }
    }

    fun onPinnedChange(pinned: Boolean) {
        val id = memoId ?: return
        _uiState.update { it.copy(isPinned = pinned) }
        viewModelScope.launch { memoRepository.setPinned(id, pinned) }
    }

    fun onFavoriteChange(favorite: Boolean) {
        val id = memoId ?: return
        _uiState.update { it.copy(isFavorite = favorite) }
        viewModelScope.launch { memoRepository.setFavorite(id, favorite) }
    }

    /** タグは名前で受け取り、未登録なら作成する。 */
    fun onTagsChange(tagNames: List<String>) {
        viewModelScope.launch {
            val id = ensureSaved() ?: return@launch
            runCatching { setMemoTags(memoId = id, tagNames = tagNames) }
                .onFailure { Timber.w(it, "タグの更新に失敗しました") }
            memoRepository.findById(id)?.let { memo ->
                _uiState.update { it.copy(tags = memo.tags) }
            }
        }
    }

    /** タグ付けにはIDが要る。未保存なら先に保存して確定させる。 */
    private suspend fun ensureSaved(): Long? {
        memoId?.let { return it }
        val state = _uiState.value
        val newId = saveMemo(id = null, title = state.title, content = state.content)
        memoId = newId
        return newId
    }

    companion object {
        const val ARG_MEMO_ID = "memoId"

        /** 新規作成を表すID。Navigationの引数はnullを扱いにくいため番兵値を使う。 */
        const val NEW_MEMO_ID = -1L

        private const val AUTO_SAVE_DEBOUNCE_MS = 500L
    }
}
