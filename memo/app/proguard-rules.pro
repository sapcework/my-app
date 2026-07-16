# Room / Hilt / Compose は各ライブラリ同梱のconsumer rulesで保護されるため個別指定は不要

# Timber
-dontwarn org.jetbrains.annotations.**

# 行番号を保持しクラッシュ解析を可能にする（難読化された名前は隠す）
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
