import { useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { shrinkImage, safePhoto } from '../lib/image'
import { cx } from './ui'

/** 写真を選ぶ部品（縮小・位置情報の除去はアプリ内で行う） */
export function PhotoPicker({ value, onChange, round, hint, label }: { value?: string; onChange: (v: string) => void; round?: boolean; hint: string; label: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const pick = async (f?: File) => {
    if (!f) return
    setErr(''); setBusy(true)
    try { onChange(await shrinkImage(f, round ? { max: 360, maxLen: 70_000, square: true } : { max: 900, maxLen: 140_000 })) }
    catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }
  const has = safePhoto(value)
  return (
    <div className="mb-4">
      <span className="mb-1.5 block text-[13px] font-bold text-ink-2">{label}</span>
      <div className={cx('flex gap-4', round ? 'items-center' : 'flex-col')}>
        <button type="button" onClick={() => input.current?.click()} aria-label="写真を選ぶ"
          className={cx('relative grid shrink-0 place-items-center overflow-hidden border-2 border-dashed transition active:scale-[.98]', round ? 'h-24 w-24 rounded-full' : 'aspect-[16/9] w-full rounded-2xl', has ? 'border-transparent' : 'border-line bg-canvas text-ink-3')}>
          {has ? <img src={value} alt="選んだ写真" className="h-full w-full object-cover" /> : <Camera size={round ? 26 : 32} />}
          {busy && <span className="absolute inset-0 grid place-items-center bg-white/70 text-[12px] font-bold">変換中…</span>}
        </button>
        <div className="flex-1">
          <div className="flex gap-2">
            <button type="button" onClick={() => input.current?.click()} className="rounded-full bg-brand-50 px-4 py-2 text-[13px] font-bold text-brand active:scale-95">{has ? '写真を変える' : '写真を選ぶ'}</button>
            {has && <button type="button" onClick={() => onChange('')} className="flex items-center gap-1 rounded-full px-3 py-2 text-[13px] font-bold text-ink-2 active:scale-95"><Trash2 size={14} />削除</button>}
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-3">{hint}</p>
          {err && <p className="mt-1 text-[12px] font-bold text-red-600">{err}</p>}
        </div>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}
