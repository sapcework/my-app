package com.sapcework.memo.data.dao

/**
 * 並び替え順をSQLへ安全に渡すための定数。
 *
 * ORDER BY を文字列連結で組み立てるとSQLインジェクションの温床になるため、
 * 並び順は必ずこの定数（束縛パラメータ）で指定する。
 * enumのordinalは宣言順の変更で値がずれるため、明示的な定数として固定する。
 */
object MemoSortKey {
    const val UPDATED_DESC = 0
    const val CREATED_DESC = 1
    const val TITLE_ASC = 2
    const val FAVORITE_FIRST = 3
}
