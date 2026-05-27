const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export const toYearMonth = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

export const formatYearMonth = (ym: string): string => {
  const [y, m] = ym.split('-')
  return `${y}年${Number(m)}月`
}

export const prevMonth = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return toYearMonth(d)
}

export const nextMonth = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m, 1)
  return toYearMonth(d)
}

export const firstDayOfMonth = (ym: string): string => `${ym}-01`

export const formatDate = (dateStr: string): string => {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}月${Number(d)}日`
}

export const formatDateWithDay = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00') // ローカル時刻で解釈
  const wd = WEEKDAYS[d.getDay()]
  const [, m, day] = dateStr.split('-')
  return `${Number(m)}月${Number(day)}日(${wd})`
}

export const formatTableMonth = (ym: string, currentYear: number): string => {
  const [y, m] = ym.split('-')
  return Number(y) === currentYear ? `${Number(m)}月` : `${Number(m)}月\n'${y.slice(2)}`
}
