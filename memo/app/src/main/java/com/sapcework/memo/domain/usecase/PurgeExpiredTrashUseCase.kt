package com.sapcework.memo.domain.usecase

import com.sapcework.memo.domain.model.TrashPolicy
import com.sapcework.memo.domain.repository.MemoRepository
import com.sapcework.memo.util.TimeProvider
import javax.inject.Inject

/**
 * 保持期間を過ぎたゴミ箱を物理削除する。
 *
 * 「30日で消える」は業務ルールのため、data層ではなくこの層が保持する。
 * Repositoryは境界時刻を受け取って消すだけの永続化に徹する。
 */
class PurgeExpiredTrashUseCase @Inject constructor(
    private val memoRepository: MemoRepository,
    private val timeProvider: TimeProvider,
) {
    /** @return 削除した件数 */
    suspend operator fun invoke(): Int {
        val threshold = TrashPolicy.expiryThreshold(timeProvider.nowMillis())
        return memoRepository.purgeTrashOlderThan(threshold)
    }
}
