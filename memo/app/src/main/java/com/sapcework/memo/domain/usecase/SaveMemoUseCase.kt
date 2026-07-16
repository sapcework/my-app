package com.sapcework.memo.domain.usecase

import com.sapcework.memo.domain.repository.MemoRepository
import javax.inject.Inject

/**
 * メモを保存する。新規なら作成、既存なら更新する。
 *
 * 自動保存から繰り返し呼ばれるため、この分岐をUI側に置くと画面ごとに再実装され、
 * 「新規のはずが二重に作成される」種の不具合を生みやすい。ここに集約する。
 * 入力のデバウンスは表示上の都合のためUI層が担う。
 */
class SaveMemoUseCase @Inject constructor(private val memoRepository: MemoRepository) {
    /**
     * @param id nullなら新規作成。
     * @return 保存後のID。中身が空のまま新規作成しようとした場合はnull（保存しない）。
     */
    suspend operator fun invoke(id: Long?, title: String, content: String): Long? = when {
        id != null -> {
            memoRepository.updateContent(id = id, title = title, content = content)
            id
        }
        // 画面を開いただけで空のメモが増えるのを防ぐ
        title.isBlank() && content.isBlank() -> null

        else -> memoRepository.create(title = title, content = content)
    }
}
