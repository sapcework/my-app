// 日時表示の共通フォーマッタ（相対表示）

const HM: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }; // 時刻 HH:MM

type DayKind = 'today' | 'yesterday' | 'thisYear' | 'older';

function dayKind(d: Date): DayKind {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'today';
  if (d.toDateString() === yesterday.toDateString()) return 'yesterday';
  if (d.getFullYear() === now.getFullYear()) return 'thisYear';
  return 'older';
}

// チャット吹き出し用：常に時刻を含み、日付をまたぐと相対/日付を前置
export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('ja-JP', HM);
  const kind = dayKind(d);
  if (kind === 'today') return time;
  if (kind === 'yesterday') return `昨日 ${time}`;
  if (kind === 'thisYear') return `${d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} ${time}`;
  return `${d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' })} ${time}`;
}

// トーク一覧用：今日は時刻、昨日は「昨日」、それ以前は日付のみ
export function formatListTime(iso: string): string {
  const d = new Date(iso);
  const kind = dayKind(d);
  if (kind === 'today') return d.toLocaleTimeString('ja-JP', HM);
  if (kind === 'yesterday') return '昨日';
  if (kind === 'thisYear') return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' });
}
