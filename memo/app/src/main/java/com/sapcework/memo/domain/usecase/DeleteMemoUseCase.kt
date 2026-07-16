package com.sapcework.memo.domain.usecase

import com.sapcework.memo.domain.repository.MemoRepository
import javax.inject.Inject

/**
 * メモを削除する。
 *
 * ゴミ箱にあるものは完全削除し、それ以外はゴミ箱へ移す。
 * 「1回目は復元可能、2回目で完全削除」という復元可能性の担保が要件の中核のため、
 * この判断をUIに委ねず、必ずここを通す。
 */
class DeleteMemoUseCase @Inject constructor(private val memoRepository: MemoRepository) {
    /**
     * @return 完全削除したなら true、ゴミ箱へ移したなら false。
     *   取り消し導線（元に戻す）の出し分けに使う。
     */
    suspend operator fun invoke(id: Long): Boolean {
        // 画面が保持する状態は古い可能性があるため、DBの現在値で判断する
        val memo = memoRepository.findById(id) ?: return false
        return if (memo.isInTrash) {
            memoRepository.deletePermanently(id)
            true
        } else {
            memoRepository.moveToTrash(id)
            false
        }
    }
}
