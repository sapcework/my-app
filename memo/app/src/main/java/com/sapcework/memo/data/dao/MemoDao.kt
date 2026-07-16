package com.sapcework.memo.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import com.sapcework.memo.data.entity.MemoEntity
import com.sapcework.memo.data.entity.MemoWithTags
import kotlinx.coroutines.flow.Flow

/**
 * メモへのDBアクセス。UIから直接呼ばず、必ずRepositoryを経由すること。
 *
 * 全文検索はFTSではなくLIKEで行う。FTS4が使えるトークナイザは空白・記号で単語を区切るため、
 * 分かち書きしない日本語では文全体が1トークンとなり部分一致が機能しない。
 * 10,000件規模なら全走査でも実用的な速度に収まるため、速度より日本語での正しさを優先する。
 */
@Dao
interface MemoDao {

    /**
     * 一覧・検索・絞り込み・並び替えをまとめて解決する。
     *
     * @param query 空文字なら検索なし。`%`と`_`は呼び出し側でエスケープすること。
     * @param titleOnly trueならタイトルのみを検索対象にする。
     * @param onlyFavorite trueならお気に入りのみに絞る。
     * @param tagIds 絞り込むタグ。空なら絞り込まない。
     * @param tagCount [tagIds]の件数。指定タグを「すべて」持つメモに絞るために使う。
     * @param sortKey [MemoSortKey]の値。
     */
    @Transaction
    @Query(
        """
        SELECT * FROM memos AS m
        WHERE m.deleted_at IS NULL
          AND (
            :query = ''
            OR m.title LIKE '%' || :query || '%' ESCAPE '\'
            OR (:titleOnly = 0 AND m.content LIKE '%' || :query || '%' ESCAPE '\')
          )
          AND (:onlyFavorite = 0 OR m.is_favorite = 1)
          AND (
            :tagCount = 0
            OR (
              SELECT COUNT(DISTINCT x.tag_id) FROM memo_tag_cross_ref AS x
              WHERE x.memo_id = m.id AND x.tag_id IN (:tagIds)
            ) = :tagCount
          )
        ORDER BY
          m.is_pinned DESC,
          CASE WHEN :sortKey = 3 THEN m.is_favorite END DESC,
          CASE WHEN :sortKey = 1 THEN m.created_at END DESC,
          CASE WHEN :sortKey = 2 THEN m.title END COLLATE NOCASE ASC,
          m.updated_at DESC
        """,
    )
    fun observeMemos(
        query: String,
        titleOnly: Boolean,
        onlyFavorite: Boolean,
        tagIds: List<Long>,
        tagCount: Int,
        sortKey: Int,
    ): Flow<List<MemoWithTags>>

    @Transaction
    @Query("SELECT * FROM memos WHERE id = :id")
    fun observeById(id: Long): Flow<MemoWithTags?>

    @Transaction
    @Query("SELECT * FROM memos WHERE id = :id")
    suspend fun findById(id: Long): MemoWithTags?

    /** ゴミ箱。削除が新しい順に並べる。 */
    @Transaction
    @Query("SELECT * FROM memos WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")
    fun observeTrash(): Flow<List<MemoWithTags>>

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(memo: MemoEntity): Long

    @Update
    suspend fun update(memo: MemoEntity)

    @Query("UPDATE memos SET deleted_at = :deletedAt WHERE id = :id")
    suspend fun moveToTrash(id: Long, deletedAt: Long)

    @Query("UPDATE memos SET deleted_at = NULL, updated_at = :updatedAt WHERE id = :id")
    suspend fun restoreFromTrash(id: Long, updatedAt: Long)

    /** 完全削除。中間テーブルの関連はCASCADEで自動的に消える。 */
    @Query("DELETE FROM memos WHERE id = :id")
    suspend fun deletePermanently(id: Long)

    /**
     * 保持期限を過ぎたゴミ箱を物理削除する。
     * @param threshold この時刻より前に削除されたものを対象とする。
     */
    @Query("DELETE FROM memos WHERE deleted_at IS NOT NULL AND deleted_at < :threshold")
    suspend fun purgeExpired(threshold: Long): Int

    @Query("UPDATE memos SET is_pinned = :pinned WHERE id = :id")
    suspend fun setPinned(id: Long, pinned: Boolean)

    @Query("UPDATE memos SET is_favorite = :favorite WHERE id = :id")
    suspend fun setFavorite(id: Long, favorite: Boolean)

    /** バックアップのJSONエクスポート用。ゴミ箱の内容も含めて全件返す。 */
    @Transaction
    @Query("SELECT * FROM memos ORDER BY id")
    suspend fun findAllForExport(): List<MemoWithTags>
}
