package com.sapcework.memo.ui.screen.tag

import androidx.compose.foundation.layout.Arrangement
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
import com.sapcework.memo.ui.component.EmptyState
import com.sapcework.memo.ui.component.TagInputDialog
import com.sapcework.memo.ui.theme.Spacing

private val LIST_MAX_WIDTH = 840.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TagScreen(onBack: () -> Unit, modifier: Modifier = Modifier, viewModel: TagViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val inputError by viewModel.inputError.collectAsStateWithLifecycle()
    val editTarget by viewModel.editTarget.collectAsStateWithLifecycle()

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
            FloatingActionButton(onClick = viewModel::onCreateClick) {
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
                        onEdit = { viewModel.onEditClick(tag) },
                        onDelete = { confirmDelete = tag },
                    )
                }
            }
        }
    }

    editTarget?.let { target ->
        TagInputDialog(
            title = stringResource(if (target.tag == null) R.string.tag_create else R.string.tag_edit),
            initialName = target.tag?.name.orEmpty(),
            error = inputError,
            onConfirm = viewModel::onSave,
            onDismiss = viewModel::onEditDismiss,
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
