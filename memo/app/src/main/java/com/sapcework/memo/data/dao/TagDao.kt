package com.sapcework.memo.data.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.sapcework.memo.data.entity.MemoTagCrossRef
import com.sapcework.memo.data.entity.TagEntity
import kotlinx.coroutines.flow.Flow

/**
 * タグと、メモ-タグ関連へのDBアクセス。UIから直接呼ばず、必ずRepositoryを経由すること。
 */
@Dao
interface TagDao {

    @Query("SELECT * FROM tags ORDER BY name COLLATE NOCASE ASC")
    fun observeAll(): Flow<List<TagEntity>>

    @Query("SELECT * FROM tags WHERE name = :name")
    suspend fun findByName(name: String): TagEntity?

    @Query("SELECT * FROM tags WHERE name LIKE '%' || :query || '%' ESCAPE '\' ORDER BY name COLLATE NOCASE ASC")
    fun searchByName(query: String): Flow<List<TagEntity>>

    /** 名前が一意のため、重複作成はIGNOREで無視する（既存IDは[findByName]で解決する）。 */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(tag: TagEntity): Long

    @Update
    suspend fun update(tag: TagEntity)

    /** タグ削除。メモとの関連はCASCADEで自動的に消える。 */
    @Delete
    suspend fun delete(tag: TagEntity)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun addTagToMemo(crossRef: MemoTagCrossRef)

    @Delete
    suspend fun removeTagFromMemo(crossRef: MemoTagCrossRef)

    @Query("DELETE FROM memo_tag_cross_ref WHERE memo_id = :memoId")
    suspend fun clearTagsOfMemo(memoId: Long)

    /** タグ一覧に付与件数を出すため。ゴミ箱内のメモは数えない。 */
    @Query(
        """
        SELECT COUNT(*) FROM memo_tag_cross_ref AS x
        INNER JOIN memos AS m ON m.id = x.memo_id
        WHERE x.tag_id = :tagId AND m.deleted_at IS NULL
        """,
    )
    fun observeMemoCount(tagId: Long): Flow<Int>
}
