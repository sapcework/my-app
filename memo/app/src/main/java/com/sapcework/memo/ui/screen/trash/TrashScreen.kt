package com.sapcework.memo.ui.screen.trash

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.RestoreFromTrash
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sapcework.memo.R
import com.sapcework.memo.ui.component.EmptyState
import com.sapcework.memo.ui.theme.ContentWidth
import com.sapcework.memo.ui.theme.Spacing
import com.sapcework.memo.util.DateFormat

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrashScreen(onBack: () -> Unit, modifier: Modifier = Modifier, viewModel: TrashViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    /** 取り消せない操作のため、対象を保持して確認を挟む。nullなら未確認。 */
    var confirmDeleteId by remember { mutableStateOf<Long?>(null) }
    var confirmEmptyAll by remember { mutableStateOf(false) }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.trash_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.action_back),
                        )
                    }
                },
                actions = {
                    if (uiState.memos.isNotEmpty()) {
                        TextButton(onClick = { confirmEmptyAll = true }) {
                            Text(stringResource(R.string.trash_empty_all))
                        }
                    }
                },
            )
        },
    ) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding)) {
            Text(
                text = stringResource(R.string.trash_retention_notice, uiState.retentionDays),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = Spacing.md, vertical = Spacing.sm),
            )

            when {
                uiState.isLoading -> Unit
                uiState.memos.isEmpty() -> EmptyState(
                    message = stringResource(R.string.trash_empty),
                )

                else -> LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .widthIn(max = ContentWidth.list),
                    contentPadding = PaddingValues(Spacing.md),
                    verticalArrangement = Arrangement.spacedBy(Spacing.sm),
                ) {
                    items(items = uiState.memos, key = { it.id }) { memo ->
                        TrashItem(
                            title = memo.displayTitle.ifBlank {
                                stringResource(R.string.edit_title_placeholder)
                            },
                            deletedAt = memo.deletedAt,
                            onRestore = { viewModel.onRestore(memo.id) },
                            onDelete = { confirmDeleteId = memo.id },
                        )
                    }
                }
            }
        }
    }

    confirmDeleteId?.let { id ->
        ConfirmDialog(
            title = stringResource(R.string.trash_delete_confirm_title),
            message = stringResource(R.string.trash_delete_confirm_message),
            onConfirm = {
                viewModel.onDeletePermanently(id)
                confirmDeleteId = null
            },
            onDismiss = { confirmDeleteId = null },
        )
    }

    if (confirmEmptyAll) {
        ConfirmDialog(
            title = stringResource(R.string.trash_empty_confirm_title),
            message = stringResource(R.string.trash_empty_confirm_message),
            onConfirm = {
                viewModel.onEmptyTrash()
                confirmEmptyAll = false
            },
            onDismiss = { confirmEmptyAll = false },
        )
    }
}

@Composable
private fun TrashItem(title: String, deletedAt: Long?, onRestore: () -> Unit, onDelete: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(start = Spacing.md, top = Spacing.sm, bottom = Spacing.sm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (deletedAt != null) {
                    Text(
                        text = DateFormat.format(deletedAt),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            IconButton(onClick = onRestore) {
                Icon(
                    imageVector = Icons.Filled.RestoreFromTrash,
                    contentDescription = stringResource(R.string.trash_restore),
                )
            }
            IconButton(onClick = onDelete) {
                Icon(
                    imageVector = Icons.Filled.DeleteForever,
                    contentDescription = stringResource(R.string.trash_delete_permanently),
                    tint = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}

@Composable
private fun ConfirmDialog(title: String, message: String, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(message) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(
                    text = stringResource(R.string.action_delete),
                    color = MaterialTheme.colorScheme.error, // 取り消せない操作だと色でも示す
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_cancel))
            }
        },
    )
}
