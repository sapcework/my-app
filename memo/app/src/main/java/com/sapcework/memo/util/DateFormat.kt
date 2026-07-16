package com.sapcework.memo.util

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * 一覧・編集画面の日時表示。
 *
 * 当日は時刻のみ、同年は月日、それ以外は年月日を出す。
 * 一覧で最も多いのは直近の更新であり、毎行に年を並べても情報量が増えないため。
 * minSdk 29 では java.time がそのまま使える。
 */
object DateFormat {

    private val timeOnly = DateTimeFormatter.ofPattern("H:mm")
    private val monthDay = DateTimeFormatter.ofPattern("M月d日")
    private val fullDate = DateTimeFormatter.ofPattern("yyyy年M月d日")

    fun format(epochMillis: Long, zone: ZoneId = ZoneId.systemDefault()): String {
        val dateTime = Instant.ofEpochMilli(epochMillis).atZone(zone)
        val today = LocalDate.now(zone)
        val date = dateTime.toLocalDate()
        return when {
            date == today -> dateTime.format(timeOnly)
            date.year == today.year -> dateTime.format(monthDay)
            else -> dateTime.format(fullDate)
        }
    }
}
