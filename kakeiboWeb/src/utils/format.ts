export const formatWan = (n: number): string => {
  if (n < 10000) return `¥${n.toLocaleString()}`
  const man = Math.round((n / 10000) * 10) / 10
  return `¥${Number.isInteger(man) ? man : man.toFixed(1)}万`
}
