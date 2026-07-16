package com.sapcework.memo.ui.screen.list

import com.sapcework.memo.domain.model.AppSettings
import com.sapcework.memo.domain.model.ListStyle
import com.sapcework.memo.domain.model.Memo
import com.sapcework.memo.domain.model.MemoFilter
import com.sapcework.memo.domain.model.MemoSortOrder
import com.sapcework.memo.domain.model.Tag
import com.sapcework.memo.domain.repository.MemoRepository
import com.sapcework.memo.domain.repository.SettingsRepository
import com.sapcework.memo.domain.repository.TagRepository
import com.sapcework.memo.domain.usecase.PurgeExpiredTrashUseCase
import com.sapcework.memo.testutil.MainDispatcherRule
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.atLeastOnce
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever

/**
 * [MemoListViewModel] の検索条件の合成と、設定の永続化を検証する。
 *
 * 検索語のデバウンスは仮想時間で境界を確かめる。打鍵ごとに全走査が走ると
 * 10,000件規模で実用に耐えないため、この遅延は性能要件の一部として固定する。
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MemoListViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    private val memosFlow = MutableStateFlow<List<Memo>>(emptyList())
    private val settingsFlow = MutableStateFlow(AppSettings())
    private val tagsFlow = MutableStateFlow<List<Tag>>(emptyList())

    private val memoRepository = mock<MemoRepository> {
        on { observeMemos(any()) } doReturn memosFlow
    }
    private val settingsRepository = mock<SettingsRepository> {
        on { settings } doReturn settingsFlow
    }
    private val tagRepository = mock<TagRepository> {
        on { observeAll() } doReturn tagsFlow
    }
    private val purgeExpiredTrash = mock<PurgeExpiredTrashUseCase>()

    private val viewModel by lazy {
        MemoListViewModel(memoRepository, settingsRepository, tagRepository, purgeExpiredTrash)
    }

    @Test
    fun `購読前は読み込み中で空`() = runTest {
        assertTrue(viewModel.uiState.value.isLoading)
        assertTrue(viewModel.uiState.value.memos.isEmpty())
    }

    @Test
    fun `一覧とタグと設定を合成してUiStateにする`() = runTest {
        memosFlow.value = listOf(memo(ID, "メモ"))
        tagsFlow.value = listOf(tag(TAG_ID, "仕事"))
        settingsFlow.value = AppSettings(listStyle = ListStyle.GRID, sortOrder = MemoSortOrder.TITLE_ASC)
        subscribeUiState()

        val state = viewModel.uiState.value
        assertEquals(listOf("メモ"), state.memos.map { it.title })
        assertEquals(listOf("仕事"), state.allTags.map { it.name })
        assertEquals(ListStyle.GRID, state.listStyle)
        assertEquals(MemoSortOrder.TITLE_ASC, state.sortOrder)
        assertEquals(false, state.isLoading)
    }

    @Test
    fun `起動時に期限切れのゴミ箱を掃除する`() = runTest {
        viewModel
        runCurrent()

        verify(purgeExpiredTrash).invoke()
    }

    @Test
    fun `ゴミ箱の掃除に失敗しても一覧は表示する`() = runTest {
        whenever(purgeExpiredTrash()).thenThrow(RuntimeException("掃除に失敗"))
        memosFlow.value = listOf(memo(ID, "メモ"))

        subscribeUiState()

        // 掃除の失敗が一覧の購読を巻き込まないこと
        assertEquals(listOf("メモ"), viewModel.uiState.value.memos.map { it.title })
    }

    @Test
    fun `onQueryChangeはUiStateへ即時反映する`() = runTest {
        subscribeUiState()

        viewModel.onQueryChange("会議")
        runCurrent()

        // 検索の実行は遅らせるが、入力中の表示は待たせない
        assertEquals("会議", viewModel.uiState.value.query)
        assertEquals("", lastFilter().query)
    }

    @Test
    fun `検索語はデバウンス時間の経過後に検索条件へ渡る`() = runTest {
        subscribeUiState()

        viewModel.onQueryChange("会議")
        advanceTimeBy(SEARCH_DEBOUNCE_MS - 1)
        assertEquals("", lastFilter().query) // まだ検索は走らない

        advanceTimeBy(2) // デバウンス時間を跨ぐ
        assertEquals("会議", lastFilter().query)
    }

    @Test
    fun `検索語の消去は待たずに反映する`() = runTest {
        subscribeUiState()
        viewModel.onQueryChange("会議")
        advanceTimeBy(SEARCH_DEBOUNCE_MS + 1)

        viewModel.onQueryChange("")
        runCurrent()

        // 消去は待たせる理由がないため即座に反映する
        assertEquals("", lastFilter().query)
    }

    @Test
    fun `onTitleOnlyChangeは検索条件へ渡る`() = runTest {
        subscribeUiState()

        viewModel.onTitleOnlyChange(true)
        runCurrent()

        assertEquals(true, lastFilter().titleOnly)
        assertEquals(true, viewModel.uiState.value.titleOnly)
    }

    @Test
    fun `onOnlyFavoriteChangeは検索条件へ渡る`() = runTest {
        subscribeUiState()

        viewModel.onOnlyFavoriteChange(true)
        runCurrent()

        assertEquals(true, lastFilter().onlyFavorite)
        assertEquals(true, viewModel.uiState.value.onlyFavorite)
    }

    @Test
    fun `onTagToggleはタグを選択し二度目で外す`() = runTest {
        subscribeUiState()

        viewModel.onTagToggle(TAG_ID)
        runCurrent()
        assertEquals(listOf(TAG_ID), lastFilter().tagIds)

        viewModel.onTagToggle(TAG_ID)
        runCurrent()
        assertEquals(emptyList<Long>(), lastFilter().tagIds)
    }

    @Test
    fun `onTagToggleは複数のタグを選べる`() = runTest {
        subscribeUiState()

        viewModel.onTagToggle(TAG_ID)
        viewModel.onTagToggle(OTHER_TAG_ID)
        runCurrent()

        assertEquals(listOf(TAG_ID, OTHER_TAG_ID), lastFilter().tagIds)
    }

    @Test
    fun `onClearFiltersは全ての絞り込みを解除する`() = runTest {
        subscribeUiState()
        viewModel.onQueryChange("会議")
        viewModel.onTitleOnlyChange(true)
        viewModel.onOnlyFavoriteChange(true)
        viewModel.onTagToggle(TAG_ID)
        advanceTimeBy(SEARCH_DEBOUNCE_MS + 1)

        viewModel.onClearFilters()
        runCurrent()

        val state = viewModel.uiState.value
        assertEquals("", state.query)
        assertEquals(false, state.titleOnly)
        assertEquals(false, state.onlyFavorite)
        assertEquals(emptyList<Long>(), state.selectedTagIds)
        assertEquals(false, state.isSearching)
    }

    @Test
    fun `onSortOrderChangeは設定として永続化する`() = runTest {
        viewModel.onSortOrderChange(MemoSortOrder.TITLE_ASC)
        runCurrent()

        // 次回起動でも維持されるよう、状態ではなく設定へ書く
        verify(settingsRepository).setSortOrder(MemoSortOrder.TITLE_ASC)
    }

    @Test
    fun `onListStyleToggleはLISTからGRIDへ切り替えて保存する`() = runTest {
        subscribeUiState()

        viewModel.onListStyleToggle()
        runCurrent()

        verify(settingsRepository).setListStyle(ListStyle.GRID)
    }

    @Test
    fun `onListStyleToggleはGRIDからLISTへ戻して保存する`() = runTest {
        settingsFlow.value = AppSettings(listStyle = ListStyle.GRID)
        subscribeUiState()

        viewModel.onListStyleToggle()
        runCurrent()

        verify(settingsRepository).setListStyle(ListStyle.LIST)
    }

    @Test
    fun `onPinnedChangeはリポジトリへ委譲する`() = runTest {
        viewModel.onPinnedChange(ID, true)
        runCurrent()

        verify(memoRepository).setPinned(ID, true)
    }

    @Test
    fun `onFavoriteChangeはリポジトリへ委譲する`() = runTest {
        viewModel.onFavoriteChange(ID, true)
        runCurrent()

        verify(memoRepository).setFavorite(ID, true)
    }

    /**
     * uiStateはWhileSubscribedのため、購読者がいないと何も動かない。
     * 画面が開いている状態を模し、以降は uiState.value を読んで検証する。
     */
    private fun TestScope.subscribeUiState() {
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect {} }
        runCurrent()
    }

    /** flatMapLatestが最後に組み立てた検索条件。 */
    private fun lastFilter(): MemoFilter {
        val captor = argumentCaptor<MemoFilter>()
        verify(memoRepository, atLeastOnce()).observeMemos(captor.capture())
        return captor.lastValue
    }

    private fun memo(id: Long, title: String) = Memo(
        id = id,
        title = title,
        content = "本文",
        createdAt = CREATED_AT,
        updatedAt = CREATED_AT,
        isPinned = false,
        isFavorite = false,
        deletedAt = null,
        tags = emptyList(),
    )

    private fun tag(id: Long, name: String) = Tag(id = id, name = name, createdAt = CREATED_AT)

    private companion object {
        const val ID = 7L
        const val TAG_ID = 1L
        const val OTHER_TAG_ID = 2L
        const val CREATED_AT = 1_000L

        /** ViewModelが持つ検索デバウンスと同じ値。性能要件のため意図的に固定する。 */
        const val SEARCH_DEBOUNCE_MS = 250L
    }
}
