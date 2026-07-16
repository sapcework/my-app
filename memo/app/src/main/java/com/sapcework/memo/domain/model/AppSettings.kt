package com.sapcework.memo.domain.model

/** テーマの選択。 */
enum class ThemeMode {
    LIGHT,
    DARK,

    /** 端末の設定に追従する。既定値。 */
    SYSTEM,
}

/** 本文・一覧のフォントサイズ。 */
enum class FontSize(val scale: Float) {
    SMALL(scale = 0.85f),
    MEDIUM(scale = 1.0f),
    LARGE(scale = 1.15f),
    EXTRA_LARGE(scale = 1.3f),
}

/** 一覧の表示形式。 */
enum class ListStyle {
    /** 1列。本文の抜粋を表示する。 */
    LIST,

    /** 2列以上のタイル。一覧性を優先する。 */
    GRID,
}

/**
 * 利用者の表示設定。すべて端末内にのみ保存する。
 */
data class AppSettings(
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val fontSize: FontSize = FontSize.MEDIUM,
    val listStyle: ListStyle = ListStyle.LIST,
    val sortOrder: MemoSortOrder = MemoSortOrder.UPDATED_DESC,
)
