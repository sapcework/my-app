import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../state/notes.dart';
import 'widgets/max_width.dart';

// 「FastNote について」画面（バージョン・更新履歴・プライバシー・ライセンスなど）

const appDeveloper = 'sapcework';
const appCopyright = '© 2026 $appDeveloper';

const changelog = <(String version, String date, List<String> items)>[ // 新しい版を先頭に足していく
  ('1.4.0', '2026-10-19', [
    'キーボードを出さずにメモを表示する「読むモード」を追加しました（上のボタンで切り替え。長いメモを選んでコピーしやすくなります）',
    '設定で、メモを読むモードで開くかどうかを選べるようにしました',
    'メニューに「全文をコピー」と「最初へ」を追加しました',
  ]),
  ('1.3.1', '2026-10-19', [
    'フォルダやごみ箱を見ているときに戻るボタンを押すと、アプリを終了せずに「マイノート」に戻るようにしました',
  ]),
  ('1.3.0', '2026-10-18', [
    'メモを長押しすると選択モードになり、まとめて☆・色・フォルダへ移動・削除ができるようになりました',
    '検索すると、一致した箇所の前後を表示し、検索語を太字で示すようにしました',
    '高速メモ帳のバックアップを取り込み直すと、書き換えたメモの内容も反映されるようにしました（FastNote 側の方が新しければそのまま）',
    'タブレットなど広い画面で、一覧やメモが読みやすい幅に収まるようにしました',
    'PIN・パスワードを何度も間違えたときの待ち時間を、回数に応じて長くしました（最大30分）',
    '暗号化バックアップのパスワードを8文字以上にしました',
    '起動できないときに、原因と対処を表示するようにしました',
  ]),
  ('1.2.1', '2026-10-18', [
    '高速メモ帳から取り込んだ一部のメモで、文字が透けて読めなくなる不具合を直しました（どんな色でも文字が読めるようにしました）',
    '設定に「メモの色をすべて消す」を追加しました',
    '高速メモ帳から取り込むときに、色を取り込むかどうかを選べるようにしました（初期値は取り込まない）',
    '「私のノート」の表示を「マイノート」に変えました',
  ]),
  ('1.2.0', '2026-10-18', [
    'パスワード付きの暗号化バックアップで書き出せるようにしました（メモ帳や Excel で開いても読めません）',
    '書き出すときに「暗号化バックアップ」と「CSV」を選べるようにしました',
  ]),
  ('1.1.1', '2026-10-17', [
    'ホーム画面のアイコンを専用のものにしました（Android 13 以降のテーマアイコンにも対応）',
    'メモを開いた画面の左右の余白を狭くし、設定で調整できるようにしました',
  ]),
  ('1.1.0', '2026-10-17', [
    '画面を高速メモ帳と同じ作りにしました（横メニュー・アプリの色・ナイトモード）',
    'フォルダ・☆（先頭に固定）・ごみ箱・リマインダーを追加しました',
    'メモを開いた画面に「編集を元に戻す」「最後へ」「共有」などのメニューを追加しました',
    '一覧と明細で文字サイズを別々に設定できるようにし、行間・文字の間隔も調整できるようにしました',
    '高速メモ帳のバックアップを、そのまま取り込めるようにしました',
    '新しいメモを書いてすぐ戻ると、保存されずに消えることがある不具合を直しました',
  ]),
  ('1.0.0', '2026-10-17', [
    '最初の版です。メモの作成・検索・色分け、CSV の取り込みと書き出し、PIN・パスワード・生体認証のロック',
  ]),
];

final appInfoProvider = FutureProvider<PackageInfo>((ref) => PackageInfo.fromPlatform());

String appVersionLabel(AsyncValue<PackageInfo> info) => switch (info) {
      AsyncData(:final value) => 'バージョン ${value.version}（ビルド ${value.buildNumber}）',
      AsyncError() => 'バージョン情報を取得できませんでした',
      _ => 'バージョンを確認しています…',
    };

class AboutScreen extends ConsumerWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final info = ref.watch(appInfoProvider);
    final count = ref.watch(notesProvider).notes.length;
    final icon = Image.asset('assets/icon/app_icon.png', width: 72, height: 72); // ホーム画面のアイコンと同じ絵柄
    Widget header(String t) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 4),
          child: Text(t, style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.primary)),
        );
    Widget bullet(String t) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 2, 16, 2),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('・'), Expanded(child: Text(t))]),
        );

    return Scaffold(
      appBar: AppBar(title: const Text('FastNote について')),
      body: MaxWidth(child: ListView(padding: const EdgeInsets.only(bottom: 32), children: [
        const SizedBox(height: 24),
        Center(child: icon),
        const SizedBox(height: 12),
        Center(child: Text('FastNote', style: theme.textTheme.headlineSmall)),
        Center(child: Text(appVersionLabel(info), style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant))),
        const SizedBox(height: 12),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 24),
          child: Text('すぐ開いて、すぐ書ける。広告なし・通信なしのメモ帳です。', textAlign: TextAlign.center),
        ),

        header('プライバシー'),
        bullet('インターネットに接続しません（通信の権限そのものを持っていません）'),
        bullet('広告・利用状況の収集・アカウント登録はありません'),
        bullet('メモはこの端末の中だけに保存されます。端末の自動バックアップにも含まれないため、機種変更の前には「バックアップを書き出す」で保存してください'),
        bullet('暗号化バックアップは AES-256 で暗号化します。パスワードはどこにも保存しないので、忘れると復元できません'),

        header('データ'),
        ListTile(dense: true, title: const Text('メモの件数'), trailing: Text('$count 件')),
        const ListTile(dense: true, title: Text('保存場所'), trailing: Text('この端末（アプリ専用の領域）')),

        header('更新履歴'),
        for (final (version, date, items) in changelog) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 2),
            child: Text('$version（$date）', style: theme.textTheme.titleSmall),
          ),
          for (final item in items) bullet(item),
        ],

        header('情報'),
        ListTile(
          leading: const Icon(Icons.description_outlined),
          title: const Text('オープンソースライセンス'),
          subtitle: const Text('このアプリで使っているライブラリ'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => showLicensePage(
            context: context,
            applicationName: 'FastNote',
            applicationVersion: info.value?.version,
            applicationIcon: Padding(padding: const EdgeInsets.all(8), child: icon),
            applicationLegalese: appCopyright,
          ),
        ),
        const ListTile(leading: Icon(Icons.person_outline), title: Text('開発'), trailing: Text(appDeveloper)),
        ListTile(
          leading: const Icon(Icons.android),
          title: const Text('パッケージ名'),
          trailing: Text(info.value?.packageName ?? 'com.sapcework.fastnote'),
        ),
        const SizedBox(height: 16),
        Center(child: Text(appCopyright, style: theme.textTheme.bodySmall)),
      ])),
    );
  }
}
