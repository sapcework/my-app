package com.sapcework.memo.domain.model

/**
 * タグのドメインモデル。名前はアプリ全体で一意。
 */
data class Tag(val id: Long, val name: String, val createdAt: Long)
