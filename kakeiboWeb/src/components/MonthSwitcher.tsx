import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatYearMonth, prevMonth, nextMonth, toYearMonth } from '../utils/date'

type Props = {
  month: string
  onChange: (month: string) => void
  disableFuture?: boolean
}

export const MonthSwitcher = ({ month, onChange, disableFuture = true }: Props) => {
  const [showPicker, setShowPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(Number(month.split('-')[0]))
  const popupRef = useRef<HTMLDivElement>(null)

  const currentMonth = toYearMonth(new Date())
  const isAtMax = disableFuture && month >= currentMonth

  useEffect(() => {
    if (!showPicker) return
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPicker])

  const openPicker = () => {
    setPickerYear(Number(month.split('-')[0]))
    setShowPicker(true)
  }

  const selectMonth = (m: number) => {
    const ym = `${pickerYear}-${String(m).padStart(2, '0')}`
    if (disableFuture && ym > currentMonth) return
    onChange(ym)
    setShowPicker(false)
  }

  const selectedM = Number(month.split('-')[1])
  const selectedY = Number(month.split('-')[0])

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => onChange(prevMonth(month))}
        aria-label="前の月"
        className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
      >
        <ChevronLeft size={18} />
      </button>

      <div ref={popupRef} className="relative">
        <button
          onClick={openPicker}
          aria-label="月を選択"
          aria-haspopup="dialog"
          aria-expanded={showPicker}
          className="text-sm font-semibold min-w-28 text-center px-2 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
        >
          {formatYearMonth(month)}
        </button>

        {showPicker && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 shadow-xl rounded-2xl p-4 z-50 w-60 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setPickerYear((y) => y - 1)}
                aria-label="前の年"
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{pickerYear}年</span>
              <button
                onClick={() => setPickerYear((y) => y + 1)}
                aria-label="次の年"
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const ym = `${pickerYear}-${String(m).padStart(2, '0')}`
                const isSelected = m === selectedM && pickerYear === selectedY
                const isFuture = disableFuture && ym > currentMonth
                return (
                  <button
                    key={m}
                    onClick={() => selectMonth(m)}
                    disabled={isFuture}
                    className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : isFuture
                          ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {m}月
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => !isAtMax && onChange(nextMonth(month))}
        disabled={isAtMax}
        aria-label="次の月"
        className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${
          isAtMax
            ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500'
        }`}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  )
}
