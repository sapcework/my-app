package com.sapcework.memo.domain.model

/**
 * タグ名の制約。
 */
object TagPolicy {

    /**
     * タグ名の最大文字数。
     * DB上の制約ではなく、一覧やチップ表示が破綻しないための実務上の上限。
     */
    const val MAX_NAME_LENGTH = 50
}
