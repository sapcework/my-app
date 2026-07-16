package com.sapcework.memo.domain.usecase

import com.sapcework.memo.domain.model.TagPolicy
import com.sapcework.memo.domain.model.TagSaveResult
import com.sapcework.memo.domain.repository.TagRepository
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.mockito.kotlin.whenever

/**
 * [SaveTagUseCase] の名前の検証と正規化を検証する。
 * 検証失敗を例外ではなく [TagSaveResult] で返す契約もここで固定する。
 */
class SaveTagUseCaseTest {

    private val tagRepository = mock<TagRepository>()
    private val saveTag = SaveTagUseCase(tagRepository)

    @Test
    fun `idがnullなら新規作成しSuccessに採番されたidを返す`() = runTest {
        whenever(tagRepository.create(any())).thenReturn(NEW_ID)

        val result = saveTag(id = null, name = "仕事")

        assertEquals(TagSaveResult.Success(NEW_ID), result)
        verify(tagRepository).create("仕事")
    }

    @Test
    fun `作成時は名前の前後の空白を落として渡す`() = runTest {
        whenever(tagRepository.create(any())).thenReturn(NEW_ID)

        saveTag(id = null, name = "  仕事  ")

        verify(tagRepository).create("仕事")
    }

    @Test
    fun `空文字ならBlankNameを返しリポジトリを触らない`() = runTest {
        val result = saveTag(id = null, name = "")

        assertEquals(TagSaveResult.BlankName, result)
        verifyNoInteractions(tagRepository)
    }

    @Test
    fun `空白のみならBlankNameを返す`() = runTest {
        val result = saveTag(id = null, name = "   ")

        assertEquals(TagSaveResult.BlankName, result)
        verifyNoInteractions(tagRepository)
    }

    @Test
    fun `上限を超える名前はTooLongを返しリポジトリを触らない`() = runTest {
        val result = saveTag(id = null, name = "あ".repeat(TagPolicy.MAX_NAME_LENGTH + 1))

        assertEquals(TagSaveResult.TooLong, result)
        verifyNoInteractions(tagRepository)
    }

    @Test
    fun `上限ちょうどの名前は作成する`() = runTest {
        whenever(tagRepository.create(any())).thenReturn(NEW_ID)
        val name = "あ".repeat(TagPolicy.MAX_NAME_LENGTH)

        val result = saveTag(id = null, name = name)

        assertEquals(TagSaveResult.Success(NEW_ID), result)
        verify(tagRepository).create(name)
    }

    @Test
    fun `長さの判定はトリム後の名前で行う`() = runTest {
        whenever(tagRepository.create(any())).thenReturn(NEW_ID)
        val name = "あ".repeat(TagPolicy.MAX_NAME_LENGTH)

        // 空白込みでは上限超過だが、トリム後はちょうど上限に収まる
        val result = saveTag(id = null, name = "  $name  ")

        assertEquals(TagSaveResult.Success(NEW_ID), result)
        verify(tagRepository).create(name)
    }

    @Test
    fun `既存idなら改名しSuccessにそのidを返す`() = runTest {
        val result = saveTag(id = EXISTING_ID, name = "業務")

        assertEquals(TagSaveResult.Success(EXISTING_ID), result)
        verify(tagRepository).rename(id = EXISTING_ID, name = "業務")
    }

    @Test
    fun `改名時も名前の前後の空白を落として渡す`() = runTest {
        saveTag(id = EXISTING_ID, name = "  業務  ")

        verify(tagRepository).rename(id = EXISTING_ID, name = "業務")
    }

    @Test
    fun `改名でも空の名前はBlankNameとして弾く`() = runTest {
        // 作成画面と編集画面で検証が食い違わないこと
        val result = saveTag(id = EXISTING_ID, name = "   ")

        assertEquals(TagSaveResult.BlankName, result)
        verifyNoInteractions(tagRepository)
    }

    @Test
    fun `改名でも上限を超える名前はTooLongとして弾く`() = runTest {
        val result = saveTag(id = EXISTING_ID, name = "あ".repeat(TagPolicy.MAX_NAME_LENGTH + 1))

        assertEquals(TagSaveResult.TooLong, result)
        verifyNoInteractions(tagRepository)
    }

    private companion object {
        const val NEW_ID = 42L
        const val EXISTING_ID = 7L
    }
}
