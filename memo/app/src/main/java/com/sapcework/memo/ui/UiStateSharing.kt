package com.sapcework.memo.ui

import kotlinx.coroutines.flow.SharingStarted

/**
 * 画面が購読している間だけ上流を動かす共有方針。
 *
 * 画面回転などで購読が一瞬切れてもDBの購読を張り直さずに済むよう猶予を置く。
 * 猶予を画面ごとにばらつかせる理由が無いため、ここで一元管理する。
 */
val whileScreenSubscribed: SharingStarted = SharingStarted.WhileSubscribed(SUBSCRIPTION_TIMEOUT_MS)

private const val SUBSCRIPTION_TIMEOUT_MS = 5_000L
