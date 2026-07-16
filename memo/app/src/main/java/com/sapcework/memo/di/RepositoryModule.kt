package com.sapcework.memo.di

import com.sapcework.memo.data.repository.MemoRepositoryImpl
import com.sapcework.memo.data.repository.TagRepositoryImpl
import com.sapcework.memo.domain.repository.MemoRepository
import com.sapcework.memo.domain.repository.TagRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * domain層のインターフェースへdata層の実装を結び付ける。
 * 上位層は実装ではなく抽象のみに依存する。
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindMemoRepository(impl: MemoRepositoryImpl): MemoRepository

    @Binds
    @Singleton
    abstract fun bindTagRepository(impl: TagRepositoryImpl): TagRepository
}
