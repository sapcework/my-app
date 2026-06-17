// 文字列から決定的に色を割り当てる（アバターの色分け用）
const PALETTE = [
  '#4CAF50', '#5C6BC0', '#26A69A', '#EF6C00', '#AB47BC',
  '#EC407A', '#42A5F5', '#789262', '#8D6E63', '#7E57C2',
];

export function colorFromString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; // 単純ハッシュ
  return PALETTE[h % PALETTE.length];
}
