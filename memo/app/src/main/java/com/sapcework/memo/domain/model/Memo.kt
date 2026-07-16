package com.sapcework.memo.domain.model

/**
 * メモのドメインモデル。
 *
 * 将来のiOS対応を見据え、この層はAndroid/Roomに依存しない純粋なKotlinとして保つ。
 * 時刻は移植性のためepoch millisで保持する。
 */
data class Memo(
    val id: Long,
    val title: String,
    val content: String,
    val createdAt: Long,
    val updatedAt: Long,
    val isPinned: Boolean,
    val isFavorite: Boolean,
    /** ゴミ箱へ移動した時刻。NULLなら通常のメモ。 */
    val deletedAt: Long?,
    val tags: List<Tag>,
) {
    val isInTrash: Boolean get() = deletedAt != null

    /** 一覧に出す表示用タイトル。空タイトルを許容するため、その場合は本文の先頭行で代替する。 */
    val displayTitle: String
        get() = title.ifBlank { content.lineSequence().firstOrNull { it.isNotBlank() }.orEmpty() }
}
