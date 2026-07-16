package com.sapcework.memo.ui.screen.list

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sapcework.memo.domain.model.MemoFilter
import com.sapcework.memo.domain.model.MemoSortOrder
import com.sapcework.memo.domain.repository.MemoRepository
import com.sapcework.memo.domain.repository.SettingsRepository
import com.sapcework.memo.domain.repository.TagRepository
import com.sapcework.memo.domain.usecase.PurgeExpiredTrashUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

@HiltViewModel
class MemoListViewModel @Inject constructor(
    private val memoRepository: MemoRepository,
    private val settingsRepository: SettingsRepository,
    tagRepository: TagRepository,
    purgeExpiredTrash: PurgeExpiredTrashUseCase,
) : ViewModel() {

    private val query = MutableStateFlow("")
    private val titleOnly = MutableStateFlow(false)
    private val onlyFavorite = MutableStateFlow(false)
    private val selectedTagIds = MutableStateFlow<List<Long>>(emptyList())

    /**
     * 検索語のみ遅延させ、打鍵ごとの全走査を避ける。
     * 消去時は待たせる理由がないため即座に反映する。
     */
    @OptIn(kotlinx.coroutines.FlowPreview::class)
    private val debouncedQuery = query.debounce { keyword ->
        if (keyword.isEmpty()) 0L else SEARCH_DEBOUNCE_MS
    }

    private val sortOrder = settingsRepository.settings
        .map { it.sortOrder }
        .distinctUntilChanged()

    private val filter = combine(
        debouncedQuery,
        titleOnly,
        onlyFavorite,
        selectedTagIds,
        sortOrder,
    ) { keyword, isTitleOnly, isOnlyFavorite, tagIds, order ->
        MemoFilter(
            query = keyword,
            titleOnly = isTitleOnly,
            onlyFavorite = isOnlyFavorite,
            tagIds = tagIds,
            sortOrder = order,
        )
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    private val memos = filter.flatMapLatest { memoRepository.observeMemos(it) }

    val uiState: StateFlow<MemoListUiState> = combine(
        combine(query, titleOnly, onlyFavorite, selectedTagIds) { keyword, isTitleOnly, isOnlyFavorite, tagIds ->
            Criteria(keyword, isTitleOnly, isOnlyFavorite, tagIds)
        },
        memos,
        settingsRepository.settings,
        tagRepository.observeAll(),
    ) { criteria, memoList, settings, tags ->
        MemoListUiState(
            query = criteria.query,
            titleOnly = criteria.titleOnly,
            onlyFavorite = criteria.onlyFavorite,
            selectedTagIds = criteria.tagIds,
            sortOrder = settings.sortOrder,
            listStyle = settings.listStyle,
            memos = memoList,
            allTags = tags,
            isLoading = false,
        )
    }.stateIn(
        scope = viewModelScope,
        // 画面回転などの短い購読断で購読を切らないため猶予を置く
        started = SharingStarted.WhileSubscribed(SUBSCRIPTION_TIMEOUT_MS),
        initialValue = MemoListUiState(),
    )

    init {
        viewModelScope.launch {
            // 保持期限切れの掃除は起動のたびに行う。失敗しても一覧の表示は妨げない。
            runCatching { purgeExpiredTrash() }
                .onFailure { Timber.w(it, "ゴミ箱の自動削除に失敗しました") }
        }
    }

    fun onQueryChange(value: String) = query.update { value }

    fun onTitleOnlyChange(value: Boolean) = titleOnly.update { value }

    fun onOnlyFavoriteChange(value: Boolean) = onlyFavorite.update { value }

    fun onTagToggle(tagId: Long) = selectedTagIds.update { current ->
        if (tagId in current) current - tagId else current + tagId
    }

    fun onClearFilters() {
        query.update { "" }
        titleOnly.update { false }
        onlyFavorite.update { false }
        selectedTagIds.update { emptyList() }
    }

    /** 並び順は設定として永続化し、次回起動でも維持する。 */
    fun onSortOrderChange(order: MemoSortOrder) {
        viewModelScope.launch { settingsRepository.setSortOrder(order) }
    }

    fun onPinnedChange(id: Long, pinned: Boolean) {
        viewModelScope.launch { memoRepository.setPinned(id, pinned) }
    }

    fun onFavoriteChange(id: Long, favorite: Boolean) {
        viewModelScope.launch { memoRepository.setFavorite(id, favorite) }
    }

    private data class Criteria(
        val query: String,
        val titleOnly: Boolean,
        val onlyFavorite: Boolean,
        val tagIds: List<Long>,
    )

    private companion object {
        const val SEARCH_DEBOUNCE_MS = 250L
        const val SUBSCRIPTION_TIMEOUT_MS = 5_000L
    }
}
