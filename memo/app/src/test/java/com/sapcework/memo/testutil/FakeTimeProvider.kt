package com.sapcework.memo.testutil

import com.sapcework.memo.util.TimeProvider

/**
 * 時刻を固定・前進させられる [TimeProvider]。
 * 保存日時の更新やゴミ箱の保持期限など、時刻依存の振る舞いを決定的に検証するために使う。
 */
class FakeTimeProvider(var now: Long = 0L) : TimeProvider {

    override fun nowMillis(): Long = now

    fun advanceTo(millis: Long) {
        now = millis
    }
}
