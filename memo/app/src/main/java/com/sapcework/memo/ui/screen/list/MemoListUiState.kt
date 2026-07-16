package com.sapcework.memo.ui.screen.list

import com.sapcework.memo.domain.model.ListStyle
import com.sapcework.memo.domain.model.Memo
import com.sapcework.memo.domain.model.MemoSortOrder
import com.sapcework.memo.domain.model.Tag

/**
 * 一覧画面の表示状態。
 * 画面が読む状態をこの1つに集約し、Compose側での状態の取り違えを防ぐ。
 */
data class MemoListUiState(
    /** 入力中の検索語。DBへの反映はデバウンスされるが、この値は即時に更新する。 */
    val query: String = "",
    val titleOnly: Boolean = false,
    val onlyFavorite: Boolean = false,
    val selectedTagIds: List<Long> = emptyList(),
    val sortOrder: MemoSortOrder = MemoSortOrder.UPDATED_DESC,
    val listStyle: ListStyle = ListStyle.LIST,
    val memos: List<Memo> = emptyList(),
    val allTags: List<Tag> = emptyList(),
    /** 初回読み込み中。空の一覧と「メモがありません」の表示を区別するために使う。 */
    val isLoading: Boolean = true,
) {
    val isSearching: Boolean get() = query.isNotBlank() || selectedTagIds.isNotEmpty() || onlyFavorite
}
