package com.sapcework.memo.ui.screen.edit

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Redo
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.AssistChip
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sapcework.memo.R
import com.sapcework.memo.ui.component.SelectableTagChip
import com.sapcework.memo.ui.component.TagInputDialog
import com.sapcework.memo.ui.theme.Spacing
import com.sapcework.memo.util.DateFormat

/** 本文が横に伸びすぎると読みづらいため、タブレットでは幅を制限する。 */
private val EDIT_MAX_WIDTH = 720.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MemoEditScreen(
    onBack: () -> Unit,
    onDeleted: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: MemoEditViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val isDeleted by viewModel.isDeleted.collectAsStateWithLifecycle()
    val tagInputError by viewModel.tagInputError.collectAsStateWithLifecycle()
    val isAddingTag by viewModel.isAddingTag.collectAsStateWithLifecycle()

    // 削除の完了はViewModelが状態で知らせ、遷移の判断は画面側が持つ
    LaunchedEffect(isDeleted) {
        if (isDeleted) onDeleted()
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            MemoEditTopBar(
                uiState = uiState,
                onBack = onBack,
                onUndo = viewModel::onUndo,
                onRedo = viewModel::onRedo,
                onPinnedChange = viewModel::onPinnedChange,
                onFavoriteChange = viewModel::onFavoriteChange,
                onDelete = viewModel::onDelete,
            )
        },
        bottomBar = { EditStatusBar(uiState = uiState) },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .padding(innerPadding)
                .fillMaxSize()
                .widthIn(max = EDIT_MAX_WIDTH)
                .verticalScroll(rememberScrollState()),
        ) {
            TextField(
                value = uiState.title,
                onValueChange = viewModel::onTitleChange,
                placeholder = { Text(stringResource(R.string.edit_title_placeholder)) },
                textStyle = MaterialTheme.typography.headlineSmall,
                singleLine = true,
                colors = transparentTextFieldColors(),
                modifier = Modifier.fillMaxWidth(),
            )

            TagRow(
                uiState = uiState,
                onTagToggle = { tagName ->
                    val current = uiState.tags.map { it.name }
                    val next = if (tagName in current) current - tagName else current + tagName
                    viewModel.onTagsChange(next)
                },
                onTagAddClick = viewModel::onTagAddClick,
            )

            TextField(
                value = uiState.content,
                onValueChange = viewModel::onContentChange,
                placeholder = { Text(stringResource(R.string.edit_content_placeholder)) },
                textStyle = MaterialTheme.typography.bodyLarge,
                colors = transparentTextFieldColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }

    if (isAddingTag) {
        TagInputDialog(
            title = stringResource(R.string.edit_add_tag),
            error = tagInputError,
            onConfirm = viewModel::onTagAdd,
            onDismiss = viewModel::onTagAddDismiss,
        )
    }
}

/** 操作バー。画面の骨格と分離し、本文の構造を追いやすくする。 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MemoEditTopBar(
    uiState: MemoEditUiState,
    onBack: () -> Unit,
    onUndo: () -> Unit,
    onRedo: () -> Unit,
    onPinnedChange: (Boolean) -> Unit,
    onFavoriteChange: (Boolean) -> Unit,
    onDelete: () -> Unit,
) {
    TopAppBar(
        title = {},
        navigationIcon = {
            IconButton(onClick = onBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.action_back),
                )
            }
        },
        actions = {
            IconButton(onClick = onUndo, enabled = uiState.canUndo) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Undo,
                    contentDescription = stringResource(R.string.edit_undo),
                )
            }
            IconButton(onClick = onRedo, enabled = uiState.canRedo) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Redo,
                    contentDescription = stringResource(R.string.edit_redo),
                )
            }
            ToggleIconButton(
                checked = uiState.isPinned,
                onCheckedChange = onPinnedChange,
                checkedIcon = Icons.Filled.PushPin,
                uncheckedIcon = Icons.Outlined.PushPin,
                checkedDescriptionRes = R.string.cd_pin_on,
                uncheckedDescriptionRes = R.string.cd_pin_off,
            )
            ToggleIconButton(
                checked = uiState.isFavorite,
                onCheckedChange = onFavoriteChange,
                checkedIcon = Icons.Filled.Star,
                uncheckedIcon = Icons.Outlined.StarBorder,
                checkedDescriptionRes = R.string.cd_favorite_on,
                uncheckedDescriptionRes = R.string.cd_favorite_off,
            )
            IconButton(onClick = onDelete) {
                Icon(
                    imageVector = Icons.Filled.Delete,
                    contentDescription = stringResource(R.string.action_delete),
                )
            }
        },
    )
}

/** 状態で見た目と読み上げ文言が入れ替わるボタン。ピン留めとお気に入りで形が同じため共通化する。 */
@Composable
private fun ToggleIconButton(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    checkedIcon: ImageVector,
    uncheckedIcon: ImageVector,
    checkedDescriptionRes: Int,
    uncheckedDescriptionRes: Int,
) {
    IconButton(onClick = { onCheckedChange(!checked) }) {
        Icon(
            imageVector = if (checked) checkedIcon else uncheckedIcon,
            contentDescription = stringResource(
                if (checked) checkedDescriptionRes else uncheckedDescriptionRes,
            ),
        )
    }
}

/** タグが1件も無くても追加の導線は残す。ここが唯一の入口になる利用者がいるため。 */
@Composable
private fun TagRow(uiState: MemoEditUiState, onTagToggle: (String) -> Unit, onTagAddClick: () -> Unit) {
    val attached = uiState.tags.map { it.id }.toSet()
    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(Spacing.sm),
        contentPadding = PaddingValues(horizontal = Spacing.md),
        modifier = Modifier.padding(vertical = Spacing.sm),
    ) {
        item {
            // 既存タグのトグルとは別種の操作のため、AssistChipで見分けが付く形にする
            AssistChip(
                onClick = onTagAddClick,
                label = { Text(stringResource(R.string.edit_add_tag)) },
                leadingIcon = { Icon(Icons.Filled.Add, contentDescription = null) },
            )
        }
        items(items = uiState.allTags, key = { it.id }) { tag ->
            SelectableTagChip(
                name = tag.name,
                selected = tag.id in attached,
                onClick = { onTagToggle(tag.name) },
            )
        }
    }
}

@Composable
private fun EditStatusBar(uiState: MemoEditUiState) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.md, vertical = Spacing.sm),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = stringResource(R.string.edit_character_count, uiState.characterCount),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = uiState.savedAt?.let {
                stringResource(R.string.edit_saved_at, DateFormat.format(it))
            } ?: stringResource(R.string.edit_not_saved),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** 下線と背景を消し、素の原稿用紙のように見せる。 */
@Composable
private fun transparentTextFieldColors() = TextFieldDefaults.colors(
    focusedContainerColor = Color.Transparent,
    unfocusedContainerColor = Color.Transparent,
    disabledContainerColor = Color.Transparent,
    focusedIndicatorColor = Color.Transparent,
    unfocusedIndicatorColor = Color.Transparent,
    disabledIndicatorColor = Color.Transparent,
)
