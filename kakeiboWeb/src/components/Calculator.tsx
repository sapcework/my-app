import { useState } from 'react'

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

  const num = 'h-14 rounded-2xl bg-gray-100 text-xl font-medium text-gray-800 hover:bg-gray-200 active:scale-95 transition-transform'
  const fn = 'h-14 rounded-2xl bg-orange-100 text-xl font-medium text-orange-600 hover:bg-orange-200 active:scale-95 transition-transform'
  const eq = 'h-14 rounded-2xl bg-blue-600 text-xl font-medium text-white hover:bg-blue-700 active:scale-95 transition-transform'
  const opCls = (o: string) =>
    `h-14 rounded-2xl text-xl font-medium active:scale-95 transition-transform ${
      op === o && clearNext ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
    }`

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl p-4 pb-8 max-w-lg mx-auto w-full shadow-2xl">
        {/* 表示エリア */}
        <div className="bg-gray-50 rounded-2xl p-4 mb-3 text-right">
          <p className="text-sm text-gray-400 min-h-5">{expression || ' '}</p>
          <p className="text-4xl font-bold text-gray-800 mt-1">
            ¥{(parseFloat(display) || 0).toLocaleString()}
          </p>
        </div>
        {/* ボタングリッド */}
        <div className="grid grid-cols-4 gap-2">
          <button className={fn} onClick={pressAC}>AC</button>
          <button className={fn} onClick={pressBack}>⌫</button>
          <div />
          <button className={opCls('÷')} onClick={() => pressOp('÷')}>÷</button>

          {['7', '8', '9'].map(d => <button key={d} className={num} onClick={() => pressDigit(d)}>{d}</button>)}
          <button className={opCls('×')} onClick={() => pressOp('×')}>×</button>

          {['4', '5', '6'].map(d => <button key={d} className={num} onClick={() => pressDigit(d)}>{d}</button>)}
          <button className={opCls('-')} onClick={() => pressOp('-')}>−</button>

          {['1', '2', '3'].map(d => <button key={d} className={num} onClick={() => pressDigit(d)}>{d}</button>)}
          <button className={opCls('+')} onClick={() => pressOp('+')}>+</button>

          <button className={`${num} col-span-2`} onClick={() => pressDigit('0')}>0</button>
          <button className={num} onClick={() => pressDigit('.')}>.</button>
          <button className={eq} onClick={pressEq}>=</button>
        </div>
      </div>
    </div>
  )
}
