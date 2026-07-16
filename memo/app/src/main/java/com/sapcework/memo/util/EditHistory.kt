package com.sapcework.memo.util

/** 編集画面のある時点の内容。 */
data class EditSnapshot(val title: String, val content: String)

/**
 * Undo/Redo の履歴。編集画面を開いている間のテキスト編集のみを対象とする。
 *
 * ComposeのTextFieldは編集履歴を持たないため自前で保持する。
 * 不変にすることでStateFlowへそのまま載せられ、テストも容易になる。
 * [capacity] で past を打ち切り、長時間の編集でメモリが際限なく増えるのを防ぐ。
 */
data class EditHistory(
    val present: EditSnapshot,
    val past: List<EditSnapshot> = emptyList(),
    val future: List<EditSnapshot> = emptyList(),
    val capacity: Int = DEFAULT_CAPACITY,
) {
    val canUndo: Boolean get() = past.isNotEmpty()
    val canRedo: Boolean get() = future.isNotEmpty()

    /**
     * 新しい内容を履歴へ積む。
     * 打鍵ごとに呼ぶと履歴が埋まるため、入力が落ち着いた時点で呼ぶこと。
     * 内容が変わっていなければ何もしない。
     */
    fun record(next: EditSnapshot): EditHistory {
        if (next == present) return this
        return copy(
            present = next,
            past = (past + present).takeLast(capacity),
            future = emptyList(), // 新しい編集を行った時点でRedoは無効になる
        )
    }

    fun undo(): EditHistory {
        val previous = past.lastOrNull() ?: return this
        return copy(
            present = previous,
            past = past.dropLast(1),
            future = listOf(present) + future,
        )
    }

    fun redo(): EditHistory {
        val next = future.firstOrNull() ?: return this
        return copy(
            present = next,
            past = (past + present).takeLast(capacity),
            future = future.drop(1),
        )
    }

    companion object {
        const val DEFAULT_CAPACITY = 100
    }
}
