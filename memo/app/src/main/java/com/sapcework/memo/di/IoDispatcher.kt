package com.sapcework.memo.di

import javax.inject.Qualifier

/**
 * IO用のCoroutineDispatcherを示す修飾子。
 * Dispatchers.IO を直接参照するとテストで差し替えられないため、注入して受け取る。
 */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class IoDispatcher
