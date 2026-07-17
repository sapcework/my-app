package com.sapcework.memo.ui.component

/**
 * タグ名の検証結果。
 *
 * 検証そのものは SaveTagUseCase が担い、この層はその結果を表示用の語彙へ翻訳して受け取る。
 * 文言はUI層が決めるため、domainの [com.sapcework.memo.domain.model.TagSaveResult] とは別に持つ。
 */
enum class TagInputError { BLANK, TOO_LONG }
