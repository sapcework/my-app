package com.sapcework.memo.domain.repository

import com.sapcework.memo.domain.model.Memo
import com.sapcework.memo.domain.model.MemoFilter
import kotlinx.coroutines.flow.Flow

/**
 * メモの永続化に対する抽象。実装は data 層が担う。
 * UIとUseCaseはDAOではなくこのインターフェースにのみ依存する。
 */
interface MemoRepository {

    /** 条件に一致するメモを購読する。ゴミ箱の中身は含まない。 */
    fun observeMemos(filter: MemoFilter): Flow<List<Memo>>

    /** 単一メモを購読する。存在しない場合はnullを流す。 */
    fun observeMemo(id: Long): Flow<Memo?>

    /** ゴミ箱の中身を削除の新しい順で購読する。 */
    fun observeTrash(): Flow<List<Memo>>

    suspend fun findById(id: Long): Memo?

    /** 新規作成し、採番されたIDを返す。 */
    suspend fun create(title: String, content: String): Long

    /** 本文・タイトルを更新する。更新日時は実装側で現在時刻に更新する。 */
    suspend fun updateContent(id: Long, title: String, content: String)

    suspend fun moveToTrash(id: Long)

    suspend fun restore(id: Long)

    /** ゴミ箱からの完全削除。復元は不可能になる。 */
    suspend fun deletePermanently(id: Long)

    /**
     * 保持期間を過ぎたゴミ箱を物理削除する。
     * @return 削除した件数
     */
    suspend fun purgeExpiredTrash(): Int

    suspend fun setPinned(id: Long, pinned: Boolean)

    suspend fun setFavorite(id: Long, favorite: Boolean)

    /** バックアップのエクスポート用。ゴミ箱の中身も含めた全件を返す。 */
    suspend fun findAllForExport(): List<Memo>
}
