package com.sapcework.memo.ui.screen.list

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.automirrored.filled.Sort
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sapcework.memo.R
import com.sapcework.memo.domain.model.ListStyle
import com.sapcework.memo.domain.model.MemoSortOrder
import com.sapcework.memo.ui.component.EmptyState
import com.sapcework.memo.ui.component.MemoCard
import com.sapcework.memo.ui.component.SelectableTagChip
import com.sapcework.memo.ui.theme.Spacing

/** 一覧が横に伸びすぎると読みづらいため、タブレットでは中央に寄せて幅を制限する。 */
private val LIST_MAX_WIDTH = 840.dp

/** タイル表示の最小幅。画面幅に応じて列数が自動で決まる。 */
private val GRID_MIN_WIDTH = 168.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MemoListScreen(
    onMemoClick: (Long) -> Unit,
    onCreateClick: () -> Unit,
    onTrashClick: () -> Unit,
    onTagsClick: () -> Unit,
    onSettingsClick: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: MemoListViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        modifier = modifier,
        topBar = {
            MemoListTopBar(
                sortOrder = uiState.sortOrder,
                listStyle = uiState.listStyle,
                onSortOrderChange = viewModel::onSortOrderChange,
                onListStyleToggle = viewModel::onListStyleToggle,
                onTrashClick = onTrashClick,
                onTagsClick = onTagsClick,
                onSettingsClick = onSettingsClick,
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onCreateClick) {
                Icon(
                    imageVector = Icons.Filled.Add,
                    contentDescription = stringResource(R.string.list_create),
                )
            }
        },
    ) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding)) {
            SearchArea(
                uiState = uiState,
                onQueryChange = viewModel::onQueryChange,
                onOnlyFavoriteChange = viewModel::onOnlyFavoriteChange,
                onTitleOnlyChange = viewModel::onTitleOnlyChange,
                onTagToggle = viewModel::onTagToggle,
            )

            when {
                uiState.isLoading -> Unit // 読み込み中に「メモがありません」を一瞬出さない
                uiState.memos.isEmpty() && uiState.isSearching -> EmptyState(
                    message = stringResource(R.string.list_no_results),
                    hint = stringResource(R.string.list_no_results_hint),
                )

                uiState.memos.isEmpty() -> EmptyState(
                    message = stringResource(R.string.list_empty),
                    hint = stringResource(R.string.list_empty_hint),
                )

                else -> MemoItems(
                    uiState = uiState,
                    onMemoClick = onMemoClick,
                )
            }
        }
    }
}

@Composable
private fun MemoItems(uiState: MemoListUiState, onMemoClick: (Long) -> Unit) {
    val padding = PaddingValues(
        start = Spacing.md,
        end = Spacing.md,
        bottom = Spacing.xxl, // FABに隠れないよう末尾に余白を確保する
    )
    when (uiState.listStyle) {
        ListStyle.LIST -> LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .widthIn(max = LIST_MAX_WIDTH),
            contentPadding = padding,
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            items(items = uiState.memos, key = { it.id }) { memo ->
                MemoCard(memo = memo, onClick = { onMemoClick(memo.id) })
            }
        }

        ListStyle.GRID -> LazyVerticalGrid(
            columns = GridCells.Adaptive(GRID_MIN_WIDTH),
            modifier = Modifier.fillMaxSize(),
            contentPadding = padding,
            verticalArrangement = Arrangement.spacedBy(Spacing.sm),
            horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
        ) {
            items(items = uiState.memos, key = { it.id }) { memo ->
                MemoCard(memo = memo, onClick = { onMemoClick(memo.id) }, contentMaxLines = 4)
            }
        }
    }
}

@Composable
private fun SearchArea(
    uiState: MemoListUiState,
    onQueryChange: (String) -> Unit,
    onOnlyFavoriteChange: (Boolean) -> Unit,
    onTitleOnlyChange: (Boolean) -> Unit,
    onTagToggle: (Long) -> Unit,
) {
    Column {
        OutlinedTextField(
            value = uiState.query,
            onValueChange = onQueryChange,
            placeholder = { Text(stringResource(R.string.list_search_placeholder)) },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.md, vertical = Spacing.sm),
        )

        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
            contentPadding = PaddingValues(horizontal = Spacing.md),
            modifier = Modifier.padding(bottom = Spacing.sm),
        ) {
            item {
                FilterChip(
                    selected = uiState.onlyFavorite,
                    onClick = { onOnlyFavoriteChange(!uiState.onlyFavorite) },
                    label = { Text(stringResource(R.string.list_filter_favorite)) },
                    leadingIcon = { Icon(Icons.Filled.Star, contentDescription = null) },
                )
            }
            item {
                FilterChip(
                    selected = uiState.titleOnly,
                    onClick = { onTitleOnlyChange(!uiState.titleOnly) },
                    label = { Text(stringResource(R.string.list_filter_title_only)) },
                )
            }
            items(items = uiState.allTags, key = { it.id }) { tag ->
                SelectableTagChip(
                    name = tag.name,
                    selected = tag.id in uiState.selectedTagIds,
                    onClick = { onTagToggle(tag.id) },
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MemoListTopBar(
    sortOrder: MemoSortOrder,
    listStyle: ListStyle,
    onSortOrderChange: (MemoSortOrder) -> Unit,
    onListStyleToggle: () -> Unit,
    onTrashClick: () -> Unit,
    onTagsClick: () -> Unit,
    onSettingsClick: () -> Unit,
) {
    var sortMenuOpen by remember { mutableStateOf(false) }
    var overflowOpen by remember { mutableStateOf(false) }

    TopAppBar(
        title = { Text(stringResource(R.string.list_title)) },
        actions = {
            IconButton(onClick = onListStyleToggle) {
                Icon(
                    imageVector = if (listStyle == ListStyle.LIST) {
                        Icons.Filled.GridView
                    } else {
                        Icons.AutoMirrored.Filled.List
                    },
                    contentDescription = stringResource(R.string.list_style_toggle),
                )
            }

            IconButton(onClick = { sortMenuOpen = true }) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Sort,
                    contentDescription = stringResource(R.string.sort_label),
                )
            }
            DropdownMenu(expanded = sortMenuOpen, onDismissRequest = { sortMenuOpen = false }) {
                MemoSortOrder.entries.forEach { order ->
                    DropdownMenuItem(
                        text = { Text(stringResource(order.labelRes())) },
                        leadingIcon = {
                            RadioButton(selected = order == sortOrder, onClick = null)
                        },
                        onClick = {
                            onSortOrderChange(order)
                            sortMenuOpen = false
                        },
                    )
                }
            }

            IconButton(onClick = { overflowOpen = true }) {
                Icon(Icons.Filled.MoreVert, contentDescription = stringResource(R.string.action_menu))
            }
            DropdownMenu(expanded = overflowOpen, onDismissRequest = { overflowOpen = false }) {
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.tag_title)) },
                    onClick = {
                        overflowOpen = false
                        onTagsClick()
                    },
                )
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.trash_title)) },
                    leadingIcon = { Icon(Icons.Filled.Delete, contentDescription = null) },
                    onClick = {
                        overflowOpen = false
                        onTrashClick()
                    },
                )
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.settings_title)) },
                    leadingIcon = { Icon(Icons.Filled.Settings, contentDescription = null) },
                    onClick = {
                        overflowOpen = false
                        onSettingsClick()
                    },
                )
            }
        },
    )
}

private fun MemoSortOrder.labelRes(): Int = when (this) {
    MemoSortOrder.UPDATED_DESC -> R.string.sort_updated_desc
    MemoSortOrder.CREATED_DESC -> R.string.sort_created_desc
    MemoSortOrder.TITLE_ASC -> R.string.sort_title_asc
    MemoSortOrder.FAVORITE_FIRST -> R.string.sort_favorite_first
}
