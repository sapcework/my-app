package com.sapcework.memo.domain.model

/**
 * 一覧の検索・絞り込み・並び替え条件。複合検索はこの1つの条件で表現する。
 *
 * 既定値は「ゴミ箱以外の全件を更新日順」。
 */
data class MemoFilter(
    /** 検索語。空文字なら検索しない。全文（タイトル＋本文）を対象とする。 */
    val query: String = "",

    /** trueなら検索対象をタイトルのみに限定する。 */
    val titleOnly: Boolean = false,

    /** trueならお気に入りのみに絞る。 */
    val onlyFavorite: Boolean = false,

    /** 絞り込むタグ。複数指定した場合は「すべて」を持つメモのみが対象（AND条件）。 */
    val tagIds: List<Long> = emptyList(),

    val sortOrder: MemoSortOrder = MemoSortOrder.UPDATED_DESC,
)
