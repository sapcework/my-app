package com.sapcework.memo.di

import android.content.Context
import androidx.room.Room
import com.sapcework.memo.data.dao.MemoDao
import com.sapcework.memo.data.dao.TagDao
import com.sapcework.memo.data.database.MemoDatabase
import com.sapcework.memo.data.database.Migrations
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): MemoDatabase {
        // 破壊的マイグレーションは設定しない（メモの消失を防ぐため）
        val builder = Room.databaseBuilder(context, MemoDatabase::class.java, MemoDatabase.NAME)
        Migrations.ALL.forEach { builder.addMigrations(it) }
        return builder.build()
    }

    @Provides
    fun provideMemoDao(database: MemoDatabase): MemoDao = database.memoDao()

    @Provides
    fun provideTagDao(database: MemoDatabase): TagDao = database.tagDao()
}
