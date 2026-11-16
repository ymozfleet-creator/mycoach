import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Heart, Info, RotateCcw, X } from 'lucide-react'
import { cx } from './ui'

/**
 * カードを左右にスワイプして選ぶ部品。
 * 右＝いいね（応募・依頼）、左＝見送る。ボタンとキーボード（←→）でも操作できる。
 */
export function SwipeDeck<T extends { id: string }>({ items, render, onLike, onPass, onInfo, onUndo, canUndo, likeLabel = 'いいね', passLabel = '見送る', empty, reserve = 330 }: {
  items: T[]
  render: (item: T) => ReactNode
  onLike: (item: T) => void
  onPass: (item: T) => void
  onInfo?: (item: T) => void
  onUndo?: () => void
  canUndo?: boolean
  likeLabel?: string
  passLabel?: string
  empty: ReactNode
  /** カード以外に使う画面の高さ（px）。カードと操作ボタンが1画面に収まるようにする */
  reserve?: number
}) {
  const [drag, setDrag] = useState({ x: 0, y: 0, on: false })
  const [fly, setFly] = useState<0 | 1 | -1>(0)
  const start = useRef({ x: 0, y: 0, t: 0 })
  const top = items[0], next = items[1]

  const decide = useCallback((dir: 1 | -1) => {
    if (!top || fly) return
    setFly(dir)
    navigator.vibrate?.(dir === 1 ? 15 : 8)
    setTimeout(() => {
      dir === 1 ? onLike(top) : onPass(top)
      setFly(0); setDrag({ x: 0, y: 0, on: false })
    }, 260)
  }, [top, fly, onLike, onPass])

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') decide(1); if (e.key === 'ArrowLeft') decide(-1) }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [decide])

  if (!top) return <>{empty}</>
  const x = fly ? fly * (innerWidth + 200) : drag.x
  const rot = x / 18
  const like = Math.max(0, Math.min(1, x / 110)), nope = Math.max(0, Math.min(1, -x / 110))
  const move = (e: React.PointerEvent) => { if (drag.on) setDrag({ x: e.clientX - start.current.x, y: (e.clientY - start.current.y) * 0.3, on: true }) }
  const up = (e: React.PointerEvent) => {
    if (!drag.on) return
    const dx = e.clientX - start.current.x, v = Math.abs(dx) / Math.max(1, Date.now() - start.current.t)
    if (dx > 110 || (dx > 50 && v > 0.6)) decide(1)
    else if (dx < -110 || (dx < -50 && v > 0.6)) decide(-1)
    else { if (Math.abs(dx) < 6 && onInfo) onInfo(top); setDrag({ x: 0, y: 0, on: false }) }
  }
  return (
    <div className="select-none">
      <div className="relative mx-auto min-h-[340px] max-w-[400px]" style={{ height: `min(calc(100dvh - ${reserve}px), 500px)` }}>
        {next && (
          <div className="absolute inset-0 rounded-[28px] bg-white shadow-card transition-transform duration-300" style={{ transform: `scale(${0.94 + Math.min(1, Math.abs(x) / 300) * 0.06}) translateY(${14 - Math.min(1, Math.abs(x) / 300) * 14}px)` }}>
            <div className="pointer-events-none h-full overflow-hidden rounded-[28px] opacity-60">{render(next)}</div>
          </div>
        )}
        <div
          key={top.id}
          role="group"
          aria-label="スワイプして選ぶカード"
          className={cx('absolute inset-0 touch-none overflow-hidden rounded-[28px] bg-white shadow-pop', drag.on ? '' : 'transition-transform duration-300 ease-out')}
          style={{ transform: `translate(${x}px, ${drag.y}px) rotate(${rot}deg)`, cursor: drag.on ? 'grabbing' : 'grab' }}
          onPointerDown={e => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); start.current = { x: e.clientX, y: e.clientY, t: Date.now() }; setDrag({ x: 0, y: 0, on: true }) }}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => setDrag({ x: 0, y: 0, on: false })}
        >
          <div className="h-full animate-fade">{render(top)}</div>
          <div className="pointer-events-none absolute left-5 top-6 rotate-[-14deg] rounded-xl border-4 border-emerald-500 px-3 py-1 text-[22px] font-black text-emerald-500" style={{ opacity: like }}>{likeLabel}</div>
          <div className="pointer-events-none absolute right-5 top-6 rotate-[14deg] rounded-xl border-4 border-slate-400 px-3 py-1 text-[22px] font-black text-slate-400" style={{ opacity: nope }}>{passLabel}</div>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-center gap-4">
        <button aria-label="ひとつ戻す" disabled={!canUndo} onClick={onUndo} className="grid h-11 w-11 place-items-center rounded-full bg-white text-amber-500 shadow-card transition active:scale-90 disabled:opacity-30"><RotateCcw size={18} /></button>
        <button aria-label={passLabel} onClick={() => decide(-1)} className="grid h-16 w-16 place-items-center rounded-full bg-white text-slate-500 shadow-pop transition active:scale-90"><X size={30} strokeWidth={3} /></button>
        <button aria-label={likeLabel} onClick={() => decide(1)} className="grid h-16 w-16 place-items-center rounded-full bg-brand text-white shadow-pop transition active:scale-90"><Heart size={28} strokeWidth={2.5} fill="currentColor" /></button>
        <button aria-label="詳しく見る" onClick={() => onInfo?.(top)} className="grid h-11 w-11 place-items-center rounded-full bg-white text-brand shadow-card transition active:scale-90"><Info size={18} /></button>
      </div>
      <p className="mt-3 text-center text-[12px] text-ink-3">右にスワイプで{likeLabel}・左で{passLabel}・タップで詳しく</p>
    </div>
  )
}
