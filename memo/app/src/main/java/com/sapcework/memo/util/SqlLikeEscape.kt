package com.sapcework.memo.util

/**
 * LIKE のワイルドカードを打ち消す。
 *
 * 検索語はバインドパラメータで渡すためSQLインジェクションは起きないが、
 * 入力に含まれる `%` や `_` はそのままだとワイルドカードとして働き、
 * 利用者の意図しない一致を生む。DAO側のクエリで ESCAPE '\' を宣言しているため、
 * エスケープ文字自身を先に処理する必要がある。
 */
fun String.escapeLikeWildcards(): String = replace("""\""", """\\""") // エスケープ文字自身を最初に処理する
    .replace("%", """\%""")
    .replace("_", """\_""")
