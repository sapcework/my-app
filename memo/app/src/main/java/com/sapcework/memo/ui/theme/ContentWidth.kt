package com.sapcework.memo.ui.theme

import androidx.compose.ui.unit.dp

/**
 * 画面内容の最大幅。Magic Number禁止のため、幅の制限は必ずここを参照する。
 *
 * タブレットで横いっぱいに広がると視線の移動が大きく読みづらいため、中央へ寄せて幅を止める。
 * 用途ごとに読みやすい幅が異なるため、1つの値には束ねない。
 */
object ContentWidth {

    /** 一覧。カードが並ぶため本文より広く取れる。 */
    val list = 840.dp

    /** 本文の編集。長文を追うため、一覧より狭くして行長を抑える。 */
    val edit = 720.dp

    /** 設定などの単純な縦並び。選択肢と現在値の対応を見失わない幅に留める。 */
    val form = 640.dp
}
