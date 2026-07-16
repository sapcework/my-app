package com.sapcework.memo.ui.screen.tag

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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sapcework.memo.R
import com.sapcework.memo.domain.model.Tag
import com.sapcework.memo.domain.model.TagPolicy
import com.sapcework.memo.ui.component.EmptyState
import com.sapcework.memo.ui.theme.Spacing

private val LIST_MAX_WIDTH = 840.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TagScreen(onBack: () -> Unit, modifier: Modifier = Modifier, viewModel: TagViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val inputError by viewModel.inputError.collectAsStateWithLifecycle()

    /** 編集対象。nullなら未編集、Tagがnullの Editing は新規作成。 */
    var editing by remember { mutableStateOf<Editing?>(null) }
    var confirmDelete by remember { mutableStateOf<Tag?>(null) }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.tag_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.action_back),
                        )
                    }
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { editing = Editing(tag = null) }) {
                Icon(Icons.Filled.Add, contentDescription = stringResource(R.string.tag_create))
            }
        },
    ) { innerPadding ->
        when {
            uiState.isLoading -> Unit
            uiState.tags.isEmpty() -> EmptyState(
                message = stringResource(R.string.tag_empty),
                modifier = Modifier.padding(innerPadding),
            )

            else -> LazyColumn(
                modifier = Modifier
                    .padding(innerPadding)
                    .fillMaxSize()
                    .widthIn(max = LIST_MAX_WIDTH),
                contentPadding = PaddingValues(Spacing.md),
                verticalArrangement = Arrangement.spacedBy(Spacing.sm),
            ) {
                items(items = uiState.tags, key = { it.id }) { tag ->
                    TagItem(
                        tag = tag,
                        onEdit = { editing = Editing(tag = tag) },
                        onDelete = { confirmDelete = tag },
                    )
                }
            }
        }
    }

    editing?.let { target ->
        TagEditDialog(
            initialName = target.tag?.name.orEmpty(),
            errorMessage = inputError?.let { stringResource(it.messageRes(), TagPolicy.MAX_NAME_LENGTH) },
            onConfirm = { name -> viewModel.onSave(id = target.tag?.id, name = name) },
            onDismiss = {
                editing = null
                viewModel.onErrorShown()
            },
        )
    }

    confirmDelete?.let { tag ->
        AlertDialog(
            onDismissRequest = { confirmDelete = null },
            title = { Text(stringResource(R.string.tag_delete_confirm_title)) },
            text = { Text(stringResource(R.string.tag_delete_confirm_message)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.onDelete(tag.id)
                        confirmDelete = null
                    },
                ) {
                    Text(
                        text = stringResource(R.string.action_delete),
                        color = MaterialTheme.colorScheme.error,
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmDelete = null }) {
                    Text(stringResource(R.string.action_cancel))
                }
            },
        )
    }
}

@Composable
private fun TagItem(tag: Tag, onEdit: () -> Unit, onDelete: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(start = Spacing.md, top = Spacing.sm, bottom = Spacing.sm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = tag.name,
                style = MaterialTheme.typography.bodyLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = onEdit) {
                Icon(Icons.Filled.Edit, contentDescription = stringResource(R.string.tag_edit))
            }
            IconButton(onClick = onDelete) {
                Icon(
                    imageVector = Icons.Filled.Delete,
                    contentDescription = stringResource(R.string.tag_delete),
                    tint = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}

@Composable
private fun TagEditDialog(
    initialName: String,
    errorMessage: String?,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    var name by remember { mutableStateOf(initialName) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                stringResource(
                    if (initialName.isEmpty()) R.string.tag_create else R.string.tag_edit,
                ),
            )
        },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    placeholder = { Text(stringResource(R.string.edit_tag_input_placeholder)) },
                    singleLine = true,
                    isError = errorMessage != null,
                    supportingText = errorMessage?.let { { Text(it) } },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onConfirm(name) }) {
                Text(stringResource(R.string.action_save))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_cancel))
            }
        },
    )
}

/** 編集対象。tagがnullなら新規作成。 */
private data class Editing(val tag: Tag?)

private fun TagInputError.messageRes(): Int = when (this) {
    TagInputError.BLANK -> R.string.tag_error_blank
    TagInputError.TOO_LONG -> R.string.tag_error_too_long
}
