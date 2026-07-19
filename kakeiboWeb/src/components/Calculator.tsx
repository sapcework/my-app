import { useState, useEffect } from 'react'
import { Delete } from 'lucide-react'
import { useModalA11y } from '../hooks/useModalA11y'

type Props = {
  initialValue?: number
  onConfirm: (value: number) => void
  onClose: () => void
}

const calc = (a: number, b: number, op: string): number => {
  if (op === '+') return a + b
  if (op === '-') return a - b
  if (op === '×') return a * b
  if (op === '÷') return b !== 0 ? a / b : 0
  return b
}

const fmtNum = (n: number): string =>
  n === Math.trunc(n) ? n.toString() : n.toFixed(2).replace(/\.?0+$/, '')

export const Calculator = ({ initialValue, onConfirm, onClose }: Props) => {
  const initDisplay = initialValue && initialValue > 0 ? fmtNum(initialValue) : '0'
  const [display, setDisplay] = useState(initDisplay)
  const [expression, setExpression] = useState('')
  const [prev, setPrev] = useState(initialValue ?? 0)
  const [op, setOp] = useState<string | null>(null)
  const [clearNext, setClearNext] = useState(!!initialValue && initialValue > 0)
  const panelRef = useModalA11y<HTMLDivElement>(true, onClose)

  const pressDigit = (d: string) => {
    if (clearNext) {
      setClearNext(false)
      setDisplay(d === '.' ? '0.' : d === '0' ? '0' : d)
      return
    }
    setDisplay(cur => {
      if (cur === '0' && d !== '.') return d
      if (d === '.' && cur.includes('.')) return cur
      if (cur.length >= 12) return cur
      return cur + d
    })
  }

  const pressOp = (o: string) => {
    const cur = parseFloat(display) || 0
    if (op && !clearNext) {
      const res = calc(prev, cur, op)
      setExpression(`${fmtNum(res)} ${o} `)
      setPrev(res)
      setDisplay(fmtNum(res))
    } else {
      setExpression(`${fmtNum(cur)} ${o} `)
      setPrev(cur)
    }
    setOp(o)
    setClearNext(true)
  }

  const pressEq = () => {
    const cur = parseFloat(display) || 0
    if (!op) { onConfirm(Math.round(cur)); return }
    const res = calc(prev, cur, op)
    onConfirm(Math.round(res))
  }

  const pressAC = () => {
    setDisplay('0'); setExpression(''); setPrev(0); setOp(null); setClearNext(false)
  }

  const pressBack = () => {
    if (clearNext) return
    setDisplay(d => d.length <= 1 ? '0' : d.slice(0, -1))
  }

  // 物理キーボード対応（数字・演算子・Enter=確定・Backspace・Escapeは useModalA11y が処理）
  useEffect(() => { // 依存配列なし＝毎レンダー登録し直し、常に最新stateを参照するクロージャを使う
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key) || e.key === '.') { e.preventDefault(); pressDigit(e.key); return }
      if (e.key === '+') { e.preventDefault(); pressOp('+'); return }
      if (e.key === '-') { e.preventDefault(); pressOp('-'); return }
      if (e.key === '*') { e.preventDefault(); pressOp('×'); return }
      if (e.key === '/') { e.preventDefault(); pressOp('÷'); return }
      if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); pressEq(); return }
      if (e.key === 'Backspace') { e.preventDefault(); pressBack(); return }
      if (e.key === 'Delete') { e.preventDefault(); pressAC() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const numBtn = 'h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-lg font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all'
  const fnBtn = 'h-14 rounded-2xl bg-slate-200 dark:bg-slate-700 text-base font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 active:scale-95 transition-all'
  const eqBtn = 'h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-lg font-semibold text-white active:scale-95 transition-all shadow-sm shadow-indigo-600/30'
  const opBtn = (o: string) =>
    `h-14 rounded-2xl text-lg font-semibold active:scale-95 transition-all ${
      op === o && clearNext
        ? 'bg-indigo-600 text-white'
        : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/60'
    }`

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="電卓">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div ref={panelRef} tabIndex={-1} className="relative bg-white dark:bg-slate-900 rounded-3xl p-4 pb-6 w-full max-w-sm shadow-2xl">
        {/* 表示エリア */}
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 mb-3 text-right">
          <p className="text-xs text-slate-400 dark:text-slate-400 min-h-4 font-mono">{expression || ' '}</p>
          <p className="text-4xl font-bold text-slate-900 dark:text-slate-50 mt-1 tracking-tight tabular-nums">
            ¥{(parseFloat(display) || 0).toLocaleString()}
          </p>
        </div>
        {/* ボタングリッド */}
        <div className="grid grid-cols-4 gap-2">
          <button className={fnBtn} onClick={pressAC}>AC</button>
          <button className={fnBtn} onClick={pressBack} aria-label="1文字削除">
            <Delete size={18} className="mx-auto" />
          </button>
          <div />
          <button className={opBtn('÷')} onClick={() => pressOp('÷')}>÷</button>

          {['7', '8', '9'].map(d => <button key={d} className={numBtn} onClick={() => pressDigit(d)}>{d}</button>)}
          <button className={opBtn('×')} onClick={() => pressOp('×')}>×</button>

          {['4', '5', '6'].map(d => <button key={d} className={numBtn} onClick={() => pressDigit(d)}>{d}</button>)}
          <button className={opBtn('-')} onClick={() => pressOp('-')}>−</button>

          {['1', '2', '3'].map(d => <button key={d} className={numBtn} onClick={() => pressDigit(d)}>{d}</button>)}
          <button className={opBtn('+')} onClick={() => pressOp('+')}>+</button>

          <button className={`${numBtn} col-span-2`} onClick={() => pressDigit('0')}>0</button>
          <button className={numBtn} onClick={() => pressDigit('.')}>.</button>
          <button className={eqBtn} onClick={pressEq}>=</button>
        </div>
      </div>
    </div>
  )
}
