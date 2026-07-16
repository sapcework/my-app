package com.sapcework.memo.domain.model

/**
 * タグの作成・改名の結果。
 *
 * 検証の失敗は例外ではなく戻り値で表す。想定内の入力ミスで例外を投げると
 * 呼び出し側がcatchを強いられ、握り潰しやクラッシュの温床になるため。
 * 利用者へ出す文言はUI層が決める（この層はメッセージを持たない）。
 */
sealed interface TagSaveResult {

    /** 成功。[id] は作成または既存のタグID。 */
    data class Success(val id: Long) : TagSaveResult

    /** 名前が空、または空白のみ。 */
    data object BlankName : TagSaveResult

    /** [TagPolicy.MAX_NAME_LENGTH] を超えている。 */
    data object TooLong : TagSaveResult
}
