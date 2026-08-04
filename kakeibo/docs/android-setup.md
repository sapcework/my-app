# Android 実機セットアップ手順

kakeibo（Flutter版）を Android スマートフォンにインストールして動かすための手順です。
Windows PC（`D:\projects\my-app\kakeibo`）から作業する前提で書いています。

---

## 対応端末

ビルド済み APK から確認した値です。

| 項目 | 値 |
|---|---|
| 対応 OS | Android 7.0（API 24）以降 |
| targetSdk | 36 |
| 対応 ABI | arm64-v8a / armeabi-v7a / x86_64 |
| APK サイズ | 約 54MB（`--split-per-abi` で約 1/3） |

---

## 0. 前提の確認

PC 側の環境は 2026-07-20 時点で `flutter doctor` 全項目✓（Android SDK 36.1.0・ライセンス承認済み）です。
念のため作業前に確認します。

```bash
flutter doctor
```

`[✓] Android toolchain - develop for Android devices` が出ていれば OK です。
`Some Android licenses not accepted` と出た場合のみ以下を実行します。

```bash
flutter doctor --android-licenses
```

---

## 1. スマートフォン側の設定（USBデバッグを有効にする）

初回のみ必要です。メーカーによりメニュー名が多少違います。

1. **設定 → デバイス情報**（端末情報）を開く
2. **ビルド番号** を 7 回連続タップ → 「デベロッパーになりました」と表示される
3. **設定 → システム → 開発者向けオプション** を開く
4. **USBデバッグ** を ON にする
5. Xiaomi / Redmi の場合は **USB経由でインストール** も併せて ON にする

---

## 2. PC と接続して認識させる

1. USB ケーブルで PC とスマホを接続する（充電専用ケーブルでは認識しません。データ転送対応のものを使ってください）
2. スマホ側に **「USBデバッグを許可しますか？」** のダイアログが出たら
   **「このパソコンからのUSBデバッグを常に許可する」** にチェックして **許可**
3. PC 側で認識を確認する

```bash
flutter devices
```

スマホの機種名が一覧に出れば成功です。

```
Found 4 connected devices:
  SO-51D (mobile)   • ABCD1234    • android-arm64  • Android 15 (API 35)
  Windows (desktop) • windows     • windows-x64    • ...
```

出てこない場合は [7. トラブルシューティング](#7-トラブルシューティング) を参照してください。

---

## 3. 【動作確認用】そのまま実行する

まずはデバッグビルドで起動し、動くことを確認します。ホットリロードも使えます。

```bash
flutter run -d <デバイスID>
```

`<デバイスID>` は `flutter devices` の 2 列目（上の例なら `ABCD1234`）です。
接続デバイスが 1 台だけなら `flutter run` だけでも構いません。

> **注意:** デバッグビルドは意図的に最適化を切ってあるため、動作がかなり重く感じます。
> 描画のなめらかさやパフォーマンスは次の release ビルドで判断してください。

---

## 4. 【常用向け】APK をビルドして端末にインストールする

普段使いするなら release ビルドの APK を入れます。PC と繋がなくても単体で動きます。

### 4-1. 署名について

アプリの識別情報は設定済みです。

| 項目 | 値 |
|---|---|
| `applicationId` | `com.sapcework.kakeibo` |
| アプリ表示名 | 家計簿 |

署名は `android/key.properties` があればリリース署名、**無ければデバッグ署名に自動フォールバック**
する設定になっています（`android/app/build.gradle.kts`）。
このため、キーストアを作っていなくても APK のビルドは通ります。

ただしデバッグキーは環境の再構築等で変わることがあり、変わると
**上書き更新ができずアンインストール（＝データ全消去）が必要**になります。
長く使うなら [4-4](#4-4-リリース署名キーを作る推奨) でキーストアを作ってください。

### 4-2. APK をビルドする

```bash
flutter build apk --release
```

端末に合わせて絞りたい場合（サイズが 1/3 程度になります）:

```bash
flutter build apk --release --split-per-abi
```

出力先:

```
build/app/outputs/flutter-apk/app-release.apk
```

`--split-per-abi` を付けた場合は、最近の端末なら **`app-arm64-v8a-release.apk`** を使ってください。

### 4-3. 端末にインストールする

USB 接続したまま、以下のいずれかで入れます。

**方法A: Flutter から直接インストール（推奨）**

```bash
flutter install -d <デバイスID>
```

**方法B: adb を使う**

```bash
adb install -r build/app/outputs/flutter-apk/app-release.apk
```

`-r` は上書き更新（データを保持したまま再インストール）です。

**方法C: APK ファイルを直接渡す**

APK を USB／クラウド経由でスマホにコピーし、ファイルマネージャからタップして開きます。
「提供元不明のアプリ」の許可を求められたら、そのファイルマネージャ（またはブラウザ）に許可を与えてください。

### 4-4. リリース署名キーを作る（推奨）

Gradle 側の読み込み処理は実装済みです。**キーストアの作成と `key.properties` の設置だけ**行えば有効になります。

**① キーストアを作成する**（PC の安全な場所に置きます。リポジトリ内には置かないでください）

```bash
keytool -genkey -v -keystore ~/kakeibo-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias kakeibo
```

パスワードと氏名等を聞かれるので入力します。**パスワードとこのファイルは必ず保管してください。**
紛失すると以後アプリを更新できなくなります。

**② `android/key.properties` を作成する**（このファイルは gitignore 対象にすること）

```properties
storePassword=<①で設定したパスワード>
keyPassword=<①で設定したパスワード>
keyAlias=kakeibo
storeFile=C:/Users/user/kakeibo-release-key.jks
```

**③ ビルドし直す**

```bash
flutter build apk --release
```

`key.properties` の有無は Gradle 側で自動判定されるので、**コードの修正は不要**です。
`android/key.properties` と `*.jks` は `.gitignore` 済みで、コミットされません。

**④ 署名が変わることの影響**

デバッグ署名で入れた APK が既に端末にある場合、リリース署名の APK は上書き更新できません。
一度アンインストールしてから入れ直してください（**アプリのデータは消えます**）。
先に設定画面からバックアップを取り、共有シートで PC や Drive に退避しておくと安全です。

---

## 5. インストール後に確認したいこと

初回起動時にデフォルトカテゴリ 16 件が自動投入されます。以下を一通り触って確認してください。

- [ ] 起動してホーム画面が表示される（初回は DB 作成のため数秒かかることがあります）
- [ ] 支出の追加・編集・削除、削除後の「元に戻す」
- [ ] 5 タブ（ホーム／支出／表／統計／設定）の遷移
- [ ] 月切り替え（AppBar の年月ボタン → 登録済み年月の一覧）
- [ ] 統計のドーナツグラフのタップ反応
- [ ] 月別支出表の縦横スクロール同期（スマホの狭い画面での操作感）
- [ ] 予算設定・定期支出の登録
- [ ] パスコードロックの設定 → アプリを再起動してロック画面が出るか
- [ ] 電卓からの金額入力
- [ ] 設定 → バックアップ / CSV出力で**共有シートが開き**、Drive 等に送れるか
- [ ] 設定 → 復元で、書き出したバックアップが一覧に出て復元できるか

### 画面幅について

Web 版に合わせて **最大幅 512px で中央寄せ**（`lib/app.dart`）にしてあります。
スマホの実機はほぼこれ以下の幅なので、PC 版で見たときのような余白は出ず、全幅表示になります。

---

## 6. Android 固有の注意点（既知の制約）

### CSV・バックアップの取り出しは共有シートから

CSV エクスポートとバックアップの保存先は `getApplicationDocumentsDirectory()` で、
Android では**アプリ専用の非公開領域**になります。

```
/data/data/com.sapcework.kakeibo/app_flutter/
```

ここは root 化していない端末ではファイルマネージャから開けません。
そのため **Android/iOS では書き出し直後に共有シートを開く** ようにしてあります
（`lib/core/utils/file_export.dart`）。Drive・Gmail・ファイルアプリなど任意の送り先に渡せます。

対象は次の 4 つです。

- 設定 → バックアップ（JSON）
- 設定 → 全明細CSV
- 設定 → 月別支出表CSV
- 統計 → 選択月のCSV

デスクトップ（Windows）では従来どおり `Documents\` に保存し、SnackBar にパスを表示します。

> **共有シートでキャンセルしてもファイルは保存済み**です。アプリ内の「バックアップ復元」は
> 同じ非公開領域を読むため、共有せずそのまま端末内に置いておいても復元できます。

PC に直接吸い出したい場合は USB 接続して以下でも取得できます。

```bash
adb exec-out run-as com.sapcework.kakeibo tar c -C app_flutter . > backup.tar
```

### その他

- **ストレージ権限の要求は不要** です。アプリ専用領域しか使わず、外部への書き出しは
  共有シート経由（受け取ったアプリ側が保存する）のためです
- **ネットワーク通信は一切ありません**（Isar によるローカル DB のみ）。オフラインで完結します
- パスコードの PBKDF2-SHA256 20 万回は `compute()` で別 Isolate に逃がしていますが、
  ローエンド端末では解錠に 1〜2 秒かかることがあります

---

## 7. トラブルシューティング

### `flutter devices` にスマホが出てこない

順に試してください。

1. スマホの画面ロックを解除した状態にする（ロック中は認識されないことがあります）
2. USB の接続モードを **「ファイル転送 / MTP」** に変更する（通知パネルの「USB」通知から選べます）
3. 充電専用ケーブルでないか確認する
4. adb を再起動する

```bash
adb kill-server
adb devices
```

5. `adb devices` で `unauthorized` と表示される場合は、スマホ側の許可ダイアログが未応答です。
   USB を挿し直してダイアログに「許可」してください
6. それでも駄目なら、スマホの **開発者向けオプション → USBデバッグの許可を取り消す** を実行してから再接続します

### ビルドが `Gradle task assembleRelease failed` で落ちる

まずクリーンビルドを試します。

```bash
flutter clean
flutter pub get
flutter build apk --release
```

Isar は build_runner で生成したコードに依存しているため、
生成物が古い場合は併せて再生成してください。

```bash
dart run build_runner build --delete-conflicting-outputs
```

**`Could not close incremental caches ...` が出る場合**も `flutter clean` で直ります。
Kotlin のインクリメンタルコンパイルのキャッシュ破損で、Windows では
ファイルロックが絡んで起きやすいものです。

**`Namespace not specified` が出る場合**は、Isar 3.1.0 が AGP 8 以降で必須の `namespace` を
宣言していないことが原因です。`android/build.gradle.kts` の `subprojects` ブロックで
プラグインの `group` から補う対策を入れてあるので、通常は発生しません。
このブロックは `evaluationDependsOn(":app")` より**前**に置く必要があります
（後ろに置くと `Cannot run Project.afterEvaluate(Action) when the project is already evaluated` になります）。

### インストール時に「アプリがインストールされていません」と出る

同じ `applicationId` で**署名の異なる**アプリが既に入っている場合に発生します
（デバッグビルドを入れた後にリリースビルドを入れた、など）。
一度アンインストールしてから入れ直してください。**アプリのデータは消えます**ので、
必要なら先に設定画面からバックアップを取得し、6 章の `adb exec-out` で PC に退避してください。

### 起動直後にクラッシュする

`flutter run` で繋いだ状態で再現させ、コンソールのログを確認します。
アプリ単体で再現する場合は以下でログを追えます。

```bash
adb logcat -s flutter
```

---

## 参考: よく使うコマンドまとめ

| 目的 | コマンド |
|---|---|
| デバイス確認 | `flutter devices` |
| デバッグ実行 | `flutter run -d <デバイスID>` |
| リリース実行 | `flutter run --release -d <デバイスID>` |
| APK ビルド | `flutter build apk --release` |
| ABI 別 APK | `flutter build apk --release --split-per-abi` |
| インストール | `flutter install -d <デバイスID>` |
| ログ確認 | `adb logcat -s flutter` |
| クリーンビルド | `flutter clean && flutter pub get` |
