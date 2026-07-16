package com.sapcework.memo.testutil

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.rules.TestWatcher
import org.junit.runner.Description

/**
 * viewModelScope が使う [Dispatchers.Main] をテスト用へ差し替える。
 *
 * StandardTestDispatcherのため、デバウンスなど時刻に依存する処理を仮想時間で制御できる。
 * runTestは Dispatchers.Main がTestDispatcherならそのschedulerを共有するため、
 * テスト本体からの advanceTimeBy がViewModel側のコルーチンにも効く。
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MainDispatcherRule(val dispatcher: TestDispatcher = StandardTestDispatcher()) : TestWatcher() {

    override fun starting(description: Description) {
        Dispatchers.setMain(dispatcher)
    }

    override fun finished(description: Description) {
        Dispatchers.resetMain()
    }
}
