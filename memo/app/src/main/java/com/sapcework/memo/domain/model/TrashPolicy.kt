package com.sapcework.memo.domain.model

import kotlin.time.Duration
import kotlin.time.Duration.Companion.days

/**
 * ゴミ箱の保持方針。
 */
object TrashPolicy {

    /** ゴミ箱に入れたメモを保持する期間。これを過ぎたものは物理削除の対象となる。 */
    val retention: Duration = 30.days

    /**
     * パージ対象を判定する境界時刻。これより前に削除されたメモが対象となる。
     */
    fun expiryThreshold(nowMillis: Long): Long = nowMillis - retention.inWholeMilliseconds
}
