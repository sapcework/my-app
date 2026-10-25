import '../../entities/expense.dart';

// 検索タブの条件と、その条件で支出を絞り込み・並べ替える処理。画面から切り離して単体テストできるようにしている

enum KeywordMode {
  all('全て含む'), // すべてのキーワードを含む
  any('一部含む'), // どれか1つでも含む
  exact('一致'), // 入力した文字と完全に同じ
  exclude('含まない'); // どのキーワードも含まない（空欄の支出も当てはまる）

  const KeywordMode(this.label);
  final String label;
}

enum SearchSort {
  dateAsc('日付の古いものから'),
  dateDesc('日付の新しいものから'),
  amountDesc('金額の高いものから'),
  amountAsc('金額の低いものから');

  const SearchSort(this.label);
  final String label;
}

class SearchCondition {
  final DateTime? from; // この日以降（日単位）
  final DateTime? to; // この日まで（その日の終わりまで含む）
  final double? minAmount;
  final double? maxAmount;
  final Set<int> excludedCategoryIds; // 除外した分類。「選んだもの」ではなく除外を持つので、初期値が全選択になり後から追加した分類も対象に入る
  final String itemKeyword;
  final KeywordMode itemMode;
  final String memoKeyword;
  final KeywordMode memoMode;
  final SearchSort sort;

  const SearchCondition({
    this.from,
    this.to,
    this.minAmount,
    this.maxAmount,
    this.excludedCategoryIds = const {},
    this.itemKeyword = '',
    this.itemMode = KeywordMode.any,
    this.memoKeyword = '',
    this.memoMode = KeywordMode.any,
    this.sort = SearchSort.dateDesc,
  });

  SearchCondition copyWith({ // null を指定して条件を消せるよう、日付・金額は「関数で値を渡す」形にしている
    DateTime? Function()? from,
    DateTime? Function()? to,
    double? Function()? minAmount,
    double? Function()? maxAmount,
    Set<int>? excludedCategoryIds,
    String? itemKeyword,
    KeywordMode? itemMode,
    String? memoKeyword,
    KeywordMode? memoMode,
    SearchSort? sort,
  }) {
    return SearchCondition(
      from: from != null ? from() : this.from,
      to: to != null ? to() : this.to,
      minAmount: minAmount != null ? minAmount() : this.minAmount,
      maxAmount: maxAmount != null ? maxAmount() : this.maxAmount,
      excludedCategoryIds: excludedCategoryIds ?? this.excludedCategoryIds,
      itemKeyword: itemKeyword ?? this.itemKeyword,
      itemMode: itemMode ?? this.itemMode,
      memoKeyword: memoKeyword ?? this.memoKeyword,
      memoMode: memoMode ?? this.memoMode,
      sort: sort ?? this.sort,
    );
  }

  String? get error { // 条件の矛盾（画面では「検索する」を押せなくして理由を出す）。問題が無ければ null
    if (from != null && to != null && from!.isAfter(to!)) return '開始日が終了日より後になっています';
    if (minAmount != null && maxAmount != null && minAmount! > maxAmount!) return '最低額が最高額より大きくなっています';
    return null;
  }
}

String normalizeForSearch(String s) { // 全角英数記号・全角スペースを半角にし、小文字にそろえる（大文字・小文字と全角・半角を区別しないため）
  final buf = StringBuffer();
  for (final c in s.runes) {
    if (c >= 0xFF01 && c <= 0xFF5E) {
      buf.writeCharCode(c - 0xFEE0); // 全角英数記号 → 半角
    } else if (c == 0x3000) {
      buf.write(' '); // 全角スペース
    } else {
      buf.writeCharCode(c);
    }
  }
  return buf.toString().toLowerCase().trim();
}

bool matchesKeyword(String? field, String keyword, KeywordMode mode) { // キーワード条件に合うか。キーワードが空欄なら絞り込まない
  final input = normalizeForSearch(keyword);
  if (input.isEmpty) return true;
  final text = normalizeForSearch(field ?? '');
  final words = input.split(RegExp(r'\s+'));
  return switch (mode) {
    KeywordMode.all => words.every(text.contains),
    KeywordMode.any => words.any(text.contains),
    KeywordMode.exact => text == input,
    KeywordMode.exclude => !words.any(text.contains),
  };
}

List<Expense> searchExpenses(List<Expense> all, SearchCondition c) {
  final from = c.from == null ? null : DateTime(c.from!.year, c.from!.month, c.from!.day);
  final toExclusive = c.to == null ? null : DateTime(c.to!.year, c.to!.month, c.to!.day + 1); // 終了日の翌日0時より前まで

  final result = all.where((e) {
    if (from != null && e.date.isBefore(from)) return false;
    if (toExclusive != null && !e.date.isBefore(toExclusive)) return false;
    if (c.minAmount != null && e.amount < c.minAmount!) return false;
    if (c.maxAmount != null && e.amount > c.maxAmount!) return false;
    if (c.excludedCategoryIds.contains(e.categoryId)) return false;
    if (!matchesKeyword(e.itemName, c.itemKeyword, c.itemMode)) return false;
    if (!matchesKeyword(e.memo, c.memoKeyword, c.memoMode)) return false;
    return true;
  }).toList();

  int byCreated(Expense a, Expense b) => a.createdAt.compareTo(b.createdAt); // 同じ値どうしの順序をぶれさせない
  result.sort(switch (c.sort) {
    SearchSort.dateAsc => (a, b) => a.date.compareTo(b.date) != 0 ? a.date.compareTo(b.date) : byCreated(a, b),
    SearchSort.dateDesc => (a, b) => b.date.compareTo(a.date) != 0 ? b.date.compareTo(a.date) : byCreated(b, a),
    SearchSort.amountDesc => (a, b) => b.amount.compareTo(a.amount) != 0 ? b.amount.compareTo(a.amount) : byCreated(b, a),
    SearchSort.amountAsc => (a, b) => a.amount.compareTo(b.amount) != 0 ? a.amount.compareTo(b.amount) : byCreated(a, b),
  });
  return result;
}
