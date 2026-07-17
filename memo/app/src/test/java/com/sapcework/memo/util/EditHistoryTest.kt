package com.sapcework.memo.util

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * [EditHistory] のUndo/Redoを検証する。
 *
 * ViewModel経由でも間接的に触れるが、履歴は「Undoの結果を積み直さない」「新しい編集でRedoを捨てる」など
 * 取り違えやすい規則の集合のため、純粋なロジックとしてここで直接固定する。
 */
class EditHistoryTest {

    @Test
    fun `初期状態ではUndoもRedoもできない`() {
        val history = EditHistory(present = snapshot("A"))

        assertEquals(false, history.canUndo)
        assertEquals(false, history.canRedo)
    }

    @Test
    fun `recordは現在の内容を過去へ積んで新しい内容を現在にする`() {
        val history = EditHistory(present = snapshot("A")).record(snapshot("B"))

        assertEquals(snapshot("B"), history.present)
        assertEquals(listOf(snapshot("A")), history.past)
        assertEquals(true, history.canUndo)
    }

    @Test
    fun `同じ内容のrecordは履歴を積まない`() {
        val history = EditHistory(present = snapshot("A")).record(snapshot("A"))

        assertEquals(false, history.canUndo)
        assertEquals(emptyList<EditSnapshot>(), history.past)
    }

    @Test
    fun `undoで直前の内容へ戻る`() {
        val history = EditHistory(present = snapshot("A"))
            .record(snapshot("B"))
            .undo()

        assertEquals(snapshot("A"), history.present)
        assertEquals(true, history.canRedo)
        assertEquals(false, history.canUndo)
    }

    @Test
    fun `redoで取り消した内容へ進む`() {
        val history = EditHistory(present = snapshot("A"))
            .record(snapshot("B"))
            .undo()
            .redo()

        assertEquals(snapshot("B"), history.present)
        assertEquals(false, history.canRedo)
        assertEquals(true, history.canUndo)
    }

    @Test
    fun `undoは複数回さかのぼれる`() {
        val history = EditHistory(present = snapshot("A"))
            .record(snapshot("B"))
            .record(snapshot("C"))

        assertEquals(snapshot("B"), history.undo().present)
        assertEquals(snapshot("A"), history.undo().undo().present)
    }

    @Test
    fun `undoできない状態でのundoは何も変えない`() {
        val history = EditHistory(present = snapshot("A"))

        assertEquals(history, history.undo())
    }

    @Test
    fun `redoできない状態でのredoは何も変えない`() {
        val history = EditHistory(present = snapshot("A")).record(snapshot("B"))

        assertEquals(history, history.redo())
    }

    @Test
    fun `undo後に新しく編集するとRedoは無効になる`() {
        val history = EditHistory(present = snapshot("A"))
            .record(snapshot("B"))
            .undo()
            .record(snapshot("C"))

        // 分岐した歴史へは戻れない
        assertEquals(false, history.canRedo)
        assertEquals(snapshot("C"), history.present)
    }

    @Test
    fun `undo直後に同じ内容をrecordしてもRedoは残る`() {
        // 自動保存がUndo直後の内容を積み直すとRedoが失われるため、その防止を固定する
        val undone = EditHistory(present = snapshot("A"))
            .record(snapshot("B"))
            .undo()

        val history = undone.record(undone.present)

        assertEquals(true, history.canRedo)
        assertEquals(snapshot("B"), history.redo().present)
    }

    @Test
    fun `capacityを超えると古い履歴から捨てる`() {
        val capacity = 2
        val history = EditHistory(present = snapshot("A"), capacity = capacity)
            .record(snapshot("B"))
            .record(snapshot("C"))
            .record(snapshot("D"))

        // 直近capacity件のみ保持し、長時間の編集でメモリが際限なく増えないこと
        assertEquals(listOf(snapshot("B"), snapshot("C")), history.past)
        assertEquals(capacity, history.past.size)
    }

    @Test
    fun `capacityを超えても直近の履歴へは戻れる`() {
        val history = EditHistory(present = snapshot("A"), capacity = 2)
            .record(snapshot("B"))
            .record(snapshot("C"))
            .record(snapshot("D"))

        assertEquals(snapshot("C"), history.undo().present)
        assertEquals(snapshot("B"), history.undo().undo().present)
        assertEquals(false, history.undo().undo().canUndo) // 打ち切られた先へは戻れない
    }

    @Test
    fun `タイトルの変更も履歴の対象になる`() {
        val history = EditHistory(present = EditSnapshot(title = "旧題", content = "本文"))
            .record(EditSnapshot(title = "新題", content = "本文"))

        assertEquals("旧題", history.undo().present.title)
    }

    private fun snapshot(content: String) = EditSnapshot(title = "タイトル", content = content)
}
