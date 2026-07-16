package com.sapcework.memo.domain.model

/**
 * メモ一覧の並び替え順。
 * ピン留めは並び順に関わらず常に先頭へ寄せるため、ここには含めない。
 */
enum class MemoSortOrder {
    /** 更新日の新しい順。既定値。 */
    UPDATED_DESC,

    /** 作成日の新しい順。 */
    CREATED_DESC,

    /** タイトルの昇順（大文字小文字を区別しない）。 */
    TITLE_ASC,

    /** お気に入りを優先。 */
    FAVORITE_FIRST,
}
