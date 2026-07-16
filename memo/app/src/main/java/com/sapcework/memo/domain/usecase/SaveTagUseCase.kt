package com.sapcework.memo.domain.usecase

import com.sapcework.memo.domain.model.TagPolicy
import com.sapcework.memo.domain.model.TagSaveResult
import com.sapcework.memo.domain.repository.TagRepository
import javax.inject.Inject

/**
 * タグを作成、または既存タグを改名する。
 *
 * 名前の検証（空・長さ）と正規化（トリム）をここへ集約する。
 * 作成画面と編集画面で別々に検証すると、片方だけ緩いといった食い違いが起きるため。
 */
class SaveTagUseCase @Inject constructor(private val tagRepository: TagRepository) {
    /**
     * @param id nullなら新規作成。既存IDなら改名。
     */
    suspend operator fun invoke(id: Long?, name: String): TagSaveResult {
        val normalized = name.trim()
        return when {
            normalized.isEmpty() -> TagSaveResult.BlankName
            normalized.length > TagPolicy.MAX_NAME_LENGTH -> TagSaveResult.TooLong
            id == null -> TagSaveResult.Success(tagRepository.create(normalized))
            else -> {
                tagRepository.rename(id = id, name = normalized)
                TagSaveResult.Success(id)
            }
        }
    }
}
