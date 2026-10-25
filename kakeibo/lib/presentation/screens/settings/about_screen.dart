import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../providers/category_providers.dart';
import '../../providers/recurring_expense_providers.dart';
import '../../providers/repository_providers.dart';

// 「家計簿について」画面（バージョン・更新履歴・プライバシー・ライセンスなど）。FastNote の同名画面と同じ構成

const appDeveloper = 'sapcework';
const appCopyright = '© 2026 $appDeveloper';

const changelog = <(String version, String date, List<String> items)>[ // 新しい版を先頭に足していく
  ('1.2.0', '2026-10-25', [
    '各画面で戻るボタンを押すと、アプリを終了せずにホームに戻るようにしました（ホームで戻ると終了します）',
    '年月の切り替えをタイトルと同じ行に移し、画面を広く使えるようにしました',
    '「検索」タブを追加しました。日付・金額・分類・項目名・メモの条件で全期間から探し、並べ替えて表示できます',
    'カレンダーを日本語にし、日曜・祝日を赤、土曜を青で表示するようにしました（祝日名も表示します）',
    'ホーム・統計の合計を「¥1.2万」と丸めず、全桁で表示するようにしました',
    '電卓で桁の多い金額が「…」で切れていた不具合を直しました',
    '月別支出表の文字を大きくしました',
    'アイコンを白を基調にした家計簿らしいデザインに変え、高解像度にしました',
    '設定に「家計簿について」を追加しました（バージョン・更新履歴・ライセンスなど）',
    '書き出したバックアップやCSVを、共有シートから他のアプリに渡せるようにしました（Android）',
    'Web版とバックアップを相互に復元できるようにしました。「ファイルを選ぶ…」から端末内のファイルも読み込めます',
    '項目名の候補を、選んだカテゴリで使ったものだけにしました（よく使う順）',
    '統計の円グラフをタップしても明細が開かないことがある不具合を直しました',
    '定期支出を自動登録したときに、名前がメモ欄に入っていた不具合を直しました',
    '統計から出力するCSVを、全明細CSVと同じ列にしました',
  ]),
  ('1.1.0', '2026-07-20', [
    '4桁のパスコードでロックできるようにしました',
    'カテゴリを編集できるようにし、削除するときに使っている件数を表示するようにしました',
    '支出を削除した直後に「元に戻す」で取り消せるようにしました',
    'ホームに前月との比較を表示しました',
    '画面のデザインをWeb版に揃えました',
  ]),
  ('1.0.0', '2026-05-20', [
    '最初の版です。支出の記録・検索、統計、月別支出表、予算、定期支出、CSV出力',
  ]),
];

final appInfoProvider = FutureProvider<PackageInfo>((ref) => PackageInfo.fromPlatform());

final _expenseCountProvider = StreamProvider<int>((ref) {
  return ref.watch(expenseRepositoryProvider).watchAll().map((list) => list.length);
});

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
    final expenseCount = ref.watch(_expenseCountProvider).valueOrNull;
    final categoryCount = ref.watch(categoriesProvider).valueOrNull?.length;
    final recurringCount = ref.watch(recurringExpensesProvider).valueOrNull?.length;
    final icon = Image.asset('assets/icon/app_icon.png', width: 72, height: 72); // ホーム画面のアイコンと同じ絵柄
    Widget header(String t) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 4),
          child: Text(t, style: theme.textTheme.titleSmall?.copyWith(color: theme.colorScheme.primary)),
        );
    Widget bullet(String t) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 2, 16, 2),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('・'), Expanded(child: Text(t))]),
        );
    Widget count(String label, int? n) => ListTile(
          dense: true,
          title: Text(label),
          trailing: Text(n == null ? '…' : '$n 件'),
        );

    return Scaffold(
      appBar: AppBar(title: const Text('家計簿について')),
      body: ListView(padding: const EdgeInsets.only(bottom: 32), children: [
        const SizedBox(height: 24),
        Center(child: icon),
        const SizedBox(height: 12),
        Center(child: Text('家計簿', style: theme.textTheme.headlineSmall)),
        Center(
          child: Text(appVersionLabel(info),
              style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
        ),
        const SizedBox(height: 12),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 24),
          child: Text('毎日の支出を手軽に記録して、月ごとに振り返れるシンプルな家計簿です。', textAlign: TextAlign.center),
        ),

        header('プライバシー'),
        bullet('インターネットに接続しません（通信の権限そのものを持っていません）'),
        bullet('広告・利用状況の収集・アカウント登録はありません'),
        bullet('データはこの端末の中だけに保存されます。機種変更の前には、設定の「バックアップ」で書き出してください'),
        bullet('パスコードはそのまま保存せず、復元できない形（PBKDF2-SHA256）に変換して保存します'),

        header('データ'),
        count('支出の件数', expenseCount),
        count('カテゴリの件数', categoryCount),
        count('定期支出の件数', recurringCount),
        ListTile(
          dense: true,
          title: const Text('保存場所'),
          trailing: Text(Platform.isAndroid || Platform.isIOS ? 'この端末（アプリ専用の領域）' : 'ドキュメントフォルダ'),
        ),

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
            applicationName: '家計簿',
            applicationVersion: info.valueOrNull?.version,
            applicationIcon: Padding(padding: const EdgeInsets.all(8), child: icon),
            applicationLegalese: appCopyright,
          ),
        ),
        const ListTile(leading: Icon(Icons.person_outline), title: Text('開発'), trailing: Text(appDeveloper)),
        if (Platform.isAndroid)
          ListTile(
            leading: const Icon(Icons.android),
            title: const Text('パッケージ名'),
            trailing: Text(info.valueOrNull?.packageName ?? 'com.sapcework.kakeibo'),
          ),
        const SizedBox(height: 16),
        Center(child: Text(appCopyright, style: theme.textTheme.bodySmall)),
      ]),
    );
  }
}
