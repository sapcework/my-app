package com.sapcework.memo.ui.navigation

import com.sapcework.memo.ui.screen.edit.MemoEditViewModel

/**
 * 画面の宛先。経路の文字列をここへ集約し、呼び出し側での綴り間違いを防ぐ。
 */
sealed class MemoDestination(val route: String) {

    data object List : MemoDestination("list")

    data object Trash : MemoDestination("trash")

    data object Tags : MemoDestination("tags")

    data object Settings : MemoDestination("settings")

    data object Edit : MemoDestination("edit/{${MemoEditViewModel.ARG_MEMO_ID}}") {
        /** @param memoId 新規作成なら [MemoEditViewModel.NEW_MEMO_ID]。 */
        fun createRoute(memoId: Long): String = "edit/$memoId"
    }
}
