import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:kakeibo/data/backup/backup_parser.dart';
import 'package:kakeibo/data/backup/backup_serializer.dart';
import 'package:kakeibo/data/models/recurring_expense_model.dart';
import 'package:kakeibo/domain/entities/budget.dart';
import 'package:kakeibo/domain/entities/category.dart';
import 'package:kakeibo/domain/entities/expense.dart';

// Web版が書き出す v2 バックアップ相当のサンプル（IDはUUID、アイコンは絵文字）
Map<String, dynamic> webBackup() => {
      'version': '2',
      'exportedAt': '2026-08-04T00:00:00.000Z',
      'app': 'kakeibo-web',
      'categories': <Map<String, dynamic>>[
        {
          'id': '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
          'name': '食費',
          'color': '#FF9800',
          'icon': '🍽️',
          'iconName': 'restaurant',
          'sortOrder': 0,
        },
        {
          'id': '1',
          'name': '交通費',
          'color': '#2196F3',
          'icon': '🚗',
          'iconName': 'directions_car',
          'sortOrder': 1,
        },
      ],
      'expenses': <Map<String, dynamic>>[
        {
          'id': '3f2504e0-4f89-41d3-9a0c-0305e82c3311',
          'amount': 1200,
          'categoryId': '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
          'itemName': 'ランチ',
          'note': 'メモ',
          'date': '2026-08-04',
          'createdAt': '2026-08-04T09:00:00.000Z',
        },
      ],
      'budgets': [
        {'month': '2026-08', 'amount': 50000},
      ],
      'recurring': <Map<String, dynamic>>[
        {
          'id': '3f2504e0-4f89-41d3-9a0c-0305e82c3321',
          'name': '家賃',
          'amount': 80000,
          'categoryId': '1',
          'dayOfMonth': 27,
        },
      ],
    };

void main() {
  group('parseBackup v2（Web版との共通形式）', () {
    test('Web版のバックアップを取り込める', () {
      final data = parseBackup(jsonEncode(webBackup()));

      expect(data.categories, hasLength(2));
      expect(data.expenses, hasLength(1));
      expect(data.budgets, hasLength(1));
      expect(data.recurring, hasLength(1));

      final food = data.categories.firstWhere((c) => c.name == '食費');
      expect(food.colorValue, 0xFFFF9800); // #RRGGBB → ARGB int
      expect(food.iconName, 'restaurant');

      final expense = data.expenses.first;
      expect(expense.amount, 1200);
      expect(expense.memo, 'メモ'); // note → memo
      expect(expense.date, DateTime(2026, 8, 4));
      expect(expense.categoryId, food.id); // UUID参照が整数IDに付け替わる

      expect(data.budgets.first.year, 2026); // "2026-08" → year/month
      expect(data.budgets.first.month, 8);
      expect(data.recurring.first.isActive, isTrue); // 省略時は有効扱い
      expect(data.recurring.first.lastRegisteredYear, 0); // 未指定なら未登録扱い
    });

    test('Web版の lastGeneratedMonth を自動登録の記録として取り込む', () {
      final raw = webBackup();
      (raw['recurring'] as List<dynamic>)[0] = {
        ...(raw['recurring'] as List<dynamic>)[0] as Map<String, dynamic>,
        'lastGeneratedMonth': '2026-08',
      };
      final data = parseBackup(jsonEncode(raw));
      expect(data.recurring.first.lastRegisteredYear, 2026);
      expect(data.recurring.first.lastRegisteredMonth, 8);
    });

    test('整数として読めるIDはその値を維持し、UUIDは衝突しない番号を採番する', () {
      final data = parseBackup(jsonEncode(webBackup()));
      final transport = data.categories.firstWhere((c) => c.name == '交通費');
      final food = data.categories.firstWhere((c) => c.name == '食費');

      expect(transport.id, 1); // '1' はそのまま
      expect(food.id, isNot(1)); // UUID側は空いている番号へ
      expect(data.recurring.first.categoryId, 1); // 参照も正しく解決される
    });

    test('絵文字しか無いカテゴリはアイコン名に変換する', () {
      final raw = webBackup();
      (raw['categories'] as List)[0] = {
        'id': '1',
        'name': '食費',
        'color': '#FF9800',
        'icon': '🍽️',
        'sortOrder': 0,
      };
      raw['expenses'] = [];
      raw['recurring'] = [];
      final data = parseBackup(jsonEncode(raw));
      expect(data.categories.first.iconName, 'restaurant');
    });

    test('参照先の無いカテゴリIDを持つ支出も取り込める（不明カテゴリになる）', () {
      final raw = webBackup();
      (raw['expenses'] as List<dynamic>)[0] = {
        ...(raw['expenses'] as List<dynamic>)[0] as Map<String, dynamic>,
        'categoryId': 'deleted-category',
      };
      final data = parseBackup(jsonEncode(raw));
      expect(data.expenses.first.categoryId, 0);
    });

    test('色が #RRGGBB でないカテゴリを拒否する', () {
      final raw = webBackup();
      (raw['categories'] as List<dynamic>)[0] = {
        ...(raw['categories'] as List<dynamic>)[0] as Map<String, dynamic>,
        'color': 'orange',
      };
      expect(() => parseBackup(jsonEncode(raw)), throwsFormatException);
    });

    test('日付が YYYY-MM-DD でない支出を拒否し、何件目かを示す', () {
      final raw = webBackup();
      (raw['expenses'] as List<dynamic>)[0] = {
        ...(raw['expenses'] as List<dynamic>)[0] as Map<String, dynamic>,
        'date': '2026/08/04',
      };
      expect(
        () => parseBackup(jsonEncode(raw)),
        throwsA(isA<FormatException>().having((e) => e.message, 'message', contains('1件目'))),
      );
    });

    test('未知のバージョンを拒否する', () {
      final raw = webBackup()..['version'] = '99';
      expect(() => parseBackup(jsonEncode(raw)), throwsFormatException);
    });
  });

  group('parseBackup v1（このアプリの旧形式）', () {
    Map<String, dynamic> appV1() => {
          'version': '1',
          'exportedAt': '2026-07-20T00:00:00.000',
          'expenses': [
            {
              'id': 1,
              'amount': 1200.0,
              'categoryId': 2,
              'itemName': 'ランチ',
              'memo': null,
              'date': '2026-07-20T00:00:00.000',
              'createdAt': '2026-07-20T00:00:00.000',
            },
          ],
          'categories': [
            {
              'id': 2,
              'name': '食費',
              'colorValue': 4294951168,
              'iconName': 'restaurant',
              'sortOrder': 0,
              'createdAt': '2026-07-20T00:00:00.000',
            },
          ],
          'budgets': [
            {'id': 1, 'year': 2026, 'month': 7, 'amount': 50000.0},
          ],
          'recurring': [
            {'id': 1, 'name': '家賃', 'amount': 80000.0, 'categoryId': 2, 'dayOfMonth': 27, 'isActive': true},
          ],
        };

    test('旧バックアップを今まで通り読める', () {
      final data = parseBackup(jsonEncode(appV1()));
      expect(data.expenses.single.id, 1);
      expect(data.categories.single.colorValue, 4294951168);
      expect(data.budgets.single.month, 7);
    });

    test('Web版の旧形式(v1)は見分けて案内する', () {
      final webV1 = {
        'version': '1',
        'expenses': [
          {
            'id': 'e1',
            'amount': 1200,
            'categoryId': '1',
            'note': '',
            'date': '2026-07-15',
            'createdAt': '2026-07-15T10:00:00.000Z',
          },
        ],
        'categories': [
          {'id': '1', 'name': '食費', 'color': '#FF9800', 'icon': '🍽️'},
        ],
        'budgets': [],
        'recurring': [],
      };
      expect(
        () => parseBackup(jsonEncode(webV1)),
        throwsA(isA<FormatException>().having((e) => e.message, 'message', contains('Web版の旧形式'))),
      );
    });
  });

  group('buildBackup', () {
    final now = DateTime(2026, 8, 4, 9);
    final categories = [
      Category(id: 1, name: '食費', colorValue: 0xFFFF9800, iconName: 'restaurant', sortOrder: 0, createdAt: now),
    ];
    final expenses = [
      Expense(id: 10, amount: 1200, categoryId: 1, itemName: 'ランチ', memo: 'メモ', date: DateTime(2026, 8, 4), createdAt: now),
    ];
    final budgets = [const Budget(id: 1, year: 2026, month: 8, amount: 50000)];
    final recurring = [
      RecurringExpenseModel()
        ..id = 5
        ..name = '家賃'
        ..amount = 80000
        ..categoryId = 1
        ..dayOfMonth = 27
        ..isActive = true
        ..lastRegisteredYear = 2026
        ..lastRegisteredMonth = 8,
    ];

    test('v2形式で書き出す（Web版が読むフィールドを含む）', () {
      final out = buildBackup(
        expenses: expenses,
        categories: categories,
        budgets: budgets,
        recurring: recurring,
      );
      expect(out['version'], '2');

      final cat = (out['categories'] as List).first as Map<String, dynamic>;
      expect(cat['color'], '#FF9800'); // ARGB int → #RRGGBB
      expect(cat['icon'], '🍽️'); // Web版が読む絵文字

      final exp = (out['expenses'] as List).first as Map<String, dynamic>;
      expect(exp['date'], '2026-08-04'); // 日時ではなく日付
      expect(exp['note'], 'メモ'); // memo → note
      expect(exp['categoryId'], '1'); // IDは文字列

      expect(((out['budgets'] as List).first as Map)['month'], '2026-08');

      final rec = (out['recurring'] as List).first as Map<String, dynamic>;
      // 最後に自動登録した年月。これが無いと復元後の初回起動で今月分が二重登録される
      expect(rec['lastGeneratedMonth'], '2026-08');
    });

    test('未登録の定期支出は lastGeneratedMonth を書き出さない', () {
      final out = buildBackup(
        expenses: expenses,
        categories: categories,
        budgets: budgets,
        recurring: [
          RecurringExpenseModel()
            ..id = 6
            ..name = '未登録'
            ..amount = 100
            ..categoryId = 1
            ..dayOfMonth = 1
            ..isActive = true,
        ],
      );
      expect((out['recurring'] as List).first, isNot(contains('lastGeneratedMonth')));
    });

    test('書き出したものを読み戻せる（往復して内容が保たれる）', () {
      final out = buildBackup(
        expenses: expenses,
        categories: categories,
        budgets: budgets,
        recurring: recurring,
      );
      final data = parseBackup(jsonEncode(out));

      expect(data.categories.single.id, 1);
      expect(data.categories.single.colorValue, 0xFFFF9800);
      expect(data.expenses.single.id, 10);
      expect(data.expenses.single.categoryId, 1);
      expect(data.expenses.single.memo, 'メモ');
      expect(data.expenses.single.date, DateTime(2026, 8, 4));
      expect(data.budgets.single.year, 2026);
      expect(data.budgets.single.month, 8);
      expect(data.recurring.single.name, '家賃');
      expect(data.recurring.single.isActive, isTrue);
      expect(data.recurring.single.lastRegisteredYear, 2026); // 二重登録防止の情報が往復する
      expect(data.recurring.single.lastRegisteredMonth, 8);
    });
  });
}
