package com.sapcework.memo.domain.repository

import com.sapcework.memo.domain.model.Tag
import kotlinx.coroutines.flow.Flow

/**
 * タグの永続化に対する抽象。実装は data 層が担う。
 */
interface TagRepository {

    fun observeAll(): Flow<List<Tag>>

    /** 名前の部分一致でタグを検索する。 */
    fun search(query: String): Flow<List<Tag>>

    /** タグに紐づくメモの件数を購読する。ゴミ箱の中身は数えない。 */
    fun observeMemoCount(tagId: Long): Flow<Int>

    /**
     * タグを作成する。同名が既にあれば作成せず既存のIDを返す。
     * @return 作成または既存のタグID
     */
    suspend fun create(name: String): Long

    suspend fun rename(id: Long, name: String)

    /** タグを削除する。メモとの関連も解消されるが、メモ自体は削除しない。 */
    suspend fun delete(id: Long)

    /** メモに紐づくタグを指定内容で置き換える。 */
    suspend fun setTagsOfMemo(memoId: Long, tagIds: List<Long>)
}
