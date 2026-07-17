package com.sapcework.memo.ui.component

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import com.sapcework.memo.R
import com.sapcework.memo.domain.model.TagPolicy

/**
 * タグ名を入力するダイアログ。タグ画面の作成/改名と、編集画面からのタグ追加で共有する。
 *
 * 検証そのものはUseCaseが担い、ここは結果を表示するだけに留める。
 * 画面ごとに検証を書くと片方だけ緩いといった食い違いが起きるため。
 */
@Composable
fun TagInputDialog(
    title: String,
    error: TagInputError?,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit,
    initialName: String = "",
) {
    var name by remember { mutableStateOf(initialName) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    placeholder = { Text(stringResource(R.string.edit_tag_input_placeholder)) },
                    singleLine = true,
                    isError = error != null,
                    supportingText = error?.let {
                        { Text(stringResource(it.messageRes(), TagPolicy.MAX_NAME_LENGTH)) }
                    },
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

private fun TagInputError.messageRes(): Int = when (this) {
    TagInputError.BLANK -> R.string.tag_error_blank
    TagInputError.TOO_LONG -> R.string.tag_error_too_long
}
