import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'lime' | 'ghost' | 'soft' | 'danger'; size?: 'sm' | 'md' | 'lg'; block?: boolean; loading?: boolean }
export function Button({ variant = 'primary', size = 'md', block, loading, className, children, disabled, ...p }: BtnProps) {
  const v = {
    primary: 'bg-navy text-white hover:bg-navy-700',
    lime: 'bg-lime text-navy hover:brightness-95',
    ghost: 'bg-white text-ink border border-line hover:bg-canvas',
    soft: 'bg-brand-50 text-brand-600 hover:bg-brand-100',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100',
  }[variant]
  const s = { sm: 'h-9 px-3 text-[13px] rounded-xl', md: 'h-11 px-4 text-[15px] rounded-2xl', lg: 'h-14 px-5 text-base rounded-2xl' }[size]
  return (
    <button {...p} disabled={disabled || loading}
      className={cx('inline-flex select-none items-center justify-center gap-2 font-bold transition active:scale-[.97] disabled:opacity-50 disabled:active:scale-100', v, s, block && 'w-full', className)}>
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  )
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cx('animate-up rounded-xl2 bg-white p-4 shadow-card', onClick && 'cursor-pointer transition active:scale-[.99]', className)}>
      {children}
    </div>
  )
}

export function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('mt-6', className)}>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[15px] font-bold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

const tones = {
  ok: 'bg-emerald-50 text-emerald-700',
  info: 'bg-brand-50 text-brand-600',
  warn: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-600',
  none: 'bg-slate-100 text-ink-2',
  navy: 'bg-navy text-white',
  lime: 'bg-lime text-navy',
}
export type Tone = keyof typeof tones
export function Badge({ tone = 'none', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-bold', tones[tone], className)}>{children}</span>
}

export function Avatar({ name, size = 40, color }: { name: string; size?: number; color?: string }) {
  const palette = ['#2563EB', '#E5484D', '#10B981', '#F59E0B', '#8B5CF6', '#0EA5E9', '#EC4899', '#0F2A4A']
  const c = color || palette[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % palette.length]
  return <div className="grid shrink-0 place-items-center rounded-full font-bold text-white" style={{ width: size, height: size, background: c, fontSize: size * 0.4 }}>{name.slice(0, 1)}</div>
}

export function PageHeader({ title, back, right, sub }: { title: string; back?: boolean; right?: ReactNode; sub?: string }) {
  const nav = useNavigate()
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-2 bg-canvas/85 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur-xl">
      <div className="flex min-h-[44px] items-center gap-2">
        {back && (
          <button onClick={() => nav(-1)} aria-label="戻る" className="-ml-2 grid h-10 w-10 place-items-center rounded-full text-ink active:bg-slate-200">
            <ChevronLeft size={26} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-black tracking-tight text-ink">{title}</h1>
          {sub && <p className="truncate text-[13px] text-ink-2">{sub}</p>}
        </div>
        {right}
      </div>
    </header>
  )
}

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade bg-navy/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-lg animate-sheet flex-col rounded-t-[28px] bg-white shadow-pop sm:rounded-[28px]">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
        <div className="flex items-center justify-between px-5 pb-1 pt-3">
          <h3 className="text-[17px] font-bold">{title}</h3>
          <button onClick={onClose} aria-label="閉じる" className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-ink-2"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-2">{children}</div>
        {footer && <div className="border-t border-line px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-[13px] font-bold text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-ink-3">{hint}</span>}
    </label>
  )
}
export const inputCls = 'w-full rounded-2xl border border-line bg-white px-4 py-3 text-[16px] text-ink outline-none transition placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand/10'

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-2xl bg-slate-100 p-1">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={cx('h-9 flex-1 rounded-xl text-[13px] font-bold transition', value === o.value ? 'bg-white text-ink shadow-sm' : 'text-ink-2')}>{o.label}</button>
      ))}
    </div>
  )
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl2 bg-white px-6 py-10 text-center shadow-card">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand">{icon}</div>
      <p className="font-bold">{title}</p>
      {text && <p className="mt-1 text-[13px] text-ink-2">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-shimmer rounded-xl bg-[length:200%_100%] bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100', className)} />
}

export function Row({ left, title, sub, right, onClick }: { left?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cx('flex items-center gap-3 py-3', onClick && 'cursor-pointer active:opacity-70')}>
      {left}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold">{title}</div>
        {sub && <div className="truncate text-[13px] text-ink-2">{sub}</div>}
      </div>
      {right}
    </div>
  )
}
