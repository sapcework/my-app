"""csv/ と同じ形式（日付,始値,高値,安値,終値／ヘッダなし）で最新の日足を作成する

Yahoo Finance の FX 日足は始値・終値が実際の値と合わない（始値≒終値になる）ため、
1時間足を取得して NY クローズ（NY 時間 17:00）区切りの日足に組み立てる。
"""
import json, os, sys, time, urllib.request
from collections import defaultdict
from datetime import datetime, timezone, timedelta

BASE = os.path.dirname(os.path.abspath(__file__))  # fdata フォルダ
SRC_DIR = os.path.join(BASE, 'csv')  # 通貨ペア一覧の取得元
OUT_DIR = os.path.join(BASE, 'csv_latest')  # 出力先
ROWS = 200  # 元データと同じ本数
DAYS_BACK = 330  # 取得する暦日数（200営業日より余裕を持たせる。1時間足は730日前まで）
MIN_BARS = 12  # 1日の1時間足がこれ未満なら休場日として除く（元旦など）
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'  # User-Agent なしだと Yahoo が拒否する
SUBSTITUTE = {'CNHJPY': 'CNYJPY'}  # Yahoo に履歴がないペアの代替（オフショア→オンショア人民元）

def ny_offset(u):  # NY の UTC オフセット（tzdata が無い環境向けに米国夏時間を自前計算）
    y = u.year
    second_sun_mar = [d for d in range(8, 15) if datetime(y, 3, d).weekday() == 6][0]  # 3月第2日曜
    first_sun_nov = [d for d in range(1, 8) if datetime(y, 11, d).weekday() == 6][0]  # 11月第1日曜
    start = datetime(y, 3, second_sun_mar, 7, tzinfo=timezone.utc)  # 2:00 EST = 7:00 UTC
    end = datetime(y, 11, first_sun_nov, 6, tzinfo=timezone.utc)  # 2:00 EDT = 6:00 UTC
    return timedelta(hours=-4) if start <= u < end else timedelta(hours=-5)

def trade_date(u):  # NY 17:00 以降は翌営業日扱い
    return (u + ny_offset(u) + timedelta(hours=7)).date()

def fetch(symbol):
    now = int(time.time())
    url = (f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}=X'
           f'?period1={now - DAYS_BACK * 86400}&period2={now}&interval=1h')
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)['chart']['result'][0]

def build(res):
    q = res['indicators']['quote'][0]
    days = defaultdict(list)
    for i, ts in enumerate(res.get('timestamp', [])):
        o, h, l, c = q['open'][i], q['high'][i], q['low'][i], q['close'][i]
        if None in (o, h, l, c): continue  # 値のない時間帯を除く
        days[trade_date(datetime.fromtimestamp(ts, timezone.utc))].append((ts, o, h, l, c))
    today = trade_date(datetime.now(timezone.utc))  # 進行中の営業日（未確定）
    rows = []
    for d in sorted(days):
        bars = sorted(days[d])
        if d >= today or d.weekday() >= 5 or len(bars) < MIN_BARS: continue  # 未確定日・週末・休場日を除く
        rows.append((d, (bars[0][1], max(b[2] for b in bars), min(b[3] for b in bars), bars[-1][4])))
    return rows

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    pairs = sorted(f[:-4] for f in os.listdir(SRC_DIR) if f.endswith('.csv'))
    data = {}
    for pair in pairs:
        name = SUBSTITUTE.get(pair, pair)  # 代替ペアは代替名のファイルで保存
        try:
            data[name] = dict(build(fetch(name)))
        except Exception as e:
            print(f'{pair}: fetch failed {e}'); sys.exit(1)
        time.sleep(0.5)  # 連続アクセスを控える
    dates = sorted(set.intersection(*(set(v) for v in data.values())))[-ROWS:]  # 全ペアで日付をそろえる（元データと同じ）
    if len(dates) < ROWS:
        print(f'not enough common dates ({len(dates)})'); sys.exit(1)
    for name, rows in data.items():
        dropped = sorted(d for d in rows if dates[0] <= d <= dates[-1] and d not in dates)  # 他ペアの欠損で除いた日
        digits = 3 if name.endswith('JPY') else 5  # 元データの桁数に合わせる
        with open(os.path.join(OUT_DIR, name + '.csv'), 'w', newline='\n') as f:
            for d in dates:
                f.write(d.strftime('%Y/%m/%d') + ',' + ','.join(f'{x:.{digits}f}' for x in rows[d]) + '\n')
        print(f'{name}: {dates[0]} - {dates[-1]} {len(dates)} rows' + (f' (dropped {", ".join(map(str, dropped))})' if dropped else ''))

if __name__ == '__main__':
    main()
