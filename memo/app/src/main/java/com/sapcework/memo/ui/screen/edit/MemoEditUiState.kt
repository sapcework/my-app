package com.sapcework.memo.ui.screen.edit

import com.sapcework.memo.domain.model.Tag

/**
 * 編集画面の表示状態。
 */
data class MemoEditUiState(
    val title: String = "",
    val content: String = "",
    val canUndo: Boolean = false,
    val canRedo: Boolean = false,
    val isPinned: Boolean = false,
    val isFavorite: Boolean = false,
    val tags: List<Tag> = emptyList(),
    val allTags: List<Tag> = emptyList(),
    /** 最終保存時刻。未保存ならnull。 */
    val savedAt: Long? = null,
    val isLoading: Boolean = true,
) {
    /** 文字数表示用。タイトルは含めず本文のみを数える。 */
    val characterCount: Int get() = content.length
}
