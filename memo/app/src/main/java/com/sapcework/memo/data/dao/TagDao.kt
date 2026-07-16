package com.sapcework.memo.data.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
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

    @Query("SELECT * FROM tags WHERE id = :id")
    suspend fun findById(id: Long): TagEntity?

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

    /**
     * タグを作成し、同名が既にあれば既存のIDを返す。
     * 挿入と既存検索をトランザクションで囲み、並行実行時の取りこぼしを防ぐ。
     */
    @Transaction
    suspend fun insertOrGet(tag: TagEntity): Long {
        val inserted = insert(tag)
        if (inserted != -1L) return inserted // -1 はIGNOREにより挿入されなかったことを示す
        // 例外メッセージにタグ名を含めない（利用者のデータをログへ出さないため）
        return findByName(tag.name)?.id ?: error("タグの作成に失敗しました")
    }

    /**
     * メモに紐づくタグを指定内容へ置き換える。
     * 全削除と再登録の間で中断されるとタグが失われるため、トランザクションで囲む。
     */
    @Transaction
    suspend fun replaceTagsOfMemo(memoId: Long, tagIds: List<Long>) {
        clearTagsOfMemo(memoId)
        tagIds.forEach { addTagToMemo(MemoTagCrossRef(memoId = memoId, tagId = it)) }
    }

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
