package com.sapcework.memo.util

/**
 * 現在時刻の供給元。
 *
 * System.currentTimeMillis() を直接呼ぶとテストで時刻を固定できず、
 * ゴミ箱の30日パージのような時刻依存の処理を検証できないため抽象化する。
 */
fun interface TimeProvider {
    fun nowMillis(): Long
}

/** 本番用の実装。 */
class SystemTimeProvider : TimeProvider {
    override fun nowMillis(): Long = System.currentTimeMillis()
}
