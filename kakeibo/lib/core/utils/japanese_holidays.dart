// 日本の祝日・振替休日・国民の休日を、通信せずに計算する（カレンダーの色分け用）。
// 2000年以降の「国民の祝日に関する法律」に基づく。春分・秋分の日は2099年まで使える近似式で求める。
// 将来の法改正や、その年だけの特別な休日（2019年の即位関連・2020/2021年の五輪による移動は反映済み）には追従できない

final Map<int, Map<DateTime, String>> _cache = {};

String? japaneseHolidayName(DateTime date) => japaneseHolidays(date.year)[DateTime(date.year, date.month, date.day)]; // 祝日・休日なら名前、平日・土日なら null

Map<DateTime, String> japaneseHolidays(int year) => _cache.putIfAbsent(year, () => _compute(year)); // その年の祝日・休日（日付は0時ちょうど）

DateTime _nthMonday(int year, int month, int n) { // その月の第n月曜日（ハッピーマンデー）
  final first = DateTime(year, month, 1);
  final offset = (DateTime.monday - first.weekday + 7) % 7;
  return DateTime(year, month, 1 + offset + 7 * (n - 1));
}

int _springEquinoxDay(int y) => (20.8431 + 0.242194 * (y - 1980) - ((y - 1980) ~/ 4)).floor(); // 1980〜2099年で有効
int _autumnEquinoxDay(int y) => (23.2488 + 0.242194 * (y - 1980) - ((y - 1980) ~/ 4)).floor();

Map<DateTime, String> _compute(int y) {
  final base = <DateTime, String>{}; // 国民の祝日（振替休日・国民の休日を除く）
  void add(int m, int d, String name) => base[DateTime(y, m, d)] = name;
  void addDate(DateTime d, String name) => base[d] = name;

  add(1, 1, '元日');
  addDate(_nthMonday(y, 1, 2), '成人の日');
  add(2, 11, '建国記念の日');
  if (y >= 2020) add(2, 23, '天皇誕生日');
  add(3, _springEquinoxDay(y), '春分の日');
  add(4, 29, y >= 2007 ? '昭和の日' : 'みどりの日');
  add(5, 3, '憲法記念日');
  if (y >= 2007) add(5, 4, 'みどりの日'); // 2006年までは国民の休日（下で自動的に入る）
  add(5, 5, 'こどもの日');
  if (y == 2020) {
    add(7, 23, '海の日'); // 東京五輪の特例
  } else if (y == 2021) {
    add(7, 22, '海の日');
  } else if (y >= 2003) {
    addDate(_nthMonday(y, 7, 3), '海の日');
  } else {
    add(7, 20, '海の日');
  }
  if (y == 2020) {
    add(8, 10, '山の日');
  } else if (y == 2021) {
    add(8, 8, '山の日');
  } else if (y >= 2016) {
    add(8, 11, '山の日');
  }
  if (y >= 2003) {
    addDate(_nthMonday(y, 9, 3), '敬老の日');
  } else {
    add(9, 15, '敬老の日');
  }
  add(9, _autumnEquinoxDay(y), '秋分の日');
  if (y == 2020) {
    add(7, 24, 'スポーツの日');
  } else if (y == 2021) {
    add(7, 23, 'スポーツの日');
  } else {
    addDate(_nthMonday(y, 10, 2), y >= 2020 ? 'スポーツの日' : '体育の日');
  }
  add(11, 3, '文化の日');
  add(11, 23, '勤労感謝の日');
  if (y <= 2018) add(12, 23, '天皇誕生日');
  if (y == 2019) {
    add(5, 1, '天皇の即位の日');
    add(10, 22, '即位礼正殿の儀の行われる日');
  }

  final result = {...base};
  for (final d in base.keys) { // 国民の休日：祝日に挟まれた平日（日曜以外）
    final next = DateTime(y, d.month, d.day + 1);
    final afterNext = DateTime(y, d.month, d.day + 2);
    if (!base.containsKey(next) && base.containsKey(afterNext) && next.weekday != DateTime.sunday) {
      result[next] = '国民の休日';
    }
  }
  for (final d in base.keys.where((d) => d.weekday == DateTime.sunday)) { // 振替休日：日曜の祝日の後の、最初の祝日でない日
    var sub = DateTime(d.year, d.month, d.day + 1);
    while (result.containsKey(sub)) {
      sub = DateTime(sub.year, sub.month, sub.day + 1);
    }
    if (sub.year == y) result[sub] = '振替休日';
  }
  return result;
}
