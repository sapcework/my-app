package com.sapcework.memo.ui.screen.list

import android.os.Looper
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.sapcework.memo.domain.model.AppSettings
import com.sapcework.memo.domain.model.Memo
import com.sapcework.memo.domain.model.Tag
import com.sapcework.memo.domain.repository.MemoRepository
import com.sapcework.memo.domain.repository.SettingsRepository
import com.sapcework.memo.domain.repository.TagRepository
import com.sapcework.memo.domain.usecase.PurgeExpiredTrashUseCase
import com.sapcework.memo.ui.theme.MemoTheme
import com.sapcework.memo.util.DateFormat
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.kotlin.any
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import java.time.Duration

/**
 * [MemoListScreen] の表示の出し分けを検証する。
 *
 * 「読み込み中」「まだ無い」「検索に一致しない」は利用者にとって別の状況で、
 * 取り違えると空でないのに空と伝えてしまう。この分岐を画面越しに固定する。
 */
@RunWith(RobolectricTestRunner::class)
class MemoListScreenTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    /** 値を持たない状態から始め、読み込み中を再現できるようにする。 */
    private val memosFlow = MutableSharedFlow<List<Memo>>(replay = 1)
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

    @Test
    fun `読み込み中は空の案内を出さない`() {
        setContent() // メモを流さないまま描画する

        // 読み込み中に「メモがありません」を一瞬出さないこと
        composeTestRule.onNodeWithText("メモがありません").assertDoesNotExist()
        composeTestRule.onNodeWithText("該当するメモがありません").assertDoesNotExist()
    }

    @Test
    fun `メモが無ければ作成を促す`() {
        memosFlow.tryEmit(emptyList())

        setContent()

        composeTestRule.onNodeWithText("メモがありません").assertIsDisplayed()
        composeTestRule.onNodeWithText("右下のボタンから作成できます").assertIsDisplayed()
    }

    @Test
    fun `検索して0件なら条件を変えるよう促す`() {
        memosFlow.tryEmit(emptyList())

        setContent { viewModel -> viewModel.onQueryChange("会議") }
        advancePastSearchDebounce()

        // 「まだ無い」ではなく「一致しない」と伝えること
        composeTestRule.onNodeWithText("該当するメモがありません").assertIsDisplayed()
        composeTestRule.onNodeWithText("検索条件を変えてお試しください").assertIsDisplayed()
        composeTestRule.onNodeWithText("メモがありません").assertDoesNotExist()
    }

    @Test
    fun `お気に入り絞り込みで0件でも一致しないと伝える`() {
        memosFlow.tryEmit(emptyList())

        setContent { viewModel -> viewModel.onOnlyFavoriteChange(true) }

        composeTestRule.onNodeWithText("該当するメモがありません").assertIsDisplayed()
    }

    @Test
    fun `メモがあれば一覧に表示する`() {
        memosFlow.tryEmit(listOf(memo(ID, "買い物")))

        setContent()

        composeTestRule.onNodeWithContentDescription(descriptionOf("買い物")).assertIsDisplayed()
        composeTestRule.onNodeWithText("メモがありません").assertDoesNotExist()
    }

    @Test
    fun `メモをタップすると そのidで通知する`() {
        memosFlow.tryEmit(listOf(memo(ID, "買い物")))
        var clickedId: Long? = null
        setContent(onMemoClick = { clickedId = it })

        composeTestRule.onNodeWithContentDescription(descriptionOf("買い物")).performClick()

        assertEquals(ID, clickedId)
    }

    @Test
    fun `作成ボタンを押すと通知する`() {
        memosFlow.tryEmit(emptyList())
        var created = 0
        setContent(onCreateClick = { created++ })

        composeTestRule.onNodeWithContentDescription("メモを作成").performClick()

        assertEquals(1, created)
    }

    /**
     * 検索語のデバウンスを跨がせる。
     * viewModelScopeのdelayはメインLooperへ積まれるため、Looperの時計を進めて消化する。
     */
    private fun advancePastSearchDebounce() {
        shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(SEARCH_DEBOUNCE_MS + 1))
        composeTestRule.waitForIdle()
    }

    private fun descriptionOf(title: String) = "$title、更新 ${DateFormat.format(UPDATED_AT)}"

    private fun setContent(
        onMemoClick: (Long) -> Unit = {},
        onCreateClick: () -> Unit = {},
        setUp: (MemoListViewModel) -> Unit = {},
    ) {
        val viewModel = MemoListViewModel(memoRepository, settingsRepository, tagRepository, purgeExpiredTrash)
        setUp(viewModel)
        composeTestRule.setContent {
            MemoTheme {
                MemoListScreen(
                    onMemoClick = onMemoClick,
                    onCreateClick = onCreateClick,
                    onTrashClick = {},
                    onTagsClick = {},
                    onSettingsClick = {},
                    viewModel = viewModel,
                )
            }
        }
    }

    private fun memo(id: Long, title: String) = Memo(
        id = id,
        title = title,
        content = "本文",
        createdAt = UPDATED_AT,
        updatedAt = UPDATED_AT,
        isPinned = false,
        isFavorite = false,
        deletedAt = null,
        tags = emptyList(),
    )

    private companion object {
        const val ID = 7L
        const val UPDATED_AT = 1_600_000_000_000L // 2020年の固定日時
        const val SEARCH_DEBOUNCE_MS = 250L // ViewModelが持つ検索デバウンスと同じ値
    }
}
