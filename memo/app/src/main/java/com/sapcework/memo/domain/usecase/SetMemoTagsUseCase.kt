package com.sapcework.memo.domain.usecase

import com.sapcework.memo.domain.repository.TagRepository
import javax.inject.Inject

/**
 * メモのタグを、タグ名の一覧で置き換える。未登録の名前は新規作成する。
 *
 * 「名前からIDを解決し、無ければ作る」処理をUIに書くと、画面ごとに再実装されて
 * 表記ゆれのタグが増える。名前の正規化と重複排除をここに集約する。
 */
class SetMemoTagsUseCase @Inject constructor(private val tagRepository: TagRepository) {
    suspend operator fun invoke(memoId: Long, tagNames: List<String>) {
        val tagIds = tagNames
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .distinct() // 同名を複数渡されても関連は1本にする
            .map { name -> tagRepository.create(name) } // 既存なら既存IDが返る
        tagRepository.setTagsOfMemo(memoId = memoId, tagIds = tagIds)
    }
}
