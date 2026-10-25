import 'package:flutter_test/flutter_test.dart';
import 'package:kakeibo/domain/entities/expense.dart';
import 'package:kakeibo/domain/usecases/expense/search_expenses.dart';

Expense _e(int id, {double amount = 100, int cat = 1, String? item, String? memo, DateTime? date, int createdMin = 0}) => Expense(
      id: id,
      amount: amount,
      categoryId: cat,
      itemName: item,
      memo: memo,
      date: date ?? DateTime(2026, 10, 1),
      createdAt: DateTime(2026, 1, 1).add(Duration(minutes: createdMin)),
    );

List<int?> _ids(List<Expense> list) => [for (final e in list) e.id];

void main() {
  group('matchesKeyword', () {
    test('空欄なら絞り込まない（項目名が無くても当てはまる）', () {
      for (final mode in KeywordMode.values) {
        expect(matchesKeyword(null, '', mode), isTrue, reason: mode.name);
        expect(matchesKeyword('スーパー', '  ', mode), isTrue, reason: mode.name);
      }
    });

    test('全て含む：すべての語を含むときだけ', () {
      expect(matchesKeyword('イオン 食料品', 'イオン 食料', KeywordMode.all), isTrue);
      expect(matchesKeyword('イオン 日用品', 'イオン 食料', KeywordMode.all), isFalse);
    });

    test('一部含む：どれか1語を含めばよい', () {
      expect(matchesKeyword('イオン 日用品', 'イオン 食料', KeywordMode.any), isTrue);
      expect(matchesKeyword('セブン', 'イオン 食料', KeywordMode.any), isFalse);
      expect(matchesKeyword(null, 'イオン', KeywordMode.any), isFalse);
    });

    test('一致：入力全体と完全に同じ', () {
      expect(matchesKeyword('電気', '電気', KeywordMode.exact), isTrue);
      expect(matchesKeyword('電気代', '電気', KeywordMode.exact), isFalse);
    });

    test('含まない：どの語も含まない。空の項目名も当てはまる', () {
      expect(matchesKeyword('セブン', 'イオン 食料', KeywordMode.exclude), isTrue);
      expect(matchesKeyword('食料品', 'イオン 食料', KeywordMode.exclude), isFalse);
      expect(matchesKeyword(null, 'イオン', KeywordMode.exclude), isTrue);
    });

    test('大文字・小文字、全角・半角を区別しない', () {
      expect(matchesKeyword('Amazon', 'ａｍａｚｏｎ', KeywordMode.exact), isTrue);
      expect(matchesKeyword('ＡＭＡＺＯＮプライム', 'amazon', KeywordMode.any), isTrue);
      expect(matchesKeyword('Netflix 2026', 'netflix　２０２６', KeywordMode.all), isTrue); // 全角スペースでも区切れる
    });
  });

  group('searchExpenses', () {
    test('条件なしなら全件を日付の新しい順に返す', () {
      final list = [
        _e(1, date: DateTime(2026, 9, 1)),
        _e(2, date: DateTime(2026, 10, 5)),
        _e(3, date: DateTime(2026, 8, 20)),
      ];
      expect(_ids(searchExpenses(list, const SearchCondition())), [2, 1, 3]);
    });

    test('日付の範囲は開始日0時から終了日の終わりまで', () {
      final list = [
        _e(1, date: DateTime(2026, 9, 30, 23, 59)),
        _e(2, date: DateTime(2026, 10, 1)),
        _e(3, date: DateTime(2026, 10, 31, 23, 59)),
        _e(4, date: DateTime(2026, 11, 1)),
      ];
      final c = SearchCondition(from: DateTime(2026, 10, 1, 15), to: DateTime(2026, 10, 31), sort: SearchSort.dateAsc); // 時刻付きで渡されても日単位で扱う
      expect(_ids(searchExpenses(list, c)), [2, 3]);
    });

    test('金額の最低・最高はその金額を含む', () {
      final list = [_e(1, amount: 99), _e(2, amount: 100), _e(3, amount: 500), _e(4, amount: 501)];
      const c = SearchCondition(minAmount: 100, maxAmount: 500, sort: SearchSort.amountAsc);
      expect(_ids(searchExpenses(list, c)), [2, 3]);
    });

    test('除外した分類は出さない', () {
      final list = [_e(1, cat: 1), _e(2, cat: 2), _e(3, cat: 3)];
      const c = SearchCondition(excludedCategoryIds: {2});
      expect(_ids(searchExpenses(list, c)).toSet(), {1, 3});
    });

    test('項目名とメモの条件は両方を満たすものだけ', () {
      final list = [
        _e(1, item: 'スーパー', memo: '週末'),
        _e(2, item: 'スーパー', memo: '平日'),
        _e(3, item: 'コンビニ', memo: '週末'),
      ];
      const c = SearchCondition(itemKeyword: 'スーパー', memoKeyword: '週末');
      expect(_ids(searchExpenses(list, c)), [1]);
    });

    test('4つの並べ方。同じ値どうしは登録順で安定する', () {
      final list = [
        _e(1, amount: 300, date: DateTime(2026, 10, 2), createdMin: 1),
        _e(2, amount: 100, date: DateTime(2026, 10, 1), createdMin: 2),
        _e(3, amount: 300, date: DateTime(2026, 10, 2), createdMin: 3),
        _e(4, amount: 200, date: DateTime(2026, 10, 3), createdMin: 4),
      ];
      List<int?> sorted(SearchSort s) => _ids(searchExpenses(list, SearchCondition(sort: s)));
      expect(sorted(SearchSort.dateAsc), [2, 1, 3, 4]);
      expect(sorted(SearchSort.dateDesc), [4, 3, 1, 2]);
      expect(sorted(SearchSort.amountDesc), [3, 1, 4, 2]);
      expect(sorted(SearchSort.amountAsc), [2, 4, 1, 3]);
    });

    test('矛盾した条件はエラーを返す', () {
      expect(SearchCondition(from: DateTime(2026, 10, 2), to: DateTime(2026, 10, 1)).error, isNotNull);
      expect(const SearchCondition(minAmount: 500, maxAmount: 100).error, isNotNull);
      expect(SearchCondition(from: DateTime(2026, 10, 1), to: DateTime(2026, 10, 1)).error, isNull); // 同じ日はよい
    });

    test('copyWith で日付・金額を消せる', () {
      final c = SearchCondition(from: DateTime(2026, 10, 1), minAmount: 100);
      final cleared = c.copyWith(from: () => null, minAmount: () => null);
      expect(cleared.from, isNull);
      expect(cleared.minAmount, isNull);
      expect(c.copyWith(itemKeyword: 'a').from, DateTime(2026, 10, 1)); // 指定しなければ残る
    });
  });
}
