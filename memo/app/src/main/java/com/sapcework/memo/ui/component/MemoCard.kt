package com.sapcework.memo.ui.component

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PushPin
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.style.TextOverflow
import com.sapcework.memo.R
import com.sapcework.memo.domain.model.Memo
import com.sapcework.memo.ui.theme.Spacing
import com.sapcework.memo.util.DateFormat

/**
 * 一覧の1件分。
 *
 * 読み上げでは各要素を個別に読ませず、カード全体を1つの説明にまとめる。
 * 行ごとに「タイトル」「日付」「ピン留め済み」と細切れに読まれると、
 * 一覧を追う操作が著しく遅くなるため。
 */
@Composable
fun MemoCard(memo: Memo, onClick: () -> Unit, modifier: Modifier = Modifier, contentMaxLines: Int = 2) {
    val title = memo.displayTitle.ifBlank { stringResource(R.string.edit_title_placeholder) }
    val updatedText = DateFormat.format(memo.updatedAt)
    val description = buildCardDescription(
        title = title,
        updatedText = updatedText,
        isPinned = memo.isPinned,
        isFavorite = memo.isFavorite,
    )

    Card(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .clearAndSetSemantics { contentDescription = description },
    ) {
        Column(modifier = Modifier.padding(Spacing.md)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                if (memo.isPinned) {
                    Icon(
                        imageVector = Icons.Filled.PushPin,
                        contentDescription = null, // カード全体の説明に含めている
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier
                            .padding(start = Spacing.xs)
                            .size(ICON_SIZE_DP),
                    )
                }
                if (memo.isFavorite) {
                    Icon(
                        imageVector = Icons.Filled.Star,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier
                            .padding(start = Spacing.xs)
                            .size(ICON_SIZE_DP),
                    )
                }
            }

            if (memo.content.isNotBlank()) {
                Text(
                    text = memo.content,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = contentMaxLines,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = Spacing.xs),
                )
            }

            if (memo.tags.isNotEmpty()) {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(Spacing.xs),
                    modifier = Modifier.padding(top = Spacing.sm),
                ) {
                    items(memo.tags.size) { index ->
                        TagChip(name = memo.tags[index].name)
                    }
                }
            }

            Text(
                text = stringResource(R.string.list_updated_at, updatedText),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = Spacing.sm),
            )
        }
    }
}

@Composable
private fun buildCardDescription(title: String, updatedText: String, isPinned: Boolean, isFavorite: Boolean): String =
    buildList {
        add(title)
        if (isPinned) add(stringResource(R.string.cd_pinned))
        if (isFavorite) add(stringResource(R.string.cd_favorite))
        add(stringResource(R.string.list_updated_at, updatedText))
    }.joinToString("、")

private val ICON_SIZE_DP = Spacing.md
