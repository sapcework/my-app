package com.sapcework.memo.di

import com.sapcework.memo.util.SystemTimeProvider
import com.sapcework.memo.util.TimeProvider
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import javax.inject.Singleton

/**
 * アプリ全体で共有する基盤の提供。
 */
@Module
@InstallIn(SingletonComponent::class)
object CoreModule {

    @Provides
    @IoDispatcher
    fun provideIoDispatcher(): CoroutineDispatcher = Dispatchers.IO

    @Provides
    @Singleton
    fun provideTimeProvider(): TimeProvider = SystemTimeProvider()
}
