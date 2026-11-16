import { useNavigate } from 'react-router-dom'
import { Check, ChevronRight, CreditCard, GraduationCap, IdCard, UserRound } from 'lucide-react'
import { useApp } from '../lib/store'
import { Card, cx, Ring, stagger } from './ui'
import type { Profile } from '../lib/types'

/** 指導者が「依頼を受けられる状態」になるまでの4ステップ */
export function coachSteps(p: Profile) {
  return [
    { key: 'profile', done: !!(p.sports?.length && p.areaLabel && p.days?.length && (p.bio || '').length >= 20), title: 'プロフィールを入力', text: '種目・地域・曜日・自己紹介（20文字以上）', icon: <UserRound size={18} />, to: '/coach-profile' },
    { key: 'verify', done: p.verified === 'approved', pending: p.verified === 'pending', title: '本人確認', text: p.verified === 'pending' ? '事務局で確認中です（通常2営業日以内）' : p.verifyNote ? `再提出をお願いします：${p.verifyNote}` : '身分証の写真を提出', icon: <IdCard size={18} />, to: '/verify' },
    { key: 'training', done: !!p.training, title: '安全研修', text: '熱中症・ケガ・ハラスメント防止（約10分）', icon: <GraduationCap size={18} />, to: '/training' },
    { key: 'payout', done: !!p.stripeChargesEnabled, title: '謝金の受取口座', text: 'カード払いの謝金が自動で振り込まれます', icon: <CreditCard size={18} />, to: '/coach-profile#payout', optional: true },
  ]
}

/** 指導者として依頼を受けられるか（本人確認と安全研修が必須） */
export const coachReady = (p?: Profile | null) => !!p && p.verified === 'approved' && !!p.training

export function CoachSetup({ compact }: { compact?: boolean }) {
  const { profile } = useApp()
  const nav = useNavigate()
  if (!profile) return null
  const steps = coachSteps(profile)
  const done = steps.filter(s => s.done).length
  if (compact && done === steps.length) return null
  // 応募できる状態なら、大きなカードは出さず、残りの任意の設定だけを小さく案内する
  if (compact && coachReady(profile)) return (
    <button onClick={() => nav('/coach-profile#payout')} className="flex w-full items-center gap-3 rounded-xl2 bg-white p-3 text-left shadow-card active:scale-[.99]">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand"><CreditCard size={18} /></span>
      <span className="flex-1 text-[13px]"><b className="block text-[14px]">謝金の受取口座を設定しましょう</b>カード払いの謝金が自動で振り込まれます</span>
      <ChevronRight size={18} className="text-ink-3" />
    </button>
  )
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-center gap-4 bg-navy p-4 text-white">
        <Ring value={(done / steps.length) * 100} size={58} stroke={6} color="#B7F03C" track="rgba(255,255,255,.15)"><span className="text-[15px] font-black">{done}/{steps.length}</span></Ring>
        <div className="min-w-0">
          <div className="text-[16px] font-black">{coachReady(profile) ? 'クラブの募集に応募できます' : '依頼を受けるための準備'}</div>
          <div className="mt-0.5 text-[12px] opacity-75">{coachReady(profile) ? '受取口座を設定すると、謝金が自動で振り込まれます' : '本人確認と安全研修が終わると、応募と依頼の受付ができます'}</div>
        </div>
      </div>
      <div className="divide-y divide-line px-4">
        {steps.map((s, i) => (
          <button key={s.key} onClick={() => nav(s.to)} style={stagger(i)} className="flex w-full animate-up items-center gap-3 py-3 text-left active:opacity-60">
            <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-full transition', s.done ? 'bg-emerald-500 text-white' : 'pending' in s && s.pending ? 'bg-amber-100 text-amber-700' : 'bg-brand-50 text-brand')}>{s.done ? <Check size={18} strokeWidth={3} /> : s.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold">{s.title}{'optional' in s && s.optional && <span className="ml-1.5 text-[11px] font-bold text-ink-3">任意</span>}</span>
              <span className={cx('block truncate text-[12px]', s.key === 'verify' && profile.verifyNote && !s.done ? 'text-red-600' : 'text-ink-2')}>{s.done ? '完了' : s.text}</span>
            </span>
            {!s.done && <ChevronRight size={18} className="text-ink-3" />}
          </button>
        ))}
      </div>
    </Card>
  )
}
