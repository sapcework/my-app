package com.sapcework.memo.domain.usecase

import com.sapcework.memo.domain.repository.MemoRepository
import com.sapcework.memo.testutil.FakeTimeProvider
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

/**
 * [PurgeExpiredTrashUseCase] が保持期間の業務ルールを担うことを検証する。
 *
 * 境界時刻は実装を写さず「現在時刻の30日前」を直接記述して確かめる。
 * 保持期間を変更した場合にこのテストが落ちることが、変更の意図確認になる。
 */
class PurgeExpiredTrashUseCaseTest {

    private val memoRepository = mock<MemoRepository>()
    private val time = FakeTimeProvider(now = NOW)
    private val purgeExpiredTrash = PurgeExpiredTrashUseCase(memoRepository, time)

    @Test
    fun `現在時刻の30日前を境界としてRepositoryへ渡す`() = runTest {
        whenever(memoRepository.purgeTrashOlderThan(any())).thenReturn(0)

        purgeExpiredTrash()

        verify(memoRepository).purgeTrashOlderThan(NOW - THIRTY_DAYS_MILLIS)
    }

    @Test
    fun `時刻が進めば境界も同じだけ進む`() = runTest {
        whenever(memoRepository.purgeTrashOlderThan(any())).thenReturn(0)
        time.advanceTo(NOW + ONE_DAY_MILLIS)

        purgeExpiredTrash()

        verify(memoRepository).purgeTrashOlderThan(NOW + ONE_DAY_MILLIS - THIRTY_DAYS_MILLIS)
    }

    @Test
    fun `削除件数をそのまま返す`() = runTest {
        whenever(memoRepository.purgeTrashOlderThan(any())).thenReturn(3)

        assertEquals(3, purgeExpiredTrash())
    }

    @Test
    fun `対象が無ければ0を返す`() = runTest {
        whenever(memoRepository.purgeTrashOlderThan(any())).thenReturn(0)

        assertEquals(0, purgeExpiredTrash())
    }

    private companion object {
        const val NOW = 1_700_000_000_000L // 判定の基準となる現在時刻
        const val ONE_DAY_MILLIS = 24L * 60 * 60 * 1000
        const val THIRTY_DAYS_MILLIS = 30 * ONE_DAY_MILLIS // SPECが定めるゴミ箱の保持期間
    }
}
