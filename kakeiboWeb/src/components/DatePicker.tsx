import { useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

type Props = {
  value: string // YYYY-MM-DD
  onChange: (date: string) => void
}

const DAYS = ['日', '月', '火', '水', '木', '金', '土']

export const DatePicker = ({ value, onChange }: Props) => {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const [open, setOpen] = useState(false)
  const [calYear, setCalYear] = useState(value ? Number(value.substring(0, 4)) : today.getFullYear())
  const [calMonth, setCalMonth] = useState(value ? Number(value.substring(5, 7)) : today.getMonth() + 1)

  const firstDow = new Date(calYear, calMonth - 1, 1).getDay() // 月初の曜日
  const daysInMonth = new Date(calYear, calMonth, 0).getDate()

  const prevMonth = () => {
    if (calMonth === 1) { setCalYear(calYear - 1); setCalMonth(12) }
    else setCalMonth(calMonth - 1)
  }
  const nextMonth = () => {
    if (calMonth === 12) { setCalYear(calYear + 1); setCalMonth(1) }
    else setCalMonth(calMonth + 1)
  }

  const selectDay = (day: number) => {
    const m = String(calMonth).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    onChange(`${calYear}-${m}-${d}`)
    setOpen(false)
  }

  const formatDisplay = (v: string) => {
    if (!v) return '日付を選択'
    const [y, m, d] = v.split('-')
    const dow = DAYS[new Date(Number(y), Number(m) - 1, Number(d)).getDay()]
    return `${y}年${Number(m)}月${Number(d)}日（${dow}）`
  }

  return (
    <div className="relative">
      {/* トリガーボタン */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 border border-slate-200 dark:border-slate-700 bg-transparent rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/15 transition-all text-slate-800 dark:text-slate-100 text-left"
      >
        <CalendarDays size={15} className="text-slate-400 flex-shrink-0" />
        <span className={value ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}>
          {formatDisplay(value)}
        </span>
      </button>

      {/* カレンダーパネル */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-4">
            {/* 月ナビ */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={prevMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {calYear}年{calMonth}月
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map((d, i) => (
                <div key={d} className={`text-center text-xs font-medium py-1 ${
                  i === 0 ? 'text-rose-400' : i === 6 ? 'text-indigo-400' : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {d}
                </div>
              ))}
            </div>

            {/* 日付グリッド */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const m = String(calMonth).padStart(2, '0')
                const d = String(day).padStart(2, '0')
                const dateStr = `${calYear}-${m}-${d}`
                const isSelected = dateStr === value
                const isToday = dateStr === todayStr
                const dow = (firstDow + day - 1) % 7
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={`text-sm h-9 w-full rounded-lg font-medium transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : isToday
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold'
                        : dow === 0
                        ? 'text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        : dow === 6
                        ? 'text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            {/* 今日ボタン */}
            <button
              type="button"
              onClick={() => { onChange(todayStr); setOpen(false) }}
              className="mt-3 w-full text-xs font-semibold text-indigo-600 dark:text-indigo-400 py-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
            >
              今日
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
